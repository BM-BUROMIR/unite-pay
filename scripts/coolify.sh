#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_ROOT="${OXI_COOLIFY_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT:-$HOME/cc/oxi/oxi-skills/plugins/oxi-coolify}}"
COOLIFY_WRAPPER="$PLUGIN_ROOT/scripts/coolify.sh"

if [[ ! -x "$COOLIFY_WRAPPER" ]]; then
  echo "ERROR: canonical Coolify wrapper not found or not executable: $COOLIFY_WRAPPER" >&2
  exit 1
fi

exec "$COOLIFY_WRAPPER" --project-dir "$PROJECT_DIR" "$@"
