# 文档一致性同步实施计划

> **面向执行代理：** 推荐使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 按任务逐项执行。任务跟踪使用 `- [ ]` 复选框。

**目标：** 在不污染用户操作章节正文的前提下，将新增的项目级 AI 协作规范同步到仓库的主要文档入口。

**总体思路：** 只修改 `README.md`、`docs/development.md`、`CONTRIBUTING.md`、`docs/user-guide/README.md` 四个入口文件。`docs/ai/` 仍然是唯一权威来源；入口文档只负责给出导航、工作流说明和开源提交安全要求，不重复整套 skill 规则。

**技术栈：** Markdown、仓库文档、git

---

## 目标文件

- 更新 `README.md`
- 更新 `docs/development.md`
- 更新 `CONTRIBUTING.md`
- 更新 `docs/user-guide/README.md`

## 任务 1：同步顶层 README

**涉及文件：**

- `README.md`

- [ ] 新增“AI 协作与贡献规范”章节。
- [ ] 链接到 `docs/ai/README.md`、`docs/development.md`、`CONTRIBUTING.md`。
- [ ] 保持 README 仍以项目总览为主，不在其中展开整套 skill 细节。

## 任务 2：同步开发指南

**涉及文件：**

- `docs/development.md`

- [ ] 新增“AI 协作工作流”章节。
- [ ] 说明 `docs/ai/skills/skill-catalog.md` 是统一入口。
- [ ] 明确默认必用、重要改动必用、按需启用的 skill 分组。
- [ ] 明确提交前必须做 GitHub / 开源安全审查。

## 任务 3：同步贡献指南

**涉及文件：**

- `CONTRIBUTING.md`

- [ ] 增加“AI 协作规范入口”章节。
- [ ] 引导贡献者先阅读 `docs/ai/README.md` 与 `docs/ai/skills/skill-catalog.md`。
- [ ] 在提交前检查项中加入敏感信息、内部专用内容、本地专用产物和开源合规审查。

## 任务 4：同步用户手册入口

**涉及文件：**

- `docs/user-guide/README.md`

- [ ] 只增加轻量导引。
- [ ] 明确研发/维护人员应优先阅读 `docs/ai/README.md`、`docs/development.md`、`CONTRIBUTING.md`。
- [ ] 不把 skill 规则或贡献流程写进用户操作章节正文。

## 任务 5：一致性检查

- [ ] 检查四个入口文档都能正确指向 `docs/ai/`。
- [ ] 检查 `docs/user-guide/README.md` 仍然以用户使用内容为主。
- [ ] 检查没有大段重复 `docs/ai/skills/*.md` 的正文。

建议命令：

```bash
rg -n "docs/ai/README.md|docs/ai/skills/skill-catalog.md|AI 协作|GitHub|开源" README.md docs/development.md CONTRIBUTING.md docs/user-guide/README.md
```

## 任务 6：提交前安全审查

- [ ] 审查本次 staged 内容是否只包含文档更新。
- [ ] 审查 staged 内容是否不含密钥、Token、凭据、内部专用内容和本地专用产物。
- [ ] 审查 staged 内容是否符合 GitHub 开源仓库发布规范。

建议命令：

```bash
git diff --cached --stat
git diff --cached
```

## 任务 7：最终提交

- [ ] 仅提交本次文档一致性同步相关文件。
- [ ] 提交信息使用 `docs:` 前缀。
- [ ] 在最终说明中记录验证结果与开源安全审查结论。
