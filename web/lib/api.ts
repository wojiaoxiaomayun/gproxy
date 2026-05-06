// API 客户端工具
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export interface ApiKey {
  id: number
  name: string
  app_key: string
  project_id: number
  group_id: number
  status: string
  created_at: string
}

export interface Project {
  id: number
  name: string
  description: string
  base_url: string
  created_at: string
}

export interface Upstream {
  id: number
  project_id: number
  target_url: string
  path_prefix: string
  timeout: number
  created_at: string
}

export interface Group {
  id: number
  name: string
  project_id: number
}

export interface RateLimitConfig {
  id: number
  group_id: number
  qps: number
  burst: number
  enable_multi_window: number  // 0=简单模式 1=多窗口模式
  rpm: number  // 每分钟请求数
  rph: number  // 每小时请求数
}

export interface LogConfig {
  id: number
  project_id: number
  enable_body: number
  body_record_threshold_ms: number
  max_body_size: number
  only_error: number
}

export interface CircuitBreakerConfig {
  id: number
  group_id: number
  max_failures: number  // 最大失败次数
  reset_timeout: number  // 重置超时时间(秒)
  half_open_max_test: number  // 半开状态最大测试请求数
}

// 通用请求函数
async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    // 尝试解析错误响应体
    try {
      const errorData = await response.json()
      if (errorData.error) {
        throw new Error(errorData.error)
      }
    } catch (e) {
      // 如果解析失败或没有 error 字段，使用状态文本
      if (e instanceof Error && e.message !== `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`) {
        throw e
      }
    }
    throw new Error(`API Error: ${response.statusText}`)
  }

  return response.json()
}

// API 方法
export const api = {
  // 健康检查
  health: () => request<{ status: string; time: string }>('/__gproxy__/health'),

  // 配置重载
  reload: () => request<{ message: string }>('/__gproxy__/admin/reload', { method: 'POST' }),

  // 注意：以下是前端管理 API，需要后端实现
  // API Keys
  getApiKeys: () => request<ApiKey[]>('/__gproxy__/admin/api-keys'),
  createApiKey: (data: Partial<ApiKey>) => 
    request<ApiKey>('/__gproxy__/admin/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateApiKey: (id: number, data: Partial<ApiKey>) =>
    request<ApiKey>(`/__gproxy__/admin/api-keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteApiKey: (id: number) =>
    request<void>(`/__gproxy__/admin/api-keys/${id}`, { method: 'DELETE' }),

  // Projects
  getProjects: () => request<Project[]>('/__gproxy__/admin/projects'),
  createProject: (data: Partial<Project>) =>
    request<Project>('/__gproxy__/admin/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProject: (id: number, data: Partial<Project>) =>
    request<Project>(`/__gproxy__/admin/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteProject: (id: number) =>
    request<void>(`/__gproxy__/admin/projects/${id}`, { method: 'DELETE' }),

  // Upstreams
  getUpstreams: (projectId?: number) => {
    const query = projectId ? `?project_id=${projectId}` : ''
    return request<Upstream[]>(`/__gproxy__/admin/upstreams${query}`)
  },
  createUpstream: (data: Partial<Upstream>) =>
    request<Upstream>('/__gproxy__/admin/upstreams', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUpstream: (id: number, data: Partial<Upstream>) =>
    request<Upstream>(`/__gproxy__/admin/upstreams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteUpstream: (id: number, projectId: number) =>
    request<void>(`/__gproxy__/admin/upstreams/${id}?project_id=${projectId}`, { method: 'DELETE' }),

  // Groups
  getGroups: (projectId?: number) => {
    const query = projectId ? `?project_id=${projectId}` : ''
    return request<Group[]>(`/__gproxy__/admin/groups${query}`)
  },
  createGroup: (data: Partial<Group>) =>
    request<Group>('/__gproxy__/admin/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateGroup: (id: number, data: Partial<Group>) =>
    request<Group>(`/__gproxy__/admin/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteGroup: (id: number, projectId: number) =>
    request<void>(`/__gproxy__/admin/groups/${id}?project_id=${projectId}`, { method: 'DELETE' }),

  // Rate Limit Configs
  getRateLimitConfigs: () => request<RateLimitConfig[]>('/__gproxy__/admin/rate-limits'),
  getRateLimitConfig: (groupId: number) => 
    request<RateLimitConfig>(`/__gproxy__/admin/rate-limits/${groupId}`),
  updateRateLimitConfig: (groupId: number, data: Partial<RateLimitConfig>) =>
    request<RateLimitConfig>(`/__gproxy__/admin/rate-limits/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Log Configs
  getLogConfig: (projectId: number) => 
    request<LogConfig>(`/__gproxy__/admin/log-config/${projectId}`),
  updateLogConfig: (projectId: number, data: Partial<LogConfig>) =>
    request<LogConfig>(`/__gproxy__/admin/log-config/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Circuit Breaker Configs
  getCircuitBreakerConfigs: () => request<CircuitBreakerConfig[]>('/__gproxy__/admin/circuit-breaker-configs'),
  getCircuitBreakerConfig: (groupId: number) => 
    request<CircuitBreakerConfig>(`/__gproxy__/admin/circuit-breaker-config/${groupId}`),
  updateCircuitBreakerConfig: (groupId: number, data: Partial<CircuitBreakerConfig>) =>
    request<CircuitBreakerConfig>(`/__gproxy__/admin/circuit-breaker-config/${groupId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteCircuitBreakerConfig: (groupId: number) =>
    request<void>(`/__gproxy__/admin/circuit-breaker-config/${groupId}`, { method: 'DELETE' }),
}
