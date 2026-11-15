"""HOME BY SEVEN - greenhouse (Garden) entrance + interior, built from scratch in Blender.

Run:  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P build_greenhouse.py [-- --render]

Frame: ASTRA native metres, ASTRA model frame (three (x, y, z) -> Blender (x, -z, y)); the glTF exporter (+Y up)
turns it back. Shell facts come from ref/greenhouse_shell.blend (ASTRA buildGreenhouse, life.ts):
glazing axis along x at height y0 = 0.213 (skid deck), R 1.5, L 4.4 (caps at x = +-2.2); arch ribs (torus R+0.02,
tube 0.045) -> inner clear radius 1.475; airlock door panel on the east cap (+x).
Every real-world size used below is logged in SOURCES.md (NASA NTRS / NASA Image Library ids).
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.normpath(os.path.join(HERE, '..', 'ref', 'greenhouse_shell.blend'))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
DO_RENDER = '--render' in ARGS

# ---------------------------------------------------------------- shell facts (fit to shell)
AX_Z = 0.213          # glazing axis height (ASTRA skid() returns h*0.71 = 0.213)
R_GLASS = 1.5
RIB_IN = 1.475        # torus ribs R+0.02 with tube 0.045 -> inner edge 1.475
R_OK = RIB_IN - 0.02  # 2 cm clearance
FLOOR = 0.232         # deck plate top
X_CAP = 2.2
X_OK = 2.16           # cap frame bars inner face 2.18, minus 2 cm
PI = math.pi

# ---------------------------------------------------------------- layout (SOURCES.md for each)
TRAY_L, TRAY_W, TRAY_H = 0.445, 0.267, 0.105     # Plant Atrium tray (NTRS 20130014500 p4)
POT = 0.102                                        # 10.2 cm square pots, 8 per tray, 2 groups of 4
RACK_X0, RACK_X1 = -1.70, 1.08                     # fit to shell + door swing
POSTS_X = [-1.69, -0.76, 0.17, 1.07]
Y_IN, Y_OUT = 0.355, 0.925                         # rack post lines (|y|)
TRAY_ROWS = [0.372 + TRAY_W / 2, 0.643 + TRAY_W / 2]
SHELF = [(0.300, 0.320), (0.875, 0.895)]           # lower / upper shelf plate z
LED_LOW_Z = 0.845                                  # magenta bars under upper shelf
LED_UP_Z = 1.285                                   # white panel bottom
GAP = 0.018
COLS = [RACK_X0 + 0.02 + TRAY_L / 2 + i * (TRAY_L + GAP) for i in range(6)]

# door: NASA "submarine" hatch 0.86 x 1.83 m stadium (NTRS 20080018968 p4 Fig.7), scaled to fit the cap
D_A = 0.40            # opening half-width (0.80 m clear; NASA 0.86)
D_ZB, D_ZT = 0.25, 1.52   # opening bottom / top (1.27 m clear; NASA 1.83 - the cap is only ~1.48 m tall above the deck)
D_BAND = 0.10
FR_X0, FR_X1 = 2.12, 2.38   # frame coaming through the cap plane x = 2.2 (outer face 2 cm proud of ASTRA panel 2.36)
LEAF_T = 0.05
LEAF_X1 = FR_X0 - 0.003
LEAF_X0 = LEAF_X1 - LEAF_T
LEAF_A = D_A + 0.04
HINGE = Vector((LEAF_X0 - 0.004, LEAF_A + 0.03, 0.0))
OPEN_DEG = -90.0
FPS, F_END = 24, 31   # 1.25 s

STATION_X0, STATION_X1 = -2.155, -1.76


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


# ---------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, F_END
scene.unit_settings.system = 'METRIC'

MATS = {}


def mat(name, hexcol, rough=0.6, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name)
    if not m.node_tree:
        m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    c = srgb(hexcol)
    b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit > 0:
        b.inputs['Emission Color'].default_value = (*c, 1)
        b.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*c, 1)
    MATS[name] = m
    return m


mat('int_white', '#e8ecf2', 0.5)
mat('int_steel', '#8b94a3', 0.35, 0.6)
mat('int_dark', '#2a3140', 0.6)
mat('int_window', '#1d2a3a', 0.08)
mat('int_media', '#3e2c22', 0.95)
mat('int_leaf', '#36b84e', 0.75)
mat('int_leaf_light', '#6fa244', 0.75)
mat('int_leaf_red', '#8a2c42', 0.7)
mat('int_tomato', '#d2402f', 0.45)
mat('int_orange', '#ff8a3d', 0.5)
mat('int_blue', '#2f6fd6', 0.4)
mat('glow_grow', '#ff6fd8', 0.4, 0, 1.0)
mat('glow_white', '#f4f8ff', 0.4, 0, 1.0)
mat('glow_status', '#3ee39a', 0.4, 0, 1.0)


# ---------------------------------------------------------------- geometry accumulator
class Acc:
    def __init__(self):
        self.d = {}

    def add(self, group, m, verts, faces, smooth=False):
        V, F, S = self.d.setdefault((group, m), ([], [], []))
        o = len(V)
        V.extend(verts)
        F.extend([tuple(i + o for i in f) for f in faces])
        S.extend([smooth] * len(faces))


A = Acc()


def T(verts, M):
    return [tuple(M @ Vector(v)) for v in verts]


def box_geo(sx, sy, sz, top=True, bottom=True):
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    v = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
         (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
    f = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    if bottom:
        f.append((3, 2, 1, 0))
    if top:
        f.append((4, 5, 6, 7))
    return v, f


def box(g, m, c, s, rz=0.0, rx=0.0, top=True, bottom=True):
    v, f = box_geo(*s, top=top, bottom=bottom)
    M = Matrix.Translation(c) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(rx, 4, 'X')
    A.add(g, m, T(v, M), f)


def boxmm(g, m, mn, mx, **kw):
    c = tuple((a + b) / 2 for a, b in zip(mn, mx))
    s = tuple(b - a for a, b in zip(mn, mx))
    box(g, m, c, s, **kw)


def cyl(g, m, p0, p1, r, seg=8, caps=True, smooth=True, r1=None):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    h = d.length
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    M = Matrix.Translation(p0) @ q.to_matrix().to_4x4()
    r1 = r if r1 is None else r1
    v, f = [], []
    for i in range(seg):
        a = 2 * PI * i / seg
        v += [(r * math.cos(a), r * math.sin(a), 0), (r1 * math.cos(a), r1 * math.sin(a), h)]
    for i in range(seg):
        j = (i + 1) % seg
        f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    A.add(g, m, T(v, M), f, smooth)
    if caps:
        A.add(g, m, T(v, M), [tuple(2 * i for i in reversed(range(seg))), tuple(2 * i + 1 for i in range(seg))], False)


def pipe(g, m, pts, r, seg=6):
    for a, b in zip(pts[:-1], pts[1:]):
        a, b = Vector(a), Vector(b)
        d = (b - a).normalized() * r * 0.9
        cyl(g, m, a - d, b + d, r, seg, caps=False)


def ico_geo(sub, r=1.0):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    v = [tuple(x.co) for x in bm.verts]
    f = [tuple(x.index for x in fa.verts) for fa in bm.faces]
    bm.free()
    return v, f


def uvs_geo(useg, vseg, r):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=useg, v_segments=vseg, radius=r)
    v = [tuple(x.co) for x in bm.verts]
    f = [tuple(x.index for x in fa.verts) for fa in bm.faces]
    bm.free()
    return v, f


def stadium(a, zb, zt, n=10, zmin=None):
    """Closed outline in the (y, z) plane: semicircle ends of radius a centred at z = zb + a and zt - a."""
    cb, ct = zb + a, zt - a
    pts = [(a * math.cos(PI * i / n), ct + a * math.sin(PI * i / n)) for i in range(n + 1)]
    pts += [(a * math.cos(PI + PI * i / n), cb + a * math.sin(PI + PI * i / n)) for i in range(n + 1)]
    if zmin is not None:
        pts = [(y, max(z, zmin)) for y, z in pts]
    return pts


def ring_x(g, m, inner, outer, x0, x1):
    N = len(inner)
    v = [(x0, y, z) for y, z in outer] + [(x1, y, z) for y, z in outer] + \
        [(x0, y, z) for y, z in inner] + [(x1, y, z) for y, z in inner]
    f = []
    for i in range(N):
        j = (i + 1) % N
        f.append((i, j, N + j, N + i))                    # outer skin
        f.append((2 * N + j, 2 * N + i, 3 * N + i, 3 * N + j))  # inner skin
        f.append((j, i, 2 * N + i, 2 * N + j))            # x0 face
        f.append((N + i, N + j, 3 * N + j, 3 * N + i))    # x1 face
    A.add(g, m, v, f)


def prism_x(g, m, outline, x0, x1, M=None):
    N = len(outline)
    v = [(x0, y, z) for y, z in outline] + [(x1, y, z) for y, z in outline]
    f = [tuple(reversed(range(N))), tuple(N + i for i in range(N))]
    for i in range(N):
        j = (i + 1) % N
        f.append((i, j, N + j, N + i))
    if M is not None:
        v = T(v, M)
    A.add(g, m, v, f)


def disc_x(g, m, x, cy, cz, r, n=16, M=None):
    v = [(x, cy + r * math.cos(2 * PI * i / n), cz + r * math.sin(2 * PI * i / n)) for i in range(n)]
    if M is not None:
        v = T(v, M)
    A.add(g, m, v, [tuple(range(n))])


# ---------------------------------------------------------------- plants (game crops: lettuce + staked dwarf tomato)
def blade(g, m, base, yaw, length, width, tilt, droop, segs=3, prof=(0.35, 1.0, 0.75)):
    d = Vector((math.cos(yaw), math.sin(yaw), 0))
    side = Vector((-d.y, d.x, 0))
    base = Vector(base)
    pts, p = [], base.copy()
    for k in range(segs + 1):
        pts.append(p.copy())
        ang = tilt + droop * (k + 0.5) / segs
        p = p + (d * math.sin(ang) + Vector((0, 0, math.cos(ang)))) * (length / segs)
    v, f = [], []
    for k in range(segs):
        w = width * prof[k] / 2
        v += [tuple(pts[k] - side * w), tuple(pts[k] + side * w)]
    v.append(tuple(pts[segs]))
    for k in range(segs - 1):
        a = 2 * k
        f.append((a, a + 1, a + 3, a + 2))
    f.append((2 * (segs - 1), 2 * (segs - 1) + 1, 2 * segs))
    A.add(g, m, v, f, True)


def butterhead(g, c, r, m='int_leaf', sub=1, seed=0):
    v, f = ico_geo(sub, 1.0)
    out = []
    for x, y, z in v:
        k = 1 + 0.18 * math.sin(x * 9 + seed) * math.cos(y * 9) + 0.08 * math.sin(z * 13)
        x, y, z = x * k, y * k, z * k
        z = max(z, -0.15) * 0.62
        out.append((c[0] + x * r, c[1] + y * r, c[2] + 0.09 * r + z * r))
    A.add(g, m, out, f, True)


def romaine(g, c, h, seed=0):
    for i in range(6):
        blade(g, 'int_leaf_red', c, seed + i * 2 * PI / 6, h * (0.85 + 0.15 * ((i * 7) % 3) / 2), 0.07, 0.22, 0.45)


def mizuna(g, c, h, seed=0):
    for i in range(9):
        blade(g, 'int_leaf_light', c, seed + i * 2 * PI / 9, h * (0.8 + 0.2 * ((i * 5) % 4) / 3), 0.026, 0.55, 0.6,
              prof=(0.6, 1.0, 0.7))


def young(g, c, r, m='int_leaf_light', seed=0):
    """Young rosette: five short spoon leaves (reads as a small plant, ~25 triangles)."""
    for i in range(5):
        blade(g, m, c, seed + i * 2 * PI / 5, r * 1.7, r * 1.1, 0.75, 0.55, prof=(0.5, 1.0, 0.8))


def seedling(g, c, s=1.0, yaw=0.0):
    for k in (0, 1):
        blade(g, 'int_leaf_light', (c[0], c[1], c[2] + 0.012 * s), yaw + k * PI, 0.03 * s, 0.022 * s, 1.0, 0.3,
              segs=2, prof=(0.8, 1.0))
    cyl(g, 'int_leaf_light', c, (c[0], c[1], c[2] + 0.014 * s), 0.002, 3, caps=False)


def tomato(g_plant, g_fruit, c, h, fruits=3, seed=0):
    cx, cy, cz = c
    cyl(g_plant, 'int_white', (cx + 0.025, cy, cz - 0.02), (cx + 0.025, cy, cz + h + 0.03), 0.006, 4)  # stake
    cyl(g_plant, 'int_leaf', (cx, cy, cz), (cx + 0.012, cy, cz + h * 0.85), 0.009, 4, r1=0.005)        # stem
    v0, f0 = ico_geo(0, 1.0)
    nl = 5 if h > 0.25 else 3
    for k in range(nl):
        a = seed + k * 2.3
        zz = cz + 0.07 + (k / max(1, nl - 1)) * (h - 0.1)
        rr = (0.075 if h > 0.25 else 0.055) * (1 - 0.1 * k)
        px, py = cx + math.cos(a) * 0.05, cy + math.sin(a) * 0.05
        M = Matrix.Translation((px, py, zz)) @ Matrix.Rotation(a, 4, 'Z') @ Matrix.Diagonal((rr * 1.2, rr, rr * 0.55, 1))
        A.add(g_plant, 'int_leaf', T(v0, M), f0, True)
    fv, ff = uvs_geo(6, 4, 0.024)
    for k in range(fruits):
        a = seed + 0.9 + k * 2.1
        zz = cz + 0.10 + k * (h - 0.16) / max(1, fruits)
        p = (cx + math.cos(a) * 0.075, cy + math.sin(a) * 0.075, zz)
        A.add(g_fruit, 'int_tomato', T(fv, Matrix.Translation(p)), ff, True)


# ---------------------------------------------------------------- racks, trays, LEDs, irrigation
GR, GT, GI, GL, GW = 'greenhouse_racks', 'greenhouse_trays', 'greenhouse_irrigation', 'greenhouse_leds', 'greenhouse_walkway'
GG = 'greenhouse_glowparts'
PS, PY, PM, PF = 'greenhouse_plants_seedling', 'greenhouse_plants_young', 'greenhouse_plants_mature', 'greenhouse_plants_fruit'

for s in (-1, 1):
    # posts
    for x in POSTS_X:
        for yl, ztop in ((Y_IN, 1.31), (Y_OUT, 1.29)):
            boxmm(GR, 'int_steel', (x - 0.0125, s * yl - 0.0125, FLOOR), (x + 0.0125, s * yl + 0.0125, ztop))
        boxmm(GR, 'int_orange', (x - 0.016, s * Y_IN - 0.016, FLOOR), (x + 0.016, s * Y_IN + 0.016, FLOOR + 0.03))  # foot caps
    ylo, yhi = sorted((s * (Y_IN - 0.01), s * (Y_OUT + 0.01)))
    for z0, z1 in SHELF:
        boxmm(GR, 'int_steel', (RACK_X0, ylo, z0), (RACK_X1, yhi, z1))
    # top tie rails holding the white LED panels
    for yl in (Y_IN, Y_OUT):
        boxmm(GR, 'int_steel', (RACK_X0, s * yl - 0.0125, 1.285), (RACK_X1, s * yl + 0.0125, 1.30 if yl == Y_IN else 1.285 + 0.015))

    for tier, (z0, z1) in enumerate(SHELF):
        tz0 = z1
        tz1 = tz0 + TRAY_H
        mz = tz1 - 0.018
        for ci, cx in enumerate(COLS):
            for ri, ry in enumerate(TRAY_ROWS):
                cy = s * ry
                # fibreglass tray (open top) + media + 8 pot rims + centre insert with float stick
                box(GT, 'int_white', (cx, cy, (tz0 + tz1) / 2), (TRAY_L, TRAY_W - 0.004, TRAY_H), top=False)
                boxmm(GT, 'int_media', (cx - TRAY_L / 2 + 0.006, cy - TRAY_W / 2 + 0.006, mz - 0.002), (cx + TRAY_L / 2 - 0.006, cy + TRAY_W / 2 - 0.006, mz), bottom=False)
                for px in (-0.171, -0.069, 0.069, 0.171):
                    for py in (-0.051, 0.051):
                        boxmm(GT, 'int_dark', (cx + px - POT / 2 + 0.004, cy + py - POT / 2 + 0.004, mz), (cx + px + POT / 2 - 0.004, cy + py + POT / 2 - 0.004, mz + 0.004), bottom=False)
                boxmm(GT, 'int_white', (cx - 0.017, cy - TRAY_W / 2 + 0.006, mz), (cx + 0.017, cy + TRAY_W / 2 - 0.006, mz + 0.022), bottom=False)
                cyl(GT, 'int_orange', (cx, cy + s * 0.07, mz), (cx, cy + s * 0.07, tz1 + 0.05), 0.005, 4)
                # ------------- plants by stage
                pc = lambda px, py: (cx + px, cy + py, mz)
                if tier == 0 and s == -1:     # front lower: leafy greens, mature -> young towards the door
                    for k, (px, py) in enumerate(((-0.12, -0.06), (-0.12, 0.06), (0.12, -0.06), (0.12, 0.06))):
                        sd = ci * 3.1 + ri * 1.7 + k
                        if ci in (0, 1):
                            butterhead(PM, pc(px, py), 0.085 + 0.01 * ((k + ci) % 2), 'int_leaf', 1, sd)
                        elif ci in (2, 3):
                            romaine(PM, pc(px, py), 0.21 + 0.02 * (k % 2), sd)
                        elif ci == 4:
                            mizuna(PM, pc(px, py), 0.17, sd)
                        else:
                            young(PY, pc(px, py), 0.06, 'int_leaf_light', sd)
                elif tier == 0 and s == 1:    # back lower: 'Red Robin' dwarf tomatoes on stakes
                    for k, px in enumerate((-0.11, 0.11)):
                        sd = ci * 2.3 + ri * 1.1 + k * 0.7
                        if ci <= 3:
                            tomato(PM, PF, pc(px, 0), 0.33 + 0.02 * ((ci + k) % 2), 3 if ci <= 1 else 2, sd)
                        else:
                            tomato(PY, PF, pc(px, 0), 0.20, 0, sd)
                else:                          # upper tier nursery under white LEDs
                    pts = [(px, py) for px in (-0.171, -0.069, 0.069, 0.171) for py in (-0.051, 0.051)]
                    for k, (px, py) in enumerate(pts):
                        sd = ci * 1.3 + k * 0.9
                        if ci in (0, 1):
                            young(PY, pc(px, py), 0.042, 'int_leaf_red' if (s == 1 and ci == 1) else 'int_leaf_light', sd)
                        elif ci in (2, 3):
                            seedling(PS, pc(px, py), 1.9, sd)
                        else:
                            seedling(PS, pc(px, py), 1.25, sd)
        # irrigation: header along the back of the tier + one drip line per tray column to each insert funnel
        hz = tz1 + 0.035
        pipe(GI, 'int_blue', [(-1.80, s * 0.948, hz), (RACK_X1 - 0.03, s * 0.948, hz)], 0.014)
        for cx in COLS:
            pipe(GI, 'int_dark', [(cx, s * 0.948, hz), (cx, s * 0.47, hz)], 0.006)
            for ry in TRAY_ROWS:
                cyl(GI, 'int_dark', (cx, s * (ry - 0.03), hz), (cx, s * (ry - 0.03), tz1 - 0.012), 0.008, 6)
    # riser + feed to the station, return drain under the lower shelf
    pipe(GI, 'int_blue', [(-1.80, s * 0.948, SHELF[1][1] + TRAY_H + 0.035), (-1.80, s * 0.948, 0.27), (-1.80, s * 0.60, 0.27)], 0.014)
    pipe(GI, 'int_white', [(RACK_X1 - 0.05, s * 0.58, 0.272), (-1.80, s * 0.58, 0.272), (STATION_X1 + 0.005, s * 0.58, 0.272)], 0.02)
    # LED: two magenta red+blue bars under the upper shelf (lower tier), a white LED panel over the upper tier
    for yl in (0.50, 0.78):
        boxmm(GL, 'int_dark', (RACK_X0 + 0.04, s * yl - 0.03, LED_LOW_Z), (RACK_X1 - 0.04, s * yl + 0.03, SHELF[1][0]))
        boxmm(GG, 'glow_grow', (RACK_X0 + 0.06, s * yl - 0.022, LED_LOW_Z - 0.004), (RACK_X1 - 0.06, s * yl + 0.022, LED_LOW_Z), top=False)
    for k in range(3):
        xa = RACK_X0 + 0.04 + k * (RACK_X1 - RACK_X0 - 0.08) / 3
        xb = xa + (RACK_X1 - RACK_X0 - 0.08) / 3 - 0.02
        ya, yb = sorted((s * 0.40, s * 0.86))
        boxmm(GL, 'int_white', (xa, ya, LED_UP_Z), (xb, yb, LED_UP_Z + 0.016))
        boxmm(GG, 'glow_white', (xa + 0.02, ya + 0.02, LED_UP_Z - 0.004), (xb - 0.02, yb - 0.02, LED_UP_Z), top=False)
    # environment sensor pod (temperature, RH, CO2, light) on an inner post
    boxmm(GR, 'int_white', (0.17 - 0.035, s * 0.305 - 0.02, 1.07), (0.17 + 0.035, s * 0.305 + 0.02, 1.17))
    cyl(GG, 'glow_status', (0.17, s * 0.284, 1.15), (0.17, s * 0.279, 1.15), 0.009, 8)

# walkway: dark deck plate + steel slats from the station to the door
boxmm(GW, 'int_dark', (STATION_X1, -0.33, FLOOR + 0.001), (2.06, 0.33, FLOOR + 0.011))
x = STATION_X1 + 0.06
while x < 2.03:
    boxmm(GW, 'int_steel', (x - 0.015, -0.32, FLOOR + 0.011), (x + 0.015, 0.32, FLOOR + 0.019), bottom=False)
    x += 0.16

# ---------------------------------------------------------------- west end: environment + nutrient station
GE = 'greenhouse_env'
SX0, SX1 = STATION_X0, STATION_X1
boxmm(GE, 'int_white', (SX0, -0.08, FLOOR), (SX1, 0.62, 1.20))                     # control cabinet
for z0, z1 in ((0.30, 0.62),):
    for yy in (-0.03, 0.57):
        boxmm(GE, 'int_dark', (SX1, yy - 0.005, z0), (SX1 + 0.006, yy + 0.005, z1))
    for zz in (z0, z1):
        boxmm(GE, 'int_dark', (SX1, -0.03, zz - 0.005), (SX1 + 0.006, 0.57, zz + 0.005))
boxmm(GE, 'int_orange', (SX1, 0.47, 0.44), (SX1 + 0.03, 0.50, 0.52))                 # latch
# screen (no text): dark glass + three glowing status shapes
boxmm(GE, 'int_window', (SX1, 0.06, 0.70), (SX1 + 0.012, 0.42, 0.90))
boxmm(GG, 'glow_status', (SX1 + 0.012, 0.11, 0.80 - 0.035), (SX1 + 0.016, 0.17, 0.80 + 0.035), top=False)
boxmm(GG, 'glow_white', (SX1 + 0.012, 0.21, 0.80 - 0.035), (SX1 + 0.016, 0.27, 0.80 + 0.035), top=False)
boxmm(GG, 'glow_grow', (SX1 + 0.012, 0.31, 0.80 - 0.035), (SX1 + 0.016, 0.37, 0.80 + 0.035), top=False)
# fan grille (air circulation) - blades are a separate node greenhouse_fan
FAN_C = Vector((SX1 + 0.012, 0.27, 1.06))
boxmm(GE, 'int_dark', (SX1, 0.13, 0.94), (SX1 + 0.008, 0.41, 1.18))
inner = [(0.11 * math.cos(2 * PI * i / 16), 0.11 * math.sin(2 * PI * i / 16)) for i in range(16)]
outer = [(0.13 * math.cos(2 * PI * i / 16), 0.13 * math.sin(2 * PI * i / 16)) for i in range(16)]
ring_x(GE, 'int_steel', [(FAN_C.y + a, FAN_C.z + b) for a, b in inner], [(FAN_C.y + a, FAN_C.z + b) for a, b in outer], SX1 + 0.008, SX1 + 0.03)
for k in (-1, 1):
    boxmm(GE, 'int_steel', (SX1 + 0.028, FAN_C.y - 0.12, FAN_C.z + k * 0.04 - 0.004), (SX1 + 0.034, FAN_C.y + 0.12, FAN_C.z + k * 0.04 + 0.004))
# nutrient bay: plinth, reservoir tank, pump, valves
boxmm(GE, 'int_white', (SX0, -0.62, FLOOR), (SX1, -0.08, 0.30))
boxmm(GE, 'int_white', (SX0, -0.62, 0.30), (SX0 + 0.025, -0.08, 1.20))
boxmm(GE, 'int_white', (SX0, -0.62, 1.00), (SX1, -0.08, 1.03))                      # shelf
cyl(GE, 'int_blue', (-1.965, -0.37, 0.30), (-1.965, -0.37, 0.82), 0.16, 16)
cyl(GE, 'int_white', (-1.965, -0.37, 0.82), (-1.965, -0.37, 0.85), 0.13, 16)
boxmm(GE, 'int_window', (-1.965 + 0.155, -0.40, 0.36), (-1.965 + 0.166, -0.34, 0.78))  # level sight glass
cyl(GE, 'int_steel', (-1.84, -0.15, 0.36), (-1.97, -0.15, 0.36), 0.055, 12)          # pump
pipe(GI, 'int_blue', [(-1.965, -0.22, 0.75), (-1.965, -0.15, 0.75), (-1.90, -0.15, 0.75), (-1.90, -0.15, 0.42)], 0.014)
pipe(GI, 'int_blue', [(-1.84, -0.15, 0.36), (-1.80, -0.15, 0.36), (-1.80, -0.60, 0.36), (-1.80, -0.60, 0.27)], 0.014)
pipe(GI, 'int_blue', [(-1.80, -0.15, 0.36), (-1.80, 0.60, 0.36), (-1.80, 0.60, 0.27)], 0.014)
for yy in (-0.40, 0.40):
    cyl(GI, 'int_orange', (-1.80, yy, 0.36), (-1.80, yy, 0.42), 0.012, 6)
    boxmm(GI, 'int_orange', (-1.83, yy - 0.008, 0.42), (-1.77, yy + 0.008, 0.435))
# seed starter box on the shelf: starter plugs with pre-germinated seedlings (Plant Atrium practice)
boxmm(GE, 'int_white', (-2.10, -0.52, 1.03), (-1.82, -0.18, 1.08), top=False)
for ix in range(3):
    for iy in range(3):
        px, py = -2.05 + ix * 0.09, -0.46 + iy * 0.11
        cyl(GE, 'int_media', (px, py, 1.03), (px, py, 1.07), 0.022, 6)
        seedling(PS, (px, py, 1.07), 0.8, ix + iy)
# duct collar where ASTRA's west environmental-unit pipe comes through the west cap: ASTRA pipe(-2.3, 0.85, 0.3) ->
# (-2.0, 1.05, 0.3) -> (-1.9, 1.113, 0.3) (three) crosses x -2.155 at three y ~0.95, z +0.30 = Blender (y -0.30, z 0.95).
# The game cuts the pipe at the cap (HANDOFF), so the collar on the nutrient-bay back wall marks where it enters.
cyl(GE, 'int_steel', (SX0 + 0.025, -0.30, 0.95), (SX0 + 0.05, -0.30, 0.95), 0.04, 10)
cyl(GE, 'int_dark', (SX0 + 0.05, -0.30, 0.95), (SX0 + 0.052, -0.30, 0.95), 0.026, 10)

# ---------------------------------------------------------------- east end: submarine-style hatch
GD = 'greenhouse_doorframe'
op_in = stadium(D_A, D_ZB, D_ZT, 12)
op_out = stadium(D_A + D_BAND, D_ZB - D_BAND, D_ZT + D_BAND, 12, zmin=FLOOR + 0.004)
ring_x(GD, 'int_white', op_in, op_out, FR_X0, FR_X1)
# dark seal on the inside face (hatch seats against it from the pressurised side)
seal_out = stadium(D_A + 0.05, D_ZB - 0.05, D_ZT + 0.05, 12, zmin=FLOOR + 0.004)
ring_x(GD, 'int_dark', op_in, seal_out, FR_X0 - 0.003, FR_X0)
# dark lining just inside the opening so the closed leaf reads as a separate part from outside
ring_x(GD, 'int_dark', stadium(D_A - 0.012, D_ZB + 0.012, D_ZT - 0.012, 12), op_in, FR_X0, FR_X0 + 0.035)
# hinge barrels (static) and outer grab bars
for zz in (0.55, 1.25):
    cyl(GD, 'int_steel', (HINGE.x, HINGE.y, zz - 0.07), (HINGE.x, HINGE.y, zz + 0.07), 0.018, 8)
    boxmm(GD, 'int_steel', (HINGE.x, HINGE.y - 0.01, zz - 0.05), (FR_X0, HINGE.y + 0.03, zz + 0.05))
for yy in (-0.47, 0.47):
    pipe(GD, 'int_orange', [(FR_X1, yy, 0.70), (FR_X1 + 0.05, yy, 0.72), (FR_X1 + 0.05, yy, 1.08), (FR_X1, yy, 1.10)], 0.012)
# entry/status lamp above the hatch inside
cyl('greenhouse_doorlamp', 'glow_status', (FR_X0 - 0.002, 0, D_ZT + 0.05), (FR_X0 - 0.03, 0, D_ZT + 0.05), 0.025, 10)
boxmm('greenhouse_doorlamp', 'glow_white', (FR_X0 - 0.02, -0.18, D_ZT + 0.035), (FR_X0, -0.08, D_ZT + 0.065))
boxmm('greenhouse_doorlamp', 'glow_white', (FR_X0 - 0.02, 0.08, D_ZT + 0.035), (FR_X0, 0.18, D_ZT + 0.065))

# leaf (built in place, then parented under the hinge pivot)
GLF = 'greenhouse_door_leaf'
leaf_out = stadium(LEAF_A, D_ZB - 0.04, D_ZT + 0.04, 12, zmin=0.262)
prism_x(GLF, 'int_white', leaf_out, LEAF_X0, LEAF_X1)
# round view port high on the leaf (Fig. 7 shows a round window at the top)
WZ = D_ZT - D_A + 0.02
for xx in (LEAF_X0 - 0.002, LEAF_X1 + 0.002):
    disc_x(GLF, 'int_window', xx, 0.0, WZ, 0.11, 16)
win_in = [(0.11 * math.cos(2 * PI * i / 16), WZ + 0.11 * math.sin(2 * PI * i / 16)) for i in range(16)]
win_out = [(0.14 * math.cos(2 * PI * i / 16), WZ + 0.14 * math.sin(2 * PI * i / 16)) for i in range(16)]
ring_x(GLF, 'int_steel', win_in, win_out, LEAF_X0 - 0.012, LEAF_X0)
# cross stiffeners on the inner face (Fig. 7 cross)
boxmm(GLF, 'int_steel', (LEAF_X0 - 0.02, -0.025, 0.30), (LEAF_X0, 0.025, WZ - 0.14))
boxmm(GLF, 'int_steel', (LEAF_X0 - 0.02, -LEAF_A + 0.03, 0.86), (LEAF_X0, LEAF_A - 0.03, 0.91))
# lever handles both faces (orange) + latch hub
for xx, dx in ((LEAF_X0, -1), (LEAF_X1, 1)):
    cyl(GLF, 'int_steel', (xx, -0.25, 0.95), (xx + dx * 0.05, -0.25, 0.95), 0.03, 10)
    boxmm(GLF, 'int_orange', (min(xx + dx * 0.04, xx + dx * 0.06), -0.27, 0.95 - 0.16), (max(xx + dx * 0.04, xx + dx * 0.06), -0.23, 0.95 + 0.02))
# hinge straps on the leaf
for zz in (0.55, 1.25):
    boxmm(GLF, 'int_steel', (LEAF_X0 - 0.008, HINGE.y - 0.32, zz - 0.035), (LEAF_X0, HINGE.y - 0.01, zz + 0.035))


# ---------------------------------------------------------------- objects + hierarchy
col = bpy.data.collections.new('GH_interior')
scene.collection.children.link(col)


def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.2
    e.location = loc
    col.objects.link(e)
    if parent:
        e.parent = parent
    return e


ROOT = empty('greenhouse_interior')
FURN = empty('greenhouse_furniture', ROOT)
GLOW = empty('greenhouse_glow', ROOT)
PIVOT = empty('greenhouse_door', ROOT, tuple(HINGE))
PLANTS = empty('greenhouse_plants', FURN)
FAN = empty('greenhouse_fan', FURN, tuple(FAN_C))

PARENT = {GR: FURN, GT: FURN, GI: FURN, GL: FURN, GW: FURN, GE: FURN, GD: FURN,
          PS: PLANTS, PY: PLANTS, PM: PLANTS, PF: PLANTS, GG: GLOW, 'greenhouse_doorlamp': GLOW, GLF: PIVOT}
groups = {}
for g in PARENT:
    if g in (GLF,):
        groups[g] = PIVOT
    elif g in (PS, PY, PM, PF):
        groups[g] = empty(g, PLANTS)
    else:
        groups[g] = PARENT[g]

# fan blades (child of greenhouse_fan, local frame; spin about the node's local X = three +x)
for k in range(5):
    a = 2 * PI * k / 5
    M = Matrix.Rotation(a, 4, 'X') @ Matrix.Translation((0.012, 0, 0.055)) @ Matrix.Rotation(0.45, 4, 'Z')
    v, f = box_geo(0.008, 0.045, 0.09)
    A.add('greenhouse_fan_blades', 'int_steel', T(v, M), f)
cyl('greenhouse_fan_blades', 'int_dark', (0, 0, 0), (0.03, 0, 0), 0.025, 10)

SHORT = lambda m: m.replace('int_', '').replace('glow_', 'glow')
objs = []
for (g, m), (V, F, S) in A.d.items():
    me = bpy.data.meshes.new(f'{g}_{SHORT(m)}')
    if g == GLF:   # leaf geometry relative to the hinge pivot
        V = [tuple(Vector(v) - HINGE) for v in V]
    me.from_pydata(V, [], F)
    me.validate()
    for p, sm in zip(me.polygons, S):
        p.use_smooth = sm
    me.materials.append(MATS[m])
    ob = bpy.data.objects.new(f'{g}_{SHORT(m)}', me)
    col.objects.link(ob)
    ob['gh_group'] = g
    if g == 'greenhouse_fan_blades':
        ob.parent = FAN
    else:
        ob.parent = groups[g]
        if groups[g] is PIVOT:
            pass
    objs.append(ob)

# parent inverse: empties are at their locations, children built in world space -> compensate
bpy.context.view_layer.update()
for ob in objs:
    if ob.parent in (PIVOT,):
        ob.location = (0, 0, 0)          # verts already relative to HINGE
    elif ob.parent is FAN:
        ob.location = (0, 0, 0)
    else:
        ob.matrix_parent_inverse = ob.parent.matrix_world.inverted()

# ---------------------------------------------------------------- DoorOpen clip
act = bpy.data.actions.new('DoorOpen')
PIVOT.animation_data_create()
PIVOT.animation_data.action = act
PIVOT.rotation_mode = 'XYZ'
PIVOT.rotation_euler = (0, 0, 0)
PIVOT.keyframe_insert('rotation_euler', index=2, frame=1)
PIVOT.rotation_euler = (0, 0, math.radians(OPEN_DEG))
PIVOT.keyframe_insert('rotation_euler', index=2, frame=F_END)


def fcurves_of(action):
    try:
        return list(action.fcurves)
    except AttributeError:
        out = []
        for layer in action.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    out += list(bag.fcurves)
        return out


for fc in fcurves_of(act):
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'
        kp.easing = 'AUTO'
        kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
act.use_fake_user = True
scene.frame_set(1)

# ---------------------------------------------------------------- reference shell (excluded from export)
with bpy.data.libraries.load(REF, link=False) as (src, dst):
    dst.objects = [n for n in src.objects]
ref_col = bpy.data.collections.new('REF_shell')
scene.collection.children.link(ref_col)
for ob in dst.objects:
    if ob is not None:
        ref_col.objects.link(ob)
REF_OBJS = {ob.name: ob for ob in ref_col.objects}

# ---------------------------------------------------------------- stats + fit check
deps = bpy.context.evaluated_depsgraph_get()


def tri_count(obs):
    n = 0
    for ob in obs:
        if ob.type == 'MESH':
            me = ob.evaluated_get(deps).to_mesh()
            n += sum(len(p.vertices) - 2 for p in me.polygons)
            ob.evaluated_get(deps).to_mesh_clear()
    return n


EXPORT_OBJS = [o for o in col.objects]
TRIS = tri_count(EXPORT_OBJS)
MAT_USED = sorted({s.material.name for o in EXPORT_OBJS if o.type == 'MESH' for s in o.material_slots if s.material})
print(f'GH_STATS tris={TRIS} materials={len(MAT_USED)} {MAT_USED}')

# ---- the game's hide/cut rule (HANDOFF.md), applied to REF_shell so fit check + renders see what the game shows.
# Dump mesh index -> ASTRA part (life.ts buildGreenhouse; dump = one mesh per ASTRA material after finalize()).
HIDE_WHOLE = (9, 12) + tuple(range(17, 27))   # door panel white rbox, GROW-1 label, troughs/media/irrigation/LED/plants
FLOOR_IDX = (4, 5, 6, 7)                       # contact shadow, skid, deck plate: floor contact is allowed
HOLE = dict(a=0.45, cb=0.65, ct=1.12, zmin=0.236)   # east-cap doorway hole (Blender y/z), inside our frame ring


def hole_outline():
    pts = stadium(HOLE['a'], HOLE['cb'] - HOLE['a'], HOLE['ct'] + HOLE['a'], 16)
    out = []
    for y, z in pts:
        p = (round(y, 5), round(max(z, HOLE['zmin']), 5))
        if not out or p != out[-1]:
            out.append(p)
    return out if out[0] != out[-1] else out[:-1]


def cap_with_hole(ob):
    """East cap glass rebuilt as ASTRA's half disc (R 1.5, 32 segments) with the doorway hole (HANDOFF option A)."""
    bm = bmesh.new()
    inv = ob.matrix_world.inverted()
    outer = [(1.5 * math.cos(PI * i / 32), AX_Z + 1.5 * math.sin(PI * i / 32)) for i in range(33)]
    loops = []
    for loop in (outer, hole_outline()):
        vs = [bm.verts.new(inv @ Vector((X_CAP, -y, z))) for y, z in loop]
        loops += [bm.edges.new((vs[k], vs[(k + 1) % len(vs)])) for k in range(len(vs))]
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=loops)
    bm.to_mesh(ob.data)
    bm.free()


def game_hide_rule():
    for ob in ref_col.objects:
        i = int(ob.name.split('_')[1])
        mw = ob.matrix_world
        if i in HIDE_WHOLE:
            ob.hide_render = ob.hide_viewport = True
            ob['gh_hidden'] = True
            continue
        if i == 2:
            cap_with_hole(ob)
            continue
        if i == 10:     # dark #2a3140: drop LED housings + door dark panel (three y < 1.55), keep status-lamp base
            kill = lambda c: c.z < 1.55
        elif i == 11:   # steel #9aa3b4: drop rack legs, LED struts, door handle, env pipe inside the west cap (x > -2.2)
            kill = lambda c: c.x > -2.2
        else:
            continue
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        dead = [f for f in bm.faces if kill(mw @ f.calc_center_median())]
        bmesh.ops.delete(bm, geom=dead, context='FACES')
        bm.to_mesh(ob.data)
        bm.free()
        ob['gh_cut_faces'] = len(dead)


game_hide_rule()
bpy.context.view_layer.update()
CUT_LOG = {ob.name: ob['gh_cut_faces'] for ob in ref_col.objects if 'gh_cut_faces' in ob}
print('GH_CUT', CUT_LOG)

shell_bvh = []
for ob in ref_col.objects:
    i = int(ob.name.split('_')[1])
    if ob.get('gh_hidden') or i in FLOOR_IDX:
        continue
    me = ob.data
    shell_bvh.append((ob.name, BVHTree.FromPolygons([ob.matrix_world @ v.co for v in me.vertices], [tuple(p.vertices) for p in me.polygons])))
EXCL = (GD, GLF)
worst = (9, '')
bad_env, bad_near, nverts = [], [], 0
for ob in EXPORT_OBJS:
    if ob.type != 'MESH' or ob.get('gh_group') in EXCL:
        continue
    mw = ob.matrix_world
    for v in ob.data.vertices:
        p = mw @ v.co
        nverts += 1
        r = math.hypot(p.y, p.z - AX_Z)
        if (p.z > AX_Z and r > R_OK) or abs(p.x) > X_OK or p.z < FLOOR - 0.002:
            bad_env.append((ob.name, tuple(round(c, 3) for c in p)))
        for nm, bvh in shell_bvh:
            hit = bvh.find_nearest(p, 0.2)
            if hit[0] is not None:
                d = hit[3]
                if d < worst[0]:
                    worst = (d, nm, ob.name)
                if d < 0.02:
                    bad_near.append((ob.name, nm, round(d, 4)))
# door parts (frame ring + leaf): they pass through the east cap glass by design (the game cuts the doorway hole);
# clearance to every other kept shell part (ribs, stringers, cap frame bars, status lamp, ...)
door_min, door_nv = (9, ''), 0
for ob in EXPORT_OBJS:
    if ob.type == 'MESH' and ob.get('gh_group') in EXCL:
        for v in ob.data.vertices:
            p = ob.matrix_world @ v.co
            door_nv += 1
            for nm, bvh in shell_bvh:
                if nm.startswith('greenhouse_2_'):
                    continue
                hit = bvh.find_nearest(p, 0.3)
                if hit[0] is not None and hit[3] < door_min[0]:
                    door_min = (hit[3], nm)
FIT = {'vertices_tested': nverts, 'outside_envelope': len(bad_env), 'closer_than_2cm_to_shell': len(bad_near),
       'min_clearance_m': round(worst[0], 4), 'min_between': worst[1:],
       'door_vertices': door_nv, 'door_min_to_shell_m': round(door_min[0], 4), 'door_min_part': door_min[1],
       'samples_env': bad_env[:5], 'samples_near': bad_near[:5]}
print('GH_FIT', json.dumps(FIT))

# door swing check: leaf vertices at the open pose vs rack boxes and envelope
scene.frame_set(F_END)
bpy.context.view_layer.update()
leaf_obs = [o for o in EXPORT_OBJS if o.get('gh_group') == GLF]
sw_bad = 0
for ob in leaf_obs:
    for v in ob.data.vertices:
        p = ob.matrix_world @ v.co
        if RACK_X0 - 0.01 < p.x < RACK_X1 + 0.01 and Y_IN - 0.02 < abs(p.y) < Y_OUT + 0.02:
            sw_bad += 1
        if p.z > AX_Z and math.hypot(p.y, p.z - AX_Z) > R_OK:
            sw_bad += 1
print('GH_SWING open-pose collisions:', sw_bad)
scene.frame_set(1)

FIT_JSON = {
    'building': 'greenhouse', 'units': 'ASTRA native metres; Blender frame (x, y, z) = three (x, -z, y)',
    'method': ('every vertex of every exported mesh except the door frame ring + leaf: (1) analytic envelope = '
               'intended arch r <= 1.455 about the axis (Blender y 0, z 0.213; rib inner edge 1.475 - 2 cm), '
               '|x| <= 2.16 (cap frame bars 2.18 - 2 cm), z >= deck top 0.232 - 2 mm; (2) BVH nearest distance >= 2 cm '
               'to every ASTRA shell mesh that stays in the game after the HANDOFF hide/cut rule (deck/skid/contact '
               'shadow excluded: furniture stands on the deck)'),
    'game_hide_rule_applied': {'hidden_whole_dump_meshes': list(HIDE_WHOLE), 'faces_cut': CUT_LOG,
                               'east_cap': 'rebuilt with doorway hole ' + json.dumps(HOLE)},
    'result': {'violations_outside_door_parts': len(bad_env) + len(bad_near), **FIT},
    'door_open_pose': {'frame': F_END, 'leaf_vertices_hitting_racks_or_envelope': sw_bad},
    'tris': TRIS, 'materials': MAT_USED,
}
json.dump(FIT_JSON, open(os.path.join(HERE, 'fit_check.json'), 'w'), indent=1)

# ---------------------------------------------------------------- walk.json (three coords: x, z = -blender y)
walk = [
    {'name': 'rack_north', 'x': round((RACK_X0 + RACK_X1) / 2, 3), 'z': -0.64, 'hx': round((RACK_X1 - RACK_X0) / 2, 3), 'hz': 0.30, 'yaw': 0},
    {'name': 'rack_south', 'x': round((RACK_X0 + RACK_X1) / 2, 3), 'z': 0.64, 'hx': round((RACK_X1 - RACK_X0) / 2, 3), 'hz': 0.30, 'yaw': 0},
    {'name': 'env_station', 'x': round((SX0 + SX1) / 2, 3), 'z': 0.0, 'hx': round((SX1 - SX0) / 2, 3), 'hz': 0.62, 'yaw': 0},
    {'name': 'door_frame_north', 'x': 2.25, 'z': -0.45, 'hx': 0.13, 'hz': 0.05, 'yaw': 0},
    {'name': 'door_frame_south', 'x': 2.25, 'z': 0.45, 'hx': 0.13, 'hz': 0.05, 'yaw': 0},
    {'name': 'door_leaf_open', 'x': round(HINGE.x - LEAF_A, 3), 'z': round(-(HINGE.y - 0.03), 3), 'hx': round(LEAF_A, 3), 'hz': 0.03, 'yaw': 0},
    {'name': 'wall_east_north', 'x': 2.2, 'z': -1.0, 'hx': 0.03, 'hz': 0.5, 'yaw': 0},
    {'name': 'wall_east_south', 'x': 2.2, 'z': 1.0, 'hx': 0.03, 'hz': 0.5, 'yaw': 0},
    {'name': 'wall_west', 'x': -2.2, 'z': 0.0, 'hx': 0.03, 'hz': 1.5, 'yaw': 0},
    {'name': 'glazing_north', 'x': 0.0, 'z': -1.45, 'hx': 2.2, 'hz': 0.05, 'yaw': 0},
    {'name': 'glazing_south', 'x': 0.0, 'z': 1.45, 'hx': 2.2, 'hz': 0.05, 'yaw': 0},
]
json.dump(walk, open(os.path.join(HERE, 'walk.json'), 'w'), indent=1)

# ---------------------------------------------------------------- export GLB (only GH_interior)
for lc in bpy.context.view_layer.layer_collection.children:
    if lc.collection.name == 'REF_shell':
        lc.exclude = True
    if lc.collection.name == 'GH_interior':
        bpy.context.view_layer.active_layer_collection = lc
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'greenhouse_interior.glb'), export_format='GLB',
                          use_active_collection=True, export_yup=True, export_apply=True,
                          export_animations=True, export_animation_mode='ACTIONS', export_cameras=False,
                          export_lights=False, export_extras=False)
for lc in bpy.context.view_layer.layer_collection.children:
    if lc.collection.name == 'REF_shell':
        lc.exclude = False


# ---------------------------------------------------------------- renders (Cycles CPU)
def look(cam, target):
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def setup_render():
    sc = scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 32
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 960, 540
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
    w = bpy.data.worlds.new('W')
    sc.world = w
    if not w.node_tree:
        w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (0.05, 0.055, 0.07, 1)
    bg.inputs[1].default_value = 1.0
    sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
    sun.data.energy = 3.0
    sun.rotation_euler = (math.radians(50), 0, math.radians(35))
    sc.collection.objects.link(sun)
    for nm, loc, e in (('KeyIn', (0.0, 0.0, 1.55), 60), ('KeyIn2', (-1.2, 0.0, 1.5), 40), ('KeyDoor', (3.6, -1.5, 1.6), 120)):
        L = bpy.data.objects.new(nm, bpy.data.lights.new(nm, 'POINT'))
        L.data.energy = e
        L.data.shadow_soft_size = 0.4
        L.location = loc
        sc.collection.objects.link(L)
    for m in MATS.values():   # brighter glow for the stills only (export keeps strength 1)
        if m.name.startswith('glow_'):
            m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 6.0
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def shot(cam, name, loc, target, lens, shell, frame=1):
    for ob in ref_col.objects:
        ob.hide_render = (not shell) or bool(ob.get('gh_hidden'))
    scene.frame_set(frame)
    cam.location = loc
    look(cam, target)
    cam.data.lens = lens
    cam.data.clip_start = 0.02
    scene.render.filepath = os.path.join(HERE, 'renders', name)
    bpy.ops.render.render(write_still=True)
    print('GH_RENDER', name)


bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'greenhouse_interior.blend'))

if DO_RENDER:
    os.makedirs(os.path.join(HERE, 'renders'), exist_ok=True)
    cam = setup_render()   # REF_shell already shows the game view (game_hide_rule above)
    only = [a for a in ARGS if a.startswith('--only=')]
    want = only[0][7:].split(',') if only else ['cutaway', 'inside_eye', 'door_closed', 'door_open']
    if 'cutaway' in want:
        shot(cam, 'cutaway.png', (1.7, -4.3, 2.3), (-0.15, 0.25, 0.55), 24, False)
    if 'inside_eye' in want:
        shot(cam, 'inside_eye.png', (1.95, -0.05, 1.55), (-2.0, 0.0, 0.85), 16, False)
    if 'inside_low' in want or not only:
        shot(cam, 'inside_low.png', (2.0, -0.12, 0.95), (-2.0, 0.05, 0.75), 16, False)
    # same camera for closed / open (east end, a little off-axis so the swung leaf reads)
    if 'door_closed' in want:
        shot(cam, 'door_closed.png', (4.5, -1.05, 1.2), (1.2, 0.1, 0.8), 26, True, 1)
    if 'door_open' in want:
        shot(cam, 'door_open.png', (4.5, -1.05, 1.2), (1.2, 0.1, 0.8), 26, True, F_END)
    if 'door_side' in want or not only:   # extra: 3/4 view of the open hatch from the front-east
        shot(cam, 'door_open_side.png', (4.6, -2.3, 1.35), (2.2, 0.0, 0.85), 30, True, F_END)
print('GH_DONE')
