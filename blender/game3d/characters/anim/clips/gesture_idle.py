"""Gesture one-shots for the standing astronaut (from and back to L.idle_params(0.0), boots planted on the idle
stance every frame, the root never moves; loop=False, speed=0):

  Wrist      (84 f, 2.8 s): the left forearm comes up across the chest (elbow out at shoulder height, display =
               top of the forearm facing up), the torso bends forward (lean 20 + chest 8) and turns ~19 deg toward
               the arm (waist twist + hip yaw) so the helmet drops behind the backpack top and the left elbow shows
               beside it from the game camera; the right glove tip taps the left wrist twice (meta tap_frames, glove
               skin within ~3 mm of the forearm skin at contact, 3.5 cm travel), a small "OK" nod, arms back.
  LookAround (144 f, 4.8 s): looks round the base to the left (~56 deg = hip yaw 11 + waist twist 33 + head 13, weight
               onto the left boot), holds, swings round to the right (~52 deg) and ~22 deg up at the low Sun
               (chest back, slight lean back, nod up, hips forward), the right glove comes up past the chin and
               shades the visor brow with the elbow up and out (reads from behind), holds, back to the front.

Arms: per-frame hand IK (clips/_gest_core.py) with wrist / elbow / glove-tip targets in the chest or head frame and
obstacle penalties (ray-cast chest + DCM boxes, helmet sphere) so the arms stay outside the hard upper torso and the
helmet. Rig note: foreTw rotates about the upper-arm axis (same as armTw), the forearm cannot roll about its own
axis, so the forearm's top (the display) always faces along the elbow hinge axis: it faces up here, not tilted
exactly at the visor. First and last frame are exactly L.idle_params(0.0).
"""
import math
from mathutils import Vector
import lunar_rig as L
import _gest_core as G
from _gest_core import Hermite, smooth, smoother, Tracks

IDLE = L.idle_params(0.0)
ARM0 = {k: G.arm_params(IDLE, k) for k in 'LR'}
SP, HD = 'Spine2', 'Head'
# obstacles, in rest coordinates of the bone frame they move with
CHEST_BOXES = [   # ray-cast from the rest mesh (front surface y at |x|, z)
    (Vector((-0.105, -0.345, 1.17)), Vector((0.105, 0.10, 1.43))),    # DCM box on the chest
    (Vector((-0.17, -0.245, 0.95)), Vector((0.17, 0.10, 1.45))),     # hard upper torso front
    (Vector((-0.245, -0.19, 1.12)), Vector((0.245, 0.10, 1.45))),    # its sides toward the scye (x 0.23)
    (Vector((0.17, -0.42, 0.98)), Vector((0.27, -0.10, 1.12))),      # waist items, left
    (Vector((-0.27, -0.42, 0.98)), Vector((-0.17, -0.10, 1.12)))]    # waist items, right
HELMET_C, HELMET_R = Vector((0.0, -0.06, 1.68)), 0.17
EYE = Vector((0.0, -0.16, 1.66))                                          # behind the visor (head frame)


def chest(p):
    return G.bone_frame(p, SP)


def head(p):
    return G.bone_frame(p, HD)


def obstacles(p, extra=()):
    hf = head(p)
    cf = chest(p)
    return [('box', cf, SP, lo, hi) for lo, hi in CHEST_BOXES] + \
        [('sph', G.to_world(hf, HELMET_C, HD), HELMET_R)] + list(extra)


def finish(p, f, N, ramp=6):
    """exact idle joins: blend both arms to idle over `ramp` frames at both ends, plant the boots"""
    u = min(smooth(f / ramp), smooth((N - f) / ramp))
    for k in 'LR':
        G.blend_arm(p, k, ARM0[k], u)
    G.plant(p, IDLE)
    return p


# ================================================================== Wrist
class Wrist:
    N = 84
    TAPS = (37, 45)        # glove tip touches the wrist display (8 frames = 0.27 s apart)

    def __init__(self):
        N = self.N
        t1, t2 = self.TAPS
        # big readable shapes from behind: the backpack tips forward (lean + chest), the helmet drops behind its
        # top, the upper body turns a little toward the raised left forearm (twist + hip yaw: the left elbow
        # shows beside the backpack)
        hold = {'lean': 20.0, 'chest': 8.0, 'nod': 11.0, 'hipY': 0.035, 'hipZ': -0.032, 'twist': 15.0, 'hipYaw': 4.0,
                'hipX': 0.008}
        okd = dict(hold, nod=21.0, chest=12.0, lean=21.5, hipZ=-0.036)
        self.body = Tracks([(0, {}), (7, {'lean': 3.0, 'nod': 2.0, 'twist': 1.0}), (24, hold), (t2 + 6, hold),
                            (t2 + 12, okd), (t2 + 19, dict(hold, nod=10.0)),
                            (66, dict(hold, nod=8.0, lean=16.0, chest=6.0, twist=11.0, hipYaw=3.0)), (N - 2, {}), (N, {})], IDLE)
        # left wrist / elbow targets, chest frame (rest coords)
        WL1, EL1 = Vector((0.15, -0.365, 1.28)), Vector((0.35, -0.26, 1.31))
        a0 = G.arm_points(IDLE, 'L')
        c0 = chest(IDLE)
        WL0, EL0 = G.to_local(c0, a0['wrist'], SP), G.to_local(c0, a0['elbow'], SP)
        self.wl = Hermite([(0, WL0), (11, WL0.lerp(WL1, 0.55) + Vector((0.07, -0.10, -0.03))), (22, WL1)])
        self.wl_back = Hermite([(60, WL1), (71, WL0.lerp(WL1, 0.5) + Vector((0.07, -0.09, -0.03))), (N - 3, WL0)])
        self.el = Hermite([(0, EL0), (22, EL1)])
        self.el_back = Hermite([(60, EL1), (N - 3, EL0)])
        rows, info = [], []
        prevL = prevR = None
        lefts = []
        # pass 1: body + left arm
        for f in range(N + 1):
            p = dict(IDLE)
            p.update(self.body(f))
            p['shrugR'] = 3.0 * sum(math.exp(-((f - tc + 0.5) / 1.6) ** 2) for tc in self.TAPS)   # shoulder bobs
            p.update(prevL or ARM0['L'])
            cf = chest(p)
            wl = self.wl(f) if f <= 60 else self.wl_back(f)
            el = self.el(f) if f <= 60 else self.el_back(f)
            w = smooth((f - 4) / 16) * smooth((N - 6 - f) / 18)
            eye = G.to_world(head(p), EYE, HD)
            a = G.arm_points(p, 'L')
            disp = (eye - a['wrist']).normalized()
            r = G.solve_arm(p, 'L', [('pos', 'wrist', G.to_world(cf, wl, SP), 6.0),
                                     ('pos', 'elbow', G.to_world(cf, el, SP), 0.8 + 1.5 * w),
                                     ('dir', 'dorsal', disp, 0.03 + 0.12 * w),
                                     ('dir', 'hand', cf[0] @ Vector((-0.62, -0.75, -0.2)).normalized(), 0.1 * w)],
                            prev=prevL, wprev=0.002, pref={'wristBL': 0.0, 'wristRL': 0.0}, wpref=0.004,
                            obst=obstacles(p))
            prevL = G.arm_params(p, 'L')
            lefts.append((p, r))
        # tap surface point: top of the left wrist (forearm dorsal side at the wrist joint) and its normal
        self.S, self.n = [], []
        for p, _ in lefts:
            a = G.arm_points(p, 'L')
            self.S.append(a['wrist'] + a['fore'] * 0.02 + a['dorsal'] * 0.05)
            self.n.append(a['dorsal'])
        self.h = lambda f: self._h(f)
        # pass 2: right arm. Taps (F_H .. F_W): tip IK onto the display, seeded bent, warm-started forward.
        # Approach / withdrawal: FK blend idle <-> the solved hover pose (natural arcs, no IK branch flips),
        # then an obstacle-only clean-up solve that stays as close as it can to the blend.
        F_H, F_W, F_I0, F_I1 = 31, t2 + 6, 8, N - 8
        seedR = {'armTwR': 30.0, 'armOutR': -30.0, 'armR': 75.0, 'elbR': 80.0, 'foreTwR': 0.0, 'wristBR': 0.0,
                 'wristRR': 0.0}
        solved, resR = {}, {}
        prevR = None
        for f in range(F_H, F_W + 1):
            p = lefts[f][0]
            p.update(prevR or seedR)
            cf = chest(p)
            xw = cf[0] @ Vector((1, 0, 0))
            hd = (-self.n[f] + xw * 0.55).normalized()
            aL = G.arm_points(p, 'L')
            capL = ('cap', aL['elbow'], aL['wrist'] - aL['fore'] * 0.07, 0.035)
            r = G.solve_arm(p, 'R', [('pos', 'tip', self.S[f] + self.n[f] * self.h(f), 6.0), ('dir', 'hand', hd, 0.05)],
                            prev=prevR, wprev=0.002, obst=obstacles(p, [capL]), iters=200 if prevR is None else 60)
            prevR = solved[f] = G.arm_params(p, 'R')
            resR[f] = r
        for f in list(range(0, F_H)) + list(range(F_W + 1, N + 1)):
            if f < F_H:
                u = smoother((f - F_I0) / (F_H - F_I0))
                a0, a1 = ARM0['R'], solved[F_H]
            else:
                u = smoother((f - F_W) / (F_I1 - F_W))
                a0, a1 = solved[F_W], ARM0['R']
            bl = {kk: a0[kk] + (a1[kk] - a0[kk]) * u for kk in a0}
            p = lefts[f][0]
            p.update(bl)
            aL = G.arm_points(p, 'L')
            capL = ('cap', aL['elbow'], aL['wrist'] - aL['fore'] * 0.07, 0.035)
            resR[f] = G.solve_arm(p, 'R', [], pref=bl, wpref=0.05, obst=obstacles(p, [capL]), iters=30)
        for f in range(N + 1):
            p, rl = lefts[f]
            info.append((f, rl, resR[f]))
            rows.append(finish(p, f, N))
        rows[0] = dict(IDLE)
        rows[N] = dict(IDLE)
        self.rows, self.info = rows, info

    def _h(self, f):
        t1, t2 = self.TAPS
        up = 0.045

        def tap(f, tc):
            # 3 frames down accelerating into the contact, 1 frame on it, 4 frames back up (ease out)
            if tc - 3 <= f <= tc:
                u = (f - (tc - 3)) / 3.0
                return up * (1 - u * u)
            if tc < f <= tc + 1:
                return 0.0
            if tc + 1 < f <= tc + 5:
                u = (f - tc - 1) / 4.0
                return up * (1 - (1 - u) ** 2)
            return None
        for tc in (t1, t2):
            v = tap(f, tc)
            if v is not None:
                return v
        if f < t1 - 3:
            return 0.075 + (up - 0.075) * smooth((f - 32) / (t1 - 3 - 32))
        if f > t2 + 5:
            return up + 0.01 * smooth((f - t2 - 5) / 3)
        return up

    def __call__(self, t):
        f = min(max(int(round(t * self.N)), 0), self.N)
        return dict(self.rows[f])


WRIST = Wrist()


# ================================================================== LookAround
class LookAround:
    """yaw = hipYaw + twist (the EMU waist bearing) + headYaw (<= 14 deg, the helmet turns with the HUT).
    Left ~56 deg, right ~52 deg + ~22 deg up (chest back, small lean back, nod up) with the right glove shading
    the visor (glove held flat in front of the visor brow, in the head frame)."""
    N = 144
    F_UP0, F_UP1, F_DN0, F_DN1 = 66, 94, 114, 140     # right hand: rise, hold at the brow, down

    def __init__(self):
        N = self.N
        L1 = {'twist': 30.0, 'hipYaw': 10.0, 'headYaw': 10.0, 'hipX': 0.022, 'hipRoll': 1.0, 'lean': 2.0,
              'chest': 1.0, 'nod': 1.0, 'hipZ': -0.016}
        L2 = dict(L1, twist=33.0, hipYaw=11.0, headYaw=13.0, nod=-1.0)
        L3 = dict(L2, twist=32.0, headYaw=12.0, nod=-2.5, hipZ=-0.014)
        mid = {'twist': 0.0, 'hipYaw': 0.0, 'headYaw': 0.0, 'hipX': 0.0, 'chest': -2.0, 'nod': -3.0,
               'hipZ': -0.024, 'lean': 0.5}
        R1 = {'twist': -28.0, 'hipYaw': -10.0, 'headYaw': -12.0, 'hipX': -0.022, 'hipRoll': -1.0, 'chest': -7.0,
              'lean': -4.0, 'nod': -14.0, 'hipPitch': -2.0, 'hipY': -0.012, 'hipZ': -0.014}
        R2 = dict(R1, headYaw=-14.0, nod=-15.5, twist=-29.0)
        R3 = dict(R2, nod=-13.5, headYaw=-13.0)
        back = {'twist': -4.0, 'hipYaw': -1.5, 'headYaw': -2.0, 'chest': -1.0, 'nod': -1.5, 'hipX': -0.004,
                'hipZ': -0.014}
        self.body = Tracks([(0, {}), (6, {'twist': -1.5, 'hipX': -0.004, 'hipZ': -0.014}), (30, L1), (37, L2),
                            (56, L3), (77, mid), (97, R1), (103, R2), (116, R3), (134, back), (N, {})], IDLE)
        # shading glove: flat over the right half of the visor brow like a cap brim, pointing forward, palm down,
        # the elbow up and out at helmet height (reads from behind); head frame, rest coordinates
        self.W_SH = Vector((-0.16, -0.30, 1.745))
        self.T_SH = Vector((-0.095, -0.40, 1.735))
        self.E_SH = Vector((-0.37, -0.15, 1.65))
        rows, info = [], []
        base = []
        for f in range(N + 1):
            p = dict(IDLE)
            p.update(self.body(f))
            base.append(p)
        # right arm: one warm-started IK chain idle -> brow -> idle. Wrist and elbow follow Hermite paths (chest
        # frame) that keep the glove close to the body (forearm folds up in front of the chest, the elbow lifts
        # out, the glove comes up past the chin to the brow; down the same way), the brow pose is in the head
        # frame; the glove direction / palm terms fade in at the brow.
        U0, U1, D0, D1 = self.F_UP0, self.F_UP1, self.F_DN0, self.F_DN1
        aI = G.arm_points(base[U0], 'R')
        cI = chest(base[U0])
        WI, EI = G.to_local(cI, aI['wrist'], SP), G.to_local(cI, aI['elbow'], SP)
        aJ = G.arm_points(base[D1], 'R')
        cJ = chest(base[D1])
        WJ, EJ = G.to_local(cJ, aJ['wrist'], SP), G.to_local(cJ, aJ['elbow'], SP)

        def brow(f):
            p = base[f]
            hf, cf = head(p), chest(p)
            return [G.to_local(cf, G.to_world(hf, v, HD), SP) for v in (self.W_SH, self.E_SH)]
        Wu, Eu = brow(U1)
        Wd, Ed = brow(D0)
        sp_u, sp_d = U1 - U0, D1 - D0
        self.w_up = Hermite([(U0, WI), (U0 + 0.45 * sp_u, Vector((-0.22, -0.40, 1.22))),
                             (U0 + 0.75 * sp_u, Vector((-0.24, -0.38, 1.55))), (U1, Wu)])
        self.e_up = Hermite([(U0, EI), (U0 + 0.45 * sp_u, Vector((-0.36, -0.18, 1.10))),
                             (U0 + 0.75 * sp_u, Vector((-0.42, -0.20, 1.38))), (U1, Eu)])
        self.w_dn = Hermite([(D0, Wd), (D0 + 0.3 * sp_d, Vector((-0.26, -0.40, 1.45))),
                             (D0 + 0.6 * sp_d, Vector((-0.34, -0.30, 1.05))), (D1, WJ)])
        self.e_dn = Hermite([(D0, Ed), (D0 + 0.3 * sp_d, Vector((-0.42, -0.16, 1.24))),
                             (D0 + 0.6 * sp_d, Vector((-0.40, -0.10, 1.06))), (D1, EJ)])
        res = {}
        prev = None
        for f in range(N + 1):
            p = base[f]
            if f <= U0 or f >= D1:
                p.update(ARM0['R'])
                res[f] = {'pen': 0.0}
                continue
            p.update(prev or ARM0['R'])
            hf, cf = head(p), chest(p)
            if U1 <= f <= D0:
                w, e = G.to_world(hf, self.W_SH, HD), G.to_world(hf, self.E_SH, HD)
                k = 1.0
            elif f < U1:
                w, e = G.to_world(cf, self.w_up(f), SP), G.to_world(cf, self.e_up(f), SP)
                k = smooth((f - U0 - 0.5 * sp_u) / (0.5 * sp_u))
            else:
                w, e = G.to_world(cf, self.w_dn(f), SP), G.to_world(cf, self.e_dn(f), SP)
                k = 1.0 - smooth((f - D0) / (0.4 * sp_d))
            t = G.to_world(hf, self.T_SH, HD)
            up = hf[0] @ Vector((0, 0, 1))
            wi = smooth((f - D1 + 8) / 8)                   # idle preference just before the end
            res[f] = G.solve_arm(p, 'R', [('pos', 'wrist', w, 6.0), ('pos', 'elbow', e, 1.5),
                                          ('pos', 'tip', t, 3.0 * k), ('dir', 'hdorsal', up, 0.3 * k)],
                                 prev=prev, wprev=0.002, pref=ARM0['R'], wpref=0.0005 + 0.05 * wi,
                                 obst=obstacles(p), iters=80)
            prev = G.arm_params(p, 'R')
        for f in range(N + 1):
            p = base[f]
            info.append((f, res[f]))
            rows.append(finish(p, f, N))
        rows[0] = dict(IDLE)
        rows[N] = dict(IDLE)
        self.rows, self.info = rows, info

    def __call__(self, t):
        f = min(max(int(round(t * self.N)), 0), self.N)
        return dict(self.rows[f])


LOOK = LookAround()

CLIPS = [
    dict(name='Wrist', fn=WRIST, frames=Wrist.N, loop=False, speed=0.0,
         sheet=[0, 14, 26, Wrist.TAPS[0], Wrist.TAPS[1], Wrist.TAPS[1] + 12, 68],
         meta={'tap_frames': list(Wrist.TAPS),
               'note': 'checks the left wrist display (forearm across the chest, torso bent forward, helmet down), '
                       'right glove taps it twice, OK nod, back to idle; from/to idle_params(0.0), boots planted'}),
    dict(name='LookAround', fn=LOOK, frames=LookAround.N, loop=False, speed=0.0,
         sheet=[0, 22, 40, 66, 84, 100, 116, 130],
         meta={'note': 'idle variation: looks round the base to the left (~56 deg: hip yaw + waist twist + head), '
                       'then right (~52 deg) and ~22 deg up at the low Sun with the right glove shading the visor, back '
                       'to the front; from/to idle_params(0.0), boots planted'}),
]
