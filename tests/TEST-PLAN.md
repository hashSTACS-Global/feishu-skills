# 飞书 Skills 自动化测试方案

## 概述

测试框架直接扩展自 `EnClaws/test/feishu-simulator`，无需额外搬运代码。

## 三层测试设计

| 层级 | 说明 | 依赖 | 运行命令 |
|------|------|------|----------|
| **Layer 1** | 直接调用 skill JS 脚本，验证输入输出契约 | 飞书 token | `pnpm vitest run test/feishu-simulator/test-case/feishu-skills-layer1.test.ts` |
| **Layer 2** | 通过飞书 API 发自然语言消息，验证端到端链路 | Gateway + Lark 连接 | `pnpm vitest run test/feishu-simulator/test-case/feishu-skills.test.ts` |
| **Layer 3** | 在 Layer 2 基础上用 LLM 评判回复质量 | Gateway + Lark + LLM API key | `pnpm vitest run test/feishu-simulator/test-case/feishu-skills-layer3.test.ts` |

## 文件组织规则

- **每个 skill 对应一个同名 JSON 文件**（如 `create-doc.json`、`calendar.json`）
- **跨 skill 编排场景**单独放在 `orchestration.json`
- **三层目录结构一一对应**，方便按 skill 维护和回归

```
EnClaws/test/feishu-simulator/test-data/
├── feishu-skills/            # Layer 2 — E2E
├── feishu-skills-layer1/     # Layer 1 — 脚本级
└── feishu-skills-layer3/     # Layer 3 — LLM Judge
```

每层目录下的文件（以 Layer2 为例）：

```
create-doc.json       fetch-doc.json       search-doc.json      update-doc.json
calendar.json         task.json            chat.json            search-user.json
im-read.json          drive.json           sheet.json           wiki.json
bitable.json          docx-download.json   image-ocr.json       orchestration.json
```

## 用例覆盖统计

| 层级 | 文件数 | 用例数 | 覆盖 |
|------|-------|-------|------|
| Layer 1 | 15 | 66 | 全部 15 个 skill（正常流程 + 参数缺失 + 无效参数 + 边界值） |
| Layer 2 | 16 | 76 | 全部 15 个 skill + orchestration（自然语言多角度 + 口语化表达 + 模糊意图） |
| Layer 3 | 15 | 21 | 全部 15 个 skill + orchestration（回复质量评判） |
| **合计** | **46** | **163** | |

## 使用前准备

1. 编辑所有 `test-data/feishu-skills*/*.json`，替换占位符：
   - `cli_xxx` → 飞书应用 App ID
   - `xxx` (appSecret) → 飞书应用 App Secret
   - `ou_xxx` → 测试用户的 Open ID
   - `oc_xxx` → 测试群的 Chat ID（仅 im-read 需要）

2. **Layer 1** 额外需要：用户已完成飞书授权（token 已缓存）

3. **Layer 2/3** 额外需要：EnClaws Gateway 运行中，Lark 插件已连接

4. **Layer 3** 额外需要：设置环境变量 `LLM_JUDGE_API_KEY`

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `TEST_DATA_DIR` | 各入口自带默认值 | 测试数据目录 |
| `TEST_CSV_OUTPUT` | `test-results/{timestamp}.csv` | CSV 报告路径 |
| `TEST_CONCURRENCY` | `1` (skills) / `2` (通用) | 并发数 |
| `TEST_REPLY_TIMEOUT` | `120000` | Bot 回复超时 (ms) |
| `TEST_POLL_INTERVAL` | `2000` | 轮询间隔 (ms) |
| `TEST_COMMAND_TIMEOUT` | `30000` | Layer1 脚本超时 (ms) |
| `LLM_JUDGE_PROVIDER` | `anthropic` | Layer3 LLM 提供商 |
| `LLM_JUDGE_MODEL` | `claude-haiku-4-5-20251001` | Layer3 评判模型 |
| `LLM_JUDGE_API_KEY` | - | Layer3 API Key（必填） |
| `LLM_JUDGE_BASE_URL` | - | API 地址覆盖（可选） |

## 后续扩展

- 每修一个 bug / 加一个功能就补一个 case（三层同步）
- 复杂编排场景持续补充到 `orchestration.json`
- 测试数据清理脚本（按命名前缀 `AutoTest` 批量删除测试产生的文档/日程）
