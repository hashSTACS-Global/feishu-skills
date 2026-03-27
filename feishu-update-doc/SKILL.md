---
name: feishu-update-doc
description: |
  更新飞书云文档内容。支持追加内容、覆盖全文。使用当前用户的个人 OAuth token。
overrides: feishu_update_doc, feishu_pre_auth
inline: true
---

# feishu-update-doc

⚠️ **读完本文件后，不要检查文件是否存在、不要检查环境、不要列目录。脚本文件已就绪，直接用 `exec` 工具执行下方命令。**

## 调用方式

### 追加内容

```bash
node ./update-doc.js --open-id "SENDER_OPEN_ID" --doc-id "文档TOKEN" --mode "append" --markdown "要追加的Markdown内容"
```

### 覆盖全文（⚠️ 会清除原有内容）

```bash
node ./update-doc.js --open-id "SENDER_OPEN_ID" --doc-id "文档TOKEN" --mode "overwrite" --markdown "新的完整Markdown内容"
```

可选：`--new-title "新标题"` 同时修改文档标题。

## 需要授权时

若脚本返回 `{"error":"auth_required"}`，立即执行：

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID"
```

授权成功后**必须立即重新执行上面的 update-doc.js 命令**。

## 禁止事项

- **禁止**检查文件、列目录、检查环境，脚本已就绪
- **禁止**调用任何 `feishu_` 开头的工具
- **禁止**只描述不执行，必须直接调用 `exec`
- `CHAT_ID` 为当前会话的 chat_id，如不知道可省略
