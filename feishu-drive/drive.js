'use strict';
/**
 * feishu-drive: Minimal Feishu Drive helper using per-user OAuth token.
 *
 * Supported actions (others can be added later as needed):
 *
 *   # List folder contents
 *   node ./drive.js --open-id "ou_xxx" --action list --folder-token "TOKEN"
 *
 *   # Create folder
 *   node ./drive.js --open-id "ou_xxx" --action create_folder --name "文件夹名" --folder-token "父文件夹TOKEN"
 *
 * Output: always a single-line JSON object.
 *
 * Common fields:
 *   - On success, include `reply` for user-facing text, plus action-specific data.
 *   - On auth error:   {"error":"auth_required", "message":"..."}
 *   - On perm error:   {"error":"permission_required", "required_scopes":[...], "reply":"..."}
 *   - On other errors: {"error":"api_error", "message":"..."}
 */

const path = require('path');
const { getConfig, getValidToken } = require(
  path.join(__dirname, '../feishu-auth/token-utils.js'),
);

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs() {
  const argv = process.argv.slice(2);
  const r = {
    openId: null,
    action: null,
    folderToken: '',
    name: '',
  };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--open-id':
        r.openId = argv[++i];
        break;
      case '--action':
        r.action = argv[++i];
        break;
      case '--folder-token':
        r.folderToken = argv[++i];
        break;
      case '--name':
        r.name = argv[++i];
        break;
    }
  }
  return r;
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function die(obj) {
  out(obj);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Feishu Drive API helpers
// ---------------------------------------------------------------------------

async function apiCall(method, urlPath, token, { body, query } = {}) {
  let url = `https://open.feishu.cn/open-apis${urlPath}`;
  if (query && Object.keys(query).length > 0) {
    const qs = new URLSearchParams(query).toString();
    url += (url.includes('?') ? '&' : '?') + qs;
  }

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`Feishu API parse error: ${res.status} ${res.statusText}`);
  }
  return data;
}

/**
 * List all items in a folder (auto-paginates).
 * If folderToken is empty string, list root directory.
 */
async function listFolder(accessToken, folderToken) {
  const items = [];
  let pageToken;

  do {
    const query = {
      page_size: '200',
    };
    if (folderToken) query.folder_token = folderToken;
    if (pageToken) query.page_token = pageToken;

    const data = await apiCall('GET', '/drive/v1/files', accessToken, { query });
    if (data.code !== 0) {
      throw new Error(`List folder failed: code=${data.code} msg=${data.msg}`);
    }

    const list = data.data?.files || data.data?.items || [];
    for (const it of list) {
      items.push({
        token: it.token,
        name: it.name,
        type: it.type,
        parent_token: it.parent_token,
        url: it.url,
      });
    }

    pageToken = data.data?.has_more ? data.data.page_token : undefined;
  } while (pageToken);

  return items;
}

/**
 * Create a folder under the given parent folder.
 */
async function createFolder(accessToken, name, parentFolderToken) {
  const body = {
    name,
    folder_token: parentFolderToken || '',
  };
  const data = await apiCall('POST', '/drive/v1/files/create_folder', accessToken, { body });
  if (data.code !== 0) {
    throw new Error(`Create folder failed: code=${data.code} msg=${data.msg}`);
  }
  return data.data;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  if (!args.openId) {
    die({ error: 'missing_param', message: '--open-id 参数必填' });
  }
  if (!args.action) {
    die({ error: 'missing_param', message: '--action 参数必填（list 或 create_folder）' });
  }

  let cfg;
  try {
    cfg = getConfig(__dirname);
  } catch (err) {
    die({ error: 'config_error', message: err.message });
  }

  let accessToken;
  try {
    accessToken = await getValidToken(args.openId, cfg.appId, cfg.appSecret);
  } catch (err) {
    die({ error: 'token_error', message: err.message });
  }

  if (!accessToken) {
    die({
      error: 'auth_required',
      message:
        '用户未完成飞书授权或授权已过期。请调用 feishu-auth skill 完成授权后重试。\n' +
        `用户 open_id: ${args.openId}`,
    });
  }

  try {
    if (args.action === 'list') {
      const items = await listFolder(accessToken, args.folderToken || '');
      out({
        action: 'list',
        folder_token: args.folderToken || '',
        count: items.length,
        items,
        reply: `当前文件夹下共有 ${items.length} 个项目。`,
      });
      return;
    }

    if (args.action === 'create_folder') {
      if (!args.name) {
        die({ error: 'missing_param', message: '--name 参数必填（新建文件夹名称）' });
      }
      const data = await createFolder(accessToken, args.name, args.folderToken || '');
      const token = data?.token;
      const url = data?.url || (token ? `https://www.feishu.cn/drive/folder/${token}` : '');
      out({
        action: 'create_folder',
        folder_token: token,
        url,
        name: args.name,
        parent_folder_token: args.folderToken || '',
        reply: `已在目标目录下创建文件夹「${args.name}」。`,
      });
      return;
    }

    // Unsupported action
    die({
      error: 'unsupported_action',
      message: `暂未实现的 action: ${args.action}。当前仅支持 list 和 create_folder。`,
    });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('99991663')) {
      die({
        error: 'auth_required',
        message: '飞书 token 已失效，请重新授权（调用 feishu-auth）',
      });
    }
    if (msg.includes('99991400')) {
      die({ error: 'rate_limited', message: msg || '请求频率超限，请稍后重试' });
    }
    if (msg.includes('99991672') || msg.includes('99991679') || /permission|scope|not support|tenant/i.test(msg)) {
      die({
        error: 'permission_required',
        message: msg,
        required_scopes: ['drive:drive', 'drive:drive:readonly'],
        reply: '⚠️ **权限不足，需要重新授权以获取访问云盘的权限。**',
      });
    }
    die({ error: 'api_error', message: err.message });
  }
}

main();

