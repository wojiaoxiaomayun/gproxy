'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BackendStatus } from '@/components/BackendStatus'
import { Activity, Key, Package, FileText, Zap, Shield, Settings, TrendingUp } from 'lucide-react'

export default function Home() {
  const [health, setHealth] = useState<{ status: string; time: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.health()
      .then(setHealth)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

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
              <CardDescription>今日请求</CardDescription>
              <CardTitle className="text-3xl">12,345</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
                <TrendingUp className="h-4 w-4" />
                <span>+12.5%</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>活跃 API Keys</CardDescription>
              <CardTitle className="text-3xl">24</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-500">
                总计 28 个
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>平均响应时间</CardDescription>
              <CardTitle className="text-3xl">45ms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-green-600 dark:text-green-400">
                性能良好
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>错误率</CardDescription>
              <CardTitle className="text-3xl">0.2%</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-slate-500">
                24 / 12,345 请求
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            title="项目管理"
            description="创建和管理项目，配置上游服务和 API Keys"
            href="/projects"
            icon={<Key className="h-6 w-6" />}
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
            title="日志查看"
            description="查看和分析请求日志，追踪问题"
            href="/logs"
            icon={<FileText className="h-6 w-6" />}
            color="green"
          />
          <FeatureCard
            title="限流配置"
            description="在项目中配置分组限流策略，保护服务稳定"
            href="/projects"
            icon={<Zap className="h-6 w-6" />}
            color="yellow"
          />
          <FeatureCard
            title="熔断监控"
            description="监控服务熔断状态，自动故障恢复"
            href="/logs"
            icon={<Shield className="h-6 w-6" />}
            color="red"
          />
          <FeatureCard
            title="API Keys"
            description="在项目下管理 API 访问凭证"
            href="/projects"
            icon={<Key className="h-6 w-6" />}
            color="blue"
          />
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
