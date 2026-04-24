package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gproxy/internal/cache"
	"gproxy/internal/config"
	"gproxy/internal/logger"
	"gproxy/internal/middleware"
	"gproxy/internal/model"
	"gproxy/internal/proxy"

	"github.com/gin-gonic/gin"
)

func main() {
	// 设置日志
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Println("Starting API Gateway Audit System...")

	// 加载配置文件（如果不存在会自动生成）
	cfg, err := config.LoadConfig("./config/config.yaml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 初始化数据库
	if err := os.MkdirAll("./data", 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	if err := model.InitDB(cfg.Database.Path); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer model.CloseDB()

	// 初始化配置缓存
	configCache := cache.GetGlobalCache()
	if err := configCache.Load(); err != nil {
		log.Fatalf("Failed to load config cache: %v", err)
	}

	// 启动配置热更新
	configCache.StartReloader(cfg.GetReloadInterval())

	// 初始化日志收集器
	logCollector := logger.NewLogCollector(cfg.Log.BufferSize, cfg.Log.WorkerPool)
	logCollector.Start()
	defer logCollector.Stop()

	// 创建代理处理器
	proxyHandler := proxy.NewProxyHandler(configCache, logCollector)

	// 设置Gin模式
	gin.SetMode(cfg.Server.Mode)

	// 创建路由
	r := gin.New()
	r.Use(gin.Recovery())

	// CORS 中间件 - 允许前端访问
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// 健康检查（使用特殊前缀避免冲突）
	r.GET("/__gproxy__/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})

	// 管理接口（使用特殊前缀避免与代理路径冲突）
	admin := r.Group("/__gproxy__/admin")
	{
		// 配置重载接口
		admin.POST("/reload", func(c *gin.Context) {
			log.Println("Admin: reload config")
			if err := configCache.Load(); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "config reloaded"})
		})

		// API Keys 管理
		admin.GET("/api-keys", func(c *gin.Context) {
			log.Println("Admin: get api keys")
			keys, err := model.GetAllApiKeys()
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, keys)
		})

		admin.POST("/api-keys", func(c *gin.Context) {
			var key model.ApiKey
			if err := c.ShouldBindJSON(&key); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.CreateApiKey(&key); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(201, key)
		})

		admin.PUT("/api-keys/:id", func(c *gin.Context) {
			id := c.Param("id")
			var key model.ApiKey
			if err := c.ShouldBindJSON(&key); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateApiKey(id, &key); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, key)
		})

		admin.DELETE("/api-keys/:id", func(c *gin.Context) {
			id := c.Param("id")
			if err := model.DeleteApiKey(id); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "deleted"})
		})

		// 项目管理
		admin.GET("/projects", func(c *gin.Context) {
			projects, err := model.GetAllProjects()
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, projects)
		})

		admin.POST("/projects", func(c *gin.Context) {
			var project model.Project
			if err := c.ShouldBindJSON(&project); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.CreateProject(&project); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(201, project)
		})

		admin.PUT("/projects/:id", func(c *gin.Context) {
			id := c.Param("id")
			var project model.Project
			if err := c.ShouldBindJSON(&project); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateProject(id, &project); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, project)
		})

		admin.DELETE("/projects/:id", func(c *gin.Context) {
			id := c.Param("id")
			if err := model.DeleteProject(id); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "deleted"})
		})

		// 上游管理
		admin.GET("/upstreams", func(c *gin.Context) {
			projectID := c.Query("project_id")
			upstreams, err := model.GetUpstreams(projectID)
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, upstreams)
		})

		admin.POST("/upstreams", func(c *gin.Context) {
			var upstream model.Upstream
			if err := c.ShouldBindJSON(&upstream); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.CreateUpstream(&upstream); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(201, upstream)
		})

		admin.PUT("/upstreams/:id", func(c *gin.Context) {
			id := c.Param("id")
			var upstream model.Upstream
			if err := c.ShouldBindJSON(&upstream); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateUpstream(id, &upstream); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, upstream)
		})

		admin.DELETE("/upstreams/:id", func(c *gin.Context) {
			id := c.Param("id")
			if err := model.DeleteUpstream(id); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "deleted"})
		})

		// 分组管理
		admin.GET("/groups", func(c *gin.Context) {
			projectID := c.Query("project_id")
			var groups []model.Group
			var err error
			if projectID != "" {
				groups, err = model.GetGroupsByProject(projectID)
			} else {
				groups, err = model.GetAllGroups()
			}
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, groups)
		})

		admin.POST("/groups", func(c *gin.Context) {
			var group model.Group
			if err := c.ShouldBindJSON(&group); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.CreateGroup(&group); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(201, group)
		})

		admin.PUT("/groups/:id", func(c *gin.Context) {
			id := c.Param("id")
			var group model.Group
			if err := c.ShouldBindJSON(&group); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateGroup(id, &group); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, group)
		})

		admin.DELETE("/groups/:id", func(c *gin.Context) {
			id := c.Param("id")
			if err := model.DeleteGroup(id); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "deleted"})
		})

		// 限流配置管理
		admin.GET("/rate-limits", func(c *gin.Context) {
			configs, err := model.GetAllRateLimitConfigs()
			if err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, configs)
		})

		admin.GET("/rate-limits/:group_id", func(c *gin.Context) {
			groupID := c.Param("group_id")
			var id int64
			if _, err := fmt.Sscanf(groupID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid group_id"})
				return
			}
			config, err := model.GetRateLimitConfigByGroup(id)
			if err != nil {
				c.JSON(404, gin.H{"error": "not found"})
				return
			}
			c.JSON(200, config)
		})

		admin.PUT("/rate-limits/:group_id", func(c *gin.Context) {
			groupID := c.Param("group_id")
			var id int64
			if _, err := fmt.Sscanf(groupID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid group_id"})
				return
			}
			var config model.RateLimitConfig
			if err := c.ShouldBindJSON(&config); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateRateLimitConfig(id, &config); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, config)
		})

		admin.DELETE("/rate-limits/:group_id", func(c *gin.Context) {
			groupID := c.Param("group_id")
			var id int64
			if _, err := fmt.Sscanf(groupID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid group_id"})
				return
			}
			if err := model.DeleteRateLimitConfig(id); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "deleted"})
		})

		// 日志配置管理
		admin.GET("/log-config/:project_id", func(c *gin.Context) {
			projectID := c.Param("project_id")
			var id int64
			if _, err := fmt.Sscanf(projectID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid project_id"})
				return
			}
			config, err := model.GetLogConfigByProject(id)
			if err != nil {
				c.JSON(404, gin.H{"error": "not found"})
				return
			}
			c.JSON(200, config)
		})

		admin.PUT("/log-config/:project_id", func(c *gin.Context) {
			projectID := c.Param("project_id")
			var id int64
			if _, err := fmt.Sscanf(projectID, "%d", &id); err != nil {
				c.JSON(400, gin.H{"error": "invalid project_id"})
				return
			}
			var config model.LogConfig
			if err := c.ShouldBindJSON(&config); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := model.UpdateLogConfig(id, &config); err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, config)
		})

		// 日志查询
		admin.GET("/logs", func(c *gin.Context) {
			logs := logCollector.GetRecentLogs(100)
			c.JSON(200, logs)
		})
	}

	// 使用 NoRoute 处理所有其他请求（代理）
	// 注意：需要排除 /__gproxy__/* 路径
	r.NoRoute(func(c *gin.Context) {
		// 如果是管理路径，返回 404（已经被上面的路由处理过了）
		path := c.Request.URL.Path
		if len(path) >= 11 && path[:11] == "/__gproxy__" {
			c.JSON(404, gin.H{"error": "not found"})
			return
		}

		// 应用中间件并处理代理请求
		middleware.AuthMiddleware()(c)
		if c.IsAborted() {
			return
		}
		middleware.RateLimitMiddleware()(c)
		if c.IsAborted() {
			return
		}
		middleware.CircuitBreakerMiddleware()(c)
		if c.IsAborted() {
			return
		}
		proxyHandler.Handle(c)
	})

	// 启动服务器
	port := fmt.Sprintf(":%d", cfg.Server.Port)
	log.Printf("Server starting on %s", port)

	// 优雅关闭
	go func() {
		if err := r.Run(port); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// 等待中断信号
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	time.Sleep(2 * time.Second)
	log.Println("Server stopped")
}
