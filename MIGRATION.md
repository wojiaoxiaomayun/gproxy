# 数据库迁移说明

## API Key 添加 name 字段

### 变更内容

为 `api_key` 表添加 `name` 字段，用于标识 API Key 的用途或所属客户。

### 迁移 SQL

如果你已经有旧的数据库，需要执行以下 SQL 添加字段：

```sql
-- 添加 name 字段
ALTER TABLE api_key ADD COLUMN name TEXT;

-- 为现有数据添加默认名称（可选）
UPDATE api_key SET name = 'Legacy Key ' || id WHERE name IS NULL;
```

### 新表结构

```sql
CREATE TABLE api_key (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,                          -- 新增：API Key 名称
    app_key TEXT UNIQUE NOT NULL,
    app_secret TEXT,
    project_id INTEGER,
    group_id INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 使用示例

```sql
-- 创建新的 API Key（带名称）
INSERT INTO api_key (name, app_key, app_secret, project_id, group_id, status) 
VALUES 
    ('客户A-生产环境', 'customer-a-prod', 'secret-xxx', 1, 1, 'active'),
    ('客户B-测试环境', 'customer-b-test', 'secret-yyy', 1, 1, 'active'),
    ('内部监控系统', 'internal-monitor', 'secret-zzz', 1, 2, 'active');

-- 查询所有 API Key（包含名称）
SELECT id, name, app_key, status, created_at FROM api_key;
```

### 查询示例

```sql
-- 按名称搜索
SELECT * FROM api_key WHERE name LIKE '%客户A%';

-- 查看某个项目下的所有 Key
SELECT name, app_key, status 
FROM api_key 
WHERE project_id = 1 
ORDER BY created_at DESC;
```

### 注意事项

1. `name` 字段为可选（允许 NULL），不影响现有功能
2. 建议为所有新创建的 API Key 都设置有意义的名称
3. 名称可以包含中文，方便识别
4. 如果是全新安装，直接运行 `scripts/init.sql` 即可，已包含 name 字段

### 回滚

如果需要回滚此变更：

```sql
-- SQLite 不支持直接删除列，需要重建表
-- 1. 创建临时表（不含 name 字段）
CREATE TABLE api_key_backup (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_key TEXT UNIQUE NOT NULL,
    app_secret TEXT,
    project_id INTEGER,
    group_id INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 复制数据
INSERT INTO api_key_backup (id, app_key, app_secret, project_id, group_id, status, created_at)
SELECT id, app_key, app_secret, project_id, group_id, status, created_at FROM api_key;

-- 3. 删除原表
DROP TABLE api_key;

-- 4. 重命名
ALTER TABLE api_key_backup RENAME TO api_key;
```
