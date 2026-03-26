# AI Worktree 分支命名实施计划

> **面向执行代理：** 推荐使用 `superpowers:executing-plans` 或直接按本计划顺序执行。任务跟踪使用 `- [ ]` 复选框。

**目标：** 将 AI 自动创建 worktree 分支统一规范为 `feature/ai/<slug>`，并在项目文档中同步人工分支仍使用 `feature/<slug>` 的约定。

**总体思路：** 只改文档，不改脚本和自动化。把命名规则写进项目级 skill 文档、开发文档、贡献文档和 AI 入口文档，确保人和工具看到的是同一套规则。

**技术栈：** Markdown、仓库文档、git

---

## 目标文件

- 更新 `docs/ai/skills/using-git-worktrees.md`
- 更新 `CONTRIBUTING.md`
- 更新 `docs/development.md`
- 更新 `AGENTS.md`

## 任务 1：更新 worktree skill 文档

- [ ] 在 `docs/ai/skills/using-git-worktrees.md` 中明确：
  - AI 自动创建的 worktree 分支必须使用 `feature/ai/<slug>`
  - 人工分支继续使用 `feature/<slug>`
  - `<slug>` 使用简短英文 kebab-case

## 任务 2：更新贡献指南

- [ ] 在 `CONTRIBUTING.md` 的开发流程中同步分支命名规则
- [ ] 明确人工分支与 AI worktree 分支的区分

## 任务 3：更新开发指南

- [ ] 在 `docs/development.md` 的 AI 协作工作流或开发流程相关章节中补充分支命名约定
- [ ] 强调 worktree / 分支命名属于项目级协作规则的一部分

## 任务 4：更新 AGENTS 入口

- [ ] 在 `AGENTS.md` 中增加一句：
  - 当 AI 执行 `using-git-worktrees` 时，分支名必须为 `feature/ai/<slug>`

## 任务 5：一致性检查

- [ ] 检查四个文件中这条规则表述一致
- [ ] 检查没有把规则写成多个冲突版本
- [ ] 检查文档仍保持各自职责，不重复展开过多细节

建议命令：

```bash
rg -n "feature/ai/|feature/<slug>|worktree|分支" docs/ai/skills/using-git-worktrees.md CONTRIBUTING.md docs/development.md AGENTS.md
```
