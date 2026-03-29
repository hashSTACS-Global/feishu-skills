#!/usr/bin/env node
/**
 * feishu-skills cross-platform installer
 *
 * Usage:
 *   node install.js
 *   node install.js --target /custom/path/to/skills
 *
 * Auto-detects EnClaws or OpenClaw installation and installs skill directories.
 * Always outputs a JSON result so AI agents can parse success/failure and
 * report the correct target path to the user.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const SKILLS = [
  'feishu-auth',
  'feishu-create-doc',
  'feishu-fetch-doc',
  'feishu-update-doc',
  'feishu-im-read',
  'feishu-calendar',
  'feishu-task',
  'feishu-bitable',
  'feishu-docx-download',
  'feishu-image-ocr',
];

// Files/dirs to exclude when copying
const EXCLUDE = ['.tokens', 'node_modules', '.python', '__pycache__', '*.bak', '*.pyc', 'config.json'];

function shouldExclude(name) {
  return EXCLUDE.some(p => {
    if (p.startsWith('*')) return name.endsWith(p.slice(1));
    return name === p;
  });
}

// ---------------------------------------------------------------------------
// Parse --target argument
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const targetIdx = args.indexOf('--target');
let targetDir = targetIdx !== -1 ? args[targetIdx + 1] : null;

// ---------------------------------------------------------------------------
// Auto-detect target directory
// ---------------------------------------------------------------------------
function detectTarget() {
  const home = os.homedir();

  // 1. EnClaws: ~/.enclaws/tenants/<tenant-id>/skills/
  const enclawsBase = path.join(home, '.enclaws', 'tenants');
  if (fs.existsSync(enclawsBase)) {
    const tenants = fs.readdirSync(enclawsBase).filter(f => {
      return fs.statSync(path.join(enclawsBase, f)).isDirectory();
    });
    if (tenants.length > 0) {
      return { dir: path.join(enclawsBase, tenants[0], 'skills'), env: 'EnClaws' };
    }
  }

  // 2. OpenClaw: ~/.openclaw/workspace/skills/
  const openclawBase = path.join(home, '.openclaw');
  if (fs.existsSync(openclawBase)) {
    return { dir: path.join(openclawBase, 'workspace', 'skills'), env: 'OpenClaw' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Recursive copy (skips excluded names, preserves .tokens in existing installs)
// ---------------------------------------------------------------------------
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    if (shouldExclude(entry)) continue;
    const srcPath = path.join(src, entry);
    const dstPath = path.join(dst, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

// Non-skill files to clean up when running in-place
const CLEANUP_FILES = [
  'install.js', 'install.sh', 'install.ps1',
  'README.md', 'README.zh.md', 'SKILL.md', 'LICENSE', '.gitignore', '.git',
];

function removeRecursive(p) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) {
    for (const entry of fs.readdirSync(p)) removeRecursive(path.join(p, entry));
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

// ---------------------------------------------------------------------------
// Detect in-place mode: install.js is already inside a skills directory
// (e.g. AI unzipped the repo directly into skills/feishu-skills/)
// ---------------------------------------------------------------------------
const repoDir = path.dirname(path.resolve(process.argv[1]));
const parentDir = path.dirname(repoDir);
const parentName = path.basename(parentDir).toLowerCase();
const hasSkillDirs = SKILLS.some(s => fs.existsSync(path.join(repoDir, s)));
const isInPlace = hasSkillDirs && (parentName === 'skills');

if (isInPlace && !targetDir) {
  // In-place mode: already inside skills dir, just clean up non-skill files
  const skillsFound = SKILLS.filter(s => fs.existsSync(path.join(repoDir, s)));
  for (const f of CLEANUP_FILES) {
    removeRecursive(path.join(repoDir, f));
  }
  console.log(JSON.stringify({
    success: true,
    env: 'in-place',
    target: repoDir,
    installed: skillsFound,
    updated: [],
    reply: `飞书技能安装完成！路径：${repoDir}。已安装：${skillsFound.join(', ')}。`,
  }));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Normal mode: copy skills to detected target directory
// ---------------------------------------------------------------------------
let detected = null;

if (!targetDir) {
  detected = detectTarget();
  if (!detected) {
    console.log(JSON.stringify({
      success: false,
      error: 'env_not_found',
      message: 'Could not detect OpenClaw or EnClaws installation.',
      hint: 'Use --target to specify the skills directory manually, e.g.: node install.js --target ~/.openclaw/workspace/skills',
    }));
    process.exit(1);
  }
  targetDir = detected.dir;
}

const installed = [];
const updated   = [];
const errors    = [];

for (const skill of SKILLS) {
  const src = path.join(repoDir, skill);
  const dst = path.join(targetDir, skill);

  if (!fs.existsSync(src)) continue;

  try {
    const isUpdate = fs.existsSync(dst);
    copyDir(src, dst);
    (isUpdate ? updated : installed).push(skill);
  } catch (e) {
    errors.push({ skill, error: e.message });
  }
}

if (errors.length > 0) {
  console.log(JSON.stringify({
    success: false,
    error: 'copy_failed',
    target: targetDir,
    env: detected?.env ?? 'custom',
    installed,
    updated,
    errors,
    message: `部分技能安装失败，目标目录：${targetDir}`,
    hint: `请确认当前用户对目标目录有写入权限，然后重新执行：node install.js`,
  }));
  process.exit(1);
}

console.log(JSON.stringify({
  success: true,
  env: detected?.env ?? 'custom',
  target: targetDir,
  installed,
  updated,
  reply: `飞书技能安装完成！环境：${detected?.env ?? 'custom'}，路径：${targetDir}。已安装：${installed.join(', ')}${updated.length ? `；已更新：${updated.join(', ')}` : ''}。`,
}));
