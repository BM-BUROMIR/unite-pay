#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_ROOT="${OXI_COOLIFY_PLUGIN_ROOT:-${CLAUDE_PLUGIN_ROOT:-$HOME/cc/oxi/oxi-skills/plugins/oxi-coolify}}"
COOLIFY_WRAPPER="$PLUGIN_ROOT/scripts/coolify.sh"

_prod_release() {
  local tag="${1:-v$(date +%Y%m%d-%H%M%S)-prod}"
  echo "Creating production release: $tag"
  git -C "$PROJECT_DIR" tag "$tag"
  git -C "$PROJECT_DIR" push origin "$tag"
  echo "Tag $tag pushed. Coolify will deploy via repository automation if configured."
}

if [[ ! -x "$COOLIFY_WRAPPER" ]]; then
  echo "ERROR: canonical Coolify wrapper not found or not executable: $COOLIFY_WRAPPER" >&2
  exit 1
fi

case "${1:-help}" in
  prod-release)
    shift
    _prod_release "$@"
    ;;
  *)
    exec "$COOLIFY_WRAPPER" --project-dir "$PROJECT_DIR" "$@"
    ;;
esac
