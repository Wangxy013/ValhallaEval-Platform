# AI Worktree 分支命名设计

## 目标

统一项目内基于 Git worktree 的分支命名方式，区分 AI 自动创建的分支与人类手工创建的分支，降低分支命名混乱和历史难以识别的问题。

## 规则

### AI 自动创建的分支

统一使用：

```text
feature/ai/<slug>
```

其中 `<slug>` 使用简短的英文 kebab-case，描述任务主题即可。

### 人类手工创建的分支

继续使用：

```text
feature/<slug>
```

## 设计原则

1. AI 分支统一归到 `feature/ai/` 下面，不再根据任务类型切成 `docs/...`、`fix/...`、`chore/...` 等前缀。
2. 人类分支仍保持原有 `feature/<slug>` 约定，不增加额外层级。
3. 这是一条项目级协作规则，应写入仓库文档，而不是只依赖某个工具的本地配置。

## 落地范围

本次仅更新文档规则：

- `docs/ai/skills/using-git-worktrees.md`
- `CONTRIBUTING.md`
- `docs/development.md`
- `AGENTS.md`

本次不做：

- 脚本自动生成分支名
- CI / Hook 校验
- Cursor / Claude / Codex 的额外分支名自动化实现

## 为什么这样设计

### 只给 AI 增加 `ai` 层级

这样在远程仓库、PR 列表和 git 历史里，可以一眼看出哪些分支是 AI 自动创建的隔离工作区产物，便于管理和回溯。

### 不让 AI 根据类型切换前缀

如果 AI 分支时而是 `docs/...`、时而是 `fix/...`、时而是 `feature/...`，团队很难形成稳定约定。统一为 `feature/ai/<slug>` 更简单，也更容易在文档中明确。

## 验收标准

满足以下条件时视为完成：

1. `docs/ai/skills/using-git-worktrees.md` 明确了 AI 与人工分支的命名规则
2. `CONTRIBUTING.md` 对贡献者可见这条规则
3. `docs/development.md` 对开发流程可见这条规则
4. `AGENTS.md` 对 AI 执行 worktree 流程可见这条规则
