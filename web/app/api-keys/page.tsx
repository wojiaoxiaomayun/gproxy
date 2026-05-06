'use client'

import { useEffect, useState } from 'react'
import { api, ApiKey, Project, Group } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BackendStatus } from '@/components/BackendStatus'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogPopup, DialogDescription, DialogHeader, DialogPanel, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Field, FieldLabel } from '@/components/ui/field'
import { toastManager } from '@/components/ui/toast'
import { Select, SelectTrigger, SelectValue, SelectPopup, SelectItem } from '@/components/ui/select'
import { Key, Plus, Copy, Trash2, RefreshCw } from 'lucide-react'

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    app_key: '',
    project_id: 0,
    group_id: 0,
    status: 'active',
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // 当项目改变时，加载对应的分组
    if (formData.project_id > 0) {
      loadGroups(formData.project_id)
    }
  }, [formData.project_id])

  const loadData = async () => {
    try {
      const [keysData, projectsData] = await Promise.all([
        api.getApiKeys(),
        api.getProjects(),
      ])
      setApiKeys(keysData)
      setProjects(projectsData)
      
      // 如果有项目，默认选择第一个项目
      if (projectsData.length > 0) {
        const firstProjectId = projectsData[0].id
        setFormData(prev => ({ ...prev, project_id: firstProjectId }))
        // 加载第一个项目的分组
        const groupsData = await api.getGroups(firstProjectId)
        setGroups(groupsData)
        // 查找 default 分组并设置为默认值
        const defaultGroup = groupsData.find(g => g.name.toLowerCase() === 'default')
        if (defaultGroup) {
          setFormData(prev => ({ ...prev, group_id: defaultGroup.id }))
        } else if (groupsData.length > 0) {
          setFormData(prev => ({ ...prev, group_id: groupsData[0].id }))
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      // 使用模拟数据
      setApiKeys([
        {
          id: 1,
          name: '测试账号-默认组',
          app_key: 'test-key-001',
          project_id: 1,
          group_id: 1,
          status: 'active',
          created_at: '2026-04-23T10:00:00Z',
        },
      ])
      setProjects([
        { id: 1, name: 'ES Proxy', description: 'Elasticsearch 代理项目', base_url: '', created_at: '' },
      ])
      setGroups([
        { id: 1, name: 'default', project_id: 1 },
      ])
      setFormData(prev => ({ ...prev, project_id: 1, group_id: 1 }))
    } finally {
      setLoading(false)
    }
  }

  const loadGroups = async (projectId: number) => {
    try {
      const groupsData = await api.getGroups(projectId)
      setGroups(groupsData)
      // 查找 default 分组并设置为默认值
      const defaultGroup = groupsData.find(g => g.name.toLowerCase() === 'default')
      if (defaultGroup) {
        setFormData(prev => ({ ...prev, group_id: defaultGroup.id }))
      } else if (groupsData.length > 0) {
        setFormData(prev => ({ ...prev, group_id: groupsData[0].id }))
      } else {
        setFormData(prev => ({ ...prev, group_id: 0 }))
      }
    } catch (error) {
      console.error('Failed to load groups:', error)
      setGroups([])
      setFormData(prev => ({ ...prev, group_id: 0 }))
    }
  }

  const loadApiKeys = async () => {
    try {
      const keys = await api.getApiKeys()
      setApiKeys(keys)
    } catch (error) {
      console.error('Failed to load API keys:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 验证必填字段
    if (!formData.name.trim()) {
      toastManager.add({
        type: 'error',
        title: '请输入名称',
      })
      return
    }
    
    if (!formData.app_key.trim()) {
      toastManager.add({
        type: 'error',
        title: '请输入或生成 App Key',
      })
      return
    }
    
    if (formData.project_id === 0) {
      toastManager.add({
        type: 'error',
        title: '请选择项目',
      })
      return
    }
    
    if (formData.group_id === 0) {
      toastManager.add({
        type: 'error',
        title: '请选择分组',
      })
      return
    }
    
    try {
      await api.createApiKey(formData)
      setDialogOpen(false)
      resetForm()
      loadApiKeys()
      toastManager.add({
        type: 'success',
        title: 'API Key 创建成功',
        description: `已成功创建 ${formData.name}`,
      })
    } catch (error) {
      toastManager.add({
        type: 'error',
        title: '创建失败',
        description: String(error),
      })
    }
  }

  const resetForm = () => {
    const firstProjectId = projects.length > 0 ? projects[0].id : 0
    const defaultGroup = groups.find(g => g.name.toLowerCase() === 'default')
    const defaultGroupId = defaultGroup ? defaultGroup.id : (groups.length > 0 ? groups[0].id : 0)
    
    setFormData({
      name: '',
      app_key: generateApiKey(),
      project_id: firstProjectId,
      group_id: defaultGroupId,
      status: 'active',
    })
  }

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open)
    if (open) {
      // 打开对话框时，自动生成 API Key 并设置默认值
      console.log('打开对话框 - projects:', projects)
      console.log('打开对话框 - groups:', groups)
      
      const firstProjectId = projects.length > 0 ? projects[0].id : 0
      const defaultGroup = groups.find(g => g.name.toLowerCase() === 'default')
      const defaultGroupId = defaultGroup ? defaultGroup.id : (groups.length > 0 ? groups[0].id : 0)
      
      const newApiKey = generateApiKey()
      console.log('生成的 API Key:', newApiKey)
      console.log('选中的项目 ID:', firstProjectId)
      console.log('选中的分组 ID:', defaultGroupId)
      
      setFormData({
        name: '',
        app_key: newApiKey,
        project_id: firstProjectId,
        group_id: defaultGroupId,
        status: 'active',
      })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个 API Key 吗？')) return
    try {
      await api.deleteApiKey(id)
      loadApiKeys()
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
    setFormData({ ...formData, app_key: newKey })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toastManager.add({
      type: 'success',
      title: '已复制到剪贴板',
    })
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">
              API Keys 管理
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              创建和管理 API 访问凭证
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger render={<Button className="gap-2" />}>
              <Plus className="h-4 w-4" />
              创建 API Key
            </DialogTrigger>
            <DialogPopup>
              <DialogHeader>
                <DialogTitle>创建新的 API Key</DialogTitle>
                <DialogDescription>
                  填写以下信息创建新的 API 访问凭证
                </DialogDescription>
              </DialogHeader>
              <DialogPanel>
                {projects.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                      还没有项目，请先创建项目
                    </p>
                    <Button onClick={() => window.location.href = '/projects'}>
                      前往创建项目
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                  <Field>
                    <FieldLabel>名称</FieldLabel>
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="例如: 客户A-生产环境"
                      required
                      autoFocus
                    />
                  </Field>
                  <Field>
                    <FieldLabel>App Key</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        type="text"
                        value={formData.app_key}
                        onChange={(e) => setFormData({ ...formData, app_key: e.target.value })}
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
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <FieldLabel>项目</FieldLabel>
                      <Select
                        value={formData.project_id.toString()}
                        onValueChange={(value) => {
                          if (value) {
                            const projectId = parseInt(value)
                            setFormData({ ...formData, project_id: projectId })
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择项目" />
                        </SelectTrigger>
                        <SelectPopup>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id.toString()}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectPopup>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel>分组</FieldLabel>
                      <Select
                        value={formData.group_id.toString()}
                        onValueChange={(value) => {
                          if (value) {
                            const groupId = parseInt(value)
                            setFormData({ ...formData, group_id: groupId })
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择分组" />
                        </SelectTrigger>
                        <SelectPopup>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id.toString()}>
                              {group.name}
                            </SelectItem>
                          ))}
                        </SelectPopup>
                      </Select>
                    </Field>
                  </div>
                  <Button type="submit" className="w-full">
                    创建 API Key
                  </Button>
                </form>
                )}
              </DialogPanel>
            </DialogPopup>
          </Dialog>
        </div>

        {/* Backend Status Warning */}
        <BackendStatus />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>总计</CardDescription>
              <CardTitle className="text-2xl">{apiKeys.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>活跃</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                {apiKeys.filter(k => k.status === 'active').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardDescription>今日请求</CardDescription>
              <CardTitle className="text-2xl">5,432</CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardDescription>平均 QPS</CardDescription>
              <CardTitle className="text-2xl">12.3</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* API Keys 列表 */}
        <Card className="border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys 列表
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>App Key</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>分组</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => {
                  const project = projects.find(p => p.id === key.project_id)
                  const group = groups.find(g => g.id === key.group_id)
                  
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {key.app_key}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(key.app_key)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{project?.name || `项目 ${key.project_id}`}</TableCell>
                      <TableCell>{group?.name || `分组 ${key.group_id}`}</TableCell>
                      <TableCell>
                        <Badge variant={key.status === 'active' ? 'success' : 'secondary'}>
                          {key.status === 'active' ? '活跃' : '禁用'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {new Date(key.created_at).toLocaleDateString('zh-CN')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(key.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
