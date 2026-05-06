'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { api, Project, ApiKey, Group, Upstream, LogConfig } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BackendStatus } from '@/components/BackendStatus'
import { Package, Plus, Edit, Trash2, ExternalLink, Calendar, ArrowLeft, Key, Users, Settings, Activity, RefreshCw, Shield, Gauge, Copy } from 'lucide-react'
import { Dialog, DialogPopup, DialogHeader, DialogTitle, DialogDescription, DialogPanel, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogPopup, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field, FieldLabel } from '@/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toastManager } from '@/components/ui/toast'

// 项目详情视图组件
function ProjectDetailView({ projectId, onBack }: { projectId: number; onBack: () => void }) {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [upstreams, setUpstreams] = useState<Upstream[]>([])
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [upstreamDialogOpen, setUpstreamDialogOpen] = useState(false)
  const [upstreamEditDialogOpen, setUpstreamEditDialogOpen] = useState(false)
  const [rateLimitDialogOpen, setRateLimitDialogOpen] = useState(false)
  const [circuitBreakerDialogOpen, setCircuitBreakerDialogOpen] = useState(false)
  const [selectedGroupForRateLimit, setSelectedGroupForRateLimit] = useState<Group | null>(null)
  const [selectedGroupForCircuitBreaker, setSelectedGroupForCircuitBreaker] = useState<Group | null>(null)
  const [selectedUpstreamForEdit, setSelectedUpstreamForEdit] = useState<Upstream | null>(null)
  const [selectedApiKeyForEdit, setSelectedApiKeyForEdit] = useState<ApiKey | null>(null)
  const [apiKeyEditDialogOpen, setApiKeyEditDialogOpen] = useState(false)

  const [apiKeyForm, setApiKeyForm] = useState({
    name: '',
    app_key: '',
    group_id: 0,
    status: 'active',
  })

  const [groupForm, setGroupForm] = useState({
    name: '',
  })

  const [upstreamForm, setUpstreamForm] = useState({
    target_url: '',
    path_prefix: '',
    timeout: 5000,
  })

  const [rateLimitForm, setRateLimitForm] = useState({
    mode: 'simple' as 'simple' | 'multi',
    requests_per_second: 10,
    requests_per_minute: 100,
    requests_per_hour: 1000,
    burst: 20,
  })

  const [circuitBreakerForm, setCircuitBreakerForm] = useState({
    max_failures: 5,
    reset_timeout: 30,
    half_open_max_test: 1,
  })

  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
  })

  const [logConfig, setLogConfig] = useState<LogConfig | null>(null)
  const [logConfigForm, setLogConfigForm] = useState({
    enable_body: 0,
    body_record_threshold_ms: 500,
    max_body_size: 2048,
    only_error: 0,
  })

  const [todayPV, setTodayPV] = useState(0)

  useEffect(() => {
    loadProjectData()
    loadTodayStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    // 每30秒刷新一次今日统计
    const interval = setInterval(loadTodayStats, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  useEffect(() => {
    if (project) {
      setProjectForm({
        name: project.name,
        description: project.description,
      })
    }
  }, [project])

  const loadProjectData = async () => {
    try {
      const projects = await api.getProjects()
      const currentProject = projects.find(p => p.id === projectId)
      setProject(currentProject || null)

      const allKeys = await api.getApiKeys()
      setApiKeys(allKeys.filter(k => k.project_id === projectId))

      try {
        const projectGroups = await api.getGroups(projectId)
        setGroups(projectGroups)
      } catch (error) {
        console.warn('Groups API not available:', error)
        setGroups([])
      }

      try {
        const projectUpstreams = await api.getUpstreams(projectId)
        setUpstreams(projectUpstreams)
      } catch (error) {
        console.warn('Upstreams API not available:', error)
        setUpstreams([])
      }

      try {
        const config = await api.getLogConfig(projectId)
        setLogConfig(config)
        setLogConfigForm({
          enable_body: config.enable_body,
          body_record_threshold_ms: config.body_record_threshold_ms,
          max_body_size: config.max_body_size,
          only_error: config.only_error,
        })
      } catch (error) {
        console.warn('Log config not found:', error)
      }
    } catch (error) {
      console.error('Failed to load project data:', error)
      toastManager.add({
        type: 'error',
        title: '加载失败',
        description: '无法加载项目数据，请刷新页面重试',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadTodayStats = async () => {
    try {
      const stats = await api.getTodayProjectStats(projectId)
      setTodayPV(stats.pv)
    } catch (error) {
      console.error('加载今日统计失败:', error)
    }
  }

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (apiKeyForm.group_id === 0) {
      toastManager.add({
        type: 'error',
        title: '请选择分组',
        description: '分组是必选项',
      })
      return
    }
    try {
      await api.createApiKey({ ...apiKeyForm, project_id: projectId })
      setApiKeyDialogOpen(false)
      setApiKeyForm({ name: '', app_key: '', group_id: 0, status: 'active' })
      loadProjectData()
      toastManager.add({
        type: 'success',
        title: 'API Key 创建成功',
      })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '创建失败',
        description: String(error),
      })
    }
  }

  const handleOpenApiKeyEditDialog = (apiKey: ApiKey) => {
    setSelectedApiKeyForEdit(apiKey)
    setApiKeyForm({
      name: apiKey.name,
      app_key: apiKey.app_key,
      group_id: apiKey.group_id,
      status: apiKey.status,
    })
    setApiKeyEditDialogOpen(true)
  }

  const handleUpdateApiKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedApiKeyForEdit) return
    if (apiKeyForm.group_id === 0) {
      toastManager.add({
        type: 'error',
        title: '请选择分组',
      })
      return
    }
    try {
      await api.updateApiKey(selectedApiKeyForEdit.id, apiKeyForm)
      setApiKeyEditDialogOpen(false)
      setSelectedApiKeyForEdit(null)
      setApiKeyForm({ name: '', app_key: '', group_id: 0, status: 'active' })
      loadProjectData()
      toastManager.add({
        type: 'success',
        title: 'API Key 更新成功',
      })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '更新失败',
        description: String(error),
      })
    }
  }

  const handleToggleApiKeyStatus = async (apiKey: ApiKey) => {
    const newStatus = apiKey.status === 'active' ? 'inactive' : 'active'
    const actionText = newStatus === 'active' ? '启用' : '禁用'
    if (!confirm(`确定要${actionText}这个 API Key 吗？`)) return
    try {
      await api.updateApiKey(apiKey.id, { status: newStatus })
      loadProjectData()
      toastManager.add({
        type: 'success',
        title: `${actionText}成功`,
      })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: `${actionText}失败`,
        description: String(error),
      })
    }
  }

  const handleDeleteApiKey = async (id: number) => {
    if (!confirm('确定要删除这个 API Key 吗？')) return
    try {
      await api.deleteApiKey(id)
      loadProjectData()
      toastManager.add({
        type: 'success',
        title: '删除成功',
      })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '删除失败',
        description: String(error),
      })
    }
  }

  const generateApiKey = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    const segments = [
      Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
      Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
      Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
      Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    ]
    return 'sk-' + segments.join('-')
  }

  const handleGenerateApiKey = () => {
    setApiKeyForm({ ...apiKeyForm, app_key: generateApiKey() })
  }

  const handleApiKeyDialogOpenChange = (open: boolean) => {
    setApiKeyDialogOpen(open)
    if (open) {
      const defaultGroup = groups.find(g => g.name.toLowerCase() === 'default')
      const defaultGroupId = defaultGroup ? defaultGroup.id : (groups.length > 0 ? groups[0].id : 0)
      setApiKeyForm({
        name: '',
        app_key: generateApiKey(),
        group_id: defaultGroupId,
        status: 'active',
      })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toastManager.add({
      type: 'success',
      title: '已复制到剪贴板',
    })
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const newGroup = await api.createGroup({
        name: groupForm.name,
        project_id: projectId,
      })
      setGroups([...groups, newGroup])
      setGroupDialogOpen(false)
      setGroupForm({ name: '' })
      toastManager.add({
        type: 'success',
        title: '分组创建成功',
      })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '创建失败',
        description: String(error),
      })
    }
  }

  const handleDeleteGroup = async (id: number) => {
    if (!confirm('确定要删除这个分组吗？这将只删除该项目下的分组。')) return
    try {
      await api.deleteGroup(id, projectId)
      setGroups(groups.filter(g => g.id !== id))
      toastManager.add({
        type: 'success',
        title: '删除成功',
      })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '删除失败',
        description: String(error),
      })
    }
  }

  const handleCreateUpstream = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const newUpstream = await api.createUpstream({
        project_id: projectId,
        target_url: upstreamForm.target_url,
        path_prefix: upstreamForm.path_prefix,
        timeout: upstreamForm.timeout,
      })
      setUpstreams([...upstreams, newUpstream])
      setUpstreamDialogOpen(false)
      setUpstreamForm({ target_url: '', path_prefix: '', timeout: 5000 })
      toastManager.add({
        type: 'success',
        title: '上游创建成功',
      })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '创建失败',
        description: String(error),
      })
    }
  }

  const handleDeleteUpstream = async (id: number) => {
    if (!confirm('确定要删除这个上游配置吗？')) return
    try {
      await api.deleteUpstream(id, projectId)
      setUpstreams(upstreams.filter(u => u.id !== id))
      toastManager.add({
        type: 'success',
        title: '删除成功',
      })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '删除失败',
        description: String(error),
      })
    }
  }

  const handleOpenUpstreamEditDialog = (upstream: Upstream) => {
    setSelectedUpstreamForEdit(upstream)
    setUpstreamForm({
      target_url: upstream.target_url,
      path_prefix: upstream.path_prefix,
      timeout: upstream.timeout,
    })
    setUpstreamEditDialogOpen(true)
  }

  const handleUpdateUpstream = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUpstreamForEdit) return
    try {
      const updatedUpstream = await api.updateUpstream(selectedUpstreamForEdit.id, {
        target_url: upstreamForm.target_url,
        path_prefix: upstreamForm.path_prefix,
        timeout: upstreamForm.timeout,
      })
      setUpstreams(upstreams.map(u => u.id === selectedUpstreamForEdit.id ? updatedUpstream : u))
      setUpstreamEditDialogOpen(false)
      setSelectedUpstreamForEdit(null)
      setUpstreamForm({ target_url: '', path_prefix: '', timeout: 5000 })
      toastManager.add({
        type: 'success',
        title: '上游更新成功',
      })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '更新失败',
        description: String(error),
      })
    }
  }

  const handleOpenRateLimitDialog = async (group: Group) => {
    setSelectedGroupForRateLimit(group)
    try {
      const config = await api.getRateLimitConfig(group.id)
      const mode = config.enable_multi_window === 1 ? 'multi' : 'simple'
      setRateLimitForm({
        mode: mode,
        requests_per_second: config.qps,
        requests_per_minute: mode === 'multi' ? config.rpm : config.qps * 60,
        requests_per_hour: mode === 'multi' ? config.rph : config.qps * 3600,
        burst: config.burst,
      })
    } catch (error) {
      setRateLimitForm({
        mode: 'simple',
        requests_per_second: 10,
        requests_per_minute: 600,
        requests_per_hour: 36000,
        burst: 20,
      })
    }
    setRateLimitDialogOpen(true)
  }

  const handleSaveRateLimit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroupForRateLimit) return
    try {
      const enable_multi_window = rateLimitForm.mode === 'multi' ? 1 : 0
      const payload: any = {
        group_id: selectedGroupForRateLimit.id,
        qps: rateLimitForm.requests_per_second,
        burst: rateLimitForm.burst,
        enable_multi_window: enable_multi_window,
      }
      if (rateLimitForm.mode === 'multi') {
        payload.rpm = rateLimitForm.requests_per_minute
        payload.rph = rateLimitForm.requests_per_hour
      } else {
        payload.rpm = 0
        payload.rph = 0
      }
      await api.updateRateLimitConfig(selectedGroupForRateLimit.id, payload)
      await api.reload()
      toastManager.add({
        type: 'success',
        title: '限流配置已保存',
      })
      setRateLimitDialogOpen(false)
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '保存失败',
        description: String(error),
      })
    }
  }

  const handleOpenCircuitBreakerDialog = async (group: Group) => {
    setSelectedGroupForCircuitBreaker(group)
    try {
      const config = await api.getCircuitBreakerConfig(group.id)
      setCircuitBreakerForm({
        max_failures: config.max_failures,
        reset_timeout: config.reset_timeout,
        half_open_max_test: config.half_open_max_test || 1,
      })
    } catch (error) {
      setCircuitBreakerForm({
        max_failures: 5,
        reset_timeout: 30,
        half_open_max_test: 1,
      })
    }
    setCircuitBreakerDialogOpen(true)
  }

  const handleSaveCircuitBreaker = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedGroupForCircuitBreaker) return
    try {
      const payload = {
        group_id: selectedGroupForCircuitBreaker.id,
        max_failures: circuitBreakerForm.max_failures,
        reset_timeout: circuitBreakerForm.reset_timeout,
        half_open_max_test: circuitBreakerForm.half_open_max_test,
      }
      await api.updateCircuitBreakerConfig(selectedGroupForCircuitBreaker.id, payload)
      await api.reload()
      toastManager.add({
        type: 'success',
        title: '熔断配置已保存',
      })
      setCircuitBreakerDialogOpen(false)
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '保存失败',
        description: String(error),
      })
    }
  }

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.updateProject(projectId, projectForm)
      await loadProjectData()
      toastManager.add({
        type: 'success',
        title: '项目更新成功',
      })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '更新失败',
        description: String(error),
      })
    }
  }

  const handleUpdateLogConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.updateLogConfig(projectId, logConfigForm)
      await api.reload()
      const config = await api.getLogConfig(projectId)
      setLogConfig(config)
      toastManager.add({
        type: 'success',
        title: '日志配置已保存',
      })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '保存失败',
        description: String(error),
      })
    }
  }

  const handleDeleteProject = async () => {
    if (!confirm(`确定要删除项目"${project?.name}"吗？此操作不可逆！`)) return
    try {
      await api.deleteProject(projectId)
      toastManager.add({
        type: 'success',
        title: '项目已删除',
      })
      onBack()
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '删除失败',
        description: String(error),
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-5 w-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">项目不存在</h2>
          <Button onClick={onBack}>返回项目列表</Button>
        </div>
      </div>
    )
  }

  // 渲染部分
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-8">
        <Button variant="ghost" onClick={onBack} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" />
          返回项目列表
        </Button>
        
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              {project.name}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              {project.description}
            </p>
          </div>
          <Badge variant="success">活跃</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Keys
              </CardDescription>
              <CardTitle className="text-2xl">{apiKeys.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                分组
              </CardDescription>
              <CardTitle className="text-2xl">{groups.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                今日请求
              </CardDescription>
              <CardTitle className="text-2xl">{todayPV.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                上游服务
              </CardDescription>
              <CardTitle className="text-2xl">{upstreams.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="upstream" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upstream">上游配置</TabsTrigger>
            <TabsTrigger value="groups">分组管理</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="settings">项目设置</TabsTrigger>
          </TabsList>

          {/* 上游配置 Tab */}
          <TabsContent value="upstream">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>上游服务配置</CardTitle>
                  <Button onClick={() => setUpstreamDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    添加上游
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {upstreams.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    暂无上游配置
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>目标 URL</TableHead>
                        <TableHead>路径前缀</TableHead>
                        <TableHead>超时时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upstreams.map((upstream) => (
                        <TableRow key={upstream.id}>
                          <TableCell className="font-mono text-sm">{upstream.target_url}</TableCell>
                          <TableCell className="font-mono text-sm">{upstream.path_prefix || '/'}</TableCell>
                          <TableCell>{upstream.timeout}ms</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenUpstreamEditDialog(upstream)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteUpstream(upstream.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* 分组管理 Tab */}
          <TabsContent value="groups">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>分组管理</CardTitle>
                  <Button onClick={() => setGroupDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    添加分组
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {groups.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    暂无分组
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groups.map((group) => (
                      <Card key={group.id} className="border-slate-200 dark:border-slate-800">
                        <CardHeader>
                          <CardTitle className="text-lg">{group.name}</CardTitle>
                          <CardDescription>
                            {apiKeys.filter(k => k.group_id === group.id).length} 个 API Keys
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => handleOpenRateLimitDialog(group)}
                            >
                              <Gauge className="h-3 w-3" />
                              配置限流
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => handleOpenCircuitBreakerDialog(group)}
                            >
                              <Shield className="h-3 w-3" />
                              配置熔断
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteGroup(group.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* API Keys Tab */}
          <TabsContent value="api-keys">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>API Keys</CardTitle>
                  <Button onClick={() => handleApiKeyDialogOpenChange(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    创建 API Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {apiKeys.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    暂无 API Key
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名称</TableHead>
                        <TableHead>App Key</TableHead>
                        <TableHead>分组</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((apiKey) => {
                        const group = groups.find(g => g.id === apiKey.group_id)
                        return (
                          <TableRow key={apiKey.id}>
                            <TableCell className="font-medium">{apiKey.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <code className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                  {apiKey.app_key}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => copyToClipboard(apiKey.app_key)}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>{group?.name || `分组 ${apiKey.group_id}`}</TableCell>
                            <TableCell>
                              <Badge variant={apiKey.status === 'active' ? 'success' : 'secondary'}>
                                {apiKey.status === 'active' ? '活跃' : '禁用'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenApiKeyEditDialog(apiKey)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleApiKeyStatus(apiKey)}
                                  className={apiKey.status === 'active' ? 'text-orange-600' : 'text-green-600'}
                                >
                                  {apiKey.status === 'active' ? '禁用' : '启用'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteApiKey(apiKey.id)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* 项目设置 Tab */}
          <TabsContent value="settings">
            <div className="space-y-6">
              {/* 项目信息 */}
              <Card>
                <CardHeader>
                  <CardTitle>项目信息</CardTitle>
                  <CardDescription>修改项目的基本信息</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateProject} className="space-y-4">
                    <Field>
                      <FieldLabel>项目名称</FieldLabel>
                      <Input
                        value={projectForm.name}
                        onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                        placeholder="项目名称"
                      />
                    </Field>
                    <Field>
                      <FieldLabel>项目描述</FieldLabel>
                      <Textarea
                        value={projectForm.description}
                        onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                        placeholder="项目描述"
                        rows={3}
                      />
                    </Field>
                    <Button type="submit">保存更改</Button>
                  </form>
                </CardContent>
              </Card>

              {/* 日志配置 */}
              <Card>
                <CardHeader>
                  <CardTitle>日志配置</CardTitle>
                  <CardDescription>配置请求日志的记录策略</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdateLogConfig} className="space-y-4">
                    <Field>
                      <div className="flex items-center justify-between">
                        <div>
                          <FieldLabel>记录请求体</FieldLabel>
                          <p className="text-sm text-slate-500 mt-1">是否记录请求的 body 内容</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={logConfigForm.enable_body === 1}
                            onChange={(e) => setLogConfigForm({ ...logConfigForm, enable_body: e.target.checked ? 1 : 0 })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </Field>

                    <Field>
                      <FieldLabel>慢请求阈值 (毫秒)</FieldLabel>
                      <Input
                        type="number"
                        value={logConfigForm.body_record_threshold_ms || 500}
                        onChange={(e) => setLogConfigForm({ ...logConfigForm, body_record_threshold_ms: parseInt(e.target.value) || 0 })}
                        placeholder="500"
                        min="0"
                      />
                      <p className="text-sm text-slate-500 mt-1">
                        只有耗时超过此阈值的请求才会记录请求体（默认 500ms）
                      </p>
                    </Field>

                    <Field>
                      <FieldLabel>最大请求体大小 (字节)</FieldLabel>
                      <Input
                        type="number"
                        value={logConfigForm.max_body_size || 2048}
                        onChange={(e) => setLogConfigForm({ ...logConfigForm, max_body_size: parseInt(e.target.value) || 0 })}
                        placeholder="2048"
                        min="0"
                      />
                      <p className="text-sm text-slate-500 mt-1">
                        记录的请求体最大大小，超过部分会被截断（默认 2048 字节）
                      </p>
                    </Field>

                    <Field>
                      <div className="flex items-center justify-between">
                        <div>
                          <FieldLabel>仅记录错误</FieldLabel>
                          <p className="text-sm text-slate-500 mt-1">是否只记录错误请求的 body</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={logConfigForm.only_error === 1}
                            onChange={(e) => setLogConfigForm({ ...logConfigForm, only_error: e.target.checked ? 1 : 0 })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                        </label>
                      </div>
                    </Field>

                    <div className="flex gap-2 pt-4">
                      <Button type="submit">保存配置</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (logConfig) {
                            setLogConfigForm({
                              enable_body: logConfig.enable_body,
                              body_record_threshold_ms: logConfig.body_record_threshold_ms,
                              max_body_size: logConfig.max_body_size,
                              only_error: logConfig.only_error,
                            })
                          }
                        }}
                      >
                        取消
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {/* 危险区域 */}
              <Card className="border-red-200 dark:border-red-900">
                <CardHeader>
                  <CardTitle className="text-red-600">危险区域</CardTitle>
                  <CardDescription>这些操作不可逆，请谨慎操作</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteProject}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    删除项目
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* API Key 创建对话框 */}
        <Dialog open={apiKeyDialogOpen} onOpenChange={handleApiKeyDialogOpenChange}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>创建 API Key</DialogTitle>
              <DialogDescription>为项目创建新的 API 访问凭证</DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <form onSubmit={handleCreateApiKey} className="space-y-4">
                <Field>
                  <FieldLabel>名称</FieldLabel>
                  <Input
                    value={apiKeyForm.name}
                    onChange={(e) => setApiKeyForm({ ...apiKeyForm, name: e.target.value })}
                    placeholder="例如: 客户A-生产环境"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>App Key</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      value={apiKeyForm.app_key}
                      onChange={(e) => setApiKeyForm({ ...apiKeyForm, app_key: e.target.value })}
                      placeholder="自动生成或手动输入"
                      required
                    />
                    <InputGroupAddon align="inline-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleGenerateApiKey}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </InputGroupAddon>
                  </InputGroup>
                </Field>
                <Field>
                  <FieldLabel>分组</FieldLabel>
                  <Select
                    value={groups.find(g => g.id === apiKeyForm.group_id)}
                    onValueChange={(value) => {
                      if (value && typeof value === 'object' && 'id' in value) {
                        setApiKeyForm({ ...apiKeyForm, group_id: value.id })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择分组">
                        {(value) => value && typeof value === 'object' && 'name' in value ? value.name : '选择分组'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </Field>
                <Button type="submit" className="w-full">创建</Button>
              </form>
            </DialogPanel>
          </DialogPopup>
        </Dialog>

        {/* API Key 编辑对话框 */}
        <Dialog open={apiKeyEditDialogOpen} onOpenChange={setApiKeyEditDialogOpen}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>编辑 API Key</DialogTitle>
              <DialogDescription>修改 API Key 信息</DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <form onSubmit={handleUpdateApiKey} className="space-y-4">
                <Field>
                  <FieldLabel>名称</FieldLabel>
                  <Input
                    value={apiKeyForm.name}
                    onChange={(e) => setApiKeyForm({ ...apiKeyForm, name: e.target.value })}
                    placeholder="例如: 客户A-生产环境"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>App Key</FieldLabel>
                  <Input
                    value={apiKeyForm.app_key}
                    onChange={(e) => setApiKeyForm({ ...apiKeyForm, app_key: e.target.value })}
                    placeholder="App Key"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>分组</FieldLabel>
                  <Select
                    value={groups.find(g => g.id === apiKeyForm.group_id)}
                    onValueChange={(value) => {
                      if (value && typeof value === 'object' && 'id' in value) {
                        setApiKeyForm({ ...apiKeyForm, group_id: value.id })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择分组">
                        {(value) => value && typeof value === 'object' && 'name' in value ? value.name : '选择分组'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </Field>
                <Button type="submit" className="w-full">保存</Button>
              </form>
            </DialogPanel>
          </DialogPopup>
        </Dialog>

        {/* 分组创建对话框 */}
        <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>创建分组</DialogTitle>
              <DialogDescription>为项目创建新的分组</DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <form onSubmit={handleCreateGroup} className="space-y-4">
                <Field>
                  <FieldLabel>分组名称</FieldLabel>
                  <Input
                    value={groupForm.name}
                    onChange={(e) => setGroupForm({ name: e.target.value })}
                    placeholder="例如: premium"
                    required
                  />
                </Field>
                <Button type="submit" className="w-full">创建</Button>
              </form>
            </DialogPanel>
          </DialogPopup>
        </Dialog>

        {/* 上游创建对话框 */}
        <Dialog open={upstreamDialogOpen} onOpenChange={setUpstreamDialogOpen}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>添加上游服务</DialogTitle>
              <DialogDescription>配置新的上游服务地址</DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <form onSubmit={handleCreateUpstream} className="space-y-4">
                <Field>
                  <FieldLabel>目标 URL</FieldLabel>
                  <Input
                    value={upstreamForm.target_url}
                    onChange={(e) => setUpstreamForm({ ...upstreamForm, target_url: e.target.value })}
                    placeholder="https://api.example.com"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>路径前缀</FieldLabel>
                  <Input
                    value={upstreamForm.path_prefix}
                    onChange={(e) => setUpstreamForm({ ...upstreamForm, path_prefix: e.target.value })}
                    placeholder="/api/v1"
                  />
                </Field>
                <Field>
                  <FieldLabel>超时时间 (毫秒)</FieldLabel>
                  <Input
                    type="number"
                    value={upstreamForm.timeout}
                    onChange={(e) => setUpstreamForm({ ...upstreamForm, timeout: parseInt(e.target.value) })}
                    placeholder="5000"
                    required
                  />
                </Field>
                <Button type="submit" className="w-full">添加</Button>
              </form>
            </DialogPanel>
          </DialogPopup>
        </Dialog>

        {/* 上游编辑对话框 */}
        <Dialog open={upstreamEditDialogOpen} onOpenChange={setUpstreamEditDialogOpen}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>编辑上游服务</DialogTitle>
              <DialogDescription>修改上游服务配置</DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <form onSubmit={handleUpdateUpstream} className="space-y-4">
                <Field>
                  <FieldLabel>目标 URL</FieldLabel>
                  <Input
                    value={upstreamForm.target_url}
                    onChange={(e) => setUpstreamForm({ ...upstreamForm, target_url: e.target.value })}
                    placeholder="https://api.example.com"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>路径前缀</FieldLabel>
                  <Input
                    value={upstreamForm.path_prefix}
                    onChange={(e) => setUpstreamForm({ ...upstreamForm, path_prefix: e.target.value })}
                    placeholder="/api/v1"
                  />
                </Field>
                <Field>
                  <FieldLabel>超时时间 (毫秒)</FieldLabel>
                  <Input
                    type="number"
                    value={upstreamForm.timeout}
                    onChange={(e) => setUpstreamForm({ ...upstreamForm, timeout: parseInt(e.target.value) })}
                    placeholder="5000"
                    required
                  />
                </Field>
                <Button type="submit" className="w-full">保存</Button>
              </form>
            </DialogPanel>
          </DialogPopup>
        </Dialog>

        {/* 限流配置对话框 */}
        <Dialog open={rateLimitDialogOpen} onOpenChange={setRateLimitDialogOpen}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>配置限流</DialogTitle>
              <DialogDescription>
                为分组 {selectedGroupForRateLimit?.name} 配置限流规则
              </DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <form onSubmit={handleSaveRateLimit} className="space-y-4">
                <Field>
                  <FieldLabel>限流模式</FieldLabel>
                  <Select
                    value={rateLimitForm.mode}
                    onValueChange={(value) => {
                      if (value === 'simple' || value === 'multi') {
                        setRateLimitForm({ ...rateLimitForm, mode: value })
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {rateLimitForm.mode === 'simple' ? '简单模式 (仅 QPS)' : '多窗口模式 (QPS + RPM + RPH)'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="simple">简单模式 (仅 QPS)</SelectItem>
                      <SelectItem value="multi">多窗口模式 (QPS + RPM + RPH)</SelectItem>
                    </SelectPopup>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>每秒请求数 (QPS)</FieldLabel>
                  <Input
                    type="number"
                    value={rateLimitForm.requests_per_second}
                    onChange={(e) => setRateLimitForm({ ...rateLimitForm, requests_per_second: parseInt(e.target.value) })}
                    required
                  />
                </Field>
                {rateLimitForm.mode === 'multi' && (
                  <>
                    <Field>
                      <FieldLabel>每分钟请求数 (RPM)</FieldLabel>
                      <Input
                        type="number"
                        value={rateLimitForm.requests_per_minute}
                        onChange={(e) => setRateLimitForm({ ...rateLimitForm, requests_per_minute: parseInt(e.target.value) })}
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel>每小时请求数 (RPH)</FieldLabel>
                      <Input
                        type="number"
                        value={rateLimitForm.requests_per_hour}
                        onChange={(e) => setRateLimitForm({ ...rateLimitForm, requests_per_hour: parseInt(e.target.value) })}
                        required
                      />
                    </Field>
                  </>
                )}
                <Field>
                  <FieldLabel>突发容量 (Burst)</FieldLabel>
                  <Input
                    type="number"
                    value={rateLimitForm.burst}
                    onChange={(e) => setRateLimitForm({ ...rateLimitForm, burst: parseInt(e.target.value) })}
                    required
                  />
                </Field>
                <Button type="submit" className="w-full">保存配置</Button>
              </form>
            </DialogPanel>
          </DialogPopup>
        </Dialog>

        {/* 熔断配置对话框 */}
        <Dialog open={circuitBreakerDialogOpen} onOpenChange={setCircuitBreakerDialogOpen}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>配置熔断</DialogTitle>
              <DialogDescription>
                为分组 {selectedGroupForCircuitBreaker?.name} 配置熔断规则
              </DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <form onSubmit={handleSaveCircuitBreaker} className="space-y-4">
                <Field>
                  <FieldLabel>最大失败次数</FieldLabel>
                  <Input
                    type="number"
                    value={circuitBreakerForm.max_failures}
                    onChange={(e) => setCircuitBreakerForm({ ...circuitBreakerForm, max_failures: parseInt(e.target.value) })}
                    placeholder="5"
                    required
                  />
                  <p className="text-sm text-slate-500 mt-1">连续失败多少次后触发熔断</p>
                </Field>
                <Field>
                  <FieldLabel>重置超时 (秒)</FieldLabel>
                  <Input
                    type="number"
                    value={circuitBreakerForm.reset_timeout}
                    onChange={(e) => setCircuitBreakerForm({ ...circuitBreakerForm, reset_timeout: parseInt(e.target.value) })}
                    placeholder="30"
                    required
                  />
                  <p className="text-sm text-slate-500 mt-1">熔断后多久尝试恢复</p>
                </Field>
                <Field>
                  <FieldLabel>半开状态测试请求数</FieldLabel>
                  <Input
                    type="number"
                    value={circuitBreakerForm.half_open_max_test}
                    onChange={(e) => setCircuitBreakerForm({ ...circuitBreakerForm, half_open_max_test: parseInt(e.target.value) })}
                    placeholder="1"
                    required
                  />
                  <p className="text-sm text-slate-500 mt-1">半开状态下允许通过的测试请求数</p>
                </Field>
                <Button type="submit" className="w-full">保存配置</Button>
              </form>
            </DialogPanel>
          </DialogPopup>
        </Dialog>
      </div>
    </div>
  )
}

// 内部组件:项目列表页面
function ProjectsListPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null)
  const [todayPV, setTodayPV] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  })

  useEffect(() => {
    loadProjects()
    loadTodayStats()
    // 每30秒刷新一次今日统计
    const interval = setInterval(loadTodayStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadTodayStats = async () => {
    try {
      const stats = await api.getTodayGlobalStats()
      setTodayPV(stats.pv)
    } catch (error) {
      console.error('加载今日统计失败:', error)
    }
  }

  const loadProjects = async () => {
    try {
      const data = await api.getProjects()
      setProjects(data)
    } catch (error) {
      console.error('Failed to load projects:', error)
      // 模拟数据
      setProjects([
        {
          id: 1,
          name: 'ES Proxy',
          description: 'Elasticsearch 代理项目',
          base_url: '',
          created_at: '2026-04-23T10:00:00Z',
        },
        {
          id: 2,
          name: 'API Gateway',
          description: '通用API网关',
          base_url: '',
          created_at: '2026-04-23T10:00:00Z',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleCreateProject = async () => {
    if (!formData.name.trim()) {
      alert('请输入项目名称')
      return
    }

    setCreating(true)
    try {
      const newProject = await api.createProject({
        name: formData.name,
        description: formData.description
      })
      setProjects([...projects, newProject])
      setShowCreateDialog(false)
      setFormData({ name: '', description: '' })
    } catch (error: any) {
      console.error('Failed to create project:', error)
      alert(error.message || '创建项目失败')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteProject = async (projectId: number) => {
    setProjectToDelete(projectId)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (projectToDelete === null) return

    try {
      await api.deleteProject(projectToDelete)
      setProjects(projects.filter(p => p.id !== projectToDelete))
      setDeleteDialogOpen(false)
      setProjectToDelete(null)
    } catch (error) {
      console.error('Failed to delete project:', error)
      alert('删除项目失败')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-5 w-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              项目管理
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              管理您的项目和上游服务配置
            </p>
          </div>
          <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            创建项目
          </Button>
        </div>

        {/* Backend Status Warning */}
        <BackendStatus />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>总项目数</CardDescription>
              <CardTitle className="text-2xl">{projects.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>活跃项目</CardDescription>
              <CardTitle className="text-2xl">{projects.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>今日请求</CardDescription>
              <CardTitle className="text-2xl">{todayPV.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card 
              key={project.id} 
              className="border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <CardHeader>
                <div className="flex items-start justify-between mb-2">
                  <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <Badge variant="success">活跃</Badge>
                </div>
                <CardTitle className="text-xl">{project.name}</CardTitle>
                <CardDescription className="text-slate-600 dark:text-slate-400">
                  {project.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Calendar className="h-4 w-4" />
                    <span>创建于 {new Date(project.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1 gap-1"
                      onClick={() => router.push(`/projects?id=${project.id}`)}
                    >
                      <ExternalLink className="h-3 w-3" />
                      查看详情
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1 text-red-600 hover:text-red-700"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteProject(project.id)
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {projects.length === 0 && (
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Package className="h-16 w-16 text-slate-300 dark:text-slate-700 mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                暂无项目
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                创建您的第一个项目开始使用
              </p>
              <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4" />
                创建项目
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Project Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogPopup>
          <DialogHeader>
            <DialogTitle>创建新项目</DialogTitle>
            <DialogDescription>
              创建一个新的API网关项目
            </DialogDescription>
          </DialogHeader>
          <DialogPanel className="space-y-4">
            <Field>
              <FieldLabel htmlFor="name">项目名称</FieldLabel>
              <Input
                id="name"
                placeholder="例如: ES Proxy"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">项目描述</FieldLabel>
              <Textarea
                id="description"
                placeholder="例如: Elasticsearch 代理项目"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </Field>
          </DialogPanel>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setFormData({ name: '', description: '' })
              }}
            >
              取消
            </Button>
            <Button onClick={handleCreateProject} disabled={creating}>
              {creating ? '创建中...' : '创建'}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个项目吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setProjectToDelete(null)
              }}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
            >
              删除
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </div>
  )
}

// 路由包装组件：检查查询参数并决定显示列表还是详情
function ProjectsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('id')

  if (projectId) {
    const id = parseInt(projectId)
    if (!isNaN(id)) {
      return (
        <ProjectDetailView
          projectId={id}
          onBack={() => router.push('/projects')}
        />
      )
    }
  }

  return <ProjectsListPage />
}

// 导出组件：使用 Suspense 包装以支持 useSearchParams
export default function ProjectsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-5 w-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    }>
      <ProjectsPageContent />
    </Suspense>
  )
}
