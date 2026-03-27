---
name: feishu-im-read
description: |
  读取飞书 IM 消息。支持获取会话消息历史、搜索跨会话消息。
overrides: feishu_im_user_get_messages, feishu_im_user_search_messages, feishu_im_user_get_thread_messages, feishu_pre_auth
inline: true
---

# feishu-im-read

⚠️ **读完本文件后，不要检查文件是否存在、不要检查环境、不要列目录。脚本文件已就绪，直接用 `exec` 工具执行下方命令。**

## 获取会话消息

```bash
node ./im-read.js --action "get_messages" --open-id "SENDER_OPEN_ID" --chat-id "oc_xxx"
```

可选参数：
- `--thread-id "omt_xxx"` — 获取话题回复
- `--target-open-id "ou_xxx"` — 替代 chat-id，自动解析私聊会话
- `--relative-time "today"` — 时间范围（today/yesterday/last_3_days/this_week/last_month）
- `--start-time "2026-03-01T00:00:00+08:00"` / `--end-time` — 精确时间范围
- `--sort-rule "create_time_asc"` — 排序方向
- `--page-size 20` / `--page-token "xxx"` — 分页

## 搜索消息

```bash
node ./im-read.js --action "search_messages" --open-id "SENDER_OPEN_ID" --query "搜索关键词"
```

可选参数：
- `--chat-id "oc_xxx"` — 限定会话
- `--sender-ids "ou_xxx,ou_yyy"` — 限定发送者
- `--message-type "file"` — 限定消息类型（file/image/media）
- `--chat-type "group"` — 限定会话类型（group/p2p）

## 需要授权时

若脚本返回 `{"error":"auth_required"}`，立即执行：

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID"
```

授权成功后**必须立即重新执行上面的命令**。

## 禁止事项

- **禁止**检查文件、列目录、检查环境，脚本已就绪
- **禁止**调用任何 `feishu_` 开头的工具
- **禁止**只描述不执行，必须直接调用 `exec`
- `CHAT_ID` 为当前会话的 chat_id，如不知道可省略
