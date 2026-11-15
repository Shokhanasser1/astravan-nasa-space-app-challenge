"""Helpers for the rover driver clips (seated.py). Helper module: leading underscore, the baker does not load it.

Seat contract (rig space: the astronaut faces -Y, X = its left, Z up; root = origin = a point on the cabin floor
directly below the hip joints; the game puts the root on the empty `sev_seat_driver`):
  cushion top z 0.45, seat back front face y +0.25 (plate 0.25..0.30, up to z 1.05), upright;
  hand controller centre (0, -0.40, 0.95), grips at x +-0.18 (on a circle r 0.18 about the fore-aft axis when the
  controller is turned); glove grip point = wrist + 0.6 * (hand tip - wrist).

Kit work-arounds (the kit is not edited):
  * the pose language has no spine roll (side lean); the only roll is hipRoll, which would tip the pelvis and
    lift one thigh off the cushion. This module wraps L.pose_from_params ONCE: a new key 'spRoll' (deg, + = lean
    to the astronaut's left) rolls Spine/Spine1/Spine2 about the rest Y axis. Params without 'spRoll' produce
    exactly the kit's pose, so the other clips baked in the same run are unchanged.
  * the kit has leg IK only: the hand IK below is the lander clips' solver (clips_lander/_lander_core.py), copied
    here because importing _lander_core would widen L.LIM['legOut'] for every clip in the run.
"""
import math
from mathutils import Vector, Matrix
import lunar_rig as L

JH, JT = L.JH, L.JT

# ------------------------------------------------------------------ seat contract (rig space, metres)
CUSHION_Z = 0.45
BACK_Y0, BACK_Y1, BACK_TOP = 0.25, 0.30, 1.05
CTRL = Vector((0.0, -0.40, 0.95))
GRIP_R = 0.18
STEER_MAX = 35.0       # deg, controller roll at full steer
GRIP = 0.6             # grip point = wrist + GRIP * (hand tip - wrist)


def ctrl_rot(phi):
    """controller roll phi (deg) about its fore-aft axis; phi < 0 = turned LEFT (left grip down, right grip up)"""
    return Matrix.Rotation(math.radians(-phi), 3, 'Y')


def grip_pos(k, phi):
    sg = 1 if k == 'L' else -1
    return CTRL + ctrl_rot(phi) @ Vector((sg * GRIP_R, 0.0, 0.0))


# ------------------------------------------------------------------ spine roll (kit work-around)
_ORIG_PFP = L.pose_from_params
SPROLL_W = (('Spine', 0.30), ('Spine1', 0.35), ('Spine2', 0.35))


def _pose_from_params(p):
    out = _ORIG_PFP(p)
    r = p.get('spRoll', 0.0)
    if r:
        for n, w in SPROLL_W:
            q, off = out[n]
            out[n] = (L.qw(('Y', w * r)) @ q, off)
    return out


if not getattr(L.pose_from_params, '_seated_wrap', False):
    _pose_from_params._seated_wrap = True
    L.pose_from_params = _pose_from_params


# ------------------------------------------------------------------ hand IK (copy of clips_lander/_lander_core.py)
ARM_KEYS = ['armTw', 'armOut', 'arm', 'elb', 'foreTw', 'wristB', 'wristR']
ARM_LIM = {'armTw': (-60, 100), 'armOut': (-35, 115), 'arm': (-50, 175), 'elb': (0, 135),
           'foreTw': (-80, 80), 'wristB': (-55, 55), 'wristR': (-70, 70)}
WPOS = 12.0           # (lander: 5) the gloves must stay on the grips within 1 cm
PALM_REST = Vector((0.0, 0.0, -1.0))   # the glove's palm faces down in the T-pose


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
    return e, w, tip, Dh


def hand_points(p, k):
    Dsh, Harm = shoulder_frame(p, k)
    e, w, tip, Dh = arm_fk(p, k, Dsh, Harm)
    return {'shoulder': Harm, 'elbow': e, 'wrist': w, 'tip': tip, 'grip': w + GRIP * (tip - w),
            'dir': (tip - w).normalized(), 'palm': (Dh @ PALM_REST).normalized()}


def solve_arm(p, k, target, hdir=None, wdir=0.15, palm=None, wpalm=0.0, prev=None, wprev=0.0, pref=None,
              wpref=0.0015, elbow_out=0.30, elbow_back=None, iters=60):
    """Writes the 7 arm params of side k into p so the glove grip point reaches target. Returns the miss (m).
    elbow_back: soft limit, the elbow stays in front of this y (keeps it off the backpack)."""
    sg = 1 if k == 'L' else -1
    Dsh, Harm = shoulder_frame(p, k)
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
        pt = w + GRIP * (tip - w)
        r = list((pt - target) * WPOS)
        r += list(((tip - w).normalized() - hdir) * wdir) if hdir is not None else [0.0] * 3
        r += list(((Dh @ PALM_REST).normalized() - palm) * wpalm) if palm is not None else [0.0] * 3
        r.append(8.0 * max(0.0, elbow_out - sg * e.x))
        r.append(3.0 * max(0.0, e.y - elbow_back) if elbow_back is not None else 0.0)
        for i, kk in enumerate(keys):
            r.append(wprev * (xx[i] - prev[kk]) if kk in prev else 0.0)
            r.append(wpref * (xx[i] - pref[kk]) if kk in pref else 0.0)
        return r, pt

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
            if max(abs(d) for d in dx) < 1e-4:
                break
        else:
            lam *= 10.0
            if lam > 1e6:
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


# ------------------------------------------------------------------ pelvis placement
def hip_offsets(p, H):
    """set hipX/hipY/hipZ (given hipPitch etc. in p) so the midpoint of the two hip joints is at (0, 0, H)"""
    p.setdefault('hipX', 0.0)
    p.setdefault('hipY', 0.0)
    p.setdefault('hipZ', 0.0)
    for _ in range(2):
        mid = (L.hip_joint(p, 'L') + L.hip_joint(p, 'R')) * 0.5
        p['hipX'] -= mid.x
        p['hipY'] -= mid.y
        p['hipZ'] += H - mid.z
    return p
