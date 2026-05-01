# 统计 API 文档

## 概述

统计系统按照以下流程工作：

```
请求进来
   ↓
Go 网关
   ↓
写日志文件 ✅
   ↓
内存统计（PV + activeKey）✅
   ↓
定时写入 SQLite（防丢）✅ (每30秒)

Web接口：
   ↓
直接读内存（毫秒级）✅
```

## 统计接口列表

所有统计接口都在 `/__gproxy__/admin/stats/` 路径下。

### 1. 全局统计

**接口**: `GET /__gproxy__/admin/stats/global`

**说明**: 获取全局统计数据（所有项目、所有分组、所有 API Key 的汇总）

**响应示例**:
```json
{
  "pv": 12345,
  "active_keys": 25,
  "last_update": "2026-05-01T10:30:45Z"
}
```

### 2. 所有项目统计

**接口**: `GET /__gproxy__/admin/stats/projects`

**说明**: 获取所有项目的统计数据

**响应示例**:
```json
{
  "1": {
    "pv": 5000,
    "active_keys": 10,
    "last_update": "2026-05-01T10:30:45Z"
  },
  "2": {
    "pv": 7345,
    "active_keys": 15,
    "last_update": "2026-05-01T10:30:45Z"
  }
}
```

### 3. 单个项目统计

**接口**: `GET /__gproxy__/admin/stats/project/:project_id`

**说明**: 获取指定项目的统计数据

**示例**: `GET /__gproxy__/admin/stats/project/1`

**响应示例**:
```json
{
  "pv": 5000,
  "active_keys": 10,
  "last_update": "2026-05-01T10:30:45Z"
}
```

### 4. 所有分组统计

**接口**: `GET /__gproxy__/admin/stats/groups`

**说明**: 获取所有分组的统计数据

**响应示例**:
```json
{
  "1": {
    "pv": 2000,
    "active_keys": 5,
    "last_update": "2026-05-01T10:30:45Z"
  },
  "2": {
    "pv": 3000,
    "active_keys": 5,
    "last_update": "2026-05-01T10:30:45Z"
  }
}
```

### 5. 单个分组统计

**接口**: `GET /__gproxy__/admin/stats/group/:group_id`

**说明**: 获取指定分组的统计数据

**示例**: `GET /__gproxy__/admin/stats/group/1`

**响应示例**:
```json
{
  "pv": 2000,
  "active_keys": 5,
  "last_update": "2026-05-01T10:30:45Z"
}
```

### 6. 所有 API Key 统计

**接口**: `GET /__gproxy__/admin/stats/keys`

**说明**: 获取所有 API Key 的统计数据

**响应示例**:
```json
{
  "test-key-001": {
    "pv": 1500,
    "last_update": "2026-05-01T10:30:45Z"
  },
  "test-key-002": {
    "pv": 500,
    "last_update": "2026-05-01T10:30:45Z"
  }
}
```

### 7. 单个 API Key 统计

**接口**: `GET /__gproxy__/admin/stats/key/:app_key`

**说明**: 获取指定 API Key 的统计数据

**示例**: `GET /__gproxy__/admin/stats/key/test-key-001`

**响应示例**:
```json
{
  "pv": 1500,
  "last_update": "2026-05-01T10:30:45Z"
}
```

## 字段说明

- `pv`: Page View，请求总数（累计）
- `active_keys`: 活跃的 API Key 数量（去重后的唯一 Key 数量）
- `last_update`: 最后更新时间（ISO 8601 格式）

## 性能特点

1. **毫秒级响应**: 所有统计数据都存储在内存中，查询速度极快
2. **实时更新**: 每次请求都会立即更新内存中的统计数据
3. **防丢失**: 每 30 秒自动持久化到 SQLite 数据库
4. **自动恢复**: 服务重启时自动从数据库加载历史统计数据

## 数据持久化

统计数据会定期（默认 30 秒）写入 SQLite 数据库的 `stats_record` 表中：

```sql
CREATE TABLE stats_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,           -- 'global', 'project', 'group', 'key'
    ref_id INTEGER,               -- 项目ID或分组ID
    ref_key TEXT,                 -- API Key
    pv INTEGER NOT NULL,          -- 请求总数
    active_key_count INTEGER,     -- 活跃Key数量
    record_time DATETIME          -- 记录时间
);
```

## 使用示例

### 前端看板集成

```javascript
// 获取全局统计
async function fetchGlobalStats() {
  const response = await fetch('http://localhost:8080/__gproxy__/admin/stats/global');
  const data = await response.json();
  
  console.log(`总请求数: ${data.pv}`);
  console.log(`活跃Key数: ${data.active_keys}`);
  console.log(`最后更新: ${data.last_update}`);
}

// 获取所有项目统计
async function fetchProjectStats() {
  const response = await fetch('http://localhost:8080/__gproxy__/admin/stats/projects');
  const data = await response.json();
  
  for (const [projectId, stats] of Object.entries(data)) {
    console.log(`项目 ${projectId}: PV=${stats.pv}, 活跃Key=${stats.active_keys}`);
  }
}

// 定时刷新（每5秒）
setInterval(fetchGlobalStats, 5000);
```

### PowerShell 测试

```powershell
# 获取全局统计
Invoke-RestMethod -Uri "http://localhost:8080/__gproxy__/admin/stats/global" | ConvertTo-Json

# 获取项目统计
Invoke-RestMethod -Uri "http://localhost:8080/__gproxy__/admin/stats/project/1" | ConvertTo-Json

# 获取所有 API Key 统计
Invoke-RestMethod -Uri "http://localhost:8080/__gproxy__/admin/stats/keys" | ConvertTo-Json
```

### cURL 测试

```bash
# 获取全局统计
curl http://localhost:8080/__gproxy__/admin/stats/global

# 获取项目统计
curl http://localhost:8080/__gproxy__/admin/stats/project/1

# 获取分组统计
curl http://localhost:8080/__gproxy__/admin/stats/group/1

# 获取 API Key 统计
curl http://localhost:8080/__gproxy__/admin/stats/key/test-key-001
```

## 注意事项

1. **内存占用**: 统计数据存储在内存中，如果 API Key 数量非常大（数万个），需要注意内存占用
2. **数据重置**: 如果需要重置统计数据，可以删除数据库中的 `stats_record` 表记录并重启服务
3. **时区**: 所有时间戳使用服务器本地时区
4. **并发安全**: 使用读写锁保证并发访问的安全性

## 前端看板建议

建议在前端看板中展示以下内容：

1. **总览卡片**:
   - 总请求数（PV）
   - 活跃 API Key 数量
   - 最后更新时间

2. **项目列表**:
   - 每个项目的 PV
   - 每个项目的活跃 Key 数量
   - 排序功能（按 PV 或活跃 Key 数量）

3. **分组列表**:
   - 每个分组的 PV
   - 每个分组的活跃 Key 数量

4. **API Key 排行榜**:
   - Top 10 最活跃的 API Key
   - 每个 Key 的请求数

5. **实时刷新**:
   - 建议每 5-10 秒刷新一次
   - 使用 WebSocket 或轮询方式
