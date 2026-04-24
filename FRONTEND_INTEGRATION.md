# 前后端集成说明

## 项目结构

```
gproxy/
├── main.go                 # Go 后端入口
├── internal/               # 后端核心代码
├── config/                 # 后端配置
├── data/                   # SQLite 数据库
├── web/                    # Next.js 前端项目
│   ├── app/               # 页面路由
│   ├── components/        # React 组件
│   ├── lib/               # API 客户端
│   └── package.json
└── README.md
```

## 启动步骤

### 1. 启动后端服务

```bash
# 在项目根目录
$env:CGO_ENABLED="0"
go build -o gproxy.exe
./gproxy.exe
```

后端将运行在 `http://localhost:8080`

### 2. 启动前端服务

```bash
# 在 web 目录
cd web
npm install  # 首次运行需要安装依赖
npm run dev
```

前端将运行在 `http://localhost:3000`

## 访问地址

- **前端管理界面**: http://localhost:3000
- **后端 API**: http://localhost:8080
- **健康检查**: http://localhost:8080/health

## 前端功能

### 1. 仪表盘 (/)
- 系统状态监控
- 快速操作入口
- 功能导航

### 2. API Keys 管理 (/api-keys)
- 查看所有 API Keys
- 创建新的 API Key（带名称）
- 删除 API Key
- 查看 Key 状态和详情

### 3. 项目管理 (/projects)
- 查看所有项目
- 项目详情展示
- 上游服务配置

### 4. 日志查看 (/logs)
- 查看请求日志
- 按条件筛选
- 日志详情展示

## API 代理配置

前端通过 Next.js 的 `rewrites` 功能代理后端 API，避免 CORS 问题：

```typescript
// next.config.ts
async rewrites() {
  return [
    {
      source: '/api/gateway/:path*',
      destination: 'http://localhost:8080/:path*',
    },
  ]
}
```

## 后端需要实现的管理 API

目前前端已经准备好，但后端还需要实现以下管理 API：

### API Keys 管理
```
GET    /admin/api-keys          # 获取所有 API Keys
POST   /admin/api-keys          # 创建 API Key
PUT    /admin/api-keys/:id      # 更新 API Key
DELETE /admin/api-keys/:id      # 删除 API Key
```

### 项目管理
```
GET    /admin/projects          # 获取所有项目
POST   /admin/projects          # 创建项目
GET    /admin/projects/:id      # 获取项目详情
```

### 上游配置
```
GET    /admin/upstreams         # 获取上游配置
POST   /admin/upstreams         # 创建上游配置
```

### 分组管理
```
GET    /admin/groups            # 获取所有分组
```

### 限流配置
```
GET    /admin/rate-limits       # 获取限流配置
PUT    /admin/rate-limits/:id   # 更新限流配置
```

### 日志配置
```
GET    /admin/log-configs       # 获取日志配置
PUT    /admin/log-configs/:id   # 更新日志配置
```

## 实现管理 API 示例

在 Go 后端添加管理路由：

```go
// main.go
func main() {
    // ... 现有代码 ...

    // 管理 API 路由组
    admin := r.Group("/admin")
    {
        // API Keys
        admin.GET("/api-keys", handlers.GetApiKeys)
        admin.POST("/api-keys", handlers.CreateApiKey)
        admin.PUT("/api-keys/:id", handlers.UpdateApiKey)
        admin.DELETE("/api-keys/:id", handlers.DeleteApiKey)

        // Projects
        admin.GET("/projects", handlers.GetProjects)
        admin.POST("/projects", handlers.CreateProject)

        // ... 其他管理接口
    }

    // ... 现有代码 ...
}
```

## 数据交互流程

```
用户浏览器
    ↓
Next.js 前端 (localhost:3000)
    ↓
API 客户端 (lib/api.ts)
    ↓
Next.js Rewrites 代理
    ↓
Go 后端 API (localhost:8080)
    ↓
SQLite 数据库
```

## 开发建议

### 前端开发
1. 修改 `web/app/` 下的页面文件
2. 在 `web/lib/api.ts` 中添加新的 API 方法
3. 使用 Tailwind CSS 进行样式开发
4. 热重载自动生效

### 后端开发
1. 在 `internal/` 下添加新的处理器
2. 在 `main.go` 中注册路由
3. 修改后需要重新编译运行

## 生产部署

### 前端部署
```bash
cd web
npm run build
npm start  # 或使用 PM2/Docker
```

### 后端部署
```bash
$env:CGO_ENABLED="0"
go build -o gproxy.exe
./gproxy.exe
```

### 使用 Nginx 统一入口
```nginx
server {
    listen 80;
    server_name gateway.example.com;

    # 前端
    location / {
        proxy_pass http://localhost:3000;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://localhost:8080/;
    }

    location /admin/ {
        proxy_pass http://localhost:8080/admin/;
    }
}
```

## 注意事项

1. **CORS**: 开发环境使用 Next.js rewrites 避免 CORS，生产环境建议使用 Nginx 统一入口
2. **认证**: 管理 API 应该添加认证机制（JWT/Session）
3. **数据验证**: 前后端都应该进行数据验证
4. **错误处理**: 统一错误响应格式
5. **日志**: 前端操作应该记录审计日志

## 下一步

1. 实现后端管理 API
2. 添加用户认证系统
3. 完善错误处理
4. 添加单元测试
5. 优化性能和安全性
