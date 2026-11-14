"""Ladder clips for the lander v2 ladder (SPEC.md: rungs 0.30 m apart, 28 deg lean, rails x = +-0.24).

Rig space (character faces -Y). The root slides along the ladder line (through the rung centres):
  u   = (0, -sin28, cos28)  up the ladder           nrm = (0, cos28, sin28)  off the ladder, toward the climber
World: the root moves (0, +tan28, 1) * height; rig = world offset rotated 180 deg about Z.

LadderUp (loop, in place): at t = 0 the root sits exactly on the centre line of the rung under the LEFT boot's
ball (call it rung n); the right boot is on rung n+1. One cycle = 2 rungs = 0.60 m of height; the scene moves the
root by (0, +0.3190, +0.60) world per cycle. Contralateral climb: left foot + right hand move together
(t 0.02..0.32 / 0.00..0.35), then right foot + left hand (t 0.52..0.82 / 0.50..0.85).
"""
import math
from mathutils import Vector
import lunar_rig as L
import _lander_core as C
from _lander_core import TAN28, SIN28, COS28, Hermite, smooth, smoother

U = Vector((0.0, -SIN28, COS28))
NRM = Vector((0.0, COS28, SIN28))
UPW = Vector((0, 0, 1))

UP_FRAMES = 72                      # 2.4 s per 2 rungs
CYCLE_H = 0.60
CLIMB_V = CYCLE_H / (UP_FRAMES / L.FPS)   # 0.25 m/s of height
FOOT_X = 0.10
P_LAND, P_LIFT = -12.0, 16.0        # boot pitch on the rung: lands toes-up a little, heel rises before lift

# contact schedule (cycle fraction)
SW_FOOT = {'L': (0.02, 0.40, 0), 'R': (0.52, 0.90, 1)}     # (start, end, rung index at the start, rel. to n)
SW_HAND = {'R': (0.00, 0.35), 'L': (0.50, 0.85)}
HAND_Z0 = {'R': 0.84, 'L': 0.84 + 0.30}                    # world-rel rail height released at the swing start

# pelvis in ladder coords (hips bone head), tuned with diag()
HIP_A, HIP_B = 0.66, 0.55
HIP_PITCH, LEAN = 22.0, 30.0
HIP_SWAY = 0.07
LEG_OUT_LIM = (-30.0, 35.0)   # kit default (-12, 35): the folded leg needs more adduction


def drift(t, dirn=1):
    """clip-space shift of a world-fixed point at cycle time t (the root has climbed 0.6 t; dirn -1: descended)"""
    return -U * (dirn * CYCLE_H * t / COS28)


def rung_c(m, t=0.0, dirn=1):
    return U * (0.30 * m / COS28) + drift(t, dirn)


def rail_pt(k, zrel, t=0.0, dirn=1):
    sg = 1 if k == 'L' else -1
    return Vector((sg * C.RAIL_X, 0, 0)) + U * (zrel / COS28) + drift(t, dirn)


def foot_x(k):
    return FOOT_X if k == 'L' else -FOOT_X


# ------------------------------------------------------------------ boot paths (world-rel = clip at t = 0)
def foot_state(k, t, sw=SW_FOOT, cyc=1.0, dirn=1):
    """(ball landmark position in clip space, pitch, phase) of boot k at cycle time t (any real t).
    dirn = +1 climbing up, -1 climbing down (the down clip passes its own schedule)."""
    t0, t1, m0 = sw[k]
    # which cycle are we in: the boot rests on rung m0 + 2j before the swing of cycle j
    j = math.floor(t - t0)
    tc = t - j            # in [t0, t0 + 1)
    if tc <= t1:
        s = (tc - t0) / (t1 - t0)
        ma, mb = m0 + 2 * dirn * j, m0 + 2 * dirn * (j + 1)
        a = C.ball_on_rung(k, rung_c(ma) + Vector((foot_x(k), 0, 0)), P_LIFT if dirn > 0 else P_LAND)
        b = C.ball_on_rung(k, rung_c(mb) + Vector((foot_x(k), 0, 0)), P_LAND if dirn > 0 else P_LIFT)
        pos, pitch = swing_path(a, b, s, dirn)
        return pos + drift(t, dirn), pitch, ('swing', s)
    # planted on rung m0 + 2(j+1) since the end of this cycle's swing
    m = m0 + 2 * dirn * (j + 1)
    u = (tc - t1) / (1.0 - (t1 - t0))     # 0 at landing .. 1 at the next lift
    if dirn > 0:
        pitch = P_LAND + (P_LIFT - P_LAND) * smooth((u - 0.15) / 0.85)
    else:
        pitch = P_LIFT + (P_LAND - P_LIFT) * smooth((u - 0.15) / 0.85)
    pos = C.ball_on_rung(k, rung_c(m) + Vector((foot_x(k), 0, 0)), pitch)
    return pos + drift(t, dirn), pitch, ('stance', m)


def swing_path(a, b, s, dirn=1):
    """ball landmark from a (old rung) to b (new rung): back off the ladder, travel, settle down onto the rung"""
    if dirn > 0:
        keys = [(0.0, a), (0.22, a + NRM * 0.09 + UPW * 0.03), (0.55, a.lerp(b, 0.55) + NRM * 0.19),
                (0.82, b + NRM * 0.05 + UPW * 0.06), (1.0, b)]
        pk = [(0.0, P_LIFT), (0.3, 6.0), (0.6, -10.0), (0.85, -14.0), (1.0, P_LAND)]
    else:   # down: heel goes first, feel for the rung below, drop onto it
        keys = [(0.0, a), (0.2, a + NRM * 0.08 + UPW * 0.02), (0.5, a.lerp(b, 0.5) + NRM * 0.19),
                (0.8, b + NRM * 0.07 + UPW * 0.05), (1.0, b)]
        pk = [(0.0, P_LAND), (0.3, -8.0), (0.6, 4.0), (0.85, 10.0), (1.0, P_LIFT)]
    pos = Hermite(keys)(smoother(s) * 0.0 + s)
    pitch = C.pchip(pk)(s)
    return pos, pitch


# ------------------------------------------------------------------ hands
def hand_state(k, t, sw=SW_HAND, z0=HAND_Z0, dirn=1):
    t0, t1 = sw[k]
    j = math.floor(t - t0)
    tc = t - j
    za = z0[k] + dirn * CYCLE_H * j
    if tc <= t1:
        s = (tc - t0) / (t1 - t0)
        a, b = rail_pt(k, za), rail_pt(k, za + dirn * CYCLE_H)
        keys = [(0.0, a), (0.2, a + NRM * 0.06), (0.75, b + NRM * 0.07), (1.0, b)]
        return Hermite(keys)(s) + drift(t, dirn), ('swing', s)
    return rail_pt(k, za + dirn * CYCLE_H) + drift(t, dirn), ('grip', za + dirn * CYCLE_H)


def hand_dir(k):
    sg = 1 if k == 'L' else -1
    return (-NRM * 1.0 - U * 0.25 + Vector((-sg * 0.35, 0, 0))).normalized()


# ------------------------------------------------------------------ body
def body_up(t):
    ph = 2 * math.pi * t
    p = {}
    hip = U * (HIP_A + 0.018 * math.sin(2 * ph - 0.6)) + NRM * HIP_B
    p['hipX'] = -HIP_SWAY * math.cos(ph - 2 * math.pi * 0.42)   # pelvis over the folded (high) leg
    p['hipY'] = hip.y + 0.03
    p['hipZ'] = hip.z - 0.84
    p['hipPitch'] = HIP_PITCH
    p['hipRoll'] = 2.5 * math.sin(ph + 0.5)
    p['hipYaw'] = 3.0 * math.sin(ph + 0.2)
    p['lean'] = LEAN + 1.5 * math.sin(2 * ph)
    p['twist'] = -4.0 * math.sin(ph + 0.9)
    p['chest'] = 0.0
    p['nod'] = -30.0 + 4 * math.sin(ph)
    p['headYaw'] = 6.0 * math.sin(ph + 0.6)
    return p


def seed_arms(p):
    for k in 'LR':
        p.update({'arm' + k: 75.0, 'armOut' + k: 30.0, 'elb' + k: 40.0, 'armTw' + k: 10.0, 'foreTw' + k: 0.0,
                  'wristB' + k: 0.0, 'wristR' + k: 0.0})


def pose_ladder(t, state, body=body_up, feet=foot_state, hands=hand_state, dirn=1):
    p = body(t)
    for k in 'LR':
        for n, v in state.get('legs' + k, {'th': 60.0, 'kn': 80.0, 'legOut': -5.0}).items():
            p[n + k] = v
    miss = {}
    lim = L.LIM['legOut']
    for k in 'LR':
        pos, pitch, ph = feet(k, t)
        L.LIM['legOut'] = LEG_OUT_LIM
        miss['foot' + k] = L.place_foot(p, k, 'ball', pos, pitch, 0.0, toe=0.0)
        state['legs' + k] = {'th': p['th' + k], 'kn': p['kn' + k], 'legOut': p['legOut' + k]}
    L.LIM['legOut'] = lim
    if 'arms' not in state:
        seed_arms(p)
    else:
        p.update(state['arms'])
    for k in 'LR':
        tgt, ph = hands(k, t)
        prev = C.arm_params(p, k) if 'arms' in state else None
        miss['hand' + k] = C.solve_arm(p, k, tgt, 'grip', hdir=hand_dir(k), wdir=0.12, prev=prev, wprev=0.003,
                                       pref=state.get('pref'), wpref=0.002, elbow_out=0.30)
    state['arms'] = {kk: p[kk] for kk in p if any(kk.startswith(n) for n in C.ARM_KEYS)}
    state['miss'] = miss
    return p


def _solve_up(t, state):
    return pose_ladder(t, state)


def build_up():
    st = {}
    pose_ladder(0.9, st)       # warm start: settle the IK on the cycle's end so frame 0 starts converged
    pose_ladder(0.97, st)
    rows = []
    for f in range(UP_FRAMES + 1):
        rows.append(pose_ladder(f / UP_FRAMES, st))
        rows[-1]['_miss'] = dict(st['miss'])
    # more passes, warm-started from the end, with the cycle-mean arm pose as a weak preference: pins the
    # redundant arm DOFs so the IK cycle closes on itself
    for rep in range(2):
        st['pref'] = _mean_arms(rows)
        for f in range(UP_FRAMES + 1):
            rows[f] = pose_ladder(f / UP_FRAMES, st)
            rows[f]['_miss'] = dict(st['miss'])
    return close_loop(rows)


def _mean_arms(rows):
    keys = [k for k, v in rows[0].items() if isinstance(v, float) and any(k.startswith(n) for n in C.ARM_KEYS)]
    return {k: sum(r[k] for r in rows) / len(rows) for k in keys}


SEAM = {}


def close_loop(rows):
    """the redundant arm DOFs (twist, wrist roll) drift a little over one IK cycle: spread the frame-0 vs frame-N
    difference linearly over the cycle so the loop seam has no pop (the grip points barely move)"""
    N = len(rows) - 1
    keys = [k for k, v in rows[0].items() if isinstance(v, float) and any(k.startswith(n) for n in C.ARM_KEYS)]
    d = {k: rows[0][k] - rows[N][k] for k in keys}
    SEAM[len(rows)] = max(abs(v) for v in d.values())
    for f, r in enumerate(rows):
        for k in keys:
            r[k] += d[k] * f / N
    return rows


class Clip:
    def __init__(self, rows, n):
        self.rows, self.N = rows, n

    def __call__(self, t):
        f = min(max(int(round(t * self.N)), 0), self.N)
        p = dict(self.rows[f])
        p.pop('_miss', None)
        return p


UP_ROWS = build_up()
ladder_up = Clip(UP_ROWS, UP_FRAMES)


def contacts_up(f):
    """intended contacts at frame f of LadderUp (rig space): {limb: ('ball'|'grip', target)} for planted limbs"""
    t = f / UP_FRAMES
    out = {}
    for k in 'LR':
        pos, pitch, ph = foot_state(k, t)
        if ph[0] == 'stance':
            out['foot' + k] = ('rung', rung_c(ph[1], t) + Vector((foot_x(k), 0, 0)))
        tgt, hp = hand_state(k, t)
        if hp[0] == 'grip':
            out['hand' + k] = ('rail', tgt)
    return out


ROOT_PER_CYCLE_W = (0.0, round(CYCLE_H * TAN28, 4), CYCLE_H)

CLIPS = [
    dict(name='LadderUp', fn=ladder_up, frames=UP_FRAMES, loop=True, speed=0.0,
         sheet=[0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66],
         meta={'note': 'climb loop, 2 rungs per cycle. t=0: root on the centre line of the rung under the left '
                       'boot (rung n), right boot on rung n+1; scene moves the root along the ladder line',
               'climb_speed': round(CLIMB_V, 4), 'ladder_lean_deg': 28.0,
               'root_per_cycle_world': list(ROOT_PER_CYCLE_W),
               'root_per_cycle_rig': [0.0, -ROOT_PER_CYCLE_W[1], CYCLE_H]}),
]


# ------------------------------------------------------------------ for the verifier (world placement)
def _root_up(f, n=2):
    h = CYCLE_H * f / UP_FRAMES
    return C.rung_world(n) + Vector((0, TAN28, 1.0)) * h


def _contacts_up_w(f):
    r = _root_up(f)
    return {k: (kind, C.r2w(tgt, r)) for k, (kind, tgt) in contacts_up(f).items()}


SCENE = {
    'LadderUp': dict(root=_root_up, contacts=_contacts_up_w, look=lambda f: _root_up(f) + Vector((0, -0.05, 1.0)),
                     ortho=2.3, mesh=True, sheet=[0, 12, 24, 36, 48, 60]),
}


# ================================================================== LadderUpTop (n = 4 -> 6, one-shot)
# Same as one LadderUp cycle from rung n = 4, except the two hand regrips: the straight rails end at z ~3.27
# (fillet r 0.11 at z 3.33, then the handles swing out to the porch handrail front posts). The right hand regrips
# at world z 3.24 on the straight rail, the left hand on the handle's out-swing at (-0.40, -2.30, 3.50) world.
# Frame 0 = LadderUp frame 0 (n = 4); the last frame (t = 1, root on rung 6) is LadderTopOut's first frame.
UPTOP_N = UP_FRAMES
UPTOP_ROOT0 = C.rung_world(4)
TOP_GRIP_W = {'R': Vector((0.24, C.ladder_y(3.24), 3.24)), 'L': Vector((-0.40, -2.30, 3.50))}
TOP_GRIP_REL = {k: C.w2r(v, UPTOP_ROOT0) for k, v in TOP_GRIP_W.items()}   # rig, cycle root at t = 0


TOP7_PITCH = 6.0      # right boot on rung 7: toe a little down so the toe box clears the porch underside


def _feet_uptop(k, t):
    pos, pitch, ph = foot_state(k, t)
    if k == 'R' and t > SW_FOOT['R'][0]:
        if ph[0] == 'swing':
            w = smooth((ph[1] - 0.45) / 0.55)
        else:
            w = 1.0
        if w > 0:
            new = pitch + (TOP7_PITCH - pitch) * w
            # keep the ball on the same point: re-derive the ball landmark for the new pitch about the rung contact
            if ph[0] == 'stance':
                rc = rung_c(ph[1]) + Vector((foot_x(k), 0, 0)) + drift(t)
                pos = C.ball_on_rung(k, rc, new)
            else:
                # rung 7 sits under the porch lip: slide the toe in horizontally at the very end
                m0 = SW_FOOT['R'][2]
                xo = Vector((foot_x(k), 0, 0))
                a = C.ball_on_rung(k, rung_c(m0) + xo, P_LIFT)
                b = C.ball_on_rung(k, rung_c(m0 + 2) + xo, new)
                sw = ph[1]
                keys = [(0.0, a), (0.22, a + NRM * 0.09 + UPW * 0.03), (0.55, a.lerp(b, 0.55) + NRM * 0.19),
                        (0.80, b + Vector((0, 0.09, 0.012))), (1.0, b)]
                pos = Hermite(keys)(sw) + drift(t)
            pitch = new
    return pos, pitch, ph


def _hands_uptop(k, t):
    if k == 'R':
        t0, t1, a = SW_HAND['R'][0], SW_HAND['R'][1], rail_pt('R', HAND_Z0['R'])
    else:
        t0, t1, a = SW_HAND['L'][0], SW_HAND['L'][1], rail_pt('L', HAND_Z0['L'])
    b = TOP_GRIP_REL[k]
    if t < t0:
        return a + drift(t), ('grip', a)
    if t <= t1:
        s = (t - t0) / (t1 - t0)
        keys = [(0.0, a), (0.2, a + NRM * 0.06), (0.75, b + NRM * 0.07), (1.0, b)]
        return Hermite(keys)(s) + drift(t), ('swing', s)
    return b + drift(t), ('grip', b)


def build_uptop():
    st = {'pref': _mean_arms(UP_ROWS)}
    # warm start exactly like LadderUp's last pass ends, then replay from t = 0
    for t0 in (0.9, 0.97):
        pose_ladder(t0, st)
    rows = []
    for f in range(UPTOP_N + 1):
        r = pose_ladder(f / UPTOP_N, st, feet=_feet_uptop, hands=_hands_uptop)
        r['_miss'] = dict(st['miss'])
        rows.append(r)
    rows[0] = dict(UP_ROWS[0])
    # blend the first frames from LadderUp's frame 0 so the join is exact and smooth
    for f in range(1, 6):
        u = smooth(f / 6)
        for kk, v in rows[f].items():
            if isinstance(v, float) and isinstance(UP_ROWS[f].get(kk), float):
                rows[f][kk] = UP_ROWS[f][kk] + (v - UP_ROWS[f][kk]) * u
    return rows


UPTOP_ROWS = build_uptop()
ladder_up_top = Clip(UPTOP_ROWS, UPTOP_N)


def contacts_uptop(f):
    t = f / UPTOP_N
    out = {}
    for k in 'LR':
        pos, pitch, ph = _feet_uptop(k, t)
        if ph[0] == 'stance':
            out['foot' + k] = ('rung', rung_c(ph[1], t) + Vector((foot_x(k), 0, 0)))
        tgt, hp = _hands_uptop(k, t)
        if hp[0] == 'grip':
            out['hand' + k] = ('rail', tgt)
    return out


def _root_uptop(f):
    return UPTOP_ROOT0 + Vector((0, TAN28, 1.0)) * (CYCLE_H * f / UPTOP_N)


CLIPS.append(dict(name='LadderUpTop', fn=ladder_up_top, frames=UPTOP_N, loop=False, speed=0.0,
                  sheet=[0, 12, 24, 36, 48, 60, 72],
                  meta={'note': 'last climb cycle, rung n=4 -> 6: like LadderUp but the hands regrip the top of the '
                                'straight rail (R, z 3.24) and the handle out-swing (L, (-0.40,-2.30,3.50)); the scene '
                                'moves the root along the ladder line exactly as in LadderUp',
                        'start_equals': 'LadderUp frame 0 (n=4)', 'root_start_world': [round(v, 4) for v in UPTOP_ROOT0],
                        'root_per_clip_world': [0.0, round(CYCLE_H * TAN28, 4), CYCLE_H],
                        'climb_speed': round(CLIMB_V, 4), 'end_equals': 'LadderTopOut frame 0'}))
SCENE['LadderUpTop'] = dict(root=_root_uptop,
                            contacts=lambda f: {k: (kind, C.r2w(tgt, _root_uptop(f)))
                                                for k, (kind, tgt) in contacts_uptop(f).items()},
                            look=lambda f: _root_uptop(f) + Vector((0, -0.05, 1.0)), ortho=2.3, mesh=True,
                            sheet=[0, 12, 24, 36, 48, 60, 72])


# ================================================================== LadderTopOut
# Starts on LadderUp frame 0 with the root on rung 6 (world (0, -2.689, 2.50)): left boot on rung 6, right boot on
# rung 7 (the top rung), hands on the rails above the porch edge. Hands move to the porch handrails
# (x +-0.62, 0.90 m above the porch), the right boot steps onto the porch, the body rises, the left boot follows,
# the right boot closes to the idle stance, hands let go -> idle_params(0.0) at (0, -2.05, 2.98).
from _steps import Boot
import _lander_core as _C

TOP_N = 184
TOP_ROOT0 = C.rung_world(6)
TOP_ROOT1 = Vector((0.0, -2.05, 2.98))
TOP_END = C.w2r(TOP_ROOT1, TOP_ROOT0)            # rig offset of the final root
PZ = C.PORCH_Z - TOP_ROOT0.z                     # porch top in rig z (0.48)
IDLE0 = C.idle0()


def _rung_pitch(k):
    return foot_state(k, 0.0)[1]


TOP_BOOTS = {
    'R': Boot('R', [('rung', 0, 30, rung_c(1) + Vector((foot_x('R'), 0, 0)), (TOP7_PITCH, TOP7_PITCH)),
                    ('flat', 74, 116, Vector((-0.10, -0.40, PZ)), -2.0),     # x 0.10 world: inside the rails
                    ('flat', 140, TOP_N, Vector((L.IDLE_STANCE['R'].x, TOP_END.y + 0.05, PZ)), -4.0)],
              lift=0.10, extra_lift={0: Vector((0, 0.14, 0.06))}, preland={0: 0.10},
              postlift={0: Vector((0, 0.10, 0.0))},       # off rung 7 the toe is under the porch lip: pull back first
              pitch_dip={0: -12.0}),                      # toes up while the boot crosses the porch edge
    'L': Boot('L', [('rung', 0, 74, rung_c(0) + Vector((foot_x('L'), 0, 0)), (_rung_pitch('L'), P_LIFT + 6)),
                    ('flat', 104, TOP_N, Vector((L.IDLE_STANCE['L'].x, TOP_END.y + 0.05, PZ)), 4.0)],
              lift=0.12, extra_lift={0: Vector((0, 0.30, 0.16))}, preland={0: 0.10}),
}
HR = {'R': Vector((-0.62, -0.42, PZ + 0.90)), 'L': Vector((0.62, -0.55, PZ + 0.90))}   # porch handrail grips (rig)


PREF_SIDE = {'armTw': 15.0, 'armOut': 45.0, 'arm': 70.0, 'elb': 50.0, 'foreTw': 0.0, 'wristB': 0.0, 'wristR': 0.0}


def _top_hand(k, f):
    """(target grip point, gripping?) of hand k"""
    a = C.w2r(TOP_GRIP_W[k], TOP_ROOT0)      # where LadderUpTop leaves the hand
    if k == 'R':
        f0, f1, frel = 4, 28, 110
    else:
        f0, f1, frel = 24, 48, 100
    b = HR[k]
    if f <= f0:
        return a, True
    if f < f1:
        s = (f - f0) / (f1 - f0)
        return Hermite([(0.0, a), (0.45, a.lerp(b, 0.45) + NRM * 0.08 + UPW * 0.05), (1.0, b)])(s), False
    if f <= frel:
        return b, True
    return None, False


def _top_body_keys():
    b0 = body_up(0.0)
    fin = {'hipY': TOP_END.y, 'hipZ': IDLE0['hipZ'] + TOP_END.z, 'hipX': 0.0, 'hipPitch': 0.0, 'hipRoll': 0.0,
           'hipYaw': 0.0, 'lean': IDLE0['lean'], 'twist': 0.0, 'chest': 0.0, 'nod': 0.0, 'headYaw': 0.0}
    names = list(fin)
    k0 = {n: b0.get(n, 0.0) for n in names}

    def mix(u, **kw):
        d = {n: k0[n] + (fin[n] - k0[n]) * u for n in names}
        d.update(kw)
        return d
    return [(0, k0),
            (30, mix(0.03, hipX=0.04, nod=-26)),
            (56, mix(0.08, hipX=0.05, nod=-22)),
            (80, mix(0.35, hipX=-0.05, nod=-14)),
            (100, mix(0.62, hipX=-0.02, nod=-6)),
            (116, mix(0.80, hipX=0.03)),
            (140, mix(0.94, hipX=0.0)),
            (160, mix(0.99)),
            (TOP_N, fin)], k0, fin


def _hip_path(f, k0, fin):
    """pelvis height/forward travel: one smooth (smootherstep) move, so the hips never decelerate faster than g"""
    uz = C.smoother((f - 30) / (160 - 30))
    uy = C.smoother((f - 40) / (170 - 40))
    return k0['hipZ'] + (fin['hipZ'] - k0['hipZ']) * uz, k0['hipY'] + (fin['hipY'] - k0['hipY']) * uy


def _build_top():
    keys, k0, fin = _top_body_keys()
    tr = C.Tracks(keys, {})
    rows = []
    st = {}
    START = UPTOP_ROWS[-1]
    arms0 = {kk: START[kk] for kk in START if any(kk.startswith(n) for n in C.ARM_KEYS)}
    prev = dict(arms0)
    for f in range(TOP_N + 1):
        p = dict(IDLE0)
        p.update(tr(f))
        p['hipZ'], p['hipY'] = _hip_path(f, k0, fin)
        for k in 'LR':
            seed = st.get('legs' + k) or {'th': START['th' + k], 'kn': START['kn' + k],
                                          'legOut': START['legOut' + k]}
            for n, v in seed.items():
                p[n + k] = v
        lim = L.LIM['legOut']
        L.LIM['legOut'] = LEG_OUT_LIM
        for k in 'LR':
            TOP_BOOTS[k].place(p, f)
            st['legs' + k] = {'th': p['th' + k], 'kn': p['kn' + k], 'legOut': p['legOut' + k]}
        L.LIM['legOut'] = lim
        p.update(prev)
        for k in 'LR':
            tgt, grip = _top_hand(k, f)
            sg = 1 if k == 'L' else -1
            if tgt is None:      # released: blend from the last solved arm to the idle arm
                frel = 110 if k == 'R' else 100
                u = smooth((f - frel) / (TOP_N - 10 - frel))
                last = st.setdefault('rel' + k, C.arm_params(p, k))
                for kk, v in last.items():
                    p[kk] = v + (IDLE0.get(kk, 0.0) - v) * u
                continue
            on_rail = f <= (4 if k == 'R' else 24)
            pref = None if on_rail else {n + k: v for n, v in PREF_SIDE.items()}
            moving = (4 < f < 28) if k == 'R' else (24 < f < 48)
            C.solve_arm(p, k, tgt, 'grip', hdir=hand_dir(k) if on_rail else None, wdir=0.10,
                        prev=C.arm_params(p, k), wprev=0.002, pref=pref, wpref=0.004 if moving else 0.0008,
                        elbow_out=0.30)
        prev = {kk: p[kk] for kk in p if any(kk.startswith(n) for n in C.ARM_KEYS)}
        rows.append(p)
    rows[0] = dict(START)
    rows[0].pop('_miss', None)
    for f in range(1, 6):      # smooth start from the exact LadderUpTop end pose
        u = smooth(f / 6)
        for kk, v in rows[f].items():
            if isinstance(v, float) and isinstance(START.get(kk), float) and any(kk.startswith(n) for n in C.ARM_KEYS):
                rows[f][kk] = START[kk] + (v - START[kk]) * u
    last = dict(IDLE0)
    last['hipY'] = TOP_END.y
    last['hipZ'] = IDLE0['hipZ'] + TOP_END.z
    rows[TOP_N] = last
    return rows


TOP_ROWS = _build_top()
ladder_top_out = Clip(TOP_ROWS, TOP_N)


def _contacts_top_w(f):
    out = {}
    for k in 'LR':
        piv, pos, pitch, yaw, planted = TOP_BOOTS[k].state(f)
        c = TOP_BOOTS[k].contact(f)
        if c and c[0] == 'rung':
            out['foot' + k] = ('rung', C.r2w(c[1], TOP_ROOT0))
        elif planted and piv == 'heel' and abs(pitch) < 1e-6:
            out['foot' + k] = ('heel', C.r2w(pos, TOP_ROOT0))
        tgt, grip = _top_hand(k, f)
        if grip and 0 < f:
            out['hand' + k] = ('rail', C.r2w(tgt, TOP_ROOT0))
    return out


CLIPS.append(dict(name='LadderTopOut', fn=ladder_top_out, frames=TOP_N, loop=False, speed=0.0,
                  sheet=[0, 28, 50, 70, 90, 110, 140, 184],
                  meta={'note': 'top of the ladder -> porch. First frame = LadderUpTop last frame (root on rung 6, '
                                '(world (0,-2.689,2.50)); hands -> porch handrails, right boot rung 7 -> porch, left '
                                'boot rung 6 -> porch, ends as idle_params(0.0) at (0,-2.05,2.98)',
                        'start_equals': 'LadderUpTop last frame (root on rung 6)', 'root_start_world': [round(v, 4) for v in TOP_ROOT0],
                        'root_end': [0.0, round(TOP_ROOT1.y - TOP_ROOT0.y, 4), round(TOP_ROOT1.z - TOP_ROOT0.z, 4)],
                        'root_end_rig': [0.0, round(TOP_END.y, 4), round(TOP_END.z, 4)], 'facing': '+Y'}))
SCENE['LadderTopOut'] = dict(root=lambda f: TOP_ROOT0, contacts=_contacts_top_w,
                             look=TOP_ROOT0 + Vector((0, 0.25, 1.15)), ortho=2.8, mesh=True,
                             views=['side', 'rear34'], sheet=CLIPS[-1]['sheet'])


# ================================================================== LadderDown (loop, in place)
# The scene moves the root DOWN the ladder line: (0, -0.3190, -0.60) world per cycle. t = 0: root on the centre
# line of the rung under the LEFT boot (rung n), right boot on rung n+1. Feet lead: the upper (right) boot reaches
# down past the left one (t 0.02..0.40) and the left hand follows it down; then the left boot (t 0.52..0.90) and the
# right hand. The head looks down at the boots.
DOWN_FRAMES = 80                    # 2.67 s per 2 rungs, a little slower than up
SW_FOOT_D = {'R': (0.02, 0.40, 1), 'L': (0.52, 0.90, 0)}
SW_HAND_D = {'L': (0.22, 0.52), 'R': (0.72, 1.02)}
HAND_Z0_D = {'L': 1.12, 'R': 0.82}   # planted hands ride 0.83 .. 1.25 m (clip) like LadderUp


def body_down(t):
    ph = 2 * math.pi * t
    p = {}
    hip = U * (HIP_A - 0.02 + 0.015 * math.sin(2 * ph + 0.4)) + NRM * (HIP_B + 0.02)
    p['hipX'] = HIP_SWAY * math.cos(ph - 2 * math.pi * 0.97)
    p['hipY'] = hip.y + 0.03
    p['hipZ'] = hip.z - 0.84
    p['hipPitch'] = HIP_PITCH - 2
    p['hipRoll'] = -2.5 * math.sin(ph + 0.3)
    p['hipYaw'] = -3.0 * math.sin(ph + 0.2)
    p['lean'] = LEAN - 2 + 1.5 * math.sin(2 * ph)
    p['twist'] = 4.0 * math.sin(ph + 0.9)
    p['chest'] = 0.0
    # look down at the boot that is feeling for the next rung (right boot first half, left boot second half)
    p['nod'] = 4.0 + 6.0 * math.sin(2 * ph - 0.8)
    p['headYaw'] = -10.0 * math.cos(ph - 2 * math.pi * 0.2)
    return p


def _feet_d(k, t):
    return foot_state(k, t, sw=SW_FOOT_D, dirn=-1)


def _hands_d(k, t):
    return hand_state(k, t, sw=SW_HAND_D, z0=HAND_Z0_D, dirn=-1)


def build_down():
    st = {}
    for t0 in (0.9, 0.97):
        pose_ladder(t0, st, body=body_down, feet=_feet_d, hands=_hands_d)
    rows = []
    for rep in range(3):
        if rows:
            st['pref'] = _mean_arms(rows)
        rows = []
        for f in range(DOWN_FRAMES + 1):
            r = pose_ladder(f / DOWN_FRAMES, st, body=body_down, feet=_feet_d, hands=_hands_d)
            r['_miss'] = dict(st['miss'])
            rows.append(r)
    return close_loop(rows)


DOWN_ROWS = build_down()
ladder_down = Clip(DOWN_ROWS, DOWN_FRAMES)


def contacts_down(f):
    t = f / DOWN_FRAMES
    out = {}
    for k in 'LR':
        pos, pitch, ph = _feet_d(k, t)
        if ph[0] == 'stance':
            out['foot' + k] = ('rung', rung_c(ph[1], t, -1) + Vector((foot_x(k), 0, 0)))
        tgt, hp = _hands_d(k, t)
        if hp[0] == 'grip':
            out['hand' + k] = ('rail', tgt)
    return out


def _root_down(f, n=4):
    h = CYCLE_H * f / DOWN_FRAMES
    return C.rung_world(n) - Vector((0, TAN28, 1.0)) * h


CLIPS.append(dict(name='LadderDown', fn=ladder_down, frames=DOWN_FRAMES, loop=True, speed=0.0,
                  sheet=[0, 8, 16, 24, 32, 40, 48, 56, 64, 72],
                  meta={'note': 'descend loop, 2 rungs per cycle, feet lead, looks down. t=0: root on the centre '
                                'line of the rung under the left boot (rung n), right boot on rung n+1; the scene '
                                'moves the root DOWN the ladder line',
                        'climb_speed': round(-CYCLE_H / (DOWN_FRAMES / L.FPS), 4), 'ladder_lean_deg': 28.0,
                        'root_per_cycle_world': [0.0, -ROOT_PER_CYCLE_W[1], -CYCLE_H],
                        'root_per_cycle_rig': [0.0, ROOT_PER_CYCLE_W[1], -CYCLE_H]}))
SCENE['LadderDown'] = dict(root=_root_down,
                           contacts=lambda f: {k: (kind, C.r2w(tgt, _root_down(f)))
                                               for k, (kind, tgt) in contacts_down(f).items()},
                           look=lambda f: _root_down(f) + Vector((0, -0.05, 1.0)), ortho=2.3, mesh=True,
                           sheet=[0, 16, 32, 40, 56, 72])


# ================================================================== LadderMount (one-shot, baked root motion)
# Idle on the ground in front of the front footpad at (0, -4.50, 0) facing +Y -> step into the pad bowl (right,
# left) -> grab the rails (world z 1.39 R, 1.54 L) -> crouch and pull/hop (slow Moon pull-up, boots tuck back past
# the rung) with both boots onto rung 0 -> right boot up to rung 1 -> right hand to z 1.54, left hand to z 1.84
# = LadderUp frame 0 with n = 0 (root on rung 0 at (0, -3.646, 0.70)). root_end = (0, 0.974, 0.70).
MOUNT_N = 268
MOUNT_ROOT0 = Vector((0.0, -4.50, 0.0))
MOUNT_END = C.w2r(C.rung_world(0), MOUNT_ROOT0)
PAD_Z = 0.05


def _mw(x, y, z):
    return C.w2r(Vector((x, y, z)), MOUNT_ROOT0)


_UP0 = UP_ROWS[0]
_pL, _pR = _rung_pitch('L'), _rung_pitch('R')
_r0 = rung_c(0) + MOUNT_END
_r1 = rung_c(1) + MOUNT_END
MOUNT_BOOTS = {
    'R': Boot('R', [('flat', 0, 14, L.IDLE_STANCE['R'].copy(), -4.0),
                    ('flat', 42, 106, _mw(0.17, -4.02, PAD_Z), 0.0),
                    ('rung', 160, 190, _r0 + Vector((foot_x('R'), 0, 0)), (P_LAND, P_LIFT)),
                    ('rung', 216, MOUNT_N, _r1 + Vector((foot_x('R'), 0, 0)), (P_LAND, _pR))],
              lift=0.22, extra_lift={1: Vector((0, 0.15, -0.40)), 2: Vector((0, 0.12, -0.14))}),
    'L': Boot('L', [('flat', 0, 48, L.IDLE_STANCE['L'].copy(), 4.0),
                    ('flat', 76, 108, _mw(-0.17, -4.02, PAD_Z), 0.0),
                    ('rung', 162, MOUNT_N, _r0 + Vector((foot_x('L'), 0, 0)), (P_LAND, _pL))],
              lift=0.22, extra_lift={1: Vector((0, 0.15, -0.40))}),
}
# hands: (grip world-rel heights on the rails, frames)
_ML = {'R': [(64, 88, 1.54)], 'L': [(74, 98, 1.54), (232, 256, 1.84)]}


def _mount_hand(k, f, p_idle_tip):
    sg = -1 if k == 'L' else 1                 # world x of this hand's rail (left hand = world -X)
    segs = _ML[k]
    pts = [_mw(sg * C.RAIL_X, C.ladder_y(z), z) for (_, _, z) in segs]
    if f <= segs[0][0]:
        return p_idle_tip, False
    for i, (f0, f1, z) in enumerate(segs):
        a = p_idle_tip if i == 0 else pts[i - 1]
        if f0 < f < f1:
            s = (f - f0) / (f1 - f0)
            off = NRM * 0.07 if i else Vector((0, -0.05, 0.10))
            return Hermite([(0.0, a), (0.5, a.lerp(pts[i], 0.5) + off), (1.0, pts[i])])(s), False
        nxt = segs[i + 1][0] if i + 1 < len(segs) else MOUNT_N + 1
        if f1 <= f <= nxt:
            return pts[i], True
    return pts[-1], True


def _mount_body():
    b0 = body_up(0.0)
    names = ['hipX', 'hipY', 'hipPitch', 'hipRoll', 'hipYaw', 'lean', 'twist', 'chest', 'nod', 'headYaw']
    fin = {n: b0.get(n, 0.0) for n in names}
    fin['hipY'] = b0['hipY'] + MOUNT_END.y
    padY = -0.53
    keys = [(0, {}),
            (14, dict(hipX=0.03, lean=3)),
            (42, dict(hipX=-0.02, hipY=padY * 0.40, lean=4)),
            (76, dict(hipX=0.0, hipY=padY + 0.02, lean=10, hipPitch=6, nod=-10)),
            (100, dict(hipY=padY + 0.06, lean=16, hipPitch=10, nod=-18)),
            (120, dict(hipY=padY + 0.04, lean=18, hipPitch=12, nod=-22)),
            (180, {n: fin[n] * 0.8 + (0.0 if n != 'hipY' else 0.2 * (padY + 0.04)) for n in names}),
            (214, dict(fin, hipX=-0.02)),
            (MOUNT_N, fin)]
    return C.Tracks(keys, {})


def _mount_hipz(f):
    """pelvis height: idle -> up onto the pad (+0.05) -> crouch (-0.10) -> slow pull-up onto rung 0 (Moon g)"""
    z0 = IDLE0['hipZ']
    z_end = body_up(0.0)['hipZ'] + MOUNT_END.z
    zp = z0 + PAD_Z
    zc = zp - 0.04
    a = C.smoother((f - 36) / 50) * PAD_Z - 0.03 * math.sin(math.pi * min(max((f - 20) / 64, 0.0), 1.0))
    b = -0.04 * C.smoother((f - 92) / 20)
    c = (z_end - zc) * C.smoother((f - 108) / 80)
    return z0 + a + b + c


UP_MEAN = None


def _build_mount():
    global UP_MEAN
    UP_MEAN = _mean_arms(UP_ROWS)
    tr = _mount_body()
    rows, st = [], {}
    prev = {}
    tips = {k: C.hand_points(IDLE0, k)['tip'] for k in 'LR'}
    for f in range(MOUNT_N + 1):
        p = dict(IDLE0)
        p.update(tr(f))
        p['hipZ'] = _mount_hipz(f)
        lim = L.LIM['legOut']
        L.LIM['legOut'] = LEG_OUT_LIM
        for k in 'LR':
            seed = st.get('legs' + k) or {'th': IDLE0['th' + k], 'kn': IDLE0['kn' + k], 'legOut': IDLE0['legOut' + k]}
            for n_, v in seed.items():
                p[n_ + k] = v
            MOUNT_BOOTS[k].place(p, f)
            st['legs' + k] = {'th': p['th' + k], 'kn': p['kn' + k], 'legOut': p['legOut' + k]}
        L.LIM['legOut'] = lim
        for k in 'LR':
            tip0 = tips[k]
            tgt, grip = _mount_hand(k, f, tip0)
            if f <= _ML[k][0][0]:
                continue                         # idle arm
            p.update(prev.get(k) or C.arm_params(IDLE0, k))
            pref = {n: v for n, v in UP_MEAN.items() if n.endswith(k)}
            C.solve_arm(p, k, tgt, 'grip' if f >= _ML[k][0][1] else 'tip', hdir=hand_dir(k) if grip else None,
                        wdir=0.10, prev=prev.get(k), wprev=0.002, pref=pref, wpref=0.0015, elbow_out=0.30)
            prev[k] = C.arm_params(p, k)
            u = smooth((f - _ML[k][0][0]) / 8)
            for kk, v in C.arm_params(IDLE0, k).items():
                p[kk] = v + (p[kk] - v) * u
        rows.append(p)
    rows[0] = dict(IDLE0)
    end = dict(UP_ROWS[0])
    end.pop('_miss', None)
    end['hipY'] = end['hipY'] + MOUNT_END.y
    end['hipZ'] = end['hipZ'] + MOUNT_END.z
    # blend the last 8 frames into the exact LadderUp frame 0 (shifted by root_end)
    for i in range(1, 9):
        f = MOUNT_N - i
        u = smooth(1 - i / 9)
        for kk, v in rows[f].items():
            if isinstance(v, float) and isinstance(end.get(kk), float) and kk not in ('hipZ',):
                rows[f][kk] = v + (end[kk] - v) * u
    rows[MOUNT_N] = end
    return rows


MOUNT_ROWS = _build_mount()
ladder_mount = Clip(MOUNT_ROWS, MOUNT_N)


def _contacts_mount_w(f):
    out = {}
    for k in 'LR':
        piv, pos, pitch, yaw, planted = MOUNT_BOOTS[k].state(f)
        c = MOUNT_BOOTS[k].contact(f)
        if c and c[0] == 'rung':
            out['foot' + k] = ('rung', C.r2w(c[1], MOUNT_ROOT0))
        elif planted and piv == 'heel' and abs(pitch) < 1e-6:
            out['foot' + k] = ('heel', C.r2w(pos, MOUNT_ROOT0))
        tgt, grip = _mount_hand(k, f, Vector())
        if grip and f < MOUNT_N - 8:
            out['hand' + k] = ('rail', C.r2w(tgt, MOUNT_ROOT0))
    return out


CLIPS.append(dict(name='LadderMount', fn=ladder_mount, frames=MOUNT_N, loop=False, speed=0.0,
                  sheet=[0, 30, 70, 100, 124, 150, 180, 210, 240, 268],
                  meta={'note': 'ground (0,-4.62,0) -> footpad bowl -> rails -> slow pull-up hop onto rung 0 -> right '
                                'boot to rung 1 -> hands up = LadderUp frame 0 with n=0',
                        'root_start_world': [round(v, 4) for v in MOUNT_ROOT0],
                        'root_end': [0.0, round(C.rung_world(0).y - MOUNT_ROOT0.y, 4), round(C.rung_world(0).z, 4)],
                        'root_end_rig': [round(v, 4) for v in MOUNT_END], 'end_equals': 'LadderUp frame 0 (n=0)',
                        'facing': '+Y'}))
SCENE['LadderMount'] = dict(root=lambda f: MOUNT_ROOT0, contacts=_contacts_mount_w,
                            look=MOUNT_ROOT0 + Vector((0, 0.75, 1.1)), ortho=2.8, mesh=True,
                            views=['side', 'rear34'], sheet=CLIPS[-1]['sheet'])
