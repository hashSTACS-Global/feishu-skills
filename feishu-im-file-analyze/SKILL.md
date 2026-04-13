---
name: feishu-im-file-analyze
description: |
  下载并解析飞书 IM 消息里的附件（.pdf / .zip / .docx / .txt / .md / .csv / .json / .log / .html / .xml），
  返回结构化文本供 AI 分析。zip 会自动解压后递归处理支持的类型。
  适用场景：HR 发 PDF 简历给老板、老板转给机器人分析；群里发 zip 让机器人总结内容等。
inline: true
---

# feishu-im-file-analyze

> **模块兼容**：脚本提供 `.js` 和 `.mjs` 两个版本。优先使用 `.js`，若报 `require is not defined` 改用 `.mjs`。

直接用 `exec` 执行，不要检查文件或环境。

## 系统依赖

本 skill **不依赖任何 npm 包**，但需要部署机器预装系统工具：

| 工具 | 用途 | 安装 |
|---|---|---|
| `unzip` | 解压 zip / docx / xlsx | Linux: `apt install unzip`；macOS 自带；Windows: PowerShell `Expand-Archive` 或装 [7-Zip] |
| `pdftotext` | PDF 抽文本 | Linux: `apt install poppler-utils`；macOS: `brew install poppler`；Windows: `choco install poppler` |

启动时会自动探测，缺哪个报哪个，**不会静默降级**。

## 命令

### 分析 IM 消息里的附件

```bash
node ./analyze.js --message-id "om_xxx" --file-key "file_v3_xxx"
```

### 分析本地文件（测试 / 已下载的附件）

```bash
node ./analyze.js --local-path "/tmp/foo.zip"
```

### 可选参数

| 参数 | 默认 | 说明 |
|---|---|---|
| `--max-size-mb` | 50 | 单文件大小上限 |
| `--max-files` | 100 | zip 内文件数上限 |
| `--max-text-kb` | 200 | 总文本上限（防爆上下文） |
| `--per-file-kb` | 20 | 单个文件抽出文本截断 |
| `--keep-temp` | 否 | 调试用，保留临时目录 |

## 支持的类型

| 扩展名 / 魔数 | 处理方式 |
|---|---|
| `.pdf` | `pdftotext -layout -enc UTF-8` |
| `.zip` | `unzip` 解压到临时目录 → 递归处理 |
| `.docx` | `unzip` 抽 `word/document.xml` 纯文本（轻量）；如需完整格式调 feishu-docx-download |
| `.txt` `.md` `.csv` `.json` `.log` `.xml` `.html` `.yaml` `.yml` | UTF-8 直接读 |
| `.png` `.jpg` `.jpeg` `.gif` `.webp` | 返回元信息 + 提示调 feishu-image-ocr |
| 其他 | 返回元信息 + `"unsupported"` |

## 不支持的场景（硬失败）

- ❌ **IM 文件夹附件**（`<folder key="file_v3_..."/>`）——飞书 open API 未公开，直接返回 `error: folder_attachment_not_supported`，引导用户压缩成 zip 或上传云盘
- ❌ 加密 / 带密码的 zip / pdf
- ❌ 超过 `--max-size-mb` 的单文件

## 输出格式

单行 JSON：

```json
{
  "action": "analyze",
  "source": { "kind": "im|local", "message_id": "...", "file_key": "...", "path": "..." },
  "root_type": "pdf|zip|docx|text|image|unsupported",
  "files": [
    {
      "path": "resume.pdf",
      "size": 12345,
      "type": "pdf",
      "text": "抽取出的文本...",
      "truncated": false
    }
  ],
  "total_files": 3,
  "total_text_bytes": 45678,
  "text_truncated": false,
  "warnings": [],
  "reply": "已解析「文件名」的 N 个文件，共 X 字符文本。"
}
```

失败场景：

```json
{ "error": "missing_system_tool", "tool": "pdftotext", "install_hint": "apt install poppler-utils" }
{ "error": "resource_not_found", "api_code": 234003, "possible_causes": [...], "hint": "..." }
{ "error": "file_too_large", "size_mb": 123, "limit_mb": 50 }
{ "error": "auth_required" }
```

### 关于 `resource_not_found` (234003)

飞书返回 `234003 "File not in msg."` 有**多种可能原因**，**不要**自动判定为文件夹附件：

1. **message_id 与 file_key 不匹配**（最常见）—— 必须来自同一条消息
2. **file_key 已过期**
3. 消息被撤回或机器人无权访问
4. 真是 IM 文件夹附件（API 不支持读取）

调用方应先核对 message_id 和 file_key 是否配对，而不是直接引导用户"压缩 zip"。

## 授权

使用 `tenant_access_token`（应用级，需 `im:resource` 权限）。无需用户 OAuth。

若返回 `{"error":"permission_required"}`，告知用户管理员需在飞书开放平台开通 `im:resource` 权限。
