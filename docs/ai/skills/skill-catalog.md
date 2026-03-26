# 项目 Skill 目录

这个文件用于快速说明本仓库在不同研发场景下要求 AI 编码工具应用哪些 skill。

## 默认必用

- `writing-plans`
- `test-driven-development`
- `verification-before-completion`
- `systematic-debugging`

## 重要改动必用

- `requesting-code-review`
- `receiving-code-review`

## 按需启用

- `brainstorming`
- `using-git-worktrees`
- `subagent-driven-development`

## 触发说明

### `writing-plans`

用于多步骤实现任务，尤其适用于同时涉及后端、前端、API 契约、共享类型、用户流程文档或多个业务流程的改动。

### `test-driven-development`

用于功能开发、缺陷修复、重构和行为变更。若为纯文档、纯配置或纯工具适配文件改动，必须显式说明为何属于例外。

### `verification-before-completion`

用于完成前校验。必须运行与改动范围匹配的仓库验证命令；若改动影响 UI 或 API 流程，还必须补充人工验证与提交范围安全审查。

### `systematic-debugging`

用于排查缺陷、失败测试、不稳定行为或运行时异常。

### `requesting-code-review`

用于广泛、高风险、跨模块或影响关键工作流的改动，在合并前触发。

### `receiving-code-review`

用于处理可能影响行为、范围或正确性的评审反馈。

### `brainstorming`

用于引入新行为、设计尚不明确或存在多种合理实现方案的场景。

### `using-git-worktrees`

用于大型功能、风险较高的重构或需要隔离开发环境的场景。

### `subagent-driven-development`

仅在任务可以被清晰拆分为独立子问题且不会削弱质量控制时使用。
