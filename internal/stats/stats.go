package stats

import (
	"log"
	"sync"
	"time"

	"gproxy/internal/model"
)

// Stats 统计数据结构
type Stats struct {
	PV        int64              `json:"pv"`         // 总请求数
	ActiveKeys map[string]bool   `json:"-"`          // 活跃的 API Key 集合
	ActiveKeyCount int            `json:"active_keys"` // 活跃 Key 数量
	LastUpdate time.Time         `json:"last_update"` // 最后更新时间
}

// StatsCollector 统计收集器
type StatsCollector struct {
	mu           sync.RWMutex
	currentStats Stats
	
	// 分项目统计
	projectStats map[int64]*Stats
	
	// 分组统计
	groupStats   map[int64]*Stats
	
	// 分 API Key 统计
	keyStats     map[string]*Stats
	
	// 持久化配置
	persistInterval time.Duration
	stopChan        chan struct{}
	wg              sync.WaitGroup
}

// NewStatsCollector 创建统计收集器
func NewStatsCollector(persistInterval time.Duration) *StatsCollector {
	return &StatsCollector{
		currentStats: Stats{
			ActiveKeys: make(map[string]bool),
			LastUpdate: time.Now(),
		},
		projectStats:    make(map[int64]*Stats),
		groupStats:      make(map[int64]*Stats),
		keyStats:        make(map[string]*Stats),
		persistInterval: persistInterval,
		stopChan:        make(chan struct{}),
	}
}

// Start 启动统计收集器
func (sc *StatsCollector) Start() {
	log.Println("Starting stats collector...")
	
	// 从数据库加载历史统计
	sc.loadFromDB()
	
	// 启动定时持久化
	sc.wg.Add(1)
	go sc.persistWorker()
}

// Record 记录一次请求
func (sc *StatsCollector) Record(projectID int64, groupID int64, appKey string) {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	
	now := time.Now()
	
	// 全局统计
	sc.currentStats.PV++
	sc.currentStats.ActiveKeys[appKey] = true
	sc.currentStats.ActiveKeyCount = len(sc.currentStats.ActiveKeys)
	sc.currentStats.LastUpdate = now
	
	// 项目统计
	if _, exists := sc.projectStats[projectID]; !exists {
		sc.projectStats[projectID] = &Stats{
			ActiveKeys: make(map[string]bool),
			LastUpdate: now,
		}
	}
	sc.projectStats[projectID].PV++
	sc.projectStats[projectID].ActiveKeys[appKey] = true
	sc.projectStats[projectID].ActiveKeyCount = len(sc.projectStats[projectID].ActiveKeys)
	sc.projectStats[projectID].LastUpdate = now
	
	// 分组统计
	if _, exists := sc.groupStats[groupID]; !exists {
		sc.groupStats[groupID] = &Stats{
			ActiveKeys: make(map[string]bool),
			LastUpdate: now,
		}
	}
	sc.groupStats[groupID].PV++
	sc.groupStats[groupID].ActiveKeys[appKey] = true
	sc.groupStats[groupID].ActiveKeyCount = len(sc.groupStats[groupID].ActiveKeys)
	sc.groupStats[groupID].LastUpdate = now
	
	// API Key 统计
	if _, exists := sc.keyStats[appKey]; !exists {
		sc.keyStats[appKey] = &Stats{
			ActiveKeys: make(map[string]bool),
			LastUpdate: now,
		}
	}
	sc.keyStats[appKey].PV++
	sc.keyStats[appKey].LastUpdate = now
}

// GetGlobalStats 获取全局统计
func (sc *StatsCollector) GetGlobalStats() Stats {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	return Stats{
		PV:             sc.currentStats.PV,
		ActiveKeyCount: sc.currentStats.ActiveKeyCount,
		LastUpdate:     sc.currentStats.LastUpdate,
	}
}

// GetProjectStats 获取项目统计
func (sc *StatsCollector) GetProjectStats(projectID int64) *Stats {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	if stats, exists := sc.projectStats[projectID]; exists {
		return &Stats{
			PV:             stats.PV,
			ActiveKeyCount: stats.ActiveKeyCount,
			LastUpdate:     stats.LastUpdate,
		}
	}
	return nil
}

// GetGroupStats 获取分组统计
func (sc *StatsCollector) GetGroupStats(groupID int64) *Stats {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	if stats, exists := sc.groupStats[groupID]; exists {
		return &Stats{
			PV:             stats.PV,
			ActiveKeyCount: stats.ActiveKeyCount,
			LastUpdate:     stats.LastUpdate,
		}
	}
	return nil
}

// GetKeyStats 获取 API Key 统计
func (sc *StatsCollector) GetKeyStats(appKey string) *Stats {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	if stats, exists := sc.keyStats[appKey]; exists {
		return &Stats{
			PV:         stats.PV,
			LastUpdate: stats.LastUpdate,
		}
	}
	return nil
}

// GetAllProjectStats 获取所有项目统计
func (sc *StatsCollector) GetAllProjectStats() map[int64]*Stats {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	result := make(map[int64]*Stats)
	for projectID, stats := range sc.projectStats {
		result[projectID] = &Stats{
			PV:             stats.PV,
			ActiveKeyCount: stats.ActiveKeyCount,
			LastUpdate:     stats.LastUpdate,
		}
	}
	return result
}

// GetAllGroupStats 获取所有分组统计
func (sc *StatsCollector) GetAllGroupStats() map[int64]*Stats {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	result := make(map[int64]*Stats)
	for groupID, stats := range sc.groupStats {
		result[groupID] = &Stats{
			PV:             stats.PV,
			ActiveKeyCount: stats.ActiveKeyCount,
			LastUpdate:     stats.LastUpdate,
		}
	}
	return result
}

// GetAllKeyStats 获取所有 API Key 统计
func (sc *StatsCollector) GetAllKeyStats() map[string]*Stats {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	result := make(map[string]*Stats)
	for appKey, stats := range sc.keyStats {
		result[appKey] = &Stats{
			PV:         stats.PV,
			LastUpdate: stats.LastUpdate,
		}
	}
	return result
}

// persistWorker 定时持久化工作协程
func (sc *StatsCollector) persistWorker() {
	defer sc.wg.Done()
	
	ticker := time.NewTicker(sc.persistInterval)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			sc.persistToDB()
		case <-sc.stopChan:
			// 停止前最后一次持久化
			sc.persistToDB()
			return
		}
	}
}

// persistToDB 持久化到数据库
func (sc *StatsCollector) persistToDB() {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	now := time.Now()
	
	// 保存全局统计
	globalRecord := &model.StatsRecord{
		Type:           "global",
		RefID:          0,
		RefKey:         "",
		PV:             sc.currentStats.PV,
		ActiveKeyCount: sc.currentStats.ActiveKeyCount,
		RecordTime:     now,
	}
	if err := model.SaveStatsRecord(globalRecord); err != nil {
		log.Printf("Failed to save global stats: %v", err)
	}
	
	// 保存项目统计
	for projectID, stats := range sc.projectStats {
		record := &model.StatsRecord{
			Type:           "project",
			RefID:          projectID,
			RefKey:         "",
			PV:             stats.PV,
			ActiveKeyCount: stats.ActiveKeyCount,
			RecordTime:     now,
		}
		if err := model.SaveStatsRecord(record); err != nil {
			log.Printf("Failed to save project stats for %d: %v", projectID, err)
		}
	}
	
	// 保存分组统计
	for groupID, stats := range sc.groupStats {
		record := &model.StatsRecord{
			Type:           "group",
			RefID:          groupID,
			RefKey:         "",
			PV:             stats.PV,
			ActiveKeyCount: stats.ActiveKeyCount,
			RecordTime:     now,
		}
		if err := model.SaveStatsRecord(record); err != nil {
			log.Printf("Failed to save group stats for %d: %v", groupID, err)
		}
	}
	
	// 保存 API Key 统计
	for appKey, stats := range sc.keyStats {
		record := &model.StatsRecord{
			Type:       "key",
			RefID:      0,
			RefKey:     appKey,
			PV:         stats.PV,
			RecordTime: now,
		}
		if err := model.SaveStatsRecord(record); err != nil {
			log.Printf("Failed to save key stats for %s: %v", appKey, err)
		}
	}
	
	log.Printf("Stats persisted to DB: global_pv=%d, active_keys=%d", 
		sc.currentStats.PV, sc.currentStats.ActiveKeyCount)
}

// loadFromDB 从数据库加载历史统计
func (sc *StatsCollector) loadFromDB() {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	
	// 加载全局统计
	if record, err := model.GetLatestStatsRecord("global", 0, ""); err == nil && record != nil {
		sc.currentStats.PV = record.PV
		sc.currentStats.ActiveKeyCount = record.ActiveKeyCount
		log.Printf("Loaded global stats from DB: pv=%d, active_keys=%d", 
			record.PV, record.ActiveKeyCount)
	}
	
	// 加载项目统计
	if records, err := model.GetAllLatestStatsByType("project"); err == nil {
		for _, record := range records {
			sc.projectStats[record.RefID] = &Stats{
				PV:             record.PV,
				ActiveKeys:     make(map[string]bool),
				ActiveKeyCount: record.ActiveKeyCount,
				LastUpdate:     record.RecordTime,
			}
		}
		log.Printf("Loaded %d project stats from DB", len(records))
	}
	
	// 加载分组统计
	if records, err := model.GetAllLatestStatsByType("group"); err == nil {
		for _, record := range records {
			sc.groupStats[record.RefID] = &Stats{
				PV:             record.PV,
				ActiveKeys:     make(map[string]bool),
				ActiveKeyCount: record.ActiveKeyCount,
				LastUpdate:     record.RecordTime,
			}
		}
		log.Printf("Loaded %d group stats from DB", len(records))
	}
	
	// 加载 API Key 统计
	if records, err := model.GetAllLatestStatsByType("key"); err == nil {
		for _, record := range records {
			sc.keyStats[record.RefKey] = &Stats{
				PV:         record.PV,
				ActiveKeys: make(map[string]bool),
				LastUpdate: record.RecordTime,
			}
		}
		log.Printf("Loaded %d key stats from DB", len(records))
	}
}

// Stop 停止统计收集器
func (sc *StatsCollector) Stop() {
	log.Println("Stopping stats collector...")
	close(sc.stopChan)
	sc.wg.Wait()
	log.Println("Stats collector stopped")
}
