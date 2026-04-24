package logger

import (
	"encoding/json"
	"log"
	"sync"
	"time"
)

// LogEntry 日志条目
type LogEntry struct {
	Timestamp   string `json:"timestamp"`
	ProjectID   int64  `json:"project_id"`
	AppKey      string `json:"app_key"`
	GroupID     int64  `json:"group_id"`
	Method      string `json:"method"`
	Path        string `json:"path"`
	Query       string `json:"query"`
	BodyPreview string `json:"body_preview,omitempty"`
	BodySize    int    `json:"body_size,omitempty"`
	BodyHash    string `json:"body_hash,omitempty"`
	Status      int    `json:"status"`
	CostMs      int64  `json:"cost_ms"`
	ClientIP    string `json:"client_ip"`
	Error       string `json:"error,omitempty"`
}

// LogCollector 日志收集器
type LogCollector struct {
	logChan    chan *LogEntry
	workerPool int
	wg         sync.WaitGroup
	stopChan   chan struct{}
	recentLogs []*LogEntry
	logsMutex  sync.RWMutex
	maxRecent  int
}

// NewLogCollector 创建日志收集器
func NewLogCollector(bufferSize int, workerPool int) *LogCollector {
	return &LogCollector{
		logChan:    make(chan *LogEntry, bufferSize),
		workerPool: workerPool,
		stopChan:   make(chan struct{}),
		recentLogs: make([]*LogEntry, 0, 1000),
		maxRecent:  1000,
	}
}

// Start 启动日志收集器
func (lc *LogCollector) Start() {
	log.Printf("Starting log collector with %d workers", lc.workerPool)
	
	for i := 0; i < lc.workerPool; i++ {
		lc.wg.Add(1)
		go lc.worker(i)
	}
}

// worker 日志处理工作协程
func (lc *LogCollector) worker(id int) {
	defer lc.wg.Done()
	
	batch := make([]*LogEntry, 0, 100)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case entry := <-lc.logChan:
			batch = append(batch, entry)
			
			// 批量写入（达到100条）
			if len(batch) >= 100 {
				lc.writeBatch(batch)
				batch = make([]*LogEntry, 0, 100)
			}

		case <-ticker.C:
			// 定时写入（5秒）
			if len(batch) > 0 {
				lc.writeBatch(batch)
				batch = make([]*LogEntry, 0, 100)
			}

		case <-lc.stopChan:
			// 停止信号，写入剩余日志
			if len(batch) > 0 {
				lc.writeBatch(batch)
			}
			return
		}
	}
}

// writeBatch 批量写入日志（预留接口）
func (lc *LogCollector) writeBatch(batch []*LogEntry) {
	// TODO: 实现写入Elasticsearch的逻辑
	// 这里先打印到控制台
	for _, entry := range batch {
		data, _ := json.Marshal(entry)
		log.Printf("[LOG] %s", string(data))
	}
	
	log.Printf("Batch written: %d logs", len(batch))
}

// Collect 收集日志（异步）
func (lc *LogCollector) Collect(entry *LogEntry) {
	// 保存到最近日志列表
	lc.logsMutex.Lock()
	lc.recentLogs = append(lc.recentLogs, entry)
	if len(lc.recentLogs) > lc.maxRecent {
		lc.recentLogs = lc.recentLogs[len(lc.recentLogs)-lc.maxRecent:]
	}
	lc.logsMutex.Unlock()

	select {
	case lc.logChan <- entry:
		// 成功发送
	default:
		// channel满了，丢弃日志（避免阻塞）
		log.Println("Log channel full, dropping log entry")
	}
}

// GetRecentLogs 获取最近的日志
func (lc *LogCollector) GetRecentLogs(limit int) []*LogEntry {
	lc.logsMutex.RLock()
	defer lc.logsMutex.RUnlock()

	if limit <= 0 || limit > len(lc.recentLogs) {
		limit = len(lc.recentLogs)
	}

	// 返回最新的 limit 条日志
	start := len(lc.recentLogs) - limit
	if start < 0 {
		start = 0
	}

	result := make([]*LogEntry, limit)
	copy(result, lc.recentLogs[start:])
	
	// 反转顺序，最新的在前面
	for i := 0; i < len(result)/2; i++ {
		j := len(result) - 1 - i
		result[i], result[j] = result[j], result[i]
	}

	return result
}

// Stop 停止日志收集器
func (lc *LogCollector) Stop() {
	log.Println("Stopping log collector...")
	close(lc.stopChan)
	lc.wg.Wait()
	close(lc.logChan)
	log.Println("Log collector stopped")
}
