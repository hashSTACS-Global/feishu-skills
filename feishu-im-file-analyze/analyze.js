'use strict';
/**
 * feishu-im-file-analyze: Download & extract text from IM attachments.
 *
 * Zero npm dependencies. Relies on system tools: `unzip`, `pdftotext`.
 *
 * Usage:
 *   node analyze.js --message-id "om_xxx" --file-key "file_v3_xxx"
 *   node analyze.js --local-path "/tmp/foo.zip"
 *
 * Output: single-line JSON (see SKILL.md).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { getConfig } = require(path.join(__dirname, '../feishu-auth/token-utils.js'));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEXT_EXTS = new Set([
  '.txt', '.md', '.csv', '.json', '.log', '.xml', '.html', '.htm', '.yaml', '.yml', '.ini', '.conf', '.tsv',
]);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']);

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs() {
  const argv = process.argv.slice(2);
  const r = {
    messageId: null,
    fileKey: null,
    localPath: null,
    maxSizeMb: 50,
    maxFiles: 100,
    maxTextKb: 200,
    perFileKb: 20,
    keepTemp: false,
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--message-id':  r.messageId = argv[++i]; break;
      case '--file-key':    r.fileKey = argv[++i]; break;
      case '--local-path':  r.localPath = argv[++i]; break;
      case '--max-size-mb': r.maxSizeMb = Math.max(1, parseInt(argv[++i], 10) || 50); break;
      case '--max-files':   r.maxFiles = Math.max(1, parseInt(argv[++i], 10) || 100); break;
      case '--max-text-kb': r.maxTextKb = Math.max(1, parseInt(argv[++i], 10) || 200); break;
      case '--per-file-kb': r.perFileKb = Math.max(1, parseInt(argv[++i], 10) || 20); break;
      case '--keep-temp':   r.keepTemp = true; break;
    }
  }
  return r;
}

function out(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }
function die(obj) { out(obj); process.exit(1); }

// ---------------------------------------------------------------------------
// System tool detection
// ---------------------------------------------------------------------------

function which(tool) {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const p = execFileSync(cmd, [tool], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return p.split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

function requireTool(tool, installHint) {
  if (!which(tool)) {
    die({ error: 'missing_system_tool', tool, install_hint: installHint,
          reply: `系统未安装 \`${tool}\`，请先安装：${installHint}` });
  }
}

// ---------------------------------------------------------------------------
// IM resource download
// ---------------------------------------------------------------------------

async function getTenantAccessToken(appId, appSecret) {
  const res = await fetch(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    },
  );
  const j = await res.json();
  if (j.code !== 0) throw new Error(`tenant token failed: code=${j.code} msg=${j.msg}`);
  return j.tenant_access_token;
}

async function downloadIMResource(messageId, fileKey, outPath) {
  let cfg;
  try { cfg = getConfig(__dirname); } catch (e) {
    die({ error: 'config_error', message: e.message });
  }

  let token;
  try { token = await getTenantAccessToken(cfg.appId, cfg.appSecret); }
  catch (e) { die({ error: 'token_error', message: e.message }); }

  const url =
    `https://open.feishu.cn/open-apis/im/v1/messages/${encodeURIComponent(messageId)}` +
    `/resources/${encodeURIComponent(fileKey)}?type=file`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json') || res.status >= 400) {
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
    const code = parsed?.code;

    // code 234003 "File not in msg." has MULTIPLE possible causes — do not
    // assume folder attachment. Report faithfully and let the LLM decide.
    if (code === 234003 || /File not in msg/i.test(parsed?.msg || '')) {
      die({
        error: 'resource_not_found',
        api_code: code,
        api_msg: parsed?.msg,
        possible_causes: [
          '1. message_id 与 file_key 不匹配（最常见——检查两者是否来自同一条消息）',
          '2. file_key 已过期（飞书 IM 附件 file_key 有有效期）',
          '3. 消息已撤回或机器人无权访问该消息',
          '4. 附件是"IM 文件夹附件"（<folder key=.../>），飞书 open API 不支持读取（返回相同错误码）',
        ],
        hint: '请先确认 message_id 与 file_key 来自同一条消息。若确认无误且为文件夹附件，请让用户改用：① 本地压缩为 .zip 发送；或 ② 上传云盘后分享链接。',
        reply:
          `❌ 无法下载该附件（飞书返回 234003 "${parsed?.msg || 'File not in msg.'}"）。\n` +
          '可能原因：message_id 与 file_key 不匹配、file_key 过期、消息撤回，或是文件夹附件（open API 不支持）。\n' +
          '建议先核对 message_id 和 file_key 是否匹配；若确为文件夹附件，请压缩为 .zip 后重发。',
      });
    }
    if (code === 99991672 || code === 99991679 || /permission|scope/i.test(parsed?.msg || '')) {
      die({
        error: 'permission_required',
        api_error: parsed,
        required_scopes: ['im:resource'],
        reply: '⚠️ 应用缺少 `im:resource` 权限，无法下载 IM 附件。请管理员在飞书开放平台开通。',
      });
    }
    die({ error: 'download_failed', http_status: res.status, api_error: parsed });
  }

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);

  // Attempt to extract filename from Content-Disposition
  const cd = res.headers.get('content-disposition') || '';
  let filename = null;
  const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (m) {
    try { filename = decodeURIComponent(m[1]); } catch { filename = m[1]; }
  }
  return { size: buf.length, filename };
}

// ---------------------------------------------------------------------------
// Magic-byte detection
// ---------------------------------------------------------------------------

function detectKind(buf, ext) {
  if (buf && buf.length >= 4) {
    const b = buf;
    if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07)) {
      // PK zip. Could be .zip, .docx, .xlsx, .jar, etc. Prefer extension hint.
      if (ext === '.docx') return 'docx';
      return 'zip';
    }
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf';
  }
  if (ext === '.pdf') return 'pdf';
  if (ext === '.zip') return 'zip';
  if (ext === '.docx') return 'docx';
  if (TEXT_EXTS.has(ext)) return 'text';
  if (IMAGE_EXTS.has(ext)) return 'image';
  return 'unsupported';
}

// ---------------------------------------------------------------------------
// Extractors (all use execFile for injection safety)
// ---------------------------------------------------------------------------

function truncate(s, maxBytes) {
  if (!s) return { text: '', truncated: false };
  const buf = Buffer.from(s, 'utf8');
  if (buf.length <= maxBytes) return { text: s, truncated: false };
  return { text: buf.slice(0, maxBytes).toString('utf8'), truncated: true };
}

function extractPdf(filePath, perFileBytes) {
  requireTool('pdftotext', 'apt install poppler-utils / brew install poppler / choco install poppler');
  try {
    const text = execFileSync(
      'pdftotext',
      ['-layout', '-enc', 'UTF-8', '-nopgbrk', filePath, '-'],
      { maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
    ).toString('utf8');
    return truncate(text, perFileBytes);
  } catch (e) {
    return { text: '', truncated: false, error: `pdftotext failed: ${e.message}` };
  }
}

function extractText(filePath, perFileBytes) {
  try {
    const buf = fs.readFileSync(filePath);
    return truncate(buf.toString('utf8'), perFileBytes);
  } catch (e) {
    return { text: '', truncated: false, error: e.message };
  }
}

function extractDocx(filePath, perFileBytes, tmpRoot) {
  requireTool('unzip', 'apt install unzip / brew install unzip');
  const docxTmp = fs.mkdtempSync(path.join(tmpRoot, 'docx-'));
  try {
    execFileSync('unzip', ['-o', '-q', filePath, 'word/document.xml', '-d', docxTmp],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    const xml = fs.readFileSync(path.join(docxTmp, 'word', 'document.xml'), 'utf8');
    const text = xml
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<w:br[^>]*\/?>/g, '\n')
      .replace(/<w:tab[^>]*\/?>/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return truncate(text, perFileBytes);
  } catch (e) {
    return { text: '', truncated: false, error: `docx extract failed: ${e.message}` };
  } finally {
    try { fs.rmSync(docxTmp, { recursive: true, force: true }); } catch {}
  }
}

function listZip(zipPath) {
  const outStr = execFileSync('unzip', ['-l', zipPath],
    { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 }).toString('utf8');
  const lines = outStr.split(/\r?\n/);
  const entries = [];
  let totalBytes = 0;
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}\s+(.+)$/);
    if (m) {
      const size = parseInt(m[1], 10);
      const name = m[2];
      if (!name.endsWith('/')) {
        entries.push({ name, size });
        totalBytes += size;
      }
    }
  }
  return { entries, totalBytes };
}

function extractZip(zipPath, tmpRoot) {
  requireTool('unzip', 'apt install unzip / brew install unzip');
  const dest = fs.mkdtempSync(path.join(tmpRoot, 'zip-'));
  execFileSync('unzip', ['-o', '-q', zipPath, '-d', dest],
    { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 16 * 1024 * 1024 });
  return dest;
}

// ---------------------------------------------------------------------------
// Directory walker
// ---------------------------------------------------------------------------

function walk(dir, rootDir, out) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const full = path.join(dir, it.name);
    if (it.isDirectory()) {
      walk(full, rootDir, out);
    } else if (it.isFile()) {
      const rel = path.relative(rootDir, full);
      const st = fs.statSync(full);
      out.push({ abs: full, rel, size: st.size });
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function analyzeSingleFile(filePath, displayName, limits, tmpRoot, warnings) {
  const size = fs.statSync(filePath).size;
  if (size > limits.maxSize) {
    warnings.push(`跳过 ${displayName}：超过单文件上限 ${limits.maxSize} 字节`);
    return { path: displayName, size, type: 'skipped_too_large' };
  }

  const ext = path.extname(displayName).toLowerCase();
  let magicHead = null;
  try {
    const fd = fs.openSync(filePath, 'r');
    const tmp = Buffer.alloc(8);
    fs.readSync(fd, tmp, 0, 8, 0);
    fs.closeSync(fd);
    magicHead = tmp;
  } catch {}

  const kind = detectKind(magicHead, ext);

  if (kind === 'pdf') {
    const r = extractPdf(filePath, limits.perFileBytes);
    return { path: displayName, size, type: 'pdf', ...r };
  }
  if (kind === 'docx') {
    const r = extractDocx(filePath, limits.perFileBytes, tmpRoot);
    return { path: displayName, size, type: 'docx', ...r };
  }
  if (kind === 'text') {
    const r = extractText(filePath, limits.perFileBytes);
    return { path: displayName, size, type: 'text', ...r };
  }
  if (kind === 'image') {
    return { path: displayName, size, type: 'image',
             text: '', truncated: false,
             note: '图片文件，如需识别文字请调用 feishu-image-ocr skill' };
  }
  return { path: displayName, size, type: 'unsupported', text: '', truncated: false };
}

async function main() {
  const args = parseArgs();

  const limits = {
    maxSize: args.maxSizeMb * 1024 * 1024,
    maxFiles: args.maxFiles,
    maxTextBytes: args.maxTextKb * 1024,
    perFileBytes: args.perFileKb * 1024,
  };

  const usingIM = args.messageId && args.fileKey;
  if (!usingIM && !args.localPath) {
    die({ error: 'missing_param',
          message: '必须提供 --message-id + --file-key，或者 --local-path' });
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-analyze-'));
  const warnings = [];
  const source = {};
  let workPath = args.localPath;
  let rootName = args.localPath ? path.basename(args.localPath) : 'attachment.bin';

  try {
    // --- Download if needed ---
    if (usingIM) {
      const dlPath = path.join(tmpRoot, 'download.bin');
      const info = await downloadIMResource(args.messageId, args.fileKey, dlPath);
      workPath = dlPath;
      if (info.filename) rootName = info.filename;
      source.kind = 'im';
      source.message_id = args.messageId;
      source.file_key = args.fileKey;
      source.filename = info.filename;
      source.downloaded_bytes = info.size;
    } else {
      source.kind = 'local';
      source.path = path.resolve(args.localPath);
    }

    // --- Size gate ---
    const st = fs.statSync(workPath);
    if (st.size > limits.maxSize) {
      die({ error: 'file_too_large',
            size_mb: +(st.size / 1024 / 1024).toFixed(2),
            limit_mb: args.maxSizeMb,
            reply: `文件过大（${(st.size / 1024 / 1024).toFixed(1)} MB），超出 ${args.maxSizeMb} MB 限制` });
    }

    // --- Detect kind ---
    let head = Buffer.alloc(8);
    try {
      const fd = fs.openSync(workPath, 'r');
      fs.readSync(fd, head, 0, 8, 0);
      fs.closeSync(fd);
    } catch {}
    const rootExt = path.extname(rootName).toLowerCase();
    const rootKind = detectKind(head, rootExt);

    const files = [];
    let totalText = 0;
    let textTruncated = false;

    // --- Dispatch ---
    if (rootKind === 'zip') {
      requireTool('unzip', 'apt install unzip / brew install unzip');
      // Count/size check before extracting
      const listing = listZip(workPath);
      if (listing.entries.length > limits.maxFiles) {
        die({ error: 'too_many_files',
              count: listing.entries.length, limit: limits.maxFiles,
              reply: `zip 内 ${listing.entries.length} 个文件，超出 ${limits.maxFiles} 上限` });
      }
      if (listing.totalBytes > limits.maxSize * 2) {
        warnings.push(`zip 解压后估计 ${(listing.totalBytes / 1024 / 1024).toFixed(1)}MB，较大`);
      }

      const extractDir = extractZip(workPath, tmpRoot);
      const walked = [];
      walk(extractDir, extractDir, walked);

      for (const f of walked) {
        if (totalText >= limits.maxTextBytes) {
          textTruncated = true;
          warnings.push(`总文本达上限 ${args.maxTextKb}KB，停止抽取剩余文件`);
          break;
        }
        const remaining = limits.maxTextBytes - totalText;
        const perFile = Math.min(limits.perFileBytes, remaining);
        const item = analyzeSingleFile(f.abs, f.rel, { ...limits, perFileBytes: perFile }, tmpRoot, warnings);
        if (item.text) totalText += Buffer.byteLength(item.text, 'utf8');
        files.push(item);
      }
    } else {
      const item = analyzeSingleFile(workPath, rootName, limits, tmpRoot, warnings);
      if (item.text) totalText += Buffer.byteLength(item.text, 'utf8');
      files.push(item);
    }

    const totalTextKb = +(totalText / 1024).toFixed(2);
    out({
      action: 'analyze',
      source,
      root_name: rootName,
      root_type: rootKind,
      files,
      total_files: files.length,
      total_text_bytes: totalText,
      total_text_kb: totalTextKb,
      text_truncated: textTruncated,
      warnings,
      reply: `已解析「${rootName}」的 ${files.length} 个文件，共 ${totalTextKb}KB 文本${textTruncated ? '（已截断）' : ''}。`,
    });
  } finally {
    if (!args.keepTemp) {
      try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
    }
  }
}

main().catch(err => die({ error: 'unexpected', message: err.message, stack: err.stack }));
