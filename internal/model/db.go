package model

import (
	"fmt"
	"log"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	
	// 使用纯 Go 的 SQLite 驱动（无需 CGO）
	sqlite "github.com/glebarez/sqlite"
)

var DB *gorm.DB

// InitDB 初始化数据库
func InitDB(dbPath string) error {
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	// 自动迁移
	err = DB.AutoMigrate(
		&Project{},
		&Upstream{},
		&ApiKey{},
		&Group{},
		&RateLimitConfig{},
		&LogConfig{},
	)
	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Println("Database initialized successfully")
	
	return nil
}

// CloseDB 关闭数据库连接
func CloseDB() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
