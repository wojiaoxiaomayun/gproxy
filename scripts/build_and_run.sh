#!/bin/bash

# 构建和运行脚本 (Bash)

echo "=== Building Web Frontend ==="
cd web
npm run build
if [ $? -ne 0 ]; then
    echo "Web build failed!"
    exit 1
fi
cd ..

echo ""
echo "=== Building Go Backend (with embedded frontend) ==="
go build -o gproxy
if [ $? -ne 0 ]; then
    echo "Go build failed!"
    exit 1
fi

echo ""
echo "=== Build Complete ==="
echo "Frontend is embedded in gproxy"
echo ""
echo "=== Starting Gateway ==="
echo "Backend API: http://localhost:8080"
echo "Frontend UI: http://localhost:3000"
echo ""
echo "Single executable file - no external dependencies!"
echo "Press Ctrl+C to stop"
echo ""

./gproxy
