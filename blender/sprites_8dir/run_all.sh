#!/bin/zsh
# Barcha 35 model uchun sprite'larni ketma-ket yaratadi (har model alohida Blender jarayoni).
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
LOG=sprites_8dir/_work/run.log; : > $LOG
for f in source/models/*.glb; do
  id=$(basename $f .glb)
  if [ -n "$1" ] && ! echo " $@ " | grep -q " $id "; then continue; fi
  t0=$(date +%s)
  out=$($B -b --factory-startup -P sprites_8dir/make_sprites.py -- --model $id 2>&1)
  if echo "$out" | grep -q "^DONE $id"; then
    echo "OK $id $(( $(date +%s)-t0 ))s $(echo "$out" | grep '^FIXES' | cut -d' ' -f3-)" >> $LOG
  else
    echo "FAIL $id" >> $LOG; echo "$out" | grep -A8 Traceback >> $LOG
  fi
done
echo ALLDONE >> $LOG
