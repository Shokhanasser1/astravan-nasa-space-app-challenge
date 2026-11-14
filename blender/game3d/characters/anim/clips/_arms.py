"""Two-hand grip solver (same as build_astronaut.py fk_arm / solve_hands), on the kit's pose language."""
import numpy as np
from mathutils import Vector
import lunar_rig as L

JH, JT = L.JH, L.JT
BAG = Vector((0.0, -0.41, 1.06))      # bag centre (= BagSocket head), chest frame
BAG_HALF_W = 0.21
GRIP_W = Vector((BAG_HALF_W + 0.025, 0.08, 0.04))
GRIP_T = Vector((BAG_HALF_W + 0.01, -0.02, 0.02))


def fk_arm(side, prm):
    pose = L.pose_from_params(prm)
    sh, ar, fo, ha = (side + 'Shoulder', side + 'Arm', side + 'ForeArm', side + 'Hand')
    Ds = pose[sh][0]; Da = Ds @ pose[ar][0]; Df = Da @ pose[fo][0]; Dh = Df @ pose[ha][0]
    s0 = JH[sh]
    a0 = s0 + Ds @ (JH[ar] - s0)
    e = a0 + Da @ (JH[fo] - JH[ar])
    w = e + Df @ (JH[ha] - JH[fo])
    tip = w + Dh @ (JT[ha] - JH[ha])
    return e, w, tip, Dh


def solve_hands(target_w, target_tip, base, side='Left', iters=900):
    k = side[0]
    keys = ['armTw' + k, 'armOut' + k, 'arm' + k, 'elb' + k, 'wristB' + k, 'wristR' + k]
    lim = {'armTw': (-30, 95), 'armOut': (-25, 45), 'arm': (-20, 110), 'elb': (0, 125),
           'wristB': (-45, 45), 'wristR': (-60, 60)}
    x = {kk: base.get(kk, 0.0) for kk in keys}

    def cost(xx):
        prm = dict(base); prm.update(xx)
        e, w, tip, _ = fk_arm(side, prm)
        c = (w - target_w).length ** 2 + 0.5 * (tip - target_tip).length ** 2
        sgn = 1 if side == 'Left' else -1
        c += 1.0 * max(0.0, 0.37 - sgn * e.x) ** 2 + 0.05 * max(0.0, e.z - 1.30) ** 2
        c += 1e-6 * sum(v * v for v in xx.values())
        return c
    best = cost(x); step = 20.0
    for it in range(iters):
        kk = keys[it % len(keys)]
        for d in (step, -step):
            y = dict(x); lo, hi = lim[kk[:-1]]
            y[kk] = float(np.clip(y[kk] + d, lo, hi))
            c = cost(y)
            if c < best:
                best, x = c, y; break
        if it % len(keys) == len(keys) - 1:
            step = max(0.25, step * 0.93)
    return x, best


def mirror(xl):
    return {kk[:-1] + 'R': v for kk, v in xl.items()}
