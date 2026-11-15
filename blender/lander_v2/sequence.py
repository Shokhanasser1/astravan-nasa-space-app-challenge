"""Animated sequence: the astronaut walks to the lander, climbs the ladder, opens the hatch from the porch, enters,
boots the panel and presses the buttons. Local only.

  B=/Applications/Blender.app/Contents/MacOS/Blender
  $B -b --factory-startup -P sequence.py -- [--clips PATH] [--out PATH] [--preview] [--still FRAME ...]

Reads scene_moon.blend (Moon + lander + astronaut) and the baked astronaut clips (default
game3d/characters/_work/agents/lander/astronaut_anim.blend). Everything happens in LANDER SPACE: the astronaut's
root empty `AstroRoot` is parented to `Lander`, so the tilted lander and the climb stay consistent.
Clip metadata (root_start/root_end/press frames) is read from the actions' custom properties (bake_all meta).
--preview: 640x360, 16 samples, every 2nd frame -> renders/seq/####.png (encode with ffmpeg afterwards).
--still F ...: render single frames at 960x540 to renders/seq_still_F.png.
"""
import bpy, sys, os, math
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
A = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def opt(name, default=None):
    return A[A.index(name) + 1] if name in A else default


CLIPS = opt('--clips', os.path.expanduser('~/dev/oy-karvonsaroyi-3d/game3d/characters/_work/agents/lander/astronaut_anim.blend'))
OUT = opt('--out', os.path.join(HERE, 'sequence.blend'))
FPS = 30


def log(*a):
    print('SEQ', *a, flush=True)


bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'scene_moon.blend'))
sc = bpy.context.scene
sc.render.fps = FPS
LANDER = bpy.data.objects['Lander']
RIG = bpy.data.objects['AstronautRig']

# ------------------------------------------------------------------ clips
WANT = ['Idle', 'Walk', 'LadderMount', 'LadderUp', 'LadderUpTop', 'LadderTopOut', 'PressHatchExt', 'EnterHatch',
        'PressPanelC', 'PressPanelL', 'PressPanelR', 'PressLaunch']
with bpy.data.libraries.load(CLIPS, link=False) as (src, dst):
    dst.actions = [n for n in src.actions if n in WANT]
ACT = {}
for a in dst.actions:
    if a is None:
        continue
    base = a.name.split('.')[0]
    if base in WANT:
        ACT[base] = a
        a.use_fake_user = True
log('clips', {k: (int(v.frame_range[1] - v.frame_range[0])) for k, v in ACT.items()})


def meta(name, key, default=None):
    a = ACT.get(name)
    if a is None or key not in a:
        return default
    v = a[key]
    try:
        return [float(x) for x in v]
    except TypeError:
        return v


def length(name):
    a = ACT[name]
    return int(round(a.frame_range[1] - a.frame_range[0]))


# ------------------------------------------------------------------ astronaut root (lander space)
root = bpy.data.objects.new('AstroRoot', None)
root.empty_display_size = 0.3
sc.collection.objects.link(root)
root.parent = LANDER
root.matrix_parent_inverse = Matrix.Identity(4)
root.rotation_euler = (0, 0, math.pi)   # rig faces -Y; the astronaut faces the lander (+Y in lander space)
RIG.parent = root
RIG.matrix_parent_inverse = Matrix.Identity(4)
RIG.location = (0, 0, 0)
RIG.rotation_euler = (0, 0, 0)
if RIG.animation_data:
    RIG.animation_data.action = None
    for t in list(RIG.animation_data.nla_tracks):
        RIG.animation_data.nla_tracks.remove(t)
else:
    RIG.animation_data_create()

# terrain height in lander space (for the walk on the ground)
dg = bpy.context.evaluated_depsgraph_get()
Mw = LANDER.matrix_world
Mi = Mw.inverted()


def ground_z(x, y):
    p = Mw @ Vector((x, y, 3.0))
    hit, loc, *_ = sc.ray_cast(dg, p + Vector((0, 0, 20)), Vector((0, 0, -1)))
    if not hit:
        return 0.0
    # walk down from the top: ignore hits on the lander itself (pads etc.) by casting from just above the ground
    return (Mi @ loc).z


def ground_z_terrain(x, y):
    """ray cast only against the terrain object"""
    g = bpy.data.objects['MoonGround']
    ge = g.evaluated_get(dg)
    p = Mw @ Vector((x, y, 0.0))
    o = g.matrix_world.inverted() @ (p + Vector((0, 0, 30)))
    d = (g.matrix_world.inverted().to_3x3() @ Vector((0, 0, -1))).normalized()
    ok, loc, n, i = ge.ray_cast(o, d)
    if not ok:
        return 0.0
    return (Mi @ (g.matrix_world @ loc)).z


# ------------------------------------------------------------------ timeline
tracks = [RIG.animation_data.nla_tracks.new(), RIG.animation_data.nla_tracks.new()]
tracks[0].name, tracks[1].name = 'astro_A', 'astro_B'
tick = [0]
T = {}            # named frame marks
f = 1             # current frame
root_keys = []    # (frame, loc, interp)


def strip(name, start, repeat=1.0, blend_in=0, scale=1.0):
    act = ACT[name]
    tr = tracks[tick[0] % 2]
    tick[0] += 1
    st = tr.strips.new('%s_%d' % (name, start), int(start), act)
    if hasattr(st, 'action_slot') and len(act.slots):
        st.action_slot = act.slots[0]
    st.repeat = repeat
    st.scale = scale
    st.blend_in = blend_in
    st.extrapolation = 'HOLD_FORWARD'
    st.use_auto_blend = False
    return st, int(round(start + length(name) * repeat * scale))


def key_root(frame, loc, interp='LINEAR'):
    root_keys.append((frame, Vector(loc), interp))


LADDER_LEAN = math.tan(math.radians(28))


def rung(n):
    z = 0.70 + 0.30 * n
    return Vector((0.0, -2.45 - (2.95 - z) * LADDER_LEAN, z))


# 1. walk on the ground toward the ladder
mount_start = Vector(meta('LadderMount', 'root_start_world', None) or (0.0, -4.25, 0.0))
start = Vector((0.0, -9.2, 0.0))
dist = (mount_start.xy - start.xy).length
walk_frames = int(round(dist / 1.0 * FPS))
T['walk'] = f
st, _ = strip('Walk', f, repeat=walk_frames / length('Walk'))
for k in range(0, walk_frames + 1, 6):
    p = start.lerp(mount_start, k / walk_frames)
    w = min(1.0, (p.xy - mount_start.xy).length / 1.5)
    key_root(f + k, (p.x, p.y, w * ground_z_terrain(p.x, p.y)))
f += walk_frames
# settle to idle
T['idle1'] = f
strip('Idle', f - 8, blend_in=10)
log('terrain z at the ladder foot (lander space)', round(ground_z_terrain(mount_start.x, mount_start.y), 3))
key_root(f + 12, (mount_start.x, mount_start.y, 0.0), 'CONSTANT')   # the clips stand on the pads' plane z = 0
f += 12

# 2. mount the ladder (or crossfade straight into the climb if there is no mount clip)
if 'LadderMount' in ACT:
    T['mount'] = f
    _, end = strip('LadderMount', f)
    f = end
    key_root(f, rung(0), 'LINEAR')
else:
    T['mount'] = f
    key_root(f, (mount_start.x, mount_start.y, 0.0))
    f += 20
    key_root(f, rung(0))

# 3. climb: cycles from rung 0 (n = 0, 2, 4), optional top variant, then the top-out
T['climb'] = f
per = Vector(meta('LadderUp', 'root_per_cycle_world', [0.0, 0.319, 0.6]))
n_cycles = 3 if 'LadderUpTop' not in ACT else 2
_, end = strip('LadderUp', f, repeat=n_cycles)
for c in range(n_cycles):
    key_root(f + c * length('LadderUp'), rung(2 * c))
f = end
key_root(f, rung(2 * n_cycles), 'LINEAR' if 'LadderUpTop' in ACT else 'CONSTANT')
if 'LadderUpTop' in ACT:
    _, end = strip('LadderUpTop', f)
    f = end
    key_root(f, rung(6), 'CONSTANT')
T['topout'] = f
_, end = strip('LadderTopOut', f)
f = end
porch = Vector((0.0, -2.05, 2.98))
key_root(f, porch, 'CONSTANT')

# 4. press the exterior hatch button, the door opens
T['press_ext'] = f
pe_root = Vector(meta('PressHatchExt', 'root_world', [0.0, -2.05, 2.98]))
_, end = strip('PressHatchExt', f)
if (pe_root - porch).length > 0.02 and not meta('PressHatchExt', 'root_end'):
    key_root(f, pe_root, 'CONSTANT')          # older clip: stands at its own spot
    key_root(end, porch, 'CONSTANT')
press_ext_at = f + int(meta('PressHatchExt', 'press_frame', 31))
f = end
hatch_at = press_ext_at + 22
strip('Idle', f)
f = max(f + 20, hatch_at + 60 - 30)       # the door is >= 90 % open before EnterHatch's frame 38

# 5. enter through the hatch
T['enter'] = f
_, end = strip('EnterHatch', f)
re = Vector(meta('EnterHatch', 'root_end', [0.0, 1.5, 0.02]))
f = end
inside = porch + re
key_root(f, inside, 'CONSTANT')
panel_boot_at = T['enter'] + 120

# 6. walk to the panel
stand = Vector((0.0, 0.50, 3.00))
strip('Walk', f, repeat=((stand - inside).length * FPS) / length('Walk'), blend_in=10)
wf = int(round((stand - inside).length * FPS))
key_root(f, inside)
f += wf
key_root(f, stand, 'CONSTANT')
strip('Idle', f, blend_in=10)
f += 24

# 7. the panel: centre, left, right, launch
presses = []
for name, btn in (('PressPanelC', 'btn_main_2'), ('PressPanelL', 'btn_main_1'), ('PressPanelR', 'btn_main_3')):
    T[name] = f
    _, end = strip(name, f)
    presses.append((btn, f + int(meta(name, 'press_frame', 31))))
    f = end + 6
T['launch'] = f
_, end = strip('PressLaunch', f)
presses.append(('btn_launch', f + int(meta('PressLaunch', 'press_frame', 52))))
cover_at = f + int(meta('PressLaunch', 'coveropen_frame1_at', 27))
f = end
strip('Idle', f)
f += 75
T['end'] = f
sc.frame_start, sc.frame_end = 1, f

# root keys -> fcurves
root.animation_data_create()
racts = bpy.data.actions.new('AstroRootPath')
root.animation_data.action = racts
for frame, loc, interp in sorted(root_keys, key=lambda k: k[0]):
    root.location = loc
    root.keyframe_insert('location', frame=frame)
try:
    from bpy_extras import anim_utils
    fcs = anim_utils.action_get_channelbag_for_slot(racts, racts.slots[0]).fcurves
except Exception:
    fcs = racts.fcurves
by_frame = {fr: it for fr, _, it in root_keys}
for fc in fcs:
    for kp in fc.keyframe_points:
        kp.interpolation = by_frame.get(int(round(kp.co.x)), 'LINEAR')

# ------------------------------------------------------------------ lander parts
def play_action(name, start):
    """NLA strip of a (possibly multi-slot) action on every ID it has a slot for."""
    act = bpy.data.actions.get(name)
    if act is None:
        log('missing action', name)
        return
    for slot in act.slots:
        idt = slot.target_id_type
        nm = slot.name_display
        owner = None
        if idt == 'OBJECT':
            owner = bpy.data.objects.get(nm)
        elif idt == 'NODETREE':
            m = bpy.data.materials.get(nm)
            owner = m.node_tree if m else bpy.data.node_groups.get(nm)
        elif idt == 'MATERIAL':
            owner = bpy.data.materials.get(nm)
        if owner is None:
            log('no owner for slot', name, idt, nm)
            continue
        ad = owner.animation_data or owner.animation_data_create()
        tr = ad.nla_tracks.new()
        tr.name = name
        st = tr.strips.new('%s_%d' % (name, start), int(start), act)
        st.action_slot = slot
        st.extrapolation = 'HOLD_FORWARD'


play_action('Press_btn_hatch_ext', press_ext_at)
play_action('HatchOpen', hatch_at)
play_action('PanelBoot', panel_boot_at)
for btn, at in presses:
    play_action('Press_' + btn, at)
play_action('CoverOpen', cover_at)
log('marks', T, 'hatch', hatch_at, 'presses', presses, 'cover', cover_at)

# ------------------------------------------------------------------ cameras (lander space) + cuts
def cam(name, loc, look, lens):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start = 0.05
    o = bpy.data.objects.new(name, cd)
    sc.collection.objects.link(o)
    o.parent = LANDER
    o.matrix_parent_inverse = Matrix.Identity(4)
    o.location = loc
    o.rotation_euler = (Vector(look) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o


CAMS = {
    'wide': cam('Cam_wide', (-4.5, -13.5, 1.8), (0.0, -4.0, 2.2), 32),
    'ladder': cam('Cam_ladder', (3.2, -6.4, 1.6), (0.0, -3.1, 1.9), 30),
    'ladder_hi': cam('Cam_ladder_hi', (3.3, -6.0, 3.3), (0.0, -2.55, 3.05), 30),
    'porch': cam('Cam_porch', (2.7, -5.1, 4.35), (-0.2, -1.9, 3.95), 27),
    'inside': cam('Cam_inside', (1.0, -1.15, 4.6), (0.0, 0.9, 4.0), 17),
    'panel': cam('Cam_panel', (1.15, -0.25, 4.95), (0.0, 1.12, 4.15), 24),   # over the right shoulder
}
sc.timeline_markers.clear()
cuts = [(1, 'wide'), (T['mount'] - 10, 'ladder'), (T['climb'] + 72, 'ladder_hi'), (T['topout'] + 60, 'porch'), (T['enter'] + 150, 'inside'),
        (T['PressPanelC'] + 10, 'panel'), (T['PressPanelR'], 'inside'), (T['launch'], 'panel')]
for fr, cn in cuts:
    m = sc.timeline_markers.new(cn, frame=int(fr))
    m.camera = CAMS[cn]
sc.camera = CAMS['wide']

# glare (made for the sun disc in the still) flares on the ladder rails in close shots: mute it here
ng = getattr(sc, 'compositing_node_group', None) or (sc.node_tree if sc.use_nodes else None)
if ng:
    for nd in ng.nodes:
        if nd.bl_idname == 'CompositorNodeGlare':
            nd.mute = True
            log('muted glare', nd.name)
# the interior's far-ground masks were tuned for the step-5 camera; keep the ground cheaper for animation
sc.cycles.dicing_rate = 2.0
sc.cycles.preview_dicing_rate = 4.0
bpy.ops.wm.save_as_mainfile(filepath=OUT)
log('saved', OUT, 'frames', sc.frame_start, sc.frame_end, 'seconds', round(sc.frame_end / FPS, 1))

# ------------------------------------------------------------------ renders
os.makedirs(os.path.join(HERE, 'renders', 'seq'), exist_ok=True)
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
if '--still' in A:
    frames = [int(x) for x in A[A.index('--still') + 1:] if x.lstrip('-').isdigit()]
    sc.render.resolution_x, sc.render.resolution_y = 960, 540
    sc.cycles.samples = 32
    for fr in frames:
        sc.frame_set(fr)
        sc.render.filepath = os.path.join(HERE, 'renders', 'seq_still_%04d.png' % fr)
        bpy.ops.render.render(write_still=True)
        log('still', fr, sc.camera.name, sc.render.filepath)
if '--preview' in A:
    sc.render.resolution_x, sc.render.resolution_y = 640, 360
    sc.cycles.samples = 16
    sc.cycles.dicing_rate = 4.0
    sc.frame_step = 2
    sc.render.filepath = os.path.join(HERE, 'renders', 'seq', '')
    sc.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(animation=True)
    log('preview done')
