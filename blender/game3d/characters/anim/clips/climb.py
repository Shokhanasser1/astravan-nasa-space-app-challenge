"""Climb: the habitat's vertical deck ladder (blender/interiors/habitat/build_habitat.py: rungs every 0.30 m,
rails x = +-0.24, no lean), made from the lander's LadderUp (clips_lander/ladder.py) with the lean set to 0.

Rig space (character faces -Y). The ladder plane is y = 0 (rung centres and rails), the climber hangs behind it
at +Y. The root (model origin) sits on the ladder plane, on the centre line of the rung under the LEFT boot's ball
at t = 0 (rung n); the right boot is on rung n+1. The body's middle is ~0.44 m behind the root (+Y).
Loop, in place: one cycle = 2 rungs = 0.60 m of height (meta rise_per_cycle); the game raises the root by
rise_per_cycle per clip duration at timeScale 1 (timeScale = rise speed / (rise_per_cycle / duration)), and plays
it backwards to climb down. Contralateral climb: left foot + right hand move together, then right foot + left hand.
"""
import math
from mathutils import Vector
import lunar_rig as L
import _climb_core as C
from _climb_core import Hermite, smooth

U = Vector((0.0, 0.0, 1.0))         # up the ladder
NRM = Vector((0.0, 1.0, 0.0))       # off the ladder, toward the climber
UPW = Vector((0, 0, 1))

FRAMES = 42                          # 1.4 s per 2 rungs at timeScale 1
CYCLE_H = 0.60
CLIMB_V = CYCLE_H / (FRAMES / L.FPS)  # 0.43 m/s of height (clip space, native metres)
FOOT_X = 0.10
P_LAND, P_LIFT = -8.0, 16.0          # boot pitch on the rung: lands toes-up a little, heel rises before lift

SW_FOOT = {'L': (0.02, 0.40, 0), 'R': (0.52, 0.90, 1)}     # (start, end, rung index at the start, rel. to n)
SW_HAND = {'R': (0.00, 0.35), 'L': (0.50, 0.85)}
HAND_Z0 = {'R': 1.24, 'L': 1.24 + 0.30}                    # rail height (rel. root at t = 0) released at the swing start

HIP_A, HIP_B = 0.77, 0.42            # hips bone head: height above rung n, distance behind the ladder plane
HIP_PITCH, LEAN = 4.0, 8.0
HIP_SWAY = 0.05
LEG_OUT_LIM = (-30.0, 35.0)          # kit default (-12, 35): the folded leg between the rails needs more adduction


def drift(t):
    """clip-space shift of a ladder-fixed point at cycle time t (the root has climbed 0.6 t)"""
    return -U * (CYCLE_H * t)


def rung_c(m):
    return U * (0.30 * m)


def rail_pt(k, zrel):
    sg = 1 if k == 'L' else -1
    return Vector((sg * C.RAIL_X, 0, 0)) + U * zrel


def foot_x(k):
    return FOOT_X if k == 'L' else -FOOT_X


def foot_state(k, t):
    """(ball landmark position in clip space, pitch, phase) of boot k at cycle time t (any real t)"""
    t0, t1, m0 = SW_FOOT[k]
    j = math.floor(t - t0)
    tc = t - j
    xo = Vector((foot_x(k), 0, 0))
    if tc <= t1:
        s = (tc - t0) / (t1 - t0)
        a = C.ball_on_rung(k, rung_c(m0 + 2 * j) + xo, P_LIFT)
        b = C.ball_on_rung(k, rung_c(m0 + 2 * (j + 1)) + xo, P_LAND)
        keys = [(0.0, a), (0.22, a + NRM * 0.10 + UPW * 0.03), (0.55, a.lerp(b, 0.55) + NRM * 0.13),
                (0.82, b + NRM * 0.06 + UPW * 0.04), (1.0, b)]
        pk = [(0.0, P_LIFT), (0.3, 6.0), (0.6, -6.0), (0.85, -10.0), (1.0, P_LAND)]
        return Hermite(keys)(s) + drift(t), C.pchip(pk)(s), ('swing', s)
    m = m0 + 2 * (j + 1)
    u = (tc - t1) / (1.0 - (t1 - t0))
    pitch = P_LAND + (P_LIFT - P_LAND) * smooth((u - 0.15) / 0.85)
    return C.ball_on_rung(k, rung_c(m) + xo, pitch) + drift(t), pitch, ('stance', m)


def hand_state(k, t):
    t0, t1 = SW_HAND[k]
    j = math.floor(t - t0)
    tc = t - j
    za = HAND_Z0[k] + CYCLE_H * j
    if tc <= t1:
        s = (tc - t0) / (t1 - t0)
        a, b = rail_pt(k, za), rail_pt(k, za + CYCLE_H)
        keys = [(0.0, a), (0.2, a + NRM * 0.07), (0.75, b + NRM * 0.08), (1.0, b)]
        return Hermite(keys)(s) + drift(t), ('swing', s)
    return rail_pt(k, za + CYCLE_H) + drift(t), ('grip', za + CYCLE_H)


def hand_dir(k):
    sg = 1 if k == 'L' else -1
    return (-NRM * 1.0 - U * 0.20 + Vector((-sg * 0.35, 0, 0))).normalized()


def body(t):
    ph = 2 * math.pi * t
    p = {}
    hip = U * (HIP_A + 0.02 * math.sin(2 * ph - 0.6)) + NRM * HIP_B
    p['hipX'] = -HIP_SWAY * math.cos(ph - 2 * math.pi * 0.42)   # pelvis over the folded (high) leg
    p['hipY'] = hip.y + 0.03
    p['hipZ'] = hip.z - 0.84
    p['hipPitch'] = HIP_PITCH
    p['hipRoll'] = 2.5 * math.sin(ph + 0.5)
    p['hipYaw'] = 3.0 * math.sin(ph + 0.2)
    p['lean'] = LEAN + 1.5 * math.sin(2 * ph)
    p['twist'] = -4.0 * math.sin(ph + 0.9)
    p['chest'] = 0.0
    p['nod'] = -14.0 + 4 * math.sin(ph)
    p['headYaw'] = 6.0 * math.sin(ph + 0.6)
    return p


def seed_arms(p):
    for k in 'LR':
        p.update({'arm' + k: 80.0, 'armOut' + k: 25.0, 'elb' + k: 60.0, 'armTw' + k: 10.0, 'foreTw' + k: 0.0,
                  'wristB' + k: 0.0, 'wristR' + k: 0.0})


def pose(t, state):
    p = body(t)
    for k in 'LR':
        for n, v in state.get('legs' + k, {'th': 60.0, 'kn': 80.0, 'legOut': -5.0}).items():
            p[n + k] = v
    miss = {}
    lim = L.LIM['legOut']
    try:
        L.LIM['legOut'] = LEG_OUT_LIM
        for k in 'LR':
            pos, pitch, ph = foot_state(k, t)
            miss['foot' + k] = L.place_foot(p, k, 'ball', pos, pitch, 0.0, toe=0.0)
            state['legs' + k] = {'th': p['th' + k], 'kn': p['kn' + k], 'legOut': p['legOut' + k]}
    finally:
        L.LIM['legOut'] = lim
    if 'arms' not in state:
        seed_arms(p)
    else:
        p.update(state['arms'])
    for k in 'LR':
        tgt, ph = hand_state(k, t)
        prev = C.arm_params(p, k) if 'arms' in state else None
        miss['hand' + k] = C.solve_arm(p, k, tgt, 'grip', hdir=hand_dir(k), wdir=0.12, prev=prev, wprev=0.003,
                                       pref=state.get('pref'), wpref=0.002, elbow_out=0.30)
    state['arms'] = {kk: p[kk] for kk in p if any(kk.startswith(n) for n in C.ARM_KEYS)}
    state['miss'] = miss
    return p


def _arm_keys(row):
    return [k for k, v in row.items() if isinstance(v, float) and any(k.startswith(n) for n in C.ARM_KEYS)]


def _mean_arms(rows):
    return {k: sum(r[k] for r in rows) / len(rows) for k in _arm_keys(rows[0])}


SEAM = {}
MISS = {}


def build():
    st = {}
    pose(0.9, st)          # warm start on the cycle's end so frame 0 starts converged
    pose(0.97, st)
    rows = [None] * (FRAMES + 1)
    for rep in range(3):
        if rep:
            st['pref'] = _mean_arms(rows)
        for f in range(FRAMES + 1):
            rows[f] = pose(f / FRAMES, st)
            MISS[f] = dict(st['miss'])
    # spread the frame-0 vs frame-N difference of the redundant arm DOFs over the cycle: no pop at the loop seam
    keys = _arm_keys(rows[0])
    d = {k: rows[0][k] - rows[FRAMES][k] for k in keys}
    SEAM['max'] = max(abs(v) for v in d.values())
    for f, r in enumerate(rows):
        for k in keys:
            r[k] += d[k] * f / FRAMES
    return rows


ROWS = build()


def climb(t):
    f = min(max(int(round(t * FRAMES)), 0), FRAMES)
    return dict(ROWS[f])


worst = max(max(m.values()) for m in MISS.values())
print('ANIM CLIMB ik miss max %.4f m, arm seam %.2f deg' % (worst, SEAM['max']))
for _k in ('footL', 'footR', 'handL', 'handR'):
    _f = max(MISS, key=lambda f: MISS[f][_k])
    print('ANIM CLIMB miss %s max %.4f at frame %d' % (_k, MISS[_f][_k], _f))

CLIPS = [
    dict(name='Climb', fn=climb, frames=FRAMES, loop=True, speed=0.0,
         sheet=[0, 7, 14, 21, 28, 35],
         meta={'note': 'vertical ladder climb loop (habitat deck ladder), 2 rungs per cycle, in place; the game '
                       'raises the root by rise_per_cycle per cycle; play backwards to climb down',
               'rise_per_cycle': CYCLE_H, 'climb_speed': round(CLIMB_V, 4), 'ladder_lean_deg': 0.0,
               'rung_pitch': 0.30, 'body_behind_root': HIP_B}),
]
