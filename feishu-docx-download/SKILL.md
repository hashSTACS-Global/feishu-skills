---
name: feishu-docx-download
description: |
  从飞书 Wiki 下载附件并提取正文文本，支持 docx/doc/pdf/pptx/ppt/xlsx/xls/html/rtf/epub/txt/csv 等格式。
  仅适用于 Wiki 中以附件形式上传的文件（obj_type = file），在线云文档请用 feishu-fetch-doc。
overrides: feishu_wiki_space_node, feishu_drive_file, feishu_pre_auth
inline: true
---

# feishu-docx-download

⚠️ **读完本文件后，不要检查文件是否存在、不要检查环境、不要列目录。脚本文件已就绪，直接用 `exec` 工具执行下方命令。**

## 判断是否使用本技能

| URL 特征 | 文档形式 | 处理方式 |
|---------|---------|---------|
| 含 `/docx/` 或 `/docs/` | 在线云文档 | 用 **feishu-fetch-doc** |
| 含 `/wiki/`，`obj_type` 为 `doc`/`docx` | Wiki 云文档 | 用 **feishu-fetch-doc** |
| 含 `/wiki/`，`obj_type` 为 `file` | Wiki 附件 | **使用本技能** ✓ |

## 执行前确认

**以下参数缺失或含糊时，必须先向用户询问，不得猜测或使用默认值：**

| 参数 | 何时需要询问 |
|---|---|
| `--url` / `--file-token` | 用户未提供飞书 Wiki 链接或 file token |

## 步骤 1 — 下载文件

```bash
node ./download-doc.js --open-id "SENDER_OPEN_ID" --url "FEISHU_WIKI_URL"
```

也可直接传 file_token：

```bash
node ./download-doc.js --open-id "SENDER_OPEN_ID" --file-token "FILE_TOKEN" --type "docx"
```

可选参数：`--output-dir ./downloads`、`--output 自定义文件名.docx`

脚本输出 JSON，其中 `file_path` 为本地路径，`file_type` 为扩展名，`file_name` 为文件名。

## 需要授权时

若返回 `{"error":"auth_required"}`，执行：

```bash
node ../feishu-auth/auth.js --auth-and-poll --open-id "SENDER_OPEN_ID" --chat-id "CHAT_ID" --timeout 60
```

- `{"status":"authorized"}` → 重新执行下载命令
- `{"status":"polling_timeout"}` → **立即重新执行此 auth 命令**（不会重复发卡片）
- `CHAT_ID` 不知道可省略

## 步骤 2 — 提取文本

根据 `file_type` 选择对应的 Python 代码用 `exec` 执行（将 `<filepath>` 替换为实际路径）：

### docx

```python
import os, zipfile, re
path = "<filepath>"
size = os.path.getsize(path)
if size < 4096:
    print("ERROR: 文件太小，可能是预览版，请确认 drive:file:download 权限已开通。")
else:
    with zipfile.ZipFile(path) as z:
        if 'word/document.xml' not in z.namelist():
            print("ERROR: 缺少 word/document.xml，文件不完整。")
        else:
            xml = z.read('word/document.xml').decode('utf-8', errors='ignore')
            text = re.sub(r'<[^>]+>', ' ', xml)
            print(re.sub(r'\s+', ' ', text).strip())
```

### pdf

```python
import subprocess, sys, os
path = "<filepath>"
if os.path.getsize(path) < 1024:
    print("ERROR: 文件太小，可能是预览版。")
else:
    try: import fitz
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "PyMuPDF", "-q"]); import fitz
    doc = fitz.open(path)
    print("\n".join(page.get_text() for page in doc).strip())
    doc.close()
```

### pptx

```python
import subprocess, sys, os
path = "<filepath>"
try: from pptx import Presentation
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "python-pptx", "-q"]); from pptx import Presentation
prs = Presentation(path)
parts = []
for i, slide in enumerate(prs.slides, 1):
    texts = [p.text.strip() for shape in slide.shapes if shape.has_text_frame for p in shape.text_frame.paragraphs if p.text.strip()]
    if texts: parts += [f"--- 第{i}页 ---"] + texts
print("\n".join(parts))
```

### xlsx

```python
import subprocess, sys
path = "<filepath>"
try: from openpyxl import load_workbook
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "openpyxl", "-q"]); from openpyxl import load_workbook
wb = load_workbook(path, read_only=True, data_only=True)
for name in wb.sheetnames:
    print(f"--- {name} ---")
    for row in wb[name].iter_rows(values_only=True):
        cells = [str(c) if c is not None else "" for c in row]
        if any(cells): print("\t".join(cells))
wb.close()
```

### xls

```python
import subprocess, sys
path = "<filepath>"
try: import xlrd
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "xlrd", "-q"]); import xlrd
wb = xlrd.open_workbook(path)
for sheet in wb.sheets():
    print(f"--- {sheet.name} ---")
    for r in range(sheet.nrows):
        cells = [str(sheet.cell_value(r, c)) for c in range(sheet.ncols)]
        if any(c.strip() for c in cells): print("\t".join(cells))
```

### html / htm

```python
import re
path = "<filepath>"
for enc in ['utf-8', 'gb18030', 'gbk', 'latin-1']:
    try: html = open(path, encoding=enc).read(); break
    except UnicodeDecodeError: continue
html = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL|re.IGNORECASE)
text = re.sub(r'<[^>]+>', ' ', html)
text = text.replace('&nbsp;',' ').replace('&amp;','&').replace('&lt;','<').replace('&gt;','>')
print(re.sub(r'\s+', ' ', text).strip())
```

### txt / csv / md 等纯文本

```python
path = "<filepath>"
for enc in ['utf-8', 'gb18030', 'gbk', 'latin-1']:
    try: print(open(path, encoding=enc).read()); break
    except UnicodeDecodeError: continue
```

### doc / ppt（旧版 Office 97-2003）

```python
import subprocess, sys, re
path = "<filepath>"
try: import olefile
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "olefile", "-q"]); import olefile
ole = olefile.OleFileIO(path)
stream = 'WordDocument' if path.endswith('.doc') else 'PowerPoint Document'
if ole.exists(stream):
    data = ole.openstream(stream).read().decode('utf-8', errors='ignore')
    text = re.sub(r'[^\x20-\x7E\u4e00-\u9fff\n\r\t]', '', data)
    print(re.sub(r'\s+', ' ', text).strip() or "WARN: 旧版格式提取内容可能不完整，建议转换为新版格式后重新上传。")
else:
    print(f"ERROR: 无法识别文件结构（找不到 {stream}）")
ole.close()
```

### rtf

```python
import subprocess, sys
path = "<filepath>"
try: from striprtf.striprtf import rtf_to_text
except ImportError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "striprtf", "-q"]); from striprtf.striprtf import rtf_to_text
for enc in ['utf-8', 'gb18030', 'gbk', 'latin-1']:
    try: print(rtf_to_text(open(path, encoding=enc).read()).strip()); break
    except UnicodeDecodeError: continue
```

### epub

```python
import zipfile, re
path = "<filepath>"
with zipfile.ZipFile(path) as z:
    parts = []
    for name in z.namelist():
        if name.endswith(('.xhtml','.html','.htm')) and 'META-INF' not in name:
            html = z.read(name).decode('utf-8', errors='ignore')
            html = re.sub(r'<(script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL|re.IGNORECASE)
            text = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html)).strip()
            if text: parts.append(text)
    print("\n\n".join(parts))
```

## 禁止事项

- **禁止**检查文件、列目录、检查环境，脚本已就绪
- **禁止**调用任何 `feishu_` 开头的工具
- **禁止**只描述不执行，必须直接调用 `exec`
- `CHAT_ID` 为当前会话的 chat_id，如不知道可省略
