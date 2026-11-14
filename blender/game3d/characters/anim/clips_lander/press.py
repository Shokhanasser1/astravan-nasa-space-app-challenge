"""Button presses for lander v2 (SPEC.md hero buttons). One-shots from and back to L.idle_params(0.0), boots
planted on the idle stance (plant_idle_feet every frame), the root does not move.

  PressPanelC / L / R : standing spot (0, 0.50, 3.00) facing +Y, press btn_main_2 (right hand) / btn_main_1
                        (left hand, it is on the astronaut's left) / btn_main_3 (right hand) by 12 mm along -n.
  PressHatchExt       : root (-0.32, -2.02, 2.98) on the porch facing +Y, left hand presses btn_hatch_ext (+Y).
  PressLaunch         : standing spot; the left hand flips up the launch cover (ASSUMED geometry, see COVER),
                        the right hand presses btn_launch, both return.
Glove contact point = the hand bone tail (the glove has no fingers; its front surface is at the tail).
Timing of every press matches the button actions Press_<button> (in 0.1 s, hold 0.1 s, out 0.3 s): meta
'press_frame' = the frame the glove touches the face and the button starts moving.
"""
import math
from mathutils import Vector
import lunar_rig as L
import _lander_core as C
from _lander_core import Hermite, smooth, Tracks

IDLE = C.idle0()
ROOT_PANEL = Vector(C.STAND_PANEL)
ROOT_HATCH_EXT = Vector((-0.25, -1.95, 2.98))   # body clears the porch handrail (x -0.62)
# launch cover (worker B owns it; this is the assumption the left hand is built on): hinge axis along X through
# button + U*0.075 + n*0.02 (n = panel normal toward the astronaut), free edge 0.13 from the hinge, closed flat
# over the button, opened to 115 deg (top edge stays, the bottom edge swings out and up)
COVER = {'hinge_up': 0.075, 'hinge_out': 0.02, 'len': 0.13, 'open_deg': 115.0}   # round-1 assumption (unused)
import json as _json, os as _os
COVER_JSON = _json.load(open(_os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '_launch_cover.json')))
COVER_F0 = 27        # PressLaunch frame at which CoverOpen frame 1 plays
LAUNCH_ELBOW = 0.42  # left elbow this wide while lifting the cover (forearm over the chest, not through it)
LIFT_CF = 10         # the hand follows the cover through CoverOpen frame 10 (~upright, +1 deg), then lets go (it flips on)


def seg(keys, f):
    """piecewise smoothstep between (frame, value) keys (zero velocity at every key)"""
    if f <= keys[0][0]:
        return keys[0][1] * 1.0
    for (f0, a), (f1, b) in zip(keys, keys[1:]):
        if f0 <= f <= f1:
            return a + (b - a) * smooth((f - f0) / (f1 - f0))
    return keys[-1][1] * 1.0


def arm_idle(k):
    return C.arm_params(IDLE, k)


def finish(p, f, N, solved_arms, ramp=7):
    """blend solved arms with idle at both ends (exact idle joins), plant the boots"""
    u = min(smooth(f / ramp), smooth((N - f) / ramp))
    for k in solved_arms:
        ai = arm_idle(k)
        for kk, v in ai.items():
            p[kk] = v + (p[kk] - v) * u
    for k in 'LR':
        p['th' + k], p['kn' + k], p['legOut' + k] = IDLE['th' + k], IDLE['kn' + k], IDLE['legOut' + k]
    L.plant_idle_feet(p)
    return p


class Press:
    """one-hand press. timeline (frames): reach to A (6 cm off the face) at f_a, touch at f_t, press 3 frames,
    hold 3, release 9 (back to the face), pull back to A 7, return to idle at N."""

    def __init__(self, name, button, k, root, body_keys, N=78, f_a=24, f_t=31, approach=0.07, hdir_w=0.25,
                 tip_up=None, lift=0.10):
        self.name, self.k, self.N, self.root = name, k, N, root
        bc, bd = C.BUTTONS[button]
        self.F = C.w2r(bc, root)
        self.D = C.d2r(bd)
        self.f_t = f_t
        A = self.F - self.D * approach
        P = self.F + self.D * C.PRESS
        T0 = C.hand_points(IDLE, k)['tip']
        mid = T0.lerp(A, 0.55) + Vector((0, -0.16, lift + 0.04)) + (tip_up or Vector())
        self.reach = Hermite([(0, T0), (f_a * 0.55, mid), (f_a, A)])
        self.press = [(f_a, A), (f_t, self.F), (f_t + 3, P), (f_t + 6, P), (f_t + 15, self.F), (f_t + 22, A)]
        f_r = f_t + 22
        mid2 = T0.lerp(A, 0.5) + Vector((0, -0.10, lift * 0.6))
        self.back = Hermite([(f_r, A), (f_r + (N - f_r) * 0.45, mid2), (N, T0)])
        self.f_a, self.f_r = f_a, f_r
        self.tracks = Tracks(body_keys, IDLE)
        self.hdir_w = hdir_w
        self.rows = []
        prev = None
        for f in range(N + 1):
            p = dict(IDLE)
            p.update(self.tracks(f))
            p.update(prev or arm_idle(k))
            tgt = self.target(f)
            w = smooth((f - 4) / (f_a - 4)) * smooth((N - 6 - f) / (N - 6 - f_r))
            C.solve_arm(p, k, tgt, 'tip', hdir=self.D, wdir=0.02 + hdir_w * w, prev=prev, wprev=0.0008,
                        elbow_out=0.28 if k == 'R' else 0.28)
            prev = C.arm_params(p, k)
            self.rows.append(finish(p, f, N, [k]))

    def target(self, f):
        if f <= self.f_a:
            return self.reach(f)
        if f <= self.f_r:
            return seg(self.press, f)
        return self.back(f)

    def __call__(self, t):
        f = min(max(int(round(t * self.N)), 0), self.N)
        return dict(self.rows[f])

    def contacts(self, f):
        if self.f_t <= f <= self.f_t + 15:
            return {'hand' + self.k: ('tip', C.r2w(seg(self.press, f), self.root))}
        return {}


def body_keys(lean, twist, nod, yaw, hipY=0.015, hipZ=-0.012, N=78, f_t=31, chest=0.0, roll=0.0):
    hold = {'lean': lean, 'twist': twist, 'nod': nod, 'headYaw': yaw, 'hipY': hipY, 'hipZ': hipZ, 'chest': chest,
            'hipRoll': roll}
    pre = {kk: (v * 0.85 if kk != 'hipZ' else v) for kk, v in hold.items()}
    return [(0, {}), (f_t - 6, pre), (f_t + 6, hold), (f_t + 16, hold), (N - 22, {kk: v * 0.45 for kk, v in hold.items()}),
            (N, {})]


PRESS_C = Press('PressPanelC', 'btn_main_2', 'R', ROOT_PANEL, body_keys(lean=14, twist=11, nod=18, yaw=-3, hipY=0.025), hdir_w=0.10)
PRESS_L = Press('PressPanelL', 'btn_main_1', 'L', ROOT_PANEL, body_keys(lean=6, twist=-4, nod=15, yaw=12))
PRESS_R = Press('PressPanelR', 'btn_main_3', 'R', ROOT_PANEL, body_keys(lean=6, twist=4, nod=15, yaw=-12))


def _meta(pr, button, hand):
    return {'note': '%s with the %s hand, from/to idle_params(0.0), boots planted' % (button, hand),
            'button': button, 'press_frame': pr.f_t, 'press_end_frame': pr.f_t + 15,
            'root_world': [round(v, 4) for v in pr.root], 'facing': '+Y'}


# ------------------------------------------------------------------ PressLaunch (two hands)
class Launch:
    N = 120

    def __init__(self):
        N = self.N
        self.root = ROOT_PANEL
        bc, bd = C.BUTTONS['btn_launch']
        U, n = C.PANEL_U, C.PANEL_N
        # REAL cover (worker B): hinge at its origin, free-edge centre per CoverOpen frame measured from
        # lander_v2.blend into _launch_cover.json. CoverOpen frame 1 plays at PressLaunch frame COVER_F0.
        cj = COVER_JSON
        hinge = Vector(cj['hinge'])
        self.hinge_w = hinge

        def edge_cf(cf):     # free-edge centre (world) at CoverOpen frame cf (1..19, linear between keys)
            cf = min(max(cf, 1.0), 19.0)
            i = min(int(math.floor(cf)), 18)
            a, b = Vector(cj['frames'][str(i)]['edge_centre']), Vector(cj['frames'][str(i + 1)]['edge_centre'])
            return a.lerp(b, cf - i)

        def finger(cf):      # fingertip under the free edge, on the cover's outer face, at its left (world -X) part
            e = edge_cf(cf)
            eu = (e - hinge).normalized()
            n_out = Vector((0, eu.z, -eu.y))            # outer face normal (toward the astronaut when closed)
            return e + eu * 0.010 + n_out * 0.017 + Vector((-0.035, 0, 0))
        self.edge_cf = edge_cf
        R0 = self.root
        F0 = COVER_F0
        self.cover_frame = lambda f: f - F0 + 1
        # left hand: under the free edge (f F0-1), lift with the cover through CoverOpen frames 1..LIFT_CF, let go
        TL0 = C.hand_points(IDLE, 'L')['tip']
        e0 = C.w2r(finger(1), R0)
        f_rel = F0 - 1 + LIFT_CF
        self.fl = (F0 - 3, F0 - 1, f_rel)
        self.lift = lambda f: C.w2r(finger(self.cover_frame(f)), R0)
        eo = self.lift(f_rel)
        aside = eo + Vector((0.16, 0.02, -0.08))
        self.L_reach = Hermite([(0, TL0), (13, TL0.lerp(e0, 0.55) + Vector((0.06, -0.14, 0.04))),
                                (F0 - 3, e0 + C.d2r(-U) * 0.03 + Vector((0, 0, -0.02))), (F0 - 1, e0)])
        self.L_after = Hermite([(f_rel, eo), (f_rel + 10, aside), (80, TL0.lerp(aside, 0.4) + Vector((0.24, -0.12, 0.05))),
                                (104, TL0)])
        # right hand: press after the cover is up
        F = C.w2r(bc, R0)
        D = C.d2r(bd)
        A = F - D * 0.08
        P = F + D * C.PRESS
        self.F, self.D = F, D
        TR0 = C.hand_points(IDLE, 'R')['tip']
        self.f_t = 52
        self.R_reach = Hermite([(0, TR0), (20, TR0 + Vector((-0.03, -0.12, 0.02))), (44, A)])
        self.R_press = [(44, A), (52, F), (55, P), (58, P), (67, F), (74, A)]
        self.R_back = Hermite([(74, A), (95, TR0.lerp(A, 0.45) + Vector((-0.18, -0.14, 0.06))), (N, TR0)])
        # squat (knees) rather than bend over: a deep lean puts the chest right above the low button and the
        # forearms end up inside it
        hold = {'lean': 9, 'hipPitch': 5, 'twist': 3, 'nod': 30, 'headYaw': 0, 'hipY': 0.05, 'hipZ': -0.25,
                'chest': 3}
        cover_phase = dict(hold, lean=2, hipPitch=1, hipY=0.13, nod=24)     # chest back while the cover swings out
        self.tracks = Tracks([(0, {}), (21, {kk: v * 0.9 for kk, v in hold.items()}), (29, hold), (36, cover_phase),
                              (43, cover_phase), (52, hold), (68, hold), (78, dict(hold, hipY=0.10, lean=5)),
                              (96, {kk: v * 0.3 for kk, v in hold.items()}), (N, {})], IDLE)
        self.rows = []
        prev = {}
        HZ = hold['hipZ']
        HZ1 = HZ + 0.08
        for f in range(N + 1):
            p = dict(IDLE)
            p.update(self.tracks(f))
            # squat height on its own smooth profile: the hips never accelerate down faster than Moon g
            # cover phase: shallower squat (shoulders above the cover's sweep); deeper for the low press (f34-52);
            # every move slow enough that the hips never drop faster than Moon g
            z1 = IDLE['hipZ'] + (HZ1 - IDLE['hipZ']) * C.smoother(f / 30)
            p['hipZ'] = z1 + (HZ - HZ1) * C.smoother((f - 34) / 18) - (HZ - IDLE['hipZ']) * C.smoother((f - 72) / 44)
            for k in 'LR':
                p.update(prev.get(k) or arm_idle(k))
            # left
            if f > 84:            # left arm: FK blend from its 'aside' pose to idle while the body stands up
                u = smooth((f - 84) / 26)
                for kk, v in self.armL84.items():
                    p[kk] = v + (IDLE.get(kk, 0.0) - v) * u
                prev['L'] = C.arm_params(p, 'L')
                tl = None
            else:
                tl = self.tl(f)
            wl = smooth((f - 4) / 18) * smooth((60 - f) / 12)
            hd_l = (U * 0.45 - n * 0.9).normalized()
            if tl is not None:
                C.solve_arm(p, 'L', tl, 'tip', hdir=C.d2r(hd_l), wdir=0.02, prev=prev.get('L'),
                            wprev=0.0008, elbow_out=0.30 + 0.03 * smooth((f - 22) / 8))
                prev['L'] = C.arm_params(p, 'L')
                if f == 84:
                    self.armL84 = dict(prev['L'])
            tr = self.tr(f)
            wr = smooth((f - 20) / 24) * smooth((N - 8 - f) / (N - 8 - 74))
            C.solve_arm(p, 'R', tr, 'tip', hdir=D, wdir=0.02 + 0.10 * wr, prev=prev.get('R'), wprev=0.0008,
                        elbow_out=0.30 + 0.12 * smooth((f - 67) / 6))
            prev['R'] = C.arm_params(p, 'R')
            self.rows.append(finish(p, f, N, ['L', 'R']))

    def tl(self, f):
        if f <= self.fl[1]:
            return self.L_reach(f)
        if f <= self.fl[2]:
            return self.lift(f)
        return self.L_after(f)

    def tr(self, f):
        if f <= 44:
            return self.R_reach(f)
        if f <= 74:
            return seg(self.R_press, f)
        return self.R_back(f)

    def __call__(self, t):
        f = min(max(int(round(t * self.N)), 0), self.N)
        return dict(self.rows[f])

    def contacts(self, f):
        out = {}
        if self.fl[1] <= f <= self.fl[2]:
            out['handL'] = ('tip', C.r2w(self.tl(f), self.root))
        if 52 <= f <= 67:
            out['handR'] = ('tip', C.r2w(seg(self.R_press, f), self.root))
        return out


LAUNCH = Launch()

CLIPS = [
    dict(name='PressPanelC', fn=PRESS_C, frames=PRESS_C.N, loop=False, speed=0.0, sheet=[0, 16, 31, 34, 46, 62],
         meta=_meta(PRESS_C, 'btn_main_2', 'right')),
    dict(name='PressPanelL', fn=PRESS_L, frames=PRESS_L.N, loop=False, speed=0.0, sheet=[0, 16, 31, 34, 46, 62],
         meta=_meta(PRESS_L, 'btn_main_1', 'left')),
    dict(name='PressPanelR', fn=PRESS_R, frames=PRESS_R.N, loop=False, speed=0.0, sheet=[0, 16, 31, 34, 46, 62],
         meta=_meta(PRESS_R, 'btn_main_3', 'right')),
    dict(name='PressLaunch', fn=LAUNCH, frames=Launch.N, loop=False, speed=0.0, sheet=[0, 26, 33, 40, 55, 86],
         meta={'note': 'left fingertip lifts the real btn_launch_cover along its CoverOpen path (CoverOpen frame 1 '
                       'at PressLaunch frame %d, hand follows through CoverOpen frame %d), lets go; right hand '
                       'presses btn_launch' % (COVER_F0, LIFT_CF),
               'button': 'btn_launch', 'press_frame': 52, 'press_end_frame': 67,
               'coveropen_frame1_at': COVER_F0, 'cover_hand_frames': [COVER_F0 - 1, COVER_F0 - 1 + LIFT_CF],
               'root_world': [round(v, 4) for v in ROOT_PANEL],
               'facing': '+Y'}),
]


def _scene(pr, look_off=Vector((0.0, 0.30, 1.0)), ortho=2.3):
    inside = pr.root.y > -1.4
    return dict(root=lambda f, r=pr.root: r, contacts=pr.contacts, look=pr.root + look_off, ortho=ortho, mesh=True,
                views=['side', 'left34' if inside else 'rear34'], dist=1.7 if inside else 4.5)


SCENE = {c['name']: dict(_scene(c['fn']), sheet=c['sheet']) for c in CLIPS}
_bl = C.w2r(C.BUTTONS['btn_launch'][0], ROOT_PANEL)
SCENE['PressLaunch']['cover_frame'] = LAUNCH.cover_frame
SCENE['PressLaunch']['views'] = ['side', 'left34', ('left34', C.BUTTONS['btn_launch'][0] + Vector((0, -0.15, 0.05)), 0.9)]
for _n, _b in (('PressPanelC', 'btn_main_2'), ('PressPanelL', 'btn_main_1')):
    SCENE[_n]['views'] = ['side', 'left34', ('left34', C.BUTTONS[_b][0] + Vector((0, -0.12, 0.0)), 0.9)]



# ================================================================== PressHatchExt (round 2: starts AND ends at the porch spot)
# Root fixed at (0, -2.05, 2.98) facing +Y (= LadderTopOut end = EnterHatch start). The astronaut side-steps toward
# the button (left boot, then right boot: +0.25 m to its left and 0.10 m forward), presses btn_hatch_ext with the
# left hand, steps back (right, then left) and ends in idle_params(0.0) on the same spot: root_end = (0, 0, 0).
from _steps import Boot

ROOT_PORCH = Vector((0.0, -2.05, 2.98))
HX_N = 176
HX_SHIFT = Vector((0.25, -0.10, 0.0))       # rig: the press stance relative to the porch spot
_IL, _IR = L.IDLE_STANCE['L'].copy(), L.IDLE_STANCE['R'].copy()
HX_BOOTS = {
    'L': Boot('L', [('flat', 0, 8, _IL, 4.0), ('flat', 30, 144, _IL + HX_SHIFT, 4.0), ('flat', 166, HX_N, _IL, 4.0)],
              lift=0.06),
    'R': Boot('R', [('flat', 0, 30, _IR, -4.0), ('flat', 52, 120, _IR + HX_SHIFT, -4.0), ('flat', 142, HX_N, _IR, -4.0)],
              lift=0.06),
}
HX_FT = 83                                  # press_frame (glove touches btn_hatch_ext)
# glove tip just outside the porch's left top rail (world x -0.62, z 3.88) at world y -1.86 (ahead of the hip): the rail runs through the glove
HX_RAIL_TIP = C.w2r(Vector((-0.655, -1.86, 3.905)), Vector((0.0, -2.05, 2.98)))
_hold = {'lean': 5, 'twist': -6, 'nod': 6, 'headYaw': 16, 'hipRoll': -1.5}


def _hx_keys():
    sh = HX_SHIFT
    st = dict(hipX=sh.x, hipY=sh.y)
    pre = {k: v * 0.85 for k, v in _hold.items()}
    tuck = {}
    return [(0, {}), (8, dict(hipX=-0.035, hipY=0.0, **tuck)), (30, dict(hipX=0.12, hipY=-0.04, **tuck)),
            (52, dict(st, hipX=sh.x + 0.02, **tuck)), (HX_FT - 6, dict(st, **pre)), (HX_FT + 6, dict(st, **_hold)),
            (HX_FT + 16, dict(st, **_hold)), (120, dict(st, hipX=sh.x + 0.03, **tuck)),
            (142, dict(hipX=0.13, hipY=-0.05, **tuck)), (166, dict(hipX=-0.03, hipY=0.0)), (HX_N, {})]


class PressHX:
    N = HX_N

    def __init__(self):
        N = self.N
        self.root = ROOT_PORCH
        bc, bd = C.BUTTONS['btn_hatch_ext']
        self.F, self.D = C.w2r(bc, ROOT_PORCH), C.d2r(bd)
        A = self.F - self.D * 0.07
        P = self.F + self.D * C.PRESS
        self.f_t = HX_FT
        tr = Tracks(_hx_keys(), dict(IDLE, hipY=0.0))
        f_a, f_r = HX_FT - 7, HX_FT + 22
        self.press = [(f_a, A), (HX_FT, self.F), (HX_FT + 3, P), (HX_FT + 6, P), (HX_FT + 15, self.F), (f_r, A)]
        self.rows = []
        st = {}
        prev = None
        T0 = T1 = None
        for f in range(N + 1):
            p = dict(IDLE)
            p.update(tr(f))
            for k in 'LR':
                for n_, v in st.get('legs' + k, {'th': IDLE['th' + k], 'kn': IDLE['kn' + k],
                                                 'legOut': IDLE['legOut' + k]}).items():
                    p[n_ + k] = v
                HX_BOOTS[k].place(p, f)
                st['legs' + k] = {'th': p['th' + k], 'kn': p['kn' + k], 'legOut': p['legOut' + k]}
            if 8 <= f <= 170:
                # left hand steadies on the porch top rail while stepping, reaches the button from there
                base = C.arm_params(p, 'L')
                if T0 is None:
                    T0 = C.hand_points(p, 'L')['tip']
                    RT = HX_RAIL_TIP
                    self.path = [Hermite([(8, T0), (14, T0.lerp(RT, 0.5) + Vector((0.0, 0.0, 0.08))), (20, RT)]),
                                 Hermite([(52, RT), (64, RT.lerp(A, 0.5) + Vector((0.0, 0.0, 0.10))), (f_a, A)]),
                                 Hermite([(f_r, A), (f_r + 10, A.lerp(RT, 0.5) + Vector((0.10, 0.0, 0.14))),
                                          (124, RT + Vector((0.08, -0.03, 0.06))), (128, RT)])]
                if f <= 20:
                    tgt = self.path[0](f)
                elif f <= 52:
                    tgt = HX_RAIL_TIP
                elif f <= f_a:
                    tgt = self.path[1](f)
                elif f <= f_r:
                    tgt = seg(self.press, f)
                elif f <= 128:
                    tgt = self.path[2](f)
                else:
                    tgt = HX_RAIL_TIP
                p.update(prev or base)
                w = smooth((f - 54) / (f_a - 54)) * smooth((120 - f) / (120 - f_r))
                C.solve_arm(p, 'L', tgt, 'tip', hdir=self.D, wdir=0.02 + 0.25 * w, prev=prev, wprev=0.0008,
                            elbow_out=0.30 + p.get('hipX', 0.0))     # elbow out of the (side-stepped) body
                prev = C.arm_params(p, 'L')
                u = min(smooth((f - 8) / 8), smooth((170 - f) / 12))
                for kk, v in base.items():
                    p[kk] = v + (p[kk] - v) * u
            self.rows.append(p)
        self.rows[0] = dict(IDLE)
        self.rows[N] = dict(IDLE)

    def __call__(self, t):
        f = min(max(int(round(t * self.N)), 0), self.N)
        return dict(self.rows[f])

    def contacts(self, f):
        out = {}
        if self.f_t <= f <= self.f_t + 15:
            out['handL'] = ('tip', C.r2w(seg(self.press, f), self.root))
        for k in 'LR':
            piv, pos, pitch, yaw, planted = HX_BOOTS[k].state(f)
            if planted and piv == 'heel' and abs(pitch) < 1e-6:
                out['foot' + k] = ('heel', C.r2w(pos, self.root))
        return out


PRESS_HX = PressHX()
CLIPS.append(dict(name='PressHatchExt', fn=PRESS_HX, frames=HX_N, loop=False, speed=0.0,
                  sheet=[0, 20, 52, 76, 86, 110, 142, 176],
                  meta={'note': 'porch spot (0,-2.05,2.98) -> side-step left -> left hand presses btn_hatch_ext -> '
                                'step back -> idle on the same spot (root_end 0); the left hand rests on the porch top '
                                'rail while stepping (f20-52, f128-158)',
                        'button': 'btn_hatch_ext', 'press_frame': HX_FT, 'press_end_frame': HX_FT + 15,
                        'root_start_world': [0.0, -2.05, 2.98], 'root_end': [0.0, 0.0, 0.0], 'facing': '+Y'}))
SCENE['PressHatchExt'] = dict(root=lambda f: ROOT_PORCH, contacts=PRESS_HX.contacts,
                              look=ROOT_PORCH + Vector((-0.2, 0.3, 1.0)), ortho=2.3, mesh=True,
                              views=['side', 'rear34', ('rear34', C.BUTTONS['btn_hatch_ext'][0] + Vector((0.15, -0.2, 0.0)), 1.0)],
                              sheet=CLIPS[-1]['sheet'])
