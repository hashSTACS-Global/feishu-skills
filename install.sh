#!/usr/bin/env bash
# feishu-skills installer for OpenClaw / EnClaws (macOS / Linux)
# Usage:
#   bash install.sh
#   bash install.sh --target /custom/path/to/skills

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SKILL_DIRS=(
  feishu-auth
  feishu-create-doc
  feishu-fetch-doc
  feishu-update-doc
  feishu-im-read
  feishu-calendar
  feishu-task
  feishu-bitable
)

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
TARGET_DIR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET_DIR="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# ---------------------------------------------------------------------------
# Auto-detect target if not specified
# ---------------------------------------------------------------------------
if [[ -z "$TARGET_DIR" ]]; then
  # EnClaws: find first tenant skills directory
  ENCLAWS_BASE="$HOME/.enclaws/tenants"
  if [[ -d "$ENCLAWS_BASE" ]]; then
    for tenant_dir in "$ENCLAWS_BASE"/*/; do
      if [[ -d "$tenant_dir" ]]; then
        TARGET_DIR="${tenant_dir}skills"
        break
      fi
    done
  fi

  # OpenClaw fallback
  if [[ -z "$TARGET_DIR" ]]; then
    OPENCLAW_SKILLS="$HOME/.openclaw/workspace/skills"
    if [[ -d "$HOME/.openclaw" ]]; then
      TARGET_DIR="$OPENCLAW_SKILLS"
    fi
  fi

  if [[ -z "$TARGET_DIR" ]]; then
    echo '{"success":false,"error":"Could not detect OpenClaw or EnClaws installation. Use --target to specify the skills directory."}'
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
mkdir -p "$TARGET_DIR"

INSTALLED=()
UPDATED=()

for skill in "${SKILL_DIRS[@]}"; do
  src="$REPO_DIR/$skill"
  dst="$TARGET_DIR/$skill"

  if [[ ! -d "$src" ]]; then
    continue
  fi

  if [[ -d "$dst" ]]; then
    # Update: rsync files, preserve .tokens/
    rsync -a --exclude='.tokens/' --exclude='*.bak' "$src/" "$dst/"
    UPDATED+=("$skill")
  else
    # Fresh install
    cp -r "$src" "$dst"
    INSTALLED+=("$skill")
  fi
done

# ---------------------------------------------------------------------------
# Output result as JSON (for AI parsing)
# ---------------------------------------------------------------------------
installed_json=$(printf '"%s",' "${INSTALLED[@]+"${INSTALLED[@]}"}" | sed 's/,$//')
updated_json=$(printf '"%s",' "${UPDATED[@]+"${UPDATED[@]}"}" | sed 's/,$//')

echo "{\"success\":true,\"target\":\"$TARGET_DIR\",\"installed\":[$installed_json],\"updated\":[$updated_json],\"reply\":\"飞书技能安装完成！路径：$TARGET_DIR。请重启 OpenClaw / EnClaws 后生效。\"}"
