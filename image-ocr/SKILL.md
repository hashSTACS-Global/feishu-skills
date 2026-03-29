---
name: image-ocr
description: |
  通用图片文字识别（OCR）技能，基于 PaddleOCR，支持中英文混排、表格、手写体。
  支持 png/jpg/jpeg/bmp/tiff/webp 等常见图片格式。
  全自动环境：无 Python 自动装 Python，无依赖自动装依赖，首次运行即用。
inline: true
---

# image-ocr

通用图片 OCR 文字识别。基于 PaddleOCR，中英文效果极佳，纯本地运行，不依赖外部 API。

## 使用方式

```bash
node ./ocr.js <image_path>
```

### 可选参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--json` | 输出 JSON 格式（含坐标、置信度） | 否，默认纯文本 |
| `--lang` | 识别语言 | `ch`（中英混排） |
| `--output` | 结果写入文件而非 stdout | 无 |

### 支持的语言代码

`ch`（中英混排）、`en`（英文）、`japan`（日文）、`korean`（韩文）等，完整列表见 PaddleOCR 文档。

### 输出格式

**纯文本模式**（默认）：逐行输出识别文字。

**JSON 模式**（`--json`）：
```json
{
  "success": true,
  "file_path": "/path/to/image.png",
  "lang": "ch",
  "line_count": 12,
  "char_count": 356,
  "lines": [
    { "text": "识别的文字", "confidence": 0.97, "box": [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] }
  ],
  "text": "全部文字合并..."
}
```

## 从其他技能调用

其他技能可直接通过 exec 调用：

```bash
node ../image-ocr/ocr.js "<image_path>" --json
```

例如 `feishu-docx-download` 提取 docx/pptx 中嵌入图片后，可调用本技能识别图片文字。

## 环境自举（全自动）

首次运行时 `ocr.js` 自动完成以下安装链，无需手动配置：

```
检测 Python 3.8+
├─ 已安装 → 直接使用
└─ 未安装 → 自动安装 Python：
    ├─ Windows: winget → choco → python.org 安装包 → 嵌入式包（无需管理员）
    └─ Linux:   apt-get → yum → dnf → apk → standalone 预编译包（无需 root）

检测 PaddleOCR（由 ocr.py 处理）
├─ 已安装 → 直接使用
└─ 未安装 → pip install paddlepaddle paddleocr（~500MB，仅首次）

检测 OCR 模型
├─ 已下载 → 直接使用
└─ 未下载 → 自动下载中英文模型（~100MB，仅首次）
```

Python 会优先安装到技能本地目录 `.python/`，不污染系统环境。

## 禁止事项

- **禁止**检查文件、列目录、检查环境，脚本已内置环境自检和自动安装
- **禁止**自行编写 OCR 代码，必须使用 `node ./ocr.js`
- **禁止**手动安装 Python 或 pip 依赖，脚本会自动处理
