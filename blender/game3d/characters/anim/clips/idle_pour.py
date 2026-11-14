"""Idle and Pour, as before (build_astronaut.py) but with both boots planted by IK:
the old Idle let the boots roll/slide ~2.7 cm with the weight shift, the old Pour sank them 2 cm."""
import math
from mathutils import Vector
import lunar_rig as L
import _arms as A

S, C, TAU = math.sin, math.cos, 2 * math.pi
plant = L.plant_idle_feet


def idle(t):
    return L.idle_params(t)   # weight shift, breath, head look-around; boots planted


def bag_frame(t):
    k = L.lerp_keys([(0.0, {'z': 0.0, 'y': 0.0, 'tilt': 0.0}),
                     (0.22, {'z': 0.16, 'y': -0.06, 'tilt': 10.0}),
                     (0.40, {'z': 0.20, 'y': -0.10, 'tilt': 75.0}),
                     (0.70, {'z': 0.20, 'y': -0.10, 'tilt': 80.0}),
                     (0.85, {'z': 0.12, 'y': -0.05, 'tilt': 25.0})], t)
    shake = 4.0 * S(6 * TAU * t) if 0.42 < t < 0.70 else 0.0
    return Vector((0, k['y'], k['z'])), k['tilt'] + shake


_carry = None
_cache = {}


def pour(t):
    global _carry
    if _carry is None:
        _carry = L.carry_arms()
    key = round(t, 4)
    if key not in _cache:
        off, tilt = bag_frame(t)
        Q = L.qw(('X', tilt))
        cen = A.BAG + off
        xl, _ = A.solve_hands(cen + Q @ A.GRIP_W, cen + Q @ A.GRIP_T, dict(_carry), iters=600)
        arms = dict(xl); arms.update(A.mirror(xl))
        _cache[key] = (arms, off, Q)
    arms, off, Q = _cache[key]
    p = {'lean': 8 + 4 * S(TAU * t) ** 2, 'nod': 8, 'hipZ': -0.025, 'hipY': 0.012}
    p.update(arms)
    p['sockQ'] = Q
    p['sockT'] = off
    return plant(p)


CLIPS = [dict(name='Idle', fn=idle, frames=60, loop=True, speed=0.0, sheet=[0, 15, 30, 45],
              meta={'note': 'standing breath + weight shift, boots planted'}),
         dict(name='Pour', fn=pour, frames=60, loop=True, speed=0.0, sheet=[0, 12, 24, 36, 48],
              meta={'note': 'bag lifted and tipped ~75 deg, boots planted'})]
