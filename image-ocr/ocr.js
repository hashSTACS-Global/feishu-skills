'use strict';
/**
 * Self-bootstrapping OCR entry point.
 *
 * Usage:
 *   node ./ocr.js <image_path> [--json] [--lang ch]
 *
 * Bootstrap chain:
 *   1. Detect Python 3.8+ (python3 / python / local install)
 *   2. If missing → auto-install Python:
 *      Windows: winget → choco → direct download installer
 *      Linux:   apt-get → yum → dnf → apk → standalone binary
 *      macOS:   brew → standalone binary
 *   3. Forward all args to ocr.py
 *   4. ocr.py handles pip dependencies (paddleocr etc.) internally
 */

const { execSync, spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const os = require('os');

const SCRIPT_DIR = __dirname;
const OCR_PY = path.join(SCRIPT_DIR, 'ocr.py');

// Minimum Python version
const MIN_MAJOR = 3;
const MIN_MINOR = 8;

// Where we install a local Python if system-wide install fails
const LOCAL_PYTHON_DIR = path.join(SCRIPT_DIR, '.python');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  process.stderr.write(`[ocr] ${msg}\n`);
}

function fail(obj) {
  console.log(JSON.stringify(obj));
  process.exit(1);
}

/** Run a command silently and return true if it succeeds */
function tryExec(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 300000, ...opts });
    return true;
  } catch {
    return false;
  }
}

/** Run a command and return stdout trimmed, or null on failure */
function tryExecOutput(cmd) {
  try {
    return execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 }).toString().trim();
  } catch {
    return null;
  }
}

/** Check if a command exists */
function commandExists(name) {
  const cmd = process.platform === 'win32' ? `where ${name} 2>nul` : `command -v ${name} 2>/dev/null`;
  return tryExecOutput(cmd) !== null;
}

/** Download a URL to a local file path. Follows redirects. */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const get = url.startsWith('https') ? https.get : http.get;

    const request = (reqUrl, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      get(reqUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return request(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        }
        const total = parseInt(res.headers['content-length'] || '0', 10);
        let downloaded = 0;
        let lastLog = 0;
        res.on('data', (chunk) => {
          downloaded += chunk.length;
          const now = Date.now();
          if (total && now - lastLog > 3000) {
            const pct = Math.round(downloaded / total * 100);
            log(`Downloading... ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)}MB)`);
            lastLog = now;
          }
        });
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(destPath); });
        file.on('error', reject);
      }).on('error', reject);
    };

    request(url);
  });
}

// ---------------------------------------------------------------------------
// Python detection
// ---------------------------------------------------------------------------

/**
 * Parse Python version from `python --version` output.
 * Returns [major, minor] or null.
 */
function parsePythonVersion(output) {
  const m = output && output.match(/Python\s+(\d+)\.(\d+)/);
  return m ? [parseInt(m[1]), parseInt(m[2])] : null;
}

/** Check if a python path meets minimum version */
function isPythonOk(pythonPath) {
  const out = tryExecOutput(`"${pythonPath}" --version`);
  const ver = parsePythonVersion(out);
  return ver && (ver[0] > MIN_MAJOR || (ver[0] === MIN_MAJOR && ver[1] >= MIN_MINOR));
}

/** Find a usable Python 3.8+ */
function findPython() {
  // 1. Check local install first
  const localBin = process.platform === 'win32'
    ? path.join(LOCAL_PYTHON_DIR, 'python.exe')
    : path.join(LOCAL_PYTHON_DIR, 'bin', 'python3');
  if (fs.existsSync(localBin) && isPythonOk(localBin)) return localBin;

  // 2. Check system python
  const candidates = process.platform === 'win32'
    ? ['python', 'python3', 'py -3']
    : ['python3', 'python'];

  for (const cmd of candidates) {
    const resolved = tryExecOutput(
      process.platform === 'win32' ? `where ${cmd.split(' ')[0]} 2>nul` : `command -v ${cmd} 2>/dev/null`
    );
    if (resolved) {
      const bin = resolved.split('\n')[0].trim();
      if (isPythonOk(bin)) return bin;
      // For "py -3" on Windows, test the compound command
      if (cmd.includes(' ')) {
        const out = tryExecOutput(`${cmd} --version`);
        const ver = parsePythonVersion(out);
        if (ver && (ver[0] > MIN_MAJOR || (ver[0] === MIN_MAJOR && ver[1] >= MIN_MINOR))) {
          return cmd;
        }
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Python installation — Windows
// ---------------------------------------------------------------------------

async function installPythonWindows() {
  // Strategy 1: winget
  if (commandExists('winget')) {
    log('Installing Python via winget...');
    if (tryExec('winget install Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements', { timeout: 600000 })) {
      // winget installs to AppData, refresh PATH
      refreshWindowsPath();
      const py = findPython();
      if (py) return py;
    }
    log('winget install failed, trying next method...');
  }

  // Strategy 2: choco
  if (commandExists('choco')) {
    log('Installing Python via choco...');
    if (tryExec('choco install python3 -y --no-progress', { timeout: 600000 })) {
      refreshWindowsPath();
      const py = findPython();
      if (py) return py;
    }
    log('choco install failed, trying next method...');
  }

  // Strategy 3: Direct download from python.org
  log('Downloading Python installer from python.org...');
  const installerUrl = 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-amd64.exe';
  const tmpDir = os.tmpdir();
  const installerPath = path.join(tmpDir, 'python-installer.exe');

  try {
    await downloadFile(installerUrl, installerPath);
    log('Running Python installer (silent)...');
    // Install to local dir, no admin required
    const installDir = LOCAL_PYTHON_DIR;
    fs.mkdirSync(installDir, { recursive: true });
    execSync(
      `"${installerPath}" /quiet InstallAllUsers=0 TargetDir="${installDir}" PrependPath=0 Include_launcher=0 Include_pip=1`,
      { stdio: 'pipe', timeout: 600000 },
    );
    // Clean up installer
    try { fs.unlinkSync(installerPath); } catch {}

    const pyExe = path.join(installDir, 'python.exe');
    if (fs.existsSync(pyExe) && isPythonOk(pyExe)) {
      log(`Python installed to ${installDir}`);
      return pyExe;
    }
  } catch (e) {
    log(`Installer failed: ${e.message}`);
    try { fs.unlinkSync(installerPath); } catch {}
  }

  // Strategy 4: Embeddable package (fallback, needs extra pip setup)
  return await installPythonEmbeddable();
}

/** Install Python embeddable package (Windows, no admin, no installer) */
async function installPythonEmbeddable() {
  log('Downloading Python embeddable package...');
  const zipUrl = 'https://www.python.org/ftp/python/3.12.8/python-3.12.8-embed-amd64.zip';
  const tmpZip = path.join(os.tmpdir(), 'python-embed.zip');
  const installDir = LOCAL_PYTHON_DIR;

  try {
    await downloadFile(zipUrl, tmpZip);
    fs.mkdirSync(installDir, { recursive: true });

    // Extract using PowerShell (available on all modern Windows)
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Force -Path '${tmpZip}' -DestinationPath '${installDir}'"`,
      { stdio: 'pipe', timeout: 120000 },
    );
    try { fs.unlinkSync(tmpZip); } catch {}

    const pyExe = path.join(installDir, 'python.exe');
    if (!fs.existsSync(pyExe)) throw new Error('python.exe not found after extraction');

    // Enable pip: modify python312._pth to uncomment import site
    const pthFiles = fs.readdirSync(installDir).filter(f => f.endsWith('._pth'));
    for (const pth of pthFiles) {
      const pthPath = path.join(installDir, pth);
      let content = fs.readFileSync(pthPath, 'utf-8');
      content = content.replace(/^#\s*import site/m, 'import site');
      // Add Lib/site-packages
      if (!content.includes('Lib\\site-packages')) {
        content += '\nLib\\site-packages\n';
      }
      fs.writeFileSync(pthPath, content);
    }

    // Install pip via get-pip.py
    const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py';
    const getPipPath = path.join(installDir, 'get-pip.py');
    await downloadFile(getPipUrl, getPipPath);
    execSync(`"${pyExe}" "${getPipPath}"`, { stdio: 'pipe', timeout: 120000 });
    try { fs.unlinkSync(getPipPath); } catch {}

    if (isPythonOk(pyExe)) {
      log(`Python embeddable installed to ${installDir}`);
      return pyExe;
    }
  } catch (e) {
    log(`Embeddable install failed: ${e.message}`);
    try { fs.unlinkSync(tmpZip); } catch {}
  }
  return null;
}

/** Refresh PATH on Windows to pick up newly installed Python */
function refreshWindowsPath() {
  try {
    // Read fresh PATH from registry
    const userPath = tryExecOutput('reg query "HKCU\\Environment" /v Path') || '';
    const sysPath = tryExecOutput('reg query "HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment" /v Path') || '';
    const extract = (s) => {
      const m = s.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.*)/i);
      return m ? m[1].trim() : '';
    };
    const freshPath = extract(userPath) + ';' + extract(sysPath);
    if (freshPath.length > 10) process.env.PATH = freshPath;
  } catch {}
}

// ---------------------------------------------------------------------------
// Python installation — Linux / macOS
// ---------------------------------------------------------------------------

async function installPythonLinux() {
  const isRoot = process.getuid && process.getuid() === 0;
  const sudo = isRoot ? '' : 'sudo ';

  // Strategy 1: apt-get (Debian/Ubuntu)
  if (commandExists('apt-get')) {
    log('Installing Python via apt-get...');
    if (tryExec(`${sudo}apt-get update -qq && ${sudo}apt-get install -y -qq python3 python3-pip python3-venv`, { timeout: 600000 })) {
      const py = findPython();
      if (py) return py;
    }
  }

  // Strategy 2: yum (RHEL/CentOS)
  if (commandExists('yum')) {
    log('Installing Python via yum...');
    if (tryExec(`${sudo}yum install -y python3 python3-pip`, { timeout: 600000 })) {
      const py = findPython();
      if (py) return py;
    }
  }

  // Strategy 3: dnf (Fedora)
  if (commandExists('dnf')) {
    log('Installing Python via dnf...');
    if (tryExec(`${sudo}dnf install -y python3 python3-pip`, { timeout: 600000 })) {
      const py = findPython();
      if (py) return py;
    }
  }

  // Strategy 4: apk (Alpine)
  if (commandExists('apk')) {
    log('Installing Python via apk...');
    if (tryExec(`${sudo}apk add --no-cache python3 py3-pip`, { timeout: 600000 })) {
      const py = findPython();
      if (py) return py;
    }
  }

  // Strategy 5: brew (macOS)
  if (commandExists('brew')) {
    log('Installing Python via brew...');
    if (tryExec('brew install python@3.12', { timeout: 600000 })) {
      const py = findPython();
      if (py) return py;
    }
  }

  // Strategy 6: Standalone binary (python-build-standalone)
  return await installPythonStandalone();
}

/** Download prebuilt standalone Python (works on any Linux/macOS without root) */
async function installPythonStandalone() {
  log('Downloading standalone Python binary...');

  const platform = os.platform();
  const arch = os.arch();

  // Map to python-build-standalone release names
  let triple;
  if (platform === 'linux' && arch === 'x64') {
    triple = 'x86_64-unknown-linux-gnu';
  } else if (platform === 'linux' && arch === 'arm64') {
    triple = 'aarch64-unknown-linux-gnu';
  } else if (platform === 'darwin' && arch === 'x64') {
    triple = 'x86_64-apple-darwin';
  } else if (platform === 'darwin' && arch === 'arm64') {
    triple = 'aarch64-apple-darwin';
  } else {
    log(`No standalone binary for ${platform}/${arch}`);
    return null;
  }

  const ver = '3.12.8';
  const tag = '20241219';
  const fileName = `cpython-${ver}+${tag}-${triple}-install_only_stripped.tar.gz`;
  const url = `https://github.com/indygreg/python-build-standalone/releases/download/${tag}/${fileName}`;

  const tmpFile = path.join(os.tmpdir(), fileName);
  const installDir = LOCAL_PYTHON_DIR;

  try {
    await downloadFile(url, tmpFile);
    fs.mkdirSync(installDir, { recursive: true });

    log('Extracting Python...');
    execSync(`tar -xzf "${tmpFile}" -C "${installDir}" --strip-components=1`, {
      stdio: 'pipe',
      timeout: 120000,
    });
    try { fs.unlinkSync(tmpFile); } catch {}

    const pyExe = path.join(installDir, 'bin', 'python3');
    if (fs.existsSync(pyExe) && isPythonOk(pyExe)) {
      log(`Standalone Python installed to ${installDir}`);
      return pyExe;
    }
  } catch (e) {
    log(`Standalone install failed: ${e.message}`);
    try { fs.unlinkSync(tmpFile); } catch {}
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const userArgs = process.argv.slice(2);

  // Step 1: Find or install Python
  let pythonBin = findPython();

  if (!pythonBin) {
    log('Python 3.8+ not found. Installing automatically...');

    if (process.platform === 'win32') {
      pythonBin = await installPythonWindows();
    } else {
      pythonBin = await installPythonLinux();
    }

    if (!pythonBin) {
      fail({
        error: 'python_not_found',
        message: 'Failed to install Python automatically. Please install Python 3.8+ manually.',
      });
    }
    log(`Python ready: ${pythonBin}`);
  }

  // Step 2: Forward to ocr.py
  const isCompound = pythonBin.includes(' '); // e.g. "py -3"
  let child;

  if (isCompound) {
    const parts = pythonBin.split(/\s+/);
    child = spawn(parts[0], [...parts.slice(1), OCR_PY, ...userArgs], {
      stdio: ['inherit', 'inherit', 'inherit'],
      cwd: SCRIPT_DIR,
    });
  } else {
    child = spawn(pythonBin, [OCR_PY, ...userArgs], {
      stdio: ['inherit', 'inherit', 'inherit'],
      cwd: SCRIPT_DIR,
    });
  }

  child.on('close', (code) => {
    process.exit(code || 0);
  });

  child.on('error', (err) => {
    fail({ error: 'spawn_error', message: `Failed to run Python: ${err.message}` });
  });
}

main().catch((e) => {
  fail({ error: 'unexpected_error', message: e.message });
});
