package proxy

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"gproxy/internal/breaker"
	"gproxy/internal/cache"
	"gproxy/internal/logger"
	"gproxy/internal/stats"

	"github.com/gin-gonic/gin"
)

// ProxyHandler 反向代理处理器
type ProxyHandler struct {
	configCache    *cache.ConfigCache
	logCollector   *logger.LogCollector
	statsCollector *stats.StatsCollector
}

// NewProxyHandler 创建代理处理器
func NewProxyHandler(configCache *cache.ConfigCache, logCollector *logger.LogCollector, statsCollector *stats.StatsCollector) *ProxyHandler {
	return &ProxyHandler{
		configCache:    configCache,
		logCollector:   logCollector,
		statsCollector: statsCollector,
	}
}

// Handle 处理代理请求
func (h *ProxyHandler) Handle(c *gin.Context) {
	startTime := time.Now()

	// 从上下文获取配置
	projectID, _ := c.Get("project_id")
	appKey, _ := c.Get("app_key")
	groupID, _ := c.Get("group_id")
	cb, _ := c.Get("circuit_breaker")

	// 根据请求路径获取匹配的上游配置
	requestPath := c.Request.URL.Path
	upstream := h.configCache.GetUpstream(projectID.(int64), requestPath)
	if upstream == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "no matching upstream found for path: " + requestPath,
		})
		return
	}

	// 读取请求体（用于日志）
	var requestBody []byte
	var bodyHash string
	if c.Request.Body != nil {
		requestBody, _ = io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		
		// 计算body hash
		if len(requestBody) > 0 {
			hash := sha256.Sum256(requestBody)
			bodyHash = hex.EncodeToString(hash[:])
		}
	}

	// 解析目标URL
	targetURL, err := url.Parse(upstream.TargetURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "invalid target url",
		})
		return
	}

	// 创建反向代理
	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	
	// 设置超时
	proxy.Transport = &http.Transport{
		ResponseHeaderTimeout: upstream.Timeout,
	}

	// 修改请求
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = targetURL.Host
		req.URL.Scheme = targetURL.Scheme
		req.URL.Host = targetURL.Host
		
		// 处理路径前缀
		if upstream.PathPrefix != "" {
			req.URL.Path = strings.TrimPrefix(req.URL.Path, upstream.PathPrefix)
		}
	}

	// 自定义响应处理
	var statusCode int
	var responseError string
	var handledInErrorHandler bool // 标记是否在ErrorHandler中处理过
	
	proxy.ModifyResponse = func(resp *http.Response) error {
		statusCode = resp.StatusCode
		return nil
	}

	// 错误处理
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Printf("Proxy error: %v", err)
		responseError = err.Error()
		statusCode = http.StatusBadGateway
		handledInErrorHandler = true // 标记已处理
		
		// 记录失败
		if cb != nil {
			cb.(*breaker.CircuitBreaker).RecordFailure()
		}
		
		// 计算耗时
		costMs := time.Since(startTime).Milliseconds()
		
		// 收集统计（在日志之前，确保统计不会丢失）
		if h.statsCollector != nil {
			h.statsCollector.RecordRequest(projectID.(int64), groupID.(int64), appKey.(string))
		}
		
		// 收集日志（错误情况）
		h.collectLog(c, projectID.(int64), appKey.(string), groupID.(int64), 
			requestBody, bodyHash, statusCode, costMs, responseError)
		
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte(fmt.Sprintf(`{"error": "proxy error: %v"}`, err)))
	}

	// 执行代理
	proxy.ServeHTTP(c.Writer, c.Request)

	// 如果已经在ErrorHandler中处理过，直接返回，避免重复统计
	if handledInErrorHandler {
		return
	}

	// 记录成功
	if cb != nil && statusCode < 500 {
		cb.(*breaker.CircuitBreaker).RecordSuccess()
	}

	// 计算耗时
	costMs := time.Since(startTime).Milliseconds()

	// 收集统计（在日志之前，确保统计不会丢失）
	if h.statsCollector != nil {
		h.statsCollector.RecordRequest(projectID.(int64), groupID.(int64), appKey.(string))
	}

	// 收集日志（成功情况）
	h.collectLog(c, projectID.(int64), appKey.(string), groupID.(int64), 
		requestBody, bodyHash, statusCode, costMs, responseError)
}

// collectLog 收集日志
func (h *ProxyHandler) collectLog(c *gin.Context, projectID int64, appKey string, groupID int64,
	requestBody []byte, bodyHash string, statusCode int, costMs int64, errorMsg string) {
	
	// 获取日志配置（可选）
	logConfig := h.configCache.GetLogConfig(projectID)
	
	// 默认配置：记录所有请求，不记录body
	enableBody := false
	bodyRecordThresholdMs := 500
	maxBodySize := 2048
	onlyError := false
	
	// 如果有配置，使用配置的值
	if logConfig != nil {
		enableBody = logConfig.EnableBody
		bodyRecordThresholdMs = logConfig.BodyRecordThresholdMs
		maxBodySize = logConfig.MaxBodySize
		onlyError = logConfig.OnlyError
	}

	// 检查是否只记录错误
	if onlyError && statusCode < 400 {
		return
	}

	// 准备日志数据
	logEntry := &logger.LogEntry{
		Timestamp: time.Now().Format(time.RFC3339),
		ProjectID: projectID,
		AppKey:    appKey,
		GroupID:   groupID,
		Method:    c.Request.Method,
		Path:      c.Request.URL.Path,
		Query:     c.Request.URL.RawQuery,
		Status:    statusCode,
		CostMs:    costMs,
		ClientIP:  c.ClientIP(),
		Error:     errorMsg,
	}

	// 处理body（如果启用）
	if enableBody && len(requestBody) > 0 {
		// 检查是否超过阈值
		if costMs >= int64(bodyRecordThresholdMs) {
			bodySize := len(requestBody)
			logEntry.BodySize = bodySize
			logEntry.BodyHash = bodyHash
			
			// 截取body预览
			if bodySize > maxBodySize {
				logEntry.BodyPreview = string(requestBody[:maxBodySize]) + "..."
			} else {
				logEntry.BodyPreview = string(requestBody)
			}
		}
	}

	// 发送到日志收集器
	h.logCollector.Collect(logEntry)
}
