package main

import (
	"fmt"
	"log"

	"gorm.io/gorm"
	sqlite "github.com/glebarez/sqlite"
)

type RateLimitConfig struct {
	ID                int64 `gorm:"primaryKey"`
	GroupID           int64
	QPS               int
	Burst             int
	EnableMultiWindow int
	RPM               int
	RPH               int
}

func main() {
	db, err := gorm.Open(sqlite.Open("./data/gateway.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	// 更新 group_id=1 的配置
	result := db.Table("rate_limit_config").
		Where("group_id = ?", 1).
		Updates(map[string]interface{}{
			"qps":   3,
			"burst": 3, // 设置为与 QPS 相同
		})

	if result.Error != nil {
		log.Fatal(result.Error)
	}

	fmt.Printf("✅ 已更新限流配置: QPS=3, Burst=3 (影响 %d 行)\n", result.RowsAffected)
	
	// 验证更新
	var config RateLimitConfig
	db.Table("rate_limit_config").Where("group_id = ?", 1).First(&config)
	fmt.Printf("当前配置: GroupID=%d, QPS=%d, Burst=%d\n", config.GroupID, config.QPS, config.Burst)
}
