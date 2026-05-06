# 快速启动指南

## 🚀 一键启动（推荐）

### Windows

```powershell
.\scripts\build_and_run.ps1
```

### Linux/Mac

```bash
chmod +x scripts/build_and_run.sh
./scripts/build_and_run.sh
```

这个脚本会自动：
1. ✅ 构建前端（`npm run build` → 生成静态文件）
2. ✅ 构建后端（`go build`）
3. ✅ 启动服务（单进程，双端口，无需 Node.js）

## 📍 访问地址

启动成功后，访问：

- **前端管理界面**: http://localhost:3000
- **后端 API**: http://localhost:8080
- **健康检查**: http://localhost:8080/__gproxy__/health

## ✨ 特性

- ✅ **单进程部署**：一个可执行文件同时提供前后端服务
- ✅ **无需 Node.js**：构建后不依赖 Node.js 运行时
- ✅ **独立端口**：前端 3000，后端 8080，可配置
- ✅ **静态文件**：前端编译为静态文件，性能更好

## 🛠️ 开发模式

如果你需要修改代码并实时预览，使用开发模式：

**终端 1 - 后端：**
```bash
go run main.go
```

**终端 2 - 前端（支持热更新）：**
```bash
cd web
npm run dev
```

## ⚠️ 首次运行

首次运行前，确保已安装依赖：

```bash
# 安装 Go 依赖
go mod download

# 安装前端依赖并构建
cd web
npm install
npm run build  # 生成静态文件到 web/out
cd ..
```

## 🔧 常见问题

### 1. 前端构建失败

```bash
cd web
npm install
npm run build
```

### 2. 端口被占用

修改 `config/config.yaml`：
```yaml
server:
  port: 8081      # 后端端口
  web_port: 3001  # 前端端口
```

### 3. 前端无法访问

检查是否已构建：
```bash
ls -la web/out
```

如果没有 `web/out` 目录，运行：
```bash
cd web && npm run build && cd ..
```

### 4. 数据库初始化

```bash
# 创建数据目录
mkdir -p data

# 导入测试数据（可选）
sqlite3 ./data/gateway.db < scripts/init.sql
```

## 📖 更多文档

- [部署指南](DEPLOYMENT.md) - 详细的部署说明
- [README](README.md) - 项目介绍和功能说明
- [架构设计](ARCHITECTURE.md) - 系统架构

## 🎯 下一步

1. 访问前端界面：http://localhost:3000
2. 配置项目和 API Key
3. 开始使用网关代理服务

## 💡 提示

- 构建后的 `gproxy.exe` 可以独立运行，只需要 `web/out` 目录
- 部署时不需要 Node.js，只需要 Go 编译后的可执行文件
- 可以通过配置文件调整端口，甚至禁用前端服务器（设置 `web_port: 0`）

祝使用愉快！🎉
