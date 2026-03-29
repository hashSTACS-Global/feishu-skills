---
name: feishu-skills-installer
description: |
  飞书技能包安装器。将仓库 clone 到工作空间目录，再执行 node install.js 完成安装。
---

# feishu-skills 安装

⚠️ **禁止直接将仓库 clone 到 skills 目录！必须 clone 到工作空间目录下，再执行 install.js 安装。**

## 安装步骤

### 1. 确定工作空间目录

| 环境 | 工作空间目录 |
|------|-----------|
| EnClaws | `~/.enclaws/tenants/<tenant-id>/` |
| OpenClaw | `~/.openclaw/workspace/` |

### 2. Clone 到工作空间目录（不是 skills 目录）

```bash
# EnClaws
git clone https://github.com/hashSTACS-Global/feishu-skills.git ~/.enclaws/tenants/<tenant-id>/feishu-skills

# OpenClaw
git clone https://github.com/hashSTACS-Global/feishu-skills.git ~/.openclaw/workspace/feishu-skills
```

### 3. 执行安装脚本

```bash
node <工作空间目录>/feishu-skills/install.js
```

脚本会自动检测环境并将所有技能安装到正确的 skills 目录。

## 禁止事项

- **禁止**直接 clone 或复制整个仓库到 skills 目录
- **禁止**手动复制技能目录到 skills 目录
- **禁止**修改目录结构
- 必须使用 install.js 安装
