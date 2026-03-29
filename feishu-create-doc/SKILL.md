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

若返回 `{"error":"auth_required"}`，**不要询问用户是否授权，直接立即执行以下命令发送授权链接：**

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID" --timeout 60
```

- `{"status":"authorized"}` → 重新执行 create-doc.js
- `{"status":"polling_timeout"}` → **立即重新执行此 auth 命令**（不会重复发卡片）
- `CHAT_ID` 不知道可省略

## 权限不足时

若返回 `{"error":"permission_required"}`，说明飞书应用未开通所需权限。**必须直接将返回 JSON 中的 `reply` 字段内容原样发送给用户**，其中已包含权限管理页面的超链接和操作步骤。

**注意：不要自行组织文案，不要省略链接，直接用 `reply` 字段内容回复用户。**
