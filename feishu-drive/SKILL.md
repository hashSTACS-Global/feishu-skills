---
name: feishu-drive
description: |
  使用当前用户的个人 OAuth token 访问飞书云盘，目前仅支持列出文件夹与创建文件夹两个操作。
overrides: feishu_drive_file
inline: true
---

# feishu-drive

直接用 `exec` 执行，不要检查文件或环境。

## 命令

- **列出文件夹内容**

```bash
node ./drive.js --open-id "SENDER_OPEN_ID" --action list --folder-token "TOKEN"
```

- **创建文件夹**

```bash
node ./drive.js --open-id "SENDER_OPEN_ID" --action create_folder --name "文件夹名" --folder-token "父文件夹TOKEN"
```

说明：

- `--folder-token` 为空或省略时，表示云盘根目录。
- 脚本返回 JSON，将 `reply` 字段原样输出给用户，必要时可结合 `items` / `folder_token` 等字段做后续编排。

## 授权与权限不足处理

- 若返回中包含 `{"error":"auth_required"}`：
  - 说明用户未完成个人 OAuth 授权或 token 已失效，应调用 `feishu-auth` 完成授权后重试原始命令。

- 若返回中包含 `{"error":"permission_required"}`：
  - 按返回中的 `reply` 文案提示用户需要重新授权或管理员开通应用云盘相关权限。

## 已实现的 action

- **list**：列出指定 `folder_token` 下的所有文件与文件夹，支持自动翻页。
- **create_folder**：在指定 `folder_token` 下创建新文件夹。

其他如复制、移动、删除、上传、下载等操作暂未实现，后续可在保持 CLI 兼容的前提下按需扩展。

