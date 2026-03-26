# 跨工具项目级 Skill 治理实施计划

> **面向执行代理：** 推荐使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 按任务逐项执行。任务跟踪使用 `- [ ]` 复选框。

**目标：** 建立一套仓库自有的项目级 skill 体系，使 Codex、Claude Code、Cursor 在同一仓库中遵循一致的 AI 协作流程。

**总体思路：** 以 `docs/ai/skills/` 作为 canonical skill 文档库，以 `AGENTS.md`、`CLAUDE.md`、`.cursor/rules/project-skill-system.mdc` 作为薄适配层。所有项目级文档统一使用中文，并在完成前执行 GitHub 开源提交安全审查。

**技术栈：** Markdown、仓库说明文件、Cursor 规则文件、git

---

## 目标文件

- 创建 `docs/ai/README.md`
- 创建 `docs/ai/skills/skill-catalog.md`
- 创建 `docs/ai/skills/writing-plans.md`
- 创建 `docs/ai/skills/test-driven-development.md`
- 创建 `docs/ai/skills/systematic-debugging.md`
- 创建 `docs/ai/skills/verification-before-completion.md`
- 创建 `docs/ai/skills/requesting-code-review.md`
- 创建 `docs/ai/skills/receiving-code-review.md`
- 创建 `docs/ai/skills/brainstorming.md`
- 创建 `docs/ai/skills/using-git-worktrees.md`
- 创建 `docs/ai/skills/subagent-driven-development.md`
- 更新 `AGENTS.md`
- 创建 `CLAUDE.md`
- 创建 `.cursor/rules/project-skill-system.mdc`

## 任务 1：建立 canonical 文档入口

**涉及文件：**

- `docs/ai/README.md`
- `docs/ai/skills/skill-catalog.md`

- [ ] 创建中文 `README.md`，说明 canonical 来源、适用工具和更新规则。
- [ ] 创建中文 `skill-catalog.md`，说明默认必用、重要改动必用、按需启用的 skill 集合。
- [ ] 校验两个文件都只作为入口和目录，不重复写整套细则。

## 任务 2：补齐全部项目级 skill 正文

**涉及文件：**

- `docs/ai/skills/writing-plans.md`
- `docs/ai/skills/test-driven-development.md`
- `docs/ai/skills/systematic-debugging.md`
- `docs/ai/skills/verification-before-completion.md`
- `docs/ai/skills/requesting-code-review.md`
- `docs/ai/skills/receiving-code-review.md`
- `docs/ai/skills/brainstorming.md`
- `docs/ai/skills/using-git-worktrees.md`
- `docs/ai/skills/subagent-driven-development.md`

- [ ] 所有文件统一使用中文。
- [ ] 每个文件采用一致骨架：适用场景、仓库要求、补充说明。
- [ ] 保持项目针对性，覆盖 Rust 后端、React 前端、Node helper 测试、三阶段模型拆分、API Key 掩码等约束。
- [ ] `verification-before-completion.md` 必须加入 GitHub 开源提交安全审查要求。

## 任务 3：更新 Codex 入口文件

**涉及文件：**

- `AGENTS.md`

- [ ] 将原有仓库规则转换为中文，保留项目结构、命令、测试和提交流程约束。
- [ ] 增加 AI 协作规则章节，指向 `docs/ai/skills/skill-catalog.md`。
- [ ] 增加中文 skill 触发映射。
- [ ] 增加提交范围安全审查要求。

## 任务 4：创建 Claude Code 与 Cursor 适配层

**涉及文件：**

- `CLAUDE.md`
- `.cursor/rules/project-skill-system.mdc`

- [ ] 两个文件都保持薄适配层风格，不重复 canonical 规则全文。
- [ ] 两个文件都指向 `docs/ai/skills/skill-catalog.md` 与对应 skill 文件。
- [ ] 两个文件都声明本地工具偏好不能覆盖仓库规则。
- [ ] 两个文件都加入 GitHub 开源提交安全审查要求。

## 任务 5：一致性检查

- [ ] 检查 `docs/ai/` 下文件是否齐全。
- [ ] 检查 `AGENTS.md`、`CLAUDE.md`、`.cursor/rules/project-skill-system.mdc` 是否都引用 `docs/ai/skills/`。
- [ ] 检查所有项目级文档是否均为中文。
- [ ] 检查是否仍存在明显占位词或未完成标记。

建议命令：

```bash
find docs/ai .cursor/rules -maxdepth 3 -type f | sort
rg -n "docs/ai/skills/" AGENTS.md CLAUDE.md .cursor/rules/project-skill-system.mdc
rg -n "TBD|TODO|place.holder|implement later|fill in details" docs/ai AGENTS.md CLAUDE.md .cursor/rules/project-skill-system.mdc
```

## 任务 6：仓库验证

- [ ] 执行 `cd frontend && npm run build`
- [ ] 执行 `cd backend && cargo fmt --check && cargo clippy -- -D warnings`
- [ ] 如有需要，补充 `cd backend && cargo test`

## 任务 7：提交前开源安全审查

- [ ] 审查 staged 内容是否包含明文密钥、Token、API Key 或其他凭据。
- [ ] 审查 staged 内容是否包含仅供内部使用的脚本、说明、流程或功能。
- [ ] 审查 staged 内容是否包含仅供本地使用的配置、缓存、环境文件、临时文件。
- [ ] 审查 staged 内容是否完全符合 GitHub 开源仓库发布规范。

建议命令：

```bash
git diff --cached --stat
git diff --cached
```

## 任务 8：最终提交整理

- [ ] 只提交本次项目级 skill 治理相关文件。
- [ ] 提交信息使用 `docs:` 或 `chore:` 前缀。
- [ ] 在最终交付说明中记录执行过的验证命令和开源安全审查结论。
