#!/bin/bash
# 一键停止开发环境

ROOT=$(cd "$(dirname "$0")" && pwd)

echo "🛑 停止前端 (Vite, port 3000)..."
FRONTEND_PIDS=$(lsof -ti :3000 2>/dev/null)
if [ -n "$FRONTEND_PIDS" ]; then
  kill $FRONTEND_PIDS 2>/dev/null && echo "   已停止 PID: $FRONTEND_PIDS"
else
  echo "   未检测到前端进程"
fi

echo "🛑 停止后端 (Rust, port 8080)..."
BACKEND_PIDS=$(lsof -ti :8080 2>/dev/null)
if [ -n "$BACKEND_PIDS" ]; then
  kill $BACKEND_PIDS 2>/dev/null && echo "   已停止 PID: $BACKEND_PIDS"
else
  echo "   未检测到后端进程"
fi

echo "🛑 停止 PostgreSQL (Docker Compose)..."
docker compose -f "$ROOT/docker-compose.yml" stop

echo ""
echo "✅ 所有服务已停止"
