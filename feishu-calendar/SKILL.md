---
name: feishu-calendar
description: |
  飞书日历与日程管理。支持日程 CRUD、参与者管理、忙闲查询。
overrides: feishu_calendar_calendar, feishu_calendar_event, feishu_calendar_event_attendee, feishu_calendar_freebusy, feishu_pre_auth
inline: true
---

# feishu-calendar

直接用 `exec` 执行，不要检查文件或环境。

## 日历

```bash
node ./calendar.js --open-id "ou_xxx" --action list_calendars
node ./calendar.js --open-id "ou_xxx" --action get_primary
```

## 日程 CRUD

```bash
node ./calendar.js --open-id "ou_xxx" --action create_event --summary "标题" --start-time "ISO8601" --end-time "ISO8601" --attendees "ou_yyy,ou_zzz"
node ./calendar.js --open-id "ou_xxx" --action list_events --start-min "ISO8601" --start-max "ISO8601"
node ./calendar.js --open-id "ou_xxx" --action get_event --event-id "ID" --need-attendee
node ./calendar.js --open-id "ou_xxx" --action update_event --event-id "ID" --summary "新标题"
node ./calendar.js --open-id "ou_xxx" --action delete_event --event-id "ID"
node ./calendar.js --open-id "ou_xxx" --action search_events --query "关键词"
```

可选：`--description` `--location` `--all-day`（全天时时间用日期格式）

## 参与者

```bash
node ./calendar.js --open-id "ou_xxx" --action add_attendees --event-id "ID" --attendees "ou_yyy"
node ./calendar.js --open-id "ou_xxx" --action list_attendees --event-id "ID"
node ./calendar.js --open-id "ou_xxx" --action remove_attendees --event-id "ID" --attendees "attendee_id"
```

## 忙闲

```bash
node ./calendar.js --open-id "ou_xxx" --action check_freebusy --user-ids "ou_yyy" --start-time "ISO8601" --end-time "ISO8601"
```

## 必须确认的参数

| 参数 | 何时询问 |
|---|---|
| `--summary` | 未说明标题 |
| `--start-time` | 时间含糊 |
| `--end-time` | 未说明结束时间或时长 |
| `--attendees` | 创建会议时未提及参与者 |

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
