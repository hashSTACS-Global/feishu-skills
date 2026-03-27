# feishu-skills installer for OpenClaw / EnClaws (Windows PowerShell)
# Usage:
#   powershell -ExecutionPolicy Bypass -File install.ps1
#   powershell -ExecutionPolicy Bypass -File install.ps1 -Target C:\custom\path\to\skills

param(
  [string]$Target = ""
)

$ErrorActionPreference = "Stop"
$RepoDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$SkillDirs = @(
  "feishu-auth",
  "feishu-create-doc",
  "feishu-fetch-doc",
  "feishu-update-doc",
  "feishu-im-read",
  "feishu-calendar",
  "feishu-task",
  "feishu-bitable"
)

# ---------------------------------------------------------------------------
# Auto-detect target if not specified
# ---------------------------------------------------------------------------
if (-not $Target) {
  $Home = [Environment]::GetFolderPath("UserProfile")

  # EnClaws: find first tenant skills directory
  $EnclawsBase = Join-Path $Home ".enclaws\tenants"
  if (Test-Path $EnclawsBase) {
    $tenants = Get-ChildItem -Path $EnclawsBase -Directory -ErrorAction SilentlyContinue
    if ($tenants) {
      $Target = Join-Path $tenants[0].FullName "skills"
    }
  }

  # OpenClaw fallback
  if (-not $Target) {
    $OpenclawBase = Join-Path $Home ".openclaw"
    if (Test-Path $OpenclawBase) {
      $Target = Join-Path $Home ".openclaw\workspace\skills"
    }
  }

  if (-not $Target) {
    Write-Output '{"success":false,"error":"Could not detect OpenClaw or EnClaws installation. Use -Target to specify the skills directory."}'
    exit 1
  }
}

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
New-Item -ItemType Directory -Force -Path $Target | Out-Null

$Installed = @()
$Updated = @()

foreach ($skill in $SkillDirs) {
  $src = Join-Path $RepoDir $skill
  $dst = Join-Path $Target $skill

  if (-not (Test-Path $src)) { continue }

  if (Test-Path $dst) {
    # Update: copy files, preserve .tokens\
    $items = Get-ChildItem -Path $src -Recurse | Where-Object {
      $_.FullName -notmatch '\\.tokens\\' -and $_.Name -notlike '*.bak'
    }
    foreach ($item in $items) {
      $rel = $item.FullName.Substring($src.Length + 1)
      $dstItem = Join-Path $dst $rel
      if ($item.PSIsContainer) {
        New-Item -ItemType Directory -Force -Path $dstItem | Out-Null
      } else {
        Copy-Item -Path $item.FullName -Destination $dstItem -Force
      }
    }
    $Updated += $skill
  } else {
    Copy-Item -Path $src -Destination $dst -Recurse -Force
    $Installed += $skill
  }
}

# ---------------------------------------------------------------------------
# Output result as JSON (for AI parsing)
# ---------------------------------------------------------------------------
$installedJson = ($Installed | ForEach-Object { "`"$_`"" }) -join ","
$updatedJson   = ($Updated   | ForEach-Object { "`"$_`"" }) -join ","

Write-Output "{`"success`":true,`"target`":`"$($Target -replace '\\','/')`",`"installed`":[$installedJson],`"updated`":[$updatedJson],`"reply`":`"飞书技能安装完成！路径：$Target。`"}"
