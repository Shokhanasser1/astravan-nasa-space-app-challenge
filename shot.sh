#!/usr/bin/env bash
# Scene screenshots + draw calls/triangles. Builds first unless SHOT_URL points to a running server.
# Usage: ./shot.sh '{"plant":0}' '{"plant":4,"wall":2}'
set -euo pipefail
cd "$(dirname "$0")"
[ -z "${SHOT_URL:-}" ] && npm run build --silent >/dev/null
node scripts/shot.mjs "$@"
