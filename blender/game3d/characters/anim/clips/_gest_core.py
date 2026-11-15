"""Helpers for gesture_idle.py (Wrist, LookAround). Helper module: leading underscore, the baker does not load it.

Copied from clips_lander/_lander_core.py (Hermite, pchip, Tracks, arm FK) so this module does not import the lander
core (that one widens L.LIM['legOut'] at import). Plus a hand IK with extra terms the lander one lacks:
position targets for elbow / wrist / tip, direction targets (hand, forearm, forearm dorsal side = wrist display),
and obstacle penalties (chest box in the chest frame, helmet sphere in the head frame, capsules) sampled along
the upper arm, forearm and glove, so the arms stay outside the bulky suit.
"""
import math
from mathutils import Vector, Quaternion
import lunar_rig as L

JH, JT = L.JH, L.JT


def clamp01(u):
    return min(max(u, 0.0), 1.0)


def smooth(u):
    u = clamp01(u)
    return u * u * (3 - 2 * u)


def smoother(u):
    u = clamp01(u)
    return u * u * u * (u * (6 * u - 15) + 10)


class Hermite:
    """vector/scalar Catmull-Rom spline through (t, value) keys, zero end tangents."""

    def __init__(self, keys):
        self.k = sorted(keys, key=lambda kk: kk[0])
        n = len(self.k)
        z = self.k[0][1] * 0.0
        self.m = [z] * n
        for i in range(1, n - 1):
            (x0, y0), (x1, y1) = self.k[i - 1], self.k[i + 1]
            self.m[i] = (y1 - y0) / (x1 - x0)

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
    """named pchip tracks from keys [(frame, {name: value})]; a name missing at a key holds base[name] there."""

    def __init__(self, keys, base):
        names = set()
        for _, d in keys:
            names |= set(d)
        self.tr = {n: pchip([(t, d.get(n, base.get(n, 0.0))) for t, d in keys]) for n in names}

    def __call__(self, t):
        return {n: f(t) for n, f in self.tr.items()}


# ------------------------------------------------------------------ frames
def bone_frame(p, bone):
    """(D, H): world rotation delta and head of `bone` for params p. local(rest) -> world: H + D @ (x - JH[bone])"""
    D, H = L.fk(p)
    return D[bone], H[bone]


def to_world(fr, x, bone):
    D, H = fr
    return H + D @ (Vector(x) - JH[bone])


def to_local(fr, w, bone):
    D, H = fr
    return JH[bone] + D.inverted() @ (Vector(w) - H)


# ------------------------------------------------------------------ arm FK
ARM_KEYS = ['armTw', 'armOut', 'arm', 'elb', 'foreTw', 'wristB', 'wristR']
ARM_LIM = {'armTw': (-60, 100), 'armOut': (-60, 115), 'arm': (-50, 175), 'elb': (0, 135),
           'foreTw': (-80, 80), 'wristB': (-55, 55), 'wristR': (-70, 70)}
UP = Vector((0, 0, 1))


def shoulder_frame(p, k):
    D, H = L.fk(p)
    s = L.SIDE[k]
    return D[s + 'Shoulder'], H[s + 'Arm']


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
    return {'shoulder': Harm, 'elbow': e, 'wrist': w, 'tip': tip, 'Df': Df, 'Dh': Dh,
            'dorsal': (Df @ UP).normalized(), 'hdorsal': (Dh @ UP).normalized(),
            'hand': (tip - w).normalized(), 'fore': (w - e).normalized()}


def arm_points(p, k):
    Dsh, Harm = shoulder_frame(p, k)
    return arm_fk(p, k, Dsh, Harm)


def arm_params(p, k):
    return {n + k: p.get(n + k, 0.0) for n in ARM_KEYS}


def _seg_samples(a):
    pts = []
    for u, r in ((0.8, 0.075), (1.0, 0.07)):        # upper arm (the half at the scye is shoulder bulk)
        pts.append((a['shoulder'].lerp(a['elbow'], u), r))
    for u, r in ((0.35, 0.07), (0.7, 0.065), (1.0, 0.06)):         # forearm
        pts.append((a['elbow'].lerp(a['wrist'], u), r))
    pts.append((a['wrist'].lerp(a['tip'], 0.55), 0.055))            # glove
    pts.append((a['tip'] - a['hand'] * 0.02, 0.035))                   # glove front
    return pts


def _box_sd(q, lo, hi):
    """signed distance from q to an axis-aligned box (negative inside)"""
    d = [max(lo[i] - q[i], q[i] - hi[i]) for i in range(3)]
    out = Vector([max(v, 0.0) for v in d]).length
    return out if out > 0 else max(d)


def _capsule_d(q, a, b):
    ab = b - a
    u = clamp01((q - a).dot(ab) / max(ab.length_squared, 1e-9))
    return (q - (a + ab * u)).length


def solve_arm(p, k, terms, prev=None, wprev=0.004, pref=None, wpref=0.002, obst=None, iters=50):
    """Writes the 7 arm params of side k into p. terms: list of
         ('pos', point, target, w)   point in elbow | wrist | tip
         ('dir', vec, target, w)     vec in hand | fore | dorsal | hdorsal
         ('elbz', None, z, w)        soft elbow height
       obst: list of ('box', frame, bone, lo, hi) (box in rest coords of bone's frame) | ('sph', centre_w, r) |
             ('cap', a_w, b_w, r). Each arm sample (radius r_s) is pushed out to r_s from the obstacle.
       Returns a dict of residual norms per term."""
    Dsh, Harm = shoulder_frame(p, k)
    keys = [n + k for n in ARM_KEYS]
    x = [p.get(kk, 0.0) for kk in keys]
    lo = [ARM_LIM[n][0] for n in ARM_KEYS]
    hi = [ARM_LIM[n][1] for n in ARM_KEYS]
    prev = prev or {}
    pref = pref or {}
    obst = obst or []
    # boxes: precompute inverse frames
    ob2 = []
    for o in obst:
        if o[0] == 'box':
            _, fr, bone, blo, bhi = o
            ob2.append(('box', fr[0].inverted(), fr[1], JH[bone], blo, bhi))
        else:
            ob2.append(o)

    def res(xx):
        q = dict(p)
        q.update(zip(keys, xx))
        a = arm_fk(q, k, Dsh, Harm)
        r = []
        for kind, name, tgt, w in terms:
            if kind == 'pos':
                r += list((a[name] - tgt) * w)
            elif kind == 'dir':
                r += list((a[name] - tgt) * w)
            elif kind == 'elbz':
                r.append((a['elbow'].z - tgt) * w)
        for s, rs in _seg_samples(a):
            for o in ob2:
                if o[0] == 'box':
                    _, Dinv, H0, J0, blo, bhi = o
                    ql = J0 + Dinv @ (s - H0)
                    d = _box_sd(ql, blo, bhi)
                elif o[0] == 'sph':
                    d = (s - o[1]).length - o[2]
                else:
                    d = _capsule_d(s, o[1], o[2]) - o[3]
                r.append(8.0 * max(0.0, rs - d))
        for i, kk in enumerate(keys):
            r.append(wprev * (xx[i] - prev[kk]) if kk in prev else 0.0)
            r.append(wpref * (xx[i] - pref[kk]) if kk in pref else 0.0)
        return r

    lam = 1e-3
    r = res(x)
    c = sum(v * v for v in r)
    n = len(x)
    for _ in range(iters):
        J = []
        for i in range(n):
            y = list(x)
            y[i] += 0.3
            ry = res(y)
            J.append([(a_ - b_) / 0.3 for a_, b_ in zip(ry, r)])
        A = [[sum(J[i][m] * J[j][m] for m in range(len(r))) + (lam if i == j else 0.0) for j in range(n)]
             for i in range(n)]
        bvec = [-sum(J[i][m] * r[m] for m in range(len(r))) for i in range(n)]
        dx = _gauss(A, bvec)
        if dx is None:
            break
        y = [min(max(x[i] + dx[i], lo[i]), hi[i]) for i in range(n)]
        ry = res(y)
        cy = sum(v * v for v in ry)
        if cy < c:
            x, r, c = y, ry, cy
            lam = max(lam * 0.3, 1e-7)
            if max(abs(d) for d in dx) < 1e-3:
                break
        else:
            lam *= 10.0
            if lam > 1e6:
                break
    p.update(zip(keys, x))
    a = arm_fk(p, k, Dsh, Harm)
    out = {}
    for kind, name, tgt, w in terms:
        if kind in ('pos', 'dir'):
            out[kind + ':' + name] = (a[name] - tgt).length
    pen = 0.0
    for s, rs in _seg_samples(a):
        for o in ob2:
            if o[0] == 'box':
                _, Dinv, H0, J0, blo, bhi = o
                d = _box_sd(J0 + Dinv @ (s - H0), blo, bhi)
            elif o[0] == 'sph':
                d = (s - o[1]).length - o[2]
            else:
                d = _capsule_d(s, o[1], o[2]) - o[3]
            pen = max(pen, rs - d)
    out['pen'] = pen
    return out


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


def blend_arm(p, k, base, u):
    """p's arm k params := base + (p - base) * u"""
    for n in ARM_KEYS:
        kk = n + k
        b = base.get(kk, 0.0)
        p[kk] = b + (p.get(kk, 0.0) - b) * u


def plant(p, idle):
    """boots on the idle stance, warm-started from the idle legs (knees forward)"""
    for k in 'LR':
        p['th' + k], p['kn' + k], p['legOut' + k] = idle['th' + k], idle['kn' + k], idle['legOut' + k]
    return L.plant_idle_feet(p)


class Table:
    """clip as a per-frame table: fn(t) -> params of frame round(t * N)"""

    def __init__(self, rows):
        self.rows = rows
        self.N = len(rows) - 1

    def __call__(self, t):
        f = min(max(int(round(t * self.N)), 0), self.N)
        return dict(self.rows[f])
