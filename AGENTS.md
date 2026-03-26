# 仓库指南

## 项目结构与模块组织

此仓库分为 `backend/` 与 `frontend/` 两部分。Rust 后端位于 `backend/src/`，其中路由在 `routes/`，数据模型在 `models/`，数据库初始化在 `db/`，LLM 客户端代码在 `llm/`。SQL 迁移脚本存放在 `backend/migrations/`。React 前端位于 `frontend/src/`，API 封装在 `api/`，可复用 UI 组件在 `components/`，页面级屏幕在 `pages/`，共享类型在 `types/`。部署素材（如 `docker-compose*.yml`、`Dockerfile.*`、`docker/nginx.conf`）放在仓库根目录，文档集中在 `docs/`。

## 构建、测试与开发命令

使用 `./start.sh` 启动 PostgreSQL、8080 端口的后端以及 3000 端口的 Vite 前端；用 `./stop.sh` 停止堆栈。手动启动时依次运行 `docker compose up -d`、`cd backend && cargo run`、`cd frontend && npm run dev`。前端打包用 `cd frontend && npm run build`。后端质量检查：`cd backend && cargo fmt --check && cargo clippy -- -D warnings`。前端纯逻辑回归测试覆盖数据集导入助手、任务结果排序助手、阶段模型校验助手与模型掩码助手，统一执行 `cd frontend && node --test src/pages/TestDataManagement/csv.test.ts src/pages/TaskResult/helpers.test.ts src/pages/NewTask/helpers.test.ts src/pages/ModelManagement/helpers.test.ts`。

## 代码风格与命名约定

遵循 `.editorconfig`：`*.rs` 4 空格，`*.ts`、`*.tsx`、JSON、YAML、Shell 文件用 2 空格。Rust 模块与文件均使用 `snake_case`；结构体与 TypeScript/React 组件用 `PascalCase`；函数、Hook、局部变量保持 `camelCase`。已有前端页面一般采用 `pages/<Feature>/index.tsx`，API 模块按资源分组，如 `frontend/src/api/tasks.ts`。

## 开发工作流

所有新特性、缺陷修复、重构或行为调整必须在编写生产代码前使用 superpowers `test-driven-development` 技能，严格执行红绿重构（Red-Green-Refactor）流程：先写最小失效测试、确认因预期原因失败、再实现最简变更使测试通过、最后在保持通过状态的前提下重构。只有当是一次性原型、自动生成代码或纯配置变更时，须经显式同意后才能跳过 TDD。

## 测试指南

目前仓库没有浏览器级前端测试框架，关键纯逻辑回归测试集中在 `frontend/src/**.test.ts` 下的 Node 环境脚本。所有改动需通过 `cargo clippy`、`cargo fmt --check`、`cargo test`、上述 Node 回归测试以及 `cd frontend && npm run build`，并根据受影响的 UI/接口流手动验证一次。新任务创建相关工作必须保持三阶段模型拆分：推理模型根据评估模式可是一对多，验证模型与评估模型分别绑定且仅绑定一个模型。模型 API 密钥在创建后不得以明文再次暴露。新增后端逻辑应优先在关联模块附近编写 Rust 单元测试或在引入 `backend/tests/` 目录后增加集成测试。

## AI 协作规则

本仓库的项目级 AI 工作流以 `docs/ai/skills/skill-catalog.md` 为统一入口，以 `docs/ai/skills/` 下的中文 skill 文档为权威来源。所有工具入口文件都必须引用这套仓库内规则，而不是在各自配置中维护另一套独立流程。

### Skill 触发规则

- 多步骤实现任务开始前，先阅读 `docs/ai/skills/writing-plans.md`。
- 功能开发、缺陷修复、重构和行为变更默认遵循 `docs/ai/skills/test-driven-development.md`；若为纯文档、纯配置或纯工具适配文件改动，必须显式说明例外原因。
- 调试失败测试、运行时缺陷或不明确行为时，遵循 `docs/ai/skills/systematic-debugging.md`。
- 在声称任务完成前，必须执行 `docs/ai/skills/verification-before-completion.md` 中的验证和提交安全检查。
- 对于广泛、高风险、跨模块或评审敏感的改动，遵循 `docs/ai/skills/requesting-code-review.md` 与 `docs/ai/skills/receiving-code-review.md`。
- 当需求引入新行为、方案不清晰或存在多种实现路径时，先执行 `docs/ai/skills/brainstorming.md`。
- 仅当任务确实需要隔离环境或能够清晰拆分时，才使用 `docs/ai/skills/using-git-worktrees.md` 与 `docs/ai/skills/subagent-driven-development.md`。

本地工具自带的 skill、个人偏好配置或插件规则都不能覆盖上述仓库级工作流要求。

## 提交与拉取请求指南

提交信息遵循 Conventional Commits 规范（例如 `feat:`、`fix:`、`docs:`、`chore:`），保持简洁且命令式。PR 目标分支为 `main`，需说明变更内容与动机、列出测试步骤、使用 `Closes #N` 关联问题，并附带 UI 改动截图。若变更影响 API，请同步更新 `docs/api-reference.md`；若变更涉及用户流程，请同步更新 `docs/user-guide/`。

任何预计推送到 GitHub 远程仓库的提交，都必须在提交或推送前完成一次以提交范围为单位的安全审查，确认 staged 内容不包含：

- 明文密钥、API Key、Token、凭据或其他敏感信息
- 仅供内部使用的功能、脚本、配置、文档、说明或非公开流程
- 仅供本地环境使用的文件、缓存、临时产物或不应进入开源仓库的内容
- 任何不符合开源发布规范的产物
