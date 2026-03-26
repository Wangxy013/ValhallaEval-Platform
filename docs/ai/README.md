# AI 协作指南

本仓库将项目级 AI 协作流程维护在 `docs/ai/skills/` 下的中文文档中，而不是依赖个人本地工具配置。这些文档是唯一、可审计、可随仓库版本演进的工作流来源。

## 规范来源

`docs/ai/skills/` 下的项目 skill 文档定义了：

- 本仓库批准使用的 skill 集合
- 各类场景下应触发的 skill
- 每个 skill 需要达到的质量要求

## 适用工具

- Codex
- Claude Code
- Cursor

## 适配规则

`AGENTS.md`、`CLAUDE.md` 与 `.cursor/rules/project-skill-system.mdc` 只是工具适配层，必须引用 `docs/ai/skills/` 下的 canonical 文档，而不是各自维护另一套规则。

## 更新规则

若需调整项目级 AI 工作流，请优先修改 `docs/ai/skills/` 下的文档；只有在触发映射或工具接入方式变化时，才修改工具适配文件。
