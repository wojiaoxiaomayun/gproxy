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

-- 熔断器配置表
CREATE TABLE IF NOT EXISTS circuit_breaker_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER UNIQUE,
    max_failures INTEGER DEFAULT 5,
    reset_timeout INTEGER DEFAULT 30,
    half_open_max_test INTEGER DEFAULT 1
);

-- 每日统计表
CREATE TABLE IF NOT EXISTS daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stat_date DATE NOT NULL,                          -- 统计日期 (YYYY-MM-DD)
    type TEXT NOT NULL,                               -- 统计类型: global, project, group, key
    ref_id INTEGER DEFAULT 0,                         -- 关联ID（项目ID或分组ID）
    ref_key TEXT DEFAULT '',                          -- 关联Key（API Key）
    pv INTEGER NOT NULL DEFAULT 0,                    -- 当日请求总数
    active_key_count INTEGER DEFAULT 0,               -- 当日活跃Key数量
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,    -- 创建时间
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,    -- 更新时间
    
    -- 联合唯一索引：确保每天每个维度只有一条记录
    UNIQUE(stat_date, type, ref_id, ref_key)
);

-- 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_type ON daily_stats(type);
CREATE INDEX IF NOT EXISTS idx_daily_stats_ref_id ON daily_stats(ref_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_ref_key ON daily_stats(ref_key);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date_type ON daily_stats(stat_date, type);
