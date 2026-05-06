# Next.js 静态导出说明

## 限制和解决方案

### 动态路由限制

Next.js 静态导出（`output: 'export'`）不支持动态路由（如 `/projects/[id]`），因为静态导出需要在构建时生成所有页面。

### 解决方案

我们采用了**查询参数**的方式来实现动态内容：

#### 之前（不支持）
```
/projects/1  ❌ 动态路由
/projects/2  ❌ 动态路由
```

#### 现在（支持）
```
/projects?id=1  ✅ 查询参数
/projects?id=2  ✅ 查询参数
```

### 实现方式

在 `web/app/projects/page.tsx` 中：

```typescript
// 使用 useSearchParams 获取查询参数
const searchParams = useSearchParams()
const projectId = searchParams.get('id')

// 根据是否有 id 参数决定显示列表还是详情
if (projectId) {
  return <ProjectDetailView projectId={parseInt(projectId)} />
}

// 显示项目列表
return <ProjectsList />
```

### 注意事项

1. **Suspense 边界**
   - `useSearchParams()` 必须包装在 `<Suspense>` 中
   - 这是 Next.js 的要求

2. **URL 格式**
   - 列表页: `/projects`
   - 详情页: `/projects?id=1`

3. **浏览器历史**
   - 使用 `router.push('/projects?id=1')` 导航
   - 使用 `router.push('/projects')` 返回列表

### 其他限制

#### 不支持的功能
- ❌ 服务端渲染 (SSR)
- ❌ API Routes
- ❌ 动态路由参数
- ❌ 增量静态再生成 (ISR)
- ❌ 图片优化（需要设置 `unoptimized: true`）

#### 支持的功能
- ✅ 客户端渲染 (CSR)
- ✅ 静态页面
- ✅ 查询参数
- ✅ 客户端路由
- ✅ React Hooks
- ✅ API 调用（通过 fetch）

### 完整的项目详情页

如果需要完整的项目详情页功能（API Keys、分组、上游配置等），有两个选择：

#### 选项 1：扩展当前实现
在 `ProjectDetailView` 组件中添加完整功能：
- API Keys 管理
- 分组管理
- 上游配置
- 限流配置
- 熔断器配置

#### 选项 2：使用服务端渲染
如果需要 SSR 功能，可以：
1. 移除 `output: 'export'` 配置
2. 使用 `next start` 运行（需要 Node.js）
3. 恢复动态路由 `/projects/[id]`

### 当前状态

- ✅ 项目列表页面完整
- ✅ 项目详情页面（简化版）
- ⚠️ 详情页面功能有限（仅显示基本信息）

### 推荐方案

对于生产环境，推荐：

1. **静态导出 + API 管理**
   - 前端使用静态导出（当前方案）
   - 复杂管理功能通过 API 直接操作
   - 适合：简单的管理界面

2. **完整 Next.js 应用**
   - 使用 SSR 模式
   - 需要 Node.js 运行时
   - 适合：复杂的管理界面

### 文件结构

```
web/app/
├── page.tsx              # 首页
├── projects/
│   └── page.tsx          # 项目列表 + 详情（查询参数）
├── api-keys/
│   └── page.tsx          # API Keys 管理
├── stats/
│   └── page.tsx          # 统计页面
└── logs/
    └── page.tsx          # 日志页面
```

### 构建命令

```bash
# 构建前端（静态导出）
cd web
npm run build  # 生成到 web/out

# 构建后端（嵌入前端）
go build -o gproxy.exe

# 运行
./gproxy.exe
```

### 访问方式

- 项目列表: http://localhost:3000/projects
- 项目详情: http://localhost:3000/projects?id=1
- API 管理: http://localhost:8080/__gproxy__/admin/

### 总结

当前实现：
- ✅ 单文件部署
- ✅ 无需 Node.js
- ✅ 基本功能完整
- ⚠️ 详情页功能简化

如需完整功能，可以：
1. 扩展 `ProjectDetailView` 组件
2. 或使用 API 直接管理
3. 或切换到 SSR 模式
