#!/bin/sh
# Bake every clip module into the astronaut rig, export, and copy the result into our demo and a repo copy.
#   sh ship.sh [REPO_DIR]      (default REPO_DIR = ~/dev/astravan-anim, a plain copy of the team repo, no git)
# Steps: 1 bake all clips (from the untouched 14 Nov source rig) + measure + sheets + raw/Draco GLB
#        2 the baked rig becomes _work/astronaut_rig.blend (the source for build_view.py and later edits)
#        3 our demo: game3d/characters/astronaut.glb (no Draco, like before: the smoke test loads it without a decoder)
#        4 repo: public/oy/characters + blender/game3d/characters (same file), public/models/astronaut (npm run glb, meshopt),
#          public/oy/demo + blender/game3d/demo (world.js etc.), blender/game3d/characters/anim (these scripts)
# Nothing is committed or pushed.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
CH=$(dirname "$HERE")                      # game3d/characters
G3=$(dirname "$CH")                        # game3d
REPO=${1:-$HOME/dev/astravan-anim}
B=/Applications/Blender.app/Contents/MacOS/Blender
OUT=$CH/_work/anim_final
mkdir -p "$OUT"

echo "== 1 bake"
"$B" -b "$CH/_work/astronaut_rig.SOURCE_14nov.blend" -P "$HERE/bake_all.py" -- --out "$OUT" --sheet --export 2>&1 \
  | grep -E 'ANIM (MEASURE|baked|exported|sheet|saved)|Error|Traceback' | tee "$OUT/bake.log"
grep -q 'Traceback' "$OUT/bake.log" && { echo "bake failed"; exit 1; }

echo "== 2 rig source"
cp "$OUT/astronaut_anim.blend" "$CH/_work/astronaut_rig.blend"

echo "== 3 demo"
cp "$OUT/astronaut_raw.glb" "$CH/astronaut.glb"

if [ -d "$REPO/public" ]; then
  echo "== 4 repo copy $REPO"
  cp "$OUT/astronaut_raw.glb" "$REPO/public/oy/characters/astronaut.glb"
  cp "$OUT/astronaut_raw.glb" "$REPO/blender/game3d/characters/astronaut.glb"
  (cd "$REPO" && npm run glb -- "$OUT/astronaut_raw.glb" public/models/astronaut/astronaut.glb --flatten false 2>&1 | tail -3)
  for f in world.js game.js physics.js demo.js input.js index.html smoke_test.mjs; do
    cp "$G3/demo/$f" "$REPO/public/oy/demo/$f" 2>/dev/null || true
    cp "$G3/demo/$f" "$REPO/blender/game3d/demo/$f"
  done
  rm -f "$REPO/public/oy/demo/smoke_test.mjs"     # the live folder never had the test
  mkdir -p "$REPO/blender/game3d/characters/anim/clips"
  cp "$HERE"/*.py "$HERE"/*.md "$HERE"/*.json "$HERE"/ship.sh "$REPO/blender/game3d/characters/anim/"
  cp "$HERE"/clips/*.py "$REPO/blender/game3d/characters/anim/clips/"
  cp "$OUT/clips.json" "$REPO/blender/game3d/characters/anim/clips_measured.json"
  ls -la "$REPO/public/models/astronaut/astronaut.glb" "$REPO/public/oy/characters/astronaut.glb"
fi
echo "done: $OUT"
