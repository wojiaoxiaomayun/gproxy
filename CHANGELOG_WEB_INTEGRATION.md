# Web 前端集成更新日志

## 更新时间
2026-05-06

## 更新内容

### 🎯 目标
将 Next.js 前端集成到 Go 后端，实现单进程部署，无需 Node.js 运行时。

### ✅ 完成的工作

#### 1. Next.js 配置修改
- **文件**: `web/next.config.ts`
- **改动**: 
  - 启用静态导出 (`output: 'export'`)
  - 输出目录设置为 `out`
  - 禁用图片优化（静态导出要求）
  - 移除 rewrites 配置（不再需要）

#### 2. Go 配置结构更新
- **文件**: `internal/config/config.go`
- **改动**:
  - 添加 `WebPort` 字段到 Server 配置
  - 默认值: 3000
  - 支持通过配置文件自定义

#### 3. 主程序改造
- **文件**: `main.go`
- **改动**:
  - 新增 `startWebServer()` 函数
  - 创建独立的 Gin 实例服务前端静态文件
  - 支持 SPA 路由（所有非文件请求返回 index.html）
  - 自动检测 `web/out` 目录是否存在
  - 两个独立端口：8080（API）和 3000（前端）

#### 4. 配置文件更新
- **文件**: `config/config.yaml`
- **改动**:
  - 添加 `web_port: 3000` 配置项
  - 可设置为 0 禁用前端服务器

#### 5. 构建脚本
- **文件**: 
  - `scripts/build_and_run.ps1` (Windows)
  - `scripts/build_and_run.sh` (Linux/Mac)
- **功能**:
  - 自动构建前端（npm run build）
  - 自动构建后端（go build）
  - 一键启动

#### 6. 文档更新
- **新增**: `DEPLOYMENT.md` - 详细部署指南
- **新增**: `START.md` - 快速启动指南
- **更新**: `README.md` - 添加部署说明链接

### 📦 架构说明

```
┌─────────────────────────────────────┐
│         gproxy 可执行文件            │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐ │
│  │ Web Server  │  │  API Server  │ │
│  │  (Port 3000)│  │  (Port 8080) │ │
│  │             │  │              │ │
│  │ 静态文件服务 │  │  RESTful API │ │
│  │ web/out/*   │  │  /__gproxy__ │ │
│  └─────────────┘  └──────────────┘ │
└─────────────────────────────────────┘
```

### 🔑 关键特性

1. **单进程部署**
   - 一个可执行文件同时提供前后端服务
   - 无需额外的进程管理

2. **无需 Node.js**
   - 构建时需要 Node.js（npm run build）
   - 运行时完全不依赖 Node.js
   - 前端编译为纯静态文件

3. **独立端口**
   - 前端: 3000（可配置）
   - 后端: 8080（可配置）
   - 可通过 Nginx 统一端口

4. **灵活配置**
   - 可以禁用前端服务器（web_port: 0）
   - 可以自定义端口
   - 支持环境变量配置

### 📁 文件结构

```
gproxy/
├── gproxy.exe              # 可执行文件（包含所有逻辑）
├── web/
│   └── out/               # 前端静态文件（构建产物）
│       ├── _next/         # Next.js 资源
│       ├── index.html     # 首页
│       ├── *.html         # 其他页面
│       └── favicon.ico
├── config/
│   └── config.yaml        # 配置文件
├── data/
│   └── gateway.db         # 数据库
└── logs/
    └── gateway.log        # 日志
```

### 🚀 使用方法

#### 开发模式
```bash
# 终端 1 - 后端
go run main.go

# 终端 2 - 前端（支持热更新）
cd web && npm run dev
```

#### 生产模式
```bash
# 一键构建和启动
.\scripts\build_and_run.ps1  # Windows
./scripts/build_and_run.sh   # Linux/Mac

# 或手动
cd web && npm run build && cd ..
go build -o gproxy.exe
.\gproxy.exe
```

### 🔧 配置示例

**config/config.yaml**:
```yaml
server:
  port: 8080      # 后端 API 端口
  web_port: 3000  # 前端静态文件端口（设为 0 禁用）
  mode: release
```

**web/.env.production** (可选):
```env
NEXT_PUBLIC_API_URL=http://your-domain.com
```

### 📊 性能优势

1. **更快的响应速度**
   - 静态文件直接由 Go 提供
   - 无需 Node.js 运行时开销
   - 更低的内存占用

2. **更简单的部署**
   - 单个可执行文件
   - 无需安装 Node.js
   - 无需管理多个进程

3. **更好的可维护性**
   - 统一的日志管理
   - 统一的进程管理
   - 更简单的监控

### ⚠️ 注意事项

1. **构建时需要 Node.js**
   - 必须先运行 `npm run build` 生成静态文件
   - 构建后可以删除 Node.js

2. **静态导出限制**
   - 不支持 Next.js 的服务端渲染 (SSR)
   - 不支持 API Routes
   - 不支持动态路由参数（需要预渲染）

3. **API 调用**
   - 前端直接调用后端 8080 端口
   - 需要配置 CORS（已配置）
   - 可通过 Nginx 统一端口

### 🎉 优势总结

- ✅ 部署简单：一个文件搞定
- ✅ 无需 Node.js：降低运维成本
- ✅ 性能更好：静态文件 + Go 服务
- ✅ 易于维护：单进程管理
- ✅ 灵活配置：可独立调整端口
- ✅ 开发友好：支持热更新开发模式

### 📚 相关文档

- [START.md](START.md) - 快速启动指南
- [DEPLOYMENT.md](DEPLOYMENT.md) - 详细部署文档
- [README.md](README.md) - 项目说明
