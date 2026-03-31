---
name: feishu-auth
description: |
  为当前用户完成飞书个人 OAuth 授权。自动发送授权链接给用户并等待完成。
  overrides: feishu_oauth, feishu_oauth_batch_auth, feishu_pre_auth
  inline: true
---

# feishu-auth

为用户完成飞书个人 OAuth 授权。

## 运行环境

- **命令**：`node`
- 脚本路径相对于本 SKILL.md 所在目录，执行前需解析为绝对路径

## 授权流程

当需要用户授权时，执行以下命令：

```bash
node "./auth.js" --auth-and-poll --open-id "OPEN_ID" --chat-id "CHAT_ID" --timeout 60
```

- `OPEN_ID`：用户的飞书 open_id（必填）
- `CHAT_ID`：当前会话的 chat_id（可选，有则发到群里，无则发私信）
- `--timeout`：轮询等待秒数（默认 60）

**返回值处理：**
- `{"status":"authorized"}` → 授权成功，继续后续操作
- `{"status":"polling_timeout"}` → 用户尚未完成授权，**立即重新执行同一命令**（会自动复用授权链接，不会重复发送卡片）
- 其他错误 → 停止并告知用户

执行此命令前后不要输出额外文字，脚本已自动通知用户。

## 其他命令

```bash
node "./auth.js" --status --open-id "OPEN_ID"
node "./auth.js" --revoke --open-id "OPEN_ID"
```
