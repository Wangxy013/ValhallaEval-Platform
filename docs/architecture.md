# 技术架构

## 目录

- [系统概览](#系统概览)
- [组件职责](#组件职责)
- [数据模型](#数据模型)
- [核心数据流](#核心数据流)
- [API 设计原则](#api-设计原则)
- [关键设计决策](#关键设计决策)

---

## 系统概览

系统采用前后端分离架构：前端 React SPA 通过 REST API 与 Rust 后端通信，后端负责业务逻辑、异步任务调度和 LLM API 调用，PostgreSQL 存储所有持久化数据。

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (React SPA)                                         │
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │ 任务管理  │  │  新建任务向导 │  │  总览 & 明细分析     │   │
│  └──────────┘  └──────────────┘  └─────────────────────┘   │
│  ┌──────────┐  ┌──────────────┐                             │
│  │ 模型管理  │  │  Prompt管理   │                             │
│  └──────────┘  └──────────────┘                             │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST / JSON  (HTTP + CORS)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│  Rust API Server  (Axum 0.7 + Tokio)                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Router  /api/v1/*                                   │    │
│  │  routes/models  routes/prompts  routes/datasets      │    │
│  │  routes/tasks (CRUD + execution + results)           │    │
│  └──────────────────────────┬──────────────────────────┘    │
│                             │                                │
│  ┌──────────────────┐  ┌────▼─────────────────────────┐    │
│  │  LLM Client      │  │  Background Tasks (tokio::    │    │
│  │  (reqwest)       │  │  spawn)                       │    │
│  │  OpenAI-compat   │  │  · execute_task (推理)        │    │
│  │  POST /chat/     │  │  · validate_task (校验)       │    │
│  │    completions   │  │  · auto_assess_task (评估)    │    │
│  └─────────┬────────┘  └──────────────────────────────┘    │
└────────────┼─────────────────────────────────────────────────┘
             │                          │
     ┌───────▼───────┐         ┌────────▼──────────┐
     │  外部 LLM API  │         │   PostgreSQL 16    │
     │  (豆包/    │         │   (Docker)         │
     │   OpenAI等)   │         │                   │
     └───────────────┘         └───────────────────┘
```

---

## 组件职责

### 前端 (`frontend/`)

| 目录/文件 | 职责 |
|---|---|
| `src/pages/Tasks/` | 任务列表页，支持筛选、跳转结果页 |
| `src/pages/NewTask/` | 5 步创建向导：基本信息 → 模型 → Prompt → 数据 → 校验与评估（含基准 Prompt 选择） |
| `src/pages/TaskResult/` | 总览（验证矩阵、统计）+ 明细（分组对比、差异高亮、基准标注） |
| `src/pages/ModelManagement/` | 模型配置增删改查 |
| `src/pages/PromptManagement/` | Prompt 多版本管理 |
| `src/components/WorkflowProgress.tsx` | 三阶段执行进度面板（推理→校验→评估），轮询 `/progress` 接口 |
| `src/api/client.ts` | Axios 实例，自动解包 `{ success, data }` 信封 |
| `src/types/index.ts` | 全局 TypeScript 类型定义（含 TaskProgress、is_baseline 等） |

### 后端 (`backend/src/`)

| 文件 | 职责 |
|---|---|
| `main.rs` | 启动服务、注册路由、初始化连接池、运行数据库迁移 |
| `error.rs` | 统一 `AppError` 类型，映射到 HTTP 状态码和 JSON 错误体 |
| `llm/client.rs` | 封装 OpenAI-compatible 聊天接口调用，120s 超时 |
| `routes/tasks.rs` | 最核心路由，包含任务 CRUD、执行、校验、评估、结果查询 |
| `routes/models.rs` | 模型配置 CRUD |
| `routes/prompts.rs` | Prompt CRUD |
| `routes/datasets.rs` | 数据集与测试数据 CRUD |
| `models/` | SQLx `FromRow` 数据结构 + 请求 payload 反序列化结构 |

---

## 数据模型

### 实体关系图

```
model_configs          prompts              test_datasets
     │                    │                      │
     │                    │                 test_items
     │                    │
     └───────────────────┬┘
                         │  (创建任务时多对多关联)
                    ┌────▼────┐
                    │  tasks  │
                    │         │
              ┌─────┴──┬──────┴──────┐
              │        │             │
         task_models  task_prompts  task_test_items
         (task×model) (task×prompt)  (内容快照)
              │        │             │
              └────────┴─────────────┘
                         │ (笛卡尔积×repeat_count)
                    ┌────▼────┐
                    │eval_runs│  ← 一次 LLM 推理 = 一行
                    └────┬────┘
              ┌──────────┴────────────┐
              │                       │
    validation_results        assessment_results
    (per run × checkpoint)    (per run × mode)
              │
    validation_checkpoints
    (task 级别的校验标准)
```

### 关键表说明

**`eval_runs`** — 系统的最小原子单元。每行代表一次完整的 LLM 推理：

```
eval_run = 1 个测试数据 × 1 个模型 × 1 个 Prompt × 第 N 次重复
```

总行数 = `len(test_items) × len(models) × len(prompts) × repeat_count`

**`task_test_items`** — 测试数据快照。任务创建时立即复制 `test_items.content`，此后数据集修改不影响已有任务，保证可复现性。

**`validation_results`** — 每条 eval_run 与每个 validation_checkpoint 的校验结果，`result` 字段为 `pass`/`fail`/`error`。

**`assessment_results`** — 评分记录，`mode` 为 `manual`（人工）或 `auto`（LLM），`details` JSON 字段存储 `checkpoint_scores`（各验证点子评分）。

---

## 核心数据流

### 1. 任务执行流程

```
POST /tasks/:id/execute
        │
        ├─ 检查任务状态（非 running）
        ├─ 读取 task_models、task_prompts
        ├─ 读取 task_test_items（已快照）
        │   └─ fallback: 从 dataset 全量加载并快照
        ├─ UPDATE tasks SET status='running'
        └─ tokio::spawn (异步后台)
              │
              for each test_item × model × prompt × repeat_index:
                ├─ INSERT eval_runs (status='pending')
                ├─ 构建 messages: [system: prompt, user: test_item]
                ├─ POST {api_url}/chat/completions
                └─ UPDATE eval_runs (output_content, tokens_used, duration_ms)
              │
              └─ UPDATE tasks SET status='completed'
```

### 2. 验证校验流程

```
POST /tasks/:id/validate
        │
        ├─ 读取 validation_checkpoints（至少1个）
        ├─ 读取所有 completed eval_runs
        └─ tokio::spawn
              │
              for each eval_run × checkpoint:
                ├─ 检查是否已校验（幂等）
                ├─ 构建 prompt:
                │   "Criterion: {criterion}\nOutput: {output}\nPASS or FAIL?"
                ├─ 调用 LLM（使用任务第一个模型作为裁判）
                └─ INSERT/UPDATE validation_results
                       result = 'pass' if response starts with "PASS"
```

### 3. 自动评估流程

```
POST /tasks/:id/assess
        │
        └─ tokio::spawn
              │
              for each completed eval_run:
                ├─ 检查是否已评估（幂等）
                ├─ 若任务有 validation_checkpoints:
                │   构建含验证标准的评分 prompt，要求输出 checkpoint_scores
                │   否则: 通用 0-10 评分 prompt
                ├─ 调用 LLM
                └─ INSERT assessment_results
                       score, comment, details(含checkpoint_scores)
```

---

## API 设计原则

### 响应格式统一

所有接口返回统一信封：

```json
// 成功
{ "success": true, "data": <payload> }

// 失败
{ "success": false, "error": "<human-readable message>" }
```

前端 Axios 拦截器自动解包 `data` 字段，业务代码直接使用 `res.data`。

### HTTP 状态码映射

| AppError 类型 | HTTP 状态码 |
|---|---|
| `NotFound` | 404 |
| `BadRequest` | 400 |
| `Conflict` | 409 |
| `Internal` | 500 |

### 异步任务模式

耗时操作（推理、校验、评估）均采用 **Fire-and-Forget + 并发控制** 模式：
- `POST /execute` 立即返回 `{ status: "running" }`，后台使用 `tokio::sync::Semaphore(N)` 控制并发 LLM 调用数，`tokio::task::JoinSet` 管理并发任务
- 客户端轮询轻量级 `GET /tasks/:id/progress`（建议间隔 2s）获取实时进度
- 任务完成后前端自动刷新完整数据

### 推理预创建模式

在发起 LLM 调用前，先批量 `INSERT` 所有 `eval_run` 记录（状态 `pending`）。这样：
- 进度面板立即可见全量任务数，无需等待第一个结果返回
- 暂停后继续时，已创建的记录可继续完成，无需重新创建

---

## 关键设计决策

### 1. 为什么用 Rust 做后端？

- 零成本异步并发：`tokio::spawn` + `Semaphore` 允许同时运行数十个 LLM API 调用而不阻塞主线程
- SQLx 编译时 SQL 检查，减少运行时数据库错误
- 内存安全，无 GC 停顿，适合长时间批量任务
- 可配置的并发控制 (`concurrency`)，灵活适配不同 LLM 提供商的限流策略

### 2. 为什么不用第三方评测框架？

需求明确要求自主实现（不依赖 Prompt Pilot 等工具），保证：
- 完全掌控数据流向（敏感 API Key 不经第三方）
- 灵活适配各类 OpenAI-compatible 私有化部署模型
- 定制化的评测逻辑（验证点 PASS/FAIL + 评分 + 批注）

### 3. 测试数据快照设计

任务创建时立即将 `test_items.content` 复制到 `task_test_items.content_snapshot`，而不是执行时动态查询数据集。这样：
- 数据集事后修改不影响已有任务
- 可随时重新执行任务得到相同结果
- 满足需求中的"测试数据固定原则"

### 4. 并发执行设计

三个阶段（推理、校验、评估）共用一个可配置的并发数 `concurrency`（1-20，默认 3），通过 `tokio::sync::Semaphore` 实现：

```rust
let sem = Arc::new(Semaphore::new(concurrency as usize));
for each item {
    let permit = sem.acquire().await.unwrap();
    tasks.spawn(async move {
        do_llm_call().await;
        drop(permit); // 释放信号量
    });
}
```

**为什么用 Semaphore 而非固定线程池？** Semaphore 允许动态调整并发上限，无需重启服务即可改变并发数（通过任务配置）。此外，每个阶段可独立控制并发，互不干扰。

### 5. 基准 Prompt 设计

`prompt_comparison` 任务中，需要一个明确的对比基准。后端在 `task_prompts` 表中存储 `is_baseline` 标记，创建时默认为第一个选中的 Prompt，可由用户在向导中修改。

所有结果查询（`by_prompt`、`by_checkpoint_prompt`）均按 `is_baseline` 排序，基准始终排在第一位。前端据此在矩阵、汇总表、明细页中统一标注基准版本。

### 6. 裁判模型复用

验证校验和自动评估默认使用任务第一个配置的模型作为裁判（`LIMIT 1`），而非独立的裁判模型配置。这是当前阶段的简化设计，未来可扩展为独立的裁判模型设置。
