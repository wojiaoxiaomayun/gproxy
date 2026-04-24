-- 初始化数据库脚本
-- 项目表
CREATE TABLE IF NOT EXISTS project (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 上游服务配置表
CREATE TABLE IF NOT EXISTS upstream (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    target_url TEXT NOT NULL,
    path_prefix TEXT,
    timeout INTEGER DEFAULT 3000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API Key表
CREATE TABLE IF NOT EXISTS api_key (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    app_key TEXT UNIQUE NOT NULL,
    project_id INTEGER,
    group_id INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 分组表
CREATE TABLE IF NOT EXISTS `group` (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    project_id INTEGER
);

-- 限流配置表
CREATE TABLE IF NOT EXISTS rate_limit_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER UNIQUE,
    qps INTEGER NOT NULL,
    burst INTEGER NOT NULL,
    enable_multi_window INTEGER DEFAULT 0,
    rpm INTEGER DEFAULT 0,
    rph INTEGER DEFAULT 0
);

-- 日志配置表
CREATE TABLE IF NOT EXISTS log_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER UNIQUE,
    enable_body INTEGER DEFAULT 0,
    body_record_threshold_ms INTEGER DEFAULT 500,
    max_body_size INTEGER DEFAULT 2048,
    only_error INTEGER DEFAULT 0
);
