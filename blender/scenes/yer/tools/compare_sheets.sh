#!/bin/zsh
# Side-by-side "NASA photo | our render" sheets -> docs/ref/yer/cmp_*.jpg (<1 MB each)
cd "$(dirname "$0")/../../.."
B=/Applications/Blender.app/Contents/MacOS/Blender
REF=docs/ref/yer; C=renders/yer/compare
for k in pad dsn mcc; do
  case $k in pad) p=$REF/ref_sls_pad.jpg;; dsn) p=$REF/ref_dsn34.jpg;; mcc) p=$REF/ref_mcc.jpg;; esac
  $B -b --factory-startup -P scenes/yer/tools/sheet.py -- $PWD/$C/sheet_$k.png 540 $PWD/$p $PWD/$C/yer_cmp_$k.png >/dev/null 2>&1
  $B -b --factory-startup -P scenes/yer/tools/to_jpg.py -- 80 $C/sheet_$k.png >/dev/null 2>&1
  mv $C/sheet_$k.jpg $REF/cmp_$k.jpg && rm $C/sheet_$k.png
  ls -la $REF/cmp_$k.jpg
done
