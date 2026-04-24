package cache

import (
	"log"
	"sync"
	"time"

	"gproxy/internal/breaker"
	"gproxy/internal/model"
	"gproxy/internal/ratelimit"
)

// ApiKeyConfig API Key配置（内存缓存）
type ApiKeyConfig struct {
	Name      string
	AppKey    string
	ProjectID int64
	GroupID   int64
	Status    string
}

// UpstreamConfig 上游配置
type UpstreamConfig struct {
	ID         int64
	ProjectID  int64
	TargetURL  string
	PathPrefix string
	Timeout    time.Duration
}

// LogConfigCache 日志配置缓存
type LogConfigCache struct {
	ProjectID             int64
	EnableBody            bool
	BodyRecordThresholdMs int
	MaxBodySize           int
	OnlyError             bool
}

// ConfigCache 配置缓存管理器
type ConfigCache struct {
	mu sync.RWMutex

	// API Key映射: appKey -> ApiKeyConfig
	apiKeys map[string]*ApiKeyConfig

	// 限流器映射: groupId -> RateLimiter
	rateLimiters map[int64]ratelimit.RateLimiter

	// 上游配置映射: projectId -> []UpstreamConfig (按 path_prefix 长度降序排列)
	upstreams map[int64][]*UpstreamConfig

	// 日志配置映射: projectId -> LogConfigCache
	logConfigs map[int64]*LogConfigCache

	// 分组配置映射: groupId -> qps/burst
	rateLimitConfigs map[int64]*model.RateLimitConfig

	// 熔断器配置映射: groupId -> CircuitBreakerConfig
	circuitBreakerConfigs map[int64]*model.CircuitBreakerConfig

	// 熔断器实例映射: groupId -> CircuitBreaker
	circuitBreakers map[int64]*breaker.CircuitBreaker
}

var (
	globalCache *ConfigCache
	once        sync.Once
)

// GetGlobalCache 获取全局缓存实例（单例）
func GetGlobalCache() *ConfigCache {
	once.Do(func() {
		globalCache = &ConfigCache{
			apiKeys:               make(map[string]*ApiKeyConfig),
			rateLimiters:          make(map[int64]ratelimit.RateLimiter),
			upstreams:             make(map[int64][]*UpstreamConfig),
			logConfigs:            make(map[int64]*LogConfigCache),
			rateLimitConfigs:      make(map[int64]*model.RateLimitConfig),
			circuitBreakerConfigs: make(map[int64]*model.CircuitBreakerConfig),
			circuitBreakers:       make(map[int64]*breaker.CircuitBreaker),
		}
	})
	return globalCache
}

// Load 从数据库加载所有配置到内存
func (c *ConfigCache) Load() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 清空旧数据（但不清空限流器和熔断器，因为它们有状态）
	c.apiKeys = make(map[string]*ApiKeyConfig)
	c.upstreams = make(map[int64][]*UpstreamConfig)
	c.logConfigs = make(map[int64]*LogConfigCache)
	// 注意：不清空 rateLimiters, rateLimitConfigs, circuitBreakerConfigs 和 circuitBreakers
	// 它们在各自的 load 方法中处理

	// 加载 API Keys
	if err := c.loadApiKeys(); err != nil {
		return err
	}

	// 加载限流配置
	if err := c.loadRateLimitConfigs(); err != nil {
		return err
	}

	// 加载上游配置
	if err := c.loadUpstreams(); err != nil {
		return err
	}

	// 加载日志配置
	if err := c.loadLogConfigs(); err != nil {
		return err
	}

	// 加载熔断器配置
	if err := c.loadCircuitBreakerConfigs(); err != nil {
		return err
	}

	log.Printf("Config cache loaded: %d api_keys, %d rate_limiters, %d upstreams, %d log_configs, %d circuit_breakers",
		len(c.apiKeys), len(c.rateLimiters), len(c.upstreams), len(c.logConfigs), len(c.circuitBreakers))

	return nil
}

// loadApiKeys 加载API Keys
func (c *ConfigCache) loadApiKeys() error {
	var keys []model.ApiKey
	if err := model.DB.Find(&keys).Error; err != nil {
		return err
	}

	for _, k := range keys {
		c.apiKeys[k.AppKey] = &ApiKeyConfig{
			Name:      k.Name,
			AppKey:    k.AppKey,
			ProjectID: k.ProjectID,
			GroupID:   k.GroupID,
			Status:    k.Status,
		}
	}

	return nil
}

// loadRateLimitConfigs 加载限流配置并创建限流器
func (c *ConfigCache) loadRateLimitConfigs() error {
	var configs []model.RateLimitConfig
	if err := model.DB.Find(&configs).Error; err != nil {
		return err
	}

	// 记录新配置的 GroupID
	newGroupIDs := make(map[int64]bool)

	for _, cfg := range configs {
		newGroupIDs[cfg.GroupID] = true
		
		// 检查是否已存在限流器
		existingLimiter := c.rateLimiters[cfg.GroupID]
		existingConfig := c.rateLimitConfigs[cfg.GroupID]
		
		// 判断配置是否变化
		configChanged := existingConfig == nil ||
			existingConfig.QPS != cfg.QPS ||
			existingConfig.Burst != cfg.Burst ||
			existingConfig.EnableMultiWindow != cfg.EnableMultiWindow ||
			existingConfig.RPM != cfg.RPM ||
			existingConfig.RPH != cfg.RPH
		
		// 只有配置变化时才重新创建限流器
		if configChanged {
			c.rateLimitConfigs[cfg.GroupID] = &cfg
			
			// 根据配置选择限流器类型
			if cfg.EnableMultiWindow == 1 {
				// 启用多窗口限流器
				c.rateLimiters[cfg.GroupID] = ratelimit.NewMultiWindowLimiter(
					cfg.QPS,
					cfg.Burst,
					cfg.RPM,
					cfg.RPH,
				)
				log.Printf("Group %d: Multi-window limiter updated (QPS=%d, Burst=%d, RPM=%d, RPH=%d)",
					cfg.GroupID, cfg.QPS, cfg.Burst, cfg.RPM, cfg.RPH)
			} else {
				// 使用简单限流器
				c.rateLimiters[cfg.GroupID] = ratelimit.NewSimpleLimiter(cfg.QPS, cfg.Burst)
				log.Printf("Group %d: Simple limiter updated (QPS=%d, Burst=%d)",
					cfg.GroupID, cfg.QPS, cfg.Burst)
			}
		} else if existingLimiter != nil {
			// 配置未变化，保留现有限流器实例
			c.rateLimitConfigs[cfg.GroupID] = &cfg
		}
	}

	// 删除不再存在的限流器
	for groupID := range c.rateLimiters {
		if !newGroupIDs[groupID] {
			delete(c.rateLimiters, groupID)
			delete(c.rateLimitConfigs, groupID)
			log.Printf("Group %d: Rate limiter removed", groupID)
		}
	}

	return nil
}

// loadUpstreams 加载上游配置
func (c *ConfigCache) loadUpstreams() error {
	var upstreams []model.Upstream
	if err := model.DB.Find(&upstreams).Error; err != nil {
		return err
	}

	// 按项目分组
	projectUpstreams := make(map[int64][]*UpstreamConfig)
	for _, u := range upstreams {
		config := &UpstreamConfig{
			ID:         u.ID,
			ProjectID:  u.ProjectID,
			TargetURL:  u.TargetURL,
			PathPrefix: u.PathPrefix,
			Timeout:    time.Duration(u.Timeout) * time.Millisecond,
		}
		projectUpstreams[u.ProjectID] = append(projectUpstreams[u.ProjectID], config)
	}

	// 对每个项目的上游按 path_prefix 长度降序排序（最长匹配优先）
	for projectID, upstreamList := range projectUpstreams {
		// 使用冒泡排序（简单实现）
		for i := 0; i < len(upstreamList); i++ {
			for j := i + 1; j < len(upstreamList); j++ {
				if len(upstreamList[i].PathPrefix) < len(upstreamList[j].PathPrefix) {
					upstreamList[i], upstreamList[j] = upstreamList[j], upstreamList[i]
				}
			}
		}
		c.upstreams[projectID] = upstreamList
	}

	return nil
}

// loadLogConfigs 加载日志配置
func (c *ConfigCache) loadLogConfigs() error {
	var configs []model.LogConfig
	if err := model.DB.Find(&configs).Error; err != nil {
		return err
	}

	for _, cfg := range configs {
		c.logConfigs[cfg.ProjectID] = &LogConfigCache{
			ProjectID:             cfg.ProjectID,
			EnableBody:            cfg.EnableBody == 1,
			BodyRecordThresholdMs: cfg.BodyRecordThresholdMs,
			MaxBodySize:           cfg.MaxBodySize,
			OnlyError:             cfg.OnlyError == 1,
		}
	}

	return nil
}

// GetApiKey 获取API Key配置（读锁）
func (c *ConfigCache) GetApiKey(appKey string) *ApiKeyConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.apiKeys[appKey]
}

// GetRateLimiter 获取限流器（读锁）
func (c *ConfigCache) GetRateLimiter(groupID int64) ratelimit.RateLimiter {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.rateLimiters[groupID]
}

// GetUpstream 根据请求路径获取匹配的上游配置（读锁）
// 按 path_prefix 长度降序匹配，返回第一个匹配的上游
func (c *ConfigCache) GetUpstream(projectID int64, requestPath string) *UpstreamConfig {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	upstreamList := c.upstreams[projectID]
	if len(upstreamList) == 0 {
		return nil
	}
	
	// 按 path_prefix 长度降序匹配（已排序）
	for _, upstream := range upstreamList {
		// 空前缀匹配所有路径（兜底）
		if upstream.PathPrefix == "" {
			return upstream
		}
		// 检查路径是否以 path_prefix 开头
		if len(requestPath) >= len(upstream.PathPrefix) && 
			requestPath[:len(upstream.PathPrefix)] == upstream.PathPrefix {
			return upstream
		}
	}
	
	return nil
}

// GetLogConfig 获取日志配置（读锁）
func (c *ConfigCache) GetLogConfig(projectID int64) *LogConfigCache {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.logConfigs[projectID]
}

// StartReloader 启动定时热更新（每5秒）
func (c *ConfigCache) StartReloader(interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			if err := c.Load(); err != nil {
				log.Printf("Failed to reload config: %v", err)
			} else {
				log.Println("Config reloaded successfully")
			}
		}
	}()
	log.Printf("Config reloader started (interval: %v)", interval)
}

// loadCircuitBreakerConfigs 加载熔断器配置并创建熔断器
func (c *ConfigCache) loadCircuitBreakerConfigs() error {
	var configs []model.CircuitBreakerConfig
	if err := model.DB.Find(&configs).Error; err != nil {
		return err
	}

	// 记录新配置的 GroupID
	newGroupIDs := make(map[int64]bool)

	for _, cfg := range configs {
		newGroupIDs[cfg.GroupID] = true
		
		// 检查是否已存在熔断器
		existingCB := c.circuitBreakers[cfg.GroupID]
		existingConfig := c.circuitBreakerConfigs[cfg.GroupID]
		
		// 判断配置是否变化
		configChanged := existingConfig == nil ||
			existingConfig.MaxFailures != cfg.MaxFailures ||
			existingConfig.ResetTimeout != cfg.ResetTimeout ||
			existingConfig.HalfOpenMaxTest != cfg.HalfOpenMaxTest
		
		// 只有配置变化时才重新创建熔断器
		if configChanged {
			c.circuitBreakerConfigs[cfg.GroupID] = &cfg
			halfOpenMaxTest := cfg.HalfOpenMaxTest
			if halfOpenMaxTest < 1 {
				halfOpenMaxTest = 1
			}
			c.circuitBreakers[cfg.GroupID] = breaker.NewCircuitBreakerWithConfig(
				cfg.MaxFailures,
				time.Duration(cfg.ResetTimeout)*time.Second,
				halfOpenMaxTest,
			)
			log.Printf("Group %d: Circuit breaker updated (MaxFailures=%d, ResetTimeout=%ds, HalfOpenMaxTest=%d)",
				cfg.GroupID, cfg.MaxFailures, cfg.ResetTimeout, halfOpenMaxTest)
		} else if existingCB != nil {
			// 配置未变化，保留现有熔断器实例
			c.circuitBreakerConfigs[cfg.GroupID] = &cfg
		}
	}

	// 删除不再存在的熔断器
	for groupID := range c.circuitBreakers {
		if !newGroupIDs[groupID] {
			delete(c.circuitBreakers, groupID)
			delete(c.circuitBreakerConfigs, groupID)
			log.Printf("Group %d: Circuit breaker removed", groupID)
		}
	}

	return nil
}

// GetCircuitBreaker 获取熔断器（读锁）
func (c *ConfigCache) GetCircuitBreaker(groupID int64) *breaker.CircuitBreaker {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.circuitBreakers[groupID]
}
