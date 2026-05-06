package middleware

import (
	"net/http"

	"gproxy/internal/cache"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware API Key鉴权中间件
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从Header提取API Key (X-Validate-Key: <token>)
		apiKey := c.GetHeader("X-Validate-Key")
		if apiKey == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "missing X-Validate-Key header",
			})
			c.Abort()
			return
		}

		// 从缓存查找API Key配置
		configCache := cache.GetGlobalCache()
		keyConfig := configCache.GetApiKey(apiKey)

		if keyConfig == nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid api key",
			})
			c.Abort()
			return
		}

		// 检查状态
		if keyConfig.Status != "active" {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "api key is disabled",
			})
			c.Abort()
			return
		}

		// 将配置存入上下文
		c.Set("api_key_config", keyConfig)
		c.Set("project_id", keyConfig.ProjectID)
		c.Set("group_id", keyConfig.GroupID)
		c.Set("app_key", keyConfig.AppKey)

		c.Next()
	}
}
