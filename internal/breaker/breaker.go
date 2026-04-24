package breaker

import (
	"sync"
	"time"
)

// State 熔断器状态
type State int

const (
	StateClosed   State = iota // 关闭状态（正常）
	StateOpen                   // 打开状态（熔断）
	StateHalfOpen               // 半开状态（尝试恢复）
)

// CircuitBreaker 熔断器
type CircuitBreaker struct {
	mu sync.RWMutex

	maxFailures  int           // 最大失败次数
	resetTimeout time.Duration // 重置超时时间

	state        State     // 当前状态
	failures     int       // 失败计数
	lastFailTime time.Time // 最后失败时间
}

// NewCircuitBreaker 创建熔断器
func NewCircuitBreaker(maxFailures int, resetTimeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		maxFailures:  maxFailures,
		resetTimeout: resetTimeout,
		state:        StateClosed,
	}
}

// Allow 检查是否允许请求通过
func (cb *CircuitBreaker) Allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	now := time.Now()

	switch cb.state {
	case StateClosed:
		// 关闭状态，允许通过
		return true

	case StateOpen:
		// 打开状态，检查是否可以进入半开状态
		if now.Sub(cb.lastFailTime) > cb.resetTimeout {
			cb.state = StateHalfOpen
			cb.failures = 0
			return true
		}
		return false

	case StateHalfOpen:
		// 半开状态，允许一个请求尝试
		return true

	default:
		return false
	}
}

// RecordSuccess 记录成功
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if cb.state == StateHalfOpen {
		// 半开状态成功，恢复到关闭状态
		cb.state = StateClosed
		cb.failures = 0
	}
}

// RecordFailure 记录失败
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures++
	cb.lastFailTime = time.Now()

	if cb.failures >= cb.maxFailures {
		cb.state = StateOpen
	}
}

// GetState 获取当前状态
func (cb *CircuitBreaker) GetState() State {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// Reset 重置熔断器
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.state = StateClosed
	cb.failures = 0
}
