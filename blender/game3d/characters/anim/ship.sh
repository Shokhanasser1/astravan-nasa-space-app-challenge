#!/bin/sh
# Bake every clip module into the astronaut rig, export it WITH the battery prop and put it into a plain copy of the
# team repo (the game: public/models/astronaut/astronaut.glb). Nothing is committed or pushed.
#   sh ship.sh [REPO_DIR]      (default REPO_DIR = ~/dev/astravan-anim4)
# 1 bake all clips/*.py from the untouched 14 Nov source rig + measure  -> _work/anim_final/
# 2 export the game GLB (rig + body + Battery; export_game.py) and save the baked rig as _work/astronaut_rig.blend
# 3 repo: npm run glb (meshopt) -> public/models/astronaut/astronaut.glb; raw copy -> blender/game3d/characters/;
#   these scripts -> blender/game3d/characters/anim/
# (15 Nov: the old step for the Moon demo, public/oy/, is gone with the demo.)
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
CH=$(dirname "$HERE")                      # game3d/characters
REPO=${1:-$HOME/dev/astravan-anim4}
# the clips that ship in the game (other modules in clips/, e.g. seated.py for the SEV drive, are baked on their own)
MODS=${MODS:-idle_pour.py,jump.py,lope.py,walk_carry.py,gesture_insert.py,gesture_idle.py}
HELPERS=${HELPERS:-_arms.py,_gait.py,_jump_core.py,_insert_core.py,_gest_core.py}
B=/Applications/Blender.app/Contents/MacOS/Blender
OUT=$CH/_work/anim_final
mkdir -p "$OUT"
rm -f "$OUT/clips.json"

echo "== 1 bake"
"$B" -b "$CH/_work/astronaut_rig.SOURCE_14nov.blend" -P "$HERE/bake_all.py" -- --out "$OUT" --modules "$MODS" 2>&1 \
  | grep -E 'ANIM (MEASURE|baked|saved)|Error|Traceback' | tee "$OUT/bake.log"
grep -q 'Traceback' "$OUT/bake.log" && { echo "bake failed"; exit 1; }

echo "== 2 export"
"$B" -b "$OUT/astronaut_anim.blend" -P "$HERE/export_game.py" -- --out "$OUT/astronaut_game_raw.glb" \
  --save-rig "$CH/_work/astronaut_rig.blend" 2>&1 | grep -E 'ANIM|Error|Traceback' | tee "$OUT/export.log"
grep -q 'Traceback' "$OUT/export.log" && { echo "export failed"; exit 1; }
cp "$OUT/astronaut_game_raw.glb" "$CH/astronaut.glb"

if [ -d "$REPO/public/models/astronaut" ]; then
  echo "== 3 repo copy $REPO"
  (cd "$REPO" && npm run glb -- "$OUT/astronaut_game_raw.glb" public/models/astronaut/astronaut.glb --flatten false 2>&1 | tail -2)
  cp "$OUT/astronaut_game_raw.glb" "$REPO/blender/game3d/characters/astronaut.glb"
  mkdir -p "$REPO/blender/game3d/characters/anim/clips"
  cp "$HERE"/*.py "$HERE"/*.md "$HERE"/*.json "$HERE"/ship.sh "$REPO/blender/game3d/characters/anim/"
  for m in $(echo "$MODS,$HELPERS" | tr ',' ' '); do cp "$HERE/clips/$m" "$REPO/blender/game3d/characters/anim/clips/"; done
  cp "$OUT/clips.json" "$REPO/blender/game3d/characters/anim/clips_measured.json"
  ls -la "$REPO/public/models/astronaut/astronaut.glb"
fi
echo "done: $OUT"
