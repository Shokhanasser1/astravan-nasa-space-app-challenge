"""Shared lunar gait generator for Walk and Carry (helper module, not a clip module).

One cycle, t in [0, 1): LEFT heel strike at t = 0, RIGHT heel strike at t = 0.5.
Per foot, phase phi in [0, 1) from its own heel strike:
  stance  [0, D]   heel rocker (pivot 'heel', toes up -> flat) | foot flat | ball rocker (pivot 'ball', heel up,
                   toe stays flat).  The boot never moves in WORLD: clip-space y grows at exactly speed.
  swing   [D, 1]   boot leaves at rest (world), lifts, swings, reaches, drops onto the heel at rest (world).
Boot pose = (ankle position, pitch, toe angle); it is C1-continuous over the whole cycle (all pivot / phase
changes happen at zero pitch rate and zero world velocity), so the IK target never snaps.
"""
import math
from mathutils import Vector
import lunar_rig as L

S, C, TAU = math.sin, math.cos, 2 * math.pi


def clamp01(u):
    return min(max(u, 0.0), 1.0)


def smooth(u):
    u = clamp01(u)
    return u * u * (3 - 2 * u)


def ease_in(u):
    """0 -> 1 with zero start rate and a rate of pi/2 at the end (the motion is still going at u = 1)."""
    u = clamp01(u)
    return 1.0 - C(0.5 * math.pi * u)


def kick(s, sigma):
    """g(0) = 0, g'(0) = 1, g = g' = 0 from sigma on: carries an initial velocity into the swing and lets it die."""
    if s >= sigma:
        return 0.0
    return s * (1.0 - s / sigma) ** 2


def smoother(u):
    u = clamp01(u)
    return u * u * u * (u * (6 * u - 15) + 10)


class Spline:
    """1-D cubic Hermite through (x, y) keys, Catmull-Rom tangents inside, given (default zero) end tangents."""

    def __init__(self, keys, m0=0.0, m1=0.0):
        self.k = sorted(keys)
        n = len(self.k)
        self.m = [0.0] * n
        for i in range(1, n - 1):
            (x0, y0), (x1, y1) = self.k[i - 1], self.k[i + 1]
            self.m[i] = (y1 - y0) / (x1 - x0)
        self.m[0], self.m[-1] = m0, m1

    def __call__(self, x):
        k = self.k
        if x <= k[0][0]:
            return k[0][1]
        if x >= k[-1][0]:
            return k[-1][1]
        for i in range(len(k) - 1):
            if k[i][0] <= x <= k[i + 1][0]:
                h = k[i + 1][0] - k[i][0]
                u = (x - k[i][0]) / h
                h00 = 2 * u ** 3 - 3 * u ** 2 + 1
                h10 = u ** 3 - 2 * u ** 2 + u
                h01 = -2 * u ** 3 + 3 * u ** 2
                h11 = u ** 3 - u ** 2
                return h00 * k[i][1] + h10 * h * self.m[i] + h01 * k[i + 1][1] + h11 * h * self.m[i + 1]
        return k[-1][1]


# bob shape with the gentlest fall for its height (optimised offline): range 2.04, f'' in [-0.62, +1.74]
def bob_shape(th):
    return -C(th) - 0.14 * C(2 * th) - 0.02 * C(3 * th)


BOB_RANGE = 2.04


def _rot_off(k, pivot, pitch, frm='ankle'):
    """vector from landmark `pivot` to landmark `frm` of boot k, boot pitched by `pitch`."""
    sole = L.SOLE[k]
    return L.foot_rot(pitch) @ (sole[frm] - sole[pivot])


class Gait:
    def __init__(self, frames, speed, body, duty=0.6, phi_ff=0.10, phi_ho=0.30, p_hs=8.0, p_to=38.0,
                 q_to=18.0, phi_tip=None, foot_x=0.205, y0=None, swing_y=(0.04, 0.90), lift=None, pitch=None, toe_relax=0.45,
                 out=0.012, hip_z=-0.05, bob=0.02, bob_low=0.0, sigma=0.35):
        self.N = frames
        self.T = frames / L.FPS
        self.v = speed
        self.body = body                      # fn(t, gait) -> upper-body / pelvis params (no legs)
        self.D = duty
        self.phi_ff, self.phi_ho = phi_ff, phi_ho
        self.p_hs, self.p_to = p_hs, p_to
        self.q_to = q_to
        self.phi_tip = duty - 0.09 if phi_tip is None else phi_tip
        self.fx = foot_x
        self.swing_y = swing_y
        self.lift = Spline(lift or [(0, 0), (0.15, 0.018), (0.42, 0.030), (0.68, 0.026), (0.88, 0.014), (1, 0)])
        self.pitch_keys = pitch or [(0, p_to), (0.22, 0.55 * p_to), (0.48, 0.0), (0.72, -p_hs - 3),
                                    (0.9, -p_hs), (1, -p_hs)]
        self._pitch = None
        self._rates = {}
        self.sigma = sigma
        self.toe_relax = toe_relax
        self.out = out
        self.hip_z, self.bob, self.bob_low = hip_z, bob, bob_low
        self.miss = {}
        self.y0 = self.autocenter() if y0 is None else y0

    # ---------------------------------------------------------------- leg stretch (no IK)
    def max_stretch(self, n=None):
        n = n or self.N * 2
        reach = L.THIGH + L.SHIN
        worst, at = 0.0, None
        for i in range(n):
            t = i / n
            p = self.body(t, self)
            for k in 'LR':
                a, P, toe, ph = self.boot(k, t)
                st = (a - L.hip_joint(p, k)).length / reach
                if st > worst:
                    worst, at = st, (k, round(t, 3), ph)
        return worst, at

    def autocenter(self):
        """heel touch-down y (clip) that keeps the leg furthest from full stretch over the cycle"""
        lo, hi = -0.45, 0.15
        for _ in range(30):          # golden-section on a unimodal max-stretch curve
            a = hi - 0.618 * (hi - lo)
            b = lo + 0.618 * (hi - lo)
            self.y0 = a
            fa = self.max_stretch()[0]
            self.y0 = b
            fb = self.max_stretch()[0]
            if fa < fb:
                hi = b
            else:
                lo = a
        return 0.5 * (lo + hi)

    # ---------------------------------------------------------------- pelvis height (exposed for body fns)
    def hipz(self, t):
        th = 2 * TAU * (t - self.bob_low)
        return self.hip_z + self.bob / BOB_RANGE * (bob_shape(th) + 1.0)

    # ---------------------------------------------------------------- one boot
    def _x(self, k):
        return self.fx if k == 'L' else -self.fx

    def stance(self, k, phi):
        """(ankle, pitch, toe) of a planted boot at its phase phi in [0, D]."""
        vT = self.v * self.T
        sole = L.SOLE[k]
        heel = Vector((self._x(k), self.y0 + vT * phi, 0.0))
        if phi < self.phi_ff:
            P = -self.p_hs * (1.0 - smooth(phi / self.phi_ff))
            return heel + _rot_off(k, 'heel', P), P, 0.0
        if phi < self.phi_ho:
            return heel + (sole['ankle'] - sole['heel']), 0.0, 0.0
        # heel-off: boot pitch P about the toe joint (toe flat), then the last part rolls over the toe tip
        # (toe world pitch Q > 0, tip fixed) so the toe leaves the ground gradually
        P = self.p_to * ease_in((phi - self.phi_ho) / (self.D - self.phi_ho))
        Q = self.q_to * ease_in((phi - self.phi_tip) / (self.D - self.phi_tip)) if phi > self.phi_tip else 0.0
        tip = heel + (sole['tip'] - sole['heel'])
        joint = tip + L.foot_rot(Q) @ (sole['ball'] - sole['tip'])
        return joint + _rot_off(k, 'ball', P), P, Q - P

    def toe_off_rates(self, k):
        """world ankle velocity, pitch rate and toe rate at toe-off, per unit swing parameter s."""
        if k not in self._rates:
            vT = self.v * self.T
            e = 1e-4
            a0, P0, t0 = self.stance(k, self.D)
            a1, P1, t1 = self.stance(k, self.D - e)
            f = (1.0 - self.D) / e
            va = (a0 - a1) * f - Vector((0.0, vT * (1.0 - self.D), 0.0))
            self._rates[k] = (va, (P0 - P1) * f, (t0 - t1) * f)
        return self._rates[k]

    def swing(self, k, s):
        """(ankle, pitch, toe) in the swing, s in [0, 1]. Leaves toe-off with the stance's own velocities
        (C1, so the knee keeps flexing through toe-off), ends at rest (world) on the heel."""
        vT = self.v * self.T
        phi = self.D + s * (1.0 - self.D)
        a0, P0, toe0 = self.stance(k, self.D)
        a1, P1, _ = self.stance(k, 0.0)
        va, dP, dtoe = self.toe_off_rates(k)
        # world y (clip y - vT*phi) blends from lift-off to touch-down with flat ends
        wy0 = a0.y - vT * self.D
        wy1 = a1.y - vT * 1.0
        ya, yb = self.swing_y
        w = smooth((s - ya) / (yb - ya))
        g = kick(s, self.sigma)
        y = wy0 + (wy1 - wy0) * w + vT * phi + va.y * g
        z = a0.z + (a1.z - a0.z) * smooth(s) + self.lift(s) + va.z * g
        sg = 1.0 if k == 'L' else -1.0
        x = a0.x + (a1.x - a0.x) * smooth(s) + sg * self.out * S(math.pi * s) ** 2 + va.x * g
        if self._pitch is None or self._pitch[0] != dP:
            self._pitch = (dP, Spline(self.pitch_keys, m0=dP))
        P = self._pitch[1](s)
        r = self.toe_relax
        if s < r:
            u = s / r
            toe = (2 * u ** 3 - 3 * u ** 2 + 1) * toe0 + (u ** 3 - 2 * u ** 2 + u) * r * dtoe
        else:
            toe = 0.0
        return Vector((x, y, z)), P, toe

    def boot(self, k, t):
        phi = (t + (0.0 if k == 'L' else 0.5)) % 1.0
        if phi <= self.D:
            return self.stance(k, phi) + ('stance',)
        return self.swing(k, (phi - self.D) / (1.0 - self.D)) + ('swing',)

    # ---------------------------------------------------------------- full pose
    def __call__(self, t):
        t = t % 1.0
        p = self.body(t, self)
        for k in 'LR':
            a, P, toe, _ = self.boot(k, t)
            p.setdefault('th' + k, 15.0)
            p.setdefault('kn' + k, 25.0)
            p.setdefault('legOut' + k, 2.0)
            m = L.place_foot(p, k, 'ankle', a, P, 0.0, toe)
            self.miss[(k, round(t, 5))] = m
        return p

    # ---------------------------------------------------------------- analytic checks (no mesh)
    def report(self, tag, n=None):
        n = n or self.N * 4
        reach = L.THIGH + L.SHIN
        worst_miss, worst_str, min_str = 0.0, 0.0, 9.0
        tip_mid = {'L': 9.0, 'R': 9.0}
        low = {'L': 9.0, 'R': 9.0}
        kn = {'L': [], 'R': []}
        rows = []
        for i in range(n):
            t = i / n
            p = self(t)
            for k in 'LR':
                a, P, toe, ph = self.boot(k, t)
                hj = L.hip_joint(p, k)
                st = (a - hj).length / reach
                worst_str = max(worst_str, st)
                min_str = min(min_str, st)
                worst_miss = max(worst_miss, self.miss[(k, round(t % 1.0, 5))])
                bp = L.boot_points(p, k)
                zlow = min(v.z for v in bp.values())
                low[k] = min(low[k], zlow)
                kn[k].append(p['kn' + k])
                phi = (t + (0.0 if k == 'L' else 0.5)) % 1.0
                if ph == 'swing':
                    s = (phi - self.D) / (1 - self.D)
                    if 0.3 < s < 0.7:
                        tip_mid[k] = min(tip_mid[k], bp['tip'].z, bp['heel'].z)
            rows.append((t, p))
        L.log('GAIT %s T=%.3fs v=%.2f stride=%.3f step=%.3f | max miss %.4f | leg stretch %.3f..%.3f | '
              'min boot z L %.4f R %.4f | midswing clearance L %.3f R %.3f | knee L %.1f..%.1f' % (
                  tag, self.T, self.v, self.v * self.T, self.v * self.T / 2, worst_miss, min_str, worst_str,
                  low['L'], low['R'], tip_mid['L'], tip_mid['R'], min(kn['L']), max(kn['L'])))
        return rows
