"""Shared helpers for the lander clips (helper module: leading underscore, the baker does not load it as a clip).

Lander numbers come from ~/dev/oy-karvonsaroyi-3d/hb7/lander_v2/SPEC.md (world: lander front faces -Y, metres).
In the lander scenes the astronaut faces +Y (rig rotated 180 deg about Z), so a world offset (dx, dy, dz) from
the astronaut's root is (-dx, -dy, dz) in rig space.

Also here: a hand IK (the kit has leg IK only): LM solve of the 7 arm params so the glove's grip point (rails)
or tip (buttons) hits a target, with a soft hand-direction target, elbow-out penalty and smoothness to the
previous frame. Clips are precomputed frame by frame at import (warm-started IK), fn(t) is a table lookup.
"""
import math, os, sys
from mathutils import Vector, Quaternion, Matrix
import lunar_rig as L

HERE = os.path.dirname(os.path.abspath(__file__))
CLIPS = os.path.join(os.path.dirname(HERE), 'clips')
if CLIPS not in sys.path:
    sys.path.append(CLIPS)

JH, JT = L.JH, L.JT
# kit work-around: the leg IK clamps hip adduction at -12 deg; climbing with the boots between the ladder rails
# (ball x = +-0.10, hip joints at +-0.165) with the knee folded needs ~-20. Widen it for the lander clips only.
L.LIM['legOut'] = (-24.0, 35.0)
LEAN = math.radians(28.0)
TAN28, SIN28, COS28 = math.tan(LEAN), math.sin(LEAN), math.cos(LEAN)
RUNG_R, RAIL_R, RAIL_X = 0.0175, 0.025, 0.24
PORCH_Z, FLOOR_Z = 2.98, 3.00


def rung_world(i):
    z = 0.70 + 0.30 * i
    return Vector((0.0, -2.45 - (2.95 - z) * TAN28, z))


def ladder_y(z):
    return -2.45 - (2.95 - z) * TAN28


BUTTONS = {   # face centre, press direction (world)
    'btn_main_1': (Vector((-0.30, 1.0967, 4.2090)), Vector((0, 0.966, -0.259))),
    'btn_main_2': (Vector((0.00, 1.0967, 4.2090)), Vector((0, 0.966, -0.259))),
    'btn_main_3': (Vector((0.30, 1.0967, 4.2090)), Vector((0, 0.966, -0.259))),
    'btn_launch': (Vector((0.00, 1.0372, 3.9869)), Vector((0, 0.966, -0.259))),
    'btn_hatch_ext': (Vector((-0.72, -1.565, 3.95)), Vector((0, 1, 0))),
}
PANEL_U = Vector((0, 0.259, 0.966))     # panel up (world)
PANEL_N = Vector((0, -0.966, 0.259))    # panel normal, into the cabin (world)
STAND_PANEL = Vector((0.0, 0.50, 3.00))
PRESS = 0.012


def w2r(w, root):
    """world point -> rig space of an astronaut standing at `root` facing +Y"""
    return Vector((-(w[0] - root[0]), -(w[1] - root[1]), w[2] - root[2]))


def r2w(r, root):
    return Vector((root[0] - r[0], root[1] - r[1], root[2] + r[2]))


def d2r(d):
    return Vector((-d[0], -d[1], d[2]))


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
    return _Pc(xs, ys, m)


class _Pc:
    def __init__(self, xs, ys, m):
        self.xs, self.ys, self.m = xs, ys, m

    def __call__(self, x):
        xs, ys, m = self.xs, self.ys, self.m
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        for i in range(len(xs) - 1):
            if xs[i] <= x <= xs[i + 1]:
                h = xs[i + 1] - xs[i]
                u = (x - xs[i]) / h
                h00 = 2 * u ** 3 - 3 * u ** 2 + 1
                h10 = u ** 3 - 2 * u ** 2 + u
                h01 = -2 * u ** 3 + 3 * u ** 2
                h11 = u ** 3 - u ** 2
                return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1]
        return ys[-1]


class Tracks:
    """named pchip tracks from keys [(t, {name: value})]; missing names hold the idle0 value at that key."""

    def __init__(self, keys, base):
        names = set()
        for _, d in keys:
            names |= set(d)
        self.tr = {}
        for n in names:
            kk = [(t, d.get(n, base.get(n, 0.0))) for t, d in keys]
            self.tr[n] = pchip(kk)

    def __call__(self, t):
        return {n: f(t) for n, f in self.tr.items()}


# ------------------------------------------------------------------ hand IK
ARM_KEYS = ['armTw', 'armOut', 'arm', 'elb', 'foreTw', 'wristB', 'wristR']
ARM_LIM = {'armTw': (-60, 100), 'armOut': (-35, 115), 'arm': (-50, 175), 'elb': (0, 135),
           'foreTw': (-80, 80), 'wristB': (-55, 55), 'wristR': (-70, 70)}
WPOS = 5.0          # position weight of the hand IK (other residuals are relative to it)
GRIP = 0.6          # grip point = wrist + GRIP * (hand tip - wrist)


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


def hand_points(p, k, frame=None):
    Dsh, Harm = frame if frame else shoulder_frame(p, k)[:2]
    e, w, tip, Dh = arm_fk(p, k, Dsh, Harm)
    return {'elbow': e, 'wrist': w, 'tip': tip, 'grip': w + GRIP * (tip - w), 'dir': (tip - w).normalized(),
            'Dh': Dh}


# palm normal in the rest hand frame: the glove's palm faces down (-Z) in the T-pose
PALM_REST = Vector((0.0, 0.0, -1.0))


def solve_arm(p, k, target, point='grip', hdir=None, wdir=0.15, palm=None, wpalm=0.0, prev=None, wprev=0.004,
              pref=None, wpref=0.0015, elbow_out=0.30, elbow_below=None, iters=40, _retry=False):
    """Writes the 7 arm params of side k into p so hand `point` ('grip' | 'tip' | 'wrist') reaches target
    (rig/world-armature space). hdir: wanted hand direction (wrist -> tip), palm: wanted palm normal.
    Returns the position miss (m)."""
    sg = 1 if k == 'L' else -1
    Dsh, Harm = shoulder_frame(p, k)[:2]
    keys = [n + k for n in ARM_KEYS]
    x = [p.get(kk, 0.0) for kk in keys]
    lo = [ARM_LIM[n][0] for n in ARM_KEYS]
    hi = [ARM_LIM[n][1] for n in ARM_KEYS]
    prev = prev or {}
    pref = pref or {}

    def res(xx):
        q = dict(p)
        q.update(zip(keys, xx))
        e, w, tip, Dh = arm_fk(q, k, Dsh, Harm)
        pt = {'grip': w + GRIP * (tip - w), 'tip': tip, 'wrist': w}[point]
        r = list((pt - target) * WPOS)
        if hdir is not None:
            r += list(((tip - w).normalized() - hdir) * wdir)
        else:
            r += [0.0, 0.0, 0.0]
        if palm is not None:
            r += list(((Dh @ PALM_REST).normalized() - palm) * wpalm)
        else:
            r += [0.0, 0.0, 0.0]
        r.append(3.0 * max(0.0, elbow_out - sg * e.x))
        r.append(3.0 * max(0.0, e.z - elbow_below) if elbow_below is not None else 0.0)
        for i, kk in enumerate(keys):
            r.append(wprev * (xx[i] - prev[kk]) if kk in prev else 0.0)
            r.append(wpref * (xx[i] - pref[kk]) if kk in pref else 0.0)
        return r, pt

    lam = 1e-3
    r, pt = res(x)
    c = sum(v * v for v in r)
    for _ in range(iters):
        J = []
        for i in range(len(x)):
            y = list(x)
            y[i] += 0.3
            ry, _ = res(y)
            J.append([(a - b) / 0.3 for a, b in zip(ry, r)])
        n = len(x)
        # 7x7 normal equations (mathutils Matrix is max 4x4 -> plain python Gaussian elimination)
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
    miss = (pt - target).length
    if miss > 0.008 and pref and not _retry:
        q = dict(p)
        q.update({kk: pref.get(kk, q.get(kk, 0.0)) for kk in keys})
        m2 = solve_arm(q, k, target, point, hdir, wdir, palm, wpalm, None, 0.0, pref, wpref, elbow_out, elbow_below,
                       iters=80, _retry=True)
        if m2 < miss - 0.004:
            p.update({kk: q[kk] for kk in keys})
            return m2
    p.update(zip(keys, x))
    return miss


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


# ------------------------------------------------------------------ boots
def ball_on_rung(k, rung_c, pitch, yaw=0.0):
    """'ball' landmark position for boot k resting with the sole under its ball on a round rung (centre rung_c)."""
    R = L.foot_rot(pitch, yaw)
    return rung_c + R @ Vector((0, 0, RUNG_R + 0.035))


def sole_ball(p, k):
    """sole point under the ball (fk, no mesh)"""
    return L.boot_points(p, k)['ball']


# ------------------------------------------------------------------ precompute a clip frame by frame
class Table:
    def __init__(self, nframes, solve):
        self.N = nframes
        self.rows = []
        state = {}
        for f in range(nframes + 1):
            self.rows.append(solve(f / nframes, state))

    def __call__(self, t):
        f = int(round(t * self.N))
        f = min(max(f, 0), self.N)
        return dict(self.rows[f])


def idle0():
    return L.idle_params(0.0)


def blend_params(a, b, u, keys=None):
    """(1-u) a + u b over scalar keys"""
    out = dict(a)
    for kk in (keys or set(a) | set(b)):
        va, vb = a.get(kk, 0.0), b.get(kk, 0.0)
        if isinstance(va, (int, float)) and isinstance(vb, (int, float)):
            out[kk] = va + (vb - va) * u
    return out
