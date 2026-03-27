---
name: feishu-create-doc
description: |
  创建飞书云文档。使用当前用户的个人 OAuth token（非 bot owner 权限），
  支持任意群成员直接创建文档，无需 bot owner 授权。
overrides: feishu_create_doc, feishu_pre_auth
inline: true
---

# feishu-create-doc

⚠️ **读完本文件后，不要检查文件是否存在、不要检查环境、不要列目录。脚本文件已就绪，直接用 `exec` 工具执行下方命令。**

## 调用方式

立即用 `exec` 工具执行（将 SENDER_OPEN_ID 替换为发送者的 `ou_xxx`）：

```bash
node ./create-doc.js --open-id "SENDER_OPEN_ID" --title "文档标题" --markdown "文档内容（Markdown 格式）"
```

可选参数：`--folder-token TOKEN`、`--wiki-node TOKEN`

## 执行前确认

**以下参数缺失或含糊时，必须先向用户询问，不得猜测或使用默认值：**

| 参数 | 何时需要询问 |
|---|---|
| `--title` | 用户未明确说明文档标题 |
| `--markdown` | 用户未提供文档内容（若明确要创建空文档则可省略） |

## 输出规范

脚本返回 JSON 中有 `reply` 字段，将该值原样输出给用户，不要修改。

## 需要授权时

若脚本返回 `{"error":"auth_required"}`，立即执行：

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID"
```

授权成功后**必须立即重新执行上面的 create-doc.js 命令**。

## 禁止事项

- **禁止**检查文件、列目录、检查环境，脚本已就绪
- **禁止**调用任何 `feishu_` 开头的工具
- **禁止**只描述不执行，必须直接调用 `exec`
- `CHAT_ID` 为当前会话的 chat_id，如不知道可省略
