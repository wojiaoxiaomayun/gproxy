# 测试今日统计数据
$baseUrl = "http://localhost:8080"

Write-Host "=== 测试今日统计数据 ===" -ForegroundColor Green
Write-Host ""

# 1. 获取全局今日统计（实时）
Write-Host "1. 获取全局今日统计（实时内存数据）" -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/stats/global/today" -Method Get
    Write-Host "PV: $($response.pv)" -ForegroundColor Yellow
    Write-Host "Active Keys: $($response.active_keys)" -ForegroundColor Yellow
    Write-Host "Last Update: $($response.last_update)" -ForegroundColor Yellow
} catch {
    Write-Host "错误: $_" -ForegroundColor Red
}
Write-Host ""

# 2. 获取今天的每日统计（数据库数据）
Write-Host "2. 获取今天的每日统计（数据库持久化数据）" -ForegroundColor Cyan
$today = Get-Date -Format "yyyy-MM-dd"
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/stats/daily/global?date=$today" -Method Get
    Write-Host "日期: $($response.stat_date)" -ForegroundColor Yellow
    Write-Host "PV: $($response.pv)" -ForegroundColor Yellow
    Write-Host "Active Keys: $($response.active_key_count)" -ForegroundColor Yellow
    Write-Host "Updated At: $($response.updated_at)" -ForegroundColor Yellow
} catch {
    Write-Host "错误: $_" -ForegroundColor Red
}
Write-Host ""

# 3. 获取所有项目
Write-Host "3. 获取所有项目" -ForegroundColor Cyan
try {
    $projects = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/projects" -Method Get
    Write-Host "项目数量: $($projects.Count)" -ForegroundColor Yellow
    $projects | ForEach-Object {
        Write-Host "  - ID: $($_.id), Name: $($_.name)" -ForegroundColor Gray
    }
} catch {
    Write-Host "错误: $_" -ForegroundColor Red
}
Write-Host ""

# 4. 获取每个项目的今日统计
Write-Host "4. 获取每个项目的今日统计" -ForegroundColor Cyan
try {
    $projects = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/projects" -Method Get
    foreach ($project in $projects) {
        Write-Host "  项目: $($project.name) (ID: $($project.id))" -ForegroundColor Yellow
        
        # 实时统计
        try {
            $stats = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/stats/project/$($project.id)/today" -Method Get
            Write-Host "    实时统计 - PV: $($stats.pv), Active Keys: $($stats.active_keys)" -ForegroundColor Gray
        } catch {
            Write-Host "    实时统计 - 错误: $_" -ForegroundColor Red
        }
        
        # 数据库统计
        try {
            $dailyStats = Invoke-RestMethod -Uri "$baseUrl/__gproxy__/admin/stats/daily/project/$($project.id)?days=1" -Method Get
            if ($dailyStats.Count -gt 0) {
                $todayStat = $dailyStats[0]
                Write-Host "    数据库统计 - 日期: $($todayStat.stat_date), PV: $($todayStat.pv), Active Keys: $($todayStat.active_key_count)" -ForegroundColor Gray
            } else {
                Write-Host "    数据库统计 - 暂无数据" -ForegroundColor Gray
            }
        } catch {
            Write-Host "    数据库统计 - 错误: $_" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "错误: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== 测试完成 ===" -ForegroundColor Green
