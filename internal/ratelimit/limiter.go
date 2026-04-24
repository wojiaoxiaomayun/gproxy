package ratelimit

import (
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// RateLimiter 限流器接口
type RateLimiter interface {
	Allow() (bool, string) // 返回是否允许和拒绝原因
}

// SimpleLimiter 简单限流器(只用QPS+Burst)
type SimpleLimiter struct {
	limiter *rate.Limiter
}

func NewSimpleLimiter(qps int, burst int) *SimpleLimiter {
	return &SimpleLimiter{
		limiter: rate.NewLimiter(rate.Limit(qps), burst),
	}
}

func (s *SimpleLimiter) Allow() (bool, string) {
	if s.limiter.Allow() {
		return true, ""
	}
	return false, "rate limit exceeded (per second)"
}

// MultiWindowLimiter 多时间窗口限流器
type MultiWindowLimiter struct {
	// 秒级限流
	secondLimiter *rate.Limiter

	// 分钟级限流
	minuteCounter *FixedWindowCounter

	// 小时级限流
	hourCounter *FixedWindowCounter
}

func NewMultiWindowLimiter(qps, burst, rpm, rph int) *MultiWindowLimiter {
	limiter := &MultiWindowLimiter{
		secondLimiter: rate.NewLimiter(rate.Limit(qps), burst),
	}

	if rpm > 0 {
		limiter.minuteCounter = NewFixedWindowCounter(time.Minute, rpm)
	}

	if rph > 0 {
		limiter.hourCounter = NewFixedWindowCounter(time.Hour, rph)
	}

	return limiter
}

func (m *MultiWindowLimiter) Allow() (bool, string) {
	// 先检查秒级限流
	if !m.secondLimiter.Allow() {
		return false, "rate limit exceeded (per second)"
	}

	// 检查分钟级限流
	if m.minuteCounter != nil && !m.minuteCounter.Allow() {
		return false, "rate limit exceeded (per minute)"
	}

	// 检查小时级限流
	if m.hourCounter != nil && !m.hourCounter.Allow() {
		return false, "rate limit exceeded (per hour)"
	}

	return true, ""
}

// FixedWindowCounter 固定窗口计数器
type FixedWindowCounter struct {
	mu          sync.Mutex
	count       int
	windowStart time.Time
	window      time.Duration
	maxCount    int
}

func NewFixedWindowCounter(window time.Duration, maxCount int) *FixedWindowCounter {
	return &FixedWindowCounter{
		windowStart: time.Now(),
		window:      window,
		maxCount:    maxCount,
	}
}

func (fw *FixedWindowCounter) Allow() bool {
	fw.mu.Lock()
	defer fw.mu.Unlock()

	now := time.Now()

	// 如果窗口过期,重置计数器
	if now.Sub(fw.windowStart) >= fw.window {
		fw.count = 0
		fw.windowStart = now
	}

	// 检查是否超限
	if fw.count >= fw.maxCount {
		return false
	}

	fw.count++
	return true
}
