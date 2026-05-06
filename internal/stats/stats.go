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
	
	// 每日统计相关
	lastDailyPersist time.Time // 上次每日持久化时间
	dailyMu          sync.Mutex
	
	// 当日统计（每天重置）
	todayStats       Stats
	todayProjectStats map[int64]*Stats
	todayGroupStats   map[int64]*Stats
	todayKeyStats     map[string]*Stats
	currentDate       string // 当前日期 YYYY-MM-DD
}

// NewStatsCollector 创建统计收集器
func NewStatsCollector(persistInterval time.Duration) *StatsCollector {
	now := time.Now()
	return &StatsCollector{
		currentStats: Stats{
			ActiveKeys: make(map[string]bool),
			LastUpdate: now,
		},
		projectStats:     make(map[int64]*Stats),
		groupStats:       make(map[int64]*Stats),
		keyStats:         make(map[string]*Stats),
		persistInterval:  persistInterval,
		stopChan:         make(chan struct{}),
		lastDailyPersist: now,
		
		// 初始化当日统计
		todayStats: Stats{
			ActiveKeys: make(map[string]bool),
			LastUpdate: now,
		},
		todayProjectStats: make(map[int64]*Stats),
		todayGroupStats:   make(map[int64]*Stats),
		todayKeyStats:     make(map[string]*Stats),
		currentDate:       now.Format("2006-01-02"),
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

	// 启动每日统计持久化
	sc.wg.Add(1)
	go sc.dailyPersistWorker()
}

// RecordRequest 记录请求统计
func (sc *StatsCollector) RecordRequest(projectID, groupID int64, appKey string) {
	sc.mu.Lock()
	defer sc.mu.Unlock()
	
	now := time.Now()
	today := now.Format("2006-01-02")
	
	// 检查是否跨天，如果跨天则重置当日统计
	if today != sc.currentDate {
		sc.resetTodayStats(today)
	}
	
	// 全局统计（累计）
	sc.currentStats.PV++
	sc.currentStats.ActiveKeys[appKey] = true
	sc.currentStats.ActiveKeyCount = len(sc.currentStats.ActiveKeys)
	sc.currentStats.LastUpdate = now
	
	// 当日全局统计
	sc.todayStats.PV++
	sc.todayStats.ActiveKeys[appKey] = true
	sc.todayStats.ActiveKeyCount = len(sc.todayStats.ActiveKeys)
	sc.todayStats.LastUpdate = now
	
	// 项目统计（累计）
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
	
	// 当日项目统计
	if _, exists := sc.todayProjectStats[projectID]; !exists {
		sc.todayProjectStats[projectID] = &Stats{
			ActiveKeys: make(map[string]bool),
			LastUpdate: now,
		}
	}
	sc.todayProjectStats[projectID].PV++
	sc.todayProjectStats[projectID].ActiveKeys[appKey] = true
	sc.todayProjectStats[projectID].ActiveKeyCount = len(sc.todayProjectStats[projectID].ActiveKeys)
	sc.todayProjectStats[projectID].LastUpdate = now
	
	// 分组统计（累计）
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
	
	// 当日分组统计
	if _, exists := sc.todayGroupStats[groupID]; !exists {
		sc.todayGroupStats[groupID] = &Stats{
			ActiveKeys: make(map[string]bool),
			LastUpdate: now,
		}
	}
	sc.todayGroupStats[groupID].PV++
	sc.todayGroupStats[groupID].ActiveKeys[appKey] = true
	sc.todayGroupStats[groupID].ActiveKeyCount = len(sc.todayGroupStats[groupID].ActiveKeys)
	sc.todayGroupStats[groupID].LastUpdate = now
	
	// API Key 统计（累计）
	if _, exists := sc.keyStats[appKey]; !exists {
		sc.keyStats[appKey] = &Stats{
			ActiveKeys: make(map[string]bool),
			LastUpdate: now,
		}
	}
	sc.keyStats[appKey].PV++
	sc.keyStats[appKey].LastUpdate = now
	
	// 当日 API Key 统计
	if _, exists := sc.todayKeyStats[appKey]; !exists {
		sc.todayKeyStats[appKey] = &Stats{
			ActiveKeys: make(map[string]bool),
			LastUpdate: now,
		}
	}
	sc.todayKeyStats[appKey].PV++
	sc.todayKeyStats[appKey].LastUpdate = now
}

// resetTodayStats 重置当日统计（跨天时调用）
func (sc *StatsCollector) resetTodayStats(newDate string) {
	log.Printf("Resetting today stats from %s to %s", sc.currentDate, newDate)
	
	sc.todayStats = Stats{
		ActiveKeys: make(map[string]bool),
		LastUpdate: time.Now(),
	}
	sc.todayProjectStats = make(map[int64]*Stats)
	sc.todayGroupStats = make(map[int64]*Stats)
	sc.todayKeyStats = make(map[string]*Stats)
	sc.currentDate = newDate
}

// GetGlobalStats 获取全局统计（累计）
func (sc *StatsCollector) GetGlobalStats() Stats {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	return Stats{
		PV:             sc.currentStats.PV,
		ActiveKeyCount: sc.currentStats.ActiveKeyCount,
		LastUpdate:     sc.currentStats.LastUpdate,
	}
}

// GetTodayGlobalStats 获取全局今日统计
func (sc *StatsCollector) GetTodayGlobalStats() Stats {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	return Stats{
		PV:             sc.todayStats.PV,
		ActiveKeyCount: sc.todayStats.ActiveKeyCount,
		LastUpdate:     sc.todayStats.LastUpdate,
	}
}

// GetProjectStats 获取项目统计（累计）
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

// GetTodayProjectStats 获取项目今日统计
func (sc *StatsCollector) GetTodayProjectStats(projectID int64) *Stats {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	if stats, exists := sc.todayProjectStats[projectID]; exists {
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
	
	// 加载今日统计
	today := time.Now().Format("2006-01-02")
	
	// 加载今日全局统计
	if dailyStats, err := model.GetDailyStats(today, "global", 0, ""); err == nil && dailyStats != nil {
		sc.todayStats.PV = dailyStats.PV
		sc.todayStats.ActiveKeyCount = dailyStats.ActiveKeyCount
		log.Printf("Loaded today's global stats from DB: pv=%d, active_keys=%d", 
			dailyStats.PV, dailyStats.ActiveKeyCount)
	}
	
	// 加载今日项目统计
	if dailyRecords, err := model.GetAllDailyStatsByDate(today, "project"); err == nil {
		for _, record := range dailyRecords {
			sc.todayProjectStats[record.RefID] = &Stats{
				PV:             record.PV,
				ActiveKeys:     make(map[string]bool),
				ActiveKeyCount: record.ActiveKeyCount,
				LastUpdate:     time.Now(),
			}
		}
		log.Printf("Loaded %d today's project stats from DB", len(dailyRecords))
	}
	
	// 加载今日分组统计
	if dailyRecords, err := model.GetAllDailyStatsByDate(today, "group"); err == nil {
		for _, record := range dailyRecords {
			sc.todayGroupStats[record.RefID] = &Stats{
				PV:             record.PV,
				ActiveKeys:     make(map[string]bool),
				ActiveKeyCount: record.ActiveKeyCount,
				LastUpdate:     time.Now(),
			}
		}
		log.Printf("Loaded %d today's group stats from DB", len(dailyRecords))
	}
	
	// 加载今日 API Key 统计
	if dailyRecords, err := model.GetAllDailyStatsByDate(today, "key"); err == nil {
		for _, record := range dailyRecords {
			sc.todayKeyStats[record.RefKey] = &Stats{
				PV:         record.PV,
				ActiveKeys: make(map[string]bool),
				LastUpdate: time.Now(),
			}
		}
		log.Printf("Loaded %d today's key stats from DB", len(dailyRecords))
	}
}

// dailyPersistWorker 每日统计持久化工作协程
func (sc *StatsCollector) dailyPersistWorker() {
	defer sc.wg.Done()

	// 每10分钟检查一次是否需要持久化每日统计
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			sc.checkAndPersistDaily()
		case <-sc.stopChan:
			// 停止前最后一次持久化当天的数据
			sc.persistCurrentDayStats()
			return
		}
	}
}

// checkAndPersistDaily 检查并持久化每日统计
func (sc *StatsCollector) checkAndPersistDaily() {
	sc.dailyMu.Lock()
	defer sc.dailyMu.Unlock()

	now := time.Now()
	today := now.Format("2006-01-02")
	lastDate := sc.lastDailyPersist.Format("2006-01-02")

	// 如果日期变化了，说明跨天了
	if today != lastDate {
		log.Printf("Date changed from %s to %s, persisting daily stats...", lastDate, today)
		// 持久化昨天的最终数据
		sc.persistDailyStats(lastDate)
		sc.lastDailyPersist = now
	} else {
		// 同一天内，更新当天的统计（使用UPSERT）
		sc.persistCurrentDayStats()
	}
}

// persistCurrentDayStats 持久化当天的统计数据（实时更新）
func (sc *StatsCollector) persistCurrentDayStats() {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	today := time.Now().Format("2006-01-02")
	sc.persistDailyStatsForDate(today)
}

// persistDailyStats 持久化每日统计到数据库（用于历史日期）
func (sc *StatsCollector) persistDailyStats(statDate string) {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	
	sc.persistDailyStatsForDate(statDate)
}

// persistDailyStatsForDate 持久化指定日期的统计数据
func (sc *StatsCollector) persistDailyStatsForDate(statDate string) {
	now := time.Now()

	// 保存全局每日统计（使用当日统计）
	globalDaily := &model.DailyStats{
		StatDate:       statDate,
		Type:           "global",
		RefID:          0,
		RefKey:         "",
		PV:             sc.todayStats.PV,
		ActiveKeyCount: sc.todayStats.ActiveKeyCount,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := model.SaveOrUpdateDailyStats(globalDaily); err != nil {
		log.Printf("Failed to save global daily stats for %s: %v", statDate, err)
	}

	// 保存项目每日统计（使用当日统计）
	for projectID, stats := range sc.todayProjectStats {
		daily := &model.DailyStats{
			StatDate:       statDate,
			Type:           "project",
			RefID:          projectID,
			RefKey:         "",
			PV:             stats.PV,
			ActiveKeyCount: stats.ActiveKeyCount,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if err := model.SaveOrUpdateDailyStats(daily); err != nil {
			log.Printf("Failed to save project daily stats for %d on %s: %v", projectID, statDate, err)
		}
	}

	// 保存分组每日统计（使用当日统计）
	for groupID, stats := range sc.todayGroupStats {
		daily := &model.DailyStats{
			StatDate:       statDate,
			Type:           "group",
			RefID:          groupID,
			RefKey:         "",
			PV:             stats.PV,
			ActiveKeyCount: stats.ActiveKeyCount,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if err := model.SaveOrUpdateDailyStats(daily); err != nil {
			log.Printf("Failed to save group daily stats for %d on %s: %v", groupID, statDate, err)
		}
	}

	// 保存 API Key 每日统计（使用当日统计）
	for appKey, stats := range sc.todayKeyStats {
		daily := &model.DailyStats{
			StatDate:  statDate,
			Type:      "key",
			RefID:     0,
			RefKey:    appKey,
			PV:        stats.PV,
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := model.SaveOrUpdateDailyStats(daily); err != nil {
			log.Printf("Failed to save key daily stats for %s on %s: %v", appKey, statDate, err)
		}
	}

	log.Printf("Daily stats persisted for date %s: global_pv=%d, active_keys=%d",
		statDate, sc.todayStats.PV, sc.todayStats.ActiveKeyCount)
}

// Stop 停止统计收集器
func (sc *StatsCollector) Stop() {
	log.Println("Stopping stats collector...")
	close(sc.stopChan)
	sc.wg.Wait()
	log.Println("Stats collector stopped")
}
