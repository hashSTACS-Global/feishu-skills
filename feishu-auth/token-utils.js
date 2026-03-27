'use strict';
/**
 * Feishu per-user OAuth token utilities.
 *
 * This file lives in feishu-auth/ which is the central auth hub for all
 * Feishu skills. Other skills reference it as:
 *   require(path.join(__dirname, '../feishu-auth/token-utils.js'))
 *
 * Credential resolution (cascading fallback):
 *   1. Env vars FEISHU_APP_ID + FEISHU_APP_SECRET  ← injected by EnClaws (process-isolated)
 *   2. config.json in skill directory               ← manual / single-app setup
 *   3. ../../openclaw.json → channels.feishu        ← original OpenClaw compatibility
 *
 * Storage layout (relative to this file's directory, i.e. feishu-auth/):
 *   .tokens/{open_id}/feishu_{appId}.json    ← per-user OAuth tokens
 *   .tokens/{open_id}/pending_auth.json      ← in-flight Device Flow state
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// feishu-auth/ is the single source of truth for credentials and tokens
const AUTH_DIR = __dirname;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Load appId/appSecret with cascading fallback:
 *
 *   1. Environment variables FEISHU_APP_ID + FEISHU_APP_SECRET (process-isolated, injected by EnClaws)
 *   2. config.json in callerDir or AUTH_DIR (manual / single-app setup)
 *   3. openclaw.json in workspace root (original OpenClaw compatibility)
 *
 * @param {string} [callerDir]
 */
function getConfig(callerDir) {
  // 1. Environment variables — highest priority, process-isolated, no concurrency issues
  const envAppId = process.env.FEISHU_APP_ID;
  const envAppSecret = process.env.FEISHU_APP_SECRET;
  if (envAppId && envAppSecret) {
    return { appId: envAppId, appSecret: envAppSecret, brand: process.env.FEISHU_BRAND || 'feishu' };
  }

  // 2. config.json — caller directory first, then AUTH_DIR
  const candidates = [];
  if (callerDir && callerDir !== AUTH_DIR) {
    candidates.push(path.join(callerDir, 'config.json'));
  }
  candidates.push(path.join(AUTH_DIR, 'config.json'));

  for (const cfgPath of candidates) {
    if (fs.existsSync(cfgPath)) {
      let cfg;
      try {
        cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      } catch (e) {
        throw new Error(`Failed to parse ${cfgPath}: ${e.message}`);
      }
      if (cfg.appId && cfg.appSecret) {
        return cfg;
      }
    }
  }

  // 3. openclaw.json — original OpenClaw workspace root
  const openclawCfg = tryLoadOpenClawConfig();
  if (openclawCfg) return openclawCfg;

  throw new Error(
    'appId/appSecret not configured. Checked: env FEISHU_APP_ID/FEISHU_APP_SECRET, ' +
    path.join(AUTH_DIR, 'config.json') +
    ', openclaw.json in workspace root',
  );
}

/**
 * Try to load feishu appId/appSecret from openclaw.json.
 * Searches multiple candidate paths to handle different deployment layouts:
 *   - ~/.openclaw/openclaw.json              (OpenClaw standard location)
 *   - ../../../openclaw.json from AUTH_DIR   (workspace/skills/feishu-auth → .openclaw/)
 *   - ../../openclaw.json from AUTH_DIR      (legacy / alternative layouts)
 * Supports both top-level channels.feishu.{appId,appSecret} and
 * channels.feishu.accounts[*].{appId,appSecret} (picks the first enabled or available account).
 * @returns {{ appId: string, appSecret: string, brand?: string }} | null
 */
function tryLoadOpenClawConfig() {
  const candidates = [
    path.join(os.homedir(), '.openclaw', 'openclaw.json'),
    path.resolve(AUTH_DIR, '..', '..', '..', 'openclaw.json'),
    path.resolve(AUTH_DIR, '..', '..', 'openclaw.json'),
  ];
  const cfgPath = candidates.find(p => fs.existsSync(p));
  if (!cfgPath) return null;

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  } catch {
    return null;
  }

  const feishuCfg = raw?.channels?.feishu;
  if (!feishuCfg) return null;

  // Try top-level appId/appSecret first
  if (feishuCfg.appId && feishuCfg.appSecret) {
    return { appId: feishuCfg.appId, appSecret: feishuCfg.appSecret, brand: 'feishu' };
  }

  // Try named accounts — pick the first one with valid credentials
  const accounts = feishuCfg.accounts;
  if (accounts && typeof accounts === 'object') {
    for (const acc of Object.values(accounts)) {
      if (acc && acc.appId && acc.appSecret && acc.enabled !== false) {
        return { appId: acc.appId, appSecret: acc.appSecret, brand: 'feishu' };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Token file paths
// ---------------------------------------------------------------------------

function getTokenDir(openId) {
  return path.join(AUTH_DIR, '.tokens', openId);
}

function getTokenPath(openId, appId) {
  return path.join(getTokenDir(openId), `feishu_${appId}.json`);
}

function getPendingPath(openId) {
  return path.join(getTokenDir(openId), 'pending_auth.json');
}

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

function readToken(openId, appId) {
  const p = getTokenPath(openId, appId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function saveToken(openId, appId, tokenData) {
  const p = getTokenPath(openId, appId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(tokenData, null, 2), 'utf8');
}

function readPending(openId) {
  const p = getPendingPath(openId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function savePending(openId, data) {
  const p = getPendingPath(openId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

function deletePending(openId) {
  const p = getPendingPath(openId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function deleteToken(openId, appId) {
  const p = getTokenPath(openId, appId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

async function refreshAccessToken(appId, appSecret, refreshToken) {
  const res = await fetch(
    'https://open.feishu.cn/open-apis/authen/v2/oidc/refresh_access_token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:
          'Basic ' + Buffer.from(`${appId}:${appSecret}`).toString('base64'),
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    },
  );
  const rawText = await res.text();
  let data;
  try { data = JSON.parse(rawText); } catch (e) {
    throw new Error(`Token refresh non-JSON (HTTP ${res.status}): ${rawText.slice(0, 300)}`);
  }
  if (data.code !== 0) {
    throw new Error(`Token refresh failed: code=${data.code} msg=${data.msg}`);
  }
  return data.data;
}

// ---------------------------------------------------------------------------
// Get valid access token (auto-refresh)
// ---------------------------------------------------------------------------

/**
 * Try a single device_code → token exchange (non-polling).
 * Returns the parsed JSON response or null on network/parse error.
 */
async function tryDeviceCodeExchange(appId, appSecret, deviceCode) {
  try {
    const body = new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: deviceCode,
      client_id: appId,
      client_secret: appSecret,
    });
    const res = await fetch(
      'https://open.feishu.cn/open-apis/authen/v2/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );
    const text = await res.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Returns a valid access_token, refreshing automatically if needed.
 * Also attempts to complete pending device auth if user has already authorized.
 * Returns null if unauthorized or both tokens expired.
 */
async function getValidToken(openId, appId, appSecret) {
  const token = readToken(openId, appId);
  if (!token) {
    // No saved token — check if there's a pending device auth that user may have completed
    const pending = readPending(openId);
    if (pending && Date.now() < pending.created_at + pending.expires_in * 1000) {
      const json = await tryDeviceCodeExchange(appId, appSecret, pending.device_code);
      if (json && !json.error && json.access_token) {
        const now = Date.now();
        const tokenData = {
          access_token: json.access_token,
          refresh_token: json.refresh_token,
          expires_at: now + (json.expires_in ?? 7200) * 1000,
          refresh_expires_at: now + (json.refresh_token_expires_in ?? 604800) * 1000,
          scope: json.scope,
          granted_at: now,
        };
        saveToken(openId, appId, tokenData);
        deletePending(openId);
        return tokenData.access_token;
      }
    }
    return null;
  }

  const now = Date.now();

  // Access token still valid (5-min buffer)
  if (now < token.expires_at - 5 * 60 * 1000) {
    return token.access_token;
  }

  // Try refresh
  if (token.refresh_token && now < token.refresh_expires_at) {
    try {
      const refreshed = await refreshAccessToken(appId, appSecret, token.refresh_token);
      const updated = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token ?? token.refresh_token,
        expires_at: now + refreshed.expires_in * 1000,
        refresh_expires_at: now + (refreshed.refresh_expires_in ?? 2592000) * 1000,
        scope: refreshed.scope ?? token.scope,
        granted_at: token.granted_at,
        refreshed_at: now,
      };
      saveToken(openId, appId, updated);
      return updated.access_token;
    } catch {
      return null;
    }
  }

  return null;
}

module.exports = {
  getConfig,
  getTokenPath,
  getPendingPath,
  readToken,
  saveToken,
  readPending,
  savePending,
  deletePending,
  deleteToken,
  getValidToken,
};
