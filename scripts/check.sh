#!/bin/sh
# Single gate for local work and PR CI (.github/workflows/ci.yml).
#   scripts/check.sh                 every part
#   scripts/check.sh --fast          typecheck, dependency fixtures, unit tests (no bundle export)
#   scripts/check.sh --part check    one CI job
set -eu
cd "$(dirname "$0")/.."

FAST=0
PART=""
while [ $# -gt 0 ]; do
  case "$1" in
    --fast) FAST=1 ;;
    --part)
      [ $# -ge 2 ] || { echo "--part needs a name" >&2; exit 2; }
      PART="$2"
      shift
      ;;
    *) echo "usage: scripts/check.sh [--fast] [--part check]" >&2; exit 2 ;;
  esac
  shift
done
case "$PART" in
  ""|check) ;;
  *) echo "unknown part: $PART (check)" >&2; exit 2 ;;
esac

trap 'rc=$?; [ "$rc" -eq 0 ] || echo "GATE: FAIL"' EXIT

want() { [ -z "$PART" ] || [ "$PART" = "$1" ]; }
run() { echo "==> $*"; "$@"; }

if want check; then
  run npm run verify
  if [ "$FAST" -eq 0 ]; then
    run npm run verify:bundle
  fi
fi

echo "GATE: PASS"
