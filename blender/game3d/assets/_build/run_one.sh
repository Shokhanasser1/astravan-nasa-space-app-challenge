#!/bin/bash
# build + verify one model; logs in _work/log_<id>.txt
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
m="$1"; mkdir -p _work
$B -b --factory-startup -P _build/build_asset.py -- --model "$m" > "_work/log_$m.txt" 2>&1
if grep -q "^DONE $m" "_work/log_$m.txt"; then
  $B -b --factory-startup -P _build/verify_asset.py -- --model "$m" > "_work/vlog_$m.txt" 2>&1
  grep -q "^VDONE" "_work/vlog_$m.txt" && echo "OK $m" || echo "VERIFY-FAIL $m"
else
  echo "BUILD-FAIL $m"
fi
