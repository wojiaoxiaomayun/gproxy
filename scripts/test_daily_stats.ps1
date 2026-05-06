# 测试每日统计功能
# 确保网关正在运行

$baseUrl = "http://localhost:8080"

Write-Host "=== 测试每日统计功能 ===" -ForegroundColor Green
Write-Host ""

# 1. 获取最近30天的全局统计
Write-Host "1. 获取最近30天的全局统计" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/stats/daily/global/latest?days=30" -Method Get
Write-Host "返回记录数: $($response.Count)" -ForegroundColor Yellow
if ($response.Count -gt 0) {
    Write-Host "最新一条记录:" -ForegroundColor Yellow
    $response[0] | ConvertTo-Json
}
Write-Host ""

# 2. 获取最近7天的全局统计
Write-Host "2. 获取最近7天的全局统计" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/stats/daily/global/latest?days=7" -Method Get
Write-Host "返回记录数: $($response.Count)" -ForegroundColor Yellow
$response | ForEach-Object {
    Write-Host "  日期: $($_.stat_date), PV: $($_.pv), 活跃Key: $($_.active_key_count)"
}
Write-Host ""

# 3. 获取今天的全局统计
Write-Host "3. 获取今天的全局统计" -ForegroundColor Cyan
$today = Get-Date -Format "yyyy-MM-dd"
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/stats/daily/global?date=$today" -Method Get
    Write-Host "今天 ($today) 的统计:" -ForegroundColor Yellow
    $response | ConvertTo-Json
} catch {
    Write-Host "今天还没有统计数据（这是正常的，需要等待10分钟后第一次持久化）" -ForegroundColor Yellow
}
Write-Host ""

# 4. 获取所有项目列表
Write-Host "4. 获取所有项目" -ForegroundColor Cyan
$projects = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/projects" -Method Get
Write-Host "项目数量: $($projects.Count)" -ForegroundColor Yellow
if ($projects.Count -gt 0) {
    $firstProject = $projects[0]
    Write-Host "第一个项目: ID=$($firstProject.id), Name=$($firstProject.name)" -ForegroundColor Yellow
    
    # 5. 获取第一个项目的每日统计
    Write-Host ""
    Write-Host "5. 获取项目 $($firstProject.id) 的最近7天统计" -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/stats/daily/project/$($firstProject.id)?days=7" -Method Get
        Write-Host "返回记录数: $($response.Count)" -ForegroundColor Yellow
        $response | ForEach-Object {
            Write-Host "  日期: $($_.stat_date), PV: $($_.pv), 活跃Key: $($_.active_key_count)"
        }
    } catch {
        Write-Host "该项目还没有统计数据" -ForegroundColor Yellow
    }
}
Write-Host ""

# 6. 获取所有分组
Write-Host "6. 获取所有分组" -ForegroundColor Cyan
$groups = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/groups" -Method Get
Write-Host "分组数量: $($groups.Count)" -ForegroundColor Yellow
if ($groups.Count -gt 0) {
    $firstGroup = $groups[0]
    Write-Host "第一个分组: ID=$($firstGroup.id), Name=$($firstGroup.name)" -ForegroundColor Yellow
    
    # 7. 获取第一个分组的每日统计
    Write-Host ""
    Write-Host "7. 获取分组 $($firstGroup.id) 的最近7天统计" -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/stats/daily/group/$($firstGroup.id)?days=7" -Method Get
        Write-Host "返回记录数: $($response.Count)" -ForegroundColor Yellow
        $response | ForEach-Object {
            Write-Host "  日期: $($_.stat_date), PV: $($_.pv), 活跃Key: $($_.active_key_count)"
        }
    } catch {
        Write-Host "该分组还没有统计数据" -ForegroundColor Yellow
    }
}
Write-Host ""

# 8. 获取所有API Key
Write-Host "8. 获取所有API Key" -ForegroundColor Cyan
$keys = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/api-keys" -Method Get
Write-Host "API Key数量: $($keys.Count)" -ForegroundColor Yellow
if ($keys.Count -gt 0) {
    $firstKey = $keys[0]
    Write-Host "第一个Key: Name=$($firstKey.name), AppKey=$($firstKey.app_key)" -ForegroundColor Yellow
    
    # 9. 获取第一个Key的每日统计
    Write-Host ""
    Write-Host "9. 获取API Key '$($firstKey.app_key)' 的最近7天统计" -ForegroundColor Cyan
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/stats/daily/key/$($firstKey.app_key)?days=7" -Method Get
        Write-Host "返回记录数: $($response.Count)" -ForegroundColor Yellow
        $response | ForEach-Object {
            Write-Host "  日期: $($_.stat_date), PV: $($_.pv)"
        }
    } catch {
        Write-Host "该API Key还没有统计数据" -ForegroundColor Yellow
    }
}
Write-Host ""

Write-Host "=== 测试完成 ===" -ForegroundColor Green
Write-Host ""
Write-Host "提示:" -ForegroundColor Yellow
Write-Host "- 每日统计每10分钟更新一次当天的数据"
Write-Host "- 如果刚启动服务，可能需要等待10分钟后才能看到今天的数据"
Write-Host "- 跨天时会自动持久化昨天的最终数据"
Write-Host "- 可以在前端 http://localhost:3000/stats 查看可视化统计"
