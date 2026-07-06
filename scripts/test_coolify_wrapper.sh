#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

test_falls_back_to_legacy_help_without_plugin() {
  local tmp out err
  tmp="$(mktemp -d)"
  out="$tmp/out"
  err="$tmp/err"

  if ! OXI_COOLIFY_PLUGIN_ROOT="$tmp/missing-plugin" "$PROJECT_DIR/scripts/coolify.sh" --help >"$out" 2>"$err"; then
    cat "$err" >&2
    fail "coolify.sh --help should use legacy behavior when plugin wrapper is absent"
  fi

  grep -Eq 'Usage: .*coolify\.sh|Usage: coolify\.sh' "$out" \
    || fail "legacy help output was not printed"
}

test_delegates_standard_command_to_plugin_wrapper() {
  local tmp plugin log expected actual
  tmp="$(mktemp -d)"
  plugin="$tmp/plugin"
  log="$tmp/calls.log"
  mkdir -p "$plugin/scripts"

  cat >"$plugin/scripts/coolify.sh" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" > "$OXI_TEST_COOLIFY_CALL_LOG"
WRAPPER
  chmod +x "$plugin/scripts/coolify.sh"

  OXI_COOLIFY_PLUGIN_ROOT="$plugin" \
    OXI_TEST_COOLIFY_CALL_LOG="$log" \
    "$PROJECT_DIR/scripts/coolify.sh" status

  expected="--project-dir $PROJECT_DIR status"
  actual="$(cat "$log")"
  [[ "$actual" == "$expected" ]] \
    || fail "expected plugin wrapper args '$expected', got '$actual'"
}


test_keeps_unknown_commands_on_legacy_path() {
  local tmp plugin log out
  tmp="$(mktemp -d)"
  plugin="$tmp/plugin"
  log="$tmp/calls.log"
  out="$tmp/out"
  mkdir -p "$plugin/scripts"

  cat >"$plugin/scripts/coolify.sh" <<'WRAPPER'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" > "$OXI_TEST_COOLIFY_CALL_LOG"
WRAPPER
  chmod +x "$plugin/scripts/coolify.sh"

  OXI_COOLIFY_PLUGIN_ROOT="$plugin" \
    OXI_TEST_COOLIFY_CALL_LOG="$log" \
    "$PROJECT_DIR/scripts/coolify.sh" project-local-only >"$out" 2>&1 || true

  [[ ! -f "$log" ]] || fail "unknown/local command should not be delegated to plugin wrapper"
  grep -Eq 'Usage: .*coolify\.sh|Usage: coolify\.sh' "$out" \
    || fail "unknown/local command should fall back to legacy help"
}

test_falls_back_to_legacy_help_without_plugin
test_delegates_standard_command_to_plugin_wrapper
test_keeps_unknown_commands_on_legacy_path
echo "coolify wrapper tests passed"
