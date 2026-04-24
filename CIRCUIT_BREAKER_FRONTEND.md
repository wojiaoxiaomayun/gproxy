# 熔断配置前端功能说明

## 功能概述

已在前端分组管理页面添加熔断配置功能，用户可以为每个分组独立配置熔断规则。

## 实现内容

### 1. API 接口 (web/lib/api.ts)

新增熔断配置相关接口：

```typescript
export interface CircuitBreakerConfig {
  id: number
  group_id: number
  max_failures: number  // 最大失败次数
  reset_timeout: number  // 重置超时时间(秒)
}

// API 方法
api.getCircuitBreakerConfigs()  // 获取所有熔断配置
api.getCircuitBreakerConfig(groupId)  // 获取指定分组的熔断配置
api.updateCircuitBreakerConfig(groupId, data)  // 更新熔断配置
api.deleteCircuitBreakerConfig(groupId)  // 删除熔断配置
```

### 2. 前端页面 (web/app/projects/[id]/page.tsx)

#### 新增状态管理

- `circuitBreakerDialogOpen`: 熔断配置对话框开关状态
- `selectedGroupForCircuitBreaker`: 当前选中要配置熔断的分组
- `circuitBreakerForm`: 熔断配置表单数据
  - `max_failures`: 最大失败次数（默认 5）
  - `reset_timeout`: 重置超时时间（默认 30 秒）

#### 新增功能函数

- `handleOpenCircuitBreakerDialog(group)`: 打开熔断配置对话框，加载现有配置
- `handleSaveCircuitBreaker(e)`: 保存熔断配置并触发后端重载

#### UI 更新

在分组管理卡片中添加了"配置熔断"按钮：

```tsx
<Button 
  variant="outline" 
  size="sm" 
  className="w-full gap-2"
  onClick={() => handleOpenCircuitBreakerDialog(group)}
>
  <Shield className="h-3 w-3" />
  配置熔断
</Button>
```

#### 熔断配置对话框

包含以下配置项：

1. **最大失败次数**
   - 输入框，最小值 1
   - 说明：连续失败达到此次数后触发熔断，停止转发请求

2. **重置超时时间（秒）**
   - 输入框，最小值 1
   - 说明：熔断后等待此时间后尝试恢复，如果请求成功则关闭熔断

## 使用流程

1. 进入项目详情页面
2. 切换到"分组管理"标签
3. 在目标分组卡片中点击"配置熔断"按钮
4. 在弹出的对话框中配置：
   - 最大失败次数（如：5 次）
   - 重置超时时间（如：30 秒）
5. 点击"保存配置"
6. 系统自动触发配置重载，熔断规则立即生效

## 配置示例

### 保守配置（适合稳定服务）
- 最大失败次数：10
- 重置超时时间：60 秒

### 标准配置（默认推荐）
- 最大失败次数：5
- 重置超时时间：30 秒

### 激进配置（适合快速失败场景）
- 最大失败次数：3
- 重置超时时间：10 秒

## 后端 API 端点

- `GET /__gproxy__/admin/circuit-breaker-configs` - 获取所有熔断配置
- `GET /__gproxy__/admin/circuit-breaker-config/:group_id` - 获取指定分组配置
- `PUT /__gproxy__/admin/circuit-breaker-config/:group_id` - 更新配置
- `DELETE /__gproxy__/admin/circuit-breaker-config/:group_id` - 删除配置

## 注意事项

1. 熔断配置是按分组级别的，每个分组可以有独立的熔断策略
2. 保存配置后会自动触发 `/__gproxy__/admin/reload` 重载配置
3. 如果分组没有配置熔断，对话框会显示默认值（5 次失败，30 秒超时）
4. 熔断状态会在后端实时监控，达到阈值后自动触发
5. 熔断恢复是自动的，超时后会尝试半开状态，成功则恢复

## 与限流配置的关系

- **限流**：控制请求频率，防止过载
- **熔断**：检测服务健康，快速失败保护

两者可以同时配置，互不冲突：
- 限流在请求进入前检查频率
- 熔断在请求失败后检查健康状态

## 测试建议

1. 创建测试分组
2. 配置较小的失败次数（如 3 次）
3. 故意让上游服务返回错误
4. 观察熔断是否触发
5. 等待超时时间后观察是否恢复
