# 飞书 Skills 自动化测试方案

## 概述

测试框架直接扩展自 `EnClaws/test/feishu-simulator`，无需额外搬运代码。

## feishu-simulator 端到端原理

feishu-simulator 之所以能做到端到端测试，核心在于它**以真实飞书用户的身份**直接调用飞书 Open API 与机器人对话，走的是和人肉 @机器人 完全一样的消息链路。

### 信息流

```
  feishu-simulator (测试脚本)                飞书云                    EnClaws (本地)
  ─────────────────────────             ──────────                ──────────────
          │                                  │                         │
  1. OAuth Device Flow 获取 user_token       │                         │
          │                                  │                         │
  2. POST /im/v1/messages ──────────────→    │                         │
     (以测试用户身份，发消息给 bot 的 open_id)  │                         │
          │                                  │                         │
          │                           3. 飞书服务器收到消息              │
          │                              路由到 bot                    │
          │                                  │                         │
          │                           4. 通过长连接(WSClient)推送 ───→  │
          │                                  │                         │
          │                                  │                  5. handleMessageEvent()
          │                                  │                     → handleFeishuMessage()
          │                                  │                     → dispatchToAgent()
          │                                  │                     → LLM 处理意图
          │                                  │                     → 选择并执行 Skill
          │                                  │                     → Skill 调用飞书 API
          │                                  │                         │
          │                           6. bot 回复消息  ←────────────── │
          │                                  │                         │
  7. GET /im/v1/messages ───────────────→    │                         │
     (轮询 P2P 聊天，筛选 sender_type=app     │                         │
      且 parent_id 匹配的回复)                │                         │
          │                                  │                         │
  8. 提取回复内容 ←──────────────────────     │                         │
     (支持 text/post/interactive/file/image)  │                         │
          │                                  │                         │
  9. 执行断言 + 生成 CSV 报告                 │                         │
```

### 关键设计点

1. **用户身份模拟**：通过 OAuth Device Flow 获取真实 user_access_token，以用户身份发送私聊消息给 bot（`POST /im/v1/messages?receive_id_type=open_id`），飞书自动创建/复用 P2P 聊天
2. **回复匹配**：通过 `parent_id === userMsgId` 精确匹配 bot 对特定消息的回复，不会错配其他对话
3. **卡片流式等待**：如果 bot 回复的是 CardKit v2 卡片且 `streamingMode=true`，会持续轮询直到卡片渲染完成再断言
4. **消息类型适配**：自动解析 text（纯文本）、post（富文本）、interactive（卡片 summary + 元素文本）、file/image/media（提取 file_key/image_key/fileName）
5. **token 管理**：access_token 缓存在 `.token-cache/`，自动刷新（refresh_token 7 天有效），免去重复授权

### 为什么不用 Webhook / WebSocket 方案

| 方案 | 问题 |
|------|------|
| 模拟飞书 Webhook POST | EnClaws 使用长连接模式，webhook 未实现；且需要内网穿透打通本地与飞书 |
| WebSocket webchat 通道 | provider="webchat" 不注入 `FEISHU_APP_ID`/`FEISHU_APP_SECRET`/`open_id` 等飞书上下文，skill 脚本无法执行 |
| **飞书 API 直接收发（当前方案）** | 不依赖连接模式，不需要内网穿透，走真实飞书消息链路 |

## 三层测试设计

| 层级 | 说明 | 依赖 | 运行命令 |
|------|------|------|----------|
| **Layer 1** | 直接调用 skill JS 脚本，验证输入输出契约 | 飞书 token | `pnpm vitest run test/feishu-simulator/test-case/feishu-skills-layer1.test.ts` |
| **Layer 2** | 通过飞书 API 发自然语言消息，验证端到端链路 | Gateway + Lark 连接 | `pnpm vitest run test/feishu-simulator/test-case/feishu-skills-layer2.test.ts` |
| **Layer 3** | 在 Layer 2 基础上用 LLM 评判回复质量 | Gateway + Lark + LLM API key | `pnpm vitest run test/feishu-simulator/test-case/feishu-skills-layer3.test.ts` |

## 文件组织规则

- **每个 skill 对应一个同名 JSON 文件**（如 `create-doc.json`、`calendar.json`）
- **跨 skill 编排场景**单独放在 `orchestration.json`
- **三层目录结构一一对应**，方便按 skill 维护和回归

```
EnClaws/test/feishu-simulator/test-data/
├── feishu-skills-layer1/     # Layer 1 — 脚本级
├── feishu-skills-layer2/     # Layer 2 — E2E
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

1. 编辑所有 `test-data/feishu-skills-layer{1,2,3}/*.json`，替换占位符：
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
