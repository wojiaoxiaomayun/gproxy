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
