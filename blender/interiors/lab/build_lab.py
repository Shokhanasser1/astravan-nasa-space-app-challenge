"""HOME BY SEVEN - lab (game: Workshop) round hatch + interior, built from scratch.

Run:  Blender -b --factory-startup -P build_lab.py            (build + fit check + export)
      Blender -b --factory-startup -P build_lab.py -- render  (same + Cycles CPU renders)

Coordinates: everything is authored in ASTRA's three.js model frame (x, y up, z = front/south), native metres,
and converted to Blender with three (x, y, z) -> Blender (x, -z, y). The glTF exporter's +Y-up turns it back.
Facts and sizes: see SOURCES.md (NASA NTRS + NASA Image and Video Library). Shell numbers: works.ts buildLab.
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.normpath(os.path.join(HERE, '..', 'ref', 'lab_shell.blend'))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
DO_RENDER = 'render' in ARGS

# ---------------------------------------------------------------- shell facts (works.ts buildLab, common.ts skid)
DECK = 0.3 * 0.71                     # skid(g, 3.6, 2.4) returns h * 0.71
HY = DECK + 1.15                      # hull axis height
HULL = [(-1.95, 0), (-1.88, 0.45), (-1.7, 0.78), (-1.45, 0.92), (-1.2, 0.96),
        (1.2, 0.96), (1.45, 0.92), (1.7, 0.78), (1.88, 0.45), (1.95, 0)]
# our inner lining: >= 2 cm inside the hull, the rib rings (r 0.935) and ASTRA's cradle horns (r 0.90)
LIN = [(-1.70, 0.71), (-1.45, 0.845), (-1.2, 0.875), (1.2, 0.875), (1.45, 0.845), (1.70, 0.71)]
CEIL = 2.199                          # flat ceiling: ASTRA's mast foot pokes into the hull down to y 2.238
FLOOR = 0.60                          # walkway deck height
HATCH_R = 0.36                        # clear radius of our hatch bore (ASTRA hatch disc r 0.36, torus r 0.38)
BULK_X = 1.70                         # flat end bulkheads at x = +-1.70
WIN_X = [(-0.90, -0.30), (0.30, 0.90)]  # lining openings in front of ASTRA's two south windows
WIN_PHI = (math.radians(-3.5), math.radians(32))


def interp(prof, x):
    if x <= prof[0][0]:
        return prof[0][1]
    for (x0, r0), (x1, r1) in zip(prof, prof[1:]):
        if x0 <= x <= x1:
            return r0 + (r1 - r0) * (x - x0) / (x1 - x0)
    return prof[-1][1]


def r_lin(x):
    return interp(LIN, x)


def T(p):
    return Vector((p[0], -p[2], p[1]))


def P(x, r, phi):
    """Point on a ring around the module axis; phi 0 = south (+z), 90 deg = up."""
    return (x, min(HY + r * math.sin(phi), CEIL), r * math.cos(phi))


# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 24
COL = bpy.data.collections.new('LAB_interior')
scene.collection.children.link(COL)


def hexlin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def material(name, hexc, rough=0.6, metal=0.0, emit=None, strength=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*hexlin(hexc), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*hexlin(emit), 1)
        b.inputs['Emission Strength'].default_value = strength
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        for attr, val in (('surface_render_method', 'BLENDED'), ('blend_method', 'BLEND')):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
    m.diffuse_color = (*hexlin(hexc), alpha)
    m.use_backface_culling = alpha >= 1   # single-sided (glTF doubleSided false); glass stays two-sided
    return m


# Palette: ASTRA common.ts C + colours seen in the NASA photos (SOURCES.md)
M = {
    'white': material('int_white', '#e8ecf2', 0.7),
    'off': material('int_off', '#d3d9e2', 0.75),
    'grey': material('int_grey', '#a9b2c0', 0.55, 0.1),
    'steel': material('int_steel', '#b9c0cb', 0.38, 0.6),
    'dark': material('int_dark', '#2a3140', 0.7),
    'blue': material('int_blue', '#2f6fd6', 0.45),
    'mwa': material('int_mwa', '#1f3f78', 0.6, 0.15),       # ISS Maintenance Work Area blue (iss063e004863)
    'orange': material('int_orange', '#ff8a3d', 0.5),
    'glass': material('int_glass', '#dff3ff', 0.08, 0.0, alpha=0.28),
    'bag': material('int_bag', '#ece7da', 0.9),
    'rock': material('int_rock', '#6f7176', 0.95),
    'g_light': material('glow_light', '#fff4dc', 0.4, emit='#fff4dc', strength=6.0),
    'g_screen': material('glow_screen', '#4fb6ff', 0.3, emit='#4fb6ff', strength=2.5),
    'g_led': material('glow_led', '#3ee39a', 0.3, emit='#3ee39a', strength=4.0),
}


# ---------------------------------------------------------------- mesh builder (three-space input)
class MB:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []

    def mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def add(self, verts, faces, m, recalc=True, smooth=False, Mx=None, t=(0, 0, 0)):
        Mx = Mx or Matrix.Identity(3)
        t = Vector(t)
        vs = [self.bm.verts.new(T(Mx @ Vector(v) + t)) for v in verts]
        fs = []
        k = self.mi(m)
        for f in faces:
            try:
                fa = self.bm.faces.new([vs[i] for i in f])
            except ValueError:
                continue
            fa.material_index = k
            fa.smooth = smooth
            fs.append(fa)
        if recalc and fs:
            bmesh.ops.recalc_face_normals(self.bm, faces=fs)
        return fs

    def build(self, parent):
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(m)
        try:
            me.set_sharp_from_angle(angle=math.radians(40))
        except Exception:
            pass
        ob = bpy.data.objects.new(self.name, me)
        COL.objects.link(ob)
        ob.parent = parent
        return ob


def rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 3, axis)


AX = {'y': Matrix.Identity(3), 'x': rot('Z', -90), 'z': rot('X', 90)}


def box(mb, c, s, m, Mx=None):
    hx, hy, hz = s[0] / 2, s[1] / 2, s[2] / 2
    v = [(x, y, z) for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return mb.add(v, f, m, Mx=Mx, t=c)


def cyl(mb, c, r, h, m, axis='y', segs=16, r2=None, Mx=None, caps=True, smooth=True):
    r2 = r if r2 is None else r2
    v = [(r * math.cos(2 * math.pi * i / segs), -h / 2, r * math.sin(2 * math.pi * i / segs)) for i in range(segs)]
    v += [(r2 * math.cos(2 * math.pi * i / segs), h / 2, r2 * math.sin(2 * math.pi * i / segs)) for i in range(segs)]
    f = [(i, (i + 1) % segs, segs + (i + 1) % segs, segs + i) for i in range(segs)]
    if caps:
        f += [tuple(range(segs))[::-1], tuple(range(segs, 2 * segs))]
    R = (Mx or Matrix.Identity(3)) @ AX[axis]
    fs = mb.add(v, f, m, Mx=R, t=c)
    if smooth:
        for fa in fs[:segs]:
            fa.smooth = True
    return fs


def tube(mb, c, r_in, r_out, h, m, axis='y', segs=24, Mx=None):
    v = []
    for y in (-h / 2, h / 2):
        for r in (r_in, r_out):
            v += [(r * math.cos(2 * math.pi * i / segs), y, r * math.sin(2 * math.pi * i / segs)) for i in range(segs)]
    S = segs
    f = []
    for i in range(S):
        j = (i + 1) % S
        f.append((i, j, 2 * S + j, 2 * S + i))            # inner wall
        f.append((S + i, 3 * S + i, 3 * S + j, S + j))    # outer wall
        f.append((i, S + i, S + j, j))                    # bottom ring
        f.append((2 * S + i, 2 * S + j, 3 * S + j, 3 * S + i))  # top ring
    R = (Mx or Matrix.Identity(3)) @ AX[axis]
    fs = mb.add(v, f, m, recalc=False, Mx=R, t=c)
    for fa in fs:
        fa.smooth = True
    bmesh.ops.recalc_face_normals(mb.bm, faces=fs)
    return fs


def torus(mb, c, R, r, m, axis='y', segs=24, tsegs=8, Mx=None):
    v = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        for j in range(tsegs):
            b = 2 * math.pi * j / tsegs
            rr = R + r * math.cos(b)
            v.append((rr * math.cos(a), r * math.sin(b), rr * math.sin(a)))
    f = []
    for i in range(segs):
        for j in range(tsegs):
            i2, j2 = (i + 1) % segs, (j + 1) % tsegs
            f.append((i * tsegs + j, i2 * tsegs + j, i2 * tsegs + j2, i * tsegs + j2))
    R_ = (Mx or Matrix.Identity(3)) @ AX[axis]
    fs = mb.add(v, f, m, Mx=R_, t=c)
    for fa in fs:
        fa.smooth = True
    return fs


def prism_x(mb, prof, x0, x1, m):
    """Extrude a (y, z) outline along x."""
    n = len(prof)
    v = [(x0, y, z) for y, z in prof] + [(x1, y, z) for y, z in prof]
    f = [tuple(range(n)), tuple(range(n, 2 * n))]
    f += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return mb.add(v, f, m)


def prism_z(mb, prof, z0, z1, m):
    """Extrude an (x, y) outline along z."""
    n = len(prof)
    v = [(x, y, z0) for x, y in prof] + [(x, y, z1) for x, y in prof]
    f = [tuple(range(n)), tuple(range(n, 2 * n))]
    f += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    return mb.add(v, f, m)


def orient(fs, centre_fn):
    """Make open-surface faces point toward centre_fn(face_centre) (three coords)."""
    for fa in fs:
        c = fa.calc_center_median()
        c3 = Vector((c.x, c.z, -c.y))
        want = T(centre_fn(c3)) - c
        if fa.normal.dot(want) < 0:
            fa.normal_flip()


def to_axis(c3):
    return (c3.x, HY, 0.0)


def empty(name, parent=None, loc3=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.2
    COL.objects.link(e)
    e.parent = parent
    e.location = T(loc3)
    return e


# ---------------------------------------------------------------- hierarchy
ROOT = empty('lab_interior')
FURN = empty('lab_furniture', ROOT)
GLOW = empty('lab_glow', ROOT)

# ================================================================= LINING (walls, ceiling, floor, bulkheads)
XS = [-1.70, -1.45, -1.2, -0.9, -0.6, -0.3, 0.0, 0.3, 0.6, 0.9, 1.2, 1.45, 1.70]


def lining_part(name, phis, holes=()):
    mb = MB(name)
    verts, faces = [], []
    idx = {}
    for i, x in enumerate(XS):
        for j, ph in enumerate(phis):
            idx[i, j] = len(verts)
            verts.append(P(x, r_lin(x), ph))
    for i in range(len(XS) - 1):
        for j in range(len(phis) - 1):
            xm = (XS[i] + XS[i + 1]) / 2
            pm = (phis[j] + phis[j + 1]) / 2
            if any(a < xm < b and WIN_PHI[0] < pm < WIN_PHI[1] for a, b in holes):
                continue
            faces.append((idx[i, j], idx[i + 1, j], idx[i + 1, j + 1], idx[i, j + 1]))
    fs = mb.add(verts, faces, M['white'], recalc=False)
    orient(fs, to_axis)
    return mb


def deg(*a):
    return [math.radians(x) for x in a]


floor_phi = -math.asin((HY - FLOOR) / r_lin(0)) - math.radians(1.5)
S_PHI = [floor_phi] + deg(-45, -30, -16, -3.5, 7, 19, 32, 46, 60)
TOP_PHI = deg(60, 73, 90, 107, 120)
N_PHI = deg(120, 134, 148, 161, 173, 183.5, 196, 210, 225) + [math.pi - floor_phi]
wallS = lining_part('lab_wall_S', S_PHI, holes=WIN_X)
# window reveals: a blue trim frame around each opening, 1 cm inside the lining
for a, b in WIN_X:
    for ph in WIN_PHI:
        p0, p1 = P(a, 0.865, ph), P(b, 0.865, ph)
        n = Vector((0, math.sin(ph), math.cos(ph)))
        box(wallS, ((p0[0] + p1[0]) / 2, p0[1], p0[2]), (b - a + 0.06, 0.035, 0.02), M['blue'],
            Mx=rot('X', -math.degrees(ph)))
    for xx in (a, b):
        pm = (WIN_PHI[0] + WIN_PHI[1]) / 2
        q = P(xx, 0.865, pm)
        L = 0.875 * (WIN_PHI[1] - WIN_PHI[0])
        box(wallS, q, (0.035, L, 0.02), M['blue'], Mx=rot('X', -math.degrees(pm)))
wallS = wallS.build(ROOT)
wallT = lining_part('lab_wall_top', TOP_PHI)
wallN = lining_part('lab_wall_N', N_PHI)
wallT, wallN = wallT.build(ROOT), wallN.build(ROOT)

# floor deck: off-white plates with blue edge strips (Destiny photo s98e5113: white floor/rack faces, blue rails)
fl = MB('lab_floor')
d = HY - FLOOR
fx = [x / 100 for x in range(-160, 161, 10)]
half = [max(0.0, math.sqrt(max(0.0, (r_lin(x) - 0.02) ** 2 - d * d))) for x in fx]
pts = [(x, h) for x, h in zip(fx, half) if h > 0.05]
x_min, x_max = pts[0][0], pts[-1][0]
outline = [(x, h) for x, h in pts] + [(x, -h) for x, h in reversed(pts)]
v = [(x, FLOOR - 0.03, z) for x, z in outline] + [(x, FLOOR, z) for x, z in outline]
n = len(outline)
f = [tuple(range(n)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
fl.add(v, f, M['off'])
for xx in [-0.9, -0.3, 0.3, 0.9]:  # plate seams
    box(fl, (xx, FLOOR + 0.002, 0), (0.012, 0.006, 0.7), M['grey'])
for s in (-1, 1):
    box(fl, (0, FLOOR + 0.004, s * 0.30), (2.3, 0.008, 0.03), M['blue'])
fl = fl.build(ROOT)

# end bulkheads (flat discs) - west one has the hatch bore
def bulkhead(name, x, hole):
    mb = MB(name)
    segs = 40
    R = r_lin(x * 0.9999)
    if hole:
        v = []
        for r in (hole, R):
            v += [P(x, r, 2 * math.pi * i / segs) for i in range(segs)]
        f = [(i, (i + 1) % segs, segs + (i + 1) % segs, segs + i) for i in range(segs)]
    else:
        v = [P(x, R, 2 * math.pi * i / segs) for i in range(segs)]
        f = [tuple(range(segs))]
    fs = mb.add(v, f, M['white'], recalc=False)
    orient(fs, lambda c: (0.0, c.y, c.z))
    return mb


bW = bulkhead('lab_wall_W', -BULK_X, HATCH_R + 0.01)
tube(bW, (-BULK_X + 0.015, HY, 0), HATCH_R + 0.005, HATCH_R + 0.07, 0.03, M['blue'], axis='x', segs=32)
# hand rails beside the hatch (blue, like Destiny's)
for s in (-1, 1):
    cyl(bW, (-BULK_X + 0.07, HY + 0.02, s * 0.50), 0.016, 0.42, M['blue'], segs=8)
    for yy in (HY - 0.17, HY + 0.21):
        cyl(bW, (-BULK_X + 0.035, yy, s * 0.50), 0.012, 0.07, M['blue'], axis='x', segs=6)
bW = bW.build(ROOT)
bE = bulkhead('lab_wall_E', BULK_X, 0)
bE = bE.build(ROOT)

# ================================================================= CEILING LIGHTS + HANDRAILS
# SSLA-style light units (iss049e028948): long white plate, glowing lens, chrome handles at both ends (~4:1)
for side, ph_deg in (('S', 63), ('N', 117)):
    gl = MB('lab_lights_' + side)
    lamp_body = MB('lab_light_housings_' + side)
    ph = math.radians(ph_deg)
    Ml = rot('X', 90 - ph_deg)
    for xx in (-0.9, -0.3, 0.3, 0.9):
        q = Vector(P(xx, 0.866, ph))
        box(lamp_body, q, (0.50, 0.012, 0.13), M['white'], Mx=Ml)
        nin = Ml @ Vector((0, -1, 0))
        box(gl, q + nin * 0.008, (0.36, 0.008, 0.08), M['g_light'], Mx=Ml)
        for s_ in (-1, 1):
            box(lamp_body, q + nin * 0.014 + Vector((s_ * 0.205, 0, 0)), (0.025, 0.02, 0.10), M['steel'], Mx=Ml)
    gl.build(GLOW)
    lamp_body.build(FURN)

for side, ph_deg in (('S', 48), ('N', 132)):
    rails = MB('lab_rails_' + side)
    ph = math.radians(ph_deg)
    q = P(0, 0.835, ph)
    cyl(rails, q, 0.016, 2.2, M['blue'], axis='x', segs=8)
    for xx in (-1.0, -0.2, 0.6):
        q2 = P(xx, 0.855, ph)
        cyl(rails, q2, 0.012, 0.045, M['blue'], segs=6, Mx=rot('X', -(90 - ph_deg)))
    rails.build(FURN)

# ================================================================= shared lower cabinet profile
def cab_profile(front, top, back_r=0.85, side=1):
    """(y, z) outline of a floor cabinet hugging the curved wall; side=+1 south, -1 north."""
    pts = [(FLOOR + 0.005, front), (top, front)]
    a_top = math.asin((top - HY) / back_r)
    a_bot = math.asin((FLOOR + 0.005 - HY) / back_r)
    for k in range(7):
        a = a_top + (a_bot - a_top) * k / 6
        pts.append((HY + back_r * math.sin(a), back_r * math.cos(a)))
    return [(y, side * z) for y, z in pts]


furn = MB('lab_furniture_static')

# ================================================================= NORTH: maintenance work station (GMWS-style)
BX0, BX1 = -1.08, 1.12
BENCH = 1.28
prism_x(furn, cab_profile(0.33, BENCH, side=-1), BX0, BX1, M['white'])
# MWA work surface (iss063e004863): dark-blue hinged panels, silver hinge strips, white velcro squares
prism_x(furn, [(BENCH, -0.29), (BENCH + 0.035, -0.29), (BENCH + 0.035, -0.845), (BENCH, -0.848)], BX0, BX1, M['mwa'])
box(furn, ((BX0 + BX1) / 2, BENCH + 0.018, -0.287), (BX1 - BX0, 0.04, 0.012), M['steel'])
for zz in (-0.47, -0.66):
    box(furn, ((BX0 + BX1) / 2, BENCH + 0.037, zz), (BX1 - BX0 - 0.02, 0.006, 0.018), M['steel'])
for (vx, vz) in [(-0.98, -0.38), (-0.80, -0.56), (-0.45, -0.38), (-0.20, -0.75), (0.05, -0.38), (0.22, -0.56)]:
    box(furn, (vx, BENCH + 0.037, vz), (0.07, 0.006, 0.05), M['white'])
# clamps lined up on the front hinge row (red in the photo; ASTRA orange here)
for cx in (-0.95, -0.55, -0.12):
    for k in range(4):
        box(furn, (cx + k * 0.03, BENCH + 0.05, -0.47), (0.018, 0.03, 0.03), M['orange'])
# drawer fronts with orange pull bars (tool drawers)
for i, x0 in enumerate([-1.03, -0.69, -0.35]):
    for k, (ya, yb) in enumerate([(1.07, 1.24), (0.87, 1.04), (0.65, 0.84)]):
        box(furn, (x0 + 0.155, (ya + yb) / 2, -0.326), (0.31, yb - ya, 0.012), M['grey'])
        box(furn, (x0 + 0.155, yb - 0.035, -0.317), (0.12, 0.02, 0.016), M['orange'])
# tool board above the bench: a flat panel on the curved wall, with tools as plain shapes
yb0, yb1 = BENCH + 0.06, 1.95
zb0 = -math.sqrt(0.85 ** 2 - (yb0 - HY) ** 2)
zb1 = -math.sqrt(0.85 ** 2 - (yb1 - HY) ** 2)
up = Vector((0, yb1 - yb0, zb1 - zb0)).normalized()
nrm = Vector((0, -up.z, up.y))
if nrm.z < 0:
    nrm = -nrm
BRD = Matrix(((1, 0, 0), (0, up.y, nrm.y), (0, up.z, nrm.z)))  # columns: x, up, normal (three)
bc = Vector((-0.38, (yb0 + yb1) / 2, (zb0 + zb1) / 2))
blen = (Vector((0, yb1, zb1)) - Vector((0, yb0, zb0))).length
box(furn, bc, (1.30, blen, 0.02), M['mwa'], Mx=BRD)            # MWA blue backboard


def on_board(u, w, lift=0.02):
    return bc + BRD @ Vector((u, w, lift))


# light-blue velcro squares on the backboard (photo), then tools as plain shapes (no text):
for (u, w) in [(-0.58, 0.22), (-0.40, 0.22), (-0.22, 0.22), (-0.04, 0.22), (0.14, 0.22), (0.32, 0.22),
               (-0.49, -0.24), (0.05, -0.24), (0.41, -0.05)]:
    box(furn, on_board(u, w, 0.012), (0.08, 0.06, 0.004), M['blue'], Mx=BRD)
# chrome wrench, screwdriver, cutters, socket rail (ISS tool kit S106E5259), duct-tape rolls (MWA photo)
box(furn, on_board(-0.50, 0.03), (0.035, 0.30, 0.012), M['steel'], Mx=BRD)                     # wrench shank
for w in (-0.15, 0.17):
    cyl(furn, on_board(-0.50, w), 0.035, 0.014, M['steel'], axis='z', segs=10, Mx=BRD)
box(furn, on_board(-0.33, 0.05), (0.04, 0.16, 0.035), M['orange'], Mx=BRD)                     # screwdriver handle
box(furn, on_board(-0.33, -0.10), (0.012, 0.15, 0.012), M['steel'], Mx=BRD)
for k, u in enumerate((-0.17, -0.06)):                                                          # tape rolls
    cyl(furn, on_board(u, -0.12, 0.045), 0.05, 0.05, M['grey'], axis='z', segs=14, Mx=BRD)
    cyl(furn, on_board(u, -0.12, 0.072), 0.025, 0.004, M['dark'], axis='z', segs=10, Mx=BRD)
for s in (-1, 1):                                                                               # cutters
    box(furn, on_board(0.08 + s * 0.022, 0.06), (0.025, 0.20, 0.012), M['orange'], Mx=BRD)
box(furn, on_board(0.08, 0.20), (0.06, 0.09, 0.02), M['steel'], Mx=BRD)
box(furn, on_board(0.30, 0.10), (0.20, 0.03, 0.02), M['steel'], Mx=BRD)                         # socket rail
for k in range(5):
    cyl(furn, on_board(0.22 + k * 0.04, 0.14, 0.035), 0.012 + 0.002 * k, 0.05, M['steel'], axis='z', segs=8, Mx=BRD)
# a part on the bench being serviced: a small grey box with an open lid + a blue cable
box(furn, (-0.62, BENCH + 0.035 + 0.06, -0.60), (0.30, 0.12, 0.20), M['grey'])
box(furn, (-0.62, BENCH + 0.035 + 0.125, -0.60), (0.26, 0.01, 0.16), M['dark'])
cyl(furn, (-0.40, BENCH + 0.045, -0.57), 0.01, 0.18, M['blue'], axis='x', segs=6)

# ================================================================= NORTH-EAST: 3D printer (in-space manufacturing)
# size = ISS "3D Print" unit 33 x 30 x 36 cm (NTRS 20140011720); look = Additive Manufacturing Facility front
# (iss047e152500): off-white front, framed landscape window, grey chamber, fan grille, build plate, grey foam door
# folded down, feedstock door with a black strap on the left. Feedstock = undyed ABS (NTRS 20180002403).
PX, PZ = 0.86, -0.56
PW, PH, PD = 0.33, 0.30, 0.36
py0 = BENCH + 0.035
pf = PZ + PD / 2                                   # front face z (faces the walkway)
box(furn, (PX, py0 + PH / 2, PZ - 0.02), (PW, PH, PD - 0.04), M['grey'])            # chamber shell (back part)
box(furn, (PX, py0 + PH / 2, PZ - PD / 2 + 0.02), (PW - 0.02, PH - 0.02, 0.01), M['white'])
# front panel as a frame around the window opening (window ~5:3, right of the feedstock door)
wx0, wx1, wy0, wy1 = PX - 0.06, PX + 0.13, py0 + 0.06, py0 + 0.20
fz = pf - 0.02
for (cx, cy, sx, sy) in [((PX - PW / 2 + wx0) / 2, py0 + PH / 2, wx0 - (PX - PW / 2), PH),
                         ((wx1 + PX + PW / 2) / 2, py0 + PH / 2, PX + PW / 2 - wx1, PH),
                         ((wx0 + wx1) / 2, (py0 + wy0) / 2, wx1 - wx0, wy0 - py0),
                         ((wx0 + wx1) / 2, (wy1 + py0 + PH) / 2, wx1 - wx0, py0 + PH - wy1)]:
    box(furn, (cx, cy, fz + 0.02), (sx, sy, 0.04), M['white'])
for (cx, cy, sx, sy) in [((wx0 + wx1) / 2, wy0 - 0.006, wx1 - wx0 + 0.024, 0.012),
                         ((wx0 + wx1) / 2, wy1 + 0.006, wx1 - wx0 + 0.024, 0.012),
                         (wx0 - 0.006, (wy0 + wy1) / 2, 0.012, wy1 - wy0), (wx1 + 0.006, (wy0 + wy1) / 2, 0.012, wy1 - wy0)]:
    box(furn, (cx, cy, pf + 0.004), (sx, sy, 0.008), M['grey'])                      # window frame
box(furn, ((wx0 + wx1) / 2, (wy0 + wy1) / 2, fz - 0.005), (wx1 - wx0, 0.004, 0.004), M['dark'])
# inside the chamber: fan grille on the back wall, build plate, print tray, printed part, print head on a rail
cyl(furn, ((wx0 + wx1) / 2, py0 + 0.15, PZ - PD / 2 + 0.03), 0.05, 0.01, M['dark'], axis='z', segs=16)
box(furn, ((wx0 + wx1) / 2, py0 + 0.075, PZ - 0.02), (0.17, 0.01, 0.20), M['steel'])
box(furn, ((wx0 + wx1) / 2, py0 + 0.083, PZ - 0.02), (0.12, 0.006, 0.06), M['dark'])
box(furn, ((wx0 + wx1) / 2, py0 + 0.10, PZ - 0.02), (0.05, 0.035, 0.035), M['bag'])     # undyed ABS part
cyl(furn, ((wx0 + wx1) / 2, py0 + 0.18, PZ - 0.04), 0.006, 0.17, M['steel'], axis='x', segs=6)
box(furn, ((wx0 + wx1) / 2 + 0.02, py0 + 0.165, PZ - 0.04), (0.04, 0.035, 0.04), M['grey'])
# feedstock door (left) with its black strap, grey foam door folded down in front of the window
box(furn, (PX - PW / 2 + 0.05, py0 + PH / 2, pf + 0.004), (0.07, PH - 0.05, 0.008), M['white'])
box(furn, (PX - PW / 2 + 0.05, py0 + PH / 2 - 0.02, pf + 0.01), (0.015, 0.12, 0.006), M['dark'])
box(furn, ((wx0 + wx1) / 2, py0 + 0.012, pf + 0.07), (wx1 - wx0 + 0.02, 0.024, 0.13), M['grey'])

# ================================================================= robot arm (concept: a FabLab "robotic arm to grasp
# and move the part between an additive manufacturing unit and an inspection chamber or stowage drawer",
# NTRS 20190033333). Separate pivot `lab_arm` (vertical yaw axis at its base) so the game can turn it.
ARM_BASE = (0.50, BENCH + 0.035, -0.58)
ARM = empty('lab_arm', FURN, ARM_BASE)
arm = MB('lab_arm_mesh')
cyl(arm, (0, 0.025, 0), 0.07, 0.05, M['dark'], segs=16)
cyl(arm, (0, 0.13, 0), 0.035, 0.16, M['white'], segs=12)
cyl(arm, (0, 0.22, 0), 0.04, 0.07, M['orange'], axis='z', segs=12)                   # shoulder
LA = rot('Z', -50)
box(arm, Vector((0, 0.22, 0)) + LA @ Vector((0, 0.09, 0)), (0.045, 0.18, 0.045), M['white'], Mx=LA)
elbow = Vector((0, 0.22, 0)) + LA @ Vector((0, 0.18, 0))
cyl(arm, elbow, 0.032, 0.06, M['orange'], axis='z', segs=12)
LB = rot('Z', -150)
box(arm, elbow + LB @ Vector((0, 0.07, 0)), (0.035, 0.14, 0.035), M['white'], Mx=LB)
wrist = elbow + LB @ Vector((0, 0.14, 0))
cyl(arm, wrist, 0.022, 0.04, M['dark'], segs=10)
for s in (-1, 1):
    box(arm, wrist + Vector((s * 0.02, -0.04, 0)), (0.01, 0.05, 0.03), M['steel'])
ARM_YAW = -65   # rest pose: reaching toward the printer's front; safe game yaw = rest +-26 deg
arm.bm.transform(Matrix.Rotation(math.radians(ARM_YAW), 4, 'Z'))
arm = arm.build(ARM)

# ================================================================= SOUTH: stowage cabinet with cargo bags
SX0, SX1 = -1.08, 1.12
STOP = 1.28
prism_x(furn, cab_profile(0.33, STOP, side=1), SX0, SX1, M['white'])
prism_x(furn, [(STOP, 0.29), (STOP + 0.03, 0.29), (STOP + 0.03, 0.845), (STOP, 0.848)], SX0, SX1, M['grey'])
box(furn, ((SX0 + SX1) / 2, STOP + 0.015, 0.287), (SX1 - SX0, 0.035, 0.012), M['blue'])
# open cubbies holding single Cargo Transfer Bags, ends facing out: 42 cm wide x 25 cm high faces
# (CTB 50 x 42 x 25 cm, NTRS 20160002631; cream bags with blue label patches + straps, iss034e009690)
for i in range(4):
    cx = SX0 + 0.055 * 0 + 0.275 + 0.55 * i
    for k, (ya, yb) in enumerate([(0.66, 0.95), (0.98, 1.265)]):
        box(furn, (cx, (ya + yb) / 2, 0.326), (0.50, yb - ya, 0.008), M['dark'])
        by = ya + 0.02 + 0.125
        box(furn, (cx, by, 0.29), (0.42, 0.25, 0.06), M['bag'])
        box(furn, (cx - 0.08, by + 0.03, 0.258), (0.13, 0.08, 0.006), M['blue'])         # label patch (blank)
        box(furn, (cx + 0.10, by + 0.06, 0.256), (0.10, 0.02, 0.01), M['dark'])          # strap handle
    if i < 3:
        box(furn, (SX0 + 0.55 * (i + 1), 0.96, 0.30), (0.02, 0.62, 0.06), M['white'])  # cubby divider
# laptop on the south counter (the sample/workshop computer)
LX, LZ = -0.55, 0.55
box(furn, (LX, STOP + 0.04, LZ), (0.34, 0.02, 0.24), M['dark'])
lap_screen = (LX, STOP + 0.16, LZ + 0.13)
box(furn, lap_screen, (0.34, 0.23, 0.012), M['dark'], Mx=rot('X', -15))
# rock samples in clear bags waiting for the glovebox
for k, (sx, sz, s) in enumerate([(0.20, 0.50, 0.05), (0.32, 0.58, 0.04), (0.42, 0.48, 0.045)]):
    cyl(furn, (sx, STOP + 0.03 + s * 0.6, sz), s, s * 1.2, M['rock'], segs=7, smooth=False)

# ================================================================= EAST: GeoLab-style glovebox (NTRS 20120007479)
# work volume sized like the ISS Microgravity Science Glovebox: 920 W x 650 H x 500 D mm (NTRS 19990079845 p.4)
GX0, GX1 = 1.00, 1.52          # front-bottom x, back x
GY0, GY1 = 1.00, 1.65
GZ = 0.46
front_top_x = 1.10
# hollow box: stainless floor, back, trapezoid sides, frames; polycarbonate front + top windows (GeoLab)
WT = 0.015
box(furn, ((GX0 + GX1) / 2, GY0 + WT / 2, 0), (GX1 - GX0, WT, 2 * GZ), M['steel'])
box(furn, (GX1 - WT / 2, (GY0 + GY1) / 2, 0), (WT, GY1 - GY0, 2 * GZ), M['steel'])
for s_ in (-1, 1):
    z0, z1 = (GZ - WT, GZ) if s_ > 0 else (-GZ, -GZ + WT)
    prism_z(furn, [(GX0, GY0), (GX1, GY0), (GX1, GY1), (front_top_x, GY1)], z0, z1, M['steel'])
slope = math.degrees(math.atan2(front_top_x - GX0, GY1 - GY0))
fwin_M = rot('Z', -slope)                       # the sloped front plane
fw_c = Vector(((GX0 + front_top_x) / 2, (GY0 + GY1) / 2, 0))
Ls = math.hypot(front_top_x - GX0, GY1 - GY0)
for (ly, lz, sy, sz) in [(-Ls / 2 + 0.035, 0, 0.07, 2 * GZ), (Ls / 2 - 0.025, 0, 0.05, 2 * GZ),
                         (0, GZ - 0.025, Ls, 0.05), (0, -GZ + 0.025, Ls, 0.05)]:
    box(furn, fw_c + fwin_M @ Vector((0, ly, lz)), (0.02, sy, sz), M['steel'], Mx=fwin_M)
box(furn, fw_c + fwin_M @ Vector((-0.004, 0, 0)), (0.006, Ls - 0.1, 2 * GZ - 0.08), M['glass'], Mx=fwin_M)
# top: frame strips + top viewing window
box(furn, (front_top_x + 0.03, GY1 - WT / 2, 0), (0.06, WT, 2 * GZ), M['steel'])
box(furn, (GX1 - 0.04, GY1 - WT / 2, 0), (0.08, WT, 2 * GZ), M['steel'])
box(furn, ((front_top_x + GX1) / 2, GY1 - 0.004, 0), (GX1 - front_top_x - 0.12, 0.006, 2 * GZ - 0.04), M['glass'])
# glove ports: two 25 cm ports in the front window, dark rings with bolts, gloves reaching inside
for s_ in (-1, 1):
    pc = fw_c + fwin_M @ Vector((-0.012, -0.03, s_ * 0.20))
    tube(furn, pc, 0.125, 0.155, 0.04, M['dark'], axis='x', segs=24, Mx=fwin_M)
    for k in range(8):
        a_ = 2 * math.pi * k / 8
        bp = pc + fwin_M @ Vector((-0.022, 0.14 * math.sin(a_), 0.14 * math.cos(a_)))
        cyl(furn, bp, 0.008, 0.012, M['steel'], axis='x', segs=6)
    cyl(furn, pc + Vector((0.17, -0.05, 0)), 0.10, 0.28, M['dark'], axis='x', segs=12, r2=0.06, Mx=rot('Z', -14))
# stainless frame edges (darker band) and a stand with a shelf
box(furn, ((GX0 + GX1) / 2, GY0 - 0.02, 0), (GX1 - GX0 + 0.04, 0.04, 2 * GZ + 0.04), M['grey'])
for lx in (1.02, 1.38):
    for s in (-1, 1):
        box(furn, (lx, (FLOOR + GY0 - 0.04) / 2, s * 0.28), (0.04, GY0 - 0.04 - FLOOR, 0.04), M['grey'])
box(furn, (1.20, 0.80, 0), (0.42, 0.025, 0.60), M['grey'])
for k, zz in enumerate((-0.18, 0.0, 0.18)):   # sample containers on the shelf
    cyl(furn, (1.20, 0.80 + 0.07, zz), 0.055, 0.12, M['white'] if k != 1 else M['orange'], segs=12)
# three 25 cm pass-through antechambers from the glovebox back to the bulkhead (to the outside porch)
for zz in (-0.27, 0.0, 0.27):
    cyl(furn, (GX1 + 0.065, 1.33, zz), 0.125, 0.13, M['steel'], axis='x', segs=20)
    tube(furn, (BULK_X - 0.012, 1.33, zz), 0.10, 0.15, 0.02, M['dark'], axis='x', segs=20)
# inside the box: sample tray + rocks, stereo microscope, mass balance
box(furn, (1.28, GY0 + 0.02, -0.05), (0.30, 0.02, 0.26), M['grey'])
for (rx, rz, rs) in [(1.22, -0.10, 0.04), (1.30, 0.0, 0.05), (1.34, -0.14, 0.03)]:
    cyl(furn, (rx, GY0 + 0.03 + rs * 0.6, rz), rs, rs * 1.2, M['rock'], segs=7, smooth=False)
cyl(furn, (1.42, GY0 + 0.20, 0.25), 0.02, 0.36, M['dark'], segs=8)                       # microscope column
box(furn, (1.36, GY0 + 0.30, 0.25), (0.16, 0.08, 0.09), M['dark'])
cyl(furn, (1.30, GY0 + 0.24, 0.25), 0.025, 0.08, M['steel'], segs=10)
box(furn, (1.40, GY0 + 0.03, -0.30), (0.12, 0.04, 0.12), M['white'])                      # mass balance
cyl(furn, (1.40, GY0 + 0.06, -0.30), 0.045, 0.006, M['steel'], segs=12)
# two monitors above the glovebox on a post (GeoLab glovebox photo)
cyl(furn, (1.45, GY1 + 0.17, 0), 0.02, 0.34, M['grey'], segs=8)
box(furn, (1.38, GY1 + 0.30, 0), (0.12, 0.03, 0.56), M['grey'])
MON = []
for s in (-1, 1):
    mc = (1.28, GY1 + 0.30, s * 0.22)
    box(furn, mc, (0.03, 0.24, 0.36), M['dark'], Mx=rot('Z', 18))
    MON.append(mc)

# ================================================================= WEST: step in front of the hatch sill
prism_z(furn, [(-1.40, FLOOR), (-1.40, 0.82), (-1.63, 0.82), (-1.63, 0.70), (-1.50, FLOOR + 0.02)], -0.20, 0.20, M['grey'])
box(furn, (-1.515, 0.825, 0), (0.23, 0.01, 0.40), M['orange'])   # step tread edge colour

furn = furn.build(FURN)

# ================================================================= GLOW parts (screens, LEDs, lamps)
gw = MB('lab_glow_parts')
for mc in MON:
    box(gw, (mc[0] - 0.017, mc[1], mc[2]), (0.006, 0.20, 0.32), M['g_screen'], Mx=rot('Z', 18))
box(gw, (lap_screen[0], lap_screen[1], lap_screen[2] - 0.007), (0.30, 0.19, 0.004), M['g_screen'], Mx=rot('X', -15))
# glovebox flat LED panel under the top window
box(gw, ((front_top_x + GX1) / 2, GY1 - 0.012, 0), (0.30, 0.008, 0.6), M['g_light'])
# 3D printer: chamber light under its roof + a power LED on the front panel
box(gw, ((wx0 + wx1) / 2, py0 + PH - 0.035, PZ - 0.03), (0.16, 0.006, 0.06), M['g_light'])
box(gw, (PX + PW / 2 - 0.035, py0 + PH - 0.045, pf + 0.003), (0.02, 0.02, 0.006), M['g_led'])
# status LEDs: drawer cabinet front, glovebox base band
box(gw, (0.05, 1.20, -0.324), (0.03, 0.03, 0.006), M['g_led'])
box(gw, (GX0 - 0.025, GY0 - 0.02, 0.35), (0.006, 0.02, 0.03), M['g_led'])
gw = gw.build(GLOW)

# ================================================================= HATCH (west, -x) : collar + frame + leaf on a hinge
HX_FACE = -1.98                 # outer seal face of the collar
frame = MB('lab_hatch_frame')
tube(frame, ((HX_FACE + -BULK_X) / 2, HY, 0), HATCH_R, HATCH_R + 0.07, -BULK_X - HX_FACE, M['grey'], axis='x', segs=32)
tube(frame, (HX_FACE + 0.012, HY, 0), HATCH_R, 0.50, 0.024, M['steel'], axis='x', segs=32)      # flange
tube(frame, (HX_FACE - 0.004, HY, 0), HATCH_R + 0.012, HATCH_R + 0.05, 0.01, M['dark'], axis='x', segs=32)  # seal
# hinge knuckles on the north side (-z)
HINGE = Vector((-2.06, HY, -0.53))
for dy in (-0.20, 0.20):
    cyl(frame, (HINGE.x, HY + dy, HINGE.z), 0.025, 0.09, M['steel'], segs=10)
    box(frame, ((HINGE.x + HX_FACE) / 2 + 0.01, HY + dy, -0.50), (0.10, 0.05, 0.05), M['steel'])
# orange hazard ring band on the collar (visible stripe, no text)
tube(frame, (HX_FACE + 0.05, HY, 0), HATCH_R + 0.07, HATCH_R + 0.08, 0.03, M['orange'], axis='x', segs=32)
frame = frame.build(FURN)

DOOR = empty('lab_door', ROOT, tuple(HINGE))
leaf = MB('lab_door_leaf')
LC = Vector((HX_FACE - 0.035, HY, 0)) - HINGE      # leaf centre relative to the hinge
cyl(leaf, LC, 0.40, 0.05, M['grey'], axis='x', segs=32)
tube(leaf, LC + Vector((-0.028, 0, 0)), 0.33, 0.40, 0.012, M['steel'], axis='x', segs=32)      # outer rim
# viewport window (Orion docking hatch window: KSC-20180409-PH_AAG01_0001)
tube(leaf, LC + Vector((-0.03, 0.22, 0)), 0.055, 0.075, 0.016, M['dark'], axis='x', segs=16)
cyl(leaf, LC + Vector((-0.027, 0.22, 0)), 0.056, 0.006, M['glass'], axis='x', segs=16)
# hand wheel (outside) with three spokes
torus(leaf, LC + Vector((-0.09, -0.04, 0)), 0.12, 0.014, M['orange'], axis='x', segs=24, tsegs=6)
cyl(leaf, LC + Vector((-0.06, -0.04, 0)), 0.035, 0.07, M['steel'], axis='x', segs=12)
for k in range(3):
    a = math.radians(90 + 120 * k)
    box(leaf, LC + Vector((-0.09, -0.04 + 0.06 * math.sin(a), 0.06 * math.cos(a))), (0.016, 0.12, 0.016), M['steel'],
        Mx=rot('X', -math.degrees(a) + 90))
# grab handles (outside and inside)
for sx in (-1, 1):
    for dz in (-0.27, 0.27):
        hx = -0.045 if sx < 0 else 0.045
        box(leaf, LC + Vector((hx * 1.45, -0.04, dz)), (0.02, 0.14, 0.02), M['dark'])
        for dy in (-0.06, 0.06):
            box(leaf, LC + Vector((hx * 1.1, -0.04 + dy, dz)), (0.04, 0.016, 0.016), M['dark'])
# inside: latch lever
box(leaf, LC + Vector((0.045, -0.04, 0)), (0.02, 0.05, 0.22), M['blue'])
# hinge arm to the knuckles
box(leaf, Vector((0.035, 0, 0.06)), (0.04, 0.36, 0.14), M['steel'])
box(leaf, Vector((0.0, 0, 0)), (0.05, 0.30, 0.05), M['steel'])
leaf = leaf.build(DOOR)

# DoorOpen: swing the leaf outward (toward -x) about the vertical hinge line, 1.25 s, eased
OPEN_DEG = -105
DOOR.rotation_mode = 'XYZ'
DOOR.rotation_euler = (0, 0, 0)
DOOR.keyframe_insert('rotation_euler', frame=1)
DOOR.rotation_euler = (0, 0, math.radians(OPEN_DEG))
DOOR.keyframe_insert('rotation_euler', frame=30)
act = DOOR.animation_data.action
act.name = 'DoorOpen'
DOOR.rotation_euler = (0, 0, 0)
scene.frame_start, scene.frame_end = 1, 30
scene.frame_set(1)

# ================================================================= REF shell (for fit check + renders, never exported)
with bpy.data.libraries.load(REF, link=False) as (src, dst):
    dst.collections = [c for c in src.collections]
ref_col = bpy.data.collections.new('REF_shell')
scene.collection.children.link(ref_col)
for c in dst.collections:
    for o in list(c.objects):
        ref_col.objects.link(o)
SHELL = [o for o in ref_col.objects if o.type == 'MESH']

# ================================================================= FIT CHECK
dg = bpy.context.evaluated_depsgraph_get()
tv, tp = [], []
for o in SHELL:
    if o.name.startswith('lab_6_'):  # ground contact-shadow plane
        continue
    me = o.evaluated_get(dg).to_mesh()
    base = len(tv)
    tv += [o.matrix_world @ v.co for v in me.vertices]
    tp += [[base + i for i in p.vertices] for p in me.polygons]
    o.evaluated_get(dg).to_mesh_clear()
bvh = BVHTree.FromPolygons(tv, tp)
DOOR_PARTS = {'lab_door_leaf', 'lab_hatch_frame'}
cos40 = math.cos(math.pi / 40)
report = {'checked_vertices': 0, 'min_clearance_m': 9.0, 'violations': 0, 'worst': [], 'exempt': sorted(DOOR_PARTS)}
bad = []
for o in COL.objects:
    if o.type != 'MESH' or o.name in DOOR_PARTS:
        continue
    for v in o.data.vertices:
        w = o.matrix_world @ v.co
        x, y3, z3 = w.x, w.z, -w.y
        report['checked_vertices'] += 1
        near = bvh.find_nearest(w)
        dist = near[3] if near[0] is not None else 9.0
        radial = math.hypot(y3 - HY, z3)
        inside = radial < interp(HULL, x) * cos40 - 1e-4 and abs(x) < 1.95
        report['min_clearance_m'] = min(report['min_clearance_m'], dist)
        if dist < 0.02 or not inside:
            report['violations'] += 1
            bad.append((dist, o.name, round(x, 3), round(y3, 3), round(z3, 3), inside))
bad.sort()
report['worst'] = [list(b) for b in bad[:12]]
report['min_clearance_m'] = round(report['min_clearance_m'], 4)
print('FITCHECK', json.dumps(report))
json.dump(report, open(os.path.join(HERE, 'fitcheck.json'), 'w'), indent=1)

# ================================================================= stats
tris = 0
for o in COL.objects:
    if o.type == 'MESH':
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
mats = {m.name for o in COL.objects if o.type == 'MESH' for m in o.data.materials}
print('STATS tris', tris, 'materials', len(mats), sorted(mats))

# ================================================================= walk.json (three coords, native m)
walk = [
    {"name": "wall_N_cabinet", "x": (BX0 + BX1) / 2, "z": -0.60, "hx": (BX1 - BX0) / 2, "hz": 0.27, "yaw": 0},
    {"name": "wall_S_cabinet", "x": (SX0 + SX1) / 2, "z": 0.60, "hx": (SX1 - SX0) / 2, "hz": 0.27, "yaw": 0},
    {"name": "glovebox", "x": (GX0 + GX1) / 2 + 0.03, "z": 0.0, "hx": (GX1 - GX0) / 2 + 0.03, "hz": GZ, "yaw": 0},
    {"name": "printer_on_bench", "x": PX, "z": PZ, "hx": PW / 2, "hz": PD / 2, "yaw": 0},
    {"name": "hatch_step", "x": -1.515, "z": 0.0, "hx": 0.115, "hz": 0.20, "yaw": 0},
    {"name": "bulkhead_W", "x": -BULK_X, "z": 0.0, "hx": 0.02, "hz": 0.71, "yaw": 0},
    {"name": "bulkhead_E", "x": BULK_X, "z": 0.0, "hx": 0.02, "hz": 0.71, "yaw": 0},
    {"name": "hatch_opening", "x": -1.84, "z": 0.0, "hx": 0.14, "hz": HATCH_R, "yaw": 0},
    {"name": "walkway_floor", "x": (x_min + x_max) / 2, "z": 0.0, "hx": (x_max - x_min) / 2, "hz": 0.33, "yaw": 0},
]
for w_ in walk:
    for k in ('x', 'z', 'hx', 'hz'):
        w_[k] = round(w_[k], 3)
json.dump(walk, open(os.path.join(HERE, 'walk.json'), 'w'), indent=1)

# ================================================================= export
bpy.ops.object.select_all(action='DESELECT')
for o in COL.objects:
    o.select_set(True)
glb = os.path.join(HERE, 'lab_interior.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
                          export_animations=True, export_yup=True, export_lights=False, export_cameras=False,
                          export_extras=False)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'lab_interior.blend'))
print('EXPORTED', glb, os.path.getsize(glb))

if DO_RENDER:
    exec(open(os.path.join(HERE, 'render_lab.py')).read())
