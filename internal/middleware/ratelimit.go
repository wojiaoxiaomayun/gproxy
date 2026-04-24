package middleware

import (
	"net/http"

	"gproxy/internal/cache"

	"github.com/gin-gonic/gin"
)

// RateLimitMiddleware 限流中间件
func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从上下文获取group_id
		groupID, exists := c.Get("group_id")
		if !exists {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "group_id not found in context",
			})
			c.Abort()
			return
		}

		// 获取限流器
		configCache := cache.GetGlobalCache()
		limiter := configCache.GetRateLimiter(groupID.(int64))

		if limiter == nil {
			// 没有配置限流，直接通过
			c.Next()
			return
		}

		// 检查是否允许通过
		allowed, reason := limiter.Allow()
		if !allowed {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": reason,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
