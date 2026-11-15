"""Helpers for the Insert clip (gesture_insert.py). Leading underscore: the baker does not load it as a clip.

Copied (not imported) from clips_lander/_lander_core.py so the lander module's global kit tweak
(L.LIM['legOut'] widening) is NOT applied here: Hermite / pchip / Tracks splines and the 7-param hand IK
(solve_arm). Plus the Battery prop (bone-parented to RightHand) and its grip frame.
"""
import math
import bpy
import bmesh
from mathutils import Vector, Quaternion, Matrix
import lunar_rig as L

JH, JT = L.JH, L.JT


# ------------------------------------------------------------------ small math
def clamp01(u):
    return min(max(u, 0.0), 1.0)


def smooth(u):
    u = clamp01(u)
    return u * u * (3 - 2 * u)


def smoother(u):
    u = clamp01(u)
    return u * u * u * (u * (6 * u - 15) + 10)


class Hermite:
    """vector/scalar Catmull-Rom spline through (t, value) keys, zero end tangents (or given)."""

    def __init__(self, keys, m0=None, m1=None):
        self.k = sorted(keys, key=lambda kk: kk[0])
        n = len(self.k)
        z = self.k[0][1] * 0.0
        self.m = [z] * n
        for i in range(1, n - 1):
            (x0, y0), (x1, y1) = self.k[i - 1], self.k[i + 1]
            self.m[i] = (y1 - y0) / (x1 - x0)
        if m0 is not None:
            self.m[0] = m0
        if m1 is not None:
            self.m[-1] = m1

    def __call__(self, x):
        k = self.k
        if x <= k[0][0]:
            return k[0][1] * 1.0
        if x >= k[-1][0]:
            return k[-1][1] * 1.0
        for i in range(len(k) - 1):
            if k[i][0] <= x <= k[i + 1][0]:
                h = k[i + 1][0] - k[i][0]
                u = (x - k[i][0]) / h
                h00 = 2 * u ** 3 - 3 * u ** 2 + 1
                h10 = u ** 3 - 2 * u ** 2 + u
                h01 = -2 * u ** 3 + 3 * u ** 2
                h11 = u ** 3 - u ** 2
                return k[i][1] * h00 + self.m[i] * (h10 * h) + k[i + 1][1] * h01 + self.m[i + 1] * (h11 * h)
        return k[-1][1] * 1.0


def pchip(keys):
    """monotone (no overshoot) scalar spline through (t, v) keys, flat ends."""
    xs = [k[0] for k in keys]
    ys = [k[1] for k in keys]
    n = len(xs)
    d = [(ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]) for i in range(n - 1)]
    m = [0.0] * n
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0.0
        else:
            w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1])
            w2 = (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1])
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        for i in range(n - 1):
            if xs[i] <= x <= xs[i + 1]:
                h = xs[i + 1] - xs[i]
                u = (x - xs[i]) / h
                h00 = 2 * u ** 3 - 3 * u ** 2 + 1
                h10 = u ** 3 - 2 * u ** 2 + u
                h01 = -2 * u ** 3 + 3 * u ** 2
                h11 = u ** 3 - u ** 2
                return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1]
        return ys[-1]
    return f


class Tracks:
    """named pchip tracks from keys [(t, {name: value})]; missing names hold the base value at that key."""

    def __init__(self, keys, base):
        names = set()
        for _, d in keys:
            names |= set(d)
        self.tr = {n: pchip([(t, d.get(n, base.get(n, 0.0))) for t, d in keys]) for n in names}

    def __call__(self, t):
        return {n: f(t) for n, f in self.tr.items()}


def seg(keys, f):
    """piecewise smoothstep between (frame, value) keys (zero velocity at every key)"""
    if f <= keys[0][0]:
        return keys[0][1] * 1.0
    for (f0, a), (f1, b) in zip(keys, keys[1:]):
        if f0 <= f <= f1:
            return a + (b - a) * smooth((f - f0) / (f1 - f0))
    return keys[-1][1] * 1.0


def nlerp(a, b, u):
    v = a * (1 - u) + b * u
    return v.normalized() if v.length > 1e-9 else b.copy()


# ------------------------------------------------------------------ hand IK (from _lander_core)
ARM_KEYS = ['armTw', 'armOut', 'arm', 'elb', 'foreTw', 'wristB', 'wristR']
ARM_LIM = {'armTw': (-60, 100), 'armOut': (-35, 115), 'arm': (-50, 175), 'elb': (0, 135),
           'foreTw': (-80, 80), 'wristB': (-55, 55), 'wristR': (-70, 70)}
WPOS = 5.0
PALM_REST = Vector((0.0, 0.0, -1.0))   # glove palm faces down in the T-pose


def shoulder_frame(p, k):
    D, H = L.fk(p)
    s = L.SIDE[k]
    return D[s + 'Shoulder'], H[s + 'Arm'], D, H


def arm_fk(p, k, Dsh, Harm):
    sg = 1 if k == 'L' else -1
    s = L.SIDE[k]
    g = lambda n: p.get(n + k, 0.0)
    qa = L.qw(('X', g('armTw')), ('Y', sg * (L.ARM_DOWN - g('armOut'))), ('X', -g('arm')))
    qf = L.qw(('Z', -sg * g('elb')), ('X', g('foreTw')))
    qh = L.qw(('Z', -sg * g('wristB')), ('X', g('wristR')))
    Da = Dsh @ qa
    e = Harm + Da @ (JH[s + 'ForeArm'] - JH[s + 'Arm'])
    Df = Da @ qf
    w = e + Df @ (JH[s + 'Hand'] - JH[s + 'ForeArm'])
    Dh = Df @ qh
    tip = w + Dh @ (JT[s + 'Hand'] - JH[s + 'Hand'])
    return e, w, tip, Dh


def hand_points(p, k):
    Dsh, Harm = shoulder_frame(p, k)[:2]
    e, w, tip, Dh = arm_fk(p, k, Dsh, Harm)
    return {'elbow': e, 'wrist': w, 'tip': tip, 'dir': (tip - w).normalized(), 'Dh': Dh,
            'F': Dh.to_matrix() @ L.REST[L.SIDE[k] + 'Hand']}


def solve_arm(p, k, target, hdir=None, wdir=0.15, palm=None, wpalm=0.0, prev=None, wprev=0.004,
              elbow_out=0.30, iters=40):
    """Writes the 7 arm params of side k into p so the glove tip (hand bone tail) reaches target.
    hdir: wanted hand direction (wrist -> tip), palm: wanted world palm normal (Dh @ PALM_REST)."""
    sg = 1 if k == 'L' else -1
    Dsh, Harm = shoulder_frame(p, k)[:2]
    keys = [n + k for n in ARM_KEYS]
    x = [p.get(kk, 0.0) for kk in keys]
    lo = [ARM_LIM[n][0] for n in ARM_KEYS]
    hi = [ARM_LIM[n][1] for n in ARM_KEYS]
    prev = prev or {}

    def res(xx):
        q = dict(p)
        q.update(zip(keys, xx))
        e, w, tip, Dh = arm_fk(q, k, Dsh, Harm)
        r = list((tip - target) * WPOS)
        r += list(((tip - w).normalized() - hdir) * wdir) if hdir is not None else [0.0] * 3
        r += list(((Dh @ PALM_REST).normalized() - palm) * wpalm) if palm is not None else [0.0] * 3
        r.append(3.0 * max(0.0, elbow_out - sg * e.x))
        for i, kk in enumerate(keys):
            r.append(wprev * (xx[i] - prev[kk]) if kk in prev else 0.0)
        return r, tip

    lam = 1e-3
    r, pt = res(x)
    c = sum(v * v for v in r)
    n = len(x)
    for _ in range(iters):
        J = []
        for i in range(n):
            y = list(x)
            y[i] += 0.3
            ry, _ = res(y)
            J.append([(a - b) / 0.3 for a, b in zip(ry, r)])
        A = [[sum(J[i][m] * J[j][m] for m in range(len(r))) + (lam if i == j else 0.0) for j in range(n)]
             for i in range(n)]
        bvec = [-sum(J[i][m] * r[m] for m in range(len(r))) for i in range(n)]
        dx = _gauss(A, bvec)
        if dx is None:
            break
        y = [min(max(x[i] + dx[i], lo[i]), hi[i]) for i in range(n)]
        ry, pty = res(y)
        cy = sum(v * v for v in ry)
        if cy < c:
            x, r, c, pt = y, ry, cy, pty
            lam = max(lam * 0.3, 1e-7)
            if max(abs(d) for d in dx) < 1e-3:
                break
        else:
            lam *= 10.0
            if lam > 1e5:
                break
    p.update(zip(keys, x))
    return (pt - target).length


def _gauss(A, b):
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for c in range(n):
        piv = max(range(c, n), key=lambda r: abs(M[r][c]))
        if abs(M[piv][c]) < 1e-14:
            return None
        M[c], M[piv] = M[piv], M[c]
        for r in range(c + 1, n):
            f = M[r][c] / M[c][c]
            if f:
                for j in range(c, n + 1):
                    M[r][j] -= f * M[c][j]
    x = [0.0] * n
    for r in range(n - 1, -1, -1):
        x[r] = (M[r][n] - sum(M[r][j] * x[j] for j in range(r + 1, n))) / M[r][r]
    return x


def arm_params(p, k):
    return {n + k: p.get(n + k, 0.0) for n in ARM_KEYS}


# ------------------------------------------------------------------ battery prop
# Box 0.16 (long, along the hand bone Y = wrist->tip) x 0.10 (along hand bone X: the palm is the -X side)
# x 0.07 (along hand bone Z = thumb side). Glove measured in the RightHand bone frame: palm surface at
# x = -0.055 (y 0.06..0.10 from the head), glove centre z = -0.015, glove mesh tip 1 cm past the bone tail.
# The box lies against the palm (pressed in 4 mm) with its back 6 cm under the glove, 10 cm sticking out.
BOX = (0.10, 0.16, 0.07)
YAW = 30.0   # box yawed in the glove (long axis turned toward the back of the hand): with the box held straight
             # out in front by both gloves the forearms angle inward, elbows stay out of the torso
ROT = Matrix.Rotation(math.radians(-YAW), 3, 'Z')            # box frame in the RightHand bone frame
_PC = Vector((-0.050, -0.010, -0.015))                         # palm contact near the glove tip (tail frame)
OFFSET = _PC - ROT.col[0] * 0.05 + ROT.col[1] * 0.04          # box centre, bone-TAIL frame (bone-parent space)
PALM_LOCAL = {k: L.REST[L.SIDE[k] + 'Hand'].transposed() @ PALM_REST for k in 'LR'}


def hand_frame_for_box(Rb):
    """the RightHand world frame that puts the box at orientation Rb"""
    return Rb @ ROT.transposed()


def box_from_hand(tail, F):
    """box centre + orientation (3x3, columns = box X/Y/Z) from the right hand's tail and world frame F"""
    return tail + F @ OFFSET, F @ ROT


def tail_for_box(C, Rb):
    return C - hand_frame_for_box(Rb) @ OFFSET


def frame_from(yax, xax):
    """orthonormal 3x3 with Y = yax, X = xax made perpendicular, Z = X x Y"""
    y = yax.normalized()
    x = (xax - y * xax.dot(y)).normalized()
    z = x.cross(y)
    return Matrix((x, y, z)).transposed()


def reflect(v, n):
    return v - 2.0 * v.dot(n) * n


def _rgb(hexs):
    h = hexs.lstrip('#')
    s = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in s) + (1.0,)


def _mat(name, base, rough, emit=None, strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = base
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = 0.2 if emit is None else 0.0
    if emit is not None:
        for nm in ('Emission Color', 'Emission'):
            if nm in b.inputs:
                b.inputs[nm].default_value = emit
                break
        b.inputs['Emission Strength'].default_value = strength
    return m


def make_battery():
    """Create the Battery prop once (guarded). Bone-parented to AstronautRig/RightHand; the parent inverse is
    identity, so location/rotation are in the bone-TAIL frame and stay correct in every pose."""
    ob = bpy.data.objects.get('Battery')
    if ob is not None:
        return ob
    hx, hy, hz = BOX[0] / 2, BOX[1] / 2, BOX[2] / 2
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * BOX[0], v.co.y * BOX[1], v.co.z * BOX[2]))
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.008, segments=1, profile=0.5, affect='EDGES')
    # glowing band: two cuts across the long axis, 2 cm wide, nearer the back end (visible behind the gloves)
    for yc in (-0.045, -0.025):
        geom = list(bm.verts) + list(bm.edges) + list(bm.faces)
        bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-6, plane_co=(0, yc, 0), plane_no=(0, 1, 0))
    me = bpy.data.meshes.new('Battery')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(_mat('Battery', _rgb('#3a3f47'), 0.5))
    me.materials.append(_mat('BatteryGlow', _rgb('#3a3f47'), 0.4, emit=_rgb('#ff8a1e'), strength=3.0))
    for f in me.polygons:
        c = f.center
        f.material_index = 1 if (-0.045 < c.y < -0.025) else 0
        f.use_smooth = False
    ob = bpy.data.objects.new('Battery', me)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = L.rig
    ob.parent_type = 'BONE'
    ob.parent_bone = 'RightHand'
    ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.rotation_mode = 'QUATERNION'
    ob.location = OFFSET
    ob.rotation_quaternion = ROT.to_quaternion()
    ob.scale = (1, 1, 1)
    return ob
