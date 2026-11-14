"""scene_moon.py - the Moon environment + the "step 5" still (worker D). Local only, not for the repo.

  B=/Applications/Blender.app/Contents/MacOS/Blender
  $B -b --factory-startup -P scene_moon.py -- [--lander PATH] [--samples N] [--res WxH] [--out-blend PATH]
                                              [--render PATH | --no-render] [--dicing PX]

Builds (all procedural, numpy):
  * terrain: one polar-grid mesh centred on the camera (vertex spacing grows with distance, ~3.5 km radius),
    macro sum-of-sines relief + ~300 soft-rimmed craters + far hills/crater rims, Cycles adaptive subdivision with
    shader displacement for the fine grain and the boot prints (float EXR height map, real indentations).
  * rocks: faceted icosphere prototypes (plane cuts + noise), ~4500 pebbles/cobbles/rocks/boulders merged into
    two meshes, partly sunk into the ground.
  * Earth (NASA globe GLB) far away, lit by the same sun -> crescent; sun lamp low from the left; an emissive
    sun disc on the left horizon + compositor Glare (fog glow + streaks).
  * astronaut (appended rig, Idle @ frame 0), seen from behind; lander appended from lander_v2.blend (or a
    placeholder) tilted 4 deg, ground flattened under its pads.
World layout: the lander root sits at the world origin (so lander-space animation works unchanged); the camera
looks along +Y. Composition numbers are given in the camera frame CF (camera on the ground at CF (0,0)).
"""
import bpy, bmesh, sys, os, math, time
import numpy as np
from mathutils import Vector, Matrix

T0 = time.time()
HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.abspath(os.path.join(HERE, '..', '..'))
A = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def opt(name, default=None):
    return A[A.index(name) + 1] if name in A else default


LANDER_PATH = os.path.expanduser(opt('--lander', os.path.join(HERE, 'lander_v2.blend')))
SAMPLES = int(opt('--samples', 32))
RX, RY = (int(v) for v in opt('--res', '960x540').lower().split('x'))
OUT_BLEND = os.path.expanduser(opt('--out-blend', os.path.join(HERE, 'scene_moon.blend')))
RENDER = None if '--no-render' in A else os.path.expanduser(
    opt('--render', os.path.join(HERE, 'renders', 'step5_still.png')))
DICING = float(opt('--dicing', 1.0))
BORDER = opt('--border')   # x0,x1,y0,y1 (0..1, y from the bottom) - crop render for detail checks
ASTRO_BLEND = os.path.join(PROJ, 'game3d', 'characters', '_work', 'astronaut_rig.blend')
EARTH_GLB = os.path.join(PROJ, 'game3d', 'assets', 'earth-globe.glb')
TEXDIR = os.path.join(HERE, 'moon_tex')
os.makedirs(TEXDIR, exist_ok=True)
os.makedirs(os.path.join(HERE, 'renders'), exist_ok=True)


def log(*a):
    print('MOON %6.1fs' % (time.time() - T0), *a, flush=True)


# ------------------------------------------------------------------ composition (camera frame CF, metres/degrees)
CAM_H = 1.60          # eye height above the ground under the camera
LENS = 35.0
PITCH = -2.0          # camera pitch (negative = down) -> horizon ~40% from the top
ASTRO_CF = (-0.62, 7.0)
ASTRO_FACE_EXTRA = -18.0  # extra yaw (deg) on top of "face the lander"
LANDER_CF = (5.3, 27.5)
LANDER_YAW = -38.0    # front (-Y local) turned toward camera-left
LANDER_TILT = 4.0     # askew: leans to the right (about world +Y)
EARTH_AZ, EARTH_EL, EARTH_DIST = -6.0, 7.6, 4000.0
EARTH_FRAC = 1.0 / 40.0   # diameter / frame width
SUN_AZ, SUN_EL = -58.0, 5.5     # the lamp (shadows go right, a little toward the camera)
DISC_AZ, DISC_EL = -25.6, 2.0   # the visible disc / flare at the left frame edge
SUN_STRENGTH = 9.0
FILL_STRENGTH = float(opt('--fill', 0.08))
FILL_AZ, FILL_EL = 165.0, 30.0
LS_C = 0.40          # Lommel-Seeliger normalisation (near ground ~1x)
EXPOSURE = float(opt('--exposure', 1.0))

OFF = np.array(LANDER_CF, dtype=np.float64)   # world = CF - OFF  (lander root at the world origin)


def W(x, y):
    return x - OFF[0], y - OFF[1]


def cf(x, y):
    return x + OFF[0], y + OFF[1]


def dir_azel(az, el):
    az, el = math.radians(az), math.radians(el)
    return Vector((math.cos(el) * math.sin(az), math.cos(el) * math.cos(az), math.sin(el)))


SUN_DIR = dir_azel(SUN_AZ, SUN_EL)


# ------------------------------------------------------------------ scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = 30
sc.frame_start, sc.frame_end = 0, 300
sc.frame_current = 0
sc.unit_settings.system = 'METRIC'


def new_col(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or sc.collection).children.link(c)
    return c


COL_ENV = new_col('MOON_env')
COL_ROCKS = new_col('MOON_rocks', COL_ENV)
COL_SKY = new_col('MOON_sky', COL_ENV)


def link(o, col):
    col.objects.link(o)
    return o


def mesh_from_np(name, V, faces_flat, starts, col, smooth=True):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(V))
    me.vertices.foreach_set('co', np.ascontiguousarray(V, dtype=np.float32).ravel())
    me.loops.add(len(faces_flat))
    me.loops.foreach_set('vertex_index', np.ascontiguousarray(faces_flat, dtype=np.int32))
    me.polygons.add(len(starts))
    me.polygons.foreach_set('loop_start', np.ascontiguousarray(starts, dtype=np.int32))
    me.update(calc_edges=True)
    if smooth:
        me.polygons.foreach_set('use_smooth', np.ones(len(starts), dtype=bool))
        me.update()
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    return o


def nodes_of(mat):
    try:
        mat.use_nodes = True
    except Exception:
        pass
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return nt, nt.nodes, nt.links


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ lander placement (needed by the terrain)
M_LANDER_ROT = Matrix.Rotation(math.radians(LANDER_TILT), 4, 'Y') @ Matrix.Rotation(math.radians(LANDER_YAW), 4, 'Z')
N_LANDER = (M_LANDER_ROT.to_3x3() @ Vector((0, 0, 1))).normalized()
PAD_SINK = 0.035

# ------------------------------------------------------------------ terrain height function (world coords)
R_MOON = 1737400.0


def make_sines(n, wl0, wl1, rms_slope, seed):
    r = np.random.default_rng(seed)
    wl = np.exp(r.uniform(np.log(wl0), np.log(wl1), n))
    ang = r.uniform(0, 2 * np.pi, n)
    k = 2 * np.pi / wl
    c = rms_slope / (2 * np.pi * np.sqrt(n / 2.0))
    return k * np.cos(ang), k * np.sin(ang), r.uniform(0, 2 * np.pi, n), c * wl


def eval_sines(S, x, y):
    kx, ky, ph, a = S
    out = np.zeros_like(x)
    for i in range(len(a)):
        out += a[i] * np.sin(kx[i] * x + ky[i] * y + ph[i])
    return out


S_MACRO = make_sines(56, 10.0, 450.0, 0.020, 11)
S_SMALL = make_sines(40, 1.5, 10.0, 0.013, 12)
S_HILL = make_sines(48, 90.0, 2200.0, 0.20, 13)
S_HILL2 = make_sines(30, 40.0, 260.0, 0.30, 14)
S_RING = make_sines(24, 60.0, 900.0, 0.55, 15)
S_RING2 = make_sines(20, 25.0, 120.0, 0.9, 16)


def build_craters():
    r = np.random.default_rng(5)
    cr = []   # (x_cf, y_cf, R, depth, rim)
    hand = [(-4.6, 11.5, 1.7, 0.30), (3.2, 10.2, 0.85, 0.16), (-8.5, 19.0, 3.4, 0.62), (12.0, 15.5, 2.4, 0.45),
            (-1.8, 34.0, 5.5, 0.9), (15.0, 44.0, 7.5, 1.3), (-16.0, 58.0, 13.0, 2.2), (-6.0, 92.0, 22.0, 3.6),
            (-32.0, 125.0, 34.0, 5.5), (42.0, 170.0, 45.0, 7.5), (1.5, 15.5, 1.2, 0.22), (-2.8, 22.0, 2.0, 0.34)]
    for x, y, R, d in hand:
        cr.append((x, y, R, d * 0.32, 0.30))

    def ok(x, y, R):
        if y < 1.5:
            return False
        lx, ly = x - LANDER_CF[0], y - LANDER_CF[1]
        if math.hypot(lx, ly) < 9.5 + R * 1.3:
            return False
        if math.hypot(x - ASTRO_CF[0], y - ASTRO_CF[1]) < 1.0 + R * 1.4:
            return False
        if y < ASTRO_CF[1] + 0.8 and -1.6 - R * 1.3 < x < 1.0 + R * 1.3:   # boot-print corridor
            return False
        return True

    def scatter(n, r0, r1, R0, R1, az0=-48, az1=40, dfrac=(0.08, 0.13), relmin=0.02):
        k = 0
        tries = 0
        while k < n and tries < n * 50:
            tries += 1
            rr = math.sqrt(r.uniform(r0 * r0, r1 * r1))
            az = math.radians(r.uniform(az0, az1))
            x, y = rr * math.sin(az), rr * math.cos(az)
            Rmin = max(R0, relmin * rr)
            if Rmin >= R1:
                continue
            R = Rmin * (R1 / Rmin) ** (r.uniform() ** 2.2)
            if not ok(x, y, R):
                continue
            cr.append((x, y, R, R * r.uniform(*dfrac), r.uniform(0.18, 0.38)))
            k += 1

    scatter(150, 2.0, 25.0, 0.18, 1.5, dfrac=(0.05, 0.10))
    scatter(60, 25.0, 120.0, 0.6, 5.0, dfrac=(0.045, 0.08))
    scatter(50, 120.0, 600.0, 4.0, 40.0, -55, 50, dfrac=(0.06, 0.12))
    scatter(18, 500.0, 3200.0, 60.0, 380.0, -45, 40, dfrac=(0.10, 0.16))
    scatter(160, 300.0, 3300.0, 18.0, 140.0, -45, 40, dfrac=(0.12, 0.2), relmin=0.012)
    return cr


CRATERS = build_craters()


def height(x, y, with_lander=True):
    """terrain height (world coords). x, y float64 arrays."""
    xc, yc = x + OFF[0], y + OFF[1]          # camera frame
    rc = np.sqrt(xc * xc + yc * yc)
    h = eval_sines(S_MACRO, x, y) + eval_sines(S_SMALL, x, y)
    # far hills / mountains: ramp in with distance from the camera, lower toward the sun azimuth (shadow safety)
    ramp = smoothstep(160.0, 1100.0, rc)
    if np.any(ramp > 0):
        m = ramp > 0
        hx, hy = x[m], y[m]
        rid = eval_sines(S_HILL2, hx, hy)
        hills = eval_sines(S_HILL, hx, hy) + 1.6 * (8.0 - np.abs(rid)) * smoothstep(500, 1600, rc[m])   # ridged crests
        az = np.arctan2(xc[m], yc[m])
        sunatt = 1.0 - 0.6 * np.exp(-((az - math.radians(SUN_AZ)) / 0.55) ** 2)
        near_tame = 0.35 + 0.65 * smoothstep(700, 1500, rc[m])
        h[m] += ramp[m] * sunatt * (hills + 14.0) * (0.6 + 0.6 * smoothstep(900, 2800, rc[m])) * near_tame
        # ring of rugged hills (old crater wall) - azimuth-dependent height, rises between 1.3 and 2.4 km
        ringh = (55.0 + eval_sines(S_RING, az * 900.0, np.zeros_like(az)) + 0.45 * np.abs(eval_sines(S_RING2, az * 900.0, rc[m] * 0.35)))
        prof = smoothstep(1250.0, 1900.0, rc[m]) * (1.0 - 0.45 * smoothstep(2300.0, 3400.0, rc[m]))
        h[m] += sunatt * np.maximum(ringh, 8.0) * prof
    # craters
    for (cx, cy, R, d, rim) in CRATERS:
        wx, wy = W(cx, cy)
        m = (np.abs(x - wx) < 1.9 * R) & (np.abs(y - wy) < 1.9 * R)
        if not m.any():
            continue
        q = np.sqrt((x[m] - wx) ** 2 + (y[m] - wy) ** 2) / R
        h[m] += -d * np.clip(1 - q * q, 0, None) ** 2 + rim * d * np.exp(-((q - 1.0) / 0.28) ** 2)
    if with_lander:
        # flatten to the (tilted) plane of the pad bottoms around the lander
        z0 = float(eval_sines(S_MACRO, np.zeros(1), np.zeros(1))[0] + eval_sines(S_SMALL, np.zeros(1), np.zeros(1))[0])
        plane = z0 - (N_LANDER.x * x + N_LANDER.y * y) / N_LANDER.z + PAD_SINK
        rl = np.sqrt(x * x + y * y)
        w = smoothstep(9.0, 5.2, rl)
        h = h * (1 - w) + plane * w
    h -= rc * rc / (2 * R_MOON)   # curvature of the Moon
    return h


Z_LANDER = float(height(np.zeros(1), np.zeros(1))[0]) - PAD_SINK   # root z (pads sink PAD_SINK)
Z_CAMGROUND = float(height(np.array([W(0, 0)[0]]), np.array([W(0, 0)[1]]))[0])
CAM_POS_EARLY = (W(0, 0)[0], W(0, 0)[1], Z_CAMGROUND + CAM_H)

# ------------------------------------------------------------------ terrain mesh (polar grid around the camera)


def build_terrain():
    q = 1.0085
    r0, r1 = 0.9, 3600.0
    nr = int(math.log(r1 / r0) / math.log(q)) + 1
    radii = r0 * q ** np.arange(nr)
    # angular stations: dense in the view wedge (az -62..+48), coarse elsewhere (full 360 for reuse)
    dense = np.arange(math.radians(-62), math.radians(48), 0.0058)
    a_lo, a_hi = dense[0], dense[-1]
    rest = 2 * math.pi - (a_hi - a_lo)
    nrest = 70
    # smooth growth from dense spacing to coarse: use a cosine-weighted distribution in the rest
    t = np.linspace(0, 1, nrest + 2)[1:-1]
    gaps = 0.0058 + (1 - np.cos(2 * np.pi * t)) * 0.5
    gaps = gaps / gaps.sum() * rest
    rest_angles = a_hi + np.cumsum(gaps)[:-0 or None]
    angles = np.concatenate([dense, rest_angles[rest_angles < a_lo + 2 * math.pi - 1e-4]])
    na = len(angles)
    R_, A_ = np.meshgrid(radii, angles, indexing='ij')   # (nr, na)
    xc = R_ * np.sin(A_)
    yc = R_ * np.cos(A_)
    x = (xc - OFF[0]).ravel()
    y = (yc - OFF[1]).ravel()
    z = height(x, y)
    V = np.column_stack([x, y, z])
    # centre vertex
    cx, cy = W(0, 0)
    V = np.vstack([V, [[cx, cy, Z_CAMGROUND]]])
    ci = len(V) - 1
    idx = np.arange(nr * na).reshape(nr, na)
    i00 = idx[:-1, :]
    i01 = np.roll(idx[:-1, :], -1, axis=1)
    i10 = idx[1:, :]
    i11 = np.roll(idx[1:, :], -1, axis=1)
    # quads (counter-clockwise seen from above: angle increases clockwise from +Y, so order accordingly)
    # angle grows clockwise (seen from above), so (r,a)->(r,a+1)->(r+1,a+1)->(r+1,a) is counter-clockwise: normal +Z
    quads = np.stack([i00, i01, i11, i10], axis=-1).reshape(-1, 4)
    tri = np.stack([np.full(na, ci), np.roll(idx[0, :], -1), idx[0, :]], axis=-1)
    faces_flat = np.concatenate([quads.ravel(), tri.ravel()])
    starts = np.concatenate([np.arange(0, quads.size, 4), quads.size + np.arange(0, tri.size, 3)])
    o = mesh_from_np('MoonGround', V, faces_flat, starts, COL_ENV)
    # make normals point up
    me = o.data
    me.update()
    nz = np.zeros(len(me.polygons) * 3, dtype=np.float32)
    me.polygons.foreach_get('normal', nz)
    log('ground normal z mean', float(np.mean(nz.reshape(-1, 3)[:, 2])))
    log('terrain', len(V), 'verts', len(starts), 'faces', 'rings', nr, 'angles', na)
    return o


ground = build_terrain()

# ------------------------------------------------------------------ boot prints (EXR height map for the shader)
PR_X0, PR_X1, PR_Y0, PR_Y1 = -1.8, 1.2, 0.8, 7.7   # CF box
PR_PX = 0.0025


def trail_prints():
    P0, P1, P2 = np.array([0.32, 1.2]), np.array([-0.62, 4.2]), np.array([-0.62, 6.45])
    t = np.linspace(0, 1, 2000)[:, None]
    B = (1 - t) ** 2 * P0 + 2 * (1 - t) * t * P1 + t ** 2 * P2
    seg = np.linalg.norm(np.diff(B, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seg)])
    r = np.random.default_rng(3)
    prints = []
    step = 0.67
    k = 0
    si = s[-1] - 0.05   # last print just behind the astronaut's feet, walk backwards to the camera
    while si > 0.0:
        i = np.searchsorted(s, si)
        i = min(max(i, 1), len(B) - 1)
        p = B[i]
        tg = B[i] - B[i - 1]
        tg /= np.linalg.norm(tg)
        nrm = np.array([-tg[1], tg[0]])   # left of the walking direction
        side = 1 if k % 2 == 0 else -1     # last print = left foot
        pos = p + nrm * side * 0.105 + r.normal(0, 0.012, 2)
        ang = math.atan2(tg[0], tg[1]) - side * math.radians(5) + r.normal(0, math.radians(2.5))
        prints.append((pos[0], pos[1], ang, r.uniform(0.85, 1.1), side))
        si -= step * r.uniform(0.95, 1.05)
        k += 1
    return prints, B


PRINTS, TRAIL = trail_prints()


def build_print_map():
    nx = int(round((PR_X1 - PR_X0) / PR_PX))
    ny = int(round((PR_Y1 - PR_Y0) / PR_PX))
    H = np.zeros((ny, nx), np.float32)
    D = np.zeros((ny, nx), np.float32)
    xs = PR_X0 + (np.arange(nx) + 0.5) * PR_PX
    ys = PR_Y0 + (np.arange(ny) + 0.5) * PR_PX
    L = 0.165
    for (px, py, ang, dep, side) in PRINTS:
        i0 = max(0, int((px - 0.45 - PR_X0) / PR_PX)); i1 = min(nx, int((px + 0.45 - PR_X0) / PR_PX))
        j0 = max(0, int((py - 0.45 - PR_Y0) / PR_PX)); j1 = min(ny, int((py + 0.45 - PR_Y0) / PR_PX))
        if i1 <= i0 or j1 <= j0:
            continue
        X, Y = np.meshgrid(xs[i0:i1] - px, ys[j0:j1] - py)
        tx, ty = math.sin(ang), math.cos(ang)       # toe direction
        u = X * tx + Y * ty                        # along the foot (+ toe)
        v = X * ty - Y * tx                        # across
        hw = 0.054 + 0.012 * np.exp(-((u - 0.055) / 0.06) ** 2) - 0.006 * np.exp(-((u + 0.035) / 0.035) ** 2)
        m = ((np.abs(u) / L) ** 4.5 + (np.abs(v) / hw) ** 4.5) ** (1 / 4.5)
        wall = smoothstep(1.0, 0.78, m)
        inner = smoothstep(0.88, 0.70, m)
        depth = 0.019 * dep * (1.0 + 0.2 * np.clip(-u / L, 0, 1))
        ph = (u - 0.55 * np.abs(v)) / 0.026
        bars = (0.5 + 0.5 * np.cos(2 * np.pi * ph)) ** 3
        # heel: horseshoe-ish smoother pattern
        bars = np.where(u < -0.10, 0.5 * bars, bars)
        hgt = -depth * wall + 0.0065 * bars * inner
        rim = 0.0055 * np.exp(-((m - 1.10) / 0.10) ** 2) * (1.0 + 0.7 * np.clip(u / L, 0, 1))
        H[j0:j1, i0:i1] += (hgt + rim * (1 - wall)).astype(np.float32)
        D[j0:j1, i0:i1] = np.maximum(D[j0:j1, i0:i1], smoothstep(2.1, 0.95, m).astype(np.float32))
    # disturbed soil between consecutive prints (scuffs) - a soft band along the trail
    img = np.zeros((ny, nx, 4), np.float32)
    img[..., 0] = H
    img[..., 1] = D
    img[..., 3] = 1.0
    path = os.path.join(TEXDIR, 'step5_prints.exr')
    im = bpy.data.images.new('step5_prints', nx, ny, alpha=True, float_buffer=True)
    im.colorspace_settings.name = 'Non-Color'    # else the EXR gets sRGB-encoded (x12.92 near 0)
    im.pixels.foreach_set(img.ravel())
    im.filepath_raw = path
    im.file_format = 'OPEN_EXR'
    im.save()
    bpy.data.images.remove(im)
    im = bpy.data.images.load(path)
    im.colorspace_settings.name = 'Non-Color'
    chk = np.zeros(nx * ny * 4, np.float32)
    im.pixels.foreach_get(chk)
    log('print map check (reloaded) R min/max', float(chk[0::4].min()), float(chk[0::4].max()))
    log('print map', nx, 'x', ny, 'prints', len(PRINTS), 'min h', float(H.min()))
    return im


PRINT_IMG = build_print_map()

# ------------------------------------------------------------------ ground material


def mat_ground():
    m = bpy.data.materials.new('MOON_regolith')
    nt, N, L = nodes_of(m)
    out = N.new('ShaderNodeOutputMaterial'); out.location = (1200, 0)
    tc = N.new('ShaderNodeTexCoord'); tc.location = (-1400, 0)
    # print map lookup (object coords == world coords; map CF box to 0..1)
    wx0, wy0 = W(PR_X0, PR_Y0)
    sub = N.new('ShaderNodeVectorMath'); sub.operation = 'SUBTRACT'
    sub.inputs[1].default_value = (wx0, wy0, 0)
    mul = N.new('ShaderNodeVectorMath'); mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = (1.0 / (PR_X1 - PR_X0), 1.0 / (PR_Y1 - PR_Y0), 1.0)
    L.new(tc.outputs['Object'], sub.inputs[0]); L.new(sub.outputs[0], mul.inputs[0])
    it = N.new('ShaderNodeTexImage'); it.image = PRINT_IMG; it.extension = 'CLIP'; it.interpolation = 'Cubic'
    it.location = (-800, 300)
    L.new(mul.outputs[0], it.inputs['Vector'])
    sep = N.new('ShaderNodeSeparateColor'); sep.location = (-500, 300)
    L.new(it.outputs['Color'], sep.inputs[0])

    def noise(scale, detail, rough, loc, dim='3D'):
        n = N.new('ShaderNodeTexNoise'); n.location = loc
        n.noise_dimensions = dim
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        L.new(tc.outputs['Object'], n.inputs['Vector'])
        return n

    def math_(op, a, b=None, loc=(0, 0)):
        n = N.new('ShaderNodeMath'); n.operation = op; n.location = loc
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L.new(v, n.inputs[i])
        return n.outputs[0]

    # displacement: prints + fine grain + small lumps + tiny craterlets (Voronoi)
    g1 = noise(38.0, 6.0, 0.55, (-800, -200))
    g2 = noise(5.0, 3.0, 0.5, (-800, -400))
    d1 = math_('MULTIPLY', math_('SUBTRACT', g1.outputs['Fac'], 0.5), 0.007)
    d2 = math_('MULTIPLY', math_('SUBTRACT', g2.outputs['Fac'], 0.5), 0.020)
    def crater_field(scale, k_depth, thresh, seed_off):
        # Voronoi F1 craters: radius (cell units) from the cell colour, only cells with colour > thresh get one
        vor = N.new('ShaderNodeTexVoronoi')
        vor.feature = 'F1'; vor.inputs['Scale'].default_value = scale
        vor.inputs['Randomness'].default_value = 1.0
        vor.voronoi_dimensions = '3D'
        off = N.new('ShaderNodeVectorMath'); off.operation = 'ADD'
        off.inputs[1].default_value = (seed_off, seed_off * 0.37, 0.0)
        L.new(tc.outputs['Object'], off.inputs[0]); L.new(off.outputs[0], vor.inputs['Vector'])
        cr_r = math_('MULTIPLY', vor.outputs['Color'], 0.30)          # colour -> float (avg)
        q = math_('DIVIDE', vor.outputs['Distance'], cr_r)
        qq = math_('MINIMUM', q, 1.0)
        bowl = math_('POWER', math_('SUBTRACT', 1.0, math_('MULTIPLY', qq, qq)), 2.0)
        rim = math_('MULTIPLY', math_('EXPONENT', math_('MULTIPLY', math_('POWER', math_('SUBTRACT', q, 1.0), 2.0), -14.0)), 0.25)
        has = math_('GREATER_THAN', vor.outputs['Color'], thresh)
        return math_('MULTIPLY', math_('MULTIPLY', math_('SUBTRACT', rim, bowl), has), math_('MULTIPLY', cr_r, k_depth))

    # distance from the step-5 camera (object coords == world coords) -> far-field detail masks
    cdist = N.new('ShaderNodeVectorMath'); cdist.operation = 'DISTANCE'
    L.new(tc.outputs['Object'], cdist.inputs[0]); cdist.inputs[1].default_value = (CAM_POS_EARLY[0], CAM_POS_EARLY[1], 0.0)

    def dmask(d0, d1):
        mr = N.new('ShaderNodeMapRange'); mr.interpolation_type = 'SMOOTHSTEP'
        mr.inputs['From Min'].default_value = d0; mr.inputs['From Max'].default_value = d1
        L.new(cdist.outputs['Value'], mr.inputs['Value'])
        return mr.outputs[0]

    crat = crater_field(2.2, 0.05, 0.55, 0.0)                                   # tiny (<=14 cm)
    crat_mid = math_('MULTIPLY', crater_field(0.16, 0.75, 0.5, 17.0), dmask(55.0, 140.0))     # ~2 m craters
    crat_far = math_('MULTIPLY', crater_field(0.022, 6.5, 0.42, 51.0), dmask(140.0, 420.0))   # ~12 m craters
    gfar = noise(0.05, 8.0, 0.62, (-800, -900))
    d_far = math_('MULTIPLY', math_('MULTIPLY', math_('SUBTRACT', gfar.outputs['Fac'], 0.5), 7.0), dmask(150.0, 700.0))
    crat = math_('ADD', crat, math_('ADD', crat_mid, math_('ADD', crat_far, d_far)))
    disp_sum = math_('ADD', math_('ADD', d1, d2), math_('ADD', crat, sep.outputs['Red']))
    dn = N.new('ShaderNodeDisplacement'); dn.location = (900, -300)
    dn.inputs['Midlevel'].default_value = 0.0
    dn.inputs['Scale'].default_value = 1.0
    L.new(disp_sum, dn.inputs['Height'])
    L.new(dn.outputs[0], out.inputs['Displacement'])
    # albedo
    a1 = noise(0.035, 3.0, 0.5, (-800, 800))
    a2 = noise(0.5, 4.0, 0.55, (-800, 600))
    a3 = noise(70.0, 2.0, 0.6, (-800, 1000))
    alb = math_('MULTIPLY', math_('ADD', 0.62, math_('MULTIPLY', a1.outputs['Fac'], 0.75)),
                math_('ADD', 0.80, math_('MULTIPLY', a2.outputs['Fac'], 0.40)))
    alb = math_('MULTIPLY', alb, math_('ADD', 0.86, math_('MULTIPLY', a3.outputs['Fac'], 0.28)))
    alb = math_('MULTIPLY', alb, math_('SUBTRACT', 1.0, math_('MULTIPLY', sep.outputs['Green'], 0.30)))
    a4 = noise(0.0035, 3.0, 0.5, (-800, 1200))
    alb = math_('MULTIPLY', alb, math_('ADD', 0.72, math_('MULTIPLY', a4.outputs['Fac'], 0.56)))
    alb = math_('MULTIPLY', alb, 0.205)
    col = N.new('ShaderNodeCombineColor'); col.location = (500, 400)
    L.new(math_('MULTIPLY', alb, 1.03), col.inputs[0]); L.new(alb, col.inputs[1])
    L.new(math_('MULTIPLY', alb, 0.96), col.inputs[2])
    # Lommel-Seeliger-like regolith: radiance ~ mu0/(mu0+mu) instead of Lambert's mu0. Cycles' diffuse already
    # gives mu0, so scale the albedo by C/(mu0+mu+eps) (sun direction is known) -> bright lunar horizon at grazing view
    geo = N.new('ShaderNodeNewGeometry'); geo.location = (-300, 900)
    mu = N.new('ShaderNodeVectorMath'); mu.operation = 'DOT_PRODUCT'
    L.new(geo.outputs['Normal'], mu.inputs[0]); L.new(geo.outputs['Incoming'], mu.inputs[1])
    mu0 = N.new('ShaderNodeVectorMath'); mu0.operation = 'DOT_PRODUCT'
    L.new(geo.outputs['Normal'], mu0.inputs[0]); mu0.inputs[1].default_value = tuple(SUN_DIR)
    den = math_('ADD', math_('ADD', math_('MAXIMUM', mu0.outputs['Value'], 0.0), math_('MAXIMUM', mu.outputs['Value'], 0.0)), 0.07)
    lsf = math_('MINIMUM', math_('DIVIDE', LS_C, den), 2.6)
    colls = N.new('ShaderNodeVectorMath'); colls.operation = 'SCALE'
    L.new(col.outputs[0], colls.inputs[0]); L.new(lsf, colls.inputs['Scale'])
    bs = N.new('ShaderNodeBsdfDiffuse'); bs.location = (800, 300)
    bs.inputs['Roughness'].default_value = 1.0
    L.new(colls.outputs[0], bs.inputs['Color'])
    L.new(bs.outputs[0], out.inputs['Surface'])
    try:
        m.displacement_method = 'BOTH'
    except Exception:
        m.cycles.displacement_method = 'BOTH'
    return m


ground.data.materials.append(mat_ground())
sm = ground.modifiers.new('Adaptive', 'SUBSURF')
sm.subdivision_type = 'CATMULL_CLARK'
sm.levels = 0
sm.render_levels = 1
try:
    sm.use_adaptive_subdivision = True
    sm.adaptive_space = 'PIXEL'
    sm.adaptive_pixel_size = 1.0
except Exception as e:
    log('adaptive subdivision API problem', e)

# ------------------------------------------------------------------ rocks


def rock_proto(seed, subdiv):
    r = np.random.default_rng(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv + 1, radius=1.0)   # bmesh: 1 = icosahedron
    V = np.array([v.co[:] for v in bm.verts], dtype=np.float64)
    F = np.array([[v.index for v in f.verts] for f in bm.faces], dtype=np.int64)
    bm.free()
    V *= r.uniform([0.85, 0.65, 0.45], [1.15, 1.0, 0.85])
    for _ in range(int(r.integers(6, 11))):
        n = r.normal(size=3)
        n[2] *= 0.6
        n /= np.linalg.norm(n)
        d = r.uniform(0.45, 0.8) * np.max(V @ n)
        s = V @ n
        over = s > d
        V[over] -= np.outer(s[over] - d, n)
    nrm = V / np.linalg.norm(V, axis=1)[:, None]
    for _ in range(5):
        k = r.normal(size=3)
        k /= np.linalg.norm(k)
        f = r.uniform(2.5, 7.0)
        V += nrm * (0.035 * np.sin(f * (V @ k) + r.uniform(0, 6.3)))[:, None]
    zlo = np.percentile(V[:, 2], 22)
    low = V[:, 2] < zlo
    V[low, 2] = zlo + (V[low, 2] - zlo) * 0.35
    V -= (V.max(0) + V.min(0)) / 2
    V /= (V.max(0) - V.min(0)).max()
    return V, F


def rand_rot(r, full):
    if full:
        q = r.normal(size=4)
        q /= np.linalg.norm(q)
        w, x, y, z = q
    else:
        yaw = r.uniform(0, 2 * np.pi)
        ax = r.normal(size=2)
        tilt = r.uniform(0, 0.35)
        c = math.cos(yaw / 2), math.sin(yaw / 2)
        w, x, y, z = c[0], 0.0, 0.0, c[1]
        # apply a small tilt about a horizontal axis
        a = np.array([ax[0], ax[1], 0.0]); a /= np.linalg.norm(a)
        t = np.array([math.cos(tilt / 2), *(a * math.sin(tilt / 2))])
        # quaternion product t * (w,x,y,z)
        w, x, y, z = (t[0] * w - t[1] * x - t[2] * y - t[3] * z,
                      t[0] * x + t[1] * w + t[2] * z - t[3] * y,
                      t[0] * y - t[1] * z + t[2] * w + t[3] * x,
                      t[0] * z + t[1] * y - t[2] * x + t[3] * w)
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


PADS_W = []
for k in range(4):
    a = math.radians(LANDER_YAW) + k * math.pi / 2
    p = M_LANDER_ROT @ Vector((0, -3.70, 0)).to_4d()
    v = Matrix.Rotation(k * math.pi / 2, 4, 'Z') @ Vector((0, -3.70, 0))
    v = M_LANDER_ROT @ v
    PADS_W.append((v.x, v.y))


def rock_ok(xc, yc, size):
    if yc < 1.3:
        return False
    if math.hypot(xc - ASTRO_CF[0], yc - ASTRO_CF[1]) < 0.55 + size:
        return False
    if yc < 7.6 and -1.5 < xc < 1.0:
        d = np.min(np.hypot(TRAIL[:, 0] - xc, TRAIL[:, 1] - yc))
        if d < 0.30 + size * 0.6:
            return False
    wx, wy = W(xc, yc)
    if math.hypot(wx, wy) < 2.4 + size:
        return False
    for px, py in PADS_W:
        if math.hypot(wx - px, wy - py) < 0.75 + size:
            return False
    return True


def build_rocks():
    r = np.random.default_rng(99)
    protos = {s: [rock_proto(1000 * s + i, s) for i in range(10)] for s in (1, 2, 3)}
    protos[4] = [rock_proto(5000 + i, 4) for i in range(4)]
    classes = [  # (count, r0, r1, size0, size1, subdiv, sink0, sink1, full_rot, az0, az1)
        (2800, 1.5, 12.0, 0.015, 0.05, 1, 0.35, 0.6, True, -42, 36),
        (2400, 12.0, 32.0, 0.025, 0.08, 1, 0.3, 0.55, True, -40, 34),
        (220, 1.5, 22.0, 0.06, 0.18, 2, 0.3, 0.55, False, -42, 36),
        (520, 22.0, 70.0, 0.09, 0.30, 2, 0.25, 0.5, False, -40, 34),
        (30, 3.0, 40.0, 0.22, 0.65, 3, 0.2, 0.45, False, -42, 36),
        (170, 40.0, 180.0, 0.3, 0.9, 2, 0.2, 0.45, False, -40, 34),
        (26, 30.0, 320.0, 0.9, 2.8, 3, 0.25, 0.45, False, -38, 32),
        (3, 14.0, 40.0, 0.75, 1.3, 4, 0.25, 0.4, False, 14, 30),
    ]
    VS, FS = [], []
    nv = 0
    count = 0
    for (n, r0, r1, s0, s1, sub, k0, k1, full, az0, az1) in classes:
        cand = []
        tries = 0
        while len(cand) < n and tries < n * 30:
            tries += 1
            rr = math.sqrt(r.uniform(r0 * r0, r1 * r1))
            az = math.radians(r.uniform(az0, az1))
            xc, yc = rr * math.sin(az), rr * math.cos(az)
            size = s0 * (s1 / s0) ** (r.uniform() ** 1.7)
            if rock_ok(xc, yc, size):
                cand.append((xc, yc, size))
        if not cand:
            continue
        C = np.array(cand)
        wx, wy = C[:, 0] - OFF[0], C[:, 1] - OFF[1]
        ext = C[:, 2] * 0.5
        sx = np.concatenate([wx, wx - ext, wx + ext, wx, wx])
        sy = np.concatenate([wy, wy, wy, wy - ext, wy + ext])
        hs = height(sx, sy).reshape(5, -1)
        hmin = hs.min(0)
        hz = np.minimum(hs[0], hmin + 0.3 * (hs[0] - hmin))
        for i, (xc, yc, size) in enumerate(cand):
            V, F = protos[sub][int(r.integers(len(protos[sub])))]
            R = rand_rot(r, full)
            Vt = (V * size) @ R.T
            zmin, zmax = Vt[:, 2].min(), Vt[:, 2].max()
            z = hz[i] - zmin - r.uniform(k0, k1) * (zmax - zmin)
            VS.append(Vt + np.array([wx[i], wy[i], z]))
            FS.append(F + nv)
            nv += len(V)
        count += len(cand)
    V = np.vstack(VS)
    F = np.vstack(FS)
    o = mesh_from_np('MoonRocks', V, F.ravel(), np.arange(0, F.size, 3), COL_ROCKS)
    try:
        o.data.set_sharp_from_angle(angle=math.radians(38))
    except Exception as e:
        log('sharp edges', e)
    log('rocks', count, 'verts', len(V))
    return o


rocks = build_rocks()


def mat_rock():
    m = bpy.data.materials.new('MOON_rock')
    nt, N, L = nodes_of(m)
    out = N.new('ShaderNodeOutputMaterial'); out.location = (900, 0)
    tc = N.new('ShaderNodeTexCoord'); tc.location = (-900, 0)
    n1 = N.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 9.0
    n1.inputs['Detail'].default_value = 6.0
    L.new(tc.outputs['Object'], n1.inputs['Vector'])
    n2 = N.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 0.7
    L.new(tc.outputs['Object'], n2.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB'); ramp.location = (-300, 200)
    ramp.color_ramp.elements[0].position = 0.3
    ramp.color_ramp.elements[0].color = (0.095, 0.093, 0.09, 1)
    ramp.color_ramp.elements[1].position = 0.75
    ramp.color_ramp.elements[1].color = (0.24, 0.235, 0.225, 1)
    mix0 = N.new('ShaderNodeMath'); mix0.operation = 'MULTIPLY_ADD'
    L.new(n1.outputs['Fac'], mix0.inputs[0]); mix0.inputs[1].default_value = 0.7
    L.new(n2.outputs['Fac'], mix0.inputs[2])
    mix0b = N.new('ShaderNodeMath'); mix0b.operation = 'MULTIPLY'
    L.new(mix0.outputs[0], mix0b.inputs[0]); mix0b.inputs[1].default_value = 0.62
    L.new(mix0b.outputs[0], ramp.inputs[0])
    # dust on the upward faces
    geo = N.new('ShaderNodeNewGeometry'); geo.location = (-600, -300)
    sxyz = N.new('ShaderNodeSeparateXYZ')
    L.new(geo.outputs['Normal'], sxyz.inputs[0])
    mr = N.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = 0.55
    mr.inputs['From Max'].default_value = 0.95
    mr.inputs['To Max'].default_value = 0.55
    L.new(sxyz.outputs['Z'], mr.inputs['Value'])
    mixc = N.new('ShaderNodeMix'); mixc.data_type = 'RGBA'; mixc.location = (300, 200)
    L.new(mr.outputs[0], mixc.inputs['Factor'])
    ca = [x for x in mixc.inputs if x.name == 'A' and x.type == 'RGBA'][0]
    cb = [x for x in mixc.inputs if x.name == 'B' and x.type == 'RGBA'][0]
    L.new(ramp.outputs['Color'], ca)
    cb.default_value = (0.21, 0.205, 0.198, 1)
    bump = N.new('ShaderNodeBump'); bump.location = (300, -200)
    bump.inputs['Strength'].default_value = 0.35
    bump.inputs['Distance'].default_value = 0.006
    n3 = N.new('ShaderNodeTexNoise'); n3.inputs['Scale'].default_value = 45.0
    n3.inputs['Detail'].default_value = 5.0
    L.new(tc.outputs['Object'], n3.inputs['Vector'])
    L.new(n3.outputs['Fac'], bump.inputs['Height'])
    bs = N.new('ShaderNodeBsdfDiffuse'); bs.location = (600, 0)
    bs.inputs['Roughness'].default_value = 0.9
    L.new([x for x in mixc.outputs if x.type == 'RGBA'][0], bs.inputs['Color'])
    L.new(bump.outputs[0], bs.inputs['Normal'])
    L.new(bs.outputs[0], out.inputs['Surface'])
    return m


rocks.data.materials.append(mat_rock())

# ------------------------------------------------------------------ camera
cam_d = bpy.data.cameras.new('Step5Cam')
cam_d.lens = LENS
cam_d.sensor_width = 36.0
cam_d.sensor_fit = 'HORIZONTAL'
cam_d.clip_start = 0.05
cam_d.clip_end = 20000.0
cam = bpy.data.objects.new('Step5Cam', cam_d)
link(cam, sc.collection)
cwx, cwy = W(0, 0)
CAM_POS = Vector((cwx, cwy, Z_CAMGROUND + CAM_H))
cam.location = CAM_POS
cam.rotation_euler = (math.radians(90 + PITCH), 0, 0)
sc.camera = cam
sc.render.resolution_x, sc.render.resolution_y = RX, RY
sc.render.resolution_percentage = 100

# ------------------------------------------------------------------ sun, disc, world
sun_d = bpy.data.lights.new('MoonSun', 'SUN')
sun_d.energy = SUN_STRENGTH
sun_d.angle = math.radians(0.53)
sun_d.color = (1.0, 0.985, 0.96)
sun = bpy.data.objects.new('MoonSun', sun_d)
link(sun, COL_SKY)
SUN_DIR = dir_azel(SUN_AZ, SUN_EL)
sun.rotation_euler = SUN_DIR.to_track_quat('Z', 'Y').to_euler()

# soft fill from behind the camera (stand-in for regolith bounce + earthshine): no shadows, very weak.
# Lets the floors of the boot prints and the shaded side of the suit show detail without lifting the sky.
fill_d = bpy.data.lights.new('MoonFill', 'SUN')
fill_d.energy = FILL_STRENGTH
fill_d.angle = math.radians(30.0)
fill_d.use_shadow = False
fill_d.color = (0.93, 0.96, 1.0)
fill = bpy.data.objects.new('MoonFill', fill_d)
link(fill, COL_SKY)
fill.rotation_euler = dir_azel(FILL_AZ, FILL_EL).to_track_quat('Z', 'Y').to_euler()
try:
    fill.visible_glossy = False
except Exception:
    pass

disc_dist = 9000.0
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=disc_dist * math.tan(math.radians(0.36)))
me = bpy.data.meshes.new('SunDisc')
bm.to_mesh(me)
bm.free()
disc = bpy.data.objects.new('SunDisc', me)
link(disc, COL_SKY)
disc.location = CAM_POS + dir_azel(DISC_AZ, DISC_EL) * disc_dist
for a in ('visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'):
    setattr(disc, a, False)
dm = bpy.data.materials.new('MOON_sundisc')
nt, N, L = nodes_of(dm)
o_ = N.new('ShaderNodeOutputMaterial')
em = N.new('ShaderNodeEmission')
em.inputs['Color'].default_value = (1.0, 0.97, 0.92, 1)
em.inputs['Strength'].default_value = 400.0
L.new(em.outputs[0], o_.inputs['Surface'])
me.materials.append(dm)

world = bpy.data.worlds.new('MoonWorld')
sc.world = world
nt, N, L = nodes_of(world)
wo = N.new('ShaderNodeOutputWorld')
lp = N.new('ShaderNodeLightPath')
bg = N.new('ShaderNodeBackground')
bg.inputs['Color'].default_value = (0.014, 0.015, 0.018, 1)   # faint earthshine/ambient fill
bg.inputs['Strength'].default_value = 1.0
blk = N.new('ShaderNodeBackground')
blk.inputs['Color'].default_value = (0, 0, 0, 1)
mx = N.new('ShaderNodeMixShader')
L.new(lp.outputs['Is Camera Ray'], mx.inputs['Fac'])
L.new(bg.outputs[0], mx.inputs[1])
L.new(blk.outputs[0], mx.inputs[2])
L.new(mx.outputs[0], wo.inputs['Surface'])

# ------------------------------------------------------------------ Earth


def add_earth():
    before = set(bpy.data.objects)
    try:
        bpy.ops.import_scene.gltf(filepath=EARTH_GLB)
    except Exception as e:
        log('earth import failed', e)
    new = [o for o in bpy.data.objects if o not in before]
    earth = None
    for o in new:
        if o.name.startswith('COL_'):
            bpy.data.objects.remove(o, do_unlink=True)
        else:
            earth = o
    if earth is None:
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=1.0)
        me = bpy.data.meshes.new('Earth')
        bm.to_mesh(me)
        bm.free()
        earth = bpy.data.objects.new('Earth', me)
        mt = bpy.data.materials.new('MOON_earth_fallback')
        nt, N, L = nodes_of(mt)
        o_ = N.new('ShaderNodeOutputMaterial')
        b = N.new('ShaderNodeBsdfPrincipled')
        b.inputs['Base Color'].default_value = (0.15, 0.3, 0.7, 1)
        L.new(b.outputs[0], o_.inputs['Surface'])
        me.materials.append(mt)
    for c in list(earth.users_collection):
        c.objects.unlink(earth)
    COL_SKY.objects.link(earth)
    earth.name = 'Earth'
    earth.parent = None
    half_w = math.atan(18.0 / LENS)
    ang_d = 2 * half_w * EARTH_FRAC
    rad = EARTH_DIST * math.tan(ang_d / 2)
    earth.location = CAM_POS + dir_azel(EARTH_AZ, EARTH_EL) * EARTH_DIST
    earth.rotation_euler = (math.radians(90 - 23.4), math.radians(10), math.radians(250))
    earth.scale = (rad, rad, rad)
    earth.visible_shadow = False
    # punch up the texture a little and make it matte
    for slot in earth.material_slots:
        mt = slot.material
        if mt and mt.node_tree:
            for n in mt.node_tree.nodes:
                if n.type == 'BSDF_PRINCIPLED':
                    n.inputs['Roughness'].default_value = 0.75
                    try:
                        n.inputs['Specular IOR Level'].default_value = 0.25
                    except Exception:
                        pass
    # bluer, brighter oceans/clouds (the crescent limb washes out otherwise)
    for slot in earth.material_slots:
        mt = slot.material
        if not (mt and mt.node_tree):
            continue
        nt_ = mt.node_tree
        for n in list(nt_.nodes):
            if n.type != 'BSDF_PRINCIPLED':
                continue
            bc = n.inputs['Base Color']
            if not bc.links:
                continue
            src = bc.links[0].from_socket
            hs = nt_.nodes.new('ShaderNodeHueSaturation')
            hs.inputs['Saturation'].default_value = 1.45
            hs.inputs['Value'].default_value = 1.35
            nt_.links.new(src, hs.inputs['Color'])
            nt_.links.new(hs.outputs['Color'], bc)
    # thin atmosphere shell: blue rim glow on the sunlit limb only (camera-visible only)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=1.03)
    me = bpy.data.meshes.new('EarthAtmo')
    bm.to_mesh(me)
    bm.free()
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), dtype=bool))
    atm = bpy.data.objects.new('EarthAtmo', me)
    COL_SKY.objects.link(atm)
    atm.location = earth.location
    atm.scale = earth.scale
    for a in ('visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'):
        setattr(atm, a, False)
    am = bpy.data.materials.new('MOON_earth_atmo')
    nt, N, L = nodes_of(am)
    o_ = N.new('ShaderNodeOutputMaterial')
    lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = 0.5
    rim = N.new('ShaderNodeMath'); rim.operation = 'POWER'; rim.inputs[1].default_value = 2.5
    L.new(lw.outputs['Facing'], rim.inputs[0])
    geo = N.new('ShaderNodeNewGeometry')
    dp = N.new('ShaderNodeVectorMath'); dp.operation = 'DOT_PRODUCT'
    L.new(geo.outputs['Normal'], dp.inputs[0]); dp.inputs[1].default_value = tuple(SUN_DIR)
    lit = N.new('ShaderNodeMapRange')
    lit.inputs['From Min'].default_value = -0.15
    lit.inputs['From Max'].default_value = 0.6
    L.new(dp.outputs['Value'], lit.inputs['Value'])
    st = N.new('ShaderNodeMath'); st.operation = 'MULTIPLY'
    L.new(rim.outputs[0], st.inputs[0]); L.new(lit.outputs[0], st.inputs[1])
    st2 = N.new('ShaderNodeMath'); st2.operation = 'MULTIPLY'; st2.inputs[1].default_value = 2.2
    L.new(st.outputs[0], st2.inputs[0])
    front = N.new('ShaderNodeMath'); front.operation = 'SUBTRACT'; front.inputs[0].default_value = 1.0
    L.new(geo.outputs['Backfacing'], front.inputs[1])
    st3 = N.new('ShaderNodeMath'); st3.operation = 'MULTIPLY'
    L.new(st2.outputs[0], st3.inputs[0]); L.new(front.outputs[0], st3.inputs[1])
    st2 = st3
    em = N.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (0.25, 0.5, 1.0, 1)
    L.new(st2.outputs[0], em.inputs['Strength'])
    tr = N.new('ShaderNodeBsdfTransparent')
    add = N.new('ShaderNodeAddShader')
    L.new(tr.outputs[0], add.inputs[0]); L.new(em.outputs[0], add.inputs[1])
    L.new(add.outputs[0], o_.inputs['Surface'])
    try:
        am.surface_render_method = 'BLENDED'
    except Exception:
        pass
    me.materials.append(am)
    log('earth radius', round(rad, 2), 'm at', EARTH_DIST)
    return earth


earth = add_earth()

# ------------------------------------------------------------------ astronaut


def add_suit_stripes(nt_, src, ob):
    """Orange suit stripes like the concept (waist belt, knees, upper arms), on the UNDEFORMED surface: 'Generated'
    coordinates stick to the skin while the armature moves it. Returns the new base-colour socket."""
    N = nt_.nodes
    L_ = nt_.links
    vs = [v.co for v in ob.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    tc = N.new('ShaderNodeTexCoord')
    rest = N.new('ShaderNodeVectorMath'); rest.operation = 'MULTIPLY_ADD'
    L_.new(tc.outputs['Generated'], rest.inputs[0])
    rest.inputs[1].default_value = tuple(mx - mn)
    rest.inputs[2].default_value = tuple(mn)
    sep = N.new('ShaderNodeSeparateXYZ')
    L_.new(rest.outputs['Vector'], sep.inputs[0])
    ax = N.new('ShaderNodeMath'); ax.operation = 'ABSOLUTE'
    L_.new(sep.outputs['X'], ax.inputs[0])

    def window(sock, a, b, e=0.006):
        """1 inside [a, b], soft edges e"""
        lo = N.new('ShaderNodeMapRange'); lo.interpolation_type = 'SMOOTHSTEP'
        lo.inputs['From Min'].default_value = a - e; lo.inputs['From Max'].default_value = a + e
        hi = N.new('ShaderNodeMapRange'); hi.interpolation_type = 'SMOOTHSTEP'
        hi.inputs['From Min'].default_value = b + e; hi.inputs['From Max'].default_value = b - e
        L_.new(sock, lo.inputs['Value']); L_.new(sock, hi.inputs['Value'])
        m = N.new('ShaderNodeMath'); m.operation = 'MULTIPLY'
        L_.new(lo.outputs[0], m.inputs[0]); L_.new(hi.outputs[0], m.inputs[1])
        return m.outputs[0]

    def both(a, b):
        m = N.new('ShaderNodeMath'); m.operation = 'MULTIPLY'
        L_.new(a, m.inputs[0]); L_.new(b, m.inputs[1])
        return m.outputs[0]

    def anyof(a, b):
        m = N.new('ShaderNodeMath'); m.operation = 'MAXIMUM'
        L_.new(a, m.inputs[0]); L_.new(b, m.inputs[1])
        return m.outputs[0]

    front = window(sep.outputs['Y'], -0.6, 0.17)          # not on the backpack (it sits behind y ~ 0.2)
    waist = both(both(window(sep.outputs['Z'], 0.905, 0.945), window(ax.outputs[0], -0.1, 0.36)), front)
    knees = both(window(sep.outputs['Z'], 0.405, 0.440), window(ax.outputs[0], 0.03, 0.34))
    arms = both(window(ax.outputs[0], 0.425, 0.465), window(sep.outputs['Z'], 1.15, 1.6))
    mask = anyof(anyof(waist, knees), arms)
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    L_.new(mask, mix.inputs['Factor'])
    ca = [x for x in mix.inputs if x.name == 'A' and x.type == 'RGBA'][0]
    cb = [x for x in mix.inputs if x.name == 'B' and x.type == 'RGBA'][0]
    L_.new(src, ca)
    cb.default_value = (0.72, 0.19, 0.02, 1)   # suit orange (linear)
    log('suit stripes added (rest bbox z %.2f..%.2f)' % (mn.z, mx.z))
    return [x for x in mix.outputs if x.type == 'RGBA'][0]


def append_astronaut():
    if not os.path.exists(ASTRO_BLEND):
        log('astronaut blend missing', ASTRO_BLEND)
        return None
    with bpy.data.libraries.load(ASTRO_BLEND, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n in ('AstronautRig', 'Astronaut')]
        dst.actions = list(src.actions)
    col = new_col('ASTRONAUT')
    rig = None
    for o in dst.objects:
        if o is None:
            continue
        col.objects.link(o)
        if o.type == 'ARMATURE':
            rig = o
    for a in dst.actions:
        if a:
            a.use_fake_user = True
    # fix the suit texture path (stored as //../astronaut_suit_clean.png in the source)
    for im in bpy.data.images:
        if im.packed_file or not im.filepath:
            continue
        p = bpy.path.abspath(im.filepath, library=im.library)
        if not os.path.exists(p):
            cand = os.path.join(os.path.dirname(ASTRO_BLEND), os.path.basename(im.filepath))
            if os.path.exists(cand):
                im.filepath = cand
                im.reload()
                log('fixed image path', im.name, cand)
    ax, ay = W(*ASTRO_CF)
    az = float(height(np.array([ax]), np.array([ay]))[0])
    rig.location = (ax, ay, az - 0.012)
    # rig faces -Y; face the lander (world origin) from behind the camera's view
    dx, dy = 0 - ax, 0 - ay
    face = math.atan2(dx, dy)            # azimuth from +Y toward +X
    rig.rotation_euler = (0, 0, math.pi - face + math.radians(ASTRO_FACE_EXTRA))
    act = bpy.data.actions.get('Idle')
    if act:
        ad = rig.animation_data_create()
        ad.action = act
        try:
            ad.action_slot = act.slots[0]
        except Exception as e:
            log('slot', e)
    # regolith dust on the boots / lower legs (this scene's copy of the suit material only)
    for o in col.objects:
        if o.type != 'MESH':
            continue
        for slot in o.material_slots:
            mt = slot.material
            if not mt or 'Suit' not in mt.name or not mt.node_tree:
                continue
            nt_ = mt.node_tree
            bsdf = next((n for n in nt_.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if bsdf is None or not bsdf.inputs['Base Color'].links:
                continue
            src = bsdf.inputs['Base Color'].links[0].from_socket
            src = add_suit_stripes(nt_, src, o)
            tc_ = nt_.nodes.new('ShaderNodeTexCoord')
            sz = nt_.nodes.new('ShaderNodeSeparateXYZ')
            nt_.links.new(tc_.outputs['Object'], sz.inputs[0])
            nz_ = nt_.nodes.new('ShaderNodeTexNoise'); nz_.inputs['Scale'].default_value = 9.0
            nz_.inputs['Detail'].default_value = 4.0
            nt_.links.new(tc_.outputs['Object'], nz_.inputs['Vector'])
            hz_ = nt_.nodes.new('ShaderNodeMath'); hz_.operation = 'MULTIPLY_ADD'
            nt_.links.new(nz_.outputs['Fac'], hz_.inputs[0]); hz_.inputs[1].default_value = 0.25
            nt_.links.new(sz.outputs['Z'], hz_.inputs[2])
            mr_ = nt_.nodes.new('ShaderNodeMapRange'); mr_.interpolation_type = 'SMOOTHSTEP'
            mr_.inputs['From Min'].default_value = 0.12
            mr_.inputs['From Max'].default_value = 0.85
            mr_.inputs['To Min'].default_value = 0.85
            mr_.inputs['To Max'].default_value = 0.0
            nt_.links.new(hz_.outputs[0], mr_.inputs['Value'])
            mx_ = nt_.nodes.new('ShaderNodeMix'); mx_.data_type = 'RGBA'
            nt_.links.new(mr_.outputs[0], mx_.inputs['Factor'])
            ca = [x for x in mx_.inputs if x.name == 'A' and x.type == 'RGBA'][0]
            cb = [x for x in mx_.inputs if x.name == 'B' and x.type == 'RGBA'][0]
            nt_.links.new(src, ca)
            cb.default_value = (0.15, 0.145, 0.138, 1)
            nt_.links.new([x for x in mx_.outputs if x.type == 'RGBA'][0], bsdf.inputs['Base Color'])
            log('suit dust added to', mt.name)
    log('astronaut at', tuple(round(v, 2) for v in rig.location), 'yaw', round(math.degrees(rig.rotation_euler.z), 1))
    return rig


astro = append_astronaut()

# ------------------------------------------------------------------ lander


def append_lander(path):
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if not n.startswith('Check')]
        dst.collections = [c for c in src.collections if c in ('LX_exterior', 'LI_interior')]
        dst.actions = list(src.actions)
    top = new_col('LANDER')
    in_cols = set()
    for c in dst.collections:
        if c is None:
            continue
        top.children.link(c)
        for o in c.all_objects:
            in_cols.add(o.name)
    for o in dst.objects:
        if o is None:
            continue
        if o.name not in in_cols and not o.users_collection:
            top.objects.link(o)
    for a in dst.actions:
        if a:
            a.use_fake_user = True
    root = bpy.data.objects.get('Lander')
    log('lander appended', len([o for o in dst.objects if o]), 'objects from', path)
    return root


def placeholder_lander():
    top = new_col('LANDER')
    colx = new_col('LX_exterior', top)
    gold = bpy.data.materials.new('PH_gold')
    nt, N, L = nodes_of(gold)
    o_ = N.new('ShaderNodeOutputMaterial'); b = N.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (0.85, 0.55, 0.18, 1)
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Roughness'].default_value = 0.35
    L.new(b.outputs[0], o_.inputs['Surface'])
    white = bpy.data.materials.new('PH_white')
    nt, N, L = nodes_of(white)
    o_ = N.new('ShaderNodeOutputMaterial'); b = N.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (0.75, 0.75, 0.73, 1)
    b.inputs['Roughness'].default_value = 0.5
    L.new(b.outputs[0], o_.inputs['Surface'])
    grey = bpy.data.materials.new('PH_grey')
    nt, N, L = nodes_of(grey)
    o_ = N.new('ShaderNodeOutputMaterial'); b = N.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = (0.3, 0.3, 0.3, 1)
    b.inputs['Metallic'].default_value = 1.0
    b.inputs['Roughness'].default_value = 0.4
    L.new(b.outputs[0], o_.inputs['Surface'])

    def emp(name, parent=None):
        e = bpy.data.objects.new(name, None)
        top.objects.link(e)
        e.parent = parent
        return e

    root = emp('Lander')
    base = emp('lander_base', root)
    body = emp('lander_body', root)

    def obj(name, bm, mat, parent):
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        me.materials.append(mat)
        o = bpy.data.objects.new(name, me)
        colx.objects.link(o)
        o.parent = parent
        return o

    def prism(r_flat, z0, z1, segs=8):
        bm = bmesh.new()
        rr = r_flat / math.cos(math.pi / segs)
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=rr, radius2=rr, depth=z1 - z0,
                              matrix=Matrix.Translation((0, 0, (z0 + z1) / 2)) @ Matrix.Rotation(math.pi / segs, 4, 'Z'))
        return bm

    def tube(p0, p1, r, segs=10):
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        bm = bmesh.new()
        q = d.to_track_quat('Z', 'Y')
        bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=d.length,
                              matrix=Matrix.Translation((p0 + p1) / 2) @ q.to_matrix().to_4x4())
        return bm

    obj('ph_descent', prism(1.9, 1.30, 2.95), gold, base)
    obj('ph_bell', tube((0, 0, 0.8), (0, 0, 1.3), 0.55, 16), grey, base)
    for k in range(4):
        Rz = Matrix.Rotation(k * math.pi / 2, 3, 'Z')
        pad = Rz @ Vector((0, -3.70, 0))
        top_ = Rz @ Vector((0, -1.95, 2.75))
        obj('ph_leg%d' % k, tube(top_, pad + Vector((0, 0, 0.18)), 0.07), gold, base)
        for s in (-0.9, 0.9):
            obj('ph_strut%d' % k, tube(Rz @ Vector((0, -3.0, 0.95)), Rz @ Vector((s, -1.95, 1.35)), 0.03), grey, base)
        obj('ph_pad%d' % k, tube(pad, pad + Vector((0, 0, 0.18)), 0.45, 16), gold, base)
    cab = prism(1.45, 2.95, 5.45, 8)
    obj('ph_cabin', cab, white, body)
    obj('ph_tunnel', tube((0, 0, 5.45), (0, 0, 5.75), 0.42, 16), white, body)
    # big mesh dish on -X
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=12, radius1=1.1, radius2=0.08, depth=0.45,
                          matrix=Matrix.Translation((-2.75, -0.2, 4.4)) @ Matrix.Rotation(math.radians(80), 4, 'Y'))
    obj('ph_dish', bm, gold, body)
    obj('ph_boom', tube((-1.45, 0, 4.2), (-2.4, -0.2, 4.35), 0.04), grey, body)
    obj('ph_ladder', tube((-0.24, -3.7, 0.45), (-0.24, -2.45, 2.98), 0.025), grey, base)
    obj('ph_ladder2', tube((0.24, -3.7, 0.45), (0.24, -2.45, 2.98), 0.025), grey, base)
    log('placeholder lander built')
    return root


if os.path.exists(LANDER_PATH):
    lroot = append_lander(LANDER_PATH)
else:
    log('no lander file at', LANDER_PATH, '-> placeholder')
    lroot = placeholder_lander()
if lroot is not None:
    lroot.matrix_world = Matrix.Translation((0, 0, Z_LANDER)) @ M_LANDER_ROT
    lroot['scene_moon_placement'] = 'yaw %.1f tilt %.1f z %.3f' % (LANDER_YAW, LANDER_TILT, Z_LANDER)

# ------------------------------------------------------------------ render settings + compositor
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.device = 'CPU'
cy.samples = SAMPLES
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.02
try:
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
cy.max_bounces = 6
cy.diffuse_bounces = 3
cy.glossy_bounces = 2
cy.transmission_bounces = 2
cy.transparent_max_bounces = 4
cy.dicing_rate = DICING
cy.offscreen_dicing_scale = 6.0
cy.max_subdivisions = 10
sc.render.film_transparent = False
sc.view_settings.view_transform = 'AgX'
try:
    sc.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass
sc.view_settings.exposure = EXPOSURE


def setup_compositor():
    ng = bpy.data.node_groups.new('Step5Comp', 'CompositorNodeTree')
    try:
        ng.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    except Exception as e:
        log('iface', e)
    N, L = ng.nodes, ng.links
    rl = N.new('CompositorNodeRLayers')
    g1 = N.new('CompositorNodeGlare')
    g1.inputs['Type'].default_value = 'Fog Glow'
    g1.inputs['Quality'].default_value = 'High'
    g1.inputs['Threshold'].default_value = 20.0
    g1.inputs['Strength'].default_value = 1.8
    g1.inputs['Size'].default_value = 1.0
    g1.inputs['Clamp'].default_value = True      # sun glints on the gold foil must not out-glow the sun
    g1.inputs['Maximum'].default_value = 150.0
    g2 = N.new('CompositorNodeGlare')
    g2.inputs['Type'].default_value = 'Streaks'
    g2.inputs['Quality'].default_value = 'High'
    g2.inputs['Threshold'].default_value = 30.0
    g2.inputs['Strength'].default_value = 0.008
    g2.inputs['Streaks'].default_value = 6
    g2.inputs['Streaks Angle'].default_value = math.radians(12)
    g2.inputs['Fade'].default_value = 0.93
    g2.inputs['Clamp'].default_value = True
    g2.inputs['Maximum'].default_value = 150.0
    go = N.new('NodeGroupOutput')
    L.new(rl.outputs['Image'], g1.inputs['Image'])
    L.new(g1.outputs['Image'], g2.inputs['Image'])
    L.new(g2.outputs['Image'], go.inputs[0])
    sc.compositing_node_group = ng
    sc.render.use_compositing = True
    sc.render.compositor_device = 'CPU'   # GPU compositor crashes here (no Metal)


try:
    setup_compositor()
except Exception as e:
    log('compositor setup failed', e)

sc.frame_set(0)
log('built scene; lander root z', round(Z_LANDER, 3), 'camera', tuple(round(v, 2) for v in CAM_POS))

# ------------------------------------------------------------------ save + render
try:
    bpy.ops.file.pack_all()
except Exception as e:
    log('pack', e)
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
log('saved', OUT_BLEND)
if RENDER:
    sc.render.filepath = RENDER
    if BORDER:
        b = [float(v) for v in BORDER.split(',')]
        sc.render.use_border = True
        sc.render.use_crop_to_border = True
        sc.render.border_min_x, sc.render.border_max_x, sc.render.border_min_y, sc.render.border_max_y = b
    sc.render.image_settings.file_format = 'PNG'
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    log('render', RENDER, RX, 'x', RY, SAMPLES, 'spp', round(time.time() - t0, 1), 's')
