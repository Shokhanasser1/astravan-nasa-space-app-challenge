"""HOME BY SEVEN - habitat entrance (airlock + two hatches) and full two-deck interior.

Rebuild:  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P build_habitat.py
Writes:   habitat_interior.blend, habitat_interior.glb, walk.json, fit_check.json, stats.json (next to this file).

Frame: ASTRA native metres, ASTRA model frame. three (x, y, z) -> Blender (x, -z, y). ASTRA front (three +z) = Blender -Y.
A compass bearing b (ASTRA sim/home.ts polar()) is the Blender direction (sin b, cos b): 0 = north = +Y, 180 = door = -Y.
Every size that comes from NASA is marked  # NASA: <source key>  (keys are explained in SOURCES.md).
"""
import bpy, bmesh, math, json, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.normpath(os.path.join(HERE, '..', 'ref', 'habitat_shell.blend'))
IN = 0.0254

# ---------------------------------------------------------------- ASTRA HOME numbers (sim/home.ts, habitat.ts)
LINING, CORE, SHELTER, COMMAND, HALL, WALL = 4.95, 1.9, 1.5, 1.75, 2.95, 0.12
F0, F1 = 0.5, 3.35          # deck floors
C0, C1 = 3.1, 5.95          # ceilings
WINDOWS = [(0, 228, .95, .62), (0, 268, .95, .62), (0, 46, .95, .62), (0, 80, .7, .5),
           (1, 227.5, .8, .55), (1, 272.5, .8, .55), (1, 317.5, .8, .55), (1, 2.5, .8, .55),
           (1, 45, .95, .62), (1, 78, .95, .62)]
FLOORS = (F0, F1)
RIN = LINING - 0.03         # inner face of our lining skin
RMAX = RIN - 0.02           # furniture never goes past this radius

# ---------------------------------------------------------------- NASA numbers
HATCH_W = 40 * IN           # NASA: CH-hatch  40 in wide
HATCH_H = 60 * IN           # NASA: CH-hatch  60 in tall
STEP_OVER = 16 * IN         # NASA: CH-hatch  16 in step-over (sill above floor)
RACK_W, RACK_D, RACK_H = 41.3 * IN, 33.8 * IN, 79.3 * IN   # NASA: CH-ISPR
GUARD_H = 42 * IN           # NASA: VTS  42 in safety barrier round the deck opening
WELL_W, WELL_L = 40 * IN, 60 * IN   # NASA: VTS  40 x 60 in vertical passage
DOOR_W = HATCH_W            # inner doorways as wide as the hatch (CH-hatch: passes ISPR racks)
DOOR_H = 2.05               # plain: deck height minus a lintel (no NASA value for gravity doors)
SILL = F0 + STEP_OVER
HC = SILL + HATCH_H / 2     # hatch centre height
OPEN_DEG = 100.0

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 30
COL = bpy.data.collections.new('habitat_interior')
scene.collection.children.link(COL)


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


MAT = {}


def mat(name, hexcol, rough=0.7, metal=0.0, emit=None, strength=0.0, double=False):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b is None:
        b = nt.nodes.new('ShaderNodeBsdfPrincipled')
        out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL'), None) or nt.nodes.new('ShaderNodeOutputMaterial')
        nt.links.new(b.outputs[0], out.inputs[0])
    b.inputs['Base Color'].default_value = (*srgb(hexcol), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*srgb(emit), 1)
        b.inputs['Emission Strength'].default_value = strength
    m.diffuse_color = (*srgb(hexcol), 1)
    m.use_backface_culling = not double
    MAT[name] = m
    return m


# 13 materials (SPEC: <= 14). Colours: ASTRA common.ts C + NASA photos (see SOURCES.md).
mat('int_wall', '#e8ecf2', 0.85, double=True)      # ASTRA white; padded white walls (iss054e022260)
mat('int_panel', '#d3d9e2', 0.6)                    # ASTRA off; rack/locker faces (iss028e007685)
mat('int_floor', '#a9b2c0', 0.8)                    # ASTRA grey
mat('int_steel', '#8b94a3', 0.4, 0.6)               # ASTRA steel; rack frames, hatch rings (KSC-08pd3209)
mat('int_dark', '#2a3140', 0.6)                     # ASTRA dark; seals (KSC-20190325-PH_KLS01_0082), screens off
mat('int_orange', '#ff8a3d', 0.5)                   # ASTRA orange; handles, guard rail
mat('int_blue', '#2f6fd6', 0.45)                    # ASTRA blue; handrails as on ISS (iss028e007685, iss071e666858)
mat('int_water', '#6fb0ee', 0.25)                   # water-wall bags (light blue: reads as water; no NASA colour)
mat('int_bag', '#ece6d8', 0.9)                      # cargo transfer bags, off-white Nomex (iss034e009690)
mat('int_green', '#7fa86a', 0.8)                    # sleeping bag green (iss054e022260)
mat('glow_lamp', '#fff4e0', 0.5, emit='#fff1d6', strength=4.0)
mat('glow_screen', '#9fd8ff', 0.4, emit='#8fd0ff', strength=2.5)
mat('glow_status', '#3ee39a', 0.4, emit='#3ee39a', strength=3.0)


def empty(name, parent=None, loc=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = 0.3
    o.location = loc
    COL.objects.link(o)
    if parent:
        o.parent = parent
    return o


ROOT = empty('habitat_interior')
FURN = empty('habitat_furniture', ROOT)
GLOW = empty('habitat_glow', ROOT)

FOOT = []   # walk.json


def T(b):   # tangent (local +X) at bearing b
    a = math.radians(b)
    return Vector((math.cos(a), -math.sin(a), 0))


def R(b):   # outward radial (local +Y) at bearing b
    a = math.radians(b)
    return Vector((math.sin(a), math.cos(a), 0))


def obj(name, bm, mname, loc=(0, 0, 0), rotz=0.0, parent=None, bevel=0.0, level=None, tags=()):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    COL.objects.link(o)
    me.materials.append(MAT[mname])
    o.location = loc
    o.rotation_euler.z = rotz
    if parent is None:
        parent = GLOW if mname.startswith('glow_') else FURN
    o.parent = parent
    if bevel > 0:
        m = o.modifiers.new('bevel', 'BEVEL')
        m.width = bevel
        m.segments = 1
        m.limit_method = 'ANGLE'
    if level is None:
        level = ('u' if loc[2] >= C0 + 0.05 else 'g') + ('L' if mname == 'glow_lamp' else '')
    o['level'] = level
    for t in tags:
        o[t] = 1
    return o


def bm_box(sx, sy, sz):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= sx
        v.co.y *= sy
        v.co.z = (v.co.z + 0.5) * sz
    return bm


def foot(name, x, y, hx, hy, rotz, z0=0.5):
    # Blender (x, y) -> three (x, z = -y); yaw about three +y equals Blender rot z. floor: 0 ground, 1 upper deck.
    FOOT.append({'name': name, 'x': round(x, 3), 'z': round(-y, 3), 'hx': round(hx, 3), 'hz': round(hy, 3),
                 'yaw': round(rotz, 4), 'floor': 1 if z0 >= C0 - 0.01 else 0})


def rbox(name, sx, sy, sz, mname, b, r, z0, t=0.0, yaw=0.0, bevel=0.0, walk=True, **kw):
    """Box in the radial frame of bearing b: sx along the tangent, sy along the radius, sz up from z0."""
    p = R(b) * r + T(b) * t
    rz = -math.radians(b) + yaw
    o = obj(name, bm_box(sx, sy, sz), mname, (p.x, p.y, z0), rz, bevel=bevel, **kw)
    if walk:
        foot(name, p.x, p.y, sx / 2, sy / 2, rz, z0)
    return o


def xbox(name, sx, sy, sz, mname, x, y, z0, rotz=0.0, bevel=0.0, walk=True, **kw):
    o = obj(name, bm_box(sx, sy, sz), mname, (x, y, z0), rotz, bevel=bevel, **kw)
    if walk:
        foot(name, x, y, sx / 2, sy / 2, rotz, z0)
    return o


def bm_cyl(r, h, seg=16, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
    for v in bm.verts:
        v.co.z += h / 2
    return bm


def cyl(name, r, h, mname, x, y, z0, seg=16, rotx=0.0, roty=0.0, rotz=0.0, walk=False, **kw):
    o = obj(name, bm_cyl(r, h, seg), mname, (x, y, z0), rotz, **kw)
    o.rotation_euler.x, o.rotation_euler.y = rotx, roty
    return o


def bm_arc(r0, r1, b0, b1, z0, z1, seg=None):
    if seg is None:
        seg = max(2, int(abs(b1 - b0) / 4))
    bm = bmesh.new()
    rows = []
    for i in range(seg + 1):
        a = math.radians(b0 + (b1 - b0) * i / seg)
        s, c = math.sin(a), math.cos(a)
        rows.append([bm.verts.new((s * r, c * r, z)) for r, z in ((r0, z0), (r1, z0), (r1, z1), (r0, z1))])
    for i in range(seg):
        A, B = rows[i], rows[i + 1]
        for k in range(4):
            bm.faces.new((A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]))
    bm.faces.new(rows[0])
    bm.faces.new(rows[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def arc(name, r0, r1, b0, b1, z0, z1, mname, seg=None, walk=True, mesh=True, **kw):
    o = None
    if mesh:
        o = obj(name, bm_arc(r0, r1, b0, b1, z0, z1, seg), mname, (0, 0, 0), 0.0, **kw)
        if kw.get('level') is None:
            o['level'] = ('u' if z0 >= C0 + 0.05 else 'g') + ('L' if mname == 'glow_lamp' else '')
    if walk:   # chord boxes every ~12 degrees
        n = max(1, int(abs(b1 - b0) / 12 + 0.999))
        for i in range(n):
            a0 = b0 + (b1 - b0) * i / n
            a1 = b0 + (b1 - b0) * (i + 1) / n
            am = (a0 + a1) / 2
            rm = (r0 + r1) / 2
            p = R(am) * rm
            half = rm * math.sin(math.radians(abs(a1 - a0) / 2)) + 0.02
            foot(f'{name}.{i}', p.x, p.y, half, (r1 - r0) / 2, -math.radians(am), z0)
    return o


def rr_pts(w, h, rad, n=4):
    rad = max(0.001, min(rad, w / 2 - 1e-3, h / 2 - 1e-3))
    pts = []
    for cx, cz, a0 in ((w / 2 - rad, h / 2 - rad, 0), (-(w / 2 - rad), h / 2 - rad, 90),
                       (-(w / 2 - rad), -(h / 2 - rad), 180), (w / 2 - rad, -(h / 2 - rad), 270)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx + rad * math.cos(a), cz + rad * math.sin(a)))
    return pts


def bm_rr_slab(w, h, rad, y0, y1, n=4):
    """Rounded rectangle in the local XZ plane, extruded along local Y from y0 to y1."""
    bm = bmesh.new()
    P = rr_pts(w, h, rad, n)
    f = [bm.verts.new((x, y0, z)) for x, z in P]
    b = [bm.verts.new((x, y1, z)) for x, z in P]
    bm.faces.new(f)
    bm.faces.new(b[::-1])
    for i in range(len(P)):
        j = (i + 1) % len(P)
        bm.faces.new((f[i], f[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_rr_ring(wi, hi, ri, wo, ho, ro, y0, y1, n=4):
    """Rounded-rectangle frame (a tube with a rounded-rect hole), extruded along local Y."""
    bm = bmesh.new()
    Pi, Po = rr_pts(wi, hi, ri, n), rr_pts(wo, ho, ro, n)
    L = [[bm.verts.new((x, y, z)) for x, z in P] for P in (Pi, Po) for y in (y0, y1)]
    i0, i1, o0, o1 = L
    m = len(Pi)
    for k in range(m):
        j = (k + 1) % m
        bm.faces.new((i0[k], i0[j], o0[j], o0[k]))
        bm.faces.new((i1[k], o1[k], o1[j], i1[j]))
        bm.faces.new((i0[k], i1[k], i1[j], i0[j]))
        bm.faces.new((o0[k], o0[j], o1[j], o1[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bake(o):
    """Apply modifiers + transform relative to the root into the mesh data; return the object."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    old = o.data
    o.modifiers.clear()
    o.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)
    return o


def boolean_cut(target, cutters):
    """Difference with a set of cutter objects (joined into one), applied, cutters deleted."""
    # New objects keep an identity matrix_world until the depsgraph runs: update first, or every cutter lands at
    # the origin (this left the ground-floor hatch hole, ground windows, inner hatch and ladder well uncut).
    bpy.context.view_layer.update()
    bm = bmesh.new()
    for c in cutters:
        tmp = bmesh.new()
        tmp.from_mesh(c.data)
        tmp.transform(c.matrix_world)
        me = bpy.data.meshes.new('tmp')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    me = bpy.data.meshes.new('cutter')
    bm.to_mesh(me)
    bm.free()
    cut = bpy.data.objects.new('cutter', me)
    COL.objects.link(cut)
    for c in cutters:
        bpy.data.objects.remove(c)
    bpy.context.view_layer.update()
    m = target.modifiers.new('cut', 'BOOLEAN')
    m.operation = 'DIFFERENCE'
    m.object = cut
    for solver in ('EXACT', 'MANIFOLD'):
        try:
            m.solver = solver
            break
        except TypeError:
            continue
    bake(target)
    bpy.data.objects.remove(cut)
    return target


def radial_obj(name, bm, mname, b, zc, t=0.0, **kw):
    """Mesh built with local X = tangent, local Y = radius, local Z = height above zc; turned to bearing b."""
    if t:
        bmesh.ops.translate(bm, verts=bm.verts, vec=(t, 0, 0))
    return obj(name, bm, mname, (0, 0, zc), -math.radians(b), **kw)


# =============================================================== STRUCTURE: lining, decks, ceilings
def lining(name, z0, z1, level):
    bm = bmesh.new()
    seg = 128
    ring = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        s, c = math.sin(a), math.cos(a)
        ring.append([bm.verts.new((s * r, c * r, z)) for r, z in ((RIN, z0), (LINING, z0), (LINING, z1), (RIN, z1))])
    for i in range(seg):
        A, B = ring[i], ring[(i + 1) % seg]
        for k in range(4):
            bm.faces.new((A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return obj(name, bm, 'int_wall', (0, 0, 0), 0, level=level)


lin_g = lining('lining_ground', F0 - 0.05, C0 + 0.12, 'g')
lin_u = lining('lining_upper', C0 + 0.12, C1 + 0.05, 'u')

# openings in the lining: windows (ASTRA WINDOWS list) and the outer hatch (link opening, bearing 180)
cut_g, cut_u = [], []
for lvl, b, w, h in WINDOWS:
    zc = FLOORS[lvl] + 1.4
    c = radial_obj(f'cut_w{b}', bm_rr_slab(w + 0.10, h + 0.10, min(w, h) * 0.3 + 0.05, RIN - 0.15, LINING + 0.2), 'int_wall', b, zc)
    (cut_u if lvl else cut_g).append(c)
    # window reveal: a rounded tube from the lining out towards the shell's own window hole
    radial_obj(f'reveal_w{b}', bm_rr_ring(w, h, min(w, h) * 0.28, w + 0.10, h + 0.10, min(w, h) * 0.3 + 0.05,
                                          RIN - 0.03, 5.13), 'int_panel', b, zc, level='u' if lvl else 'g', tags=('opening_part',))
cut_g.append(radial_obj('cut_hatch', bm_rr_slab(HATCH_W + 0.24, HATCH_H + 0.24, 0.30, RIN - 0.2, LINING + 0.3), 'int_wall', 180, HC))
boolean_cut(lin_g, cut_g)
boolean_cut(lin_u, cut_u)


def disc(name, r, z0, z1, mname, level, seg=96):
    return obj(name, bm_cyl(r, z1 - z0, seg), mname, (0, 0, z0), 0, level=level)


disc('deck_ground', RMAX, F0 - 0.05, F0, 'int_floor', 'g')
mid_floor = disc('deck_upper', RMAX, C0 + 0.02, F1, 'int_floor', 'm')
mid_ceil = disc('ceiling_ground', RMAX, C0, C0 + 0.02, 'int_wall', 'm')
disc('ceiling_upper', RMAX, C1, C1 + 0.04, 'int_wall', 'c')
# the ladder well through the middle deck (inside the core: shelter below, command room above)
WELL_C = Vector((0.0, -0.62, 0))          # well centre (Blender XY); long side along X
for target in (mid_floor, mid_ceil):
    c = xbox('cut_well', WELL_L, WELL_W, 0.6, 'int_wall', WELL_C.x, WELL_C.y, C0 - 0.2, walk=False)
    boolean_cut(target, [c])

# =============================================================== ENTRANCE: airlock vestibule + two hatches
AL_X = 1.15                               # airlock inner half-width (fit to the link opening, half-width 2.0)
AL_IN = -HALL                             # airlock inner wall line (Blender Y)
AL_OUT = -math.sqrt((RIN - 0.01) ** 2 - (AL_X + WALL) ** 2)
# NASA: EVA-access  lunar habitat airlock floor ~4.7 m2  -> here 2.30 x ~1.85 = ~4.3 m2 (fit to shell)
for sx in (-1, 1):
    xbox(f'airlock_side_{sx:+d}', WALL, abs(AL_OUT - AL_IN) + WALL, C0 - F0, 'int_wall',
         sx * (AL_X + WALL / 2), (AL_OUT + AL_IN) / 2 - WALL / 2 + 0.06, F0)
inner_wall = xbox('airlock_inner_wall', 2 * (AL_X + WALL), WALL, C0 - F0, 'int_wall', 0, AL_IN, F0, walk=False)
for sx in (-1, 1):   # walk.json: the wall either side of the inner hatch (the hatch itself stays open for walking)
    a, b_ = HATCH_W / 2, AL_X + WALL
    foot(f'airlock_inner_wall{sx:+d}', sx * (a + b_) / 2, AL_IN, (b_ - a) / 2, WALL / 2, 0.0)
c = obj('cut_inner_hatch', bm_rr_slab(HATCH_W + 0.2, HATCH_H + 0.2, 0.28, -0.3, 0.3), 'int_wall', (0, AL_IN, HC), 0)
boolean_cut(inner_wall, [c])
# grated floor (HDU porch/airlock dust mitigation: grating lets dust fall through)  # NASA: HDU-porch
xbox('airlock_mat', 2 * AL_X - 0.04, abs(AL_OUT - AL_IN) - 0.12, 0.012, 'int_dark', 0, (AL_OUT + AL_IN) / 2, F0, walk=False)
for i in range(9):
    y = AL_IN - 0.18 - i * 0.19
    if y < AL_OUT + 0.1:
        break
    xbox(f'airlock_slat{i}', 2 * AL_X - 0.1, 0.05, 0.03, 'int_steel', 0, y, F0, walk=False)
# blue handrails on both side walls (ISS handrails are blue, photos iss028e007685 / iss071e666858)
for sx in (-1, 1):
    xbox(f'airlock_rail_{sx:+d}', 0.04, 1.3, 0.04, 'int_blue', sx * (AL_X - 0.07), (AL_OUT + AL_IN) / 2, F0 + 1.05, walk=False)
    for yy in (-0.6, 0.6):
        xbox(f'airlock_rail_post_{sx:+d}{yy}', 0.06, 0.03, 0.03, 'int_blue', sx * (AL_X - 0.035), (AL_OUT + AL_IN) / 2 + yy, F0 + 1.055, walk=False)
xbox('airlock_lamp', 1.0, 0.25, 0.03, 'glow_lamp', 0, (AL_OUT + AL_IN) / 2, C0 - 0.03, walk=False)

# --- outer hatch frame: a rounded tube through lining + shell, and a collar plate 1-2 cm proud of the shell
HOLE_W, HOLE_H, HOLE_R = HATCH_W, HATCH_H, 0.22
radial_obj('hatch_outer_frame', bm_rr_ring(HOLE_W, HOLE_H, HOLE_R, HOLE_W + 0.24, HOLE_H + 0.24, HOLE_R + 0.12,
                                           LINING - 0.09, 5.31), 'int_steel', 180, HC, level='g', tags=('door_part',))
radial_obj('hatch_outer_plate', bm_rr_ring(HOLE_W + 0.2, HOLE_H + 0.2, HOLE_R + 0.1, HOLE_W + 0.62, HOLE_H + 0.56, 0.42,
                                           5.30, 5.34), 'int_panel', 180, HC, level='g', tags=('door_part',))
radial_obj('hatch_outer_seal', bm_rr_ring(HOLE_W - 0.03, HOLE_H - 0.03, HOLE_R - 0.02, HOLE_W + 0.03, HOLE_H + 0.03, HOLE_R + 0.02,
                                          LINING - 0.115, LINING - 0.09), 'int_dark', 180, HC, level='g', tags=('door_part',))
# lights: one over the hatch outside, one inside; a green status lamp beside each hatch
radial_obj('hatch_outer_lamp', bm_rr_slab(0.5, 0.07, 0.03, 5.33, 5.40), 'glow_lamp', 180, SILL + HATCH_H + 0.21, level='g', tags=('door_part',))
radial_obj('hatch_outer_status', bm_rr_slab(0.09, 0.09, 0.04, 5.33, 5.37), 'glow_status', 180, HC + 0.25,
           t=HOLE_W / 2 + 0.38, level='g', tags=('door_part',))
xbox('hatch_inner_status_in', 0.09, 0.03, 0.09, 'glow_status', AL_X - 0.35, AL_OUT + 0.08, HC + 0.6, walk=False)
# EVA porch outside: grated landing + steps down (NASA: HDU-porch  deck + ramp with grating)
for i, (zt, d) in enumerate(((F0 - 0.04, 0.75), (0.24, 0.35))):
    y0 = -5.36 - (0.0 if i == 0 else 0.75)
    xbox(f'porch_{i}', 1.5, d, 0.05, 'int_steel', 0, y0 - d / 2, zt - 0.05, walk=False, tags=('door_part',))
    for k in range(5):
        xbox(f'porch_{i}_grate{k}', 1.44, 0.03, 0.012, 'int_dark', 0, y0 - 0.06 - k * (d - 0.1) / 4, zt, walk=False, tags=('door_part',))
    for sx in (-1, 1):
        xbox(f'porch_{i}_leg{sx:+d}', 0.06, 0.06, zt - 0.05, 'int_steel', sx * 0.7, y0 - d + 0.05, 0.0, walk=False, tags=('door_part',))
# porch and steps are walked on, so they are not hitboxes in walk.json (HANDOFF lists them as walk-on parts)
# deployable intermediate steps each side of both hatches  # NASA: CH-hatch
xbox('step_outer_in', 0.8, 0.32, F0 + 0.2 - F0, 'int_panel', 0, AL_OUT + 0.30, F0, bevel=0.01, walk=False)
for side, yy in (('al', AL_IN - 0.26), ('hall', AL_IN + 0.26)):
    xbox(f'step_inner_{side}', 0.8, 0.30, 0.2, 'int_panel', 0, yy, F0, bevel=0.01, walk=False)
# inner hatch frame through the airlock wall
obj('hatch_inner_frame', bm_rr_ring(HOLE_W, HOLE_H, HOLE_R, HOLE_W + 0.2, HOLE_H + 0.2, HOLE_R + 0.1, -0.1, 0.1),
    'int_steel', (0, AL_IN, HC), 0, level='g')
obj('hatch_inner_seal', bm_rr_ring(HOLE_W - 0.03, HOLE_H - 0.03, HOLE_R - 0.02, HOLE_W + 0.03, HOLE_H + 0.03, HOLE_R + 0.02,
                                   -0.125, -0.1), 'int_dark', (0, AL_IN, HC), 0, level='g')
xbox('airlock_lamp_hall', 0.5, 0.07, 0.07, 'glow_lamp', 0, AL_IN + 0.09, SILL + HATCH_H + 0.18, walk=False)
xbox('airlock_status_hall', 0.09, 0.03, 0.09, 'glow_status', HOLE_W / 2 + 0.3, AL_IN + 0.075, HC + 0.25, walk=False)


def hatch_leaf(pivot, sign, face):
    """Leaf hung from its pivot (hinge line). sign: leaf runs along +X (+1) or -X (-1) from the hinge.
    face: the leaf body lies on the +Y (+1) or -Y (-1) side of the hinge line."""
    lw, lh = HATCH_W + 0.12, HATCH_H + 0.12
    cx = sign * lw / 2
    y0, y1 = (0.0, 0.07) if face > 0 else (-0.07, 0.0)
    parts = [obj(pivot.name + '_leaf', bm_rr_slab(lw, lh, HOLE_R + 0.05, y0, y1), 'int_panel', (cx, 0, 0), 0, parent=pivot, level='g')]
    for k, (a0, a1) in enumerate(((y1, y1 + 0.015), (y0 - 0.015, y0))):   # steel rim on both faces
        parts.append(obj(f'{pivot.name}_rim{k}', bm_rr_ring(lw - 0.30, lh - 0.30, HOLE_R - 0.08, lw - 0.20, lh - 0.20, HOLE_R - 0.03, a0, a1),
                         'int_steel', (cx, 0, 0), 0, parent=pivot, level='g'))
    hx = sign * (lw - 0.17)
    for k, (yb, d) in enumerate(((y1, 1), (y0, -1))):   # orange handles on both faces, on the free edge
        parts.append(obj(f'{pivot.name}_handle{k}', bm_box(0.05, 0.04, 0.42), 'int_orange', (hx, yb + d * 0.055, -0.21), 0, parent=pivot, level='g'))
        for zz in (-0.2, 0.17):
            parts.append(obj(f'{pivot.name}_handle{k}_post{zz}', bm_box(0.035, 0.05, 0.035), 'int_orange',
                             (hx, yb + d * 0.025, zz), 0, parent=pivot, level='g'))
    for zz in (-lh / 2 + 0.2, lh / 2 - 0.32):   # hinge knuckles
        parts.append(obj(f'{pivot.name}_hinge{zz:.2f}', bm_cyl(0.035, 0.12, 10), 'int_steel', (0, (y0 + y1) / 2, zz), 0, parent=pivot, level='g'))
    for p in parts:
        p['door_part'] = 1
    return parts


# outer hatch: hinge on the -X side, leaf just inside the frame's seal, swings into the airlock (+Y)
OUT_SEAL = LINING - 0.115                       # radial position of the frame's inner seal face
door = empty('habitat_door', ROOT, (-(HATCH_W / 2 + 0.06), -(OUT_SEAL - 0.07), HC))
door['door_part'] = 1
hatch_leaf(door, +1, -1)
# inner hatch: hinge on the +X side, leaf on the airlock face of the wall, swings into the airlock (-Y)
door_in = empty('habitat_door_inner', ROOT, (HATCH_W / 2 + 0.06, AL_IN - 0.125 - 0.07, HC))
door_in['door_part'] = 1
hatch_leaf(door_in, -1, +1)


def keys(pivot, deg, track_names):
    pivot.rotation_euler.z = 0
    pivot.keyframe_insert('rotation_euler', index=2, frame=1)
    pivot.rotation_euler.z = math.radians(deg)
    pivot.keyframe_insert('rotation_euler', index=2, frame=30)
    act = pivot.animation_data.action
    act.name = pivot.name + '_open'
    ad = pivot.animation_data
    for tn in track_names:
        tr = ad.nla_tracks.new()
        tr.name = tn
        st = tr.strips.new(tn, 1, act)
        st.name = tn
    ad.action = None
    pivot.rotation_euler.z = 0


# outer leaf swings +Y (into the airlock): positive rotation about Z; inner leaf swings -Y: positive too (leaf runs -X)
keys(door, OPEN_DEG, ['DoorOpen', 'DoorOpenOuter'])
keys(door_in, OPEN_DEG, ['DoorOpen', 'DoorOpenInner'])

# =============================================================== GROUND FLOOR
# --- storm shelter: water walls in the core, inner face r 1.5, outer r 1.9 (ASTRA HOME.shelter / core)
# NASA: RadWorks  shelter in the middle of the habitat, walls of water bags + cargo transfer bags (logistics)
DOOR_HALF = math.degrees((0.9 / 2) / ((SHELTER + CORE) / 2))
course_h, gap, n = 0.3, 0.02, 16
for k in range(8):
    z = F0 + k * (course_h + gap)
    if z + course_h > C0 - 0.02:
        break
    for i in range(n):
        bc = (i + 0.5 * (k % 2)) * 360 / n
        a0, a1 = bc - 180 / n, bc + 180 / n
        if z < F0 + 1.9:   # below the lintel: keep the doorway (180 +- DOOR_HALF) clear, trim bags that overlap it
            d0, d1 = 180 - DOOR_HALF, 180 + DOOR_HALF
            for off in (0, 360, -360):
                lo, hi = a0 + off, a1 + off
                if lo >= d0 and hi <= d1:
                    a0 = None
                    break
                if lo < d1 and hi > d1:
                    a0, a1 = d1 - off + 0.6, a1
                if lo < d0 and hi > d0:
                    a0, a1 = a0, d0 - off - 0.6
            if a0 is None or a1 - a0 < 4:
                continue
        bc, span = (a0 + a1) / 2, a1 - a0
        mname = 'int_water' if k < 5 else 'int_bag'
        L = 2 * 1.7 * math.sin(math.radians(span / 2)) - 0.04
        rbox(f'shelter_bag_{k}_{i}', L, CORE - SHELTER - 0.04, course_h, mname, bc, 1.7, z, bevel=0.06, walk=False)
for a0, a1 in ((180 + DOOR_HALF, 360), (0, 180 - DOOR_HALF)):
    arc('shelter_wall', SHELTER, CORE, a0, a1, F0, F0 + 0.01, 'int_floor', walk=True, mesh=False)
for sx in (-1, 1):
    b = 180 + sx * DOOR_HALF
    rbox(f'shelter_post{sx:+d}', 0.08, CORE - SHELTER, F0 + 1.92 - F0, 'int_steel', b, 1.7, F0, t=-sx * 0.04, walk=False)
arc('shelter_lintel', SHELTER, CORE, 180 - DOOR_HALF - 2, 180 + DOOR_HALF + 2, F0 + 1.88, F0 + 1.92, 'int_steel', walk=False)
# bench round the north half inside the shelter (crew sit out a storm here)
arc('shelter_bench', 1.02, SHELTER - 0.03, 285, 435, F0, F0 + 0.42, 'int_panel', walk=True)
arc('shelter_bench_pad', 1.04, SHELTER - 0.05, 286, 434, F0 + 0.42, F0 + 0.47, 'int_blue', walk=False)
arc('shelter_lamp', 1.25, 1.4, 300, 420, C0 - 0.04, C0 - 0.01, 'glow_lamp', walk=False)

# --- ladder from the shelter up through the well into the command room  # NASA: VTS, HDU
LAD_Y = WELL_C.y + WELL_W / 2 - 0.10
for sx in (-1, 1):
    xbox(f'ladder_rail{sx:+d}', 0.05, 0.05, F1 + 1.0 - F0, 'int_steel', sx * 0.24, LAD_Y, F0, walk=False, level='g')
for i in range(int((F1 - F0) / 0.3) + 1):
    z = F0 + 0.3 * (i + 1)
    if z > F1 + 0.05:
        break
    xbox(f'ladder_rung{i}', 0.46, 0.035, 0.035, 'int_orange' if i % 3 == 2 else 'int_steel', 0, LAD_Y, z - 0.0175, walk=False,
         level='g' if z < C0 else 'u')
foot('ladder', 0, LAD_Y, 0.28, 0.06, 0)

# --- ring hall lights (ground + upper)
for lvl, ceil in ((0, C0), (1, C1)):
    for i in range(8):
        b = i * 45 + 22.5
        if lvl == 0 and abs(b - 180) < 30:
            continue
        rbox(f'hall_lamp_{lvl}_{i}', 0.7, 0.18, 0.03, 'glow_lamp', b, 2.42, ceil - 0.03, walk=False)

# --- galley + wardroom (bearings 200-295, open to the hall)  # NASA: CH-galley, CH-wardroom
GB = 212
rbox('galley_counter', 1.6, 0.6, 0.86, 'int_panel', GB, RMAX - 0.35, F0, bevel=0.01)
rbox('galley_top', 1.64, 0.64, 0.04, 'int_steel', GB, RMAX - 0.35, F0 + 0.86, walk=False)
for j, t in enumerate((-0.6, -0.2, 0.2, 0.6)):
    rbox(f'galley_locker_lo{j}', 0.36, 0.02, 0.7, 'int_wall', GB, RMAX - 0.66, F0 + 0.08, t=t, walk=False)
rbox('galley_lockers_hi', 1.5, 0.42, 0.62, 'int_panel', GB, RMAX - 0.26, F0 + 1.75, bevel=0.01, walk=False)
for j, t in enumerate((-0.55, -0.18, 0.18, 0.55)):
    rbox(f'galley_locker_hi{j}', 0.33, 0.02, 0.52, 'int_wall', GB, RMAX - 0.48, F0 + 1.8, t=t, walk=False)
for j, t in enumerate((-0.55, -0.15)):   # food warmers
    rbox(f'galley_warmer{j}', 0.34, 0.3, 0.24, 'int_steel', GB, RMAX - 0.40, F0 + 0.9, t=t, bevel=0.01, walk=False)
    rbox(f'galley_warmer{j}_lamp', 0.06, 0.01, 0.03, 'glow_status', GB, RMAX - 0.56, F0 + 1.05, t=t + 0.1, walk=False)
rbox('galley_water', 0.26, 0.26, 0.42, 'int_wall', GB, RMAX - 0.38, F0 + 0.9, t=0.45, bevel=0.01, walk=False)  # water dispenser
rbox('galley_water_spout', 0.05, 0.08, 0.06, 'int_blue', GB, RMAX - 0.55, F0 + 1.12, t=0.45, walk=False)
# wardroom table on mid-deck lockers, stools for the crew
TB, TR = 250, 3.72
rbox('wardroom_lockers', 1.2, 0.5, 0.83, 'int_panel', TB, TR, F0, bevel=0.01)
rbox('wardroom_top', 1.7, 0.86, 0.05, 'int_dark', TB, TR, F0 + 0.83, bevel=0.01, walk=False)
rbox('wardroom_top_band', 1.5, 0.12, 0.003, 'int_wall', TB, TR, F0 + 0.88, walk=False)
for sr in (-1, 1):
    for t in (-0.45, 0.45):
        p = R(TB) * (TR + sr * 0.68) + T(TB) * t
        cyl(f'stool_{sr}{t}', 0.19, 0.06, 'int_blue', p.x, p.y, F0 + 0.56, seg=16)
        cyl(f'stool_{sr}{t}_leg', 0.04, 0.56, 'int_steel', p.x, p.y, F0, seg=8)
        foot(f'stool_{sr}{t}', p.x, p.y, 0.19, 0.19, 0)
# wall screen on the hull (CH-wardroom: panoramic screen on the pressure vessel hull)
rbox('wardroom_screen_frame', 1.3, 0.05, 0.78, 'int_dark', 286, RMAX - 0.03, F0 + 1.35, walk=False)
rbox('wardroom_screen', 1.2, 0.01, 0.68, 'glow_screen', 286, RMAX - 0.06, F0 + 1.4, walk=False)

# --- hygiene (enclosed, bearings 295-335: toilet room + wash room)  # NASA: CH-hygiene, HDU-hygiene
for b in (295, 315, 335):
    rbox(f'hyg_part_{b}', WALL, RMAX - (HALL + WALL / 2), C0 - F0, 'int_wall', b, (RMAX + HALL + WALL / 2) / 2, F0)
DH = math.degrees((DOOR_W / 2) / HALL)
segs = [(295, 305 - DH), (305 + DH, 325 - DH), (325 + DH, 335)]
for i, (a0, a1) in enumerate(segs):
    arc(f'hyg_front_{i}', HALL - WALL / 2, HALL + WALL / 2, a0, a1, F0, C0, 'int_wall')
for i, bc in enumerate((305, 325)):
    arc(f'hyg_lintel_{i}', HALL - WALL / 2, HALL + WALL / 2, bc - DH, bc + DH, F0 + DOOR_H, C0, 'int_wall', walk=False)
    arc(f'hyg_trim_{i}', HALL - WALL / 2 - 0.01, HALL - WALL / 2, bc - DH, bc + DH, F0 + DOOR_H - 0.06, F0 + DOOR_H, 'int_blue', walk=False)
# toilet (waste collection) and its supply locker
rbox('hyg_toilet', 0.5, 0.6, 0.42, 'int_wall', 305, 4.15, F0, bevel=0.03)
rbox('hyg_toilet_lid', 0.46, 0.5, 0.04, 'int_panel', 305, 4.13, F0 + 0.42, bevel=0.01, walk=False)
rbox('hyg_toilet_locker', 0.9, 0.35, 0.7, 'int_panel', 305, RMAX - 0.3, F0 + 1.3, bevel=0.01)
rbox('hyg_fan', 0.3, 0.2, 0.3, 'int_steel', 305, RMAX - 0.12, F0 + 0.7, walk=False)
# wash room: basin cabinet, locker, hand rail
rbox('hyg_basin', 0.8, 0.5, 0.85, 'int_panel', 325, RMAX - 0.3, F0, bevel=0.01)
rbox('hyg_basin_bowl', 0.42, 0.3, 0.03, 'int_steel', 325, RMAX - 0.32, F0 + 0.85, walk=False)
rbox('hyg_locker', 0.8, 0.32, 0.6, 'int_panel', 325, RMAX - 0.2, F0 + 1.75, bevel=0.01, walk=False)
rbox('hyg_rail', 0.6, 0.04, 0.04, 'int_blue', 325, 3.15, F0 + 1.0, walk=False)
for bc in (305, 325):
    rbox(f'hyg_lamp_{bc}', 0.5, 0.3, 0.03, 'glow_lamp', bc, 3.9, C0 - 0.03, walk=False)

# --- ECLSS racks (bearings 335-25; the shell vents and radiators outside are on the north side)  # NASA: CH-ISPR, CH-subsystems
for j, b in enumerate((345, 0, 15)):
    r = RMAX - 0.03 - RACK_D / 2
    rbox(f'eclss_rack{j}', RACK_W, RACK_D, RACK_H, 'int_steel', b, r, F0, bevel=0.01)
    rf = r - RACK_D / 2 - 0.01
    rbox(f'eclss_face{j}', RACK_W - 0.1, 0.02, RACK_H - 0.12, 'int_panel', b, rf, F0 + 0.06, walk=False)
    # modules and two round tanks (water recovery rack look, KSC-08pd3209)
    for m, (t, z, w, h) in enumerate(((-0.24, 1.5, 0.42, 0.36), (0.24, 1.5, 0.42, 0.36), (-0.24, 1.05, 0.42, 0.36))):
        rbox(f'eclss_mod{j}_{m}', w, 0.05, h, 'int_wall', b, rf - 0.03, F0 + z, t=t, bevel=0.008, walk=False)
    for m, (t, z) in enumerate(((0.24, 1.23), (-0.0, 0.45))):
        p = R(b) * (rf - 0.06) + T(b) * t
        o = cyl(f'eclss_tank{j}_{m}', 0.2 if m == 0 else 0.26, 0.08, 'int_steel', p.x, p.y, F0 + z, seg=20,
                rotx=math.pi / 2, rotz=-math.radians(b), walk=False)
    rbox(f'eclss_status{j}', 0.08, 0.01, 0.05, 'glow_status', b, rf - 0.02, F0 + 1.92, t=0.38, walk=False)
rbox('eclss_lamp', 1.6, 0.3, 0.03, 'glow_lamp', 0, 3.7, C0 - 0.03, walk=False)

# --- stowage (bearings 25-165): CTB shelves + big M3 bags on the floor  # NASA: CH-stowage, iss034e009690
def ctb_shelf(name, b, z0=F0, h=2.1, w=1.0, d=0.5):
    r = RMAX - 0.03 - d / 2
    rbox(name, w, d, 0.04, 'int_steel', b, r, z0, walk=True)
    for sx in (-1, 1):
        rbox(f'{name}_side{sx:+d}', 0.04, d, h, 'int_steel', b, r, z0, t=sx * (w / 2 - 0.02), walk=False)
    nsh = 4
    for k in range(nsh):
        z = z0 + 0.04 + k * (h - 0.04) / nsh
        rbox(f'{name}_sh{k}', w, d, 0.03, 'int_steel', b, r, z, walk=False)
        for q, t in enumerate((-0.23, 0.23)):
            hb = (h - 0.04) / nsh - 0.12
            rbox(f'{name}_ctb{k}{q}', 0.42, d - 0.08, hb, 'int_bag', b, r - 0.02, z + 0.03, t=t, bevel=0.03, walk=False)
            rbox(f'{name}_ctb{k}{q}_tag', 0.12, 0.01, 0.07, 'int_blue', b, r - d / 2 + 0.03, z + 0.03 + hb * 0.55, t=t, walk=False)
    rbox(f'{name}_top', w, d, 0.04, 'int_steel', b, r, z0 + h - 0.04, walk=False)


for j, b in enumerate((104, 118, 132, 146)):
    ctb_shelf(f'stow_shelf{j}', b)
for j, (b, t) in enumerate(((36, 0), (58, 0), (90, 0))):
    rbox(f'stow_m3_{j}', 1.0, 0.75, 0.9, 'int_bag', b, RMAX - 0.45, F0, bevel=0.08)
    rbox(f'stow_m3_{j}_tag', 0.2, 0.01, 0.12, 'int_blue', b, RMAX - 0.83, F0 + 0.55, walk=False)
for b in (60, 125):
    rbox(f'stow_lamp_{b}', 0.8, 0.3, 0.03, 'glow_lamp', b, 3.9, C0 - 0.03, walk=False)
rbox('galley_lamp', 1.2, 0.3, 0.03, 'glow_lamp', 240, 3.9, C0 - 0.03, walk=False)
rbox('galley_lamp2', 0.8, 0.3, 0.03, 'glow_lamp', 280, 3.9, C0 - 0.03, walk=False)

# =============================================================== UPPER FLOOR
# --- command room in the core (ASTRA HOME.command 1.75 inner, core 1.9)  # NASA: CH-command
CD = math.degrees((DOOR_W / 2) / ((COMMAND + CORE) / 2))
arc('command_wall', COMMAND, CORE, 180 + CD, 540 - CD, F1, C1, 'int_panel', seg=64)
arc('command_lintel', COMMAND, CORE, 180 - CD, 180 + CD, F1 + DOOR_H, C1, 'int_panel', walk=False)
arc('command_trim', CORE, CORE + 0.01, 180 - CD, 180 + CD, F1 + DOOR_H - 0.06, F1 + DOOR_H, 'int_orange', walk=False)
arc('command_desk', 1.12, COMMAND - 0.02, 300, 420, F1 + 0.72, F1 + 0.76, 'int_dark', walk=False)
arc('command_desk_body', 1.4, COMMAND - 0.02, 302, 418, F1, F1 + 0.72, 'int_panel', walk=True)
for j, b in enumerate((325, 0, 35)):
    rbox(f'command_screen_frame{j}', 0.7, 0.05, 0.46, 'int_dark', b, COMMAND - 0.06, F1 + 1.0, walk=False)
    rbox(f'command_screen{j}', 0.62, 0.01, 0.38, 'glow_screen', b, COMMAND - 0.09, F1 + 1.04, walk=False)
for j, b in enumerate((340, 20)):
    rbox(f'command_chair{j}', 0.46, 0.46, 0.08, 'int_blue', b, 0.92, F1 + 0.45, bevel=0.02)
    rbox(f'command_chair{j}_back', 0.44, 0.07, 0.5, 'int_blue', b, 0.66, F1 + 0.5, bevel=0.02, walk=False)
    rbox(f'command_chair{j}_post', 0.06, 0.06, 0.45, 'int_steel', b, 0.92, F1, walk=False)
    rbox(f'command_chair{j}_foot', 0.5, 0.06, 0.04, 'int_steel', b, 0.92, F1, walk=False)
rbox('command_lamp', 1.0, 0.25, 0.03, 'glow_lamp', 0, 1.2, C1 - 0.03, walk=False)
rbox('command_lamp2', 0.6, 0.2, 0.03, 'glow_lamp', 180, 1.35, C1 - 0.03, walk=False)

# well guard rail 42 in with a gate on the south side (the side you come in from)  # NASA: VTS
gx, gy0, gy1 = WELL_L / 2 + 0.06, WELL_C.y - WELL_W / 2 - 0.06, WELL_C.y + WELL_W / 2 + 0.06
corners = [(-gx, gy0), (gx, gy0), (gx, gy1), (-gx, gy1)]
for i, (x, y) in enumerate(corners):
    xbox(f'guard_post{i}', 0.05, 0.05, GUARD_H, 'int_orange', x, y, F1, walk=False, level='u')
for zt in (GUARD_H - 0.04, 0.55):
    xbox(f'guard_rail_n{zt}', 2 * gx, 0.04, 0.04, 'int_orange', 0, gy1, F1 + zt, walk=False, level='u')
    for sx in (-1, 1):
        xbox(f'guard_rail_s{sx}{zt}', gx - 0.45, 0.04, 0.04, 'int_orange', sx * (gx + 0.45) / 2, gy0, F1 + zt, walk=False, level='u')
        xbox(f'guard_rail_e{sx}{zt}', 0.04, gy1 - gy0, 0.04, 'int_orange', sx * gx, (gy0 + gy1) / 2, F1 + zt, walk=False, level='u')
# the gate (closed, static) between two posts
for sx in (-1, 1):
    xbox(f'guard_gate_post{sx}', 0.05, 0.05, GUARD_H, 'int_orange', sx * 0.45, gy0, F1, walk=False, level='u')
xbox('guard_gate', 0.86, 0.03, 0.04, 'int_blue', 0, gy0 - 0.01, F1 + GUARD_H - 0.1, walk=False, level='u')
xbox('guard_gate_mid', 0.86, 0.03, 0.04, 'int_blue', 0, gy0 - 0.01, F1 + 0.5, walk=False, level='u')
foot('well_guard', 0, WELL_C.y, gx, (gy1 - gy0) / 2, 0, F1)

# --- crew quarters x4, one per small upper window (227.5, 272.5, 317.5, 2.5)  # NASA: CH-CQ, ISS-CQ, RadWorks
CQ = [(205, 250), (250, 295), (295, 340), (340, 385)]
for b0, b1 in CQ:
    rbox(f'cq_part_{b0}', WALL, RMAX - (HALL + WALL / 2), C1 - F1, 'int_wall', b0, (RMAX + HALL + WALL / 2) / 2, F1)
rbox('cq_part_385', WALL, RMAX - (HALL + WALL / 2), C1 - F1, 'int_wall', 385, (RMAX + HALL + WALL / 2) / 2, F1)
for n, (b0, b1) in enumerate(CQ):
    dc = b0 + 2 + DH + 1.5          # doorway near the start partition
    arc(f'cq{n}_front_a', HALL - WALL / 2, HALL + WALL / 2, b0, dc - DH, F1, C1, 'int_wall')
    arc(f'cq{n}_front_b', HALL - WALL / 2, HALL + WALL / 2, dc + DH, b1, F1, C1, 'int_wall')
    arc(f'cq{n}_lintel', HALL - WALL / 2, HALL + WALL / 2, dc - DH, dc + DH, F1 + DOOR_H, C1, 'int_wall', walk=False)
    arc(f'cq{n}_trim', HALL - WALL / 2 - 0.01, HALL - WALL / 2, dc - DH, dc + DH, F1 + DOOR_H - 0.06, F1 + DOOR_H, 'int_green', walk=False)
    wb = (b0 + b1) / 2              # window bearing
    # bunk: horizontal bunk under the window, green sleeping bag (iss054e022260), pillow
    rbox(f'cq{n}_bunk', 2.0, 0.85, 0.42, 'int_panel', wb, 4.27, F1, bevel=0.01)
    rbox(f'cq{n}_bag', 1.6, 0.75, 0.12, 'int_green', wb, 4.27, F1 + 0.42, t=0.15, bevel=0.04, walk=False)
    rbox(f'cq{n}_pillow', 0.36, 0.6, 0.1, 'int_wall', wb, 4.27, F1 + 0.42, t=-0.78, bevel=0.04, walk=False)
    # radiation panels on the back wall: thicker padded panel round the bunk (ISS-CQ 6.2-6.5 cm UHMWPE)
    rbox(f'cq{n}_shield_l', 0.75, 0.065, 1.9, 'int_wall', wb, RMAX - 0.12, F1 + 0.45, t=-1.25, walk=False)
    # desk (horizontal work surface) + laptop, lockers (stowage)
    db = b1 - 9
    rbox(f'cq{n}_desk', 0.9, 0.55, 0.04, 'int_panel', db, 3.55, F1 + 0.74, yaw=math.radians(90))
    rbox(f'cq{n}_desk_leg', 0.06, 0.5, 0.74, 'int_steel', db, 3.55, F1, yaw=math.radians(90), walk=False)
    rbox(f'cq{n}_laptop', 0.34, 0.24, 0.02, 'int_dark', db, 3.55, F1 + 0.78, yaw=math.radians(90), walk=False)
    rbox(f'cq{n}_laptop_screen', 0.32, 0.01, 0.2, 'glow_screen', db, 3.55, F1 + 0.8, t=0.0, yaw=math.radians(90) + 0.0, walk=False)
    rbox(f'cq{n}_locker', 0.5, 0.5, 1.9, 'int_panel', b1 - 4.5, 3.45, F1, bevel=0.01)
    rbox(f'cq{n}_locker_line', 0.46, 0.01, 0.01, 'int_steel', b1 - 4.5, 3.19, F1 + 0.95, walk=False)
    rbox(f'cq{n}_lamp', 0.6, 0.25, 0.03, 'glow_lamp', wb, 3.9, C1 - 0.03, walk=False)
    rbox(f'cq{n}_rail', 0.7, 0.04, 0.04, 'int_blue', wb, RMAX - 0.06, F1 + 1.05, t=1.25, walk=False)

# --- medical corner (bearings 25-100): bed that tilts its back up + wall screen  # NASA: CH-medical
MB = 62
rbox('med_bed', 2.0, 0.8, 0.62, 'int_panel', MB, 3.95, F1, bevel=0.01)
rbox('med_mattress', 1.25, 0.72, 0.1, 'int_blue', MB, 3.95, F1 + 0.62, t=0.35, bevel=0.03, walk=False)
back = rbox('med_backrest', 0.75, 0.72, 0.1, 'int_blue', MB, 3.95, F1 + 0.62, t=-0.62, bevel=0.03, walk=False)
back.rotation_euler = (0.0, math.radians(35), -math.radians(MB))
rbox('med_screen_frame', 1.06, 0.05, 0.66, 'int_dark', 61.5, RMAX - 0.03, F1 + 1.2, walk=False)
rbox('med_screen', 0.96, 0.01, 0.56, 'glow_screen', 61.5, RMAX - 0.06, F1 + 1.25, walk=False)
rbox('med_cabinet', 0.9, 0.5, 1.9, 'int_panel', 96, RMAX - 0.3, F1, bevel=0.01)
rbox('med_cabinet_mark', 0.24, 0.01, 0.08, 'int_orange', 96, RMAX - 0.56, F1 + 1.45, walk=False)
rbox('med_cabinet_mark2', 0.08, 0.01, 0.24, 'int_orange', 96, RMAX - 0.56, F1 + 1.37, walk=False)
rbox('med_lamp', 1.0, 0.3, 0.03, 'glow_lamp', MB, 3.9, C1 - 0.03, walk=False)

# --- upper stowage + lockers (bearings 110-200)
for j, b in enumerate((116, 130, 144)):
    ctb_shelf(f'ustow_shelf{j}', b, z0=F1, h=2.1)
for j, b in enumerate((166, 180, 194)):
    rbox(f'ustow_locker{j}', 1.0, 0.5, 1.9, 'int_panel', b, RMAX - 0.3, F1, bevel=0.01)
    for k in range(3):
        rbox(f'ustow_locker{j}_l{k}', 0.9, 0.01, 0.012, 'int_steel', b, RMAX - 0.56, F1 + 0.5 + k * 0.5, walk=False)
for b in (135, 180):
    rbox(f'ustow_lamp_{b}', 0.8, 0.3, 0.03, 'glow_lamp', b, 3.9, C1 - 0.03, walk=False)

# =============================================================== JOIN static meshes by (level, material); keep door leaves
bpy.context.view_layer.update()
for o in list(COL.objects):
    if o.type == 'MESH' and o.name.startswith('cut'):
        bpy.data.objects.remove(o)
groups = {}
for o in list(COL.objects):
    if o.type != 'MESH' or o.parent not in (FURN, GLOW):
        continue
    key = (o.get('level', 'g'), o.data.materials[0].name, 'door' if o.get('door_part') else ('open' if o.get('opening_part') else 'x'))
    groups.setdefault(key, []).append(o)
dg = bpy.context.evaluated_depsgraph_get()
for (lvl, mname, kind), obs in sorted(groups.items()):
    bm = bmesh.new()
    for o in obs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        me.transform(o.matrix_world)
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    nm = f'habitat_{ {"g": "ground", "u": "upper", "m": "middeck", "c": "roof", "gL": "ground_lamps", "uL": "upper_lamps"}[lvl] }_{mname}' + ('' if kind == 'x' else '_' + kind)
    nm = nm.replace(' ', '')
    for o in obs:
        bpy.data.objects.remove(o)
    me = bpy.data.meshes.new(nm)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(MAT[mname])
    j = bpy.data.objects.new(nm, me)
    COL.objects.link(j)
    j.parent = GLOW if mname.startswith('glow_') else FURN
    j['level'] = lvl
    if kind == 'door':
        j['door_part'] = 1
    if kind == 'open':
        j['opening_part'] = 1
for o in COL.objects:
    if o.type == 'MESH':
        for p in o.data.polygons:
            p.use_smooth = False

# =============================================================== REF shell (appended, never exported)
ref_col = bpy.data.collections.new('REF_shell')
scene.collection.children.link(ref_col)
with bpy.data.libraries.load(REF, link=False) as (src, dst):
    dst.objects = [n for n in src.objects]
for o in dst.objects:
    if o is not None and o.type == 'MESH':
        ref_col.objects.link(o)
shell = next(o for o in ref_col.objects if o.data.materials and o.data.materials[0].name.startswith('astra_e7e9ec'))

# =============================================================== FIT CHECK (every interior vertex inside the shell, >= 2 cm)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
sm = shell.evaluated_get(dg).to_mesh()
sv = [shell.matrix_world @ v.co for v in sm.vertices]
bvh = BVHTree.FromPolygons(sv, [tuple(p.vertices) for p in sm.polygons])
shell.evaluated_get(dg).to_mesh_clear()
report = {'clearance_m': 0.02, 'checked': 0, 'fail': [], 'door_or_opening_skipped': 0, 'min_clearance_m': 99.0}
for o in COL.objects:
    if o.type != 'MESH':
        continue
    exempt = bool(o.get('door_part')) or any(bool(p.get('door_part')) for p in [o.parent] if p)
    me = o.evaluated_get(dg).to_mesh()
    mw = o.matrix_world
    worst = None
    for v in me.vertices:
        w = mw @ v.co
        if exempt:
            report['door_or_opening_skipped'] += 1
            continue
        r = math.hypot(w.x, w.y)
        report['checked'] += 1
        if r < 0.05:
            continue
        hit = bvh.ray_cast(Vector((0, 0, w.z)), Vector((w.x / r, w.y / r, 0)))
        if hit[0] is None:
            # the ray left through one of the shell's own window holes: compare with the nearest shell point
            near = bvh.find_nearest(w)
            if near[0] is None:
                report['fail'].append([o.name, round(w.x, 3), round(w.y, 3), round(w.z, 3), 'no shell'])
                continue
            clr = math.hypot(near[0].x, near[0].y) - r
        else:
            clr = hit[3] - r
        report['min_clearance_m'] = min(report['min_clearance_m'], round(clr, 4))
        if clr < 0.02:
            report['fail'].append([o.name, round(w.x, 3), round(w.y, 3), round(w.z, 3), round(clr, 4)])
    o.evaluated_get(dg).to_mesh_clear()
report['fail_count'] = len(report['fail'])
report['fail'] = report['fail'][:40]
report['result'] = 'PASS' if report['fail_count'] == 0 else 'FAIL'
print('FIT CHECK', report['result'], 'checked', report['checked'], 'fails', report['fail_count'], 'min clearance', report['min_clearance_m'])

# =============================================================== PATH CHECK: astronaut 1.8 x 0.6 m, both hatches open
# Rays along the walk line porch -> outer hatch -> airlock -> inner hatch -> ring hall, against our meshes at the open
# frame and ASTRA's shell with the HANDOFF cut applied (shell + band triangles in the hatch box removed).
CUT_BOX = ((-0.64, 0.64), (-5.45, -4.80), (0.78, 2.56))   # Blender x, y, z of the HANDOFF box
scene.frame_set(scene.frame_end)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
trees = []
for o in list(COL.objects) + list(ref_col.objects):
    if o.type != 'MESH':
        continue
    cut_me = o.name in ref_col.objects and o.data.materials and o.data.materials[0].name[:12] in ('astra_e7e9ec', 'astra_c9ced6')
    me = o.evaluated_get(dg).to_mesh()
    mw = o.matrix_world
    vs = [mw @ v.co for v in me.vertices]
    polys = []
    for p in me.polygons:
        if cut_me:
            c = mw @ p.center
            if all(lo <= c[k] <= hi for k, (lo, hi) in enumerate(CUT_BOX)):
                continue
        polys.append(tuple(p.vertices))
    o.evaluated_get(dg).to_mesh_clear()
    if polys:
        trees.append((o.name, BVHTree.FromPolygons(vs, polys)))
Y0, Y1 = -6.6, -2.2                        # from beyond the porch to the ring hall
path = {'astronaut_m': [1.8, 0.6], 'from_y_three': -Y0, 'to_y_three': -Y1, 'frame': scene.frame_end,
        'feet_z': F0, 'body_band_z': [round(SILL + 0.02, 3), round(F0 + 1.8, 3)], 'blocked': [],
        'walk_over': {}}
for x in (-0.3, -0.2, -0.1, 0.0, 0.1, 0.2, 0.3):
    for k in range(15):
        z = F0 + 0.05 + (1.8 - 0.05) * k / 14         # 0.55 .. 2.30: feet to head
        for nm, t in trees:                            # every surface crossed along the walk line
            y = Y0
            while True:
                h = t.ray_cast(Vector((x, y, z)), Vector((0, 1, 0)), Y1 - y)
                if h[0] is None:
                    break
                rec = [nm, round(x, 2), round(-h[0].y, 3), round(z, 3)]   # name, x, three z of the hit, height
                if z >= SILL + 0.02:
                    path['blocked'].append(rec)
                else:
                    path['walk_over'].setdefault(nm, []).append(rec[1:])
                y = h[0].y + 0.002
path['walk_over'] = {nm: {'hits': len(v), 'three_z': [min(r[1] for r in v), max(r[1] for r in v)],
                          'ray_heights': sorted({r[2] for r in v})} for nm, v in path['walk_over'].items()}
path['blocked_count'] = len(path['blocked'])
path['blocked'] = path['blocked'][:40]
path['result'] = 'CLEAR' if not path['blocked'] else 'BLOCKED'
report['path_check'] = path
print('PATH CHECK', path['result'], 'blocked', path['blocked'][:6], 'walk-over parts', sorted(path['walk_over']))
scene.frame_set(1)
with open(os.path.join(HERE, 'fit_check.json'), 'w') as f:
    json.dump(report, f, indent=1)

# =============================================================== STATS + walk.json
tris = 0
for o in COL.objects:
    if o.type == 'MESH':
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
        o.evaluated_get(dg).to_mesh_clear()
used = sorted({m.name for o in COL.objects if o.type == 'MESH' for m in o.data.materials})
stats = {'triangles': tris, 'materials': used, 'material_count': len(used),
         'meshes': sum(1 for o in COL.objects if o.type == 'MESH')}
print('STATS', json.dumps(stats))
with open(os.path.join(HERE, 'stats.json'), 'w') as f:
    json.dump(stats, f, indent=1)
with open(os.path.join(HERE, 'walk.json'), 'w') as f:
    json.dump(FOOT, f, indent=0)

# =============================================================== save + export
ref_col.hide_render = True
for o in ref_col.objects:
    o.hide_render = True
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'habitat_interior.blend'))
for o in ref_col.objects:
    o.hide_render = False
ref_col.hide_render = False
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'habitat_interior.blend'))

for o in bpy.context.view_layer.objects:
    o.select_set(False)
for o in COL.objects:
    o.select_set(True)
kw = dict(filepath=os.path.join(HERE, 'habitat_interior.glb'), export_format='GLB', use_selection=True,
          export_apply=True, export_animations=True, export_animation_mode='NLA_TRACKS',
          export_lights=False, export_cameras=False, export_extras=False, export_yup=True)
try:
    bpy.ops.export_scene.gltf(**kw)
except TypeError as e:
    print('export kw issue', e)
    kw.pop('export_animation_mode', None)
    bpy.ops.export_scene.gltf(**kw)
print('EXPORTED', kw['filepath'])
