# 配置文件说明

## 自动生成

程序首次运行时，如果 `config/config.yaml` 不存在，会自动生成默认配置文件。

## 配置项说明

### Server 配置
```yaml
server:
  port: 8080        # 服务监听端口
  mode: release     # 运行模式: debug 或 release
```

### Database 配置
```yaml
database:
  path: ./data/gateway.db  # SQLite 数据库文件路径
```

### Log 配置
```yaml
log:
  buffer_size: 1000                # 日志缓冲区大小
  worker_pool: 3                   # 日志处理工作协程数
  file_path: ./logs/gateway.log    # 日志文件路径
  max_size: 100                    # 单个日志文件最大大小(MB)
  max_backups: 10                  # 保留的旧日志文件数量
  max_age: 30                      # 保留旧日志文件的最大天数
  compress: true                   # 是否压缩旧日志文件
```

日志文件会自动按大小和时间轮转：
- 当日志文件达到 `max_size` 时自动切割
- 保留最近 `max_backups` 个备份文件
- 删除超过 `max_age` 天的旧日志
- 旧日志文件可选择 gzip 压缩以节省空间

日志格式为 JSON，每行一条记录，便于 Filebeat 等工具采集。

### Cache 配置
```yaml
cache:
  reload_interval: 5s  # 配置缓存重载间隔（支持 s/m/h 单位）
```

## 配置文件位置

- **实际配置**: `config/config.yaml` (自动生成，不提交到 Git)
- **配置模板**: `config/config.yaml.example` (提交到 Git，供参考)

## 修改配置

1. 直接编辑 `config/config.yaml`
2. 重启程序使配置生效

或者调用管理接口热更新（仅限数据库配置）：
```bash
curl -X POST http://localhost:8080/__gproxy__/admin/reload
```
