# API Gateway Audit System - 使用指南

## 快速开始

### 1. 编译运行

```bash
# 编译
go build -o gproxy.exe

# 运行
./gproxy.exe
```

### 2. 初始化数据库

程序首次运行会自动创建数据库和表结构，并可以手动导入测试数据：

```bash
# 使用SQLite命令行工具导入测试数据
sqlite3 ./data/gateway.db < scripts/init.sql
```

### 3. 测试API

```bash
# 健康检查
curl http://localhost:8080/health

# 测试代理（需要配置上游服务）
curl -H "Authorization: Bearer test-key-001" http://localhost:8080/your-path
```

## 核心功能

### 1. API Key 鉴权

所有请求必须携带 `Authorization` Header：

```bash
curl -H "Authorization: Bearer test-key-001" http://localhost:8080/api/users
```

### 2. 限流

根据 API Key 所属的 Group 进行限流：

- default 组: 10 QPS, 20 burst
- premium 组: 100 QPS, 200 burst
- basic 组: 50 QPS, 100 burst

超过限流返回 429 状态码。

### 3. 熔断

当上游服务连续失败 5 次时，触发熔断，返回 503 状态码。
30 秒后自动尝试恢复（半开状态）。

### 4. 日志审计

日志配置支持：

- `enable_body`: 是否记录请求体
- `body_record_threshold_ms`: 超过此时间才记录 body
- `max_body_size`: 最大 body 大小
- `only_error`: 只记录错误请求

日志格式：

```json
{
  "timestamp": "2026-04-23T10:00:00Z",
  "project_id": 1,
  "app_key": "test-key-001",
  "group_id": 1,
  "method": "POST",
  "path": "/_search",
  "query": "size=10",
  "body_preview": "{\"query\":{...}}",
  "body_size": 1024,
  "body_hash": "sha256:...",
  "status": 200,
  "cost_ms": 23,
  "client_ip": "192.168.1.1"
}
```

### 5. 配置热更新

配置每 5 秒自动重载，也可以手动触发：

```bash
curl -X POST http://localhost:8080/admin/reload
```

## 数据库管理

### 添加项目

```sql
INSERT INTO project (name, description) VALUES ('My Project', 'Description');
```

### 添加上游配置

```sql
INSERT INTO upstream (project_id, target_url, path_prefix, timeout) 
VALUES (1, 'http://localhost:9200', '', 5000);
```

### 添加 API Key

```sql
INSERT INTO api_key (name, app_key, app_secret, project_id, group_id, status) 
VALUES ('客户A-生产环境', 'my-key-001', 'secret-001', 1, 1, 'active');
```

### 配置限流

```sql
INSERT INTO rate_limit_config (group_id, qps, burst) 
VALUES (1, 100, 200);
```

### 配置日志策略

```sql
INSERT INTO log_config (project_id, enable_body, body_record_threshold_ms, max_body_size, only_error) 
VALUES (1, 1, 500, 2048, 0);
```

## 项目结构

```
gproxy/
├── main.go                    # 主程序入口
├── config/
│   └── config.yaml           # 配置文件
├── internal/
│   ├── model/                # 数据模型
│   │   ├── model.go         # 表结构定义
│   │   └── db.go            # 数据库初始化
│   ├── cache/                # 配置缓存
│   │   └── cache.go         # 内存缓存和热更新
│   ├── middleware/           # 中间件
│   │   ├── auth.go          # API Key 鉴权
│   │   ├── ratelimit.go     # 限流
│   │   └── breaker.go       # 熔断
│   ├── proxy/                # 反向代理
│   │   └── proxy.go         # 代理核心逻辑
│   ├── logger/               # 日志系统
│   │   └── logger.go        # 异步日志收集
│   ├── ratelimit/            # 限流器
│   │   └── ratelimit.go     # Token Bucket 实现
│   └── breaker/              # 熔断器
│       └── breaker.go       # Circuit Breaker 实现
├── scripts/
│   └── init.sql             # 数据库初始化脚本
└── data/
    └── gateway.db           # SQLite 数据库文件
```

## 性能优化

### 1. 内存缓存

所有配置在启动时加载到内存，避免每次请求查询数据库。

### 2. 异步日志

日志通过 channel 异步写入，不阻塞主请求流程。

### 3. 批量写入

日志批量写入（100条或5秒），减少 I/O 操作。

### 4. 读写锁

使用 `sync.RWMutex` 保护缓存，支持高并发读取。

## 扩展性

### 1. 添加 Elasticsearch 支持

修改 `internal/logger/logger.go` 中的 `writeBatch` 方法：

```go
func (lc *LogCollector) writeBatch(batch []*LogEntry) {
    // 实现 Elasticsearch bulk API 调用
    // POST /_bulk
}
```

### 2. 添加监控指标

可以添加 Prometheus metrics：

```go
import "github.com/prometheus/client_golang/prometheus"

var (
    requestCounter = prometheus.NewCounterVec(...)
    requestDuration = prometheus.NewHistogramVec(...)
)
```

### 3. 添加更多中间件

在 `main.go` 中添加新的中间件：

```go
r.Any("/*path",
    middleware.AuthMiddleware(),
    middleware.RateLimitMiddleware(),
    middleware.CircuitBreakerMiddleware(),
    middleware.YourCustomMiddleware(),  // 新增
    proxyHandler.Handle,
)
```

## 故障排查

### 1. 数据库锁定

如果遇到 "database is locked" 错误：

- 检查是否有其他进程在访问数据库
- 减少配置重载频率
- 确保日志不写入 SQLite

### 2. 限流不生效

- 检查 `rate_limit_config` 表是否有对应 group_id 的配置
- 查看日志确认配置是否加载成功
- 手动触发配置重载

### 3. 熔断器误触发

- 调整 `maxFailures` 参数（默认5次）
- 调整 `resetTimeout` 参数（默认30秒）
- 检查上游服务健康状态

## 安全建议

1. **API Key 管理**：定期轮换 API Key
2. **访问控制**：限制 `/admin/*` 接口的访问
3. **HTTPS**：生产环境使用 HTTPS
4. **日志脱敏**：敏感信息不要记录到日志
5. **限流策略**：根据实际情况调整 QPS

## 生产部署

### 1. 使用 systemd

创建 `/etc/systemd/system/gproxy.service`：

```ini
[Unit]
Description=API Gateway Audit System
After=network.target

[Service]
Type=simple
User=gproxy
WorkingDirectory=/opt/gproxy
ExecStart=/opt/gproxy/gproxy
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

### 2. 使用 Docker

```dockerfile
FROM golang:1.20-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o gproxy

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/gproxy .
COPY --from=builder /app/config ./config
CMD ["./gproxy"]
```

### 3. 负载均衡

可以部署多个实例，使用 Nginx 做负载均衡：

```nginx
upstream gproxy {
    server 127.0.0.1:8080;
    server 127.0.0.1:8081;
    server 127.0.0.1:8082;
}

server {
    listen 80;
    location / {
        proxy_pass http://gproxy;
    }
}
```

## 许可证

MIT License
