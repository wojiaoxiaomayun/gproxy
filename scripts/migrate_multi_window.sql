-- 数据库迁移脚本: 添加多窗口限流字段
-- 为 rate_limit_config 表添加新字段

-- 检查并添加 enable_multi_window 字段
ALTER TABLE rate_limit_config ADD COLUMN enable_multi_window INTEGER DEFAULT 0;

-- 检查并添加 rpm 字段
ALTER TABLE rate_limit_config ADD COLUMN rpm INTEGER DEFAULT 0;

-- 检查并添加 rph 字段
ALTER TABLE rate_limit_config ADD COLUMN rph INTEGER DEFAULT 0;
