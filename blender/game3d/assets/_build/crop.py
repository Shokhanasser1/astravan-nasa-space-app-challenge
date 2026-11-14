"""Crop (top-left pixel coords) and upscale: Blender -b -P crop.py -- in.png out.png x0 y0 x1 y1 scale"""
import bpy, sys, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
src, out = a[0], a[1]; x0, y0, x1, y1, s = map(int, a[2:7])
im = bpy.data.images.load(src); w, h = im.size
px = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(px); px = px.reshape(h, w, 4)[::-1]
c = px[y0:y1, x0:x1]
c = np.repeat(np.repeat(c, s, 0), s, 1)[::-1]
o = bpy.data.images.new('o', c.shape[1], c.shape[0], alpha=True); o.pixels.foreach_set(np.ascontiguousarray(c).ravel())
o.filepath_raw = out; o.file_format = 'PNG'; o.save()
