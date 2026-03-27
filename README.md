[中文](README.zh.md) | English

# feishu-skills

A complete set of Feishu (Lark / 飞书) integration skills for [OpenClaw](https://github.com/openclaw/openclaw) and [EnClaws](https://github.com/hashSTACS-Global/EnClaws).

Enables AI agents to read/write Feishu documents, send messages, manage calendars, tasks, and multi-dimensional tables — all authenticated with per-user OAuth tokens (not bot-owner tokens).

---

## Skills Included

| Skill | Description |
|---|---|
| **feishu-auth** | OAuth Device Flow auth hub. Shared by all other skills. |
| **feishu-create-doc** | Create Feishu Docs with Markdown content |
| **feishu-fetch-doc** | Read Feishu Docs / Wiki pages |
| **feishu-update-doc** | Update Feishu Docs (append or overwrite blocks) |
| **feishu-im-read** | Read Feishu IM chat history |
| **feishu-calendar** | Create / query / update calendar events |
| **feishu-task** | Create / query / update tasks and task lists |
| **feishu-bitable** | Full CRUD on Bitable apps, tables, fields, records, and views |
| **feishu-docx-download** | Download file attachments from Feishu Wiki and extract text content (docx/pdf/pptx/xlsx/xls/html/rtf/epub/txt/csv, etc.) |

---

## Requirements

- **Node.js** ≥ 18 (uses built-in `fetch`)
- **[OpenClaw](https://github.com/openclaw/openclaw)** or **[EnClaws](https://github.com/hashSTACS-Global/EnClaws)** installed
- A Feishu app with the following permissions (see [Configuration](#configuration)):
  - `docs:doc`, `wiki:wiki:readonly`, `drive:drive`
  - `im:message:readonly`
  - `calendar:calendar`
  - `task:task`
  - `bitable:app`

---

## Installation

### Option A — AI-driven (recommended)

Tell your [OpenClaw](https://github.com/openclaw/openclaw) or [EnClaws](https://github.com/hashSTACS-Global/EnClaws) agent:

```
帮我安装飞书技能包：https://github.com/hashSTACS-Global/feishu-skills
```

The agent will run the install script automatically. After installation, restart OpenClaw/EnClaws.

### Option B — One-liner (terminal)

**macOS / Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/hashSTACS-Global/feishu-skills/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/hashSTACS-Global/feishu-skills/main/install.ps1 | iex
```

### Option C — Manual

```bash
# Clone the repo
git clone https://github.com/hashSTACS-Global/feishu-skills.git
cd feishu-skills

# macOS / Linux
bash install.sh

# Windows
powershell -ExecutionPolicy Bypass -File install.ps1
```

The scripts auto-detect your environment and install to the correct directory:
- **OpenClaw**: `~/.openclaw/workspace/skills/`
- **EnClaws**: `~/.enclaws/tenants/<tenant-id>/skills/`

To specify a custom target directory:
```bash
bash install.sh --target /path/to/skills
```

---

## Configuration

### OpenClaw

Your `~/.openclaw/openclaw.json` must have a `channels.feishu` section with your app credentials:

```json
{
  "channels": {
    "feishu": {
      "appId": "cli_xxxxxxxxxxxxxxxx",
      "appSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
    }
  },
  "tools": {
    "deny": [
      "feishu_doc",
      "feishu_wiki",
      "feishu_bitable_*",
      "feishu_calendar_*",
      "feishu_task_*",
      "feishu_pre_auth"
    ],
    "exec": {
      "security": "full",
      "ask": "off"
    }
  }
}
```

> **Why `tools.deny`?** OpenClaw has built-in Feishu plugin tools (`feishu_doc`, etc.). These skills replace them with richer, per-user OAuth versions. Denying the built-in tools ensures the agent uses these skills instead.

### EnClaws

Credentials are injected automatically via environment variables (`FEISHU_APP_ID`, `FEISHU_APP_SECRET`). No manual configuration needed.

---

## How Authentication Works

These skills use **Feishu OAuth Device Flow** — each user authorizes once via a link, and their token is stored locally in `feishu-auth/.tokens/<open_id>/`.

**First use flow:**
1. User asks the agent to do something (e.g., create a doc)
2. Script returns `{"error": "auth_required"}` with an auth URL
3. Agent presents an authorization card/link to the user
4. User clicks and authorizes in Feishu
5. Agent automatically retries the original operation
6. Token is saved; future calls are transparent

**Token lifecycle:**
- Access tokens auto-refresh via refresh token (no re-auth needed)
- Tokens are stored per user (`open_id`) per app (`appId`)
- Re-auth only needed if refresh token expires (~30 days of inactivity)

---

## Credential Resolution Order

Scripts resolve app credentials in this order:

1. **Environment variables** `FEISHU_APP_ID` + `FEISHU_APP_SECRET` ← EnClaws injects these
2. **`feishu-auth/config.json`** ← manual single-app setup
3. **`~/.openclaw/openclaw.json`** → `channels.feishu.appId/appSecret` ← OpenClaw standard

---

## Usage Examples

Once installed, just talk to your agent naturally:

```
帮我创建一个飞书文档，标题"Q1 OKR"，内容是...
读一下这个飞书文档：https://xxx.feishu.cn/docx/...
查看我今天的日程
帮我创建一个任务：明天下午3点前提交报告
在这个多维表格里新增一条记录：...
```

---

## Project Structure

```
feishu-skills/
├── feishu-auth/          # Auth hub (shared by all skills)
│   ├── SKILL.md
│   ├── auth.js           # Device Flow initiation + polling
│   └── token-utils.js    # Token read/write/refresh utilities
├── feishu-create-doc/
│   ├── SKILL.md
│   └── create-doc.js
├── feishu-fetch-doc/
│   ├── SKILL.md
│   └── fetch-doc.js
├── feishu-update-doc/
│   ├── SKILL.md
│   └── update-doc.js
├── feishu-im-read/
│   ├── SKILL.md
│   └── im-read.js
├── feishu-calendar/
│   ├── SKILL.md
│   └── calendar.js
├── feishu-task/
│   ├── SKILL.md
│   └── task.js
├── feishu-bitable/
│   ├── SKILL.md
│   └── bitable.js
├── feishu-docx-download/
│   ├── SKILL.md
│   └── download-doc.js
├── install.sh            # Unix/macOS installer
└── install.ps1           # Windows installer
```

---

## Compatibility

| Environment | Status |
|---|---|
| [OpenClaw](https://github.com/openclaw/openclaw) (original) | ✅ Fully supported |
| [EnClaws](https://github.com/hashSTACS-Global/EnClaws) | ✅ Fully supported |
| macOS | ✅ |
| Linux | ✅ |
| Windows | ✅ |

