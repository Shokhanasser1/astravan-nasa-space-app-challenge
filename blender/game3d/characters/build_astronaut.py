"""Oy karvonsaroyi — 3D o'yin uchun skeletli va animatsiyali astronavt.

Ishlatish (headless):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
      -P game3d/characters/build_astronaut.py
  Tekshiruv (yangi Blender'da qayta import + poza renderlari):
      ... -P game3d/characters/verify_astronaut.py -- --renders

Natija:
  game3d/characters/astronaut.glb   (skinned mesh + 23 bone + 6 klip: Idle Walk Run Jump Carry Pour)

Manba: source/models/astronaut.glb (NASA 3D Resources). Teksturadagi AQSh bayroqlari,
NASA belgisi va patch bo'yab yopiladi (to'rtburchaklar sprites_8dir/make_sprites.py dan).
Koordinatalar Blender'da: Z yuqoriga, personaj -Y ga qaraydi (= glTF +Z), chap qo'l +X da.
"""
import bpy, bmesh, sys, os, math
import numpy as np
from mathutils import Vector, Matrix, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(ROOT, 'source', 'models', 'astronaut.glb')
OUT = os.path.join(HERE, 'astronaut.glb')
WORK = os.path.join(HERE, '_work')
os.makedirs(WORK, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

FPS = 30
HEIGHT = 1.85          # m, helmet top to boot sole (EMU fits 1.57-1.88 m people)


def log(*a):
    print('[astronaut]', *a, flush=True)


# --------------------------------------------------------------------------- 1. import
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
bpy.ops.import_scene.gltf(filepath=SRC)
mesh = next(o for o in bpy.data.objects if o.type == 'MESH')
for o in list(bpy.data.objects):
    if o is not mesh:
        pass
mw = mesh.matrix_world.copy()
mesh.parent = None
mesh.matrix_world = mw
for o in list(bpy.data.objects):
    if o is not mesh:
        bpy.data.objects.remove(o)
mesh.name = 'Astronaut'
mesh.data.name = 'Astronaut'
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# scale to 1.85 m, origin between the feet (bbox centre in x/y, soles at z=0)
co = np.empty(len(mesh.data.vertices) * 3, np.float32)
mesh.data.vertices.foreach_get('co', co)
co = co.reshape(-1, 3)
mn, mx = co.min(0), co.max(0)
s = HEIGHT / (mx[2] - mn[2])
off = np.array([(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]])
co = (co - off) * s
mesh.data.vertices.foreach_set('co', co.ravel())
mesh.data.update()
log('scale factor', round(float(s), 5), 'size m', np.round((mx - mn) * s, 3))

# weld the fully split triangle soup so the skin is one surface (UV seams stay per-loop)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0001, use_sharp_edge_from_normals=True)
bpy.ops.object.mode_set(mode='OBJECT')
try:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
except Exception as e:
    log('no custom normals', e)
bpy.ops.object.shade_smooth(keep_sharp_edges=True)
me = mesh.data
me.calc_loop_triangles()
log('verts', len(me.vertices), 'tris', len(me.loop_triangles))

# --------------------------------------------------------------------------- 2. texture clean
# Rects (x0, y0, x1, y1), top-left origin, from sprites_8dir/make_sprites.py FIXES['astronaut']:
#   US flag on the PLSS, NASA "meatball" on the PLSS, crew patch on the chest band, US flag on the arm.
# Each rect is filled by cloning plain fabric from a nearby logo-free source (dx, dy), feathered.
LOGO_RECTS = [((878, 22, 960, 85), (0, 92)),
              ((890, 182, 955, 238), (0, -85)),
              ((792, 382, 865, 443), (-95, 0)),
              ((800, 712, 858, 763), (-95, 0))]


def img_get(im):
    w, h = im.size
    a = np.empty(w * h * 4, np.float32)
    im.pixels.foreach_get(a)
    return a.reshape(h, w, 4)


def clean_suit_texture(im):
    base = img_get(im)
    t = base[::-1]                       # top-left origin view (same as an image viewer)
    h, w, _ = t.shape
    pad, feather = 5, 4
    for (x0, y0, x1, y1), (dx, dy) in LOGO_RECTS:
        x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)
        src = t[y0 + dy:y1 + dy, x0 + dx:x1 + dx, :3].copy()
        # match the mean brightness of the destination border
        ring = np.concatenate([t[max(0, y0 - 3):y0, x0:x1, :3].reshape(-1, 3),
                               t[y1:y1 + 3, x0:x1, :3].reshape(-1, 3),
                               t[y0:y1, max(0, x0 - 3):x0, :3].reshape(-1, 3),
                               t[y0:y1, x1:x1 + 3, :3].reshape(-1, 3)])
        src += (np.median(ring, 0) - np.median(src.reshape(-1, 3), 0))
        hh, ww = y1 - y0, x1 - x0
        yy = np.minimum(np.arange(hh), np.arange(hh)[::-1])[:, None]
        xx = np.minimum(np.arange(ww), np.arange(ww)[::-1])[None, :]
        alpha = np.clip(np.minimum(yy, xx) / feather, 0, 1)[..., None]
        # inner logo area must be fully replaced: alpha=1 inside the original rect
        alpha[pad:hh - pad, pad:ww - pad] = 1.0
        t[y0:y1, x0:x1, :3] = alpha * src + (1 - alpha) * t[y0:y1, x0:x1, :3]
    im.pixels.foreach_set(base.ravel())
    im.update()
    path = os.path.join(WORK, 'astronaut_suit_clean.png')
    im.filepath_raw = path
    im.file_format = 'PNG'
    im.save()
    log('texture cleaned ->', path)
    # IMPORTANT: the imported image is *packed*, and the glTF exporter re-uses packed original
    # bytes when it can -> the logos came back in the 15:44 export. Use a fresh, unpacked image
    # loaded from the cleaned PNG instead, so the exporter has to encode the cleaned pixels.
    clean = bpy.data.images.load(path, check_existing=False)
    clean.name = 'astronaut_suit_clean'
    return clean


suit_img = bpy.data.images.get('astnt1_1')
visor_img = bpy.data.images.get('astnt1_2')
suit_img = clean_suit_texture(suit_img)
visor_img.name = 'astronaut_visor'


def simple_material(name, img, rough, metal):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    tx = nt.nodes.new('ShaderNodeTexImage')
    tx.image = img
    nt.links.new(tx.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    nt.links.new(b.outputs['BSDF'], out.inputs['Surface'])
    return m


mat_suit = simple_material('AstronautSuit', suit_img, 0.85, 0.0)
mat_visor = simple_material('AstronautVisor', visor_img, 0.25, 0.6)
old = [m.name for m in me.materials]
for i, n in enumerate(old):
    me.materials[i] = mat_visor if n == 'astnt1_2' else mat_suit
for m in list(bpy.data.materials):
    if m.users == 0:
        bpy.data.materials.remove(m)

# --------------------------------------------------------------------------- 3. armature
# joint positions measured from the mesh (front/side ortho renders with a 10 cm grid + slices)
J = {
    'Hips': ((0, -0.03, 0.84), (0, -0.03, 0.97), None),
    'Spine': ((0, -0.03, 0.97), (0, -0.03, 1.10), 'Hips'),
    'Spine1': ((0, -0.03, 1.10), (0, -0.035, 1.24), 'Spine'),
    'Spine2': ((0, -0.035, 1.24), (0, -0.05, 1.42), 'Spine1'),
    'Neck': ((0, -0.05, 1.42), (0, -0.07, 1.55), 'Spine2'),
    'Head': ((0, -0.07, 1.55), (0, -0.07, 1.80), 'Neck'),
    'LeftShoulder': ((0.05, -0.05, 1.38), (0.23, -0.06, 1.39), 'Spine2'),
    'LeftArm': ((0.23, -0.06, 1.39), (0.565, -0.09, 1.35), 'LeftShoulder'),
    'LeftForeArm': ((0.565, -0.09, 1.35), (0.765, -0.11, 1.31), 'LeftArm'),
    'LeftHand': ((0.765, -0.11, 1.31), (0.86, -0.12, 1.265), 'LeftForeArm'),
    'LeftUpLeg': ((0.165, -0.05, 0.79), (0.17, -0.06, 0.45), 'Hips'),
    'LeftLeg': ((0.17, -0.06, 0.45), (0.21, -0.03, 0.11), 'LeftUpLeg'),
    'LeftFoot': ((0.21, -0.03, 0.11), (0.22, -0.22, 0.035), 'LeftLeg'),
    'LeftToeBase': ((0.22, -0.22, 0.035), (0.225, -0.31, 0.035), 'LeftFoot'),
}
for n in list(J):
    if n.startswith('Left'):
        h, t, p = J[n]
        J['Right' + n[4:]] = ((-h[0], h[1], h[2]), (-t[0], t[1], t[2]),
                              ('Right' + p[4:]) if p.startswith('Left') else p)
ORDER = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
         'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
         'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
         'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
         'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']

arm_data = bpy.data.armatures.new('AstronautRig')
rig = bpy.data.objects.new('AstronautRig', arm_data)
sc.collection.objects.link(rig)
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
eb = arm_data.edit_bones
for n in ORDER:
    h, t, p = J[n]
    b = eb.new(n)
    b.head, b.tail = Vector(h), Vector(t)
    if p:
        b.parent = eb[p]
        b.use_connect = (Vector(J[p][1]) - Vector(h)).length < 1e-6
    # consistent roll: bone Z axis points to the character's front (-Y) or up for horizontal bones
    d = (b.tail - b.head).normalized()
    ref = Vector((0, -1, 0)) if abs(d.y) < 0.8 else Vector((0, 0, 1))
    b.align_roll(ref)
# BagSocket: non-deforming helper bone, the carried bag's centre (placed after the carry pose is solved)
bs = eb.new('BagSocket')
bs.head, bs.tail = Vector((0, -0.41, 1.06)), Vector((0, -0.41, 1.16))
bs.parent = eb['Spine2']
bs.use_deform = False
bs.roll = 0.0
bpy.ops.object.mode_set(mode='OBJECT')

# --------------------------------------------------------------------------- 4. skin weights
bpy.ops.object.select_all(action='DESELECT')
mesh.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
vg_names = [g.name for g in mesh.vertex_groups]
log('vertex groups', len(vg_names))

nv = len(me.vertices)
W = np.zeros((nv, len(ORDER)), np.float32)
gi = {g.index: ORDER.index(g.name) for g in mesh.vertex_groups if g.name in ORDER}
for v in me.vertices:
    for g in v.groups:
        if g.group in gi:
            W[v.index, gi[g.group]] = g.weight
P = np.array([tuple(v.co) for v in me.vertices])
zero = W.sum(1) < 1e-4
log('heat weighting: verts without weight', int(zero.sum()), 'of', nv)


def seg_dist(p, a, b):
    a, b = np.array(a), np.array(b)
    ab = b - a
    t = np.clip(((p - a) @ ab) / (ab @ ab), 0, 1)
    return np.linalg.norm(p - (a + t[:, None] * ab), axis=1)


D = np.stack([seg_dist(P, J[n][0], J[n][1]) for n in ORDER], 1)
idx = {n: i for i, n in enumerate(ORDER)}
# (a) verts heat weighting missed -> nearest bone segment
for i in np.nonzero(zero)[0]:
    W[i, int(np.argmin(D[i]))] = 1.0
# (b) side rule: no cross-talk between left and right limbs
for i, n in enumerate(ORDER):
    if n.startswith('Left'):
        W[P[:, 0] < -0.04, i] = 0
    if n.startswith('Right'):
        W[P[:, 0] > 0.04, i] = 0
# (c) rigid parts: PLSS backpack rides on the chest, helmet bubble on the head
plss = (P[:, 1] > 0.115) & (P[:, 2] > 0.60)
W[plss] = 0
W[plss, idx['Spine2']] = 1
helmet = (P[:, 2] > 1.60) & ~plss
W[helmet] = 0
W[helmet, idx['Head']] = 1
# display & control module (chest box) + its buttons: rigid on the chest, no cracks when leaning
dcm = (np.abs(P[:, 0]) < 0.13) & (P[:, 1] < -0.15) & (P[:, 2] > 1.19) & (P[:, 2] < 1.52)
W[dcm] = 0
W[dcm, idx['Spine2']] = 1
# (d) arms beyond the shoulder ball must not pull torso bones; torso must not pull arm bones
arm_ids = [idx[n] for n in ORDER if 'Arm' in n or 'Hand' in n]
upper = P[:, 2] > 1.15
far = np.abs(P[:, 0]) > 0.42
for k in [idx['Spine'], idx['Spine1'], idx['Spine2'], idx['Neck'], idx['Hips']]:
    W[upper & far, k] = 0
near = (np.abs(P[:, 0]) < 0.20) & upper
for k in arm_ids:
    W[near, k] = 0
# (e) legs: below the crotch only leg bones (+ Hips near the top)
low = P[:, 2] < 0.66
for n in ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head']:
    W[low, idx[n]] = 0
# repair rows emptied by the rules
empty = W.sum(1) < 1e-4
for i in np.nonzero(empty)[0]:
    allowed = np.ones(len(ORDER), bool)
    for j, n in enumerate(ORDER):
        if (n.startswith('Left') and P[i, 0] < -0.04) or (n.startswith('Right') and P[i, 0] > 0.04):
            allowed[j] = False
    d = np.where(allowed, D[i], 1e9)
    W[i, int(np.argmin(d))] = 1.0
# light smoothing over mesh edges (2 passes), then keep top-4 and normalise
edges = np.array([tuple(e.vertices) for e in me.edges])
for _ in range(2):
    acc = W.copy()
    cnt = np.ones(nv)
    np.add.at(acc, edges[:, 0], W[edges[:, 1]])
    np.add.at(acc, edges[:, 1], W[edges[:, 0]])
    np.add.at(cnt, edges[:, 0], 1)
    np.add.at(cnt, edges[:, 1], 1)
    sm = acc / cnt[:, None]
    keep = plss | helmet | dcm     # rigid parts stay rigid
    W = np.where(keep[:, None], W, 0.5 * W + 0.5 * sm)
    for i, n in enumerate(ORDER):   # keep side rule after smoothing
        if n.startswith('Left'):
            W[P[:, 0] < -0.04, i] = 0
        if n.startswith('Right'):
            W[P[:, 0] > 0.04, i] = 0
top = np.argsort(-W, 1)[:, 4:]
np.put_along_axis(W, top, 0, 1)
W[W < 0.01] = 0
W /= W.sum(1, keepdims=True)
for g in list(mesh.vertex_groups):
    mesh.vertex_groups.remove(g)
for j, n in enumerate(ORDER):
    g = mesh.vertex_groups.new(name=n)
    for i in np.nonzero(W[:, j])[0]:
        g.add([int(i)], float(W[i, j]), 'REPLACE')
log('weights: max influences', int((W > 0).sum(1).max()), 'rigid plss', int(plss.sum()), 'helmet', int(helmet.sum()), 'dcm', int(dcm.sum()))

# --------------------------------------------------------------------------- 5. pose math
# Rotations are written as deltas about the *rest world axes* (X = character's left, Y = back,
# Z = up) and converted to each bone's local frame:  q_local = R_rest^-1 * q_world * R_rest.
REST = {b.name: b.matrix_local.to_3x3() for b in arm_data.bones}
AX = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}


def qw(*rots):
    q = Quaternion()
    for ax, deg in rots:
        q = Quaternion(AX[ax], math.radians(deg)) @ q
    return q


def q_local(name, q):
    R = REST[name].to_quaternion()
    return R.inverted() @ q @ R


ARM_DOWN = 55.0   # arms lowered from the rest T-pose (rest droops ~7 deg) -> ~62 deg below horizontal


def pose_from_params(p):
    """p: dict of scalar parameters (degrees / metres). Returns {bone: (quat_world, offset_world)}."""
    g = lambda k, d=0.0: p.get(k, d)
    lean, twist = g('lean'), g('twist')
    out = {}
    out['Hips'] = (qw(('X', g('hipPitch')), ('Z', g('hipYaw')), ('Y', g('hipRoll'))),
                   Vector((g('hipX'), g('hipY'), g('hipZ'))))
    out['Spine'] = (qw(('X', 0.4 * lean), ('Z', 0.3 * twist)), None)
    out['Spine1'] = (qw(('X', 0.3 * lean), ('Z', 0.3 * twist)), None)
    out['Spine2'] = (qw(('X', 0.3 * lean + g('chest')), ('Z', 0.4 * twist)), None)
    out['Neck'] = (qw(('X', -0.4 * lean + 0.5 * g('nod')), ('Z', 0.5 * g('headYaw'))), None)
    out['Head'] = (qw(('X', -0.3 * lean + 0.5 * g('nod')), ('Z', 0.5 * g('headYaw'))), None)
    for side, sg in (('Left', 1), ('Right', -1)):
        k = side[0]
        out[side + 'Shoulder'] = (qw(('Y', -sg * g('shrug' + k))), None)
        out[side + 'Arm'] = (qw(('X', g('armTw' + k)),
                                ('Y', sg * (ARM_DOWN - g('armOut' + k))),
                                ('X', -g('arm' + k))), None)
        out[side + 'ForeArm'] = (qw(('Z', -sg * g('elb' + k)), ('X', g('foreTw' + k))), None)
        out[side + 'Hand'] = (qw(('Z', -sg * g('wristB' + k)), ('X', g('wristR' + k))), None)
        out[side + 'UpLeg'] = (qw(('Y', -sg * g('legOut' + k)), ('X', -g('th' + k))), None)
        out[side + 'Leg'] = (qw(('X', g('kn' + k))), None)
        out[side + 'Foot'] = (qw(('X', g('ft' + k))), None)
        out[side + 'ToeBase'] = (qw(('X', g('toe' + k))), None)
    if 'sockQ' in p:
        out['BagSocket'] = (p['sockQ'], p['sockT'])
    return out


# ---- own forward kinematics for the arm chains (chest frame, Spine2 at rest) for the hand solver
def fk_arm(side, prm):
    pose = pose_from_params(prm)
    sh, ar, fo, ha = (side + 'Shoulder', side + 'Arm', side + 'ForeArm', side + 'Hand')
    Ds = pose[sh][0]
    Da = Ds @ pose[ar][0]
    Df = Da @ pose[fo][0]
    Dh = Df @ pose[ha][0]
    s0 = Vector(J[sh][0])
    a0 = s0 + Ds @ (Vector(J[ar][0]) - s0)
    e = a0 + Da @ (Vector(J[fo][0]) - Vector(J[ar][0]))
    w = e + Df @ (Vector(J[ha][0]) - Vector(J[fo][0]))
    tip = w + Dh @ (Vector(J[ha][1]) - Vector(J[ha][0]))
    return e, w, tip, Dh


def solve_hands(target_w, target_tip, base, side='Left', iters=900, seed=0):
    """Small random-restart coordinate search for (armTw, armOut, arm, elb, wristB, wristR)
    so the wrist and the hand tip reach the targets (left side; right is mirrored)."""
    k = side[0]
    keys = ['armTw' + k, 'armOut' + k, 'arm' + k, 'elb' + k, 'wristB' + k, 'wristR' + k]
    lim = {'armTw': (-30, 95), 'armOut': (-25, 45), 'arm': (-20, 110), 'elb': (0, 125),
           'wristB': (-45, 45), 'wristR': (-60, 60)}
    x = {kk: base.get(kk, 0.0) for kk in keys}

    def cost(xx):
        prm = dict(base)
        prm.update(xx)
        e, w, tip, _ = fk_arm(side, prm)
        c = (w - target_w).length ** 2 + 0.5 * (tip - target_tip).length ** 2
        # elbow should stay out to the side and below the shoulder (natural, no body clipping)
        sgn = 1 if side == 'Left' else -1
        c += 1.0 * max(0.0, ELBOW_MIN_X - sgn * e.x) ** 2 + 0.05 * max(0.0, e.z - 1.30) ** 2
        c += 1e-6 * sum(v * v for v in xx.values())
        return c
    best = cost(x)
    step = 20.0
    rng = np.random.default_rng(seed)
    for it in range(iters):
        kk = keys[it % len(keys)]
        for d in (step, -step):
            y = dict(x)
            base_k = kk[:-1]
            lo, hi = lim[base_k]
            y[kk] = float(np.clip(y[kk] + d, lo, hi))
            c = cost(y)
            if c < best:
                best, x = c, y
                break
        if it % len(keys) == len(keys) - 1:
            step = max(0.25, step * 0.93)
    return x, best


def mirror_params(xl):
    return {kk[:-1] + 'R': v for kk, v in xl.items()}


# ---- carry pose: bag (CTB-like 0.36 x 0.24 x 0.30 m) held in front of the belly
BAG = Vector((0.0, -0.41, 1.06))      # bag centre (= BagSocket head), chest frame
BAG_HALF_W = 0.21                     # CTB is 42.5 cm wide (STS-92 press kit)
ELBOW_MIN_X = 0.37                    # torso is ~0.29 m wide each side at the belly + arm radius
GRIP_W = Vector((BAG_HALF_W + 0.025, 0.08, 0.04))    # wrist, bag space
GRIP_T = Vector((BAG_HALF_W + 0.01, -0.02, 0.02))    # hand tip, bag space
xl, c = solve_hands(BAG + GRIP_W, BAG + GRIP_T, {'elbL': 70, 'armL': 30, 'armTwL': 40, 'armOutL': 10},
                    iters=1500)
CARRY_ARMS = dict(xl)
CARRY_ARMS.update(mirror_params(xl))
e, w, tip, _ = fk_arm('Left', CARRY_ARMS)
log('carry solve cost %.5f wrist %s tip %s elbow %s' % (c, tuple(round(v, 3) for v in w),
                                                           tuple(round(v, 3) for v in tip), tuple(round(v, 3) for v in e)))
log('carry arm params', {k: round(v, 1) for k, v in CARRY_ARMS.items()})


# --------------------------------------------------------------------------- 6. clips
def lerp_keys(keys, t, cyclic=True):
    """keys: list of (t in [0,1], dict). Smooth (cosine) interpolation, cyclic."""
    ks = sorted(keys, key=lambda k: k[0])
    if cyclic:
        ks = ks + [(ks[0][0] + 1.0, ks[0][1])]
    t = t % 1.0 if cyclic else min(max(t, 0.0), ks[-1][0])
    for (t0, a), (t1, b) in zip(ks, ks[1:]):
        if t0 <= t <= t1:
            u = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            u = 0.5 - 0.5 * math.cos(math.pi * u)
            names = set(a) | set(b)
            return {n: a.get(n, 0.0) * (1 - u) + b.get(n, 0.0) * u for n in names}
    return dict(ks[-1][1])


S = math.sin
C = math.cos
TAU = 2 * math.pi
HANG = {'elbL': 18, 'elbR': 18, 'armTwL': 10, 'armTwR': 10}


def idle(t):
    ph = TAU * t
    p = dict(HANG)
    p.update({'hipZ': -0.004 + 0.004 * S(ph), 'hipX': 0.008 * S(ph), 'hipRoll': 0.8 * S(ph),
              'chest': 1.2 * S(ph), 'lean': 1.5, 'headYaw': 5 * S(ph), 'nod': 1.5 * S(2 * ph),
              'armL': 2 * S(ph), 'armR': 2 * S(ph + 0.6), 'elbL': 18 + 3 * S(ph), 'elbR': 18 + 3 * S(ph + 1),
              'thL': 2, 'thR': 2, 'knL': 4, 'knR': 4, 'ftL': -2, 'ftR': -2,
              'legOutL': 1.5 - 0.8 * S(ph), 'legOutR': 1.5 + 0.8 * S(ph)})
    return p


def gait(t, amp_th, knee, hip_bounce, lean, arm_amp, foot_amp=15):
    """alternating bouncy Moon walk; t in [0,1); left heel strike at t=0.25, right at 0.75"""
    p = {}
    for k, ph in (('L', TAU * t), ('R', TAU * t + math.pi)):
        p['th' + k] = amp_th * S(ph) + 3
        p['kn' + k] = 8 + knee * max(0.0, C(ph)) ** 1.5
        p['ft' + k] = -foot_amp * S(ph) - 0.15 * knee * max(0.0, C(ph)) ** 1.5
        p['toe' + k] = 12 * max(0.0, -S(ph)) ** 2
    p['hipZ'] = hip_bounce * C(2 * TAU * t) - hip_bounce * 0.6
    p['hipYaw'] = -6 * S(TAU * t)
    p['hipRoll'] = 2 * S(TAU * t)
    p['twist'] = 7 * S(TAU * t)
    p['lean'] = lean
    p['nod'] = -1.5 * C(2 * TAU * t)
    p['armL'] = -arm_amp * S(TAU * t) + 4
    p['armR'] = arm_amp * S(TAU * t) + 4
    p['elbL'] = 22 + 10 * max(0.0, -S(TAU * t))
    p['elbR'] = 22 + 10 * max(0.0, S(TAU * t))
    p['armTwL'] = p['armTwR'] = 10
    p['armOutL'] = p['armOutR'] = 3
    return p


def walk(t):
    return gait(t, amp_th=26, knee=42, hip_bounce=0.035, lean=6, arm_amp=16)


def carry(t):
    p = gait(t, amp_th=18, knee=30, hip_bounce=0.022, lean=-2, arm_amp=0, foot_amp=11)
    p['twist'] = 3 * S(TAU * t)
    p['hipYaw'] = -4 * S(TAU * t)
    for k in list(p):
        if k.startswith(('arm', 'elb', 'wrist')):
            del p[k]
    p.update(CARRY_ARMS)
    p['nod'] = 4 - 1.0 * C(2 * TAU * t)   # look a little down at the bag
    return p


# Run = Apollo-style two-footed "kangaroo hop" (left foot slightly ahead), 0.8 s per hop
RUN_KEYS = [
    (0.00, {'thL': 28, 'thR': 22, 'knL': 18, 'knR': 18, 'ftL': -12, 'ftR': -12, 'hipZ': -0.03, 'hipY': 0.0,
            'lean': 10, 'armL': 15, 'armR': 15, 'elbL': 35, 'elbR': 35, 'armOutL': 12, 'armOutR': 12}),
    (0.16, {'thL': 40, 'thR': 36, 'knL': 62, 'knR': 62, 'ftL': -24, 'ftR': -24, 'hipZ': -0.13, 'hipY': 0.03,
            'lean': 22, 'armL': -22, 'armR': -22, 'elbL': 30, 'elbR': 30, 'armOutL': 8, 'armOutR': 8, 'nod': 6}),
    (0.34, {'thL': -6, 'thR': -10, 'knL': 6, 'knR': 6, 'ftL': 30, 'ftR': 30, 'toeL': 15, 'toeR': 15,
            'hipZ': 0.04, 'lean': 12, 'armL': 40, 'armR': 40, 'elbL': 40, 'elbR': 40,
            'armOutL': 15, 'armOutR': 15}),
    (0.62, {'thL': 26, 'thR': 18, 'knL': 46, 'knR': 46, 'ftL': 8, 'ftR': 8, 'hipZ': 0.09, 'lean': 8,
            'armL': 32, 'armR': 32, 'elbL': 45, 'elbR': 45, 'armOutL': 22, 'armOutR': 22, 'nod': -3}),
    (0.86, {'thL': 32, 'thR': 26, 'knL': 22, 'knR': 22, 'ftL': -10, 'ftR': -10, 'hipZ': 0.04, 'lean': 8,
            'armL': 22, 'armR': 22, 'elbL': 38, 'elbR': 38, 'armOutL': 16, 'armOutR': 16}),
]


def run(t):
    p = lerp_keys(RUN_KEYS, t)
    p['armTwL'] = p['armTwR'] = 15
    p['twist'] = 2 * S(TAU * t)
    return p


# Jump: 1.2 s, played once (crouch 0-0.17 s, push-off, airborne pose held, landing reach)
JUMP_KEYS = [
    (0 / 36, dict(idle(0.0))),
    (5 / 36, {'thL': 42, 'thR': 42, 'knL': 72, 'knR': 72, 'ftL': -30, 'ftR': -30, 'hipZ': -0.14, 'hipY': 0.04,
              'lean': 26, 'armL': -35, 'armR': -35, 'elbL': 25, 'elbR': 25, 'armOutL': 6, 'armOutR': 6,
              'nod': 8, 'armTwL': 10, 'armTwR': 10}),
    (9 / 36, {'thL': -4, 'thR': -4, 'knL': 4, 'knR': 4, 'ftL': 32, 'ftR': 32, 'toeL': 18, 'toeR': 18,
              'hipZ': 0.03, 'lean': 4, 'armL': 60, 'armR': 60, 'elbL': 45, 'elbR': 45, 'armOutL': 20,
              'armOutR': 20, 'nod': -6, 'armTwL': 15, 'armTwR': 15}),
    (16 / 36, {'thL': 30, 'thR': 22, 'knL': 50, 'knR': 40, 'ftL': 12, 'ftR': 12, 'hipZ': 0.0, 'lean': 4,
               'armL': 55, 'armR': 55, 'elbL': 40, 'elbR': 40, 'armOutL': 35, 'armOutR': 35, 'nod': -4,
               'legOutL': 4, 'legOutR': 4, 'armTwL': 15, 'armTwR': 15}),
    (28 / 36, {'thL': 26, 'thR': 30, 'knL': 40, 'knR': 50, 'ftL': 10, 'ftR': 10, 'hipZ': 0.0, 'lean': 6,
               'armL': 45, 'armR': 45, 'elbL': 42, 'elbR': 42, 'armOutL': 40, 'armOutR': 40, 'nod': -2,
               'legOutL': 5, 'legOutR': 5, 'armTwL': 15, 'armTwR': 15}),
    (36 / 36, {'thL': 24, 'thR': 24, 'knL': 18, 'knR': 18, 'ftL': -10, 'ftR': -10, 'hipZ': 0.0, 'lean': 8,
               'armL': 30, 'armR': 30, 'elbL': 35, 'elbR': 35, 'armOutL': 25, 'armOutR': 25,
               'armTwL': 12, 'armTwR': 12}),
]


def jump(t):
    return lerp_keys(JUMP_KEYS, t, cyclic=False)


# Pour: bag lifted to chest height and tipped forward ~75 deg, held, shaken, back. 2 s loop.
def bag_frame(t):
    """bag centre offset + tilt (deg about X, + = top tips forward) over the Pour cycle"""
    k = lerp_keys([(0.0, {'z': 0.0, 'y': 0.0, 'tilt': 0.0}),
                   (0.22, {'z': 0.16, 'y': -0.06, 'tilt': 10.0}),
                   (0.40, {'z': 0.20, 'y': -0.10, 'tilt': 75.0}),
                   (0.70, {'z': 0.20, 'y': -0.10, 'tilt': 80.0}),
                   (0.85, {'z': 0.12, 'y': -0.05, 'tilt': 25.0})], t)
    shake = 4.0 * S(6 * TAU * t) if 0.42 < t < 0.70 else 0.0
    return Vector((0, k['y'], k['z'])), k['tilt'] + shake


POUR_SAMPLES = {}


def pour_arms(t):
    key = round(t, 4)
    if key in POUR_SAMPLES:
        return POUR_SAMPLES[key]
    off, tilt = bag_frame(t)
    Q = qw(('X', tilt))
    # hand grip points on the bag sides, expressed in bag space (same as the carry grip)
    cen = BAG + off
    xl, _ = solve_hands(cen + Q @ GRIP_W, cen + Q @ GRIP_T, dict(CARRY_ARMS), iters=600)
    r = dict(xl)
    r.update(mirror_params(xl))
    POUR_SAMPLES[key] = (r, off, Q)
    return POUR_SAMPLES[key]


def pour(t):
    arms, off, Q = pour_arms(t)
    p = {'lean': 8 + 4 * S(TAU * t) ** 2, 'nod': 8, 'thL': 6, 'thR': 2, 'knL': 10, 'knR': 8,
         'ftL': -4, 'ftR': -2, 'hipZ': -0.01, 'hipY': 0.01, 'legOutL': 3, 'legOutR': 3}
    p.update(arms)
    p['sockQ'] = Q
    p['sockT'] = off
    return p


CLIPS = [('Idle', idle, 60, True), ('Walk', walk, 36, True), ('Run', run, 24, True),
         ('Jump', jump, 36, False), ('Carry', carry, 42, True), ('Pour', pour, 60, True)]

# --------------------------------------------------------------------------- 7. bake actions
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='POSE')
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'
if rig.animation_data is None:
    rig.animation_data_create()
ad = rig.animation_data
ALL_BONES = ORDER + ['BagSocket']


def apply_pose(prm, prev):
    pose = pose_from_params(prm)
    for n in ALL_BONES:
        pb = rig.pose.bones[n]
        qwld, offw = pose.get(n, (Quaternion(), None))
        q = q_local(n, qwld)
        if n in prev and prev[n].dot(q) < 0:
            q = -q
        prev[n] = q
        pb.rotation_quaternion = q
        R = REST[n]
        pb.location = (R.inverted() @ offw) if offw is not None else Vector()


for name, fn, nfr, loop in CLIPS:
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ad.action = act
    prev = {}
    for f in range(nfr + 1):
        t = f / nfr
        apply_pose(fn(t if f < nfr or not loop else 0.0), prev)
        for n in ALL_BONES:
            pb = rig.pose.bones[n]
            pb.keyframe_insert('rotation_quaternion', frame=f, group=n)
            if n in ('Hips', 'BagSocket'):
                pb.keyframe_insert('location', frame=f, group=n)
    act.frame_range = (0, nfr)
    tr = ad.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, 0, act)
    st.name = name
    tr.mute = True
    ad.action = None
    log('clip', name, nfr, 'frames', round(nfr / FPS, 3), 's', 'loop' if loop else 'once')

for pb in rig.pose.bones:
    pb.rotation_quaternion = Quaternion()
    pb.location = Vector()
bpy.ops.object.mode_set(mode='OBJECT')
sc.frame_start, sc.frame_end = 0, 60

# --------------------------------------------------------------------------- 9. export
for t2 in ad.nla_tracks:
    t2.mute = False
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
mesh.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, 'astronaut_rig.blend'))

want = dict(filepath=OUT, export_format='GLB', use_selection=True, export_apply=False,
            export_yup=True, export_texcoords=True, export_normals=True, export_tangents=False,
            export_materials='EXPORT', export_image_format='JPEG', export_jpeg_quality=88,
            export_cameras=False, export_lights=False, export_extras=False,
            export_skins=True, export_all_influences=False, export_def_bones=False,
            export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
            export_frame_range=False, export_anim_slide_to_zero=True, export_optimize_animation_size=False,
            export_reset_pose_bones=True, export_rest_position_armature=True,
            export_anim_single_armature=True, export_morph=False, export_draco_mesh_compression_enable=False)
props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
kw = {k: v for k, v in want.items() if k in props}
log('exporter ignored options', sorted(set(want) - props))
bpy.ops.export_scene.gltf(**kw)
log('exported', OUT, os.path.getsize(OUT), 'bytes')
