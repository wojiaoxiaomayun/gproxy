'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BackendStatus } from '@/components/BackendStatus'
import { Activity, Key, Package, FileText, Zap, Shield, TrendingUp, BarChart3 } from 'lucide-react'

interface GlobalStats {
  pv: number
  active_keys: number
  last_update: string
}

interface DailyStats {
  id: number
  stat_date: string
  pv: number
  active_key_count: number
}

export default function Home() {
  const [health, setHealth] = useState<{ status: string; time: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    // 加载健康状态
    api.health()
      .then(setHealth)
      .catch(console.error)
      .finally(() => setLoading(false))

    // 加载统计数据
    loadStats()
    
    // 每30秒刷新一次统计
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      // 加载实时全局统计
      const stats = await api.getGlobalStats()
      setGlobalStats(stats)

      // 加载最近7天的每日统计
      const daily = await api.getDailyGlobalStats(7)
      setDailyStats(daily)
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  // 计算今日请求数（使用实时API）
  const [todayPV, setTodayPV] = useState(0)
  
  useEffect(() => {
    const loadTodayStats = async () => {
      try {
        const stats = await api.getTodayGlobalStats()
        setTodayPV(stats.pv)
      } catch (error) {
        console.error('加载今日统计失败:', error)
      }
    }
    loadTodayStats()
    // 每30秒刷新一次
    const interval = setInterval(loadTodayStats, 30000)
    return () => clearInterval(interval)
  }, [])

  // 计算昨日请求数
  const getYesterdayPV = () => {
    if (dailyStats.length < 2) return 0
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayDate = yesterday.toISOString().split('T')[0]
    const yesterdayStats = dailyStats.find(s => s.stat_date === yesterdayDate)
    return yesterdayStats?.pv || 0
  }

  // 计算增长率
  const getGrowthRate = (): string => {
    const today = todayPV
    const yesterday = getYesterdayPV()
    if (yesterday === 0) return "0"
    return (((today - yesterday) / yesterday) * 100).toFixed(1)
  }

  // 计算平均每日请求数（包含今日实时数据）
  const getAverageDailyPV = () => {
    if (dailyStats.length === 0) return 0
    
    // 获取今天的日期
    const today = new Date().toISOString().split('T')[0]
    
    // 检查 dailyStats 中是否已包含今天的数据
    const hasTodayInStats = dailyStats.some(s => s.stat_date === today)
    
    // 计算历史数据总和
    const historicalTotal = dailyStats.reduce((sum, stat) => sum + stat.pv, 0)
    
    // 如果今天的数据不在 dailyStats 中，需要加上今日实时数据
    if (!hasTodayInStats && todayPV > 0) {
      const total = historicalTotal + todayPV
      const days = dailyStats.length + 1
      return Math.round(total / days)
    }
    
    // 如果今天的数据已在 dailyStats 中，但实时数据更新了，需要更新今天的值
    if (hasTodayInStats) {
      const todayStatInDb = dailyStats.find(s => s.stat_date === today)
      if (todayStatInDb && todayPV > todayStatInDb.pv) {
        // 用实时数据替换数据库中的今日数据
        const total = historicalTotal - todayStatInDb.pv + todayPV
        return Math.round(total / dailyStats.length)
      }
    }
    
    return Math.round(historicalTotal / dailyStats.length)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">
            仪表盘
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            实时监控系统状态与关键指标
          </p>
        </div>

        {/* Backend Status Warning */}
        <BackendStatus />

        {/* System Status */}
        <Card className="mb-8 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <CardTitle>系统状态</CardTitle>
              </div>
              {loading ? (
                <Badge variant="secondary">检查中...</Badge>
              ) : health?.status === 'ok' ? (
                <Badge variant="success" className="gap-1">
                  <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  运行正常
                </Badge>
              ) : (
                <Badge variant="destructive">服务异常</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-slate-500">
                <div className="h-4 w-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
                正在连接后端服务...
              </div>
            ) : health ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <span className="text-sm text-slate-500 dark:text-slate-400">服务状态</span>
                  <span className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    {health.status === 'ok' ? '✓ 正常运行' : '✗ 异常'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-slate-500 dark:text-slate-400">服务器时间</span>
                  <span className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                    {new Date(health.time).toLocaleString('zh-CN')}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm text-slate-500 dark:text-slate-400">响应延迟</span>
                  <span className="text-lg font-semibold text-green-600 dark:text-green-400">
                    &lt; 50ms
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-red-600 dark:text-red-400">
                ⚠️ 无法连接到后端服务，请检查服务是否正常运行
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>累计请求总数</CardDescription>
              {statsLoading ? (
                <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
              ) : (
                <CardTitle className="text-3xl">
                  {globalStats?.pv.toLocaleString() || 0}
                </CardTitle>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                自启动以来
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>活跃 API Keys</CardDescription>
              {statsLoading ? (
                <div className="h-9 w-20 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
              ) : (
                <CardTitle className="text-3xl">
                  {globalStats?.active_keys || 0}
                </CardTitle>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                去重后的唯一 Key
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>今日请求</CardDescription>
              {statsLoading ? (
                <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
              ) : (
                <CardTitle className="text-3xl">
                  {todayPV.toLocaleString()}
                </CardTitle>
              )}
            </CardHeader>
            <CardContent>
              {!statsLoading && getYesterdayPV() > 0 && (
                <div className={`flex items-center gap-1 text-sm ${
                  parseFloat(getGrowthRate()) >= 0 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  <TrendingUp className="h-4 w-4" />
                  <span>{getGrowthRate()}% vs 昨日</span>
                </div>
              )}
              {!statsLoading && getYesterdayPV() === 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  暂无对比数据
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>日均请求数</CardDescription>
              {statsLoading ? (
                <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
              ) : (
                <CardTitle className="text-3xl">
                  {getAverageDailyPV().toLocaleString()}
                </CardTitle>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                最近 {dailyStats.length} 天平均
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            title="统计分析"
            description="查看详细的统计数据和趋势分析"
            href="/stats"
            icon={<BarChart3 className="h-6 w-6" />}
            color="blue"
          />
          <FeatureCard
            title="项目管理"
            description="管理项目和上游服务配置"
            href="/projects"
            icon={<Package className="h-6 w-6" />}
            color="purple"
          />
          <FeatureCard
            title="API Keys"
            description="管理 API 访问凭证和权限"
            href="/api-keys"
            icon={<Key className="h-6 w-6" />}
            color="green"
          />
          {/* 暂时隐藏日志和熔断功能
          <FeatureCard
            title="日志查看"
            description="查看和分析请求日志，追踪问题"
            href="/logs"
            icon={<FileText className="h-6 w-6" />}
            color="yellow"
          />
          */}
          <FeatureCard
            title="限流配置"
            description="在项目中配置分组限流策略"
            href="/projects"
            icon={<Zap className="h-6 w-6" />}
            color="red"
          />
          {/* 暂时隐藏熔断功能
          <FeatureCard
            title="熔断监控"
            description="监控服务熔断状态，自动故障恢复"
            href="/logs"
            icon={<Shield className="h-6 w-6" />}
            color="slate"
          />
          */}
        </div>
      </div>
    </div>
  )
}

function FeatureCard({
  title,
  description,
  href,
  icon,
  color,
}: {
  title: string
  description: string
  href: string
  icon: React.ReactNode
  color: string
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/20',
    red: 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20',
    slate: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 hover:bg-slate-500/20',
  }

  return (
    <Link href={href}>
      <Card className="border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer h-full">
        <CardHeader>
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-3 transition-colors ${colorClasses[color as keyof typeof colorClasses]}`}>
            {icon}
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="text-slate-600 dark:text-slate-400">
            {description}
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}
