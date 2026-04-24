# 路由设计说明

## 路由冲突问题

### 问题描述
本项目使用 API Key 来区分不同的项目和上游服务，所有代理请求通过 `NoRoute` 兜底处理。这会导致以下冲突：

1. **管理路由冲突**：如果上游服务也有 `/admin` 路径，会被本地管理接口拦截
2. **健康检查冲突**：如果上游服务有 `/health` 路径，会被本地健康检查拦截

### 解决方案
使用特殊前缀 `/__gproxy__/` 来隔离管理接口和代理路径。

## 路由规则

### 1. 管理接口（不代理）
所有管理接口使用 `/__gproxy__/` 前缀：

- `/__gproxy__/health` - 健康检查
- `/__gproxy__/admin/reload` - 配置重载
- `/__gproxy__/admin/api-keys` - API Key 管理
- `/__gproxy__/admin/projects` - 项目管理
- `/__gproxy__/admin/upstreams` - 上游配置
- `/__gproxy__/admin/groups` - 分组管理
- `/__gproxy__/admin/rate-limits` - 限流配置
- `/__gproxy__/admin/log-configs` - 日志配置
- `/__gproxy__/admin/logs` - 日志查询

### 2. 代理路径（所有其他路径）
除了 `/__gproxy__/*` 之外的所有路径都会被代理到上游服务。

**一个项目支持多个上游配置**，通过 `path_prefix` 进行路由匹配：
- 按 `path_prefix` 长度降序匹配（最长匹配优先）
- 空 `path_prefix` 作为兜底路由（匹配所有路径）
- 同一项目的不同上游 `path_prefix` 不能相同

**路由匹配流程：**
```
请求 → 检查是否 /__gproxy__/* → 是：本地处理
                                 ↓
                                否：代理处理
                                 ↓
                          AuthMiddleware (通过 API Key 识别项目)
                                 ↓
                          按 path_prefix 匹配上游（最长匹配优先）
                                 ↓
                          RateLimitMiddleware
                                 ↓
                          CircuitBreakerMiddleware
                                 ↓
                          ProxyHandler (转发到上游)
```

## 示例

### 场景 1：一个项目多个上游（微服务架构）
```bash
# 项目配置
项目 A (key: key-a):
  - 上游 1: path_prefix="/api/user"   → https://user-service.com
  - 上游 2: path_prefix="/api/order"  → https://order-service.com
  - 上游 3: path_prefix="/api"        → https://api-gateway.com
  - 上游 4: path_prefix=""            → https://default-service.com (兜底)

# 请求匹配示例
curl -H "Authorization: Bearer key-a" http://localhost:8080/api/user/profile
# 匹配: 上游 1 (最长匹配)
# 代理到: https://user-service.com/profile (去除 /api/user 前缀)

curl -H "Authorization: Bearer key-a" http://localhost:8080/api/order/list
# 匹配: 上游 2
# 代理到: https://order-service.com/list

curl -H "Authorization: Bearer key-a" http://localhost:8080/api/product/list
# 匹配: 上游 3 (上游 1、2 不匹配，匹配到 /api)
# 代理到: https://api-gateway.com/product/list

curl -H "Authorization: Bearer key-a" http://localhost:8080/health
# 匹配: 上游 4 (兜底路由)
# 代理到: https://default-service.com/health
```

### 场景 2：不同项目的相同路径
```bash
# 项目 A (key: key-a) → https://api-a.com
curl -H "Authorization: Bearer key-a" http://localhost:8080/users
# 代理到: https://api-a.com/users

# 项目 B (key: key-b) → https://api-b.com
curl -H "Authorization: Bearer key-b" http://localhost:8080/users
# 代理到: https://api-b.com/users
```

### 场景 3：上游服务有 /admin 路径
```bash
# 本地管理接口
curl http://localhost:8080/__gproxy__/admin/projects
# 返回: 本地项目列表

# 代理到上游的 /admin
curl -H "Authorization: Bearer key-a" http://localhost:8080/admin/dashboard
# 代理到: https://api-a.com/admin/dashboard
```

### 场景 4：上游服务有 /health 路径
```bash
# 本地健康检查
curl http://localhost:8080/__gproxy__/health
# 返回: {"status":"ok","time":"..."}

# 代理到上游的 /health
curl -H "Authorization: Bearer key-a" http://localhost:8080/health
# 代理到: https://api-a.com/health
```

## 前端配置
前端所有管理 API 调用都已更新为使用 `/__gproxy__/` 前缀，无需额外配置。

## 注意事项
1. `/__gproxy__/` 是保留前缀，上游服务不应使用此前缀
2. 如果需要修改管理接口前缀，需要同时修改后端 `main.go` 和前端 `lib/api.ts`
3. 代理请求必须携带有效的 API Key（通过 `Authorization` header）
4. **同一项目的不同上游 `path_prefix` 不能相同**，否则会导致路由冲突
5. 建议为每个项目配置一个空 `path_prefix` 的兜底上游，避免路径不匹配时返回错误
6. 路径匹配采用**最长前缀匹配**原则，确保更具体的路由优先匹配
