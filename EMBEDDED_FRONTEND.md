# 前端嵌入式部署说明

## ✅ 完成！前端已完全嵌入到可执行文件

### 🎯 实现方式

使用 Go 1.16+ 的 `embed` 功能，将 Next.js 构建的静态文件直接嵌入到 `gproxy.exe` 中。

### 📦 部署优势

1. **单文件部署**
   - 只需要一个 `gproxy.exe` 文件
   - 无需额外的 `web/out` 目录
   - 无需 Node.js 运行时

2. **简化运维**
   - 一个文件包含前后端
   - 无需管理静态文件目录
   - 更新只需替换一个文件

3. **更好的可移植性**
   - 可以直接复制到任何机器运行
   - 不依赖外部文件系统结构
   - 适合容器化部署

### 🔧 构建流程

```bash
# 1. 构建前端（生成静态文件到 web/out）
cd web
npm run build
cd ..

# 2. 构建 Go 程序（自动嵌入 web/out）
go build -o gproxy.exe

# 完成！gproxy.exe 包含了所有内容
```

### 📊 文件大小

- `gproxy.exe`: ~40MB（包含前端静态文件）
- 前端静态文件会被压缩嵌入
- 运行时直接从内存提供服务

### 🚀 使用方法

#### 开发模式
```bash
# 前端开发（支持热更新）
cd web && npm run dev

# 后端开发
go run main.go
```

#### 生产模式
```bash
# 一键构建和启动
.\scripts\build_and_run.ps1  # Windows
./scripts\build_and_run.sh   # Linux/Mac

# 或手动
cd web && npm run build && cd ..
go build -o gproxy.exe
.\gproxy.exe
```

### 🌐 访问地址

- 前端 UI: http://localhost:3000
- 后端 API: http://localhost:8080

### ⚙️ 配置

编辑 `config/config.yaml`:

```yaml
server:
  port: 8080      # 后端 API 端口
  web_port: 3000  # 前端静态文件端口
  mode: release
```

设置 `web_port: 0` 可以禁用前端服务器。

### 🔍 技术细节

#### Go embed 指令

```go
//go:embed web/out/*
var webFS embed.FS
```

这会在编译时将 `web/out` 目录下的所有文件嵌入到二进制文件中。

#### 文件服务

```go
// 获取嵌入的文件系统
webRoot, err := fs.Sub(webFS, "web/out")

// 读取文件
data, err := fs.ReadFile(webRoot, "index.html")

// 提供服务
c.Data(200, "text/html; charset=utf-8", data)
```

### 📝 注意事项

1. **构建顺序很重要**
   - 必须先构建前端（`npm run build`）
   - 然后构建 Go 程序（`go build`）
   - Go 编译时会嵌入当前的 `web/out` 内容

2. **更新前端**
   - 修改前端代码后，需要重新 `npm run build`
   - 然后重新 `go build` 才能生效

3. **Git 提交**
   - `web/out` 目录可以不提交到 Git
   - 每次构建时重新生成即可
   - 或者提交以便快速构建

4. **文件大小**
   - 嵌入会增加可执行文件大小
   - 前端静态文件约占 10-20MB
   - 可以通过优化前端构建减小体积

### 🎨 前端优化

Next.js 静态导出已经包含：
- 代码分割
- 资源压缩
- 长期缓存（文件哈希）
- Tree shaking

### 🐳 Docker 部署

```dockerfile
# 构建阶段
FROM node:20-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM golang:1.20-alpine AS go-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web-builder /app/web/out ./web/out
RUN go build -o gproxy

# 运行阶段
FROM alpine:latest
WORKDIR /app
RUN apk add --no-cache ca-certificates
COPY --from=go-builder /app/gproxy .
COPY config/ ./config/
RUN mkdir -p ./data ./logs

EXPOSE 8080 3000
CMD ["./gproxy"]
```

### 🔄 CI/CD 流程

```yaml
# GitHub Actions 示例
- name: Build Frontend
  run: |
    cd web
    npm install
    npm run build
    
- name: Build Backend
  run: go build -o gproxy

- name: Upload Artifact
  uses: actions/upload-artifact@v2
  with:
    name: gproxy
    path: gproxy
```

### 📚 相关文档

- [START.md](START.md) - 快速启动指南
- [DEPLOYMENT.md](DEPLOYMENT.md) - 详细部署文档
- [README.md](README.md) - 项目说明

### 🎉 总结

现在你只需要一个 `gproxy.exe` 文件就可以运行完整的前后端服务！

- ✅ 无需 Node.js
- ✅ 无需外部文件
- ✅ 一键部署
- ✅ 完全独立

这是真正的"单文件部署"！🚀
