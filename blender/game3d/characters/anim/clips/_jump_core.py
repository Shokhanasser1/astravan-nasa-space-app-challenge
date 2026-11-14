"""Jump family core (helper for clips/jump.py; leading underscore = not a clip module).

Standing jump in place (speed 0) on the Moon, take-off 1.2 m/s (0.44 m apex, 1.48 s flight).
One continuous design, sampled four ways:
    JumpStart  idle -> lunar crouch -> push -> take-off pose (hips moving up at 1.2 m/s, on the toe tips)
    JumpAir    flight pose, scrubbed by flight progress u (no vertical root motion; hips drift linearly
               from the take-off height to the landing-reach height, so world hips z'' = -g exactly)
    JumpLand   touch-down (hips arrive moving down) -> absorb -> exactly L.idle_params(0.0)
    Jump       all three in one clip with the hips on the real parabola during the flight

Hips height comes from acceleration profiles (piecewise-linear z'', integrated exactly) solved so that:
  * z'' >= -1.5 m/s2 whenever a boot is on the ground (Moon g = 1.62; margin for the Bezier keys),
  * the hips extremes (crouch bottom, apex, landing bottom) fall exactly on a frame: the baker inserts
    AUTO_CLAMPED Bezier keys, which flatten the handle at any local extreme; an extreme between two
    frames would then show as a fake acceleration spike of several m/s2 in the measurement.
Upper body / hip offsets: one PCHIP spline over a global jump timeline G (s), so poses and velocities are
continuous across the clip joins. Boots: L.place_foot with the stance of L.idle_params (heel landmark
+/-8 mm in x, toes out 4 deg).
"""
import math
from mathutils import Vector
import lunar_rig as L

FPS = 30
G = L.G_MOON
V_TO = 1.2                      # take-off speed (m/s), the game's MOVE.jumpV
T_FLIGHT_GAME = 2 * V_TO / G    # 1.4815 s

# Durations: a 15 cm crouch whose hips never accelerate down faster than Moon g, then a push to an extended
# take-off pose at 1.2 m/s, needs ~0.83 s (0.8 s -> 12 cm crouch; 0.7 s -> ~11 cm and bent knees at take-off).
# The landing from -1.24 m/s, 14 cm absorb, back up to idle with z'' >= -1.45 needs 0.73 s at ~5.3 m/s2.
START_FRAMES = 25               # 0.833 s
AIR_FRAMES = 45                 # 1.5 s, scrubbed by u
LAND_FRAMES = 22                # 0.733 s
T_START = START_FRAMES / FPS
T_LAND = LAND_FRAMES / FPS
START_BOTTOM_FRAME = 16         # crouch bottom on a frame (0.533 s)
LAND_BOTTOM_FRAME = 7           # landing bottom on a frame (0.233 s)

ZE = 0.065                      # hipZ at take-off (body extended, on the toe tips)
H_REACH = 0.0                   # hipZ at touch-down (legs reaching, knees a little bent)
P_LAND = 10.0                   # boot pitch at touch-down (heel 10 deg up, toe segment flat on the ground)
A_DOWN = -1.5                   # crouch: hips accelerate down at (almost) Moon g
D_RISE = -1.45                  # landing recovery: hips decelerate at (almost) Moon g

IDLE0 = L.idle_params(0.0)
YAW = {'L': 4.0, 'R': -4.0}


# ------------------------------------------------------------------ hips height profiles
class Prof:
    """z'' piecewise linear through knots [(t, a)], exact integration from (z0, v0)."""

    def __init__(self, knots, z0, v0):
        self.k = knots
        self.st = []
        z, v = z0, v0
        for (t0, a0), (t1, a1) in zip(knots, knots[1:]):
            self.st.append((t0, t1, a0, a1, z, v))
            h = t1 - t0
            j = (a1 - a0) / h if h > 0 else 0.0
            z, v = z + v * h + a0 * h * h / 2 + j * h ** 3 / 6, v + a0 * h + j * h * h / 2
        self.end = (knots[-1][0], z, v, knots[-1][1])

    def at(self, t):
        for (t0, t1, a0, a1, z, v) in self.st:
            if t0 <= t <= t1:
                h = t1 - t0
                j = (a1 - a0) / h if h > 0 else 0.0
                s = t - t0
                return (z + v * s + a0 * s * s / 2 + j * s ** 3 / 6, v + a0 * s + j * s * s / 2, a0 + j * s)
        te, z, v, a = self.end
        s = t - te
        return z + v * s + a * s * s / 2, v + a * s, a

    def zero_vel(self):
        """time where v crosses 0 going up (the bottom)."""
        prev = None
        n = 4000
        T = self.end[0]
        for i in range(n + 1):
            t = T * i / n
            v = self.at(t)[1]
            if prev is not None and prev[1] < 0 <= v:
                return prev[0] + (t - prev[0]) * (-prev[1]) / (v - prev[1])
            prev = (t, v)
        return None


def qp_profile(T, z0, v0, cons, lower=-1.5, flight=None, h=1.0 / 240, w_jerk=1.0, w_snap=0.02, w_acc=0.0):
    """Smoothest hips height curve (min jerk + a little snap) on [0, T] from (z0, v0), with equality
    constraints cons = [('z'|'v'|'a', t, value)], z'' = -G on the flight interval, and z'' >= lower elsewhere
    (active set). z'' is piecewise linear on a fine grid; returns a Prof (exact integration)."""
    import numpy as np
    special = [c[1] for c in cons] + (list(flight) if flight else [])
    grid = sorted(set([round(i * h, 9) for i in range(int(round(T / h)) + 1)] + [round(t, 9) for t in special]))
    ts = []
    for t in grid:
        if ts and t - ts[-1] < h / 4:
            if any(abs(t - sp) < 1e-9 for sp in special):
                ts[-1] = t
            continue
        ts.append(t)
    ts = np.array(ts)
    n = len(ts)
    hs = np.diff(ts)
    V = np.zeros((n, n))
    Z = np.zeros((n, n))
    for i in range(n - 1):
        hi = hs[i]
        V[i + 1] = V[i]
        V[i + 1, i] += hi / 2
        V[i + 1, i + 1] += hi / 2
        Z[i + 1] = Z[i] + hi * V[i]
        Z[i + 1, i] += hi * hi / 3
        Z[i + 1, i + 1] += hi * hi / 6
    rows, rhs = [], []

    def unit(j):
        r = np.zeros(n)
        r[j] = 1.0
        return r
    for kind, t, val in cons:
        j = int(np.argmin(np.abs(ts - t)))
        if kind == 'z':
            rows.append(Z[j]); rhs.append(val - z0 - v0 * ts[j])
        elif kind == 'v':
            rows.append(V[j]); rhs.append(val - v0)
        else:
            rows.append(unit(j)); rhs.append(val)
    fl = np.zeros(n, bool)
    if flight:
        fl = (ts >= flight[0] - 1e-9) & (ts <= flight[1] + 1e-9)
        for j in np.where(fl)[0]:
            rows.append(unit(j)); rhs.append(-G)
    D1 = np.zeros((n - 1, n))
    for i in range(n - 1):
        D1[i, i], D1[i, i + 1] = -1 / hs[i], 1 / hs[i]
    Q = w_jerk * D1.T @ (hs[:, None] * D1)
    if w_snap:
        D2 = np.zeros((n - 2, n))
        for i in range(1, n - 1):
            hm = 0.5 * (hs[i - 1] + hs[i])
            D2[i - 1, i - 1] = 1 / (hs[i - 1] * hm)
            D2[i - 1, i] = -(1 / hs[i - 1] + 1 / hs[i]) / hm
            D2[i - 1, i + 1] = 1 / (hs[i] * hm)
        hm = 0.5 * (hs[:-1] + hs[1:])
        Q = Q + w_snap * D2.T @ (hm[:, None] * D2)
    if w_acc:   # also keep the accelerations themselves small (flattens the impact / push peaks)
        hw = np.concatenate([[hs[0] / 2], 0.5 * (hs[:-1] + hs[1:]), [hs[-1] / 2]])
        Q = Q + w_acc * np.diag(hw)
    Q = Q / np.max(np.abs(Q)) + 1e-12 * np.eye(n)
    active = []
    for _ in range(100):
        C = np.array(rows + [unit(j) for j in active])
        d = np.array(rhs + [lower] * len(active))
        sc = 1.0 / np.linalg.norm(C, axis=1)          # unit-norm constraint rows (conditioning)
        Cs, ds = C * sc[:, None], d * sc
        m = C.shape[0]
        K = np.zeros((n + m, n + m))
        K[:n, :n] = Q
        K[:n, n:] = Cs.T
        K[n:, :n] = Cs
        try:
            sol = np.linalg.solve(K, np.concatenate([np.zeros(n), ds]))
        except np.linalg.LinAlgError:
            sol = np.linalg.lstsq(K, np.concatenate([np.zeros(n), ds]), rcond=None)[0]
        acc = sol[:n]
        viol = [j for j in range(n) if not fl[j] and j not in active and acc[j] < lower - 1e-7]
        if not viol:
            break
        active += viol
    resid = float(np.max(np.abs(C @ acc - d)))
    RESID.append(resid)
    return Prof([(float(t), float(x)) for t, x in zip(ts, acc)], z0, v0)


RESID = []
ZB_START = -0.155               # hipZ at the crouch bottom (14 cm below idle, 15.5 cm below the rest pose)
ZB_LAND = -0.145                # hipZ at the landing bottom (14.5 cm below the touch-down height)
ZB_LAND_C = -0.150              # the combined clip lands a little faster (hips fell from ZE, not from H_REACH)

# JumpStart / JumpLand clips (game timing)
PS = qp_profile(T_START, IDLE0['hipZ'], 0.0,
                [('a', 0.0, 0.0), ('z', START_BOTTOM_FRAME / FPS, ZB_START), ('v', START_BOTTOM_FRAME / FPS, 0.0),
                 ('z', T_START, ZE), ('v', T_START, V_TO), ('a', T_START, 0.0)], lower=A_DOWN)
V_TD_GAME = -V_TO + (H_REACH - ZE) / T_FLIGHT_GAME          # world hips speed at touch-down in the game
PL = qp_profile(T_LAND, H_REACH, V_TD_GAME,
                [('z', LAND_BOTTOM_FRAME / FPS, ZB_LAND), ('v', LAND_BOTTOM_FRAME / FPS, 0.0),
                 ('z', T_LAND, IDLE0['hipZ']), ('v', T_LAND, 0.0), ('a', T_LAND, 0.0)], lower=D_RISE, w_acc=1e5)

# combined clip: one profile over the whole clip, z'' = -G exactly in the flight; the take-off is placed so the
# apex lands exactly on frame APEX_FRAME (an AUTO_CLAMPED Bezier key flattens any extreme that is not on a key)
TAU_F = (V_TO + math.sqrt(V_TO ** 2 + 2 * G * (ZE - H_REACH))) / G   # hips from ZE back down to H_REACH
V_TD_C = V_TO - G * TAU_F


def set_combined(apex_frame, frames, bottom_frame, zb_land=None, w_acc=1e6):
    """(re)build the combined clip's timing and hips profile (used for tuning, too)."""
    global APEX_FRAME, T_START_C, T_TD_C, COMBINED_FRAMES, LAND_BOTTOM_FRAME_C, T_LAND_C, PC, ZB_LAND_C
    APEX_FRAME, COMBINED_FRAMES, LAND_BOTTOM_FRAME_C = apex_frame, frames, bottom_frame
    ZB_LAND_C = ZB_LAND_C if zb_land is None else zb_land
    T_START_C = APEX_FRAME / FPS - V_TO / G
    T_TD_C = T_START_C + TAU_F
    T_C = COMBINED_FRAMES / FPS
    T_LAND_C = T_C - T_TD_C
    tb2 = LAND_BOTTOM_FRAME_C / FPS
    PC = qp_profile(T_C, IDLE0['hipZ'], 0.0,
                    [('a', 0.0, 0.0), ('z', START_BOTTOM_FRAME / FPS, ZB_START),
                     ('v', START_BOTTOM_FRAME / FPS, 0.0), ('z', T_START_C, ZE), ('v', T_START_C, V_TO),
                     ('z', tb2, ZB_LAND_C), ('v', tb2, 0.0), ('z', T_C, IDLE0['hipZ']), ('v', T_C, 0.0),
                     ('a', T_C, 0.0)], lower=A_DOWN, flight=(T_START_C, T_TD_C), w_acc=w_acc)


set_combined(47, 94, 78)


# ------------------------------------------------------------------ PCHIP tracks over the global timeline
G_START, G_AIR, G_LAND = T_START, 1.5, T_LAND
G_TO = G_START
G_TD = G_START + G_AIR
G_END = G_TD + G_LAND

UPPER = ['lean', 'chest', 'nod', 'headYaw', 'twist', 'hipX', 'hipY', 'hipPitch', 'hipRoll', 'hipYaw',
         'armL', 'armR', 'armOutL', 'armOutR', 'elbL', 'elbR', 'armTwL', 'armTwR', 'foreTwL', 'foreTwR',
         'wristBL', 'wristBR', 'wristRL', 'wristRR', 'shrugL', 'shrugR']
BASE = {k: float(IDLE0.get(k, 0.0)) for k in UPPER}


def _sym(**kw):
    """key helper: arm=..., armOut=..., elb=... set both sides; armL=... etc. override."""
    d = {}
    for k, v in kw.items():
        if k in ('arm', 'armOut', 'elb', 'armTw', 'foreTw', 'wristB', 'wristR', 'shrug'):
            d[k + 'L'] = v
            d[k + 'R'] = v
    for k, v in kw.items():
        if k not in ('arm', 'armOut', 'elb', 'armTw', 'foreTw', 'wristB', 'wristR', 'shrug'):
            d[k] = v
    return d


START_KEYS = [   # start-phase seconds (crouch bottom at 0.533 s, take-off at T_START)
    (0.00, {}),                                                                     # = idle_params(0.0)
    (0.24, _sym(lean=8, hipPitch=4, hipY=0.012, armL=-12, armR=-10, elbL=21, elbR=23, nod=1, chest=1)),
    (0.45, _sym(lean=19, hipPitch=9, hipY=0.034, armL=-36, armR=-34, armOut=12, elbL=24, elbR=26, nod=-4,
                chest=1, armTw=12)),
    (0.57, _sym(lean=21, hipPitch=10, hipY=0.040, armL=-42, armR=-40, armOut=15, elbL=24, elbR=26, nod=-6,
                chest=1, armTw=12)),
    (0.67, _sym(lean=17, hipPitch=8, hipY=0.026, armL=-12, armR=-14, armOut=14, elb=30, nod=-6, chest=0,
                armTw=12)),
    (T_START, _sym(lean=5, hipPitch=2, hipY=-0.012, armL=62, armR=59, armOut=16, elb=32, nod=-7, chest=-4,
                   shrug=5, armTw=14, wristB=-6)),
]
AIR_KEYS = [     # flight progress u (0 take-off, 0.5 apex, 1 touch-down); arms float out to the sides
    (0.19, _sym(lean=2, hipPitch=0, hipY=-0.010, armL=50, armR=47, armOutL=31, armOutR=33, elb=36, nod=-5,
                chest=-3, shrug=4, armTw=14, wristB=-4, hipRoll=0.8)),
    (0.47, _sym(lean=1, hipPitch=-1, hipY=-0.004, armL=37, armR=33, armOutL=44, armOutR=46, elbL=40,
                elbR=38, nod=-2, chest=-1, shrug=2, armTw=12, wristB=4, wristRL=6, wristRR=4,
                hipRoll=1.2, twist=2)),
    (0.70, _sym(lean=3, hipPitch=1, hipY=0.004, armL=33, armR=36, armOutL=43, armOutR=40, elbL=38,
                elbR=40, nod=2, chest=0, shrug=1, armTw=12, wristB=3, hipRoll=-0.8, twist=-1.5)),
    (0.88, _sym(lean=7, hipPitch=3, hipY=0.012, arm=30, armOutL=33, armOutR=34, elb=34, nod=6, chest=1,
                armTw=11, wristB=0, hipRoll=-0.3)),
    (1.00, _sym(lean=8, hipPitch=4, hipY=0.016, armL=27, armR=28, armOut=28, elb=32, nod=7, chest=1,
                armTw=11)),
]
LAND_KEYS = [    # land-phase seconds (bottom at 0.233 s); absorb, arms settle, rise back to idle
    (0.23, _sym(lean=18, hipPitch=9, hipY=0.034, armL=15, armR=17, armOut=15, elb=30, nod=5, chest=2,
                armTw=10)),
    (0.44, _sym(lean=7, hipPitch=3, hipY=0.012, armL=5, armR=6, armOut=4, elbL=21, elbR=23, nod=1, chest=1,
                armTw=10)),
    (T_LAND, {}),                                                                   # = idle_params(0.0)
]
UPPER_KEYS = ([(g, d) for g, d in START_KEYS] + [(G_TO + u * G_AIR, d) for u, d in AIR_KEYS] +
              [(G_TD + g, d) for g, d in LAND_KEYS])


def _pchip_slopes(xs, ys, s0=0.0, s1=0.0):
    n = len(xs)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [0.0] * n
    for i in range(1, n - 1):
        if d[i - 1] * d[i] <= 0:
            m[i] = 0.0
        else:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])
    m[0], m[-1] = s0, s1
    return m


class Track:
    def __init__(self, keys, slope0=0.0, slope1=0.0):
        self.x = [k[0] for k in keys]
        self.y = [k[1] for k in keys]
        self.m = _pchip_slopes(self.x, self.y, slope0, slope1)

    def __call__(self, x):
        xs, ys, m = self.x, self.y, self.m
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        for i in range(len(xs) - 1):
            if xs[i] <= x <= xs[i + 1]:
                h = xs[i + 1] - xs[i]
                s = (x - xs[i]) / h
                h00 = 2 * s ** 3 - 3 * s ** 2 + 1
                h10 = s ** 3 - 2 * s ** 2 + s
                h01 = -2 * s ** 3 + 3 * s ** 2
                h11 = s ** 3 - s ** 2
                return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1]


TRACKS = {k: Track([(g, d.get(k, BASE[k])) for g, d in UPPER_KEYS]) for k in UPPER}


def upper(gt):
    return {k: tr(gt) for k, tr in TRACKS.items()}


# ------------------------------------------------------------------ boots
def stance(k, name, yaw=None):
    yaw = YAW[k] if yaw is None else yaw
    R = L.foot_rot(0.0, yaw)
    heel = L.IDLE_STANCE[k]
    return heel + R @ (L.SOLE[k][name] - L.SOLE[k]['heel'])


def tip_roll_ball(k, tw):
    """ball (toe joint) world position when the toe segment is pitched tw deg about the planted toe tip."""
    R = L.foot_rot(tw, YAW[k])
    return stance(k, 'tip') + R @ (L.SOLE[k]['ball'] - L.SOLE[k]['tip'])


def seed_legs(p, th=20.0, kn=40.0):
    for k in 'LR':
        p['th' + k] = th
        p['kn' + k] = kn
        p['legOut' + k] = 2.0


def plant(p, k, pf, tw=0.0):
    """Boot k on the idle stance: flat (pf = 0), heel up about the ball (pf > 0, toe flat), or rolled onto the
    toe tip (tw > 0 = toe segment pitched about the tip, pf >= tw). Returns the IK miss."""
    if pf <= 1e-6 and tw <= 1e-6:
        return L.place_foot(p, k, 'heel', L.IDLE_STANCE[k], 0.0, YAW[k])
    ball = tip_roll_ball(k, tw) if tw > 1e-6 else stance(k, 'ball')
    return L.place_foot(p, k, 'ball', ball, pf, YAW[k], toe=tw - pf)


# heel lift / tip roll schedule in the push (start-phase seconds, game timing)
PF_TO, TW_TO = 24.0, 9.0         # take-off boot pitch, toe-segment pitch about the tip
HEEL_T0, TIP_T0 = 0.62, 0.74


def _ease_in(x, pw=1.7):
    x = min(max(x, 0.0), 1.0)
    return x ** pw


def start_feet(s):
    """s = start-phase fraction [0, 1] -> (pf, tw)"""
    t = s * T_START
    pf = PF_TO * _ease_in((t - HEEL_T0) / (T_START - HEEL_T0), 1.6)
    tw = TW_TO * _ease_in((t - TIP_T0) / (T_START - TIP_T0), 1.5)
    return pf, tw


# flight boot tracks: ball offset (m, world, relative to the stance ball), boot pitch, toe (relative)
BALL_TO = {k: tip_roll_ball(k, TW_TO) - stance(k, 'ball') for k in 'LR'}
AIR_FEET = {
    'L': [(0.00, (BALL_TO['L'].y, BALL_TO['L'].z, PF_TO, TW_TO - PF_TO)),
          (0.14, (0.010, 0.075, 28.0, -6.0)),
          (0.40, (-0.045, 0.150, 15.0, 0.0)),
          (0.62, (-0.040, 0.140, 13.0, 0.0)),
          (0.86, (-0.008, 0.042, 12.0, -6.0)),
          (1.00, (0.0, 0.0, P_LAND, -P_LAND))],
    'R': [(0.00, (BALL_TO['R'].y, BALL_TO['R'].z, PF_TO, TW_TO - PF_TO)),
          (0.16, (0.014, 0.070, 27.0, -6.0)),
          (0.43, (-0.022, 0.132, 15.0, 0.0)),
          (0.66, (-0.030, 0.140, 13.0, 0.0)),
          (0.87, (-0.006, 0.040, 12.0, -6.0)),
          (1.00, (0.0, 0.0, P_LAND, -P_LAND))],
}
AIR_TR = {k: [Track([(u, v[i]) for u, v in AIR_FEET[k]], slope0=None, slope1=0.0) for i in range(4)]
          for k in 'LR'}
# start slopes of the flight tracks: one-sided (the boot keeps moving the way it left the ground)
for k in 'LR':
    for i, tr in enumerate(AIR_TR[k]):
        tr.m[0] = (tr.y[1] - tr.y[0]) / (tr.x[1] - tr.x[0]) * 0.6


def air_feet(p, u, lift=0.0):
    miss = 0.0
    for k in 'LR':
        dy, dz, pf, toe = (tr(u) for tr in AIR_TR[k])
        ball = stance(k, 'ball') + Vector((0.0, dy, dz + lift))
        miss = max(miss, L.place_foot(p, k, 'ball', ball, pf, YAW[k], toe=toe))
    return miss


LAND_HEEL_T = 0.13   # s: heel comes down from P_LAND to flat


def land_feet(w):
    t = w * T_LAND
    x = min(max(t / LAND_HEEL_T, 0.0), 1.0)
    return P_LAND * (1 - x * x * (3 - 2 * x)) if x < 1 else 0.0


# ------------------------------------------------------------------ poses
LAST_MISS = {}


def _finish(p, name):
    return p


def start_pose(s, prof=None, T=T_START):
    """s in [0,1] over JumpStart (prof/T: the game clip or the combined clip's own timing)."""
    if s <= 0.0:
        return dict(IDLE0)
    p = upper(s * G_START)
    p['hipZ'] = (prof or PS).at(s * T)[0]
    seed_legs(p, 25.0, 45.0)
    pf, tw = start_feet(s)
    miss = max(plant(p, k, pf, tw) for k in 'LR')
    LAST_MISS['start'] = max(LAST_MISS.get('start', 0.0), miss)
    return p


def air_hipz(u):
    return ZE + (H_REACH - ZE) * u


def air_pose(u, lift=0.0, hipz=None):
    """u = flight progress [0,1]. lift: extra height of everything (the combined clip's root parabola)."""
    if u <= 0.0 and lift == 0.0:
        return start_pose(1.0)
    p = upper(G_TO + u * G_AIR)
    p['hipZ'] = (air_hipz(u) if hipz is None else hipz)
    seed_legs(p, 30.0, 50.0)
    miss = air_feet(p, u, p['hipZ'] - air_hipz(u))
    LAST_MISS['air'] = max(LAST_MISS.get('air', 0.0), miss)
    return p


def land_pose(w, prof=None, T=T_LAND, t0=0.0):
    if w <= 0.0:
        return air_pose(1.0)
    if w >= 1.0:
        return dict(IDLE0)
    p = upper(G_TD + w * G_LAND)
    p['hipZ'] = (prof or PL).at(t0 + w * T)[0]
    seed_legs(p, 25.0, 45.0)
    pf = land_feet(w)
    miss = max(plant(p, k, pf) for k in 'LR')
    LAST_MISS['land'] = max(LAST_MISS.get('land', 0.0), miss)
    return p


def combined_pose(t):
    """t in [0,1] over the combined Jump clip (COMBINED_FRAMES)."""
    ts = t * COMBINED_FRAMES / FPS
    if ts <= T_START_C:
        return start_pose(ts / T_START_C, PC, T_START_C)
    if ts < T_TD_C:
        u = (ts - T_START_C) / TAU_F
        return air_pose(u, hipz=PC.at(ts)[0])
    w = (ts - T_TD_C) / T_LAND_C
    if w >= 1.0 - 1e-9:
        return dict(IDLE0)
    return land_pose(w, PC, T_LAND_C, T_TD_C)


def _stats(P, t0, t1):
    n = 600
    sm = [P.at(t0 + (t1 - t0) * i / n) for i in range(n + 1)]
    return {'zmin': round(min(q[0] for q in sm), 4), 'amin': round(min(q[2] for q in sm), 3),
            'amax': round(max(q[2] for q in sm), 3), 'a0': round(sm[0][2], 3), 'a1': round(sm[-1][2], 3),
            'z1': round(sm[-1][0], 4), 'v1': round(sm[-1][1], 4)}


def info():
    return {'start': _stats(PS, 0, T_START), 'land': _stats(PL, 0, T_LAND), 'land_v0': round(V_TD_GAME, 4),
            'comb_start': _stats(PC, 0, T_START_C), 'comb_flight': _stats(PC, T_START_C, T_TD_C),
            'comb_land': _stats(PC, T_TD_C, COMBINED_FRAMES / FPS), 'T_START_C': round(T_START_C, 4),
            'T_TD_C': round(T_TD_C, 4), 'tau_f': round(TAU_F, 4), 'v_td_c': round(V_TD_C, 4),
            'max_resid': max(RESID)}
