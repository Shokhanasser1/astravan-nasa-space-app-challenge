# The kid astronaut (15 Nov, the team's new player character, after a concept picture): built part by part on the
# game rig's rest pose (bones.json: joint positions from public/models/astronaut/astronaut.glb), so the game's rig and
# its 15 clips drive it unchanged. Each part carries the bones it follows (custom property "bones", exported as glTF
# extras); scripts/models/astronaut_kid.mjs skins it onto the rig. No text, logos or flags.
#   Blender -b --factory-startup -P build_kid.py -- bones.json out.glb [renders_dir]
# v2: a cartoon face (eyes with white, iris, pupil and catchlights, lashes, brows, nose, smile, cheeks, black hair with a
# fringe), a cleaner helmet (spherical-cap visor and face opening with a white rim, headphone pucks with grey rims, a
# collar ring), ringed limbs with soft folds at knees and elbows (they bend cleaner), chunky moon boots and dusty lower
# legs (per-face paint), gloves with fingers and a thumb, a chest box with screen, buttons and vents.
import bpy, bmesh, json, math, sys, random
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
BONES = json.load(open(argv[0]))
OUT = argv[1]
RENDERS = argv[2] if len(argv) > 2 else None
random.seed(11)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def G(x, y, z):
    """glTF (x, y up, z front) -> Blender (x, -z, y): the exporter's +Y up turns it back."""
    return Vector((x, -z, y))


def head(b):
    return G(*BONES[b]['head'])


MATS = {}


def mat(name, rgb, rough=0.6, metal=0.0, alpha=1.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Alpha'].default_value = alpha
    if alpha < 1:
        m.surface_render_method = 'BLENDED'
        m.use_backface_culling = False
    MATS[name] = m
    return m


# palette (linear RGB). kid_gold / kid_visor / kid_glass stay separate materials in the game; every other material
# becomes a vertex colour (its Base Color) of one shared paint.
SUIT = mat('kid_suit', (0.86, 0.87, 0.86), 0.78)
SEAM = mat('kid_seam', (0.60, 0.61, 0.62), 0.8)
GOLD = mat('kid_gold', (0.80, 0.42, 0.06), 0.35, 0.4)
VISOR = mat('kid_visor', (1.0, 0.68, 0.25), 0.18, 1.0)
GLASS = mat('kid_glass', (0.9, 0.95, 1.0), 0.04, 0.0, alpha=0.14)
SKIN = mat('kid_skin', (0.50, 0.25, 0.12), 0.55)
BLUSH = mat('kid_blush', (0.58, 0.21, 0.12), 0.6)
HAIR = mat('kid_hair', (0.012, 0.009, 0.008), 0.45)
EYE = mat('kid_eye', (0.90, 0.90, 0.88), 0.25)
IRIS = mat('kid_iris', (0.17, 0.07, 0.022), 0.2)
PUPIL = mat('kid_pupil', (0.006, 0.004, 0.003), 0.2)
GLINT = mat('kid_glint', (1.0, 1.0, 1.0), 0.1)
MOUTH = mat('kid_mouth', (0.26, 0.06, 0.045), 0.5)
BOOT = mat('kid_boot', (0.52, 0.52, 0.51), 0.92)
SOLE = mat('kid_sole', (0.24, 0.24, 0.24), 0.9)
DUST = mat('kid_dust', (0.22, 0.22, 0.215), 0.95)
DUST2 = mat('kid_dust2', (0.38, 0.38, 0.37), 0.95)
GREY = mat('kid_grey', (0.30, 0.32, 0.35), 0.55, 0.2)
LGREY = mat('kid_lgrey', (0.52, 0.54, 0.57), 0.5)
DARK = mat('kid_dark', (0.03, 0.035, 0.045), 0.6)
SCREEN = mat('kid_screen', (0.02, 0.07, 0.10), 0.2)


def obj_from_bm(name, bm, material, bones, smooth=True, paint=None):
    mats = list(material) if isinstance(material, (list, tuple)) else [material]
    if paint:
        for f in bm.faces:
            f.material_index = paint(f.calc_center_median())
    # outward normals (the game's paint is single-sided): flip a part whose faces point inward on balance
    bm.normal_update()
    cen = sum((v.co for v in bm.verts), Vector()) / max(1, len(bm.verts))
    if sum(f.normal.dot(f.calc_center_median() - cen) * f.calc_area() for f in bm.faces) < 0:
        bmesh.ops.reverse_faces(bm, faces=list(bm.faces))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for poly in me.polygons:
            poly.use_smooth = True
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    for m in mats:
        me.materials.append(m)
    o['bones'] = ','.join(bones)
    return o


def sphere(name, c, r, material, bones, segs=20, rings=12, scale=(1, 1, 1), keep=None, rot=None, paint=None):
    """A (scaled, rotated) UV sphere at c (Blender coords); keep(v_local) -> bool drops the rest (partial shells)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    if keep:
        drop = [f for f in bm.faces if not all(keep(v.co) for v in f.verts)]
        bmesh.ops.delete(bm, geom=drop, context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    if rot:
        bmesh.ops.rotate(bm, cent=Vector(), matrix=rot, verts=bm.verts)
    bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    return obj_from_bm(name, bm, material, bones, paint=paint)


def limb(name, a, b, rad, material, bones, sides=16, ts=(0.0, 0.5, 1.0), paint=None, open_end=False):
    """A closed tube from a to b with radius rad(t) at the rings ts (0..1) and round end caps; paint(centre, t, radial)
    -> material index per face. Many rings near a joint = a clean bend when skinned."""
    d = b - a
    dn = d.normalized()
    q = dn.to_track_quat('Z', 'Y').to_matrix()
    X, Y = q.col[0], q.col[1]
    r0, r1 = rad(0.0), rad(1.0)
    prof = [(a - dn * r0 * math.sin(p), r0 * math.cos(p), 0.0) for p in (1.2, 0.7)]
    prof += [(a + d * t, rad(t), t) for t in ts]
    if not open_end:  # an open end is a sleeve over the next part: its rim is a clean seam line
        prof += [(b + dn * r1 * math.sin(p), r1 * math.cos(p), 1.0) for p in (0.7, 1.2)]
    dirs = [X * math.cos(2 * math.pi * s / sides) + Y * math.sin(2 * math.pi * s / sides) for s in range(sides)]
    bm = bmesh.new()
    rows = [[bm.verts.new(c + u * r) for u in dirs] for c, r, _ in prof]
    for k in range(len(rows) - 1):
        tm = (prof[k][2] + prof[k + 1][2]) / 2
        for s in range(sides):
            f = bm.faces.new((rows[k][s], rows[k][(s + 1) % sides], rows[k + 1][(s + 1) % sides], rows[k + 1][s]))
            if paint:
                f.material_index = paint(f.calc_center_median(), tm, dirs[s])
    pa, pb = bm.verts.new(a - dn * r0), (None if open_end else bm.verts.new(b + dn * r1))
    for s in range(sides):
        bm.faces.new((pa, rows[0][(s + 1) % sides], rows[0][s]))
        if not open_end:
            bm.faces.new((pb, rows[-1][s], rows[-1][(s + 1) % sides]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj_from_bm(name, bm, material, bones)


def capsule(name, a, b, r, material, bones, segs=10, r2=None):
    r2 = r if r2 is None else r2
    return limb(name, a, b, lambda t: r + (r2 - r) * t, material, bones, sides=segs, ts=(0.0, 1.0))


def zone(name, c, axis, R, th0, th1, material, bones, segs=32, rings=8):
    """A spherical zone round `axis` between polar angles th0..th1 (0 or pi closes that end): clean circular edges."""
    q = Vector(axis).normalized().to_track_quat('Z', 'Y').to_matrix()
    pt = lambda th, j: c + q @ Vector((R * math.sin(th) * math.cos(2 * math.pi * j / segs),
                                       R * math.sin(th) * math.sin(2 * math.pi * j / segs), R * math.cos(th)))
    ths = [th0 + (th1 - th0) * i / rings for i in range(rings + 1)]
    pole0, pole1 = th0 <= 1e-6, th1 >= math.pi - 1e-6
    ths = ths[1 if pole0 else 0: len(ths) - (1 if pole1 else 0)]
    bm = bmesh.new()
    rows = [[bm.verts.new(pt(th, j)) for j in range(segs)] for th in ths]
    for i in range(len(rows) - 1):
        for j in range(segs):
            bm.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][(j + 1) % segs], rows[i][(j + 1) % segs]))
    if pole0:
        p = bm.verts.new(c + q @ Vector((0, 0, R)))
        for j in range(segs):
            bm.faces.new((p, rows[0][j], rows[0][(j + 1) % segs]))
    if pole1:
        p = bm.verts.new(c + q @ Vector((0, 0, -R)))
        for j in range(segs):
            bm.faces.new((p, rows[-1][(j + 1) % segs], rows[-1][j]))
    return obj_from_bm(name, bm, material, bones)


def rbox(name, c, size, bevel, material, bones, segs=2, rot=None, paint=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=bevel, segments=segs, affect='EDGES', profile=0.5)
    if rot:
        bmesh.ops.rotate(bm, cent=Vector(), matrix=rot, verts=bm.verts)
    bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    return obj_from_bm(name, bm, material, bones, paint=paint)


def ring(name, c, axis, R, r, material, bones, segs=32, tube=10):
    """A torus at c, its hole along `axis` (Blender coords)."""
    bm = bmesh.new()
    rows = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        row = []
        for j in range(tube):
            t = 2 * math.pi * j / tube
            rr = R + r * math.cos(t)
            row.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), r * math.sin(t))))
        rows.append(row)
    for i in range(segs):
        for j in range(tube):
            bm.faces.new((rows[i][j], rows[(i + 1) % segs][j], rows[(i + 1) % segs][(j + 1) % tube], rows[i][(j + 1) % tube]))
    rot = Vector(axis).normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ rot, verts=bm.verts)
    return obj_from_bm(name, bm, material, bones)


def band(name, c, axis, r, h, material, bones, segs=24, squash=1.0):
    """A band round a limb at c: a short sleeve of radius r, height h, rounded edges, along `axis`."""
    q = Vector(axis).normalized().to_track_quat('Z', 'Y').to_matrix()
    prof = [(-h / 2, r - 0.005), (-h / 2 + 0.004, r), (h / 2 - 0.004, r), (h / 2, r - 0.005)]
    bm = bmesh.new()
    rows = [[bm.verts.new(c + q @ Vector((rr * math.cos(2 * math.pi * j / segs), squash * rr * math.sin(2 * math.pi * j / segs), z)))
             for j in range(segs)] for z, rr in prof]
    for k in range(len(rows) - 1):
        for j in range(segs):
            bm.faces.new((rows[k][j], rows[k][(j + 1) % segs], rows[k + 1][(j + 1) % segs], rows[k + 1][j]))
    return obj_from_bm(name, bm, material, bones)


def tube(name, pts, r, material, bones, sides=8):
    """A hose (or a drawn line) through the points (Blender coords)."""
    bm = bmesh.new()
    rings_ = []
    for k, p in enumerate(pts):
        d = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
        q = d.to_track_quat('Z', 'Y').to_matrix()
        rr = r(k / (len(pts) - 1)) if callable(r) else r
        rings_.append([bm.verts.new(p + q @ Vector((rr * math.cos(2 * math.pi * s / sides), rr * math.sin(2 * math.pi * s / sides), 0))) for s in range(sides)])
    for k in range(len(rings_) - 1):
        for s in range(sides):
            bm.faces.new((rings_[k][s], rings_[k + 1][s], rings_[k + 1][(s + 1) % sides], rings_[k][(s + 1) % sides]))
    return obj_from_bm(name, bm, material, bones)


def bezier(a, b, c, n=12):
    return [a * (1 - t) ** 2 + b * 2 * t * (1 - t) + c * t * t for t in (i / (n - 1) for i in range(n))]


def lerp(a, b, t):
    return a + (b - a) * t


def noise(p):
    return (math.sin(p.x * 47 + 1.3) * math.sin(p.y * 41 + 0.7) * math.sin(p.z * 43 + 2.1)
            + 0.5 * math.sin(p.x * 61 + p.z * 57 + p.y * 49)) / 1.5


def dust_at(c, top, bottom, gain=1.0):
    """Moon dust: 0 clean, 1 dark dust, 2 light dust; more of it lower down, in blotches."""
    g = (top - c.z) / (top - bottom)
    if g < -0.3:
        return 0
    v = g * gain + 0.4 * noise(c) + 0.1 * (random.random() - 0.5)
    return 1 if v > 0.98 else 2 if v > 0.62 else 0


def fold(t, at, amp, width=0.16, lam=0.075):
    """Soft suit folds near a joint at t=at: ripples that fade out over `width`."""
    d = abs(t - at)
    if d >= width:
        return 0.0
    return amp * (0.5 + 0.5 * math.cos(math.pi * d / width)) * math.cos(2 * math.pi * d / lam)


TS_END = (0.0, 0.12, 0.26, 0.4, 0.54, 0.66, 0.76, 0.84, 0.895, 0.93, 0.965, 1.0)  # dense near the far joint
TS_START = tuple(round(1 - t, 4) for t in reversed(TS_END))                         # dense near the near joint
TS_UPPER = (0.0, 0.26, 0.54, 0.76, 0.84, 0.895, 0.93, 0.965, 1.0, 1.06, 1.12)                  # thigh, upper arm: folds at the end
TS_SHIN = (0.0, 0.05, 0.1, 0.17, 0.27, 0.38, 0.48, 0.57, 0.65, 0.72, 0.79, 0.86, 0.93, 1.0)  # small faces where the dust is

# ---------------------------------------------------------------- legs and boots
for s, L in ((1, 'Left'), (-1, 'Right')):
    up, knee, ankle, toe = head(f'{L}UpLeg'), head(f'{L}Leg'), head(f'{L}Foot'), head(f'{L}ToeBase')
    thigh_r = lambda t: lerp(0.1, 0.093, min(t, 1.0)) + fold(t, 1.0, 0.0055) + (0.004 if t > 1.09 else 0.0)
    limb(f'{L}_thigh', up, knee, thigh_r, SUIT, [f'{L}UpLeg', f'{L}Leg'], sides=16, ts=TS_UPPER, open_end=True)
    shin_end = ankle + Vector((0, 0, 0.04))
    shin_r = lambda t: lerp(0.083, 0.089, min(1.0, max(0.0, t - 0.08) / 0.17)) - 0.005 * t
    limb(f'{L}_shin', knee, shin_end, shin_r, [SUIT, DUST, DUST2], [f'{L}Leg', f'{L}Foot'], sides=16, ts=TS_SHIN,
         paint=lambda c, t, u: dust_at(c, 0.34, 0.13))
    band(f'{L}_knee_band', lerp(up, knee, 0.8), knee - up, thigh_r(0.8) + 0.006, 0.036, GOLD, [f'{L}UpLeg', f'{L}Leg'])
    # chunky moon boot: a padded shaft round the ankle with a rolled top, a rounded foot, a grey sole; dusty
    upd = (knee - ankle).normalized()
    shaft_r = lambda t: 0.098 + 0.012 * min(1.0, max(0.0, (t - 0.8) / 0.12))
    limb(f'{L}_boot_shaft', ankle - upd * 0.05, ankle + upd * 0.14, shaft_r, [BOOT, DUST, DUST2], [f'{L}Leg', f'{L}Foot'],
         sides=16, ts=(0.0, 0.2, 0.4, 0.58, 0.74, 0.86, 0.94, 1.0), paint=lambda c, t, u: 2 if dust_at(c, 0.3, 0.02, 0.9) else 0)
    mid = (ankle + toe) / 2
    rbox(f'{L}_boot', Vector((mid.x, -0.105, 0.07)), (0.17, 0.35, 0.13), 0.058, BOOT, [f'{L}Foot', f'{L}ToeBase'], segs=3)
    rbox(f'{L}_sole', Vector((mid.x, -0.105, 0.017)), (0.178, 0.356, 0.032), 0.013, SOLE, [f'{L}Foot', f'{L}ToeBase'], segs=2)

# ---------------------------------------------------------------- arms and gloves
for s, L in ((1, 'Left'), (-1, 'Right')):
    sh, el, wr = head(f'{L}Arm'), head(f'{L}ForeArm'), head(f'{L}Hand')
    sphere(f'{L}_shoulder', lerp(head(f'{L}Shoulder'), sh, 0.75) + Vector((0, 0, -0.01)), 0.105, SUIT, ['Spine2', f'{L}Arm'],
           segs=16, rings=8)
    ua_r = lambda t: lerp(0.081, 0.075, min(t, 1.0)) + fold(t, 1.0, 0.005) + (0.003 if t > 1.09 else 0.0)
    limb(f'{L}_upperarm', sh, el, ua_r, SUIT, [f'{L}Arm', f'{L}ForeArm'], sides=14, ts=TS_UPPER, open_end=True)
    band(f'{L}_arm_band', lerp(sh, el, 0.5), el - sh, ua_r(0.5) + 0.006, 0.034, GOLD, [f'{L}Arm'])
    fa_r = lambda t: lerp(0.066, 0.071, min(1.0, max(0.0, t - 0.1) / 0.2)) - 0.008 * t
    limb(f'{L}_forearm', el, wr, fa_r, SUIT, [f'{L}ForeArm', f'{L}Hand'], sides=14, ts=TS_START)
    d = (wr - el).normalized()
    U = (Vector((0, 0, 1)) - d * d.z).normalized()          # up (the back of the hand in the T-pose)
    F = (Vector((0, -1, 0)) - d * d.y - U * U.y).normalized()  # front (the thumb side)
    rot = Matrix((d, U.cross(d), U)).transposed()
    band(f'{L}_cuff', wr + d * 0.002, d, 0.071, 0.036, GREY, [f'{L}ForeArm', f'{L}Hand'], segs=20)
    capsule(f'{L}_glove_wrist', wr - d * 0.01, wr + d * 0.035, 0.057, SUIT, [f'{L}Hand'], segs=12)
    rbox(f'{L}_glove', wr + d * 0.072 - U * 0.004, (0.105, 0.098, 0.056), 0.025, SUIT, [f'{L}Hand'], segs=2, rot=rot)
    for i, (fy, ln) in enumerate(((0.034, 0.052), (0.012, 0.058), (-0.011, 0.055), (-0.033, 0.046))):
        a = wr + d * 0.112 + F * fy - U * 0.006
        capsule(f'{L}_finger{i}', a, a + d * ln * 0.8 + F * fy * 0.08 - U * 0.022, 0.0138, SUIT, [f'{L}Hand'], segs=7)
    capsule(f'{L}_thumb', wr + d * 0.045 + F * 0.042 - U * 0.002, wr + d * 0.09 + F * 0.072 - U * 0.018, 0.0165, SUIT,
            [f'{L}Hand'], segs=8)

# a plain dark patch on the left upper arm (no logo)
pa = lerp(head('LeftArm'), head('LeftForeArm'), 0.27)
rbox('arm_patch', pa + Vector((0, -0.012, 0.079)), (0.05, 0.046, 0.008), 0.004, DARK, ['LeftArm'], segs=1)

# ---------------------------------------------------------------- torso, chest box, backpack
sphere('pelvis', G(0, 0.86, 0.04), 0.2, SUIT, ['Hips'], scale=(1.0, 0.78, 0.7), segs=20, rings=10)
sphere('torso', G(0, 1.17, 0.05), 0.24, SUIT, ['Spine', 'Spine1', 'Spine2'], scale=(0.95, 0.72, 1.18), segs=24, rings=14)
# a soft belt between the chest and the hips (oval like the body there), a seam line round its middle
band('belt', G(0, 0.975, 0.045), (0, 0, 1), 0.172, 0.065, SUIT, ['Spine', 'Hips'], segs=32, squash=0.8)
band('belt_seam', G(0, 0.975, 0.045), (0, 0, 1), 0.1745, 0.012, SEAM, ['Spine', 'Hips'], segs=32, squash=0.8)
# chest control box (no text): a raised block on top, a small screen, buttons and a knob, vents; two hoses
rbox('chest_box', G(0, 1.25, 0.225), (0.21, 0.06, 0.13), 0.016, SUIT, ['Spine2'])
rbox('chest_top', G(-0.025, 1.33, 0.215), (0.11, 0.05, 0.045), 0.012, SUIT, ['Spine2'])
for i, x in enumerate((-0.05, -0.02)):
    rbox(f'chest_top_vent{i}', G(x, 1.332, 0.2405), (0.022, 0.004, 0.016), 0.002, LGREY, ['Spine2'], segs=1)
rbox('chest_screen', G(-0.03, 1.264, 0.256), (0.085, 0.006, 0.046), 0.004, SCREEN, ['Spine2'], segs=1)
for i, x in enumerate((0.052, 0.078)):
    sphere(f'chest_button{i}', G(x, 1.28, 0.255), 0.0095, LGREY, ['Spine2'], segs=10, rings=6, scale=(1, 0.55, 1))
ring('chest_knob_rim', G(0.065, 1.232, 0.256), (0, -1, 0), 0.014, 0.0045, LGREY, ['Spine2'], segs=12, tube=4)
sphere('chest_knob', G(0.065, 1.232, 0.255), 0.011, GREY, ['Spine2'], segs=10, rings=5, scale=(1, 0.6, 1))
for i in range(3):
    rbox(f'chest_vent{i}', G(-0.055 + i * 0.021, 1.211, 0.2565), (0.012, 0.004, 0.022), 0.002, DARK, ['Spine2'], segs=1)
for s in (1, -1):
    tube(f'hose_{s}', bezier(G(s * 0.09, 1.21, 0.23), G(s * 0.165, 1.15, 0.25), G(s * 0.145, 1.06, 0.2), 8), 0.012, GREY,
         ['Spine2', 'Spine1'])
# backpack: compact rounded, a lid step at the top, a raised square on the back
rbox('pack', G(0, 1.2, -0.215), (0.36, 0.17, 0.46), 0.07, SUIT, ['Spine2'], segs=3)
rbox('pack_lid', G(0, 1.39, -0.215), (0.372, 0.18, 0.11), 0.05, SUIT, ['Spine2'], segs=2)
rbox('pack_panel', G(0, 1.13, -0.303), (0.16, 0.025, 0.16), 0.02, SUIT, ['Spine2'])

# ---------------------------------------------------------------- head: a kid's face in the bubble
H = head('Head')
hc = H + G(0, 0.075, 0.02)
FACE = 0.136
A_, B_, C_ = FACE * 0.95, FACE * 0.92, FACE * 1.03  # head half-axes: width, depth, height
sphere('head', hc, FACE, SKIN, ['Head'], segs=24, rings=16, scale=(0.95, 0.92, 1.03))


def face_pt(x, z, lift=0.0):
    """A point on the face (x across, z up from the head centre), lifted along the normal, and that normal."""
    y = -B_ * math.sqrt(max(1 - (x / A_) ** 2 - (z / C_) ** 2, 0.02))
    n = Vector((x / A_ ** 2, y / B_ ** 2, z / C_ ** 2)).normalized()
    return hc + Vector((x, y, z)) + n * lift, n


def face_frame(x, z, lift=0.0):
    """A frame on the face: local x across, local -y out of the face, local z up."""
    p, n = face_pt(x, z, lift)
    up = (Vector((0, 0, 1)) - n * n.z).normalized()
    return p, Matrix(((-n).cross(up), -n, up)).transposed()


EX, EZ = 0.047, -0.006
for s in (1, -1):
    p, M = face_frame(s * EX, EZ)
    Lp = lambda v, p=p, M=M: p + M @ Vector(v)
    sphere(f'eye_{s}', Lp((0, 0.006, 0)), 1.0, EYE, ['Head'], segs=16, rings=10, scale=(0.027, 0.016, 0.033), rot=M)
    sphere(f'iris_{s}', Lp((0, -0.0085, -0.002)), 1.0, IRIS, ['Head'], segs=14, rings=8, scale=(0.019, 0.006, 0.021), rot=M)
    sphere(f'pupil_{s}', Lp((0, -0.0143, -0.002)), 1.0, PUPIL, ['Head'], segs=10, rings=6, scale=(0.0095, 0.003, 0.0105), rot=M)
    # catchlights: the same side on both eyes (one light)
    sphere(f'glint_{s}', Lp((0.0065, -0.0158, 0.0085)), 1.0, GLINT, ['Head'], segs=8, rings=5, scale=(0.0052, 0.0025, 0.0052), rot=M)
    sphere(f'glint2_{s}', Lp((-0.006, -0.0152, -0.0095)), 1.0, GLINT, ['Head'], segs=6, rings=4, scale=(0.0024, 0.0012, 0.0024), rot=M)
    # upper lash line over the eye with a little flick at the outer corner
    lash = [Lp((0.0262 * math.cos(a), -0.0012, 0.0318 * math.sin(a) + 0.0008)) for a in (math.radians(x) for x in range(165, 5, -20))]
    flick = Lp((0.0315, -0.001, 0.011)) if s > 0 else Lp((-0.0315, -0.001, 0.011))
    lash = lash + [flick] if s > 0 else [flick] + lash
    tube(f'lash_{s}', lash, lambda u: 0.0026 + 0.0012 * (u if s > 0 else 1 - u), HAIR, ['Head'], sides=6)
    # brow: a soft arch
    brow = [face_pt(s * lerp(0.024, 0.074, u), 0.04 + 0.014 * math.sin(math.pi * u) - 0.005 * u, 0.003)[0] for u in (i / 7 for i in range(8))]
    tube(f'brow_{s}', brow, lambda u: 0.0032 + 0.0022 * math.sin(math.pi * min(1.0, u * 1.15)), HAIR, ['Head'], sides=6)
    # cheek blush, ear
    pb, Mb = face_frame(s * 0.072, -0.042, -0.0055)
    sphere(f'blush_{s}', pb, 1.0, BLUSH, ['Head'], segs=10, rings=6, scale=(0.02, 0.008, 0.013), rot=Mb)
    sphere(f'ear_{s}', hc + Vector((s * A_ * 0.97, 0.008, -0.014)), 1.0, SKIN, ['Head'], segs=10, rings=6, scale=(0.013, 0.022, 0.03))
pn, Mn = face_frame(0, -0.034, -0.004)
sphere('nose', pn, 1.0, SKIN, ['Head'], segs=10, rings=6, scale=(0.0135, 0.011, 0.0115), rot=Mn)
smile = [face_pt(x, -0.069 + 0.0095 * (x / 0.024) ** 2, 0.0006)[0] for x in (lerp(-0.024, 0.024, i / 8) for i in range(9))]
tube('mouth', smile, lambda u: 0.0028 + 0.0012 * math.sin(math.pi * u), MOUTH, ['Head'], sides=6)
# hair: a cap over the top, sides and back; in front a fringe with soft points; below the hairline the cap sinks
# into the head, so its edge follows the line smoothly
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=26, v_segments=18, radius=1.0)
for v in bm.verts:
    u = v.co.normalized()
    f = -u.y
    az = math.atan2(u.x, -u.y)
    if f > 0:
        h = 0.02 + 0.46 * f ** 1.6 - 0.11 * abs(math.sin(az * 6.0 + 0.4)) * f ** 2
    else:
        h = 0.02 - 0.55 * min(1.0, -f * 1.3)
    k = 1.065 if u.z >= h else 0.9
    if u.z >= h and f > 0.45 and u.z < h + 0.14:
        k = 1.085
    v.co = Vector((u.x * A_ * k, u.y * B_ * k, u.z * C_ * k * (1.05 if u.z > 0 else 1.0)))
bmesh.ops.translate(bm, vec=hc + Vector((0, 0.003, 0)), verts=bm.verts)
obj_from_bm('hair', bm, HAIR, ['Head'])
# neck and the suit collar inside the bubble
capsule('neck', hc + Vector((0, 0.012, -0.1)), hc + Vector((0, 0.015, -0.17)), 0.047, SKIN, ['Head', 'Neck'], segs=12)
sphere('collar', hc + Vector((0, 0.012, -0.178)), 0.1, SUIT, ['Neck', 'Spine2'], segs=14, rings=7, scale=(1, 1, 0.42))

# ---------------------------------------------------------------- helmet
hel = hc + Vector((0, 0.01, -0.005))
R = 0.215
elev = lambda deg: Vector((0, -math.cos(math.radians(deg)), math.sin(math.radians(deg))))
OA, VA, OPEN = elev(4), elev(78), math.radians(66)
sphere('bubble', hel, R, GLASS, ['Head'], segs=22, rings=14)
# white shell everywhere but the face opening, a white rim round the opening, the gold visor over the top front
zone('shell', hel, OA, R * 1.035, OPEN, math.pi, SUIT, ['Head'], segs=28, rings=8)
ring('helmet_rim', hel + OA * (R * 1.035 * math.cos(OPEN)), OA, R * 1.035 * math.sin(OPEN), 0.012, SUIT, ['Head'], segs=36, tube=5)
zone('visor', hel, VA, R * 1.008, 0.0, math.radians(47), VISOR, ['Head'], segs=32, rings=8)
# headphone pucks with grey rims
for s in (1, -1):
    c = hel + Vector((s * (R + 0.012), -0.012, -0.012))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.058, radius2=0.052, depth=0.05,
                          matrix=Matrix.Rotation(s * math.pi / 2, 4, 'Y'))
    bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    obj_from_bm(f'ear_puck_{s}', bm, SUIT, ['Head'])
    ring(f'ear_puck_rim_{s}', c + Vector((s * 0.024, 0, 0)), (1, 0, 0), 0.05, 0.0075, GREY, ['Head'], segs=20, tube=4)
    sphere(f'ear_puck_cap_{s}', c + Vector((s * 0.026, 0, 0)), 0.04, LGREY, ['Head'], segs=12, rings=5, scale=(0.18, 1, 1))
# the collar ring under the helmet, a grey trim under it
ring('neck_ring', hel + Vector((0, 0, -R * 0.86)), (0, 0, 1), 0.128, 0.028, SUIT, ['Spine2', 'Neck'], segs=28, tube=6)
ring('neck_trim', hel + Vector((0, 0, -R * 0.86 - 0.03)), (0, 0, 1), 0.13, 0.011, LGREY, ['Spine2', 'Neck'], segs=24, tube=4)

# ---------------------------------------------------------------- export (and look)
meshes = [o for o in scene.objects if o.type == 'MESH']
count = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
tris = sum(count(o) for o in meshes)
print('KID parts', len(meshes), 'triangles', tris)
print('KID biggest', ', '.join(f'{o.name} {count(o)}' for o in sorted(meshes, key=count, reverse=True)[:16]))
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_extras=True, export_yup=True,
                          export_apply=True, export_animations=False, export_texcoords=False)
print('KID exported', OUT)

if RENDERS:
    import os
    os.makedirs(RENDERS, exist_ok=True)
    w = bpy.data.worlds.new('w')
    scene.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.045, 0.045, 0.05, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    for e, rz, en in ((55, 30, 3.0), (30, 200, 1.2)):
        L_ = bpy.data.lights.new('l', 'SUN')
        L_.energy = en
        lo = bpy.data.objects.new('l', L_)
        scene.collection.objects.link(lo)
        lo.rotation_euler = (math.radians(e), 0, math.radians(rz))
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.use_denoising = True
    cam = bpy.data.cameras.new('c')
    co = bpy.data.objects.new('c', cam)
    scene.collection.objects.link(co)
    scene.camera = co
    views = [(nm, ang, 4.2, 1.0, 60, 520, 760, 32) for nm, ang in (('front', 0), ('side34', 35), ('back', 180))]
    views += [('face', 0, 1.15, hel.z, 70, 420, 420, 24), ('face34', 35, 1.15, hel.z, 70, 420, 420, 24),
              ('feet', 25, 1.6, 0.25, 50, 520, 360, 24), ('hand', 20, 0.9, 1.3, 60, 420, 300, 24)]
    only = os.environ.get('KID_VIEWS')
    for nm, ang, dist, hz, lens, rx, ry, spp in views:
        if only and nm not in only.split(','):
            continue
        a = math.radians(ang)
        cam.lens = lens
        scene.cycles.samples = spp
        scene.render.resolution_x, scene.render.resolution_y = rx, ry
        co.location = (dist * math.sin(a), -dist * math.cos(a), hz)
        co.rotation_euler = (math.radians(89 if nm in ('front', 'side34', 'back') else 90), 0, a)
        if nm == 'hand':  # the left glove from the front, a little above
            tgt = head('LeftHand') + Vector((0.07, 0, 0))
            co.location = tgt + Vector((-0.12, -0.42, 0.22))
            co.rotation_euler = (tgt - co.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(RENDERS, f'kid_{nm}.png')
        bpy.ops.render.render(write_still=True)
    print('KID rendered')
