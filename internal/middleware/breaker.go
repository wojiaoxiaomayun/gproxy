package middleware

import (
	"net/http"

	"gproxy/internal/cache"

	"github.com/gin-gonic/gin"
)

// CircuitBreakerMiddleware 熔断中间件
func CircuitBreakerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从上下文获取 group_id
		groupID, exists := c.Get("group_id")
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "group_id not found in context",
			})
			c.Abort()
			return
		}

		// 从缓存获取熔断器
		configCache := cache.GetGlobalCache()
		cb := configCache.GetCircuitBreaker(groupID.(int64))
		
		// 如果没有配置熔断器,则跳过熔断检查
		if cb == nil {
			c.Next()
			return
		}

		// 检查是否允许通过
		allowed := cb.Allow()
		if !allowed {
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
