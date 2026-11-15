# The kid astronaut (15 Nov, the team's new player character, after a concept picture): built part by part on the
# game rig's rest pose (bones.json: joint positions from public/models/astronaut/astronaut.glb), so the game's rig and
# its 15 clips drive it unchanged. Each part carries the bones it follows (custom property "bones", exported as glTF
# extras); scripts/models/astronaut_kid.mjs skins it onto the rig. No text, logos or flags.
#   Blender -b --factory-startup -P build_kid.py -- bones.json out.glb [renders_dir]
import bpy, bmesh, json, math, sys
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
BONES = json.load(open(argv[0]))
OUT = argv[1]
RENDERS = argv[2] if len(argv) > 2 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def G(x, y, z):
    """glTF (x, y up, z front) -> Blender (x, -z, y): the exporter's +Y up turns it back."""
    return Vector((x, -z, y))


def head(b):
    return G(*BONES[b]['head'])


MATS = {}


def mat(name, rgb, rough=0.6, metal=0.0, alpha=1.0, emit=None):
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
    if emit:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = 1.0
    MATS[name] = m
    return m


# palette (linear RGB): the concept's white suit, orange-gold bands, gold visor, clear bubble
SUIT = mat('kid_suit', (0.86, 0.87, 0.86), 0.78)
GOLD = mat('kid_gold', (0.80, 0.42, 0.06), 0.35, 0.4)
VISOR = mat('kid_visor', (1.0, 0.68, 0.25), 0.18, 1.0)
GLASS = mat('kid_glass', (0.9, 0.95, 1.0), 0.04, 0.0, alpha=0.14)
SKIN = mat('kid_skin', (0.50, 0.25, 0.12), 0.55)
HAIR = mat('kid_hair', (0.018, 0.013, 0.010), 0.5)
EYE = mat('kid_eye', (0.92, 0.92, 0.90), 0.25)
IRIS = mat('kid_iris', (0.06, 0.028, 0.012), 0.2)
MOUTH = mat('kid_mouth', (0.30, 0.07, 0.05), 0.5)
BOOT = mat('kid_boot', (0.52, 0.52, 0.50), 0.92)
GREY = mat('kid_grey', (0.30, 0.32, 0.35), 0.55, 0.2)
DARK = mat('kid_dark', (0.03, 0.035, 0.045), 0.6)


def obj_from_bm(name, bm, material, bones, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth:
        for poly in me.polygons:
            poly.use_smooth = True
    o = bpy.data.objects.new(name, me)
    scene.collection.objects.link(o)
    me.materials.append(material)
    o['bones'] = ','.join(bones)
    return o


def sphere(name, c, r, material, bones, segs=20, rings=12, scale=(1, 1, 1), keep=None):
    """A (scaled) UV sphere at c (Blender coords); keep(v_local) -> bool drops the rest (partial shells)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    if keep:
        drop = [f for f in bm.faces if not all(keep(v.co) for v in f.verts)]
        bmesh.ops.delete(bm, geom=drop, context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    return obj_from_bm(name, bm, material, bones)


def capsule(name, a, b, r, material, bones, segs=16, r2=None):
    """A tapered capsule from a to b (radius r at a, r2 at b)."""
    r2 = r if r2 is None else r2
    bm = bmesh.new()
    d = b - a
    L = d.length
    rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    # body: a cone frustum along +Z, then the two end caps
    bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=segs, radius1=r, radius2=r2, depth=L,
                          matrix=Matrix.Translation((0, 0, L / 2)))
    for rr, z in ((r, 0.0), (r2, L)):
        s = bmesh.new()
        bmesh.ops.create_uvsphere(s, u_segments=segs, v_segments=8, radius=rr)
        bmesh.ops.translate(s, vec=Vector((0, 0, z)), verts=s.verts)
        tmp = bpy.data.meshes.new('tmp')
        s.to_mesh(tmp)
        s.free()
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(a) @ rot, verts=bm.verts)
    return obj_from_bm(name, bm, material, bones)


def rbox(name, c, size, bevel, material, bones, segs=2, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=bevel, segments=segs, affect='EDGES', profile=0.5)
    if rot:
        bmesh.ops.rotate(bm, cent=Vector(), matrix=rot, verts=bm.verts)
    bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    return obj_from_bm(name, bm, material, bones)


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


def band(name, c, axis, r, h, material, bones, segs=24):
    """A flat band round a limb at c: a short sleeve of radius r, height h, along `axis` (Blender coords)."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=segs, radius1=r, radius2=r, depth=h)
    rot = Vector(axis).normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ rot, verts=bm.verts)
    return obj_from_bm(name, bm, material, bones)


def tube(name, pts, r, material, bones, sides=10):
    """A hose through the points (Blender coords)."""
    bm = bmesh.new()
    rings_ = []
    for k, p in enumerate(pts):
        d = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
        q = d.to_track_quat('Z', 'Y').to_matrix()
        rings_.append([bm.verts.new(p + q @ Vector((r * math.cos(2 * math.pi * s / sides), r * math.sin(2 * math.pi * s / sides), 0))) for s in range(sides)])
    for k in range(len(rings_) - 1):
        for s in range(sides):
            bm.faces.new((rings_[k][s], rings_[k + 1][s], rings_[k + 1][(s + 1) % sides], rings_[k][(s + 1) % sides]))
    return obj_from_bm(name, bm, material, bones)


def bezier(a, b, c, n=12):
    return [a * (1 - t) ** 2 + b * 2 * t * (1 - t) + c * t * t for t in (i / (n - 1) for i in range(n))]


def lerp(a, b, t):
    return a + (b - a) * t


# ---------------------------------------------------------------- body
for s, L in ((1, 'Left'), (-1, 'Right')):
    up, knee, ankle, toe = head(f'{L}UpLeg'), head(f'{L}Leg'), head(f'{L}Foot'), head(f'{L}ToeBase')
    capsule(f'{L}_thigh', up, knee, 0.098, SUIT, [f'{L}UpLeg', f'{L}Leg'], r2=0.09)
    capsule(f'{L}_shin', knee, ankle + Vector((0, 0, 0.04)), 0.088, SUIT, [f'{L}Leg', f'{L}Foot'], r2=0.082)
    band(f'{L}_knee_band', lerp(up, knee, 0.84), knee - up, 0.0935, 0.035, GOLD, [f'{L}UpLeg', f'{L}Leg'])
    # chunky moon boot: from the ankle forward to the toe, a darker sole
    mid = (ankle + toe) / 2
    rbox(f'{L}_boot', Vector((mid.x, mid.y - 0.01, 0.075)), (0.15, 0.30, 0.15), 0.05, BOOT, [f'{L}Foot', f'{L}ToeBase'])
    rbox(f'{L}_sole', Vector((mid.x, mid.y - 0.01, 0.016)), (0.16, 0.31, 0.03), 0.012, GREY, [f'{L}Foot', f'{L}ToeBase'], segs=2)

    sh, el, wr, hand = head(f'{L}Arm'), head(f'{L}ForeArm'), head(f'{L}Hand'), head(f'{L}Hand')
    sphere(f'{L}_shoulder', lerp(head(f'{L}Shoulder'), sh, 0.75) + Vector((0, 0, -0.01)), 0.105, SUIT, ['Spine2', f'{L}Arm'])
    capsule(f'{L}_upperarm', sh, el, 0.08, SUIT, [f'{L}Arm', f'{L}ForeArm'], r2=0.072)
    band(f'{L}_arm_band', lerp(sh, el, 0.55), el - sh, 0.0775, 0.032, GOLD, [f'{L}Arm'])
    capsule(f'{L}_forearm', el, wr, 0.072, SUIT, [f'{L}ForeArm', f'{L}Hand'], r2=0.066)
    d = (wr - el).normalized()
    ring(f'{L}_cuff', wr - d * 0.005, d, 0.066, 0.016, GREY, [f'{L}Hand'])
    # glove: a mitt and a thumb
    palm = wr + d * 0.075
    rbox(f'{L}_glove', palm, (0.13, 0.055, 0.105), 0.025, SUIT, [f'{L}Hand'], rot=Matrix.Rotation(math.atan2(d.y, d.x), 4, 'Z').to_3x3())
    capsule(f'{L}_thumb', wr + d * 0.04 + Vector((0, -0.045, 0.0)), wr + d * 0.09 + Vector((0, -0.06, 0.02)), 0.02, SUIT, [f'{L}Hand'])

# pelvis, torso, waist ring
sphere('pelvis', G(0, 0.86, 0.04), 0.2, SUIT, ['Hips'], scale=(1.0, 0.78, 0.7))
sphere('torso', G(0, 1.17, 0.05), 0.24, SUIT, ['Spine', 'Spine1', 'Spine2'], scale=(0.95, 0.72, 1.18))
ring('waist', G(0, 0.98, 0.045), (0, 0, 1), 0.185, 0.022, GREY, ['Spine', 'Hips'])
# chest control box (no text), two hoses down to the waist
rbox('chest_box', G(0, 1.25, 0.225), (0.2, 0.06, 0.12), 0.015, SUIT, ['Spine2'])
rbox('chest_panel', G(0, 1.262, 0.256), (0.12, 0.012, 0.055), 0.005, GREY, ['Spine2'], segs=1)
for s in (1, -1):
    sphere(f'chest_knob_{s}', G(s * 0.07, 1.225, 0.258), 0.013, GREY, ['Spine2'], segs=12, rings=8)
    tube(f'hose_{s}', bezier(G(s * 0.09, 1.215, 0.23), G(s * 0.16, 1.16, 0.25), G(s * 0.14, 1.08, 0.2), 10), 0.012, GREY, ['Spine2', 'Spine1'])
# a plain dark patch on the left arm (no logo)
rbox('arm_patch', lerp(head('LeftArm'), head('LeftForeArm'), 0.3) + Vector((0, 0, 0.0)) + G(0, 0.0, 0.0) * 0 + Vector((0, -0.0, 0.08)),
     (0.05, 0.012, 0.05), 0.006, DARK, ['LeftArm'], segs=1)

# backpack: compact rounded, a raised square on the back
rbox('pack', G(0, 1.2, -0.215), (0.36, 0.17, 0.46), 0.06, SUIT, ['Spine2'])
rbox('pack_panel', G(0, 1.17, -0.303), (0.15, 0.02, 0.15), 0.02, SUIT, ['Spine2'])

# ---------------------------------------------------------------- head (a kid's face in the bubble)
H = head('Head')
hc = H + G(0, 0.075, 0.02) - G(0, 0, 0)
FACE = 0.132
sphere('head', hc, FACE, SKIN, ['Head'], scale=(0.95, 0.95, 1.06))
fz = -(FACE * 0.95)  # the face looks to Blender −Y
for s in (1, -1):
    eye = hc + Vector((s * 0.042, fz * 0.86, 0.012))
    sphere(f'eye_{s}', eye, 0.027, EYE, ['Head'], segs=16, rings=10, scale=(1, 0.6, 1.15))
    sphere(f'iris_{s}', eye + Vector((0, -0.0135, -0.002)), 0.0175, IRIS, ['Head'], segs=14, rings=8, scale=(1, 0.5, 1.12))
    sphere(f'glint_{s}', eye + Vector((s * -0.006, -0.021, 0.009)), 0.005, EYE, ['Head'], segs=8, rings=6)
    capsule(f'brow_{s}', eye + Vector((s * -0.018, 0.004, 0.03)), eye + Vector((s * 0.02, 0.006, 0.032)), 0.0055, HAIR, ['Head'], segs=8)
    sphere(f'ear_{s}', hc + Vector((s * FACE * 0.93, 0.0, -0.005)), 0.026, SKIN, ['Head'], segs=12, rings=8, scale=(0.5, 1, 1.2))
sphere('nose', hc + Vector((0, fz * 1.0, -0.018)), 0.016, SKIN, ['Head'], segs=12, rings=8, scale=(0.9, 0.7, 1))
capsule('mouth', hc + Vector((-0.022, fz * 0.92, -0.05)), hc + Vector((0.022, fz * 0.92, -0.05)), 0.005, MOUTH, ['Head'], segs=8)
# hair: a cap over the top and back, a fringe over the forehead
sphere('hair', hc + Vector((0, 0.008, 0.012)), FACE * 1.05, HAIR, ['Head'], keep=lambda v: v.z > -0.01 + 0.06 * max(0.0, -v.y / FACE) or v.y > 0.02)
sphere('fringe', hc + Vector((0.0, fz * 0.8, 0.06)), 0.05, HAIR, ['Head'], segs=16, rings=10, scale=(1.6, 0.55, 0.5))

# helmet: clear bubble, gold visor over the top front, white shell at the back, ear pucks, neck ring
hel = hc + Vector((0, 0.01, -0.005))
R = 0.215
sphere('bubble', hel, R, GLASS, ['Head'], segs=24, rings=16)
sphere('visor', hel, R * 1.012, VISOR, ['Head'], segs=24, rings=16, keep=lambda v: v.z > 0.045 and v.y < 0.03)
sphere('shell', hel, R * 1.02, SUIT, ['Head'], segs=24, rings=16, keep=lambda v: v.y > 0.02 or v.z < -0.15)
for s in (1, -1):
    c = hel + Vector((s * R * 0.98, 0.0, 0.0))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=0.05, radius2=0.044, depth=0.04,
                          matrix=Matrix.Rotation(math.pi / 2, 4, 'Y'))
    bmesh.ops.translate(bm, vec=c, verts=bm.verts)
    obj_from_bm(f'ear_puck_{s}', bm, SUIT, ['Head'])
ring('neck_ring', hel + Vector((0, 0, -R * 0.86)), (0, 0, 1), 0.125, 0.03, SUIT, ['Spine2', 'Neck'])

# ---------------------------------------------------------------- export (and look)
meshes = [o for o in scene.objects if o.type == 'MESH']
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
print('KID parts', len(meshes), 'triangles', tris)
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
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 520
    scene.render.resolution_y = 760
    cam = bpy.data.cameras.new('c')
    cam.lens = 60
    co = bpy.data.objects.new('c', cam)
    scene.collection.objects.link(co)
    scene.camera = co
    for nm, ang in (('front', 0), ('side34', 35), ('back', 180)):
        a = math.radians(ang)
        co.location = (4.2 * math.sin(a), -4.2 * math.cos(a), 1.0)
        co.rotation_euler = (math.radians(89), 0, a)
        scene.render.filepath = os.path.join(RENDERS, f'kid_{nm}.png')
        bpy.ops.render.render(write_still=True)
    print('KID rendered')
