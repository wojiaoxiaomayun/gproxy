# 部署指南

## 架构说明

本项目采用**前后端分离 + 单进程部署**的架构：

- **后端 API**：Go 服务器，默认端口 8080
- **前端 UI**：Next.js 静态导出，由 Go 提供服务，默认端口 3000
- **部署方式**：一个 `gproxy` 可执行文件同时提供前后端服务
- **无需 Node.js**：构建后不依赖 Node.js 运行时

## 开发环境

### 方式 1：分别启动（推荐用于开发）

**终端 1 - 启动后端：**
```bash
go run main.go
```

**终端 2 - 启动前端（开发模式）：**
```bash
cd web
npm run dev
```

访问：
- 后端 API: http://localhost:8080
- 前端界面: http://localhost:3000（开发服务器，支持热更新）

### 方式 2：一键启动（生产模式）

**Windows:**
```powershell
.\scripts\build_and_run.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/build_and_run.sh
./scripts/build_and_run.sh
```

这个脚本会：
1. 构建前端（`npm run build`，生成静态文件到 `web/out`）
2. 构建后端（`go build`）
3. 启动 `gproxy`，它会在两个端口上提供服务：
   - 8080: 后端 API
   - 3000: 前端静态文件

访问：
- 后端 API: http://localhost:8080
- 前端界面: http://localhost:3000

## 生产环境部署

### 准备工作

1. **安装 Node.js**（仅用于构建，运行时不需要）
   ```bash
   # 检查是否已安装
   node --version
   npm --version
   ```

2. **构建前端**
   ```bash
   cd web
   npm install
   npm run build  # 生成静态文件到 web/out
   cd ..
   ```

3. **构建后端**
   ```bash
   go build -o gproxy
   ```

### 部署方式

#### 方式 1：直接运行（推荐）

```bash
# 直接运行可执行文件
./gproxy
```

`gproxy` 会自动：
- 在 8080 端口启动后端 API 服务器
- 在 3000 端口启动前端静态文件服务器
- 两个服务运行在同一个进程中，无需 Node.js

#### 方式 2：使用 systemd（Linux）

创建服务文件 `/etc/systemd/system/gproxy.service`：

```ini
[Unit]
Description=API Gateway Proxy
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/gproxy
ExecStart=/path/to/gproxy/gproxy
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable gproxy
sudo systemctl start gproxy
sudo systemctl status gproxy
```

#### 方式 3：使用 Docker

创建 `Dockerfile`：

```dockerfile
# 构建阶段 - 前端
FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# 构建阶段 - 后端
FROM golang:1.20-alpine AS go-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o gproxy

# 运行阶段
FROM alpine:latest
WORKDIR /app
RUN apk add --no-cache ca-certificates

# 复制 Go 可执行文件
COPY --from=go-builder /app/gproxy .

# 复制前端构建产物
COPY --from=web-builder /app/web/out ./web/out

# 复制配置文件
COPY config/ ./config/

# 创建数据和日志目录
RUN mkdir -p ./data ./logs

EXPOSE 8080 3000

CMD ["./gproxy"]
```

构建和运行：
```bash
docker build -t gproxy .
docker run -d -p 8080:8080 -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  --name gproxy gproxy
```

### 使用 Nginx 反向代理（可选）

如果想统一端口访问，可以使用 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # 后端 API（前端会调用这个）
    location /__gproxy__/ {
        proxy_pass http://localhost:8080/__gproxy__/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

这样可以通过统一的域名访问：
- 前端: http://your-domain.com
- 后端 API: http://your-domain.com/__gproxy__/

## 配置说明

### 端口配置

编辑 `config/config.yaml`：

```yaml
server:
  port: 8080      # 后端 API 端口
  web_port: 3000  # 前端静态文件端口
  mode: release   # 生产环境使用 release 模式
```

如果不想启动前端服务器，设置 `web_port: 0`。

### 前端 API 地址配置

前端默认调用 `http://localhost:8080`。如果需要修改，创建 `web/.env.production`：

```env
# 生产环境 API 地址
NEXT_PUBLIC_API_URL=http://your-domain.com
```

然后重新构建前端：
```bash
cd web
npm run build
```

## 环境变量配置

### 后端配置

编辑 `config/config.yaml`：

```yaml
server:
  port: 8080
  web_port: 3000
  mode: release  # 生产环境使用 release 模式

database:
  path: ./data/gateway.db

log:
  file_path: ./logs/gateway.log
  max_size: 100
  max_backups: 10
  max_age: 30
  compress: true
```

## 监控和日志

### 查看日志

```bash
# 后端日志
tail -f logs/gateway.log

# 系统日志（如果使用 systemd）
journalctl -u gproxy -f
```

### 健康检查

```bash
# 后端健康检查
curl http://localhost:8080/__gproxy__/health

# 前端健康检查
curl http://localhost:3000
```

## 故障排查

### 前端无法启动

1. 检查是否已构建：
   ```bash
   ls -la web/out
   ```

2. 如果没有构建产物，运行：
   ```bash
   cd web
   npm install
   npm run build
   ```

3. 检查配置文件中的 `web_port` 是否正确

### 端口冲突

如果端口被占用，可以修改 `config/config.yaml`：

```yaml
server:
  port: 8081      # 改为其他端口
  web_port: 3001  # 改为其他端口
```

### 前端无法连接后端

1. 检查后端是否正常运行：
   ```bash
   curl http://localhost:8080/__gproxy__/health
   ```

2. 检查前端 API 配置（`web/lib/api.ts`）：
   ```typescript
   const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
   ```

3. 如果使用了 Nginx 或其他反向代理，确保配置正确

## 性能优化

### 1. 静态文件缓存

前端静态文件已经过优化，包含：
- 自动代码分割
- 资源压缩
- 长期缓存（通过文件哈希）

### 2. 使用 CDN（可选）

将 `web/out` 目录上传到 CDN，然后修改前端配置指向 CDN。

### 3. 数据库优化

对于高并发场景，考虑：
- 使用 PostgreSQL 替代 SQLite
- 启用数据库连接池
- 添加适当的索引

## 安全建议

1. **使用 HTTPS**：生产环境必须使用 HTTPS
2. **限制管理接口访问**：使用防火墙或 Nginx 限制 `/__gproxy__/admin` 的访问
3. **定期备份数据库**：
   ```bash
   cp data/gateway.db data/gateway.db.backup.$(date +%Y%m%d)
   ```
4. **日志轮转**：配置文件中已启用，确保磁盘空间充足

## 更新部署

```bash
# 1. 停止服务
sudo systemctl stop gproxy  # 或 Ctrl+C

# 2. 备份数据
cp data/gateway.db data/gateway.db.backup

# 3. 更新代码
git pull

# 4. 重新构建
cd web && npm install && npm run build && cd ..
go build -o gproxy

# 5. 启动服务
sudo systemctl start gproxy  # 或 ./gproxy
```

## 文件结构

部署后的文件结构：

```
gproxy/
├── gproxy              # 可执行文件（包含后端逻辑）
├── web/
│   └── out/           # 前端静态文件（由 npm run build 生成）
│       ├── _next/     # Next.js 资源
│       ├── *.html     # 页面文件
│       └── favicon.ico
├── config/
│   └── config.yaml    # 配置文件
├── data/
│   └── gateway.db     # 数据库
└── logs/
    └── gateway.log    # 日志文件
```

**重要**：部署时只需要：
- `gproxy` 可执行文件
- `web/out/` 目录（前端静态文件）
- `config/` 目录
- `data/` 和 `logs/` 目录会自动创建

**不需要**：
- Node.js 运行时
- `node_modules/` 目录
- Go 源代码（已编译）
