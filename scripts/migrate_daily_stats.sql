-- 每日统计表迁移脚本
-- 用于记录每天的统计数据，每天每个维度只记录一条

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
