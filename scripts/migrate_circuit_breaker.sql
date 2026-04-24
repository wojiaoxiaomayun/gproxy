-- 添加熔断器配置表
CREATE TABLE IF NOT EXISTS circuit_breaker_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER UNIQUE,
    max_failures INTEGER DEFAULT 5,
    reset_timeout INTEGER DEFAULT 30
);

-- 插入默认配置示例
-- INSERT INTO circuit_breaker_config (group_id, max_failures, reset_timeout) VALUES (1, 5, 30);
-- INSERT INTO circuit_breaker_config (group_id, max_failures, reset_timeout) VALUES (2, 10, 60);
