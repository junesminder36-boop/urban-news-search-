#!/bin/bash

# 启动内网穿透
# 用法: ./start-tunnel.sh

echo "🚀 启动优码智库服务器 + 内网穿透..."

# 先杀掉旧的进程
pkill -f "node server/index.js" 2>/dev/null
pkill -f "localtunnel" 2>/dev/null
sleep 1

# 启动服务器（后台）
export KIMI_API_KEY="sk-Q6vTbBaKpMG1Up3pfuPTSpsxPrPfqkDcXSlG7tAQoYpoaNWX"
node server/index.js &
echo "✅ 服务器已启动: http://localhost:3000"

sleep 2

# 启动内网穿透
echo "🌐 正在生成公网链接..."
npx localtunnel --port 3000
