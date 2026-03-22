# Changelog

所有重要变更都会记录在本文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [0.3.0] - 2026-03-23

### 修复（端到端验证发现）

- **关键修复**：后端重启后旧进程持续运行导致代码变更未生效，补充重启说明
- **输入校验**：`create_task` 增加 `eval_type` 枚举校验（必须为 `prompt_comparison` 或 `model_comparison`）
- **输入校验**：`create_task` 增加任务名非空校验
- **引用完整性**：`create_task` 新增对 `model_config_ids` 和 `prompt_ids` 的存在性验证，传入不存在的 ID 返回 400
- **引用保护**：`delete_model` 新增引用检查，模型被任务引用时返回 409 而非直接删除
- **404 一致性**：`GET /tasks/:id/runs` 和 `GET /tasks/:id/results/overview` 对不存在任务返回 404，与其他接口一致
- **检查点排序**：`POST /tasks/:id/checkpoints` 自动计算 `order_index`（`max + 1`），不再强制为 0
- **JSON 错误格式统一**：新增 `AppJson<T>` 自定义提取器，将 Axum 默认的 422 纯文本错误转换为标准 `{"success": false, "error": "..."}` JSON 格式

### 新增

- 完整的体系化文档（README、技术架构、API 参考、开发指南、部署指南、用户手册共 13 个文件）
- Git 仓库初始化及首次提交

---

## [0.2.0] - 2026-03-23

### 新增

- **验证点对比矩阵**：总览页新增 `验证点 × Prompt/模型版本` 透视表，每格显示通过率进度条及与基准版本的 `±N%` delta 标签
- **差异高亮**：明细页同一测试数据多版本并排展示时，自动分析并标注改善（↑）/退步（↓）/一致的验证点
- **检查点感知自动评估**：自动评估时 LLM prompt 纳入所有验证点标准，返回 `checkpoint_scores`（各验证点子评分）
- **总览空状态引导**：整体通过率、平均评分为空时，显示说明文字和操作引导
- **校验检查点展示**：任务总览卡片中展示已配置的校验点列表，hover 可查看完整标准

### 修复

- **关键修复**：`CreateTask` 结构体新增 `validation_checkpoints` 和 `test_item_ids` 字段，此前前端提交的检查点和测试数据选择被后端静默丢弃，导致"运行校验"始终报错
- **测试数据选择**：`execute_task` 改为使用任务创建时快照的 `task_test_items`，不再忽略用户勾选，回退到全量数据集加载
- **按钮禁用逻辑**：无检查点时"运行校验"按钮禁用并显示原因 tooltip
- **筛选器修复**：明细页筛选从 server-side 改为 client-side，正确关联 `task_prompt_id`/`task_model_id`

### 改进

- 明细页按测试数据分组，多版本并排展示（2版本→50/50，3版本→33/33/33）
- RunCard 校验结果显示验证点名称、截断版标准文字及着色背景卡片
- RunCard 评估结果展示所有 `assessment_results`（不再只取第一条），按模式打标签
- 任务运行中自动轮询刷新（3s interval）
- 修复 `getCheckboxProps` checkbox 逻辑，正确判断当前行是否已选中

---

## [0.1.0] - 2026-03-20

### 新增

- 完整的项目骨架（Rust + Axum 后端 + React + TypeScript 前端）
- PostgreSQL 数据库模型与 SQLx 迁移脚本
- 模型管理：支持 OpenAI-compatible 多模型配置（豆包、星火等）
- Prompt 管理：多版本 Prompt 录入、版本命名、修改说明
- 测试数据管理：数据集创建、测试数据录入与管理
- 任务创建向导（5 步）：基本信息 → 选模型 → 选 Prompt → 测试数据 → 校验与评估
- 任务执行：异步批量推理，支持暂停/继续
- 评测执行：支持 `prompt_comparison`（多 Prompt 对比）和 `model_comparison`（多模型对比）
- 验证校验：LLM 裁判按自定义标准判断每条输出 PASS/FAIL
- 评估模式：人工评估、模型自动评分（0-10）、自定义规则
- 任务总览：运行数统计、验证通过率、评分汇总、按 Prompt/模型分组对比
- 任务明细：扩展行查看输入/输出/校验/评估，支持选择两条对比查看
- 验证批注：输出文本内联高亮显示 PASS/FAIL 文本段
- Docker Compose 一键启动开发环境
- `dev.sh` 一键启动脚本
