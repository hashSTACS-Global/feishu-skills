---
name: feishu-bitable
description: |
  飞书多维表格管理。支持创建/查询/更新应用、数据表、字段、记录和视图的完整操作。
overrides: feishu_bitable_app, feishu_bitable_app_table, feishu_bitable_app_table_record, feishu_bitable_app_table_field, feishu_bitable_app_table_view, feishu_pre_auth
inline: true
---

# feishu-bitable

⚠️ **读完本文件后，不要检查文件是否存在、不要检查环境、不要列目录。脚本文件已就绪，直接用 `exec` 工具执行下方命令。**

基础命令: `node ./bitable.js --open-id "SENDER_OPEN_ID"`

## 应用操作

```bash
node ./bitable.js --open-id "ou_xxx" --action create_app --name "应用名称" --folder-token "FOLDER_TOKEN"
node ./bitable.js --open-id "ou_xxx" --action get_app --app-token "APP_TOKEN"
node ./bitable.js --open-id "ou_xxx" --action update_app --app-token "APP_TOKEN" --name "新名称"
node ./bitable.js --open-id "ou_xxx" --action copy_app --app-token "APP_TOKEN" --name "副本名称" --folder-token "FOLDER_TOKEN"
```

## 数据表操作

```bash
node ./bitable.js --open-id "ou_xxx" --action create_table --app-token "APP_TOKEN" --name "表名"
node ./bitable.js --open-id "ou_xxx" --action list_tables --app-token "APP_TOKEN"
node ./bitable.js --open-id "ou_xxx" --action update_table --app-token "APP_TOKEN" --table-id "TABLE_ID" --name "新表名"
node ./bitable.js --open-id "ou_xxx" --action delete_table --app-token "APP_TOKEN" --table-id "TABLE_ID"
node ./bitable.js --open-id "ou_xxx" --action batch_create_tables --app-token "APP_TOKEN" --table-names '[{"name":"表1"},{"name":"表2"}]'
node ./bitable.js --open-id "ou_xxx" --action batch_delete_tables --app-token "APP_TOKEN" --table-ids "tblXXX,tblYYY"
```

## 字段操作

```bash
node ./bitable.js --open-id "ou_xxx" --action create_field --app-token "APP_TOKEN" --table-id "TABLE_ID" --name "字段名" --field-type 1
node ./bitable.js --open-id "ou_xxx" --action list_fields --app-token "APP_TOKEN" --table-id "TABLE_ID"
node ./bitable.js --open-id "ou_xxx" --action update_field --app-token "APP_TOKEN" --table-id "TABLE_ID" --field-id "FIELD_ID" --name "新字段名"
node ./bitable.js --open-id "ou_xxx" --action delete_field --app-token "APP_TOKEN" --table-id "TABLE_ID" --field-id "FIELD_ID"
```

## 记录操作

```bash
node ./bitable.js --open-id "ou_xxx" --action create_record --app-token "APP_TOKEN" --table-id "TABLE_ID" --fields '{"字段名":"值"}'
node ./bitable.js --open-id "ou_xxx" --action list_records --app-token "APP_TOKEN" --table-id "TABLE_ID"
node ./bitable.js --open-id "ou_xxx" --action update_record --app-token "APP_TOKEN" --table-id "TABLE_ID" --record-id "RECORD_ID" --fields '{"字段名":"新值"}'
node ./bitable.js --open-id "ou_xxx" --action delete_record --app-token "APP_TOKEN" --table-id "TABLE_ID" --record-id "RECORD_ID"
node ./bitable.js --open-id "ou_xxx" --action batch_create_records --app-token "APP_TOKEN" --table-id "TABLE_ID" --records '[{"fields":{"字段名":"值1"}}]'
node ./bitable.js --open-id "ou_xxx" --action batch_update_records --app-token "APP_TOKEN" --table-id "TABLE_ID" --records '[{"record_id":"recXXX","fields":{"字段名":"新值"}}]'
node ./bitable.js --open-id "ou_xxx" --action batch_delete_records --app-token "APP_TOKEN" --table-id "TABLE_ID" --record-ids "recXXX,recYYY"
```

## 视图操作

```bash
node ./bitable.js --open-id "ou_xxx" --action create_view --app-token "APP_TOKEN" --table-id "TABLE_ID" --name "视图名" --view-type "grid"
node ./bitable.js --open-id "ou_xxx" --action list_views --app-token "APP_TOKEN" --table-id "TABLE_ID"
node ./bitable.js --open-id "ou_xxx" --action get_view --app-token "APP_TOKEN" --table-id "TABLE_ID" --view-id "VIEW_ID"
node ./bitable.js --open-id "ou_xxx" --action update_view --app-token "APP_TOKEN" --table-id "TABLE_ID" --view-id "VIEW_ID" --name "新视图名"
node ./bitable.js --open-id "ou_xxx" --action delete_view --app-token "APP_TOKEN" --table-id "TABLE_ID" --view-id "VIEW_ID"
```

## 执行前确认

**以下参数缺失或含糊时，必须先向用户询问，不得猜测或使用默认值：**

| 参数 | 何时需要询问 |
|---|---|
| `--app-token` | 用户未提供多维表格链接或 token |
| `--table-id` | 操作记录/字段/视图时，未指明目标数据表（可先用 `list_tables` 列出让用户选择） |
| `--fields` | 创建/更新记录时用户未提供字段内容 |
| `--name` | 创建应用/数据表/视图时用户未说明名称 |

## 需要授权时

若返回 `{"error":"auth_required"}`，**不要询问用户是否授权，直接立即执行以下命令发送授权链接：**

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID" --timeout 60
```

- `{"status":"authorized"}` → 重新执行原命令
- `{"status":"polling_timeout"}` → **立即重新执行此 auth 命令**（不会重复发卡片）
- `CHAT_ID` 不知道可省略

## 权限不足时

若返回 `{"error":"permission_required"}`，说明飞书应用未开通所需权限。**必须直接将返回 JSON 中的 `reply` 字段内容原样发送给用户**，其中已包含权限管理页面的超链接和操作步骤。

**注意：不要自行组织文案，不要省略链接，直接用 `reply` 字段内容回复用户。**

## 禁止事项

- **禁止**检查文件、列目录、检查环境，脚本已就绪
- **禁止**调用任何 `feishu_` 开头的工具
- **禁止**只描述不执行，必须直接调用 `exec`
- `CHAT_ID` 为当前会话的 chat_id，如不知道可省略
