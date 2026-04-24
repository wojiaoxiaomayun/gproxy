# 测试脚本 (PowerShell)

$BASE_URL = "http://localhost:8080"
$API_KEY = "test-key-001"

Write-Host "=== API Gateway Test Script ===" -ForegroundColor Green
Write-Host ""

# 1. 健康检查
Write-Host "1. Health Check" -ForegroundColor Yellow
Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get | ConvertTo-Json
Write-Host ""

# 2. 测试鉴权失败（无API Key）
Write-Host "2. Test Auth Failure (No API Key)" -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$BASE_URL/test" -Method Get
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
}
Write-Host ""

# 3. 测试鉴权失败（错误的API Key）
Write-Host "3. Test Auth Failure (Invalid API Key)" -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$BASE_URL/test" -Method Get -Headers @{"Authorization"="Bearer invalid-key"}
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
}
Write-Host ""

# 4. 测试鉴权成功（会失败因为没有上游服务，但能通过鉴权）
Write-Host "4. Test Auth Success (will fail at proxy stage)" -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$BASE_URL/test" -Method Get -Headers @{"Authorization"="Bearer $API_KEY"}
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
}
Write-Host ""

# 5. 测试限流
Write-Host "5. Test Rate Limit (Sending 15 requests quickly)" -ForegroundColor Yellow
for ($i = 1; $i -le 15; $i++) {
    Write-Host "Request $i: " -NoNewline
    try {
        $response = Invoke-WebRequest -Uri "$BASE_URL/test" -Method Get -Headers @{"Authorization"="Bearer $API_KEY"} -ErrorAction Stop
        Write-Host "[HTTP $($response.StatusCode)]" -ForegroundColor Green
    } catch {
        Write-Host "[HTTP $($_.Exception.Response.StatusCode.value__)]" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 50
}
Write-Host ""

# 6. 配置重载
Write-Host "6. Test Config Reload" -ForegroundColor Yellow
Invoke-RestMethod -Uri "$BASE_URL/admin/reload" -Method Post | ConvertTo-Json
Write-Host ""

Write-Host "=== Test Complete ===" -ForegroundColor Green
