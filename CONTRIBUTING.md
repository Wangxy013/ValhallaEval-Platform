# 贡献指南

感谢你对本项目的关注！以下是参与贡献的规范说明。

---

## AI 协作规范入口

所有 AI 协作工作应以 `docs/ai/README.md` 为入口，在 `docs/ai/skills/skill-catalog.md` 中查找对应的技能说明并遵循仓库级工作流。

## 开发流程

1. Fork 本仓库
2. 从 `main` 创建功能分支：`git checkout -b feature/my-feature`
3. 开发并提交：`git commit -m "feat: 添加XX功能"`
4. 推送到你的 Fork：`git push origin feature/my-feature`
5. 提交 Pull Request 到 `main` 分支

---

## 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)：

```
<type>: <简短描述>

[可选 body]
[可选 footer]
```

| type | 适用场景 |
|---|---|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 仅文档变更 |
| `style` | 格式调整（不影响代码逻辑） |
| `refactor` | 重构（不含新功能或 bug 修复） |
| `perf` | 性能优化 |
| `test` | 测试相关 |
| `chore` | 构建工具、依赖更新等 |

示例：
```
feat: 新增裁判模型独立配置

支持为验证校验和自动评估指定独立的裁判模型，
不再强制使用任务的第一个配置模型。

Closes #42
```

---

## 代码质量

提交前请确保：

```bash
# 后端
cd backend
cargo fmt --check
cargo clippy -- -D warnings

# 前端
cd frontend
npx tsc --noEmit
```

完成上述流程后，务必进行一次 GitHub/开源安全审查：逐条确认此次提交的暂存内容不包含任何明文密钥、API Key、Token、凭据或其他敏感信息；仅供内部使用的功能/脚本/配置/非公开流程；仅在本地生效的文件、缓存或临时产物；或任何不符合开源发布规范的产物。

---

## Pull Request 规范

- 标题简洁说明做了什么（而非为什么）
- Body 中说明背景、方案选择和测试步骤
- 关联相关 Issue（`Closes #N`）
- 涉及 API 变更时同步更新 `docs/api-reference.md`
- 涉及用户操作流程变更时同步更新 `docs/user-guide/`

---

## 报告 Bug

请在 Issues 中提供：

1. 重现步骤（最小可复现案例）
2. 预期行为 vs 实际行为
3. 环境信息（OS、浏览器版本、Rust/Node 版本）
4. 相关日志（后端 `RUST_LOG=debug cargo run` 输出）
