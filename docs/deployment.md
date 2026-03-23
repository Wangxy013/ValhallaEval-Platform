# 生产部署指南

## 目录

- [Docker Compose 一键部署（推荐）](#docker-compose-一键部署推荐)
- [手动部署](#手动部署)
- [Nginx 反向代理](#nginx-反向代理手动部署时)
- [环境变量配置](#环境变量配置)
- [运维建议](#运维建议)

---

## Docker Compose 一键部署（推荐）

项目提供完整的 Docker 化部署方案，三个容器（PostgreSQL + 后端 + 前端 Nginx）一键启动。

### 前置条件

- Docker 20.10+ 和 Docker Compose v2
- 服务器开放 80 端口（或自定义端口）

### 部署步骤

```bash
# 1. 克隆代码
git clone <repo-url> && cd ValhallaEval

# 2. 配置环境变量
cp .env.prod.example .env.prod
# 编辑 .env.prod，填写 POSTGRES_PASSWORD 等

# 3. 一键构建并启动
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# 4. 查看状态
docker compose -f docker-compose.prod.yml ps
```

访问 `http://<your-server-ip>` 即可打开系统。

### 常用命令

```bash
# 查看日志
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f frontend

# 停止
docker compose -f docker-compose.prod.yml down

# 更新部署（拉取新代码后重建）
git pull
docker compose -f docker-compose.prod.yml up -d --build

# 数据库备份
docker exec valhalla-eval-postgres pg_dump -U eval_user eval_tools | gzip > backup-$(date +%Y%m%d).sql.gz
```

### docker-compose.prod.yml 结构

```
postgres   ← 数据库（数据持久化到 postgres_data volume）
    ↑ depends_on (healthy)
backend    ← Rust API 服务（内部端口 8080）
    ↑ depends_on
frontend   ← Nginx 静态服务（对外暴露 APP_PORT，默认 80）
             - /api/* 反向代理到 backend:8080
             - 其他路径服务前端 SPA
```

---

## 手动部署

### 1. 构建后端

```bash
cd backend
cargo build --release
# 产物：target/release/valhalla-eval-backend
```

### 2. 构建前端

```bash
cd frontend
npm install && npm run build
# 产物：frontend/dist/
```

### 3. 配置并启动后端（systemd）

创建 `/etc/systemd/system/valhalla-eval.service`：

```ini
[Unit]
Description=ValhallaEval Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/valhalla-eval
EnvironmentFile=/etc/valhalla-eval/backend.env
ExecStart=/opt/valhalla-eval/valhalla-eval-backend
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`/etc/valhalla-eval/backend.env`：

```env
DATABASE_URL=postgresql://eval_user:password@localhost:5432/eval_tools
PORT=8080
RUST_LOG=info
```

```bash
cp backend/target/release/valhalla-eval-backend /opt/valhalla-eval/
systemctl daemon-reload && systemctl enable --now valhalla-eval
```

---

## Nginx 反向代理（手动部署时）

`/etc/nginx/sites-available/valhalla-eval`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/valhalla-eval;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

HTTPS：`certbot --nginx -d your-domain.com`

---

## 环境变量配置

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/eval_tools` | PostgreSQL 连接字符串 |
| `PORT` | `8080` | 后端监听端口 |
| `RUST_LOG` | `info` | 日志级别 |
| `POSTGRES_PASSWORD` | — | 生产环境必填，用于 Docker Compose |
| `APP_PORT` | `80` | 前端对外端口（Docker Compose） |

---

## 运维建议

### 日志

```bash
# Docker 部署
docker compose -f docker-compose.prod.yml logs -f --tail=100 backend

# systemd 部署
journalctl -u valhalla-eval -f
journalctl -u valhalla-eval --since "1 hour ago" -p err
```

### 数据库迁移（升级时）

SQLx 在后端启动时自动运行 `migrations/` 目录下的迁移脚本（幂等）。无需手动执行，重启后端即可应用新迁移。

### 性能调优

- LLM 调用超时默认 120s，可在 `backend/src/llm/client.rs` 调整
- 并发数由**用户在创建任务时配置**（1-20，默认 3），影响 API 调用速率——建议根据模型提供商的限流策略设置
- PostgreSQL 连接池默认 5，高并发场景可在 `backend/src/db/mod.rs` 调整 `max_connections`
