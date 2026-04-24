-- 为 circuit_breaker_config 表添加 half_open_max_test 字段
-- 用于配置半开状态下允许的最大测试请求数
-- 半开状态始终启用，熔断后会自动尝试恢复

-- 添加新字段
ALTER TABLE circuit_breaker_config 
ADD COLUMN half_open_max_test INTEGER DEFAULT 1;

-- 更新现有记录的默认值
UPDATE circuit_breaker_config 
SET half_open_max_test = 1 
WHERE half_open_max_test IS NULL;

-- 删除旧的 enable_half_open 字段（如果存在）
-- SQLite 不支持 DROP COLUMN，需要重建表
-- 如果你的数据库有这个字段，需要手动处理或重新初始化数据库

-- 添加注释
COMMENT ON COLUMN circuit_breaker_config.half_open_max_test IS '半开状态最大测试请求数';
