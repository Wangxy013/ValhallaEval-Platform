<div align="center">

# ValhallaEval

**Multi-version Prompt Testing & LLM Evaluation Platform**

一款面向 Prompt 调优验证与模型横向评测的 Web 平台，支持多版本 Prompt 并行测试、多模型效果对比、验证点自动校验与多模式评估，帮助团队高效验证 Prompt 指令生效情况与模型能力差异。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Backend: Rust](https://img.shields.io/badge/Backend-Rust%20%2B%20Axum-orange)](https://www.rust-lang.org/)
[![Frontend: React](https://img.shields.io/badge/Frontend-React%20%2B%20TypeScript-61dafb)](https://reactjs.org/)

</div>

---

## 功能概览

| 功能 | 说明 |
|---|---|
| **Prompt 多版本对比** | 同一模型、多个 Prompt 版本并行推理，直观对比修改效果 |
| **基准 Prompt** | 指定一个版本作为对比基准，结果对比围绕基准展开，明细页基准优先展示 |
| **模型横向评测** | 同一 Prompt、多个模型同时推理，量化模型差异 |
| **批量测试** | 支持多条测试数据批量推理，全程使用无上下文的全新会话 |
| **CSV 样例导入** | 数据集页面提供 CSV 样例下载与一键导入，适合快速批量灌入中文阅读理解数据 |
| **并发执行** | 可配置并发数（1-20），三个阶段同时发起多个 LLM 调用，告别串行等待 |
| **三阶段模型分离** | 推理、校验、评估三个环节可分别指定模型；推理支持 1 个或多个，校验/评估各固定 1 个 |
| **验证点自动校验** | 自定义校验标准，由 LLM 裁判模型逐条判断 通过/未通过 |
| **中文校验裁判** | 校验 prompt 会结合校验点名称与校验标准，要求裁判以中文 JSON 返回结论与理由 |
| **验证点对比矩阵** | 总览页按验证点×版本呈现通过率矩阵，直观显示 +N% 改善或退步 |
| **差异高亮** | 明细页同一测试数据多版本并排，自动标注改善/退步的验证点 |
| **结果页交互增强** | 支持测试数据/输入/输出详情弹窗、全部展开/收起、回到顶部、稳定序号与稳定排序 |
| **多模式评估** | 人工评估 / 模型自动评分（0–10）/ 自定义规则，三种模式自由选择 |
| **密钥安全展示** | 模型 API Key 保存后仅返回脱敏值；编辑时默认不回填明文，留空可保持原密钥 |
| **实时进度面板** | 三阶段（推理→校验→评估）独立进度条，2s 轮询实时更新 |
| **结果可复现** | 测试数据与 Prompt 在任务创建时快照锁定，保证评测一致性 |

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                         浏览器 (React)                       │
│  任务列表  │  新建任务向导  │  总览 & 明细  │  模型/Prompt管理  │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP / REST (JSON)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Rust API Server (Axum)                   │
│  routes/tasks.rs   routes/prompts.rs   routes/datasets.rs   │
│  routes/models.rs                                           │
│                                                             │
│  ┌─────────────────┐   ┌────────────────────────────────┐  │
│  │  LLM Client     │   │  tokio::spawn background tasks │  │
│  │  (reqwest)      │   │  · execute_task (Semaphore N)  │  │
│  │  OpenAI-compat  │   │  · validate_task (Semaphore N) │  │
│  └────────┬────────┘   │  · auto_assess_task (Semaphore N)│  │
│           │            └────────────────────────────────┘  │
└───────────┼─────────────────────────────────────────────────┘
            │                          │
            ▼                          ▼
┌───────────────────┐      ┌───────────────────────┐
│  外部 LLM API     │      │   PostgreSQL 16        │
│  (豆包/星火/etc.) │      │   (Docker)             │
└───────────────────┘      └───────────────────────┘
```

---

## 快速开始

### 环境要求

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Rust](https://rustup.rs/) 1.75+
- [Node.js](https://nodejs.org/) 18+
- [sqlx-cli](https://github.com/launchbay/sqlx-cli)（首次初始化数据库时需要）

### 一键启动（开发模式）

```bash
git clone <repo-url> && cd ValhallaEval
cp backend/.env.example backend/.env   # 按需修改数据库连接
chmod +x dev.sh && ./dev.sh
```

启动后访问 **http://localhost:3000**

### 分步启动

```bash
# 1. 启动 PostgreSQL
docker compose up -d

# 2. 启动后端 (端口 8080)
cd backend && cargo run

# 3. 启动前端 (端口 3000)
cd frontend && npm install && npm run dev
```

---

## 目录结构

```
ValhallaEval/
├── README.md                     # 项目总览
├── CHANGELOG.md                  # 版本变更记录
├── CONTRIBUTING.md               # 贡献指南
├── LICENSE                       # MIT 开源许可
├── .gitignore
├── .editorconfig                 # 编辑器统一配置
│
├── docker-compose.yml            # 开发环境 PostgreSQL
├── docker-compose.prod.yml       # 生产环境完整部署
├── Dockerfile.backend             # 后端多阶段构建
├── Dockerfile.frontend           # 前端 Nginx 构建
├── docker/nginx.conf             # 前端 Nginx 配置
├── .env.prod.example             # 生产环境变量示例
│
├── dev.sh                        # 一键开发启动脚本
│
├── backend/                      # Rust + Axum 后端
│   ├── Cargo.toml
│   ├── Cargo.lock
│   ├── .env / .env.example
│   ├── migrations/               # SQLx 数据库迁移
│   │   ├── 20240101000001_initial.up.sql
│   │   ├── 20240101000002_add_concurrency.up.sql
│   │   ├── 20240101000003_add_baseline_prompt.up.sql
│   │   └── 20240101000004_add_task_stage_models.up.sql
│   └── src/
│       ├── main.rs               # 入口 & 路由注册
│       ├── error.rs              # 统一错误处理
│       ├── db/                   # 数据库连接池
│       ├── llm/                  # LLM API 客户端
│       ├── models/               # 数据结构定义
│       └── routes/               # 路由处理函数
│
├── frontend/                     # React + TypeScript 前端
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx              # 入口
│       ├── App.tsx               # 布局 & 路由
│       ├── api/                  # API 请求封装
│       ├── components/           # 通用组件
│       ├── pages/                # 页面组件
│       ├── hooks/                # 自定义 Hooks
│       ├── stores/               # 状态管理
│       ├── types/                # TypeScript 类型
│       └── utils/                # 工具函数
│
└── docs/                         # 项目文档
    ├── README.md                 # 文档索引
    ├── architecture.md           # 技术架构设计
    ├── api-reference.md          # API 接口参考
    ├── development.md            # 开发指南
    ├── deployment.md              # 生产部署指南
    ├── requirements/              # 需求文档
    │   └── ValhallaEval-需求文档.md
    └── user-guide/               # 用户使用手册
        ├── README.md
        ├── 01-getting-started.md
        ├── 02-model-management.md
        ├── 03-prompt-management.md
        ├── 04-dataset-management.md
        ├── 05-create-task.md
        ├── 06-run-and-validate.md
        └── 07-analyze-results.md
```

---

## 技术栈

| 层次 | 技术 | 版本 |
|---|---|---|
| 后端框架 | Rust + Axum | 0.7 |
| 异步运行时 | Tokio | 1.x |
| 数据库 ORM | SQLx (PostgreSQL) | 0.8 |
| 前端框架 | React + TypeScript | 18 / 5 |
| 构建工具 | Vite | 6 |
| UI 组件库 | Ant Design | 5 |
| 数据请求 | TanStack Query + Axios | 5 / 1 |
| 数据库 | PostgreSQL | 16 |
| 容器化 | Docker Compose | v2 |

---

## 文档目录

| 文档 | 说明 |
|---|---|
| [技术架构](docs/architecture.md) | 系统设计、数据模型、核心流程 |
| [API 参考](docs/api-reference.md) | 所有接口的请求/响应说明 |
| [开发指南](docs/development.md) | 本地开发环境配置与代码规范 |
| [部署指南](docs/deployment.md) | 生产环境部署方案 |
| [用户手册](docs/user-guide/README.md) | 面向使用者的操作指南 |

---

## License

[MIT](LICENSE)
