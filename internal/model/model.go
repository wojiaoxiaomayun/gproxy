package model

import (
	"fmt"
	"time"
)

// Project 项目表
type Project struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string    `gorm:"type:text;not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (Project) TableName() string {
	return "project"
}

// Upstream 上游服务配置
type Upstream struct {
	ID         int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID  int64     `gorm:"index:idx_project_path,priority:1" json:"project_id"`
	TargetURL  string    `gorm:"type:text;not null" json:"target_url"`
	PathPrefix string    `gorm:"type:text;index:idx_project_path,priority:2" json:"path_prefix"` // 联合唯一索引
	Timeout    int       `gorm:"default:3000" json:"timeout"` // 毫秒
	CreatedAt  time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (Upstream) TableName() string {
	return "upstream"
}

// ApiKey API密钥
type ApiKey struct {
	ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"type:text" json:"name"` // API Key 名称,用于标识
	AppKey    string    `gorm:"type:text;uniqueIndex;not null" json:"app_key"`
	ProjectID int64     `gorm:"index" json:"project_id"`
	GroupID   int64     `gorm:"index" json:"group_id"`
	Status    string    `gorm:"type:text;default:'active'" json:"status"` // active, disabled
	CreatedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
}

func (ApiKey) TableName() string {
	return "api_key"
}

// Group 分组
type Group struct {
	ID        int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string `gorm:"type:text" json:"name"`
	ProjectID int64  `gorm:"index" json:"project_id"`
}

func (Group) TableName() string {
	return "group"
}

// RateLimitConfig 限流配置
type RateLimitConfig struct {
	ID      int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	GroupID int64 `gorm:"uniqueIndex" json:"group_id"`
	QPS     int   `gorm:"not null" json:"qps"`   // 每秒请求数
	Burst   int   `gorm:"not null" json:"burst"` // 突发容量
	
	// 多窗口限流(可选)
	EnableMultiWindow int `gorm:"default:0" json:"enable_multi_window"` // 是否启用多窗口限流 0=否 1=是
	RPM               int `gorm:"default:0" json:"rpm"`                 // 每分钟请求数 (0=不限制)
	RPH               int `gorm:"default:0" json:"rph"`                 // 每小时请求数 (0=不限制)
}

func (RateLimitConfig) TableName() string {
	return "rate_limit_config"
}

// LogConfig 日志配置
type LogConfig struct {
	ID                      int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	ProjectID               int64 `gorm:"uniqueIndex" json:"project_id"`
	EnableBody              int   `gorm:"default:0" json:"enable_body"`                          // 是否记录body
	BodyRecordThresholdMs   int   `gorm:"default:500" json:"body_record_threshold_ms"`          // 超过此时间才记录body
	MaxBodySize             int   `gorm:"default:2048" json:"max_body_size"`                    // 最大body大小
	OnlyError               int   `gorm:"default:0" json:"only_error"`                          // 只记录错误
}

func (LogConfig) TableName() string {
	return "log_config"
}

// CircuitBreakerConfig 熔断器配置
type CircuitBreakerConfig struct {
	ID              int64 `gorm:"primaryKey;autoIncrement" json:"id"`
	GroupID         int64 `gorm:"uniqueIndex" json:"group_id"`
	MaxFailures     int   `gorm:"default:5" json:"max_failures"`       // 最大失败次数
	ResetTimeout    int   `gorm:"default:30" json:"reset_timeout"`     // 重置超时时间(秒)
	HalfOpenMaxTest int   `gorm:"default:1" json:"half_open_max_test"` // 半开状态最大测试请求数
}

func (CircuitBreakerConfig) TableName() string {
	return "circuit_breaker_config"
}

// API Keys 操作
func GetAllApiKeys() ([]ApiKey, error) {
	var keys []ApiKey
	err := DB.Find(&keys).Error
	return keys, err
}

func CreateApiKey(key *ApiKey) error {
	return DB.Create(key).Error
}

func UpdateApiKey(id string, key *ApiKey) error {
	return DB.Model(&ApiKey{}).Where("id = ?", id).Updates(key).Error
}

func DeleteApiKey(id string) error {
	return DB.Delete(&ApiKey{}, id).Error
}

// Projects 操作
func GetAllProjects() ([]Project, error) {
	var projects []Project
	err := DB.Find(&projects).Error
	return projects, err
}

func CreateProject(project *Project) error {
	return DB.Create(project).Error
}

func UpdateProject(id string, project *Project) error {
	return DB.Model(&Project{}).Where("id = ?", id).Updates(project).Error
}

func DeleteProject(id string) error {
	return DB.Delete(&Project{}, id).Error
}

// Upstreams 操作
func GetUpstreams(projectID string) ([]Upstream, error) {
	var upstreams []Upstream
	query := DB
	if projectID != "" {
		query = query.Where("project_id = ?", projectID)
	}
	err := query.Order("length(path_prefix) DESC").Find(&upstreams).Error
	return upstreams, err
}

func CreateUpstream(upstream *Upstream) error {
	// 检查是否已存在相同的 project_id + path_prefix
	var count int64
	DB.Model(&Upstream{}).Where("project_id = ? AND path_prefix = ?", upstream.ProjectID, upstream.PathPrefix).Count(&count)
	if count > 0 {
		return fmt.Errorf("upstream with same project_id and path_prefix already exists")
	}
	return DB.Create(upstream).Error
}

func UpdateUpstream(id string, upstream *Upstream) error {
	// 检查是否已存在相同的 project_id + path_prefix（排除自己）
	var count int64
	DB.Model(&Upstream{}).Where("project_id = ? AND path_prefix = ? AND id != ?", upstream.ProjectID, upstream.PathPrefix, id).Count(&count)
	if count > 0 {
		return fmt.Errorf("upstream with same project_id and path_prefix already exists")
	}
	return DB.Model(&Upstream{}).Where("id = ?", id).Updates(upstream).Error
}

func DeleteUpstream(id string) error {
	return DB.Delete(&Upstream{}, id).Error
}

// Groups 操作
func GetAllGroups() ([]Group, error) {
	var groups []Group
	err := DB.Find(&groups).Error
	return groups, err
}

func GetGroupsByProject(projectID string) ([]Group, error) {
	var groups []Group
	err := DB.Where("project_id = ?", projectID).Find(&groups).Error
	return groups, err
}

func CreateGroup(group *Group) error {
	return DB.Create(group).Error
}

func UpdateGroup(id string, group *Group) error {
	return DB.Model(&Group{}).Where("id = ?", id).Updates(group).Error
}

func DeleteGroup(id string) error {
	return DB.Delete(&Group{}, id).Error
}

// RateLimitConfig 操作
func GetAllRateLimitConfigs() ([]RateLimitConfig, error) {
	var configs []RateLimitConfig
	err := DB.Find(&configs).Error
	return configs, err
}

func GetRateLimitConfigByGroup(groupID int64) (*RateLimitConfig, error) {
	var config RateLimitConfig
	err := DB.Where("group_id = ?", groupID).First(&config).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func CreateRateLimitConfig(config *RateLimitConfig) error {
	return DB.Create(config).Error
}

func UpdateRateLimitConfig(groupID int64, config *RateLimitConfig) error {
	// 先查找是否存在
	var existing RateLimitConfig
	err := DB.Where("group_id = ?", groupID).First(&existing).Error
	if err != nil {
		// 不存在则创建
		config.GroupID = groupID
		return DB.Create(config).Error
	}
	// 存在则更新 - 使用 Select 明确指定所有字段,包括零值字段
	return DB.Model(&RateLimitConfig{}).Where("group_id = ?", groupID).
		Select("qps", "burst", "enable_multi_window", "rpm", "rph").
		Updates(config).Error
}

func DeleteRateLimitConfig(groupID int64) error {
	return DB.Where("group_id = ?", groupID).Delete(&RateLimitConfig{}).Error
}

// LogConfig 操作
func GetLogConfigByProject(projectID int64) (*LogConfig, error) {
	var config LogConfig
	err := DB.Where("project_id = ?", projectID).First(&config).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func UpdateLogConfig(projectID int64, config *LogConfig) error {
	// 先查找是否存在
	var existing LogConfig
	err := DB.Where("project_id = ?", projectID).First(&existing).Error
	if err != nil {
		// 不存在则创建
		config.ProjectID = projectID
		return DB.Create(config).Error
	}
	// 存在则更新
	return DB.Model(&LogConfig{}).Where("project_id = ?", projectID).Updates(config).Error
}

// CircuitBreakerConfig 操作
func GetAllCircuitBreakerConfigs() ([]CircuitBreakerConfig, error) {
	var configs []CircuitBreakerConfig
	err := DB.Find(&configs).Error
	return configs, err
}

func GetCircuitBreakerConfigByGroupID(groupID int64) (*CircuitBreakerConfig, error) {
	var config CircuitBreakerConfig
	err := DB.Where("group_id = ?", groupID).First(&config).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func CreateCircuitBreakerConfig(config *CircuitBreakerConfig) error {
	return DB.Create(config).Error
}

func UpdateCircuitBreakerConfig(groupID int64, config *CircuitBreakerConfig) error {
	// 先查找是否存在
	var existing CircuitBreakerConfig
	err := DB.Where("group_id = ?", groupID).First(&existing).Error
	if err != nil {
		// 不存在则创建
		config.GroupID = groupID
		return DB.Create(config).Error
	}
	// 存在则更新，使用 Select 明确指定要更新的字段（包括零值）
	return DB.Model(&CircuitBreakerConfig{}).Where("group_id = ?", groupID).
		Select("max_failures", "reset_timeout", "enable_half_open", "half_open_max_test").
		Updates(config).Error
}

func DeleteCircuitBreakerConfig(groupID int64) error {
	return DB.Where("group_id = ?", groupID).Delete(&CircuitBreakerConfig{}).Error
}

// StatsRecord 统计记录表
type StatsRecord struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	Type           string    `gorm:"type:text;not null;index" json:"type"` // global, project, group, key
	RefID          int64     `gorm:"index" json:"ref_id"`                  // 关联ID（项目ID或分组ID）
	RefKey         string    `gorm:"type:text;index" json:"ref_key"`       // 关联Key（API Key）
	PV             int64     `gorm:"not null" json:"pv"`                   // 请求总数
	ActiveKeyCount int       `gorm:"default:0" json:"active_key_count"`    // 活跃Key数量
	RecordTime     time.Time `gorm:"index" json:"record_time"`             // 记录时间
}

func (StatsRecord) TableName() string {
	return "stats_record"
}

// SaveStatsRecord 保存统计记录
func SaveStatsRecord(record *StatsRecord) error {
	return DB.Create(record).Error
}

// GetLatestStatsRecord 获取最新的统计记录
func GetLatestStatsRecord(statsType string, refID int64, refKey string) (*StatsRecord, error) {
	var record StatsRecord
	query := DB.Where("type = ?", statsType)
	
	if statsType == "project" || statsType == "group" {
		query = query.Where("ref_id = ?", refID)
	} else if statsType == "key" {
		query = query.Where("ref_key = ?", refKey)
	}
	
	err := query.Order("record_time DESC").First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

// GetStatsRecordsByTimeRange 获取时间范围内的统计记录
func GetStatsRecordsByTimeRange(statsType string, refID int64, refKey string, startTime, endTime time.Time) ([]StatsRecord, error) {
	var records []StatsRecord
	query := DB.Where("type = ? AND record_time BETWEEN ? AND ?", statsType, startTime, endTime)
	
	if statsType == "project" || statsType == "group" {
		query = query.Where("ref_id = ?", refID)
	} else if statsType == "key" {
		query = query.Where("ref_key = ?", refKey)
	}
	
	err := query.Order("record_time ASC").Find(&records).Error
	return records, err
}

// GetAllLatestStatsByType 获取某个类型的所有最新统计记录
func GetAllLatestStatsByType(statsType string) ([]StatsRecord, error) {
	var records []StatsRecord
	
	// 使用子查询获取每个 ref_id/ref_key 的最新记录
	if statsType == "project" || statsType == "group" {
		err := DB.Raw(`
			SELECT * FROM stats_record 
			WHERE type = ? AND id IN (
				SELECT MAX(id) FROM stats_record 
				WHERE type = ? 
				GROUP BY ref_id
			)
		`, statsType, statsType).Scan(&records).Error
		return records, err
	} else if statsType == "key" {
		err := DB.Raw(`
			SELECT * FROM stats_record 
			WHERE type = ? AND id IN (
				SELECT MAX(id) FROM stats_record 
				WHERE type = ? 
				GROUP BY ref_key
			)
		`, statsType, statsType).Scan(&records).Error
		return records, err
	}
	return records, nil
}

// DailyStats 每日统计表
type DailyStats struct {
	ID             int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	StatDate       string    `gorm:"type:date;not null;uniqueIndex:idx_daily_unique,priority:1" json:"stat_date"` // 统计日期 YYYY-MM-DD
	Type           string    `gorm:"type:text;not null;uniqueIndex:idx_daily_unique,priority:2;index" json:"type"` // global, project, group, key
	RefID          int64     `gorm:"uniqueIndex:idx_daily_unique,priority:3;index" json:"ref_id"`                  // 关联ID
	RefKey         string    `gorm:"type:text;uniqueIndex:idx_daily_unique,priority:4;index" json:"ref_key"`       // 关联Key
	PV             int64     `gorm:"not null;default:0" json:"pv"`                                                 // 当日请求总数
	ActiveKeyCount int       `gorm:"default:0" json:"active_key_count"`                                            // 当日活跃Key数量
	CreatedAt      time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"created_at"`
	UpdatedAt      time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"updated_at"`
}

func (DailyStats) TableName() string {
	return "daily_stats"
}

// SaveOrUpdateDailyStats 保存或更新每日统计（使用 UPSERT）
func SaveOrUpdateDailyStats(stats *DailyStats) error {
	// SQLite 使用 INSERT OR REPLACE
	return DB.Exec(`
		INSERT INTO daily_stats (stat_date, type, ref_id, ref_key, pv, active_key_count, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(stat_date, type, ref_id, ref_key) 
		DO UPDATE SET 
			pv = excluded.pv,
			active_key_count = excluded.active_key_count,
			updated_at = excluded.updated_at
	`, stats.StatDate, stats.Type, stats.RefID, stats.RefKey, stats.PV, stats.ActiveKeyCount, stats.CreatedAt, stats.UpdatedAt).Error
}

// GetDailyStats 获取指定日期的统计
func GetDailyStats(statDate string, statsType string, refID int64, refKey string) (*DailyStats, error) {
	var stats DailyStats
	query := DB.Where("stat_date = ? AND type = ?", statDate, statsType)
	
	if statsType == "project" || statsType == "group" {
		query = query.Where("ref_id = ?", refID)
	} else if statsType == "key" {
		query = query.Where("ref_key = ?", refKey)
	}
	
	err := query.First(&stats).Error
	if err != nil {
		return nil, err
	}
	return &stats, nil
}

// GetDailyStatsByDateRange 获取日期范围内的统计
func GetDailyStatsByDateRange(startDate, endDate string, statsType string, refID int64, refKey string) ([]DailyStats, error) {
	var stats []DailyStats
	query := DB.Where("stat_date BETWEEN ? AND ? AND type = ?", startDate, endDate, statsType)
	
	if statsType == "project" || statsType == "group" {
		query = query.Where("ref_id = ?", refID)
	} else if statsType == "key" {
		query = query.Where("ref_key = ?", refKey)
	}
	
	err := query.Order("stat_date ASC").Find(&stats).Error
	return stats, err
}

// GetAllDailyStatsByDate 获取指定日期所有类型的统计
func GetAllDailyStatsByDate(statDate string, statsType string) ([]DailyStats, error) {
	var stats []DailyStats
	err := DB.Where("stat_date = ? AND type = ?", statDate, statsType).Order("ref_id ASC, ref_key ASC").Find(&stats).Error
	return stats, err
}

// GetLatestDailyStats 获取最近N天的统计数据
func GetLatestDailyStats(days int, statsType string, refID int64, refKey string) ([]DailyStats, error) {
	var stats []DailyStats
	query := DB.Where("type = ?", statsType)

	if statsType == "project" || statsType == "group" {
		query = query.Where("ref_id = ?", refID)
	} else if statsType == "key" {
		query = query.Where("ref_key = ?", refKey)
	}

	err := query.Order("stat_date DESC").Limit(days).Find(&stats).Error
	return stats, err
}
