package breaker

import (
	"fmt"
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

	maxFailures     int           // 最大失败次数
	resetTimeout    time.Duration // 重置超时时间
	halfOpenMaxTest int           // 半开状态最大测试请求数

	state           State     // 当前状态
	failures        int       // 失败计数
	lastFailTime    time.Time // 最后失败时间
	halfOpenTestCnt int       // 半开状态当前测试请求计数
}

// NewCircuitBreaker 创建熔断器
func NewCircuitBreaker(maxFailures int, resetTimeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		maxFailures:     maxFailures,
		resetTimeout:    resetTimeout,
		halfOpenMaxTest: 1, // 默认值
		state:           StateClosed,
	}
}

// NewCircuitBreakerWithConfig 使用完整配置创建熔断器
func NewCircuitBreakerWithConfig(maxFailures int, resetTimeout time.Duration, halfOpenMaxTest int) *CircuitBreaker {
	if halfOpenMaxTest < 1 {
		halfOpenMaxTest = 1
	}
	return &CircuitBreaker{
		maxFailures:     maxFailures,
		resetTimeout:    resetTimeout,
		halfOpenMaxTest: halfOpenMaxTest,
		state:           StateClosed,
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
		timeSinceLastFail := now.Sub(cb.lastFailTime)
		if timeSinceLastFail > cb.resetTimeout {
			cb.state = StateHalfOpen
			cb.failures = 0
			cb.halfOpenTestCnt = 0
			return true
		}
		return false

	case StateHalfOpen:
		// 半开状态，允许配置数量的请求测试
		if cb.halfOpenTestCnt >= cb.halfOpenMaxTest {
			return false // 已达到测试请求上限
		}
		cb.halfOpenTestCnt++
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
		cb.halfOpenTestCnt = 0
	}
}

// RecordFailure 记录失败
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures++
	cb.lastFailTime = time.Now()

	// 如果在半开状态失败，立即重新打开熔断器
	if cb.state == StateHalfOpen {
		cb.state = StateOpen
		cb.halfOpenTestCnt = 0
		return
	}

	// 关闭状态下，失败次数达到阈值则打开熔断器
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
	cb.halfOpenTestCnt = 0
}

// GetDebugInfo 获取调试信息
func (cb *CircuitBreaker) GetDebugInfo() string {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	return fmt.Sprintf("State=%v, Failures=%d, MaxFailures=%d, ResetTimeout=%v, HalfOpenMaxTest=%d",
		cb.state, cb.failures, cb.maxFailures, cb.resetTimeout, cb.halfOpenMaxTest)
}
