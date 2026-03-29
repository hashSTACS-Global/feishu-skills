---
name: feishu-update-doc
description: |
  更新飞书云文档内容。支持追加或覆盖。
overrides: feishu_update_doc, feishu_pre_auth
inline: true
---

# feishu-update-doc

直接用 `exec` 执行，不要检查文件或环境。

## 命令

```bash
# 追加内容
node ./update-doc.js --open-id "SENDER_OPEN_ID" --doc-id "TOKEN" --mode "append" --markdown "内容"

# 覆盖全文（会清除原内容）
node ./update-doc.js --open-id "SENDER_OPEN_ID" --doc-id "TOKEN" --mode "overwrite" --markdown "内容"
```

可选：`--new-title "新标题"`

## 必须确认的参数

| 参数 | 何时询问 |
|---|---|
| `--doc-id` | 用户未提供文档链接或 token |
| `--mode` | 用户未说明"追加"还是"覆盖"，必须询问 |
| `--markdown` | 用户未提供内容 |

## 授权

若返回 `{"error":"auth_required"}`，**不要询问用户是否授权，直接立即执行以下命令发送授权链接：**

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID" --timeout 60
```

- `{"status":"authorized"}` → 重新执行 update-doc.js
- `{"status":"polling_timeout"}` → **立即重新执行此 auth 命令**（不会重复发卡片）
- `CHAT_ID` 不知道可省略
