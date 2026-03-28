---
name: feishu-skills-installer
description: |
  飞书技能包安装器。执行 node install.js 即可完成安装。
---

# feishu-skills 安装

直接用 `exec` 执行，不要手动复制文件：

```bash
node ./install.js
```

脚本会自动检测环境（OpenClaw / EnClaws）并安装所有技能到正确目录。

## 禁止事项

- **禁止**手动复制技能目录到 skills 目录
- **禁止**修改目录结构
- 必须使用 install.js 安装
