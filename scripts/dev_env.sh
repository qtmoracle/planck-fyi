#!/usr/bin/env bash
# scripts/dev_env.sh
# Source-safe env loader for Planck v0.01
# - When sourced: does NOT leave your interactive shell in -euo/pipefail mode.
# - When executed: runs with strict mode.

_is_sourced=0
if [ "${BASH_SOURCE[0]}" != "$0" ]; then _is_sourced=1; fi

# If sourced, capture current shell options so we can restore them.
__OLD_SET=""
__OLD_SHOPT=""
if [ "$_is_sourced" -eq 1 ]; then
  __OLD_SET="$(set +o)"
  __OLD_SHOPT="$(shopt -p 2>/dev/null || true)"
fi

# Strict mode only inside this loader’s body
set -euo pipefail

# Planck v0.01 dev defaults (override by exporting before sourcing if needed)
export PLANCK_BASE_URL="${PLANCK_BASE_URL:-http://127.0.0.1:8788}"
export TECH_TOKEN="${TECH_TOKEN:-devtech_0r@c1e}"
export ADMIN_USER="${ADMIN_USER:-admin}"
export ADMIN_PASS="${ADMIN_PASS:-0r@c1e}"

echo "PLANCK_BASE_URL=${PLANCK_BASE_URL}"
echo "TECH_TOKEN=[set]"
echo "ADMIN_USER=${ADMIN_USER}"
echo "ADMIN_PASS=[set]"

# Restore prior shell behavior if we were sourced.
if [ "$_is_sourced" -eq 1 ]; then
  # shellcheck disable=SC1090
  eval "$__OLD_SET"
  eval "$__OLD_SHOPT"
fi
