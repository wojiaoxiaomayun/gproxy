# API Gateway Audit System (gproxy)

一个轻量级、高性能的 API 网关审计系统，支持反向代理、API Key 鉴权、限流、熔断和日志审计。

## 特性

- ✅ **反向代理**：支持 Elasticsearch / 任意 HTTP 服务
- ✅ **API Key 鉴权**：基于 Header 的 API Key 认证
- ✅ **智能限流**：按 Key / 分组限流（Token Bucket 算法）
- ✅ **熔断保护**：自动熔断故障服务，防止雪崩
- ✅ **日志审计**：可配置的日志策略，支持 body 记录
- ✅ **统计分析**：实时统计和每日统计，支持多维度数据分析
- ✅ **多项目隔离**：支持多项目、多租户
- ✅ **配置热更新**：无需重启即可更新配置
- ✅ **内存缓存**：高性能配置缓存，避免频繁查库
- ✅ **异步日志**：channel + goroutine 异步处理，不阻塞请求
- ✅ **前端嵌入**：单文件部署，无需 Node.js ⭐ NEW

## 技术栈

- **Go 1.20+**
- **Gin** - Web 框架
- **GORM + SQLite** - 配置存储
- **httputil.ReverseProxy** - 反向代理
- **golang.org/x/time/rate** - 限流
- **Elasticsearch** - 日志存储（预留接口）

## 快速开始

### 1. 安装依赖

```bash
# Go 依赖
go mod download

# 前端依赖
cd web
npm install
cd ..
```

### 2. 初始化数据库

```bash
# 程序会自动创建数据库，也可以手动导入测试数据
sqlite3 ./data/gateway.db < scripts/init.sql
```

### 3. 运行

#### 开发模式（推荐）

**终端 1 - 启动后端：**
```bash
go run main.go
```

**终端 2 - 启动前端：**
```bash
cd web
npm run dev
```

访问：
- 后端 API: http://localhost:8080
- 前端管理界面: http://localhost:3000

#### 生产模式（一键启动）

```bash
# Windows
.\scripts\build_and_run.ps1

# Linux/Mac
chmod +x scripts/build_and_run.sh
./scripts/build_and_run.sh
```

这会自动构建并启动前后端服务。

### 4. 测试

```bash
# 健康检查
curl http://localhost:8080/__gproxy__/health

# 使用 PowerShell 测试脚本
.\scripts\test.ps1
```

## 架构设计

详见 [ARCHITECTURE.md](ARCHITECTURE.md)

```
Client Request
     ↓
API Key 鉴权
     ↓
限流检查
     ↓
熔断检查
     ↓
反向代理 → Upstream Service
     ↓
日志采集 → Async Channel → Elasticsearch
```

## 核心功能

### 1. API Key 鉴权

所有请求必须携带 `Authorization` Header：

```bash
curl -H "Authorization: Bearer test-key-001" http://localhost:8080/api/users
```

### 2. 限流策略

根据 API Key 所属的 Group 进行限流：

| Group | QPS | Burst |
|-------|-----|-------|
| default | 10 | 20 |
| premium | 100 | 200 |
| basic | 50 | 100 |

### 3. 熔断机制

- 连续失败 5 次触发熔断
- 熔断后返回 503
- 30 秒后自动尝试恢复

### 4. 统计分析 ⭐ NEW

#### 实时统计

实时统计数据存储在内存中，每30秒持久化：

```bash
# 全局统计
curl http://localhost:8080/__gproxy__/admin/stats/global

# 项目统计
curl http://localhost:8080/__gproxy__/admin/stats/project/1

# 分组统计
curl http://localhost:8080/__gproxy__/admin/stats/group/1

# API Key统计
curl http://localhost:8080/__gproxy__/admin/stats/key/test-key-001
```

#### 每日统计

每日统计记录每天的请求数据，每天每个维度只记录一条：

```bash
# 获取最近30天的全局统计
curl http://localhost:8080/__gproxy__/admin/stats/daily/global/latest?days=30

# 获取指定项目的每日统计
curl http://localhost:8080/__gproxy__/admin/stats/daily/project/1?days=30

# 获取指定分组的每日统计
curl http://localhost:8080/__gproxy__/admin/stats/daily/group/1?days=30

# 获取指定API Key的每日统计
curl http://localhost:8080/__gproxy__/admin/stats/daily/key/test-key-001?days=30

# 测试每日统计功能
powershell -File scripts/test_daily_stats.ps1
```

**特性**:
- 每天一条记录，数据量可控
- 当天数据每10分钟更新一次
- 自动跨天持久化
- 支持全局、项目、分组、API Key 四个维度

详见 [DAILY_STATS.md](DAILY_STATS.md) 和 [STATS_API.md](STATS_API.md)

### 5. 日志审计

支持灵活的日志策略：

- 是否记录请求体
- 超过指定时间才记录 body
- 最大 body 大小限制
- 只记录错误请求

日志格式：

```json
{
  "timestamp": "2026-04-23T10:00:00Z",
  "project_id": 1,
  "app_key": "test-key-001",
  "group_id": 1,
  "method": "POST",
  "path": "/_search",
  "status": 200,
  "cost_ms": 23,
  "client_ip": "192.168.1.1"
}
```

## 项目结构

```
gproxy/
├── main.go                    # 主程序入口
├── ARCHITECTURE.md            # 架构设计文档
├── USAGE.md                   # 使用指南
├── config/
│   └── config.yaml           # 配置文件
├── internal/
│   ├── model/                # 数据模型
│   ├── cache/                # 配置缓存
│   ├── middleware/           # 中间件（鉴权、限流、熔断）
│   ├── proxy/                # 反向代理
│   ├── logger/               # 日志系统
│   ├── ratelimit/            # 限流器
│   └── breaker/              # 熔断器
├── scripts/
│   ├── init.sql              # 数据库初始化
│   ├── test.sh               # 测试脚本（Bash）
│   └── test.ps1              # 测试脚本（PowerShell）
└── data/
    └── gateway.db            # SQLite 数据库
```

## 配置管理

### 添加项目

```sql
INSERT INTO project (name, description) VALUES ('My Project', 'Description');
```

### 添加上游服务

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

### 热更新配置

```bash
curl -X POST http://localhost:8080/admin/reload
```

## 性能优化

1. **内存缓存**：所有配置加载到内存，避免频繁查库
2. **异步日志**：日志异步写入，不阻塞请求
3. **批量写入**：日志批量写入（100条或5秒）
4. **读写锁**：使用 `sync.RWMutex` 支持高并发读取

## 扩展性

- ✅ 支持多项目隔离
- ✅ 支持动态配置热更新
- ✅ 无状态设计，可水平扩展
- ✅ 中间件可插拔
- ✅ 预留 Elasticsearch 接口

## 文档

- [快速启动](START.md) - 一键启动指南 ⭐
- [前端嵌入](EMBEDDED_FRONTEND.md) - 单文件部署说明 ⭐ NEW
- [部署指南](DEPLOYMENT.md) - 开发和生产环境部署说明
- [架构设计](ARCHITECTURE.md) - 系统架构和设计原则
- [使用指南](USAGE.md) - 详细使用说明和故障排查
- [统计API](STATS_API.md) - 实时统计API文档
- [每日统计](DAILY_STATS.md) - 每日统计功能说明
- [前端集成](FRONTEND_INTEGRATION.md) - 前端管理界面
- [熔断器](CIRCUIT_BREAKER_FRONTEND.md) - 熔断器功能说明
- [路由配置](ROUTING.md) - 路由配置说明

## 许可证

MIT License

