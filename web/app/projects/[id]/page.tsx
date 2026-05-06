'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api, Project, ApiKey, Group, Upstream, LogConfig } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogPopup, DialogDescription, DialogHeader, DialogPanel, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Field, FieldLabel } from '@/components/ui/field'
import { toastManager } from '@/components/ui/toast'
import { ArrowLeft, Key, Plus, Copy, Trash2, Users, Settings, Activity, RefreshCw, Edit, Shield, Gauge } from 'lucide-react'

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = parseInt(params.id as string)

  const [project, setProject] = useState<Project | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [upstreams, setUpstreams] = useState<Upstream[]>([])
  const [loading, setLoading] = useState(true)
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
    mode: 'simple' as 'simple' | 'multi', // 使用字符串而不是数字
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

  useEffect(() => {
    loadProjectData()
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
      // 加载项目信息
      const projects = await api.getProjects()
      const currentProject = projects.find(p => p.id === projectId)
      setProject(currentProject || null)

      // 加载该项目的 API Keys
      const allKeys = await api.getApiKeys()
      setApiKeys(allKeys.filter(k => k.project_id === projectId))

      // 加载分组 - 如果API不可用则使用默认数据
      try {
        const projectGroups = await api.getGroups(projectId)
        setGroups(projectGroups)
      } catch (error) {
        console.warn('Groups API not available, using default data:', error)
        setGroups([
          { id: 1, name: 'default', project_id: projectId },
          { id: 2, name: 'premium', project_id: projectId },
        ])
      }

      // 加载上游配置 - 如果API不可用则使用默认数据
      try {
        const projectUpstreams = await api.getUpstreams(projectId)
        setUpstreams(projectUpstreams)
      } catch (error) {
        console.warn('Upstreams API not available, using default data:', error)
        setUpstreams([
          {
            id: 1,
            project_id: projectId,
            target_url: 'http://localhost:9200',
            path_prefix: '',
            timeout: 5000,
            created_at: new Date().toISOString(),
          },
        ])
      }

      // 加载日志配置
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
        console.warn('Log config not found, using defaults:', error)
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

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 验证分组必选
    if (apiKeyForm.group_id === 0) {
      toastManager.add({
        type: 'error',
        title: '请选择分组',
        description: '分组是必选项',
      })
      return
    }
    
    try {
      await api.createApiKey({
        ...apiKeyForm,
        project_id: projectId,
      })
      setApiKeyDialogOpen(false)
      setApiKeyForm({ name: '', app_key: '', group_id: 0, status: 'active' })
      loadProjectData()
      toastManager.add({
        type: 'success',
        title: 'API Key 创建成功',
        description: `已成功创建 ${apiKeyForm.name}`,
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
    
    // 验证分组必选
    if (apiKeyForm.group_id === 0) {
      toastManager.add({
        type: 'error',
        title: '请选择分组',
        description: '分组是必选项',
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
        description: 'API Key 信息已成功更新',
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
        description: `API Key 已${actionText}`,
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
    const newKey = generateApiKey()
    setApiKeyForm({ ...apiKeyForm, app_key: newKey })
  }

  const handleApiKeyDialogOpenChange = (open: boolean) => {
    setApiKeyDialogOpen(open)
    if (open) {
      // 打开对话框时，自动生成 API Key 并选择 default 分组
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
        description: `已成功创建分组 ${groupForm.name}`,
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
    if (!confirm('确定要删除这个分组吗? 这将只删除该项目下的分组。')) return
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
        description: `已成功添加上游 ${upstreamForm.target_url}`,
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
    if (!confirm('确定要删除这个上游配置吗? 这将只删除该项目下的上游。')) return
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
        description: '上游配置已成功更新',
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
    // 从后端加载该分组的限流配置
    try {
      const config = await api.getRateLimitConfig(group.id)
      console.log('Loaded rate limit config:', config)
      
      // 将后端的 0/1 转换为 'simple'/'multi'
      const mode = config.enable_multi_window === 1 ? 'multi' : 'simple'
      
      setRateLimitForm({
        mode: mode,
        requests_per_second: config.qps,
        // 只有在多窗口模式下才使用后端的 RPM/RPH
        requests_per_minute: mode === 'multi' ? config.rpm : config.qps * 60,
        requests_per_hour: mode === 'multi' ? config.rph : config.qps * 3600,
        burst: config.burst,
      })
    } catch (error) {
      // 如果没有配置,使用默认值
      console.log('No rate limit config found, using defaults:', error)
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
      // 将 'simple'/'multi' 转换为后端的 0/1
      const enable_multi_window = rateLimitForm.mode === 'multi' ? 1 : 0
      
      const payload: any = {
        group_id: selectedGroupForRateLimit.id,
        qps: rateLimitForm.requests_per_second,
        burst: rateLimitForm.burst,
        enable_multi_window: enable_multi_window,
      }
      
      // 只有启用多窗口模式时才传递 RPM 和 RPH
      if (rateLimitForm.mode === 'multi') {
        payload.rpm = rateLimitForm.requests_per_minute
        payload.rph = rateLimitForm.requests_per_hour
      } else {
        // 简单模式下明确设置为 0
        payload.rpm = 0
        payload.rph = 0
      }
      
      console.log('Saving rate limit config:', payload)
      
      await api.updateRateLimitConfig(selectedGroupForRateLimit.id, payload)
      
      // 触发配置重载
      await api.reload()
      
      toastManager.add({
        type: 'success',
        title: '限流配置已保存',
        description: `已为分组 "${selectedGroupForRateLimit.name}" 配置限流规则 (${rateLimitForm.mode === 'multi' ? '多窗口模式' : '简单模式'})`,
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
    // 从后端加载该分组的熔断配置
    try {
      const config = await api.getCircuitBreakerConfig(group.id)
      console.log('Loaded circuit breaker config:', config)
      
      setCircuitBreakerForm({
        max_failures: config.max_failures,
        reset_timeout: config.reset_timeout,
        half_open_max_test: config.half_open_max_test || 1,
      })
    } catch (error) {
      // 如果没有配置,使用默认值
      console.log('No circuit breaker config found, using defaults:', error)
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
      
      console.log('Saving circuit breaker config:', payload)
      
      await api.updateCircuitBreakerConfig(selectedGroupForCircuitBreaker.id, payload)
      
      // 触发配置重载
      await api.reload()
      
      toastManager.add({
        type: 'success',
        title: '熔断配置已保存',
        description: `已为分组 "${selectedGroupForCircuitBreaker.name}" 配置熔断规则`,
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
        description: '项目信息已成功更新',
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
      
      // 触发配置重载
      await api.reload()
      
      // 重新加载日志配置
      const config = await api.getLogConfig(projectId)
      setLogConfig(config)
      
      toastManager.add({
        type: 'success',
        title: '日志配置已保存',
        description: '日志配置已成功更新',
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
    if (!confirm(`确定要删除项目 "${project?.name}" 吗？此操作不可逆！`)) return
    try {
      await api.deleteProject(projectId)
      toastManager.add({
        type: 'success',
        title: '项目已删除',
      })
      router.push('/projects')
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="h-5 w-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-4">项目不存在</h2>
          <Button onClick={() => router.push('/projects')}>返回项目列表</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/projects')}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回项目列表
          </Button>
          <div className="flex justify-between items-start">
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
        </div>

        {/* Stats */}
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
              <CardTitle className="text-2xl">3,456</CardTitle>
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

        {/* Tabs */}
        <Tabs defaultValue="upstream" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upstream">上游配置</TabsTrigger>
            <TabsTrigger value="groups">分组管理</TabsTrigger>
            <TabsTrigger value="api-keys">API Keys</TabsTrigger>
            <TabsTrigger value="settings">项目设置</TabsTrigger>
          </TabsList>

          {/* Upstream Tab */}
          <TabsContent value="upstream" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                上游服务配置
              </h2>
              <Dialog open={upstreamDialogOpen} onOpenChange={setUpstreamDialogOpen}>
                <DialogTrigger render={<Button className="gap-2" />}>
                  <Plus className="h-4 w-4" />
                  添加上游
                </DialogTrigger>
                <DialogPopup>
                  <DialogHeader>
                    <DialogTitle>添加上游服务</DialogTitle>
                    <DialogDescription>
                      为项目 "{project.name}" 配置新的上游服务地址
                    </DialogDescription>
                  </DialogHeader>
                  <DialogPanel>
                    <form onSubmit={handleCreateUpstream} className="space-y-4">
                      <Field>
                        <FieldLabel>目标地址</FieldLabel>
                        <Input
                          type="url"
                          value={upstreamForm.target_url}
                          onChange={(e) => setUpstreamForm({ ...upstreamForm, target_url: e.target.value })}
                          placeholder="例如: http://localhost:9200"
                          required
                        />
                      </Field>
                      <Field>
                        <FieldLabel>路径前缀</FieldLabel>
                        <Input
                          type="text"
                          value={upstreamForm.path_prefix}
                          onChange={(e) => setUpstreamForm({ ...upstreamForm, path_prefix: e.target.value })}
                          placeholder="例如: /api/v1 (可选)"
                        />
                      </Field>
                      <Field>
                        <FieldLabel>超时时间 (毫秒)</FieldLabel>
                        <Input
                          type="number"
                          value={upstreamForm.timeout}
                          onChange={(e) => setUpstreamForm({ ...upstreamForm, timeout: parseInt(e.target.value) })}
                          placeholder="5000"
                          min="100"
                          required
                        />
                      </Field>
                      <Button type="submit" className="w-full">
                        添加上游
                      </Button>
                    </form>
                  </DialogPanel>
                </DialogPopup>
              </Dialog>
            </div>

            {upstreams.length === 0 ? (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="py-16">
                  <div className="text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                      <Settings className="h-6 w-6 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                      暂无上游配置
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                      添加上游服务地址以开始代理请求
                    </p>
                    <Button onClick={() => setUpstreamDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      添加第一个上游
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>目标地址</TableHead>
                        <TableHead>路径前缀</TableHead>
                        <TableHead>超时时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upstreams.map((upstream) => (
                        <TableRow key={upstream.id}>
                          <TableCell className="font-medium">{upstream.target_url}</TableCell>
                          <TableCell>
                            <code className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm">
                              {upstream.path_prefix || '/'}
                            </code>
                          </TableCell>
                          <TableCell>{upstream.timeout}ms</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleOpenUpstreamEditDialog(upstream)}
                              >
                                编辑
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteUpstream(upstream.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                分组管理
              </h2>
              <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
                <DialogTrigger render={<Button className="gap-2" />}>
                  <Plus className="h-4 w-4" />
                  创建分组
                </DialogTrigger>
                <DialogPopup>
                  <DialogHeader>
                    <DialogTitle>创建新分组</DialogTitle>
                    <DialogDescription>
                      为项目 "{project.name}" 创建新的 API Key 分组
                    </DialogDescription>
                  </DialogHeader>
                  <DialogPanel>
                    <form onSubmit={handleCreateGroup} className="space-y-4">
                      <Field>
                        <FieldLabel>分组名称</FieldLabel>
                        <Input
                          type="text"
                          value={groupForm.name}
                          onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                          placeholder="例如: premium, enterprise"
                          required
                        />
                      </Field>
                      <Button type="submit" className="w-full">
                        创建分组
                      </Button>
                    </form>
                  </DialogPanel>
                </DialogPopup>
              </Dialog>
            </div>

            {groups.length === 0 ? (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="py-16">
                  <div className="text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                      <Users className="h-6 w-6 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                      暂无分组
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                      创建分组来管理不同的 API Key 和限流策略
                    </p>
                    <Button onClick={() => setGroupDialogOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      创建第一个分组
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
                          onClick={() => handleDeleteGroup(group.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                API Keys 管理
              </h2>
              <Dialog open={apiKeyDialogOpen} onOpenChange={handleApiKeyDialogOpenChange}>
                <DialogTrigger render={<Button className="gap-2" />}>
                  <Plus className="h-4 w-4" />
                  创建 API Key
                </DialogTrigger>
                <DialogPopup>
                  <DialogHeader>
                    <DialogTitle>创建新的 API Key</DialogTitle>
                    <DialogDescription>
                      为项目 "{project.name}" 创建新的 API 访问凭证
                    </DialogDescription>
                  </DialogHeader>
                  <DialogPanel>
                    <form onSubmit={handleCreateApiKey} className="space-y-4">
                      <Field>
                        <FieldLabel>名称</FieldLabel>
                        <Input
                          type="text"
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
                            type="text"
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
                        <FieldLabel>所属分组</FieldLabel>
                        <Select
                          items={[{ label: '选择分组', value: 0 }, ...groups.map(g => ({ label: g.name, value: g.id }))]}
                          value={{ label: groups.find(g => g.id === apiKeyForm.group_id)?.name || '选择分组', value: apiKeyForm.group_id }}
                          onValueChange={(item) => item && setApiKeyForm({ ...apiKeyForm, group_id: item.value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="选择分组" />
                          </SelectTrigger>
                          <SelectPopup>
                            <SelectItem value={{ label: '选择分组', value: 0 }}>选择分组</SelectItem>
                            {groups.map(group => (
                              <SelectItem key={group.id} value={{ label: group.name, value: group.id }}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectPopup>
                        </Select>
                      </Field>
                      <Button type="submit" className="w-full">
                        创建 API Key
                      </Button>
                    </form>
                  </DialogPanel>
                </DialogPopup>
              </Dialog>
            </div>

            {apiKeys.length === 0 ? (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="py-16">
                  <div className="text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                      <Key className="h-6 w-6 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                      暂无 API Keys
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                      创建 API Key 以开始使用代理服务
                    </p>
                    <Button onClick={() => handleApiKeyDialogOpenChange(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      创建第一个 API Key
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名称</TableHead>
                        <TableHead>App Key</TableHead>
                        <TableHead>分组</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>创建时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell className="font-medium">{key.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-sm">
                                {key.app_key}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(key.app_key)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {groups.find(g => g.id === key.group_id)?.name || '未知'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={key.status === 'active' ? 'success' : 'secondary'}>
                              {key.status === 'active' ? '活跃' : '禁用'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(key.created_at).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleApiKeyStatus(key)}
                                className={key.status === 'active' ? 'text-orange-600 hover:text-orange-700' : 'text-green-600 hover:text-green-700'}
                                title={key.status === 'active' ? '禁用' : '启用'}
                              >
                                {key.status === 'active' ? (
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                  </svg>
                                ) : (
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenApiKeyEditDialog(key)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteApiKey(key.id)}
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
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader>
                <CardTitle>项目设置</CardTitle>
                <CardDescription>管理项目的基本信息和配置</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProject} className="space-y-4">
                  <Field>
                    <FieldLabel>项目名称</FieldLabel>
                    <Input 
                      type="text" 
                      value={projectForm.name}
                      onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                      placeholder="输入项目名称"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel>项目描述</FieldLabel>
                    <Input 
                      type="text" 
                      value={projectForm.description}
                      onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                      placeholder="输入项目描述"
                    />
                  </Field>
                  <div className="flex gap-2 pt-4">
                    <Button type="submit">保存更改</Button>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        if (project) {
                          setProjectForm({
                            name: project.name,
                            description: project.description,
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

            <Card className="border-slate-200 dark:border-slate-800">
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
                      value={logConfigForm.body_record_threshold_ms}
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
                      value={logConfigForm.max_body_size}
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
                        <p className="text-sm text-slate-500 mt-1">只记录状态码 &gt;= 400 的请求</p>
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
                    <Button type="submit">保存日志配置</Button>
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

            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400">危险区域</CardTitle>
                <CardDescription>这些操作不可逆，请谨慎操作</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive"
                  onClick={handleDeleteProject}
                >
                  删除项目
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Rate Limit Dialog */}
        <Dialog open={rateLimitDialogOpen} onOpenChange={setRateLimitDialogOpen}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>配置限流规则</DialogTitle>
              <DialogDescription>
                为分组 "{selectedGroupForRateLimit?.name}" 配置访问频率限制
              </DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <form onSubmit={handleSaveRateLimit} className="space-y-4">
                <Field>
                  <FieldLabel>限流模式</FieldLabel>
                  <Select
                    value={rateLimitForm.mode}
                    onValueChange={(value) => setRateLimitForm({ ...rateLimitForm, mode: value as 'simple' | 'multi' })}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {rateLimitForm.mode === 'simple' 
                          ? '简单模式 (仅 QPS + Burst)' 
                          : '多窗口模式 (支持分钟/小时限流)'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="simple">简单模式 (仅 QPS + Burst)</SelectItem>
                      <SelectItem value="multi">多窗口模式 (支持分钟/小时限流)</SelectItem>
                    </SelectPopup>
                  </Select>
                  <p className="text-sm text-gray-500 mt-1">
                    {rateLimitForm.mode === 'simple' 
                      ? '简单模式使用令牌桶算法,性能更好,内存占用更小'
                      : '多窗口模式可独立控制每秒/分钟/小时的请求数,更灵活但占用更多内存'}
                  </p>
                </Field>

                <Field>
                  <FieldLabel>每秒请求数 (QPS)</FieldLabel>
                  <Input
                    type="number"
                    value={rateLimitForm.requests_per_second}
                    onChange={(e) => setRateLimitForm({ ...rateLimitForm, requests_per_second: parseInt(e.target.value) || 0 })}
                    min="1"
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
                        onChange={(e) => setRateLimitForm({ ...rateLimitForm, requests_per_minute: parseInt(e.target.value) || 0 })}
                        min="1"
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel>每小时请求数 (RPH)</FieldLabel>
                      <Input
                        type="number"
                        value={rateLimitForm.requests_per_hour}
                        onChange={(e) => setRateLimitForm({ ...rateLimitForm, requests_per_hour: parseInt(e.target.value) || 0 })}
                        min="1"
                        required
                      />
                    </Field>
                  </>
                )}

                <Field>
                  <FieldLabel>突发流量 (Burst)</FieldLabel>
                  <Input
                    type="number"
                    value={rateLimitForm.burst}
                    onChange={(e) => setRateLimitForm({ ...rateLimitForm, burst: parseInt(e.target.value) || 0 })}
                    min="1"
                    required
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    保存配置
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setRateLimitDialogOpen(false)}
                  >
                    取消
                  </Button>
                </div>
              </form>
            </DialogPanel>
          </DialogPopup>
        </Dialog>

        {/* Circuit Breaker Dialog */}
        <Dialog open={circuitBreakerDialogOpen} onOpenChange={setCircuitBreakerDialogOpen}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>配置熔断规则</DialogTitle>
              <DialogDescription>
                为分组 "{selectedGroupForCircuitBreaker?.name}" 配置熔断保护策略
              </DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <form onSubmit={handleSaveCircuitBreaker} className="space-y-4">
                <Field>
                  <FieldLabel>最大失败次数</FieldLabel>
                  <Input
                    type="number"
                    value={circuitBreakerForm.max_failures}
                    onChange={(e) => setCircuitBreakerForm({ ...circuitBreakerForm, max_failures: parseInt(e.target.value) || 0 })}
                    min="1"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    连续失败达到此次数后触发熔断，停止转发请求
                  </p>
                </Field>

                <Field>
                  <FieldLabel>重置超时时间 (秒)</FieldLabel>
                  <Input
                    type="number"
                    value={circuitBreakerForm.reset_timeout}
                    onChange={(e) => setCircuitBreakerForm({ ...circuitBreakerForm, reset_timeout: parseInt(e.target.value) || 0 })}
                    min="1"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    熔断后等待此时间后尝试恢复，如果请求成功则关闭熔断
                  </p>
                </Field>

                <Field>
                  <FieldLabel>半开测试请求数</FieldLabel>
                  <Input
                    type="number"
                    value={circuitBreakerForm.half_open_max_test}
                    onChange={(e) => setCircuitBreakerForm({ ...circuitBreakerForm, half_open_max_test: parseInt(e.target.value) || 0 })}
                    min="1"
                    max="10"
                    required
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    半开状态下允许通过的测试请求数量，建议 1-3 个
                  </p>
                </Field>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    保存配置
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setCircuitBreakerDialogOpen(false)}
                  >
                    取消
                  </Button>
                </div>
              </form>
            </DialogPanel>
          </DialogPopup>
        </Dialog>

        {/* Upstream Edit Dialog */}
        <Dialog open={upstreamEditDialogOpen} onOpenChange={setUpstreamEditDialogOpen}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>编辑上游服务</DialogTitle>
              <DialogDescription>
                修改上游服务 "{selectedUpstreamForEdit?.target_url}" 的配置
              </DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <form onSubmit={handleUpdateUpstream} className="space-y-4">
                <Field>
                  <FieldLabel>目标地址</FieldLabel>
                  <Input
                    type="url"
                    value={upstreamForm.target_url}
                    onChange={(e) => setUpstreamForm({ ...upstreamForm, target_url: e.target.value })}
                    placeholder="例如: http://localhost:9200"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>路径前缀</FieldLabel>
                  <Input
                    type="text"
                    value={upstreamForm.path_prefix}
                    onChange={(e) => setUpstreamForm({ ...upstreamForm, path_prefix: e.target.value })}
                    placeholder="例如: /api/v1 (可选)"
                  />
                </Field>
                <Field>
                  <FieldLabel>超时时间 (毫秒)</FieldLabel>
                  <Input
                    type="number"
                    value={upstreamForm.timeout}
                    onChange={(e) => setUpstreamForm({ ...upstreamForm, timeout: parseInt(e.target.value) })}
                    placeholder="5000"
                    min="100"
                    required
                  />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    保存更改
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setUpstreamEditDialogOpen(false)
                      setSelectedUpstreamForEdit(null)
                      setUpstreamForm({ target_url: '', path_prefix: '', timeout: 5000 })
                    }}
                  >
                    取消
                  </Button>
                </div>
              </form>
            </DialogPanel>
          </DialogPopup>
        </Dialog>

        {/* API Key Edit Dialog */}
        <Dialog open={apiKeyEditDialogOpen} onOpenChange={setApiKeyEditDialogOpen}>
          <DialogPopup>
            <DialogHeader>
              <DialogTitle>编辑 API Key</DialogTitle>
              <DialogDescription>
                修改 API Key "{selectedApiKeyForEdit?.name}" 的信息
              </DialogDescription>
            </DialogHeader>
            <DialogPanel>
              <form onSubmit={handleUpdateApiKey} className="space-y-4">
                <Field>
                  <FieldLabel>名称</FieldLabel>
                  <Input
                    type="text"
                    value={apiKeyForm.name}
                    onChange={(e) => setApiKeyForm({ ...apiKeyForm, name: e.target.value })}
                    placeholder="例如: 客户A-生产环境"
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel>App Key</FieldLabel>
                  <Input
                    type="text"
                    value={apiKeyForm.app_key}
                    readOnly
                    className="bg-slate-50 dark:bg-slate-900 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">App Key 创建后不可修改</p>
                </Field>
                <Field>
                  <FieldLabel>所属分组</FieldLabel>
                  <Select
                    items={[{ label: '选择分组', value: 0 }, ...groups.map(g => ({ label: g.name, value: g.id }))]}
                    value={{ label: groups.find(g => g.id === apiKeyForm.group_id)?.name || '选择分组', value: apiKeyForm.group_id }}
                    onValueChange={(item) => item && setApiKeyForm({ ...apiKeyForm, group_id: item.value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择分组" />
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value={{ label: '选择分组', value: 0 }}>选择分组</SelectItem>
                      {groups.map(group => (
                        <SelectItem key={group.id} value={{ label: group.name, value: group.id }}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    保存更改
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setApiKeyEditDialogOpen(false)
                      setSelectedApiKeyForEdit(null)
                      setApiKeyForm({ name: '', app_key: '', group_id: 0, status: 'active' })
                    }}
                  >
                    取消
                  </Button>
                </div>
              </form>
            </DialogPanel>
          </DialogPopup>
        </Dialog>
      </div>
    </div>
  )
}
