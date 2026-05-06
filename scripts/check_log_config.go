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

	var configs []LogConfig
	if err := db.Find(&configs).Error; err != nil {
		log.Fatalf("Failed to query log configs: %v", err)
	}

	fmt.Println("Log Configs:")
	fmt.Println("============")
	if len(configs) == 0 {
		fmt.Println("No log configs found")
	} else {
		for _, cfg := range configs {
			fmt.Printf("Project ID: %d\n", cfg.ProjectID)
			fmt.Printf("  Enable Body: %d\n", cfg.EnableBody)
			fmt.Printf("  Body Threshold: %d ms\n", cfg.BodyRecordThresholdMs)
			fmt.Printf("  Max Body Size: %d bytes\n", cfg.MaxBodySize)
			fmt.Printf("  Only Error: %d\n", cfg.OnlyError)
			fmt.Println()
		}
	}
}
