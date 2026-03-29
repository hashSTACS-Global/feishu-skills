'use strict';
/**
 * Image OCR via Feishu API.
 *
 * Usage:
 *   node ./ocr.js --open-id "ou_xxx" --image "<image_path>"
 *   node ./ocr.js --open-id "ou_xxx" --image "<image_path>" --json
 *
 * Options:
 *   --open-id    Feishu open_id of the requesting user (required)
 *   --image      Path to image file (required)
 *   --json       Output as JSON with text_list and metadata
 *
 * Supported formats: png, jpg, jpeg, bmp, gif, webp, tiff, tif
 * Image will be base64-encoded and sent to Feishu OCR API.
 */

const fs = require('fs');
const path = require('path');
const { getConfig, getValidToken } = require(path.join(__dirname, '../feishu-auth/token-utils.js'));

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(name) {
  const i = args.indexOf(name);
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : null;
}

const openId    = getArg('--open-id');
const imagePath = getArg('--image');
const jsonMode  = args.includes('--json');

const SUPPORTED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp', '.tiff', '.tif']);

function fail(obj) {
  console.log(JSON.stringify(obj));
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
if (!openId) {
  fail({ error: 'missing_arg', message: '--open-id is required' });
}
if (!imagePath) {
  fail({ error: 'missing_arg', message: '--image is required' });
}
if (!fs.existsSync(imagePath)) {
  fail({ error: 'file_not_found', message: `File not found: ${imagePath}` });
}

const ext = path.extname(imagePath).toLowerCase();
if (!SUPPORTED_EXTS.has(ext)) {
  fail({
    error: 'unsupported_format',
    message: `Unsupported image format: ${ext}, supported: ${[...SUPPORTED_EXTS].join(', ')}`,
  });
}

const fileSize = fs.statSync(imagePath).size;
if (fileSize < 100) {
  fail({ error: 'file_too_small', message: `File too small (${fileSize} bytes), may be corrupted.` });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Load credentials
  let cfg;
  try {
    cfg = getConfig(__dirname);
  } catch (e) {
    fail({ error: 'config_error', message: e.message });
  }

  // Get valid OAuth token
  const accessToken = await getValidToken(openId, cfg.appId, cfg.appSecret);
  if (!accessToken) {
    console.log(JSON.stringify({ error: 'auth_required' }));
    process.exit(0);
  }

  // Read and base64-encode image
  const imageBuffer = fs.readFileSync(imagePath);
  const imageBase64 = imageBuffer.toString('base64');

  // Call Feishu OCR API
  const res = await fetch(
    'https://open.feishu.cn/open-apis/optical_char_recognition/v1/image/basic_recognize',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageBase64 }),
    },
  );

  let data;
  try {
    data = await res.json();
  } catch {
    fail({ error: 'api_parse_error', status: res.status, message: 'Failed to parse API response.' });
  }

  if (data.code !== 0) {
    fail({ error: 'api_error', code: data.code, message: data.msg || 'OCR API returned an error.' });
  }

  const textList = data.data?.text_list || [];
  const fullText = textList.join('\n');

  if (jsonMode) {
    console.log(JSON.stringify({
      success: true,
      file_path: path.resolve(imagePath),
      line_count: textList.length,
      char_count: fullText.length,
      text_list: textList,
      text: fullText,
    }));
  } else {
    if (!fullText) {
      console.log('[OCR] No text detected in image.');
    } else {
      console.log(fullText);
    }
  }
}

main().catch(e => {
  fail({ error: 'unexpected_error', message: e.message });
});
