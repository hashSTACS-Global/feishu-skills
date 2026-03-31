---
name: feishu-task
description: |
  飞书任务管理。支持任务 CRUD、任务清单、评论、子任务。
overrides: feishu_task_task, feishu_task_tasklist, feishu_task_comment, feishu_task_subtask, feishu_pre_auth
inline: true
---

# feishu-task

直接用 `exec` 执行，不要检查文件或环境。

## 任务

```bash
node ./task.js --open-id "ou_xxx" --action create_task --summary "标题" --due "ISO8601" --members "ou_yyy"
node ./task.js --open-id "ou_xxx" --action list_tasks
node ./task.js --open-id "ou_xxx" --action get_task --task-id "ID"
node ./task.js --open-id "ou_xxx" --action update_task --task-id "ID" --summary "新标题"
node ./task.js --open-id "ou_xxx" --action update_task --task-id "ID" --completed true
node ./task.js --open-id "ou_xxx" --action add_task_members --task-id "ID" --members "ou_yyy"
node ./task.js --open-id "ou_xxx" --action remove_task_members --task-id "ID" --members "ou_yyy"
```

可选：`--description` `--tasklist-id`

## 任务清单

```bash
node ./task.js --open-id "ou_xxx" --action create_tasklist --summary "清单名"
node ./task.js --open-id "ou_xxx" --action list_tasklists
node ./task.js --open-id "ou_xxx" --action list_tasklist_tasks --tasklist-id "ID"
node ./task.js --open-id "ou_xxx" --action delete_tasklist --tasklist-id "ID"
```

## 评论与子任务

```bash
node ./task.js --open-id "ou_xxx" --action create_comment --task-id "ID" --content "内容"
node ./task.js --open-id "ou_xxx" --action list_comments --task-id "ID"
node ./task.js --open-id "ou_xxx" --action create_subtask --task-id "ID" --summary "子任务"
node ./task.js --open-id "ou_xxx" --action list_subtasks --task-id "ID"
```

## 必须确认的参数

| 参数 | 何时询问 |
|---|---|
| `--summary` | 未说明任务标题 |
| `--due` | 截止时间含糊 |
| `--members` | 提到分配但未说明给谁 |

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
