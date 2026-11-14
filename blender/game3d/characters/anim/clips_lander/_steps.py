"""Footstep planner for the lander root-motion clips (EnterHatch, LadderTopOut).

Each boot has a list of HOLDS (planted phases), in frames:
    ('flat', f0, f1, heel_pos, yaw)          boot flat, heel landmark at heel_pos (heel strike at f0, heel-off at f1)
    ('rung', f0, f1, rung_centre, (p0, p1))  ball of the boot on a round rung, pitch p0 -> p1 over the hold
Between holds the boot swings (ankle path with a lift). Heel strike: pitch -HS -> 0 over HS_F frames after f0
(pivot heel). Heel-off: pitch 0 -> HO about the ball over HO_F frames before f1. Everything is in clip/rig space.
"""
import math
from mathutils import Vector
import lunar_rig as L
import _lander_core as C
from _lander_core import Hermite, smooth

HS, HS_F = 8.0, 5
HO, HO_F = 16.0, 6


class Boot:
    def __init__(self, k, holds, lift=0.08, extra_lift=None, toe_clear=None, preland=None, postlift=None,
                 pitch_dip=None):
        self.k = k
        self.holds = holds
        self.lift = lift
        self.extra = extra_lift or {}      # {swing index: (Vector offset at mid-swing)}
        self.preland = preland or {}       # {swing index: height}: come straight down onto the landing spot
        self.postlift = postlift or {}     # {swing index: Vector}: first move of the boot after lift-off
        self.pitch_dip = pitch_dip or {}   # {swing index: deg}: extra pitch at mid-swing (< 0 = toes up)

    def _land_pose(self, h):
        """(pivot, pos, pitch, yaw) at the very start of hold h"""
        if h[0] == 'flat':
            return ('heel', h[3], -HS, h[4])
        return ('ball', C.ball_on_rung(self.k, h[3], h[4][0]), h[4][0], 0.0)

    def _lift_pose(self, h):
        if h[0] == 'flat':
            ball = h[3] + L.foot_rot(0, h[4]) @ (L.SOLE[self.k]['ball'] - L.SOLE[self.k]['heel'])
            return ('ball', ball, HO, h[4])
        return ('ball', C.ball_on_rung(self.k, h[3], h[4][1]), h[4][1], 0.0)

    def _ankle(self, pose):
        piv, pos, pitch, yaw = pose
        return pos + L.foot_rot(pitch, yaw) @ (L.SOLE[self.k]['ankle'] - L.SOLE[self.k][piv]), pitch, yaw

    def state(self, f):
        """(pivot, pos, pitch, yaw, planted?) at frame f"""
        hs = self.holds
        for i, h in enumerate(hs):
            f0, f1 = h[1], h[2]
            if f0 <= f <= f1:
                if h[0] == 'flat':
                    if f < f0 + HS_F and i > 0:
                        return ('heel', h[3], -HS * (1 - smooth((f - f0) / HS_F)), h[4], True)
                    if f > f1 - HO_F and i < len(hs) - 1:
                        ball = h[3] + L.foot_rot(0, h[4]) @ (L.SOLE[self.k]['ball'] - L.SOLE[self.k]['heel'])
                        return ('ball', ball, HO * smooth((f - (f1 - HO_F)) / HO_F), h[4], True)
                    return ('heel', h[3], 0.0, h[4], True)
                u = (f - f0) / max(f1 - f0, 1)
                pitch = h[4][0] + (h[4][1] - h[4][0]) * smooth(u)
                return ('ball', C.ball_on_rung(self.k, h[3], pitch), pitch, 0.0, True)
            if i + 1 < len(hs) and f1 < f < hs[i + 1][1]:
                a0, p0, y0 = self._ankle(self._lift_pose(h))
                a1, p1, y1 = self._ankle(self._land_pose(hs[i + 1]))
                s = (f - f1) / (hs[i + 1][1] - f1)
                mid = a0.lerp(a1, 0.5) + Vector((0, 0, self.lift + max(0.0, a1.z - a0.z) * 0.3))
                mid += self.extra.get(i, Vector())
                if i in self.preland:
                    ks = [(0.0, a0), (0.45, mid), (0.78, a1 + Vector((0, 0, self.preland[i]))), (1.0, a1)]
                    if i in self.postlift:
                        ks.insert(1, (0.2, a0 + self.postlift[i]))
                    ank = Hermite(ks)(s)
                else:
                    ank = Hermite([(0.0, a0), (0.5, mid), (1.0, a1)])(s)
                pitch = p0 + (p1 - p0) * smooth(s) + self.pitch_dip.get(i, 0.0) * math.sin(math.pi * s) ** 2
                yaw = y0 + (y1 - y0) * smooth(s)
                self._toe = -HO * (1.0 - smooth(s / 0.4)) if h[0] == 'flat' else 0.0   # toe relaxes after toe-off
                return ('ankle', ank, pitch, yaw, False)
        h = hs[-1] if f > hs[-1][2] else hs[0]
        if h[0] == 'flat':
            return ('heel', h[3], 0.0, h[4], True)
        return ('ball', C.ball_on_rung(self.k, h[3], h[4][1]), h[4][1], 0.0, True)

    def place(self, p, f):
        self._toe = None
        piv, pos, pitch, yaw, planted = self.state(f)
        if piv == 'ankle':
            return L.place_foot(p, self.k, piv, pos, pitch, yaw, toe=self._toe)
        on_rung = any(h[0] == 'rung' and h[1] <= f <= h[2] for h in self.holds)
        # flat-ground heel-off: the kit keeps the toe segment flat (toe=None); on a rung the boot stays rigid
        return L.place_foot(p, self.k, piv, pos, pitch, yaw, toe=0.0 if on_rung else None)

    def contact(self, f):
        """('rung'|'floor', target) for the verifier when planted"""
        piv, pos, pitch, yaw, planted = self.state(f)
        if not planted:
            return None
        for h in self.holds:
            if h[1] <= f <= h[2]:
                if h[0] == 'rung':
                    return ('rung', h[3])
                return ('heel', h[3])
        return None
