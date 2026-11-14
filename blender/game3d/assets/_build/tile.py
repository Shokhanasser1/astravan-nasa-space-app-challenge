"""Tile several PNGs into one image (for quick looks).  Blender -b -P tile.py -- out.png cols size a.png b.png ..."""
import bpy, sys, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
out, cols, S = a[0], int(a[1]), int(a[2]); files = a[3:]
rows = (len(files) + cols - 1) // cols
sheet = np.zeros((rows * S, cols * S, 4), np.float32); sheet[..., 3] = 1
for i, f in enumerate(files):
    im = bpy.data.images.load(f); 
    if im.size[0] != S or im.size[1] != S:
        im.scale(S, S)
    px = np.empty(S * S * 4, np.float32); im.pixels.foreach_get(px); px = px.reshape(S, S, 4)
    r, c = divmod(i, cols); y0 = (rows - 1 - r) * S
    sheet[y0:y0 + S, c * S:(c + 1) * S] = px
o = bpy.data.images.new('o', cols * S, rows * S, alpha=True); o.pixels.foreach_set(sheet.ravel())
o.filepath_raw = out; o.file_format = 'PNG'; o.save()
