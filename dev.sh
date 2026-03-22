#!/bin/bash
# 一键启动开发环境

set -e
ROOT=$(cd "$(dirname "$0")" && pwd)

echo "🚀 启动 PostgreSQL..."
docker compose -f "$ROOT/docker-compose.yml" up -d
sleep 3

echo "🦀 启动后端 (Rust, port 8080)..."
cd "$ROOT/backend"
cargo build --quiet
DATABASE_URL=postgresql://postgres:password@localhost:5432/eval_tools \
  PORT=8080 RUST_LOG=info \
  ./target/debug/eval-tools-backend &
BACKEND_PID=$!
echo "   后端 PID: $BACKEND_PID"

sleep 2

echo "⚡ 启动前端 (Vite, port 3000)..."
cd "$ROOT/frontend"
npm install --silent
npm run dev &
FRONTEND_PID=$!
echo "   前端 PID: $FRONTEND_PID"

echo ""
echo "✅ 服务已启动："
echo "   前端:  http://localhost:3000"
echo "   后端:  http://localhost:8080"
echo ""
echo "按 Ctrl+C 停止所有服务..."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; docker compose -f '$ROOT/docker-compose.yml' stop; exit 0" INT
wait
