---
name: feishu-calendar
description: |
  飞书日历与日程管理。支持创建/查询/更新/删除日程，管理参与者，查看忙闲状态。
overrides: feishu_calendar_calendar, feishu_calendar_event, feishu_calendar_event_attendee, feishu_calendar_freebusy, feishu_pre_auth
inline: true
---

# feishu-calendar

⚠️ **读完本文件后，不要检查文件是否存在、不要检查环境、不要列目录。脚本文件已就绪，直接用 `exec` 工具执行下方命令。**

基础命令: `node ./calendar.js --open-id "SENDER_OPEN_ID"`

## 操作列表

### 日历

```bash
node ./calendar.js --open-id "ou_xxx" --action list_calendars
node ./calendar.js --open-id "ou_xxx" --action get_primary
```

### 日程 CRUD

```bash
# 创建日程
node ./calendar.js --open-id "ou_xxx" --action create_event \
  --summary "会议标题" --start-time "2026-03-28T14:00:00+08:00" --end-time "2026-03-28T15:00:00+08:00" \
  --description "会议描述" --location "会议室" --attendees "ou_yyy,ou_zzz"

# 列出日程（指定时间范围）
node ./calendar.js --open-id "ou_xxx" --action list_events \
  --start-min "2026-03-28T00:00:00+08:00" --start-max "2026-03-29T00:00:00+08:00"

# 查看日程详情
node ./calendar.js --open-id "ou_xxx" --action get_event --event-id "EVENT_ID" --need-attendee

# 更新日程
node ./calendar.js --open-id "ou_xxx" --action update_event --event-id "EVENT_ID" \
  --summary "新标题" --start-time "..." --end-time "..."

# 删除日程
node ./calendar.js --open-id "ou_xxx" --action delete_event --event-id "EVENT_ID"

# 搜索日程
node ./calendar.js --open-id "ou_xxx" --action search_events --query "关键词"
```

### 参与者管理

```bash
node ./calendar.js --open-id "ou_xxx" --action add_attendees --event-id "EVENT_ID" --attendees "ou_yyy,ou_zzz"
node ./calendar.js --open-id "ou_xxx" --action list_attendees --event-id "EVENT_ID"
node ./calendar.js --open-id "ou_xxx" --action remove_attendees --event-id "EVENT_ID" --attendees "attendee_id1,attendee_id2"
```

### 忙闲查询

```bash
node ./calendar.js --open-id "ou_xxx" --action check_freebusy \
  --user-ids "ou_yyy,ou_zzz" --start-time "2026-03-28T09:00:00+08:00" --end-time "2026-03-28T18:00:00+08:00"
```

## 全天日程

加 `--all-day` 参数，时间格式用日期：`--start-time "2026-03-28" --end-time "2026-03-29"`

## 需要授权时

若脚本返回 `{"error":"auth_required"}`，立即执行：

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID"
```

授权成功后**立即重新执行**原命令。

## 禁止事项

- **禁止**检查文件、列目录、检查环境，脚本已就绪
- **禁止**调用任何 `feishu_` 开头的工具
- **禁止**只描述不执行，必须直接调用 `exec`
- `CHAT_ID` 为当前会话的 chat_id，如不知道可省略
