"""Lander v2 master build (see SPEC.md). Local only.

  B=/Applications/Blender.app/Contents/MacOS/Blender
  $B -b --factory-startup -P build_lander_v2.py -- [--only exterior|interior] [--out PATH] [--render NAME ...]

Imports exterior.py / interior.py from this folder (each defines build(ctx)), saves lander_v2.blend (or --out).
--render NAME: quick Cycles CPU check renders into renders/<NAME>_<view>.png
  views: front34 (concept-image angle), front, left, right, back, porch (ladder close-up), inside (from the hatch),
  panel (main instrument panel close-up). Example: --render ext front34 front left
"""
import bpy, sys, os, math, importlib.util, time
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
A = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def opt(name, default=None):
    return A[A.index(name) + 1] if name in A else default


ONLY = opt('--only')
OUT = opt('--out', os.path.join(HERE, 'lander_v2.blend'))
RENDER = A[A.index('--render') + 1:] if '--render' in A else []
os.makedirs(os.path.join(HERE, 'renders'), exist_ok=True)


def log(*a):
    print('LV2', *a, flush=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 30
sc.unit_settings.system = 'METRIC'


def empty(name, parent=None, loc=(0, 0, 0), size=0.3):
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = size
    o.location = loc
    sc.collection.objects.link(o)
    if parent:
        o.parent = parent
    return o


root = empty('Lander', size=1.0)
base = empty('lander_base', root)
body = empty('lander_body', root)
col_ext = bpy.data.collections.new('LX_exterior')
col_int = bpy.data.collections.new('LI_interior')
sc.collection.children.link(col_ext)
sc.collection.children.link(col_int)

SPEC = {
    'front_y': -1.55, 'deck_z': 2.95, 'porch_z': 2.98, 'floor_z': 3.00, 'ceiling_z': 5.20,
    'hatch': {'x0': -0.45, 'x1': 0.45, 'z0': 3.00, 'z1': 4.40, 'pivot': (-0.45, -1.55, 3.00), 'open_deg': 100.0},
    'rungs': [(0.0, -2.45 - (2.95 - (0.70 + 0.30 * i)) * math.tan(math.radians(28)), 0.70 + 0.30 * i)
              for i in range(8)],
    'ladder_rail_x': 0.24, 'ladder_lean_deg': 28.0,
    'panel': {'C': (0, 1.15, 4.35), 'n': (0, -0.966, 0.259), 'U': (0, 0.259, 0.966)},
    'buttons': {
        'btn_main_1': ((-0.30, 1.0967, 4.2090), (0, 0.966, -0.259)),
        'btn_main_2': ((0.00, 1.0967, 4.2090), (0, 0.966, -0.259)),
        'btn_main_3': ((0.30, 1.0967, 4.2090), (0, 0.966, -0.259)),
        'btn_launch': ((0.00, 1.0372, 3.9869), (0, 0.966, -0.259)),
        'btn_side_L': ((-1.285, 0.20, 4.30), (-1, 0, 0)),
        'btn_side_R': ((1.285, 0.20, 4.30), (1, 0, 0)),
        'btn_hatch_int': ((-0.70, -1.385, 3.95), (0, -1, 0)),
        'btn_hatch_ext': ((-0.72, -1.565, 3.95), (0, 1, 0)),
    },   # name: (face centre, press direction)
    'stand_panel': (0.0, 0.50, 3.00),
}
ctx = dict(root=root, base=base, body=body, col_ext=col_ext, col_int=col_int, spec=SPEC, scene=sc, here=HERE)

for part in ('exterior', 'interior'):
    if ONLY and part != ONLY:
        continue
    f = os.path.join(HERE, part + '.py')
    if not os.path.exists(f):
        log('skip (no file)', part)
        continue
    t0 = time.time()
    spec = importlib.util.spec_from_file_location('lv2_' + part, f)
    m = importlib.util.module_from_spec(spec)
    sys.path.insert(0, HERE)
    spec.loader.exec_module(m)
    m.build(ctx)
    log('built', part, round(time.time() - t0, 1), 's')

# report
tris = 0
for o in bpy.data.objects:
    if o.type == 'MESH':
        dg = bpy.context.evaluated_depsgraph_get()
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
log('objects', len(bpy.data.objects), 'meshes', sum(1 for o in bpy.data.objects if o.type == 'MESH'),
    'triangles', tris, 'actions', sorted(a.name for a in bpy.data.actions))
for n in ['hatch_pivot', 'hatch_door', 'btn_hatch_ext', 'lamp_hatch_ext', 'antenna_big_pivot',
          'antenna_small_pivot', 'arm_base', 'arm_shoulder', 'arm_elbow', 'arm_wrist', 'btn_main_1', 'btn_main_2',
          'btn_main_3', 'btn_launch', 'btn_launch_cover', 'btn_side_L', 'btn_side_R', 'btn_hatch_int']:
    o = bpy.data.objects.get(n)
    log('node', n, 'OK' if o else 'missing', tuple(round(v, 3) for v in o.matrix_world.translation) if o else '')

bpy.ops.wm.save_as_mainfile(filepath=OUT)
log('saved', OUT)

# ------------------------------------------------------------------ quick check renders
VIEWS = {   # name: (camera location, look-at, lens mm)
    'front34': ((-7.5, -12.5, 3.2), (0, 0, 2.9), 40),
    'front': ((0, -14.0, 3.0), (0, 0, 3.0), 40),
    'left': ((-14.0, 0, 3.0), (0, 0, 3.0), 40),
    'right': ((14.0, 0, 3.0), (0, 0, 3.0), 40),
    'back': ((0, 14.0, 3.0), (0, 0, 3.0), 40),
    'porch': ((1.6, -6.0, 2.2), (0, -2.6, 1.9), 35),
    'inside': ((0, -2.2, 4.0), (0, 0.8, 4.1), 18),
    'panel': ((0, -0.1, 4.45), (0, 1.12, 4.2), 28),
}
if RENDER:
    tag = RENDER[0]
    views = RENDER[1:] or ['front34']
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 32
    try:
        sc.cycles.use_denoising = True
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = 960, 540
    if not bpy.data.objects.get('CheckGround'):
        me = bpy.data.meshes.new('CheckGround')
        s = 40
        me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
        g = bpy.data.objects.new('CheckGround', me)
        sc.collection.objects.link(g)
        m = bpy.data.materials.new('CheckGroundMat')
        m.use_nodes = True
        m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.32, 0.31, 0.30, 1)
        m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.95
        me.materials.append(m)
        ld = bpy.data.lights.new('CheckSun', 'SUN')
        ld.energy = 4.0
        ld.angle = math.radians(1.0)
        sun = bpy.data.objects.new('CheckSun', ld)
        sun.rotation_euler = (math.radians(62), 0, math.radians(-55))
        sc.collection.objects.link(sun)
        w = bpy.data.worlds.new('CheckWorld')
        w.use_nodes = True
        w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.02, 0.025, 1)
        w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
        sc.world = w
    cd = bpy.data.cameras.new('CheckCam')
    cam = bpy.data.objects.new('CheckCam', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    for v in views:
        loc, look, lens = VIEWS[v]
        cam.location = loc
        d = Vector(look) - Vector(loc)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        cd.lens = lens
        fp = os.path.join(HERE, 'renders', '%s_%s.png' % (tag, v))
        sc.render.filepath = fp
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        log('render', fp, round(time.time() - t0, 1), 's')
