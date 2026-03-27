---
name: feishu-auth
description: |
  为当前用户完成飞书个人 OAuth 授权。自动发送授权链接给用户并等待完成。
---

# feishu-auth

为用户完成飞书个人 OAuth 授权。

## 运行环境

- **命令**：`node`
- 脚本路径相对于本 SKILL.md 所在目录，执行前需解析为绝对路径

## 授权流程（单条命令，自动完成）

当需要用户授权时，执行以下命令。脚本会自动发送授权卡片给用户，然后阻塞等待用户完成授权：

```bash
node "./auth.js" --auth-and-poll --open-id "OPEN_ID" --chat-id "CHAT_ID"
```

- `OPEN_ID`：用户的飞书 open_id（必填）
- `CHAT_ID`：当前会话的 chat_id（可选，有则发到群里，无则发私信）

返回 `{"status":"authorized"}` 表示授权成功，可继续后续操作。

执行此命令前后不要输出额外文字，脚本已自动通知用户。

## 其他命令

```bash
node "./auth.js" --status --open-id "OPEN_ID"
node "./auth.js" --revoke --open-id "OPEN_ID"
```
