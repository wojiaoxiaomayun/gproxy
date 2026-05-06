package config

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

// Config 全局配置结构
type Config struct {
	Server struct {
		Port    int    `yaml:"port"`
		Mode    string `yaml:"mode"`     // debug, release
		WebPort int    `yaml:"web_port"` // 前端静态文件服务端口
	} `yaml:"server"`

	Database struct {
		Path string `yaml:"path"`
	} `yaml:"database"`

	Log struct {
		BufferSize int    `yaml:"buffer_size"`
		WorkerPool int    `yaml:"worker_pool"`
		FilePath   string `yaml:"file_path"`   // 日志文件路径
		MaxSize    int    `yaml:"max_size"`    // 单个日志文件最大大小(MB)
		MaxBackups int    `yaml:"max_backups"` // 保留的旧日志文件数量
		MaxAge     int    `yaml:"max_age"`     // 保留旧日志文件的最大天数
		Compress   bool   `yaml:"compress"`    // 是否压缩旧日志文件
	} `yaml:"log"`

	Cache struct {
		ReloadInterval string `yaml:"reload_interval"`
	} `yaml:"cache"`
}

var globalConfig *Config

// GetConfig 获取全局配置
func GetConfig() *Config {
	if globalConfig == nil {
		log.Fatal("Config not initialized. Call LoadConfig() first.")
	}
	return globalConfig
}

// LoadConfig 加载配置文件，如果不存在则生成默认配置
func LoadConfig(configPath string) (*Config, error) {
	// 确保配置目录存在
	configDir := filepath.Dir(configPath)
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create config directory: %w", err)
	}

	// 检查配置文件是否存在
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		log.Printf("Config file not found at %s, generating default config...", configPath)
		if err := generateDefaultConfig(configPath); err != nil {
			return nil, fmt.Errorf("failed to generate default config: %w", err)
		}
		log.Printf("Default config generated at %s", configPath)
	}

	// 读取配置文件
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	// 解析配置
	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	// 设置全局配置
	globalConfig = &cfg

	log.Printf("Config loaded successfully from %s", configPath)
	return &cfg, nil
}

// generateDefaultConfig 生成默认配置文件
func generateDefaultConfig(configPath string) error {
	defaultConfig := Config{}

	// Server 配置
	defaultConfig.Server.Port = 8080
	defaultConfig.Server.Mode = "release"
	defaultConfig.Server.WebPort = 3000

	// Database 配置
	defaultConfig.Database.Path = "./data/gateway.db"

	// Log 配置
	defaultConfig.Log.BufferSize = 1000
	defaultConfig.Log.WorkerPool = 3
	defaultConfig.Log.FilePath = "./logs/gateway.log"
	defaultConfig.Log.MaxSize = 100    // 100MB
	defaultConfig.Log.MaxBackups = 10  // 保留10个备份
	defaultConfig.Log.MaxAge = 30      // 保留30天
	defaultConfig.Log.Compress = true  // 压缩旧日志

	// Cache 配置
	defaultConfig.Cache.ReloadInterval = "5s"

	// 序列化为 YAML
	data, err := yaml.Marshal(&defaultConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal default config: %w", err)
	}

	// 写入文件
	if err := os.WriteFile(configPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// GetReloadInterval 获取缓存重载间隔
func (c *Config) GetReloadInterval() time.Duration {
	duration, err := time.ParseDuration(c.Cache.ReloadInterval)
	if err != nil {
		log.Printf("Invalid reload_interval '%s', using default 5s", c.Cache.ReloadInterval)
		return 5 * time.Second
	}
	return duration
}
