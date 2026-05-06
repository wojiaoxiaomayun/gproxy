'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react'

export function BackendStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    checkBackend()
    const interval = setInterval(checkBackend, 30000) // 每30秒检查一次
    return () => clearInterval(interval)
  }, [])

  const checkBackend = async () => {
    try {
      await api.health()
      setStatus('online')
      setError('')
    } catch (err) {
      setStatus('offline')
      setError(err instanceof Error ? err.message : '连接失败')
    }
  }

  if (status === 'checking') {
    return null
  }

  if (status === 'offline') {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950 mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                后端服务未连接
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                {error}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                请启动后端服务：<code className="bg-yellow-100 dark:bg-yellow-900 px-2 py-0.5 rounded">cd .. && go run main.go</code>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return null
}
