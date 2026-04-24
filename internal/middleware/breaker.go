package middleware

import (
	"net/http"
	"sync"
	"time"

	"gproxy/internal/breaker"

	"github.com/gin-gonic/gin"
)

var (
	// 全局熔断器映射: projectId -> CircuitBreaker
	breakers   = make(map[int64]*breaker.CircuitBreaker)
	breakersMu sync.RWMutex
)

// getOrCreateBreaker 获取或创建熔断器
func getOrCreateBreaker(projectID int64) *breaker.CircuitBreaker {
	breakersMu.RLock()
	cb, exists := breakers[projectID]
	breakersMu.RUnlock()

	if exists {
		return cb
	}

	breakersMu.Lock()
	defer breakersMu.Unlock()

	// 双重检查
	if cb, exists := breakers[projectID]; exists {
		return cb
	}

	// 创建新的熔断器: 5次失败，30秒恢复
	cb = breaker.NewCircuitBreaker(5, 30*time.Second)
	breakers[projectID] = cb
	return cb
}

// CircuitBreakerMiddleware 熔断中间件
func CircuitBreakerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从上下文获取project_id
		projectID, exists := c.Get("project_id")
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "project_id not found in context",
			})
			c.Abort()
			return
		}

		// 获取熔断器
		cb := getOrCreateBreaker(projectID.(int64))

		// 检查是否允许通过
		if !cb.Allow() {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error": "service unavailable (circuit breaker open)",
			})
			c.Abort()
			return
		}

		// 将熔断器存入上下文，供后续使用
		c.Set("circuit_breaker", cb)

		c.Next()
	}
}
