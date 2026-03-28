---
name: feishu-im-read
description: |
  读取飞书 IM 消息。支持会话历史和跨会话搜索。
overrides: feishu_im_user_get_messages, feishu_im_user_search_messages, feishu_im_user_get_thread_messages, feishu_pre_auth
inline: true
---

# feishu-im-read

直接用 `exec` 执行，不要检查文件或环境。

## 获取会话消息

```bash
node ./im-read.js --action "get_messages" --open-id "SENDER_OPEN_ID" --chat-id "oc_xxx"
```

可选：`--thread-id "omt_xxx"` `--target-open-id "ou_xxx"` `--relative-time "today"` `--start-time "ISO8601"` `--end-time "ISO8601"` `--sort-rule "create_time_asc"` `--page-size 20` `--page-token "xxx"`

## 搜索消息

```bash
node ./im-read.js --action "search_messages" --open-id "SENDER_OPEN_ID" --query "关键词"
```

可选：`--chat-id "oc_xxx"` `--sender-ids "ou_xxx,ou_yyy"` `--message-type "file"` `--chat-type "group"`

## 必须确认的参数

| 参数 | 何时询问 |
|---|---|
| `--chat-id` / `--target-open-id` | 用户未指明会话（当前会话 chat_id 可从上下文获取） |
| `--query` | search_messages 时未提供关键词 |

## 授权

若返回 `{"error":"auth_required"}`，执行：

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID" --timeout 60
```

- `{"status":"authorized"}` → 重新执行原命令
- `{"status":"polling_timeout"}` → **立即重新执行此 auth 命令**（不会重复发卡片）
- `CHAT_ID` 不知道可省略
