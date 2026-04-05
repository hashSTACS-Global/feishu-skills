#!/usr/bin/env node
/**
 * feishu-skills CLI — install skills to OpenClaw or EnClaws.
 *
 * Usage:
 *   npx @enclaws/feishu-skills                    # auto-detect and install
 *   npx @enclaws/feishu-skills --target <path>    # install to custom path
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const installScript = path.join(__dirname, '..', 'install.mjs');

try {
  execFileSync(process.execPath, [installScript, ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
  });
} catch (e) {
  process.exit(e.status || 1);
}
