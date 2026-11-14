#!/bin/bash
# Final GPU (Metal) renders of all station backgrounds. Run in your own Terminal (not inside Claude's sandbox).
#   bash ~/dev/oy-karvonsaroyi-3d/tools/render_final_gpu.sh            -> yer xks koinot oy mars
#   bash ~/dev/oy-karvonsaroyi-3d/tools/render_final_gpu.sh yer xks    -> only these
# Env: SAMPLES=256 (default), RES=100 (percent)
ROOT="$HOME/dev/oy-karvonsaroyi-3d"
BLENDER=/Applications/Blender.app/Contents/MacOS/Blender
STATIONS=("$@"); [ ${#STATIONS[@]} -eq 0 ] && STATIONS=(yer xks koinot oy mars)
SAMPLES=${SAMPLES:-256}; RES=${RES:-100}
LOG="$ROOT/logs/render_final_gpu.log"
echo "== $(date '+%F %T') start: ${STATIONS[*]} (${SAMPLES} spp, ${RES}%)" | tee -a "$LOG"
for st in "${STATIONS[@]}"; do
  f="$ROOT/scenes/$st/$st.blend"
  [ -f "$f" ] || { echo "no $f - skip" | tee -a "$LOG"; continue; }
  caffeinate -i "$BLENDER" -b "$f" -P "$ROOT/tools/render_final_gpu.py" -- "$ROOT/renders/final_gpu/$st" "$SAMPLES" "$RES" 2>&1 \
    | grep --line-buffered -E 'GPU_DEVICES|WARNING|RENDER|DONE|skip|Error|error' | tee -a "$LOG"
done
echo "== $(date '+%F %T') finished. Pictures: $ROOT/renders/final_gpu/" | tee -a "$LOG"
