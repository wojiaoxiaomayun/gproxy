package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"gproxy/internal/cache"
	"gproxy/internal/config"
	"gproxy/internal/logger"
	"gproxy/internal/middleware"
	"gproxy/internal/model"
	"gproxy/internal/proxy"
	"gproxy/internal/stats"

	"github.com/gin-gonic/gin"
)

//go:embed web/out/*
var webFS embed.FS

// isDev 检测是否为开发模式（使用 go run 运行）
func isDev() bool {
	return strings.Contains(os.Args[0], "go-build")
}

// containsDot 检查路径是否包含点（用于判断是否是文件请求）
func containsDot(path string) bool {
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '.' {
			return true
		}
		if path[i] == '/' {
			return false
		}
	}
	return false
}

// startWebServer 启动前端静态文件服务器（使用嵌入的文件系统）
func startWebServer(port int) {
	// 开发模式下不启动 embed 静态服务器
	if isDev() {
		log.Println("Development mode detected (go run), skipping embedded web server")
		return
	}

	log.Printf("Starting embedded web server on port %d", port)

	// 获取嵌入的文件系统，去掉 "web/out" 前缀
	webRoot, err := fs.Sub(webFS, "web/out")
	if err != nil {
		log.Printf("Failed to get embedded web filesystem: %v", err)
		log.Println("Web server will not start")
		return
	}

	// 创建独立的 Gin 实例用于前端
	gin.SetMode(gin.ReleaseMode)
	webRouter := gin.New()
	webRouter.Use(gin.Recovery())

	// CORS 中间件
	webRouter.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// 静态资源
	webRouter.StaticFS("/_next", http.FS(webRoot))
	
	// 处理 favicon
	webRouter.GET("/favicon.ico", func(c *gin.Context) {
		data, err := fs.ReadFile(webRoot, "favicon.ico")
		if err != nil {
			c.Status(404)
			return
		}
		c.Data(200, "image/x-icon", data)
	})

	// 处理所有路由
	webRouter.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// 移除开头的 /
		if len(path) > 0 && path[0] == '/' {
			path = path[1:]
		}

		// 根路径
		if path == "" {
			path = "index.html"
		}

		// 尝试读取文件
		data, err := fs.ReadFile(webRoot, path)
		if err == nil {
			// 根据扩展名设置 Content-Type
			contentType := getContentType(path)
			c.Data(200, contentType, data)
			return
		}

		// 尝试 .html 文件
		data, err = fs.ReadFile(webRoot, path+".html")
		if err == nil {
			c.Data(200, "text/html; charset=utf-8", data)
			return
		}

		// 尝试 index.html
		data, err = fs.ReadFile(webRoot, path+"/index.html")
		if err == nil {
			c.Data(200, "text/html; charset=utf-8", data)
			return
		}

		// SPA 路由 - 返回 index.html
		if !containsDot(path) {
			data, err = fs.ReadFile(webRoot, "index.html")
			if err == nil {
				c.Data(200, "text/html; charset=utf-8", data)
				return
			}
		}

		// 404
		c.Status(404)
	})

	// 启动 Web 服务器
	go func() {
		addr := fmt.Sprintf(":%d", port)
		log.Printf("Web server starting on http://localhost%s", addr)
		if err := webRouter.Run(addr); err != nil {
			log.Fatalf("Failed to start web server: %v", err)
		}
	}()
}

// getContentType 根据文件扩展名返回 Content-Type
func getContentType(path string) string {
	if len(path) < 4 {
		return "application/octet-stream"
	}
	
	ext := ""
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '.' {
			ext = path[i:]
			break
		}
		if path[i] == '/' {
			break
		}
	}
	
	switch ext {
	case ".html":
		return "text/html; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".js":
		return "application/javascript; charset=utf-8"
	case ".json":
		return "application/json; charset=utf-8"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".svg":
		return "image/svg+xml"
	case ".ico":
		return "image/x-icon"
	case ".woff":
		return "font/woff"
	case ".woff2":
		return "font/woff2"
	case ".ttf":
		return "font/ttf"
	case ".eot":
		return "application/vnd.ms-fontobject"
	default:
		return "application/octet-stream"
	}
}

func main() {
	// 设置日志
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting API Gateway Audit System...")

	// 加载配置文件（如果不存在会自动生成）
	cfg, err := config.LoadConfig("./config/config.yaml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 启动前端 Web 服务器（独立端口）
	if cfg.Server.WebPort > 0 {
		startWebServer(cfg.Server.WebPort)
	}

	// 初始化数据库
	if err := os.MkdirAll("./data", 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	if err := model.InitDB(cfg.Database.Path); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer model.CloseDB()

	// 初始化配置缓存
	configCache := cache.GetGlobalCache()
	if err := configCache.Load(); err != nil {
		log.Fatalf("Failed to load config cache: %v", err)
	}

	// 启动配置热更新
	configCache.StartReloader(cfg.GetReloadInterval())

	// 初始化日志收集器
	logCollector := logger.NewLogCollector(
		cfg.Log.BufferSize,
		cfg.Log.WorkerPool,
		cfg.Log.FilePath,
		cfg.Log.MaxSize,
		cfg.Log.MaxBackups,
		cfg.Log.MaxAge,
		cfg.Log.Compress,
	)
	logCollector.Start()
	defer logCollector.Stop()

	// 初始化统计收集器（每30秒持久化一次）
	statsCollector := stats.NewStatsCollector(30 * time.Second)
	statsCollector.Start()
	defer statsCollector.Stop()

	// 创建代理处理器
	proxyHandler := proxy.NewProxyHandler(configCache, logCollector, statsCollector)

	// 设置Gin模式
	gin.SetMode(cfg.Server.Mode)

	// 创建路由
	r := gin.New()
	r.Use(gin.Recovery())

	// CORS 中间件 - 允许前端访问
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// 健康检查（使用特殊前缀避免冲突）
	r.GET("/__gproxy__/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// 管理接口（使用特殊前缀避免与代理路径冲突）
	admin := r.Group("/__gproxy__/admin")
	{
		// 配置重载接口
		admin.POST("/reload", func(c *gin.Context) {
			log.Println("Admin: reload config")
			if err := configCache.Load(); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "config reloaded"})
		})

		// API Keys 管理
		admin.GET("/api-keys", func(c *gin.Context) {
			log.Println("Admin: get api keys")
			keys, err := model.GetAllApiKeys()
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, keys)
		})

		admin.POST("/api-keys", func(c *gin.Context) {
			var key model.ApiKey
			if err := c.ShouldBindJSON(&key); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.CreateApiKey(&key); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(201, key)
		})

		admin.PUT("/api-keys/:id", func(c *gin.Context) {
			id := c.Param("id")
			var key model.ApiKey
			if err := c.ShouldBindJSON(&key); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateApiKey(id, &key); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, key)
		})

		admin.DELETE("/api-keys/:id", func(c *gin.Context) {
			id := c.Param("id")
			if err := model.DeleteApiKey(id); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "deleted"})
		})

		// 项目管理
		admin.GET("/projects", func(c *gin.Context) {
			projects, err := model.GetAllProjects()
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, projects)
		})

		admin.POST("/projects", func(c *gin.Context) {
			var project model.Project
			if err := c.ShouldBindJSON(&project); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.CreateProject(&project); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(201, project)
		})

		admin.PUT("/projects/:id", func(c *gin.Context) {
			id := c.Param("id")
			var project model.Project
			if err := c.ShouldBindJSON(&project); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateProject(id, &project); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, project)
		})

		admin.DELETE("/projects/:id", func(c *gin.Context) {
			id := c.Param("id")
			if err := model.DeleteProject(id); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "deleted"})
		})

		// 上游管理
		admin.GET("/upstreams", func(c *gin.Context) {
			projectID := c.Query("project_id")
			upstreams, err := model.GetUpstreams(projectID)
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, upstreams)
		})

		admin.POST("/upstreams", func(c *gin.Context) {
			var upstream model.Upstream
			if err := c.ShouldBindJSON(&upstream); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.CreateUpstream(&upstream); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(201, upstream)
		})

		admin.PUT("/upstreams/:id", func(c *gin.Context) {
			id := c.Param("id")
			var upstream model.Upstream
			if err := c.ShouldBindJSON(&upstream); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateUpstream(id, &upstream); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, upstream)
		})

		admin.DELETE("/upstreams/:id", func(c *gin.Context) {
			id := c.Param("id")
			if err := model.DeleteUpstream(id); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "deleted"})
		})

		// 分组管理
		admin.GET("/groups", func(c *gin.Context) {
			projectID := c.Query("project_id")
			var groups []model.Group
			var err error
			if projectID != "" {
				groups, err = model.GetGroupsByProject(projectID)
			} else {
				groups, err = model.GetAllGroups()
			}
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, groups)
		})

		admin.POST("/groups", func(c *gin.Context) {
			var group model.Group
			if err := c.ShouldBindJSON(&group); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.CreateGroup(&group); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(201, group)
		})

		admin.PUT("/groups/:id", func(c *gin.Context) {
			id := c.Param("id")
			var group model.Group
			if err := c.ShouldBindJSON(&group); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateGroup(id, &group); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, group)
		})

		admin.DELETE("/groups/:id", func(c *gin.Context) {
			id := c.Param("id")
			if err := model.DeleteGroup(id); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "deleted"})
		})

		// 限流配置管理
		admin.GET("/rate-limits", func(c *gin.Context) {
			configs, err := model.GetAllRateLimitConfigs()
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, configs)
		})

		admin.GET("/rate-limits/:group_id", func(c *gin.Context) {
			groupID := c.Param("group_id")
			var id int64
			if _, err := fmt.Sscanf(groupID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid group_id"})
				return
			}
			config, err := model.GetRateLimitConfigByGroup(id)
			if err != nil {
				c.JSON(404, gin.H{"error": "not found"})
				return
			}
			c.JSON(200, config)
		})

		admin.PUT("/rate-limits/:group_id", func(c *gin.Context) {
			groupID := c.Param("group_id")
			var id int64
			if _, err := fmt.Sscanf(groupID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid group_id"})
				return
			}
			var config model.RateLimitConfig
			if err := c.ShouldBindJSON(&config); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateRateLimitConfig(id, &config); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, config)
		})

		admin.DELETE("/rate-limits/:group_id", func(c *gin.Context) {
			groupID := c.Param("group_id")
			var id int64
			if _, err := fmt.Sscanf(groupID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid group_id"})
				return
			}
			if err := model.DeleteRateLimitConfig(id); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "deleted"})
		})

		// 日志配置管理
		admin.GET("/log-config/:project_id", func(c *gin.Context) {
			projectID := c.Param("project_id")
			var id int64
			if _, err := fmt.Sscanf(projectID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid project_id"})
				return
			}
			config, err := model.GetLogConfigByProject(id)
			if err != nil {
				// 如果配置不存在，返回默认配置
				config = &model.LogConfig{
					ProjectID:             id,
					EnableBody:            0,
					BodyRecordThresholdMs: 500,
					MaxBodySize:           2048,
					OnlyError:             0,
				}
			}
			c.JSON(200, config)
		})

		admin.PUT("/log-config/:project_id", func(c *gin.Context) {
			projectID := c.Param("project_id")
			var id int64
			if _, err := fmt.Sscanf(projectID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid project_id"})
				return
			}
			var config model.LogConfig
			if err := c.ShouldBindJSON(&config); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateLogConfig(id, &config); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, config)
		})

		// 熔断器配置管理
		admin.GET("/circuit-breaker-configs", func(c *gin.Context) {
			configs, err := model.GetAllCircuitBreakerConfigs()
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, configs)
		})

		admin.GET("/circuit-breaker-config/:group_id", func(c *gin.Context) {
			groupID := c.Param("group_id")
			var id int64
			if _, err := fmt.Sscanf(groupID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid group_id"})
				return
			}
			config, err := model.GetCircuitBreakerConfigByGroupID(id)
			if err != nil {
				c.JSON(404, gin.H{"error": "not found"})
				return
			}
			c.JSON(200, config)
		})

		admin.PUT("/circuit-breaker-config/:group_id", func(c *gin.Context) {
			groupID := c.Param("group_id")
			var id int64
			if _, err := fmt.Sscanf(groupID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid group_id"})
				return
			}
			var config model.CircuitBreakerConfig
			if err := c.ShouldBindJSON(&config); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateCircuitBreakerConfig(id, &config); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, config)
		})

		admin.DELETE("/circuit-breaker-config/:group_id", func(c *gin.Context) {
			groupID := c.Param("group_id")
			var id int64
			if _, err := fmt.Sscanf(groupID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid group_id"})
				return
			}
			if err := model.DeleteCircuitBreakerConfig(id); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "deleted"})
		})

		// 熔断器状态查询（调试用）
		admin.GET("/circuit-breaker-status/:group_id", func(c *gin.Context) {
			groupID := c.Param("group_id")
			var id int64
			if _, err := fmt.Sscanf(groupID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid group_id"})
				return
			}
			cb := configCache.GetCircuitBreaker(id)
			if cb == nil {
				c.JSON(404, gin.H{"error": "circuit breaker not found"})
				return
			}
			c.JSON(200, gin.H{
				"group_id": id,
				"state":    cb.GetState(),
				"debug":    cb.GetDebugInfo(),
			})
		})

		// 日志查询
		admin.GET("/logs", func(c *gin.Context) {
			logs := logCollector.GetRecentLogs(100)
			c.JSON(200, logs)
		})

		// 统计接口 - 全局统计
		admin.GET("/stats/global", func(c *gin.Context) {
			stats := statsCollector.GetGlobalStats()
			c.JSON(200, stats)
		})

		// 统计接口 - 全局今日统计
		admin.GET("/stats/global/today", func(c *gin.Context) {
			stats := statsCollector.GetTodayGlobalStats()
			c.JSON(200, stats)
		})

		// 统计接口 - 所有项目统计
		admin.GET("/stats/projects", func(c *gin.Context) {
			projectStats := statsCollector.GetAllProjectStats()
			c.JSON(200, projectStats)
		})

		// 统计接口 - 单个项目统计
		admin.GET("/stats/project/:project_id", func(c *gin.Context) {
			projectID := c.Param("project_id")
			var id int64
			if _, err := fmt.Sscanf(projectID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid project_id"})
				return
			}
			stats := statsCollector.GetProjectStats(id)
			if stats == nil {
				c.JSON(404, gin.H{"error": "no stats found for this project"})
				return
			}
			c.JSON(200, stats)
		})

		// 统计接口 - 单个项目今日统计
		admin.GET("/stats/project/:project_id/today", func(c *gin.Context) {
			projectID := c.Param("project_id")
			var id int64
			if _, err := fmt.Sscanf(projectID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid project_id"})
				return
			}
			stats := statsCollector.GetTodayProjectStats(id)
			if stats == nil {
				c.JSON(200, gin.H{
					"pv":          0,
					"active_keys": 0,
					"last_update": time.Now().Format(time.RFC3339),
				})
				return
			}
			c.JSON(200, stats)
		})

		// 统计接口 - 所有分组统计
		admin.GET("/stats/groups", func(c *gin.Context) {
			groupStats := statsCollector.GetAllGroupStats()
			c.JSON(200, groupStats)
		})

		// 统计接口 - 单个分组统计
		admin.GET("/stats/group/:group_id", func(c *gin.Context) {
			groupID := c.Param("group_id")
			var id int64
			if _, err := fmt.Sscanf(groupID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid group_id"})
				return
			}
			stats := statsCollector.GetGroupStats(id)
			if stats == nil {
				c.JSON(404, gin.H{"error": "no stats found for this group"})
				return
			}
			c.JSON(200, stats)
		})

		// 统计接口 - 所有 API Key 统计
		admin.GET("/stats/keys", func(c *gin.Context) {
			keyStats := statsCollector.GetAllKeyStats()
			c.JSON(200, keyStats)
		})

		// 统计接口 - 单个 API Key 统计
		admin.GET("/stats/key/:app_key", func(c *gin.Context) {
			appKey := c.Param("app_key")
			stats := statsCollector.GetKeyStats(appKey)
			if stats == nil {
				c.JSON(404, gin.H{"error": "no stats found for this key"})
				return
			}
			c.JSON(200, stats)
		})

		// 每日统计接口 - 获取指定日期的全局统计
		admin.GET("/stats/daily/global", func(c *gin.Context) {
			date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))
			stats, err := model.GetDailyStats(date, "global", 0, "")
			if err != nil {
				c.JSON(404, gin.H{"error": "no daily stats found"})
				return
			}
			c.JSON(200, stats)
		})

		// 每日统计接口 - 获取指定日期范围的全局统计
		admin.GET("/stats/daily/global/range", func(c *gin.Context) {
			startDate := c.Query("start_date")
			endDate := c.Query("end_date")
			if startDate == "" || endDate == "" {
				c.JSON(400, gin.H{"error": "start_date and end_date are required"})
				return
			}
			stats, err := model.GetDailyStatsByDateRange(startDate, endDate, "global", 0, "")
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, stats)
		})

		// 每日统计接口 - 获取最近N天的全局统计
		admin.GET("/stats/daily/global/latest", func(c *gin.Context) {
			days := 30 // 默认30天
			if daysStr := c.Query("days"); daysStr != "" {
				if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
					days = d
				}
			}
			stats, err := model.GetLatestDailyStats(days, "global", 0, "")
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, stats)
		})

		// 每日统计接口 - 获取指定项目的每日统计
		admin.GET("/stats/daily/project/:project_id", func(c *gin.Context) {
			projectID := c.Param("project_id")
			var id int64
			if _, err := fmt.Sscanf(projectID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid project_id"})
				return
			}
			
			days := 30
			if daysStr := c.Query("days"); daysStr != "" {
				if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
					days = d
				}
			}
			
			stats, err := model.GetLatestDailyStats(days, "project", id, "")
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, stats)
		})

		// 每日统计接口 - 获取指定分组的每日统计
		admin.GET("/stats/daily/group/:group_id", func(c *gin.Context) {
			groupID := c.Param("group_id")
			var id int64
			if _, err := fmt.Sscanf(groupID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid group_id"})
				return
			}
			
			days := 30
			if daysStr := c.Query("days"); daysStr != "" {
				if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
					days = d
				}
			}
			
			stats, err := model.GetLatestDailyStats(days, "group", id, "")
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, stats)
		})

		// 每日统计接口 - 获取指定 API Key 的每日统计
		admin.GET("/stats/daily/key/:app_key", func(c *gin.Context) {
			appKey := c.Param("app_key")
			
			days := 30
			if daysStr := c.Query("days"); daysStr != "" {
				if d, err := strconv.Atoi(daysStr); err == nil && d > 0 {
					days = d
				}
			}
			
			stats, err := model.GetLatestDailyStats(days, "key", 0, appKey)
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, stats)
		})

		// 每日统计接口 - 获取指定日期所有项目的统计
		admin.GET("/stats/daily/projects", func(c *gin.Context) {
			date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))
			stats, err := model.GetAllDailyStatsByDate(date, "project")
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, stats)
		})

		// 每日统计接口 - 获取指定日期所有分组的统计
		admin.GET("/stats/daily/groups", func(c *gin.Context) {
			date := c.DefaultQuery("date", time.Now().Format("2006-01-02"))
			stats, err := model.GetAllDailyStatsByDate(date, "group")
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, stats)
		})
	}

	// 使用 NoRoute 处理所有其他请求（代理）
	// 注意：需要排除 /__gproxy__/* 路径
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		
		// 如果是管理路径，返回 404（已经被上面的路由处理过了）
		if len(path) >= 11 && path[:11] == "/__gproxy__" {
			c.JSON(404, gin.H{"error": "not found"})
			return
		}

		// 应用中间件并处理代理请求
		middleware.AuthMiddleware()(c)
		if c.IsAborted() {
			return
		}
		middleware.RateLimitMiddleware()(c)
		if c.IsAborted() {
			return
		}
		middleware.CircuitBreakerMiddleware()(c)
		if c.IsAborted() {
			return
		}
		proxyHandler.Handle(c)
	})

	// 启动服务器
	port := fmt.Sprintf(":%d", cfg.Server.Port)
	log.Printf("API server starting on http://localhost%s", port)
	if cfg.Server.WebPort > 0 {
		log.Printf("Web UI available at http://localhost:%d", cfg.Server.WebPort)
	}

	// 优雅关闭
	go func() {
		if err := r.Run(port); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	time.Sleep(2 * time.Second)
	log.Println("Server stopped")
}
