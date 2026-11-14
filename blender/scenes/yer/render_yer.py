# -*- coding: utf-8 -*-
"""Render helper for yer.blend (sandbox-safe CPU settings).
blender -b yer.blend -P render_yer.py -- scene=Yer_Pad cam=CAM_pad_wide out=/path.png
        [w=1280 h=720 samples=48 transparent=0 hide=coll1,coll2 show=coll]
Does NOT save the .blend (the saved file keeps GPU/Metal final settings)."""
import bpy, sys, os
a = dict(x.split('=', 1) for x in sys.argv[sys.argv.index('--') + 1:] if '=' in x)
sc = bpy.data.scenes[a['scene']]
if bpy.context.window:
    bpy.context.window.scene = sc
if 'cam' in a:
    sc.camera = bpy.data.objects[a['cam']]
r = sc.render
r.engine = 'CYCLES'
sc.cycles.device = 'CPU'
r.threads_mode = 'FIXED'
r.threads = int(a.get('threads', 2))
r.resolution_x = int(a.get('w', 1280))
r.resolution_y = int(a.get('h', 720))
r.resolution_percentage = 100
sc.cycles.samples = int(a.get('samples', 48))
sc.cycles.use_denoising = True
sc.cycles.denoiser = 'OPENIMAGEDENOISE'
r.film_transparent = a.get('transparent', '0') == '1'
def lc_walk(lc):
    yield lc
    for c in lc.children:
        yield from lc_walk(c)
vl = sc.view_layers[0]
hide = [h for h in a.get('hide', '').split(',') if h]
show = [h for h in a.get('show', '').split(',') if h]
for lc in lc_walk(vl.layer_collection):
    if lc.name in hide:
        lc.exclude = True
    if show and lc.name != sc.collection.name and lc.parent if False else False:
        pass
if show:
    for lc in vl.layer_collection.children:
        lc.exclude = lc.name not in show
r.filepath = a['out']
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGBA' if r.film_transparent else 'RGB'
bpy.ops.render.render(write_still=True, scene=sc.name)
print('RENDERED', a['out'])
# optional: crop a transparent render to its alpha bbox (+pad) for game sprites
if a.get('crop', '0') == '1':
    import numpy as np
    im = bpy.data.images.load(a['out'])
    w, h = im.size
    px = np.array(im.pixels[:], np.float32).reshape(h, w, 4)
    ys, xs = np.where(px[..., 3] > 0.01)
    pad = 6
    x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad + 1)
    sub = px[y0:y1, x0:x1]
    out = bpy.data.images.new('crop', x1 - x0, y1 - y0, alpha=True)
    out.pixels.foreach_set(np.ascontiguousarray(sub).ravel())
    out.filepath_raw = a['out']
    out.file_format = 'PNG'
    out.save()
    print('CROPPED', x1 - x0, y1 - y0)
