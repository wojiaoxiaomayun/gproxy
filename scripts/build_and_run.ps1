# 构建和运行脚本 (PowerShell)

Write-Host "=== Building Web Frontend ===" -ForegroundColor Green
Set-Location web
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Web build failed!" -ForegroundColor Red
    exit 1
}
Set-Location ..

Write-Host "`n=== Building Go Backend (with embedded frontend) ===" -ForegroundColor Green
go build -o gproxy.exe
if ($LASTEXITCODE -ne 0) {
    Write-Host "Go build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Build Complete ===" -ForegroundColor Green
Write-Host "Frontend is embedded in gproxy.exe" -ForegroundColor Cyan
Write-Host "`n=== Starting Gateway ===" -ForegroundColor Green
Write-Host "Backend API: http://localhost:8080" -ForegroundColor Cyan
Write-Host "Frontend UI: http://localhost:3000" -ForegroundColor Cyan
Write-Host "`nSingle executable file - no external dependencies!" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop`n" -ForegroundColor Yellow

.\gproxy.exe
