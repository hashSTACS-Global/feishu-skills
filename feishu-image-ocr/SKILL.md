---
name: feishu-image-ocr
description: |
  通用图片文字识别（OCR），调用飞书 OCR API，支持中英文混排。
  支持 png/jpg/jpeg/bmp/gif/webp/tiff 等常见图片格式。
  纯 Node.js 实现，零额外依赖，复用 feishu-auth 授权体系。
inline: true
---

# feishu-image-ocr

通用图片 OCR 文字识别。调用飞书 OCR API，中英文效果好，纯 Node.js，零额外依赖。

⚠️ **读完本文件后，不要检查文件是否存在、不要检查环境、不要列目录。脚本文件已就绪，直接用 `exec` 工具执行下方命令。**

## 使用方式

```bash
node ./ocr.js --open-id "SENDER_OPEN_ID" --image "<image_path>"
```

### 可选参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--json` | 输出 JSON 格式（含逐行文本列表） | 否，默认纯文本 |

### 输出格式

**纯文本模式**（默认）：逐行输出识别文字。

**JSON 模式**（`--json`）：
```json
{
  "success": true,
  "file_path": "/path/to/image.png",
  "line_count": 12,
  "char_count": 356,
  "text_list": ["第一行", "第二行"],
  "text": "第一行\n第二行"
}
```

## 从其他技能调用

其他技能可直接通过 exec 调用：

```bash
node ../feishu-image-ocr/ocr.js --open-id "SENDER_OPEN_ID" --image "<image_path>" --json
```

例如 `feishu-docx-download` 提取 docx/pptx 中嵌入图片后，可调用本技能识别图片文字。

## 需要授权时

若返回 `{"error":"auth_required"}`，执行：

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID" --timeout 60
```

授权成功后重新执行 OCR 命令。

## 权限要求

需要飞书应用开通 `recognition:image` 权限。

## 禁止事项

- **禁止**检查文件、列目录、检查环境，脚本已就绪
- **禁止**自行编写 OCR 代码或调用其他 OCR API/库
- **禁止**只描述不执行，必须直接调用 `exec`
