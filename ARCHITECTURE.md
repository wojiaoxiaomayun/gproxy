# API Gateway Audit System - 架构设计

## 一、系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Request                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (Gin)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. API Key 鉴权中间件                                │  │
│  │  2. 限流中间件 (rate.Limiter)                         │  │
│  │  3. 熔断中间件 (Circuit Breaker)                      │  │
│  │  4. 日志采集中间件                                     │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              ReverseProxy (httputil)                         │
│              转发到上游服务 (Elasticsearch/HTTP)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Upstream Service                          │
└─────────────────────────────────────────────────────────────┘

                       │
                       ▼ (异步)
┌─────────────────────────────────────────────────────────────┐
│              Log Channel (Buffer 1000)                       │
│              ┌──────────────────────────┐                   │
│              │  Goroutine Worker Pool   │                   │
│              │  批量写入 Elasticsearch   │                   │
│              └──────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    Config Storage                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SQLite (配置中心)                                     │  │
│  │  - project                                            │  │
│  │  - upstream                                           │  │
│  │  - api_key                                            │  │
│  │  - group                                              │  │
│  │  - rate_limit_config                                  │  │
│  │  - log_config                                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Memory Cache (sync.RWMutex)                          │  │
│  │  - map[appKey]*ApiKeyConfig                           │  │
│  │  - map[groupId]*RateLimiter                           │  │
│  │  - map[projectId]*LogConfig                           │  │
│  │  - 定时热更新 (5秒)                                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 二、核心设计原则

### 1. SQLite 使用原则
- ✅ **只做配置存储**：项目、API Key、限流策略、日志策略
- ❌ **不存日志**：避免高频写入导致锁表
- ✅ **启动时全量加载到内存**：避免每次请求查库
- ✅ **定时热更新**：每5秒重新加载配置

### 2. 性能优化
- **内存缓存**：所有配置加载到内存 map
- **异步日志**：channel + goroutine worker pool
- **批量写入**：日志批量写入 Elasticsearch
- **读写锁**：sync.RWMutex 保护缓存

### 3. 限流策略
- **按 API Key 限流**：每个 Key 独立限流器
- **按 Group 限流**：同组共享限流配置
- **使用 golang.org/x/time/rate**

### 4. 熔断机制
- **失败率阈值**：连续失败 N 次触发熔断
- **半开状态**：定时尝试恢复
- **隔离保护**：防止雪崩

## 三、请求处理流程

```
1. 请求到达
   ↓
2. API Key 鉴权
   - 从 Header 提取 Authorization: Bearer token
   - 内存查找 appKey 配置
   - 验证状态 (active/disabled)
   ↓
3. 限流检查
   - 根据 group_id 获取限流器
   - rate.Limiter.Allow()
   - 超限返回 429
   ↓
4. 熔断检查
   - 检查上游服务状态
   - 熔断中返回 503
   ↓
5. 反向代理
   - 根据 project_id 获取 upstream
   - httputil.ReverseProxy 转发
   - 记录响应时间
   ↓
6. 日志采集
   - 根据 log_config 决定是否记录
   - 提取 body (可选)
   - 发送到 log channel
   ↓
7. 异步写入 ES
   - Worker 从 channel 消费
   - 批量写入 Elasticsearch
```

## 四、数据流向

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ HTTP Request
     ▼
┌──────────────────┐
│  Auth Middleware │ ──→ Memory Cache (api_key)
└────┬─────────────┘
     │ Authenticated
     ▼
┌──────────────────┐
│ Rate Middleware  │ ──→ Memory Cache (rate_limiter)
└────┬─────────────┘
     │ Allowed
     ▼
┌──────────────────┐
│Circuit Breaker   │ ──→ In-Memory State
└────┬─────────────┘
     │ Open
     ▼
┌──────────────────┐
│ Reverse Proxy    │ ──→ Upstream Service
└────┬─────────────┘
     │ Response
     ▼
┌──────────────────┐
│  Log Middleware  │ ──→ Log Channel (async)
└────┬─────────────┘      │
     │                    ▼
     │              ┌──────────────┐
     │              │ Log Worker   │
     │              │ (goroutine)  │
     │              └──────┬───────┘
     │                     │
     ▼                     ▼
┌──────────┐      ┌────────────────┐
│  Client  │      │ Elasticsearch  │
└──────────┘      └────────────────┘
```

## 五、配置热更新机制

```go
// 启动时加载
func (c *ConfigCache) Load() {
    c.mu.Lock()
    defer c.mu.Unlock()
    
    // 从 SQLite 加载所有配置
    c.apiKeys = loadApiKeys()
    c.rateLimiters = buildRateLimiters()
    c.logConfigs = loadLogConfigs()
}

// 定时热更新
func (c *ConfigCache) StartReloader() {
    ticker := time.NewTicker(5 * time.Second)
    go func() {
        for range ticker.C {
            c.Load()
        }
    }()
}

// 读取配置 (高并发)
func (c *ConfigCache) GetApiKey(key string) *ApiKeyConfig {
    c.mu.RLock()
    defer c.mu.RUnlock()
    return c.apiKeys[key]
}
```

## 六、日志策略

### 日志字段
```json
{
  "timestamp": "2026-04-23T10:00:00Z",
  "project_id": 1,
  "app_key": "abc123",
  "group_id": 1,
  "method": "POST",
  "path": "/_search",
  "query": "size=10",
  "body_preview": "{\"query\":{...}}",
  "body_size": 1024,
  "body_hash": "sha256:...",
  "status": 200,
  "cost_ms": 23,
  "client_ip": "192.168.1.1",
  "error": ""
}
```

### 日志策略配置
- `enable_body`: 是否记录请求体
- `body_record_threshold_ms`: 超过此时间才记录 body
- `max_body_size`: 最大 body 大小
- `only_error`: 只记录错误请求

## 七、技术选型

| 组件 | 技术 | 说明 |
|------|------|------|
| Web 框架 | Gin | 高性能 HTTP 框架 |
| 数据库 | SQLite + GORM | 轻量级配置存储 |
| 反向代理 | httputil.ReverseProxy | 标准库 |
| 限流 | golang.org/x/time/rate | Token Bucket 算法 |
| 日志存储 | Elasticsearch | 预留接口 |
| 并发控制 | sync.RWMutex | 读写锁 |
| 异步处理 | channel + goroutine | 日志异步写入 |

## 八、扩展性设计

1. **多项目隔离**：通过 project_id 隔离
2. **动态配置**：支持热更新，无需重启
3. **水平扩展**：无状态设计，可多实例部署
4. **插件化**：中间件可插拔
5. **监控接口**：预留 metrics 端点
