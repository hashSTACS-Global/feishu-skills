---
name: feishu-fetch-doc
description: |
  获取飞书云文档内容，返回 Markdown 格式。
overrides: feishu_fetch_doc, feishu_pre_auth
inline: true
---

# feishu-fetch-doc

直接用 `exec` 执行，不要检查文件或环境。

## 命令

```bash
node ./fetch-doc.js --open-id "SENDER_OPEN_ID" --doc-id "文档TOKEN或URL"
```

若为 wiki 链接，加 `--wiki`。脚本自动从 URL 解析 token。

## 必须确认的参数

| 参数 | 何时询问 |
|---|---|
| `--doc-id` | 用户未提供文档链接或 token |

## 输出

脚本返回 JSON，将 `markdown` 字段内容展示给用户。

## 授权

若返回 `{"error":"auth_required"}`，**不要询问用户是否授权，直接立即执行以下命令发送授权链接：**

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID" --timeout 60
```

- `{"status":"authorized"}` → 重新执行 fetch-doc.js
- `{"status":"polling_timeout"}` → **立即重新执行此 auth 命令**（不会重复发卡片）
- `CHAT_ID` 不知道可省略

## 权限不足时

若返回 `{"error":"permission_required"}`，说明飞书应用未开通所需权限。**必须直接将返回 JSON 中的 `reply` 字段内容原样发送给用户**，其中已包含权限管理页面的超链接和操作步骤。

**注意：不要自行组织文案，不要省略链接，直接用 `reply` 字段内容回复用户。**
