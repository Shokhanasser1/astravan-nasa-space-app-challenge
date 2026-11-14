#!/bin/zsh
# Renders every yer output with sandbox-safe CPU settings (2 threads).
# usage: zsh render_all.sh [samples]
cd "$(dirname "$0")"
B=/Applications/Blender.app/Contents/MacOS/Blender
R=../../renders/yer
S=${1:-64}
mkdir -p $R/sprites $R/compare
r() { $B -b yer.blend -P render_yer.py -- "$@" 2>&1 | grep -E 'RENDERED|CROPPED|Error' }
# game backgrounds 1920x1080
r scene=Yer_Pad cam=CAM_pad_wide out=$R/yer_bg_launchpad.png w=1920 h=1080 samples=$S
r scene=Yer_Houston cam=CAM_mcc_back out=$R/yer_bg_houston.png w=1920 h=1080 samples=$S
r scene=Yer_DSN cam=CAM_dsn_sunset out=$R/yer_bg_dsn.png w=1920 h=1080 samples=$S
# alternates 1280x720
r scene=Yer_Pad cam=CAM_pad_low out=$R/yer_alt_launchpad_low.png w=1280 h=720 samples=$S
r scene=Yer_Houston cam=CAM_mcc_corner out=$R/yer_alt_houston_corner.png w=1280 h=720 samples=$S
# NASA-photo comparison angles (photo aspect 1280x853)
r scene=Yer_Pad cam=CAM_pad_ref out=$R/compare/yer_cmp_pad.png w=1280 h=853 samples=$S
r scene=Yer_DSN cam=CAM_dsn_ref out=$R/compare/yer_cmp_dsn.png w=1280 h=853 samples=$S
r scene=Yer_Houston cam=CAM_mcc_corner out=$R/compare/yer_cmp_mcc.png w=1280 h=853 samples=$S
# sprites (transparent, cropped)
r scene=Yer_Sprites cam=CAM_spr_sls out=$R/sprites/yer_sls.png w=256 h=512 samples=$S transparent=1 show=SPR_sls,SPR_lights crop=1
r scene=Yer_Sprites cam=CAM_spr_ml out=$R/sprites/yer_mobile_launcher.png w=384 h=512 samples=$S transparent=1 show=SPR_mobile_launcher,SPR_lights crop=1
r scene=Yer_Sprites cam=CAM_spr_orion out=$R/sprites/yer_orion.png w=512 h=512 samples=$S transparent=1 show=SPR_orion,SPR_lights crop=1
r scene=Yer_Sprites cam=CAM_spr_dsn out=$R/sprites/yer_dsn.png w=512 h=512 samples=$S transparent=1 show=SPR_dsn,SPR_lights crop=1
r scene=Yer_Sprites cam=CAM_spr_helmet out=$R/sprites/yer_helmet.png w=512 h=512 samples=$S transparent=1 show=SPR_helmet,SPR_lights crop=1
# web copies (JPG q82) of the backgrounds
$B -b --factory-startup -P tools/to_jpg.py -- 82 $R/yer_bg_*.png $R/yer_alt_*.png 2>&1 | grep -E 'JPG|Error'
zsh tools/compare_sheets.sh
echo ALLDONE
