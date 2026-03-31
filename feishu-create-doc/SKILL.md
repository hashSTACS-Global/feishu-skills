---
name: feishu-create-doc
description: |
  创建飞书云文档。使用当前用户的个人 OAuth token。
overrides: feishu_create_doc, feishu_pre_auth
inline: true
---

# feishu-create-doc

直接用 `exec` 执行，不要检查文件或环境。

## 命令

```bash
node ./create-doc.js --open-id "SENDER_OPEN_ID" --title "文档标题" --markdown "Markdown内容"
```

可选：`--folder-token TOKEN`、`--wiki-node TOKEN`

## 必须确认的参数

| 参数 | 何时询问 |
|---|---|
| `--title` | 用户未说明标题 |
| `--markdown` | 用户未提供内容（明确要空文档可省略） |

## 输出

脚本返回 JSON，将 `reply` 字段原样输出给用户。

## 授权

若返回 `{"error":"auth_required"}` 或 `{"error":"permission_required"}`，**不要询问用户是否授权，直接立即执行以下命令发送授权链接：**

- 若返回 JSON 中包含 `required_scopes` 字段，将其数组值用空格拼接后传入 `--scope` 参数：

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID" --timeout 60 --scope "<required_scopes 用空格拼接>"
```

- 若返回中不包含 `required_scopes`，则不加 `--scope` 参数（使用默认权限）。

- `{"status":"authorized"}` → 重新执行原始命令
- `{"status":"polling_timeout"}` → **立即重新执行此 auth 命令**（不会重复发卡片）
- `CHAT_ID` 不知道可省略

## 权限不足时（应用级）

若返回中包含 `"auth_type":"tenant"`，说明需要管理员在飞书开放平台开通应用权限，**必须将 `reply` 字段内容原样发送给用户**。
