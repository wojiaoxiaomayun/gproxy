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

	var configs []RateLimitConfig
	if err := db.Table("rate_limit_config").Find(&configs).Error; err != nil {
		log.Fatal(err)
	}

	fmt.Println("当前限流配置:")
	fmt.Println("ID\tGroupID\tQPS\tBurst\tMultiWindow\tRPM\tRPH")
	for _, c := range configs {
		fmt.Printf("%d\t%d\t%d\t%d\t%d\t\t%d\t%d\n", 
			c.ID, c.GroupID, c.QPS, c.Burst, c.EnableMultiWindow, c.RPM, c.RPH)
	}
}
