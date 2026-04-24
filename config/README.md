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
  buffer_size: 1000  # 日志缓冲区大小
  worker_pool: 3     # 日志处理工作协程数
```

### Cache 配置
```yaml
cache:
  reload_interval: 5s  # 配置缓存重载间隔（支持 s/m/h 单位）
```

### Elasticsearch 配置（预留）
```yaml
elasticsearch:
  enabled: false                    # 是否启用 ES 日志存储
  url: http://localhost:9200        # ES 服务地址
  index_prefix: gateway-logs        # 索引前缀
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
