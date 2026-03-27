---
name: feishu-task
description: |
  飞书任务管理。支持创建/查询/更新任务，管理任务清单、评论、子任务和成员。
overrides: feishu_task_task, feishu_task_tasklist, feishu_task_comment, feishu_task_subtask, feishu_pre_auth
inline: true
---

# feishu-task

⚠️ **读完本文件后，不要检查文件是否存在、不要检查环境、不要列目录。脚本文件已就绪，直接用 `exec` 工具执行下方命令。**

基础命令: `node ./task.js --open-id "SENDER_OPEN_ID"`

## 任务操作

```bash
# 创建任务
node ./task.js --open-id "ou_xxx" --action create_task \
  --summary "任务标题" --description "任务描述" --due "2026-03-30T18:00:00+08:00" \
  --members "ou_yyy,ou_zzz" --tasklist-id "TASKLIST_ID"

# 列出我的任务
node ./task.js --open-id "ou_xxx" --action list_tasks

# 查看任务详情
node ./task.js --open-id "ou_xxx" --action get_task --task-id "TASK_ID"

# 更新任务
node ./task.js --open-id "ou_xxx" --action update_task --task-id "TASK_ID" --summary "新标题"

# 完成任务
node ./task.js --open-id "ou_xxx" --action update_task --task-id "TASK_ID" --completed true

# 添加/移除成员
node ./task.js --open-id "ou_xxx" --action add_task_members --task-id "TASK_ID" --members "ou_yyy"
node ./task.js --open-id "ou_xxx" --action remove_task_members --task-id "TASK_ID" --members "ou_yyy"
```

## 任务清单操作

```bash
node ./task.js --open-id "ou_xxx" --action create_tasklist --summary "清单名"
node ./task.js --open-id "ou_xxx" --action list_tasklists
node ./task.js --open-id "ou_xxx" --action list_tasklist_tasks --tasklist-id "TL_ID"
node ./task.js --open-id "ou_xxx" --action delete_tasklist --tasklist-id "TL_ID"
```

## 评论与子任务

```bash
node ./task.js --open-id "ou_xxx" --action create_comment --task-id "TASK_ID" --content "评论内容"
node ./task.js --open-id "ou_xxx" --action list_comments --task-id "TASK_ID"
node ./task.js --open-id "ou_xxx" --action create_subtask --task-id "TASK_ID" --summary "子任务标题"
node ./task.js --open-id "ou_xxx" --action list_subtasks --task-id "TASK_ID"
```

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
