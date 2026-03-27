---
name: feishu-fetch-doc
description: |
  获取飞书云文档内容。支持 docx 文档链接、token、wiki 链接，返回 Markdown 格式内容。
overrides: feishu_fetch_doc, feishu_pre_auth
inline: true
---

# feishu-fetch-doc

⚠️ **读完本文件后，不要检查文件是否存在、不要检查环境、不要列目录。脚本文件已就绪，直接用 `exec` 工具执行下方命令。**

## 调用方式

立即用 `exec` 工具执行（将 SENDER_OPEN_ID 替换为发送者的 `ou_xxx`）：

```bash
node ./fetch-doc.js --open-id "SENDER_OPEN_ID" --doc-id "文档TOKEN或URL"
```

若为 wiki 链接，加 `--wiki` 参数。脚本会自动从 URL 中解析 token。

## 输出规范

脚本返回 JSON，其中 `markdown` 字段为文档内容，将内容直接展示给用户。

## 需要授权时

若脚本返回 `{"error":"auth_required"}`，立即执行：

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID"
```

授权成功后**必须立即重新执行上面的 fetch-doc.js 命令**。

## 禁止事项

- **禁止**检查文件、列目录、检查环境，脚本已就绪
- **禁止**调用任何 `feishu_` 开头的工具
- **禁止**只描述不执行，必须直接调用 `exec`
- `CHAT_ID` 为当前会话的 chat_id，如不知道可省略
