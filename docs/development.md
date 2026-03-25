# 开发指南

## 目录

- [环境要求](#环境要求)
- [本地开发环境搭建](#本地开发环境搭建)
- [项目结构详解](#项目结构详解)
- [后端开发](#后端开发)
- [前端开发](#前端开发)
- [数据库管理](#数据库管理)
- [代码规范](#代码规范)
- [常见问题](#常见问题)

---

## 环境要求

| 工具 | 版本要求 | 安装方式 |
|---|---|---|
| Rust | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| Node.js | 18+ | [nodejs.org](https://nodejs.org/) 或 `nvm install 18` |
| Docker + Compose | 任意现代版本 | [docs.docker.com](https://docs.docker.com/get-docker/) |
| sqlx-cli | 0.8 | `cargo install sqlx-cli --no-default-features --features postgres` |
| Git | — | 系统自带或 [git-scm.com](https://git-scm.com/) |

---

## 本地开发环境搭建

### 1. 克隆仓库

```bash
git clone <repo-url>
cd ValhallaEval
```

### 2. 配置环境变量

```bash
cp backend/.env.example backend/.env
```

`backend/.env` 内容（默认值与 `docker-compose.yml` 匹配，无需修改即可运行）：

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/eval_tools
PORT=8080
RUST_LOG=info
```

### 3. 启动数据库

```bash
docker compose up -d
# 等待 healthcheck 通过（约 5s）
docker compose ps   # STATUS 应显示 healthy
```

### 4. 运行数据库迁移

首次启动时，SQLx 会自动运行 `backend/migrations/` 下的迁移文件。如需手动执行：

```bash
cd backend
sqlx database create
sqlx migrate run
```

### 5. 启动后端

```bash
cd backend
cargo run
# 看到 "Listening on 0.0.0.0:8080" 即为启动成功
```

### 6. 启动前端

```bash
cd frontend
npm install
npm run dev
# 浏览器访问 http://localhost:3000
```

### 一键启动（推荐）

```bash
chmod +x dev.sh
./dev.sh
```

`dev.sh` 会依次启动 PostgreSQL、后端、前端，并在 Ctrl+C 时统一清理进程。

### 最近新增的开发约束

- 任务创建采用三阶段模型配置：推理模型、校验模型、评估模型分别建模，其中校验/评估阶段各固定 1 个模型。
- 校验 prompt 必须同时带上校验点名称、校验标准和模型输出，并要求裁判以中文 JSON 返回。
- 模型配置接口返回的 `api_key` 一律为脱敏值；编辑模型时空白 `api_key` 代表“保持原密钥”。

---

## 项目结构详解

### 后端 (`backend/src/`)

```
src/
├── main.rs           # 入口：dotenv 加载、连接池初始化、迁移、路由注册、服务器启动
├── error.rs          # AppError 枚举 + IntoResponse 实现（统一 JSON 错误格式）
│
├── db/
│   └── mod.rs        # create_pool()：创建 PgPool，供所有路由通过 State 共享
│
├── llm/
│   ├── mod.rs        # 模块声明
│   └── client.rs     # LlmClient::call()：封装 OpenAI-compatible /chat/completions
│
├── models/           # 数据结构定义（sqlx::FromRow + serde）
│   ├── mod.rs        # pub use 所有子模块
│   ├── task.rs       # Task, TaskPrompt, TaskModel, TaskTestItem, CreateTask, UpdateTask
│   ├── eval_run.rs   # EvalRun, InputMessage
│   ├── validation.rs # ValidationCheckpoint, ValidationResult, CreateCheckpoint
│   ├── assessment.rs # AssessmentResult, ManualAssessRequest
│   ├── model_config.rs # ModelConfig, CreateModelConfig
│   ├── prompt.rs     # Prompt, CreatePrompt
│   └── test_data.rs  # TestDataset, TestItem, CreateDataset, CreateItem
│
└── routes/           # 路由处理函数
    ├── mod.rs        # pub mod 声明
    ├── tasks.rs      # 最复杂的路由（任务全生命周期）
    ├── models.rs     # 模型配置 CRUD
    ├── prompts.rs    # Prompt CRUD
    └── datasets.rs   # 数据集 & 测试数据 CRUD
```

### 前端 (`frontend/src/`)

```
src/
├── main.tsx          # React 入口，挂载 QueryClientProvider + Router
├── App.tsx           # 布局（Sider + Header + Content）+ 路由定义
│
├── api/              # API 请求函数
│   ├── client.ts     # Axios 实例 + 响应拦截器（解包信封 + 全局错误 toast）
│   ├── tasks.ts      # createTask, executeTask, listEvalRuns, validateRuns 等
│   ├── models.ts     # listModels, createModel 等
│   ├── prompts.ts    # listPrompts, createPrompt 等
│   └── datasets.ts   # listDatasets, listTestItems 等
│
├── components/       # 纯展示组件（无业务逻辑）
│   ├── StatusTag.tsx         # TaskStatusTag, RunStatusTag
│   ├── EvalTypeTag.tsx       # Prompt对比/模型对比 标签
│   └── ValidationAnnotations.tsx  # 带高亮批注的输出文本渲染
│
├── pages/            # 页面组件（承载完整业务逻辑）
│   ├── Tasks/index.tsx       # 任务列表
│   ├── NewTask/index.tsx     # 5步创建向导
│   ├── TaskResult/
│   │   ├── index.tsx         # 总览 + 明细（含 PivotTable、RunCard、DiffSummary）
│   │   └── CompareModal.tsx  # 两条运行结果对比弹窗
│   ├── ModelManagement/index.tsx
│   ├── PromptManagement/index.tsx
│   └── TestDataManagement/index.tsx (datasets)
│
└── types/
    └── index.ts      # 所有 TypeScript 接口定义（与后端 JSON 结构对应）
```

---

## 后端开发

### 添加新路由

1. 在 `routes/` 对应文件中添加 handler 函数：

```rust
pub async fn my_handler(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> AppResult<Json<Value>> {
    // 业务逻辑
    Ok(Json(json!({ "success": true, "data": result })))
}
```

2. 在 `main.rs` 注册路由：

```rust
.route("/api/v1/tasks/:id/my-endpoint", get(routes::tasks::my_handler))
```

### 错误处理

使用 `?` 运算符传播错误，`AppError` 会自动转换：

```rust
let task = sqlx::query_as::<_, Task>("SELECT ... WHERE id = $1")
    .bind(&id)
    .fetch_optional(&pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Task {} not found", id)))?;
```

### 异步后台任务

长时间操作使用 `tokio::spawn` 异步执行：

```rust
let pool_clone = pool.clone();
tokio::spawn(async move {
    // 耗时操作...
    // pool_clone 已移入闭包
});
// 立即返回
Ok(Json(json!({ "success": true, "data": { "message": "Task started" } })))
```

### 数据库查询

优先使用 `sqlx::query_as` 配合模型结构体，避免手动解析：

```rust
let items = sqlx::query_as::<_, TestItem>(
    "SELECT id, dataset_id, content, metadata, order_index, created_at \
     FROM test_items WHERE dataset_id = $1 ORDER BY order_index ASC"
)
.bind(&dataset_id)
.fetch_all(&pool)
.await?;
```

---

## 前端开发

### 数据请求模式

所有数据请求使用 TanStack Query：

```tsx
// 查询
const { data: tasks = [], isLoading } = useQuery({
  queryKey: ['tasks'],
  queryFn: listTasks,
})

// 变更
const createMutation = useMutation({
  mutationFn: createTask,
  onSuccess: () => {
    message.success('创建成功')
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
  },
})
```

### 添加新页面

1. 在 `src/pages/` 新建目录和 `index.tsx`
2. 在 `src/App.tsx` 添加路由：
```tsx
<Route path="/my-page" element={<MyPage />} />
```
3. 在侧边栏菜单数组中添加对应 item

### 类型定义

后端 API 新增字段时，同步更新 `src/types/index.ts`：

```typescript
export interface MyNewType {
  id: string;
  name: string;
  // ...
}
```

---

## 数据库管理

### 添加新迁移

```bash
cd backend
# 创建新迁移文件（自动生成时间戳前缀）
sqlx migrate add <migration_name>
# 编辑 migrations/<timestamp>_<migration_name>.up.sql
# 运行迁移
sqlx migrate run
```

### 重置数据库（开发环境）

```bash
sqlx database drop && sqlx database create && sqlx migrate run
```

### 查看迁移状态

```bash
sqlx migrate info
```

---

## 代码规范

### Rust

- 使用 `cargo fmt` 格式化
- 使用 `cargo clippy` 检查常见问题
- 错误信息使用中文，方便前端直接展示给用户

### TypeScript / React

- 组件命名使用 PascalCase
- API 函数命名使用 camelCase 动词开头（`getTask`, `listRuns`）
- 避免 `any` 类型，优先在 `types/index.ts` 定义接口
- 使用函数式组件 + Hooks，不使用 class 组件
- 前端纯逻辑测试使用 Node 内置测试运行器，例如：

```bash
cd frontend
node --test \
  src/pages/TestDataManagement/csv.test.ts \
  src/pages/TaskResult/helpers.test.ts \
  src/pages/NewTask/helpers.test.ts \
  src/pages/ModelManagement/helpers.test.ts
```

---

## 常见问题

**Q: `cargo run` 时提示数据库连接失败**

确认 Docker 容器已启动且 healthcheck 通过：
```bash
docker compose ps
docker compose up -d  # 如果未运行
```

**Q: 前端 API 请求返回 404**

检查 `vite.config.ts` 的 proxy 配置，确保 `/api` 代理到 `http://localhost:8080`。

**Q: SQLx 编译报错 `DATABASE_URL not set`**

```bash
export DATABASE_URL=postgresql://postgres:password@localhost:5432/eval_tools
# 或确保 backend/.env 文件存在
```

**Q: LLM 调用超时**

默认超时 120s。如模型响应较慢，可在 `backend/src/llm/client.rs` 调整 `timeout(Duration::from_secs(120))`。

**Q: 如何切换到其他 LLM 提供商**

在【模型管理】页面新增模型配置，填入对应的 `api_url`（需兼容 OpenAI Chat Completions 格式）、`api_key` 和 `model_id` 即可。系统与具体 LLM 提供商解耦。
