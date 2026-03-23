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
git clone <repo-url> && cd Edu-Model-Eval-Tools

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
docker exec eval-tools-postgres pg_dump -U eval_user eval_tools | gzip > backup-$(date +%Y%m%d).sql.gz
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
# 产物：target/release/eval-tools-backend
```

### 2. 构建前端

```bash
cd frontend
npm install && npm run build
# 产物：frontend/dist/
```

### 3. 配置并启动后端（systemd）

创建 `/etc/systemd/system/eval-tools.service`：

```ini
[Unit]
Description=Edu Model Eval Tools Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/eval-tools
EnvironmentFile=/etc/eval-tools/backend.env
ExecStart=/opt/eval-tools/eval-tools-backend
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

`/etc/eval-tools/backend.env`：

```env
DATABASE_URL=postgresql://eval_user:password@localhost:5432/eval_tools
PORT=8080
RUST_LOG=info
```

```bash
cp backend/target/release/eval-tools-backend /opt/eval-tools/
systemctl daemon-reload && systemctl enable --now eval-tools
```

---

## Nginx 反向代理（手动部署时）

`/etc/nginx/sites-available/eval-tools`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/eval-tools;
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
journalctl -u eval-tools -f
journalctl -u eval-tools --since "1 hour ago" -p err
```

### 数据库迁移（升级时）

SQLx 在后端启动时自动运行 `migrations/` 目录下的迁移脚本（幂等）。无需手动执行，重启后端即可应用新迁移。

### 性能调优

- LLM 调用超时默认 120s，可在 `backend/src/llm/client.rs` 调整
- 并发数由**用户在创建任务时配置**（1-20，默认 3），影响 API 调用速率——建议根据模型提供商的限流策略设置
- PostgreSQL 连接池默认 5，高并发场景可在 `backend/src/db/mod.rs` 调整 `max_connections`


## 目录

- [架构说明](#架构说明)
- [前置要求](#前置要求)
- [部署步骤](#部署步骤)
- [Nginx 反向代理](#nginx-反向代理)
- [环境变量配置](#环境变量配置)
- [数据库生产配置](#数据库生产配置)
- [运维建议](#运维建议)

---

## 架构说明

生产环境推荐架构：

```
Internet
    │
    ▼
Nginx (80/443)
    │
    ├──── /          → 前端静态文件 (build 产物)
    └──── /api/v1/*  → Rust API Server (127.0.0.1:8080)
                              │
                         PostgreSQL (内网)
```

---

## 前置要求

- Linux 服务器（Ubuntu 22.04+ 推荐）
- PostgreSQL 14+（可使用 Docker 或独立安装）
- Nginx
- Rust 工具链（编译后端二进制）或 Docker

---

## 部署步骤

### 1. 构建后端

```bash
cd backend
cargo build --release
# 产物位于 target/release/eval-tools-backend
```

### 2. 构建前端

```bash
cd frontend
npm install
npm run build
# 产物位于 frontend/dist/
```

### 3. 配置环境变量

在服务器上创建 `/etc/eval-tools/backend.env`：

```env
DATABASE_URL=postgresql://eval_user:strong-password@localhost:5432/eval_tools
PORT=8080
RUST_LOG=info
```

### 4. 创建系统服务（systemd）

创建 `/etc/systemd/system/eval-tools.service`：

```ini
[Unit]
Description=Edu Model Eval Tools Backend
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/eval-tools
EnvironmentFile=/etc/eval-tools/backend.env
ExecStart=/opt/eval-tools/eval-tools-backend
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
# 复制二进制
cp backend/target/release/eval-tools-backend /opt/eval-tools/

# 启用服务
systemctl daemon-reload
systemctl enable eval-tools
systemctl start eval-tools
systemctl status eval-tools
```

### 5. 部署前端静态文件

```bash
cp -r frontend/dist/* /var/www/eval-tools/
```

---

## Nginx 反向代理

创建 `/etc/nginx/sites-available/eval-tools`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    root /var/www/eval-tools;
    index index.html;

    # API 反向代理到 Rust 后端
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 180s;   # LLM 调用可能较慢，适当延长超时
        proxy_send_timeout 180s;
    }

    # SPA fallback — 所有非 API 路径返回 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/eval-tools /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

**HTTPS（推荐）**：使用 Certbot 自动配置：

```bash
certbot --nginx -d your-domain.com
```

---

## 环境变量配置

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:password@localhost:5432/eval_tools` | PostgreSQL 连接字符串 |
| `PORT` | `8080` | HTTP 监听端口 |
| `RUST_LOG` | `info` | 日志级别：`error`/`warn`/`info`/`debug`/`trace` |

---

## 数据库生产配置

### 创建专用用户

```sql
CREATE USER eval_user WITH PASSWORD 'strong-password';
CREATE DATABASE eval_tools OWNER eval_user;
GRANT ALL PRIVILEGES ON DATABASE eval_tools TO eval_user;
```

### 运行迁移

```bash
DATABASE_URL=postgresql://eval_user:strong-password@localhost:5432/eval_tools \
  sqlx migrate run --source backend/migrations
```

### 备份建议

```bash
# 每日定时备份
0 2 * * * pg_dump -U eval_user eval_tools | gzip > /backup/eval-tools-$(date +%Y%m%d).sql.gz
```

---

## 运维建议

### 日志查看

```bash
# 实时日志
journalctl -u eval-tools -f

# 过去 1 小时错误
journalctl -u eval-tools --since "1 hour ago" -p err
```

### 性能调优

- LLM 调用超时默认 120s，可在 `backend/src/llm/client.rs` 调整
- 高并发场景建议配置 PostgreSQL 连接池大小（当前 `max_connections=5`，可在 `db/mod.rs` 调整）
- 大批量任务建议配置 `RUST_LOG=warn` 减少日志开销

### 更新部署

```bash
# 1. 构建新版本
cargo build --release
npm run build

# 2. 停服务、替换文件、重启
systemctl stop eval-tools
cp target/release/eval-tools-backend /opt/eval-tools/
cp -r frontend/dist/* /var/www/eval-tools/
systemctl start eval-tools
```

### 数据库迁移（升级时）

```bash
# 在重启服务前执行，SQLx 迁移是幂等的
DATABASE_URL=... sqlx migrate run --source backend/migrations
```
