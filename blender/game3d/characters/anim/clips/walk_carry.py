"""Walk + Carry: one planted lunar gait (clips/_gait.py), two upper bodies.

Walk  : 1.0 m/s (top of the Apollo walking range), bent knees, small floaty bob, gentle opposite arm swing.
Carry : 0.8 m/s, shorter steps, two-hand bag grip (L.carry_arms()), slight backward lean, looks a little down.
Left heel strike at t = 0, right at t = 0.5. Both loop.
"""
import math
import lunar_rig as L
from _gait import Gait, S, C, TAU

WALK_FRAMES, WALK_SPEED = 40, 1.0
CARRY_FRAMES, CARRY_SPEED = 38, 0.8


def _head_level(p, look_down=0.0):
    # keep the helmet facing forward and level against pelvis yaw/pitch, torso twist and lean
    p['headYaw'] = -0.85 * (p.get('hipYaw', 0.0) + p.get('twist', 0.0))
    p['nod'] = -(p.get('hipPitch', 0.0) + 0.3 * p.get('lean', 0.0)) + look_down


def walk_body(t, g):
    p = {}
    c1 = C(TAU * (t - 0.03))
    p['hipZ'] = g.hipz(t)
    p['hipX'] = 0.010 * S(TAU * (t - 0.05))
    p['hipYaw'] = -6.0 * C(TAU * (t - 0.02))
    p['hipRoll'] = -2.0 * S(TAU * (t - 0.06))
    p['hipPitch'] = 3.0
    p['lean'] = 6.0 + 0.6 * C(2 * TAU * (t - g.bob_low - 0.08))
    p['twist'] = 6.0 * C(TAU * (t - 0.05))
    p['chest'] = 0.5 * C(2 * TAU * (t - 0.1))
    _head_level(p, 1.0)
    amp = 13.0
    for k, sg in (('L', -1.0), ('R', 1.0)):
        fwd = sg * c1                       # +1 = this arm fully forward
        p['arm' + k] = 3.0 + amp * fwd
        p['elb' + k] = 22.0 + 9.0 * (0.5 + 0.5 * fwd)
        p['armOut' + k] = 7.0 + 1.0 * (0.5 - 0.5 * fwd)
        p['armTw' + k] = 10.0
        p['wristB' + k] = 4.0
        p['shrug' + k] = 0.0
    return p


CARRY_ARMS = L.carry_arms()


def carry_body(t, g):
    p = {}
    p['hipZ'] = g.hipz(t)
    p['hipX'] = 0.008 * S(TAU * (t - 0.05))
    p['hipYaw'] = -3.5 * C(TAU * (t - 0.02))
    p['hipRoll'] = -1.5 * S(TAU * (t - 0.06))
    p['hipPitch'] = 1.0
    p['lean'] = -3.0 + 0.3 * C(2 * TAU * (t - g.bob_low - 0.08))
    p['twist'] = 3.0 * C(TAU * (t - 0.05))   # chest stays calm: the bag hangs on Spine2
    _head_level(p, 6.0)                      # look a little down at the bag / the ground ahead
    p.update(CARRY_ARMS)
    return p


WALK = Gait(WALK_FRAMES, WALK_SPEED, walk_body, duty=0.6, p_hs=8.0, p_to=42.0, hip_z=-0.065, bob=0.024)
CARRY = Gait(CARRY_FRAMES, CARRY_SPEED, carry_body, duty=0.62, p_hs=6.0, p_to=34.0, hip_z=-0.04, bob=0.016)


def walk(t):
    return WALK(t)


def carry(t):
    return CARRY(t)


CLIPS = [
    dict(name='Walk', fn=walk, frames=WALK_FRAMES, loop=True, speed=WALK_SPEED,
         sheet=[0, 3, 6, 9, 12, 15, 18, 21],   # half a cycle (left stance, right swing); the rest mirrors
         meta={'note': 'lunar walk, planted at 1.0 m/s, left heel strike at t=0, duty 0.6'}),
    dict(name='Carry', fn=carry, frames=CARRY_FRAMES, loop=True, speed=CARRY_SPEED,
         sheet=[0, 3, 6, 9, 12, 15, 18, 21],
         meta={'note': 'two-hand bag carry, planted at 0.8 m/s, left heel strike at t=0'}),
]
