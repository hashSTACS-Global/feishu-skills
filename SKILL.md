---
name: feishu-skills-installer
description: |
  飞书技能包安装器。将仓库 clone 到工作空间目录，再执行 node install.js 完成安装。
---

# feishu-skills 安装

⚠️ **读完本文件后，直接按步骤执行命令，不要检查环境、不要列目录、不要只描述不执行。**

## 安装步骤

### 1. Clone 仓库到当前工作目录下（不是 skills 目录）

```bash
git clone https://github.com/hashSTACS-Global/feishu-skills.git ./feishu-skills
```

### 2. 执行安装脚本

```bash
node ./feishu-skills/install.js
```

脚本会自动检测环境（EnClaws / OpenClaw）并将所有技能安装到正确的 skills 目录。

### 3. 确认安装结果

脚本输出 JSON，检查 `success` 字段：
- `true` → 安装成功，将 `reply` 字段内容回复给用户
- `false` → 安装失败，将 `message` 字段内容回复给用户

## 禁止事项

- **禁止**直接 clone 到 skills 目录
- **禁止**手动复制技能目录
- **禁止**检查文件、列目录、检查环境
- **禁止**只描述不执行，必须直接用 `exec` 执行上面的命令
