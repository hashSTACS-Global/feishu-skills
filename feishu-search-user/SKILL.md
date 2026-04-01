---
name: feishu-search-user
description: |
  搜索飞书用户。按关键词搜索员工姓名、手机号、邮箱，返回匹配的用户列表及 open_id。
overrides: feishu_search_user, feishu_pre_auth  
inline: true
---

# feishu-search-user

直接用 `exec` 执行，不要检查文件或环境。

## 搜索用户

```bash
node ./search-user.js --open-id "ou_xxx" --query "张三"
node ./search-user.js --open-id "ou_xxx" --query "张三" --page-size 50
node ./search-user.js --open-id "ou_xxx" --query "张三" --page-token "TOKEN"
```

| 参数 | 必填 | 说明 |
|---|---|---|
| `--open-id` | 是 | 当前用户 open_id |
| `--query` | 是 | 搜索关键词（匹配姓名、手机号、邮箱） |
| `--page-size` | 否 | 每页数量，1-200，默认 20 |
| `--page-token` | 否 | 翻页 token |

## 返回格式

```json
{
  "users": [
    { "open_id": "ou_xxx", "name": "张三", "en_name": "San Zhang", "department": [...], "avatar": "url" }
  ],
  "has_more": false,
  "page_token": null,
  "reply": "找到 1 位用户：张三"
}
```

## 典型用途

- 用户说"帮我查一下张三的 open_id"→ 直接搜索
- 其他 skill 需要 open_id 但用户只提供了姓名 → 先用此 skill 查找再传给目标 skill
- 模糊搜索：关键词可以是姓名片段、手机号、邮箱

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
