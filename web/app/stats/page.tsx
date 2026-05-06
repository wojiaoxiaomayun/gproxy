"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { api } from "@/lib/api"

interface DailyStats {
  id: number
  stat_date: string
  type: string
  ref_id: number
  ref_key: string
  pv: number
  active_key_count: number
  created_at: string
  updated_at: string
}

interface Project {
  id: number
  name: string
  description: string
}

interface Group {
  id: number
  name: string
  project_id: number
}

interface ApiKey {
  id: number
  name: string
  app_key: string
  project_id: number
  group_id: number
}

export default function StatsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 全局统计
  const [globalStats, setGlobalStats] = useState<DailyStats[]>([])
  
  // 项目相关
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>("")
  const [projectStats, setProjectStats] = useState<DailyStats[]>([])
  
  // 分组相关
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string>("")
  const [groupStats, setGroupStats] = useState<DailyStats[]>([])
  
  // API Key 相关
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [selectedKey, setSelectedKey] = useState<string>("")
  const [keyStats, setKeyStats] = useState<DailyStats[]>([])
  
  // 天数选择
  const [days, setDays] = useState<number>(30)

  // 加载基础数据
  useEffect(() => {
    loadBaseData()
  }, [])

  // 加载全局统计
  useEffect(() => {
    loadGlobalStats()
  }, [days])

  // 加载项目统计
  useEffect(() => {
    if (selectedProject) {
      loadProjectStats(selectedProject)
    }
  }, [selectedProject, days])

  // 加载分组统计
  useEffect(() => {
    if (selectedGroup) {
      loadGroupStats(selectedGroup)
    }
  }, [selectedGroup, days])

  // 加载 API Key 统计
  useEffect(() => {
    if (selectedKey) {
      loadKeyStats(selectedKey)
    }
  }, [selectedKey, days])

  const loadBaseData = async () => {
    try {
      setLoading(true)
      const [projectsRes, groupsRes, keysRes] = await Promise.all([
        api.getProjects(),
        api.getGroups(),
        api.getApiKeys(),
      ])
      setProjects(projectsRes)
      setGroups(groupsRes)
      setApiKeys(keysRes)
      
      // 默认选择第一个项目
      if (projectsRes.length > 0) {
        setSelectedProject(projectsRes[0].id.toString())
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载数据失败")
    } finally {
      setLoading(false)
    }
  }

  const loadGlobalStats = async () => {
    try {
      const stats = await api.getDailyGlobalStats(days)
      setGlobalStats(stats.reverse()) // 按日期升序排列
    } catch (err) {
      console.error("加载全局统计失败:", err)
    }
  }

  const loadProjectStats = async (projectId: string) => {
    try {
      const stats = await api.getDailyProjectStats(projectId, days)
      setProjectStats(stats.reverse())
    } catch (err) {
      console.error("加载项目统计失败:", err)
    }
  }

  const loadGroupStats = async (groupId: string) => {
    try {
      const stats = await api.getDailyGroupStats(groupId, days)
      setGroupStats(stats.reverse())
    } catch (err) {
      console.error("加载分组统计失败:", err)
    }
  }

  const loadKeyStats = async (appKey: string) => {
    try {
      const stats = await api.getDailyKeyStats(appKey, days)
      setKeyStats(stats.reverse())
    } catch (err) {
      console.error("加载 API Key 统计失败:", err)
    }
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const formatDate = (dateStr: string) => {
    return dateStr
  }

  const calculateTotal = (stats: DailyStats[]) => {
    return stats.reduce((sum, stat) => sum + stat.pv, 0)
  }

  const calculateAverage = (stats: DailyStats[]) => {
    if (stats.length === 0) return 0
    return Math.round(calculateTotal(stats) / stats.length)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">统计数据</h1>
          <p className="text-muted-foreground mt-1">查看每日统计数据和趋势</p>
        </div>
        
        <Select value={days.toString()} onValueChange={(v) => v && setDays(parseInt(v))}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">最近 7 天</SelectItem>
            <SelectItem value="30">最近 30 天</SelectItem>
            <SelectItem value="60">最近 60 天</SelectItem>
            <SelectItem value="90">最近 90 天</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="global" className="space-y-4">
        <TabsList>
          <TabsTrigger value="global">全局统计</TabsTrigger>
          <TabsTrigger value="project">项目统计</TabsTrigger>
          <TabsTrigger value="group">分组统计</TabsTrigger>
          <TabsTrigger value="key">API Key 统计</TabsTrigger>
        </TabsList>

        {/* 全局统计 */}
        <TabsContent value="global" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">总请求数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(calculateTotal(globalStats))}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  最近 {days} 天
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">日均请求数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(calculateAverage(globalStats))}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  平均每天
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">统计天数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{globalStats.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  有数据的天数
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>每日请求趋势</CardTitle>
              <CardDescription>最近 {days} 天的请求量变化</CardDescription>
            </CardHeader>
            <CardContent>
              {globalStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">暂无数据</div>
              ) : (
                <div className="space-y-2">
                  {globalStats.map((stat) => (
                    <div key={stat.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium w-24">{formatDate(stat.stat_date)}</span>
                        <Badge variant="outline">{formatNumber(stat.pv)} 请求</Badge>
                        {stat.active_key_count > 0 && (
                          <Badge variant="secondary">{stat.active_key_count} 活跃 Key</Badge>
                        )}
                      </div>
                      <div className="w-64 bg-secondary h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-primary h-full"
                          style={{
                            width: `${(stat.pv / Math.max(...globalStats.map(s => s.pv))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 项目统计 */}
        <TabsContent value="project" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>选择项目</CardTitle>
              <CardDescription>查看指定项目的统计数据</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedProject} onValueChange={(v) => v && setSelectedProject(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedProject && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">总请求数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(calculateTotal(projectStats))}</div>
                    <p className="text-xs text-muted-foreground mt-1">最近 {days} 天</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">日均请求数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(calculateAverage(projectStats))}</div>
                    <p className="text-xs text-muted-foreground mt-1">平均每天</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">统计天数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{projectStats.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">有数据的天数</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>每日请求趋势</CardTitle>
                  <CardDescription>项目的每日请求量变化</CardDescription>
                </CardHeader>
                <CardContent>
                  {projectStats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">暂无数据</div>
                  ) : (
                    <div className="space-y-2">
                      {projectStats.map((stat) => (
                        <div key={stat.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-medium w-24">{formatDate(stat.stat_date)}</span>
                            <Badge variant="outline">{formatNumber(stat.pv)} 请求</Badge>
                            {stat.active_key_count > 0 && (
                              <Badge variant="secondary">{stat.active_key_count} 活跃 Key</Badge>
                            )}
                          </div>
                          <div className="w-64 bg-secondary h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-primary h-full"
                              style={{
                                width: `${(stat.pv / Math.max(...projectStats.map(s => s.pv))) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* 分组统计 */}
        <TabsContent value="group" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>选择分组</CardTitle>
              <CardDescription>查看指定分组的统计数据</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedGroup} onValueChange={(v) => v && setSelectedGroup(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择分组" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id.toString()}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedGroup && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">总请求数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(calculateTotal(groupStats))}</div>
                    <p className="text-xs text-muted-foreground mt-1">最近 {days} 天</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">日均请求数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(calculateAverage(groupStats))}</div>
                    <p className="text-xs text-muted-foreground mt-1">平均每天</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">统计天数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{groupStats.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">有数据的天数</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>每日请求趋势</CardTitle>
                  <CardDescription>分组的每日请求量变化</CardDescription>
                </CardHeader>
                <CardContent>
                  {groupStats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">暂无数据</div>
                  ) : (
                    <div className="space-y-2">
                      {groupStats.map((stat) => (
                        <div key={stat.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-medium w-24">{formatDate(stat.stat_date)}</span>
                            <Badge variant="outline">{formatNumber(stat.pv)} 请求</Badge>
                            {stat.active_key_count > 0 && (
                              <Badge variant="secondary">{stat.active_key_count} 活跃 Key</Badge>
                            )}
                          </div>
                          <div className="w-64 bg-secondary h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-primary h-full"
                              style={{
                                width: `${(stat.pv / Math.max(...groupStats.map(s => s.pv))) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* API Key 统计 */}
        <TabsContent value="key" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>选择 API Key</CardTitle>
              <CardDescription>查看指定 API Key 的统计数据</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedKey} onValueChange={(v) => v && setSelectedKey(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择 API Key" />
                </SelectTrigger>
                <SelectContent>
                  {apiKeys.map((key) => (
                    <SelectItem key={key.id} value={key.app_key}>
                      {key.name || key.app_key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedKey && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">总请求数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(calculateTotal(keyStats))}</div>
                    <p className="text-xs text-muted-foreground mt-1">最近 {days} 天</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">日均请求数</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatNumber(calculateAverage(keyStats))}</div>
                    <p className="text-xs text-muted-foreground mt-1">平均每天</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>每日请求趋势</CardTitle>
                  <CardDescription>API Key 的每日请求量变化</CardDescription>
                </CardHeader>
                <CardContent>
                  {keyStats.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">暂无数据</div>
                  ) : (
                    <div className="space-y-2">
                      {keyStats.map((stat) => (
                        <div key={stat.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div className="flex items-center gap-4">
                            <span className="text-sm font-medium w-24">{formatDate(stat.stat_date)}</span>
                            <Badge variant="outline">{formatNumber(stat.pv)} 请求</Badge>
                          </div>
                          <div className="w-64 bg-secondary h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-primary h-full"
                              style={{
                                width: `${(stat.pv / Math.max(...keyStats.map(s => s.pv))) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
