package main

import (
	"fmt"
	"log"

	"gorm.io/gorm"
	sqlite "github.com/glebarez/sqlite"
)

type LogConfig struct {
	ID                      int64 `gorm:"primaryKey;autoIncrement"`
	ProjectID               int64 `gorm:"uniqueIndex"`
	EnableBody              int   `gorm:"default:0"`
	BodyRecordThresholdMs   int   `gorm:"default:500"`
	MaxBodySize             int   `gorm:"default:2048"`
	OnlyError               int   `gorm:"default:0"`
}

func (LogConfig) TableName() string {
	return "log_config"
}

func main() {
	db, err := gorm.Open(sqlite.Open("./data/gateway.db"), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect database: %v", err)
	}

	// 为项目1添加日志配置（记录所有请求）
	config := LogConfig{
		ProjectID:             1,
		EnableBody:            1,    // 启用body记录
		BodyRecordThresholdMs: 0,    // 所有请求都记录body（0表示无阈值）
		MaxBodySize:           2048, // 最大2KB
		OnlyError:             0,    // 记录所有请求（不只是错误）
	}

	if err := db.Create(&config).Error; err != nil {
		log.Fatalf("Failed to create log config: %v", err)
	}

	fmt.Println("Log config created successfully for project 1")
	fmt.Printf("  Enable Body: %d\n", config.EnableBody)
	fmt.Printf("  Body Threshold: %d ms\n", config.BodyRecordThresholdMs)
	fmt.Printf("  Max Body Size: %d bytes\n", config.MaxBodySize)
	fmt.Printf("  Only Error: %d (0=all, 1=only errors)\n", config.OnlyError)
}
