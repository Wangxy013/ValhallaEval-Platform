# API 接口参考

所有接口前缀：`/api/v1`

**响应格式（统一信封）**

```json
// 成功
{ "success": true, "data": <payload> }

// 失败
{ "success": false, "error": "错误描述" }
```

---

## 目录

- [模型配置](#模型配置)
- [Prompt 管理](#prompt-管理)
- [测试数据集](#测试数据集)
- [任务管理](#任务管理)
- [任务执行](#任务执行)
- [验证校验](#验证校验)
- [评估](#评估)
- [结果查询](#结果查询)
- [进度查询](#进度查询)
- [结果查询](#结果查询)

---

## 模型配置

### 获取模型列表

```
GET /api/v1/models
```

**响应 `data`**

```json
[
  {
    "id": "uuid",
    "name": "豆包 Pro",
    "provider": "doubao",
    "api_key": "sk-***",
    "api_url": "https://ark.cn-beijing.volces.com/api/v3",
    "model_id": "ep-xxx",
    "extra_config": null,
    "created_at": 1711200000,
    "updated_at": 1711200000
  }
]
```

### 创建模型

```
POST /api/v1/models
```

**请求体**

```json
{
  "name": "豆包 Pro",
  "provider": "doubao",
  "api_key": "sk-your-key",
  "api_url": "https://ark.cn-beijing.volces.com/api/v3",
  "model_id": "ep-your-endpoint-id"
}
```

### 获取单个模型

```
GET /api/v1/models/:id
```

### 更新模型

```
PUT /api/v1/models/:id
```

请求体字段均为可选，与创建相同。

### 删除模型

```
DELETE /api/v1/models/:id
```

---

## Prompt 管理

### 获取 Prompt 列表

```
GET /api/v1/prompts
```

**响应 `data`**

```json
[
  {
    "id": "uuid",
    "name": "答题助手",
    "version": "v2",
    "content": "你是一个专业的教育助手...",
    "change_notes": "优化了输出格式要求",
    "parent_id": "uuid-of-v1",
    "created_at": 1711200000,
    "updated_at": 1711200000
  }
]
```

### 创建 Prompt

```
POST /api/v1/prompts
```

**请求体**

```json
{
  "name": "答题助手",
  "version": "v2",
  "content": "你是一个专业的教育助手，请按照以下格式回答...",
  "change_notes": "新增格式约束",
  "parent_id": "uuid-of-parent-version"
}
```

`change_notes` 和 `parent_id` 为可选。

### 获取 / 更新 / 删除

```
GET    /api/v1/prompts/:id
PUT    /api/v1/prompts/:id
DELETE /api/v1/prompts/:id
```

---

## 测试数据集

### 数据集 CRUD

```
GET    /api/v1/datasets            # 获取列表
POST   /api/v1/datasets            # 创建数据集
GET    /api/v1/datasets/:id        # 获取单个
PUT    /api/v1/datasets/:id        # 更新
DELETE /api/v1/datasets/:id        # 删除（级联删除测试数据）
```

**创建数据集请求体**

```json
{
  "name": "数学题测试集",
  "description": "初中数学选择题样本"
}
```

### 测试数据 CRUD

```
GET    /api/v1/datasets/:id/items                # 获取数据项列表
POST   /api/v1/datasets/:id/items                # 添加数据项
DELETE /api/v1/datasets/:id/items/:item_id       # 删除数据项
```

**创建测试数据请求体**

```json
{
  "content": "已知三角形三边长分别为3、4、5，求最大角的度数。",
  "order_index": 0
}
```

---

## 任务管理

### 创建任务

```
POST /api/v1/tasks
```

**请求体**

```json
{
  "name": "答题助手 v1 vs v2 效果对比",
  "description": "验证 v2 格式优化是否生效",
  "eval_type": "prompt_comparison",
  "model_config_ids": ["model-uuid"],
  "prompt_ids": ["prompt-v1-uuid", "prompt-v2-uuid"],
  "dataset_id": "dataset-uuid",
  "test_item_ids": ["item-1-uuid", "item-2-uuid"],
  "repeat_count": 1,
  "assessment_mode": "auto",
  "validation_checkpoints": [
    { "name": "格式规范", "criterion": "输出必须包含【答案】和【解析】两个部分" },
    { "name": "内容准确", "criterion": "计算结果应与标准答案一致" }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `eval_type` | string | ✓ | `prompt_comparison` 或 `model_comparison` |
| `model_config_ids` | string[] | ✓ | Prompt 对比模式需恰好 1 个；模型对比需 2+ 个 |
| `prompt_ids` | string[] | ✓ | Prompt 对比模式需 2+ 个；模型对比需恰好 1 个 |
| `test_item_ids` | string[] | ✓ | 选中的测试数据 ID，任务创建时立即快照 |
| `repeat_count` | number | — | 每条数据重复次数，默认 1，最大建议 5 |
| `assessment_mode` | string | — | `manual`/`auto`/`custom`，默认 `manual` |
| `validation_checkpoints` | array | — | 校验检查点，不填则无法使用验证校验功能 |

**响应 `data`**：创建后的完整任务对象（含 `prompts`、`models`、`test_items` 关联数据）

### 获取任务列表

```
GET /api/v1/tasks
```

按 `created_at` 倒序排列。

### 获取单个任务（含关联数据）

```
GET /api/v1/tasks/:id
```

**响应 `data`**

```json
{
  "task": { "id": "...", "name": "...", "status": "completed", "eval_type": "prompt_comparison", ... },
  "prompts": [{ "id": "tp-uuid", "task_id": "...", "prompt_id": "...", "label": null, "prompt": {...} }],
  "models":  [{ "id": "tm-uuid", "task_id": "...", "model_config_id": "...", "model": {...} }],
  "test_items": [{ "id": "tti-uuid", "content_snapshot": "...", "order_index": 0 }]
}
```

### 更新 / 删除任务

```
PUT    /api/v1/tasks/:id
DELETE /api/v1/tasks/:id    # 级联删除所有关联数据
```

---

## 任务执行

### 开始执行

```
POST /api/v1/tasks/:id/execute
```

立即返回，后台异步推理。任务状态变为 `running`。

**前置条件**
- 任务状态为 `draft` 或 `failed`
- 已配置至少 1 个模型和测试数据

### 暂停

```
POST /api/v1/tasks/:id/pause
```

任务状态变为 `paused`，已提交的 LLM 调用继续完成，新的不再发起。

### 继续

```
POST /api/v1/tasks/:id/resume
```

从暂停状态恢复，继续推理未完成的数据。

### 获取运行记录

```
GET /api/v1/tasks/:id/runs
```

**响应 `data`**：eval_run 数组，每条记录包含：

```json
{
  "id": "run-uuid",
  "task_id": "...",
  "task_prompt_id": "tp-uuid",
  "task_model_id": "tm-uuid",
  "task_test_item_id": "tti-uuid",
  "repeat_index": 0,
  "status": "completed",
  "input_messages": [
    { "role": "system", "content": "你是..." },
    { "role": "user", "content": "计算题目..." }
  ],
  "output_content": "【答案】90°\n【解析】...",
  "tokens_used": 256,
  "duration_ms": 1823,
  "prompt_label": "答题助手 (v2)",
  "model_label": "豆包 Pro",
  "test_item_content": "已知三角形...",
  "validation_results": [
    {
      "checkpoint_id": "cp-uuid",
      "checkpoint_name": "格式规范",
      "checkpoint_criterion": "输出必须包含【答案】和【解析】两个部分",
      "result": "pass",
      "comment": "输出包含了【答案】和【解析】两个部分，格式符合要求。",
      "annotations": []
    }
  ],
  "assessment_results": [
    {
      "mode": "auto",
      "score": 9.0,
      "comment": "回答准确完整，格式规范",
      "details": {
        "checkpoint_scores": [
          { "name": "格式规范", "passed": true, "score": 10, "comment": "..." }
        ],
        "strengths": ["格式清晰"],
        "weaknesses": []
      }
    }
  ]
}
```

---

## 验证校验

### 校验点管理

```
GET    /api/v1/tasks/:id/checkpoints              # 获取所有校验点
POST   /api/v1/tasks/:id/checkpoints              # 新增校验点
PUT    /api/v1/tasks/:id/checkpoints/:checkpoint_id
DELETE /api/v1/tasks/:id/checkpoints/:checkpoint_id
```

**创建校验点请求体**

```json
{
  "name": "格式规范",
  "criterion": "输出必须同时包含【答案】标签和【解析】标签",
  "order_index": 0
}
```

### 触发自动校验

```
POST /api/v1/tasks/:id/validate
```

**前置条件**：任务已有完成状态的 eval_run，且已配置至少 1 个校验点。

**行为**：异步，对每条 `completed` 的 eval_run × 每个 checkpoint，调用 LLM 裁判判断 PASS/FAIL，结果写入 `validation_results`。已校验的配对自动跳过（幂等）。

---

## 评估

### 触发自动评估

```
POST /api/v1/tasks/:id/assess
```

异步，对每条 `completed` 的 eval_run 调用 LLM 进行 0-10 分评分。若任务配置了验证点，评分 prompt 会包含验证标准，返回 `checkpoint_scores`。已评估的 run 自动跳过。

### 提交人工评估

```
POST /api/v1/tasks/:id/assessment
```

**请求体**

```json
{
  "eval_run_id": "run-uuid",
  "score": 8.5,
  "comment": "回答准确，但格式可以更简洁"
}
```

### 获取评估结果

```
GET /api/v1/tasks/:id/assessment
```

返回该任务所有 eval_run 的评估记录。

---

## 结果查询

### 获取总览统计

```
GET /api/v1/tasks/:id/results/overview
```

**响应 `data`**

```json
{
  "total_runs": 20,
  "completed_runs": 20,
  "failed_runs": 0,
  "avg_tokens": 312.5,
  "avg_duration_ms": 1854.3,
  "validation": { "pass": 35, "fail": 5 },
  "validation_pass_rate": 0.875,
  "avg_assessment_score": 8.2,
  "by_prompt": [
    { "label": "答题助手 (v1)", "total": 10, "completed": 10, "pass_count": 15, "pass_rate": 0.75, "avg_score": 7.8 },
    { "label": "答题助手 (v2)", "total": 10, "completed": 10, "pass_count": 20, "pass_rate": 1.0,  "avg_score": 9.1 }
  ],
  "by_model": [],
  "by_checkpoint": [
    { "name": "格式规范", "criterion": "...", "pass_count": 18, "eval_count": 20, "pass_rate": 0.9 },
    { "name": "内容准确", "criterion": "...", "pass_count": 17, "eval_count": 20, "pass_rate": 0.85 }
  ],
  "by_checkpoint_prompt": [
    { "checkpoint_name": "格式规范", "criterion": "...", "order_index": 0, "group_label": "答题助手 (v1)", "pass_count": 7,  "eval_count": 10, "pass_rate": 0.7 },
    { "checkpoint_name": "格式规范", "criterion": "...", "order_index": 0, "group_label": "答题助手 (v2)", "pass_count": 10, "eval_count": 10, "pass_rate": 1.0 },
    { "checkpoint_name": "内容准确", "criterion": "...", "order_index": 1, "group_label": "答题助手 (v1)", "pass_count": 8,  "eval_count": 10, "pass_rate": 0.8 },
    { "checkpoint_name": "内容准确", "criterion": "...", "order_index": 1, "group_label": "答题助手 (v2)", "pass_count": 9,  "eval_count": 10, "pass_rate": 0.9 }
  ],
  "by_checkpoint_model": []
}
```

`by_checkpoint_prompt` / `by_checkpoint_model` 是用于渲染对比矩阵的扁平数组，前端按 `checkpoint_name` 和 `group_label` 聚合为透视表。

---

## 进度查询

### 获取任务执行进度

```
GET /api/v1/tasks/:id/progress
```

轻量级接口，返回三个阶段的实时计数，用于前端进度轮询（建议间隔 2s）。

**响应 `data`**

```json
{
  "inference": {
    "total": 6,
    "completed": 6,
    "failed": 0
  },
  "validation": {
    "checkpoint_count": 2,
    "expected": 12,
    "done": 12,
    "pending": 0,
    "pass": 11,
    "fail": 1
  },
  "assessment": {
    "expected": 6,
    "done": 6
  }
}
```

| 字段 | 含义 |
|---|---|
| `validation.expected` | `completed_runs × checkpoint_count` |
| `validation.done` | status IN ('pass','fail','error') 的记录数 |
| `validation.pending` | status='pending' 的记录数（>0 表示校验进行中） |
| `assessment.done` | 已完成自动评估的 eval_run 数（按 mode='auto' 去重） |

---

## 创建任务新增字段

`POST /api/v1/tasks` 的请求体新增以下字段（可选）：

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `concurrency` | number | 3 | 三个阶段同时发起的最大 LLM 请求数，范围 1-20，建议 3-5 |
