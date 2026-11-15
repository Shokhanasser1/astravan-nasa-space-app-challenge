"""Rover driver clips: the astronaut sits in the driver's seat holding the two-grip hand controller.

  Seated       loop 4 s (120 f): slow breathing, small head look-around, gloves on the grips the whole time.
  SeatedSteer  scrub clip 2 s (60 f), NOT a loop: frame 0 = full LEFT steer, 30 = centre (= Seated frame 0),
               60 = full RIGHT steer. Steering input s in -1..1 -> time (s + 1) s. The controller rolls linearly
               with s, +-35 deg about its fore-aft axis (left steer: left grip down, right grip up, both on the
               r 0.18 circle), the torso and head lean 6 deg into the turn (spine roll; the pelvis does not move).

Rig space: faces -Y, X = the astronaut's left, root = origin = the cabin floor point under the hip joints.
The pelvis, legs and boots are identical in every frame of both clips (boots flat on the floor, z 0).
Seat contract numbers and the kit work-arounds (spine roll key, hand IK copy): _seated_core.py.
"""
import math
from mathutils import Vector
import lunar_rig as L
import _seated_core as SC

S, C, TAU = math.sin, math.cos, 2 * math.pi

# ------------------------------------------------------------------ posture (tuned on the sheets)
HIP_H = 0.55            # hip joints above the floor
PITCH = 8.0             # pelvis pitch forward (deg): the whole torso + PLSS tips forward about the hips
LEAN = 2.0              # extra spine lean (deg); kept small: a spine lean swings the PLSS bottom back
NOD = -6.0              # head back up (the pelvis pitch tips it down): gaze ~3 deg below level
FOOT_X = 0.20           # heel x (+-)
HEEL_Y = -0.18          # heel y (ankle 8 cm in front of the heel)
TOE_OUT = 6.0           # boots toe-out (deg)
SHRUG0 = 2.0
STEER_LEAN = 6.0        # spine roll into the turn at full steer (deg)
STEER_YAW = 6.0         # head turns into the turn (deg)
STEER_SHRUG = 1.5


def base_params():
    p = {'hipPitch': PITCH, 'lean': LEAN, 'nod': NOD, 'shrugL': SHRUG0, 'shrugR': SHRUG0}
    SC.hip_offsets(p, HIP_H)
    for k in 'LR':
        sg = 1 if k == 'L' else -1
        p.update({'th' + k: 70.0, 'kn' + k: 95.0, 'legOut' + k: 2.0})
        miss = L.place_foot(p, k, 'heel', Vector((sg * FOOT_X, HEEL_Y, 0.0)), 0.0, sg * TOE_OUT)
        if miss > 0.002:
            L.log('SEATED WARN leg IK miss', k, round(miss, 4))
    return p


BASE = base_params()

# arm IK preferences: elbows out and a little forward of the torso, wrists neutral
PREF = {}
for _k in 'LR':
    PREF.update({'armTw' + _k: 10.0, 'armOut' + _k: 20.0, 'arm' + _k: 30.0, 'elb' + _k: 70.0, 'foreTw' + _k: 0.0,
                 'wristB' + _k: 0.0, 'wristR' + _k: 0.0})


def hand_targets(k, phi):
    """grip point, soft hand direction and palm normal for controller roll phi (rotate with the controller)"""
    sg = 1 if k == 'L' else -1
    R = SC.ctrl_rot(phi)
    hdir = (R @ Vector((-0.30 * sg, -0.92, -0.25))).normalized()
    palm = (R @ Vector((-sg, 0.0, -0.25))).normalized()
    return SC.grip_pos(k, phi), hdir, palm


def body(t_idle, s):
    """params for idle phase t_idle (0..1, Seated loop) and steer s (-1 left .. 1 right), before the arm IK"""
    p = dict(BASE)
    ph = TAU * t_idle
    br = 0.5 - 0.5 * C(ph)                         # breath 0 -> 1 -> 0 over the 4 s loop
    p['chest'] = p.get('chest', 0.0) + 1.4 * br
    p['lean'] = LEAN - 0.6 * br
    p['shrugL'] = SHRUG0 + 1.5 * br + STEER_SHRUG * s
    p['shrugR'] = SHRUG0 + 1.5 * br - STEER_SHRUG * s
    p['headYaw'] = 11.0 * S(ph) - 3.0 * S(2 * ph) - STEER_YAW * s
    p['nod'] = NOD + 2.5 * S(2 * ph) - 1.0 * br
    p['spRoll'] = -STEER_LEAN * s
    p['twist'] = -2.0 * s
    return p


def solve(t_idle, s, prev):
    p = body(t_idle, s)
    phi = SC.STEER_MAX * s
    miss = {}
    for k in 'LR':
        p.update(prev.get(k) or {kk: v for kk, v in PREF.items() if kk.endswith(k)})
        tgt, hdir, palm = hand_targets(k, phi)
        miss[k] = SC.solve_arm(p, k, tgt, hdir=hdir, wdir=0.25, palm=palm, wpalm=0.12, pref=PREF, wpref=0.004,
                               elbow_out=0.35, elbow_back=0.02, iters=80)
        prev[k] = SC.arm_params(p, k)
    return p, miss


class Table:
    def __init__(self, rows):
        self.rows = rows
        self.N = len(rows) - 1

    def __call__(self, t):
        f = min(max(int(round(t * self.N)), 0), self.N)
        return dict(self.rows[f])


N_IDLE, N_STEER = 120, 60
MISS = {}
_prev = {}
_rows = []
for _f in range(N_IDLE):
    _p, _m = solve(_f / N_IDLE, 0.0, _prev)
    _rows.append(_p)
    MISS[('Seated', _f)] = _m
# loop seam: re-solve frame 0 warm-started from the last frame; both IK solutions must agree
_p0b, _ = solve(0.0, 0.0, dict(_prev))
SEAM = max(abs(_p0b[kk] - _rows[0][kk]) for kk in SC.arm_params(_rows[0], 'L').keys() | SC.arm_params(_rows[0], 'R').keys())
_rows.append(dict(_rows[0]))
SEATED = Table(_rows)

_steer = [None] * (N_STEER + 1)
_steer[30] = dict(_rows[0])
for _rng in (range(31, N_STEER + 1), range(29, -1, -1)):
    _prev = {k: SC.arm_params(_rows[0], k) for k in 'LR'}
    for _f in _rng:
        _p, _m = solve(0.0, (_f - 30) / 30.0, _prev)
        _steer[_f] = _p
        MISS[('SeatedSteer', _f)] = _m
STEER = Table(_steer)


def _jump(rows):
    ks = [kk for kk in SC.arm_params(rows[0], 'L')] + [kk for kk in SC.arm_params(rows[0], 'R')]
    return round(max(max(abs(b[kk] - a[kk]) for kk in ks) for a, b in zip(rows, rows[1:])), 2)


L.log('SEATED max arm param step per frame (deg): Seated', _jump(_rows), 'SeatedSteer', _jump(_steer))

_worst = sorted(MISS.items(), key=lambda kv: -max(kv[1].values()))[:4]
L.log('SEATED worst ik', [(k, {s: round(v, 4) for s, v in m.items()}) for k, m in _worst])
L.log('SEATED ik miss max (m)', round(max(max(m.values()) for m in MISS.values()), 5), 'loop seam (deg)',
      round(SEAM, 3), 'hip', [round(BASE[kk], 4) for kk in ('hipX', 'hipY', 'hipZ')])

CLIPS = [
    dict(name='Seated', fn=SEATED, frames=N_IDLE, loop=True, speed=0.0, sheet=[0, 15, 30, 45, 60, 90],
         meta={'note': 'rover driver seated idle: breathing, head look-around, gloves on the controller grips; '
                       'root = cabin floor under the hip joints, faces -Y'}),
    dict(name='SeatedSteer', fn=STEER, frames=N_STEER, loop=False, speed=0.0, sheet=[0, 15, 30, 45, 60],
         meta={'note': 'scrub by steering: time = (s + 1) s for s in -1 (full left) .. 1 (full right); '
                       'frame 30 = Seated frame 0; controller roll +-35 deg, torso/head lean 6 deg into the turn',
               'scrub': 1, 'steer_max_deg': SC.STEER_MAX}),
]
