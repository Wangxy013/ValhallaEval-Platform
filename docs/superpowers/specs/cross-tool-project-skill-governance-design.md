# 跨工具项目级 Skill 治理设计

## 目标

建立一套仓库自有、跨工具通用的 AI 协作结构，使使用 Codex、Claude Code、Cursor 的成员都能遵循同一套项目级 skill 规则，而不依赖各自本地工具是否安装了相同的 skill。

## 问题背景

当前仓库只有一个项目级入口文件 `AGENTS.md`，缺少一套工具无关、可版本化、可评审的 AI 协作规范来源。这样会带来两个直接问题：

1. 不同工具各自维护规则时，内容容易漂移。
2. 团队流程依赖个人本地配置，无法随仓库统一审查和演进。

## 设计范围

本设计覆盖：

- 项目级 skill 文档目录结构
- Codex、Claude Code、Cursor 的适配入口文件
- 推荐 skill 的触发规则
- 中文项目文档要求
- 面向 GitHub 开源仓库的提交前安全审查要求

本设计不覆盖：

- CI 强制校验
- Git Hook 自动化
- 本地工具安装说明

## 核心方案

采用两层结构：

1. 仓库内唯一权威来源：`docs/ai/skills/`
2. 各工具的薄适配层：`AGENTS.md`、`CLAUDE.md`、`.cursor/rules/project-skill-system.mdc`

这意味着：

- 真正的项目规范写在仓库里，而不是写在某个工具的私有配置中。
- 工具适配层只负责把工具接到这套规范上，不再各自重复写一份长规则。
- 团队对流程的任何修改，都通过 git review 和仓库历史来管理。

## 备选方案对比

### 方案一：每个工具各写一份完整规则

不采用，原因是：

- 内容容易分叉
- 每次调整都要改多处
- 团队无法明确“唯一事实源”

### 方案二：仓库级规范正文 + 工具适配层

采用，原因是：

- 维护成本最低
- 最适合跨工具协作
- 规则可随仓库一起评审和演进

### 方案三：完全依赖 CI / 脚本强制

本阶段不采用，原因是：

- CI 只能兜底结果，不能替代实现阶段的过程指导
- 范围超出这次仓库结构治理目标

## 目标目录结构

```text
docs/ai/
  README.md
  skills/
    skill-catalog.md
    writing-plans.md
    test-driven-development.md
    systematic-debugging.md
    verification-before-completion.md
    requesting-code-review.md
    receiving-code-review.md
    brainstorming.md
    using-git-worktrees.md
    subagent-driven-development.md
```

工具适配层：

```text
AGENTS.md
CLAUDE.md
.cursor/
  rules/
    project-skill-system.mdc
```

## 文件职责

### `docs/ai/README.md`

作为项目 AI 协作体系入口，说明：

- 为什么采用仓库级 skill 文档
- 哪些工具接入这套体系
- canonical 文档存放在哪
- 规则更新时应该修改哪里

### `docs/ai/skills/skill-catalog.md`

作为总目录，负责说明：

- 默认必用 skill
- 重要改动必用 skill
- 按需启用 skill
- 每个 skill 的触发说明

### 各 skill 正文文件

每个文件只说明一个 workflow 的项目级要求，不复制整个目录。

- `writing-plans.md`：多步骤实现前如何规划
- `test-driven-development.md`：测试优先的执行要求
- `systematic-debugging.md`：调试与定位流程
- `verification-before-completion.md`：完成前验证与提交安全审查
- `requesting-code-review.md`：何时发起评审
- `receiving-code-review.md`：如何处理评审反馈
- `brainstorming.md`：何时先做方案设计
- `using-git-worktrees.md`：何时需要隔离工作区
- `subagent-driven-development.md`：何时可以拆分并行执行

## 工具适配层职责

### `AGENTS.md`

保留仓库原有开发约束，同时接入 `docs/ai/skills/` 作为项目级 AI 工作流来源。

### `CLAUDE.md`

作为 Claude Code 的薄适配层，直接引用仓库 skill 文档，不另起一套规则。

### `.cursor/rules/project-skill-system.mdc`

作为 Cursor 的薄适配层，提供与 `AGENTS.md`、`CLAUDE.md` 一致的触发映射。

## Skill 触发模型

### 默认必用

- `writing-plans`
- `test-driven-development`
- `verification-before-completion`
- `systematic-debugging`

### 重要改动必用

- `requesting-code-review`
- `receiving-code-review`

### 按需启用

- `brainstorming`
- `using-git-worktrees`
- `subagent-driven-development`

## 团队协作规则

为保证跨工具协作一致性，约定如下：

1. `docs/ai/skills/` 是项目级 workflow 的唯一权威来源。
2. 工具适配文件只做引用与触发映射，不重写完整规范。
3. 所有项目级 skill 文档统一使用中文。
4. 规则变化优先修改 canonical 文档，再视情况调整工具适配层。
5. 任何将推送到 GitHub 的提交，都必须做提交范围安全审查。

## GitHub 开源提交安全要求

提交前必须检查 staged 内容是否包含：

- 明文密钥、API Key、Token、凭据或其他敏感信息
- 内部专用功能、脚本、说明或不适合公开的流程
- 仅本地环境使用的配置、缓存、环境文件、临时产物
- 任何不符合开源发布规范、不应进入远程仓库的内容

## 初始落地内容

本次落地应完成：

- 新建 `docs/ai/README.md`
- 新建 `docs/ai/skills/*.md`
- 更新 `AGENTS.md`
- 新建 `CLAUDE.md`
- 新建 `.cursor/rules/project-skill-system.mdc`

## 验收标准

满足以下条件时，设计视为落地成功：

1. 仓库内存在完整的项目级中文 skill 文档。
2. `AGENTS.md`、`CLAUDE.md`、Cursor 规则都引用同一套 canonical docs。
3. 推荐 skill 与触发条件已清晰记录。
4. 提交前安全审查要求已写入项目级规范。
5. 该体系可被混合工具团队直接使用，而不依赖个人本地 skill 配置。
