"""Contact sheet of clips as the GAME camera sees them: behind the astronaut, a little to the right and above
(Rig.tsx follow camera: 4.6 m back, aimed at the helmet, tilted down), perspective, real suit texture.

  $B -b <OUT>/astronaut_anim.blend -P game_view.py -- --out sheet.png --rows "Insert:0,8,12,20,30,38,44,52,63;Wrist:..."

The Battery prop is shown only between Insert's grab_frame and release_frame (as the game does).
"""
import bpy, sys, os, math
import numpy as np
from mathutils import Vector
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lunar_rig as L

A = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = os.path.abspath(A[A.index('--out') + 1])
ROWS = [(r.split(':')[0], [int(x) for x in r.split(':')[1].split(',')]) for r in A[A.index('--rows') + 1].split(';')]
W, H = (int(v) for v in (A[A.index('--tile') + 1] if '--tile' in A else '300x380').split('x'))

sc = bpy.context.scene
L._floor_and_light()
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 24
try:
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'
cd = bpy.data.cameras.new('GameCam')
cam = bpy.data.objects.new('GameCam', cd)
sc.collection.objects.link(cam)
cd.lens = 75
sc.camera = cam
# character faces -Y: the camera stands behind (+Y), 25 deg round to its right, 4.6 m from the helmet, looking down
target = Vector((0, 0, 1.15))
yaw = math.radians(25)
back = Vector((-math.sin(yaw), math.cos(yaw), 0)) * 4.4
cam.location = target + back + Vector((0, 0, 1.25))
d = target - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

bat = bpy.data.objects.get('Battery')
grab = rel = None
if 'Insert' in bpy.data.actions:
    act = bpy.data.actions['Insert']
    grab, rel = act.get('grab_frame'), act.get('release_frame')

tmp = os.path.join(bpy.app.tempdir or '/tmp', 'game_view')
os.makedirs(tmp, exist_ok=True)
ncol = max(len(fr) for _, fr in ROWS)
big = np.zeros((H * len(ROWS), W * ncol, 4), np.float32)
for ri, (name, frames) in enumerate(ROWS):
    L._set_action(name)
    for ci, f in enumerate(frames):
        if bat:
            bat.hide_render = not (name == 'Insert' and grab is not None and grab <= f <= rel)
        sc.frame_set(f)
        fp = os.path.join(tmp, '%s_%03d.png' % (name, f))
        sc.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(fp)
        px = np.array(im.pixels[:], np.float32).reshape(H, W, 4)
        bpy.data.images.remove(im)
        r0 = (len(ROWS) - 1 - ri) * H
        big[r0:r0 + H, ci * W:(ci + 1) * W] = px
out = bpy.data.images.new('gv', W * ncol, H * len(ROWS), alpha=True)
out.pixels = big.ravel()
out.filepath_raw = OUT
out.file_format = 'PNG'
out.save()
L.log('game view', OUT)
