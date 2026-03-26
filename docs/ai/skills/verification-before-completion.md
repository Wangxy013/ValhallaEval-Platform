# 完成前验证

## 适用场景

任何任务在被声称“完成”“已修复”“可提交”之前，都必须执行与改动范围匹配的验证。

## 最低验证要求

### 后端改动

- `cd backend && cargo fmt --check`
- `cd backend && cargo clippy -- -D warnings`
- `cd backend && cargo test`

### 前端改动

- `cd frontend && node --test src/pages/TestDataManagement/csv.test.ts src/pages/TaskResult/helpers.test.ts src/pages/NewTask/helpers.test.ts src/pages/ModelManagement/helpers.test.ts`
- `cd frontend && npm run build`

### 全链路流程改动

同时执行前后端验证，并对受影响的 UI 或 API 流程做人工检查。

## 人工验证

- 确认任务创建仍满足三阶段模型拆分约束。
- 确认模型 API Key 在创建或编辑后不会以明文重新暴露。
- 确认被修改的文档与实际行为一致。

## 提交前安全审查

任何可能推送到 GitHub 远程仓库的提交，都必须额外做一次基于提交范围的安全审查，确认 staged 内容不包含：

- 明文密钥、API Key、Token、凭据或其他敏感信息
- 仅供内部使用的功能、脚本、配置、说明或非公开流程
- 仅供本地环境使用的文档、缓存、环境文件、临时文件或不应公开的产物
- 任何不符合开源发布规范、不可公开分发或会暴露内部细节的内容
