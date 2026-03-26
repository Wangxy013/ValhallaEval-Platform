# 文档一致性同步设计

## 目标

在不扩大到用户操作章节正文的前提下，将本次新增的项目级 AI 协作规范同步到仓库的主要文档入口，避免 `docs/ai/` 已经落地但 `README`、开发指南和贡献指南仍然缺失对应说明，导致文档入口分叉。

## 背景

仓库已经新增了以下项目级规范产物：

- `docs/ai/README.md`
- `docs/ai/skills/*.md`
- `AGENTS.md`
- `CLAUDE.md`
- `.cursor/rules/project-skill-system.mdc`

这些内容已经构成一套完整的项目级 AI 协作规范，但现有文档入口仍停留在旧状态：

- `README.md` 没有介绍项目级 AI 协作规范入口
- `docs/development.md` 没有说明研发阶段默认应遵循的 skill 工作流
- `CONTRIBUTING.md` 没有纳入提交前的 GitHub / 开源安全审查
- `docs/user-guide/README.md` 作为文档导航入口，没有区分“用户使用文档”和“研发协作文档”

## 范围

本次同步仅覆盖以下入口文档：

- `README.md`
- `docs/development.md`
- `CONTRIBUTING.md`
- `docs/user-guide/README.md`

本次不同步以下内容：

- `docs/user-guide/01-07` 具体用户操作章节
- `docs/api-reference.md`
- `docs/architecture.md`
- `docs/deployment.md`

## 方案

采用“入口文档同步 + 用户文档边界保持清晰”的方式：

1. 在 `README.md` 增加“AI 协作与贡献规范”一节
2. 在 `docs/development.md` 增加“AI 协作工作流”章节
3. 在 `CONTRIBUTING.md` 增加“AI 协作规范入口”和“提交前开源安全审查”要求
4. 在 `docs/user-guide/README.md` 增加面向研发/维护者的轻量导航，不把研发规范混入具体用户操作章节

## 为什么不修改用户操作章节正文

`docs/user-guide/01-07` 面向的是产品使用者，主要回答“系统怎么用”。本次新增的是研发协作规范，核心读者是维护者、贡献者和使用 AI 编码工具的开发者。

如果把项目级 skill、提交前安全审查或 AI 协作规则直接写进用户操作章节，会产生两个问题：

1. 读者角色混乱，最终用户会看到与自己无关的研发流程说明
2. 用户手册会掺入开发规范，后续维护边界不清晰

因此，这次只在 `docs/user-guide/README.md` 增加导引，把研发读者引导到 `docs/ai/` 与开发指南。

## 具体设计

### `README.md`

新增一节，说明：

- 仓库已经引入项目级 AI 协作规范
- 规范入口在 `docs/ai/README.md`
- 研发贡献者还应阅读 `docs/development.md` 与 `CONTRIBUTING.md`

### `docs/development.md`

新增“AI 协作工作流”章节，明确：

- `docs/ai/skills/skill-catalog.md` 是统一入口
- 默认必用 skill：`writing-plans`、`test-driven-development`、`verification-before-completion`、`systematic-debugging`
- 重要改动必用 skill：`requesting-code-review`、`receiving-code-review`
- 按需启用 skill：`brainstorming`、`using-git-worktrees`、`subagent-driven-development`
- 每次准备推送到 GitHub 前，必须进行提交范围安全审查

### `CONTRIBUTING.md`

新增或补强两类内容：

- 贡献者在开始前应阅读 `docs/ai/README.md` 和 `docs/ai/skills/skill-catalog.md`
- 提交前除原有质量检查外，还必须确认本次提交不包含敏感信息、内部专用内容或本地专用产物

### `docs/user-guide/README.md`

只增加一个轻量提示：

- 如果读者是研发或维护人员，请优先阅读 `docs/ai/README.md` 与 `docs/development.md`

不加入 skill 细节，不加入提交规则，不改用户操作流程内容。

## 风险与控制

### 风险一：README 变得过长

控制方式：

- 只增加一个简短入口段落
- 不在 README 里重复 skill 细节

### 风险二：开发指南与贡献指南内容重复

控制方式：

- `docs/development.md` 强调研发工作流
- `CONTRIBUTING.md` 强调贡献与提交流程

### 风险三：用户文档被研发内容污染

控制方式：

- `docs/user-guide/README.md` 仅做导引，不展开研发规范

## 验收标准

满足以下条件时，本次同步视为完成：

1. 四个入口文档都能找到项目级 AI 协作规范的正确入口
2. `README.md`、`docs/development.md`、`CONTRIBUTING.md` 之间职责清晰，不大段重复
3. `docs/user-guide/README.md` 只做研发导航，不污染用户操作章节
4. 文档内容与现有 `docs/ai/` 规范一致
