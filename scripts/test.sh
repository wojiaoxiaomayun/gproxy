#!/bin/bash

# 测试脚本

BASE_URL="http://localhost:8080"
API_KEY="test-key-001"

echo "=== API Gateway Test Script ==="
echo ""

# 1. 健康检查
echo "1. Health Check"
curl -s $BASE_URL/health | jq .
echo ""

# 2. 测试鉴权失败（无API Key）
echo "2. Test Auth Failure (No API Key)"
curl -s $BASE_URL/test
echo ""
echo ""

# 3. 测试鉴权失败（错误的API Key）
echo "3. Test Auth Failure (Invalid API Key)"
curl -s -H "Authorization: Bearer invalid-key" $BASE_URL/test
echo ""
echo ""

# 4. 测试鉴权成功
echo "4. Test Auth Success"
curl -s -H "X-API-Key: $API_KEY" $BASE_URL/test
echo ""
echo ""

# 5. 测试限流（快速发送多个请求）
echo "5. Test Rate Limit (Sending 15 requests quickly)"
for i in {1..15}; do
    echo -n "Request $i: "
    curl -s -H "Authorization: Bearer $API_KEY" $BASE_URL/test -w " [HTTP %{http_code}]\n" -o /dev/null
    sleep 0.05
done
echo ""

# 6. 配置重载
echo "6. Test Config Reload"
curl -s -X POST $BASE_URL/admin/reload | jq .
echo ""

echo "=== Test Complete ==="
