"""Insert: the astronaut takes a battery from a right-thigh pocket and pushes it into a slot in front of him.

idle -> right hand down to the thigh pocket, grabs the battery (grab_frame) -> pulls it up out of the pocket and
brings it to the chest centre, the left hand joins -> both hands push it forward into a slot ~0.5 m ahead at
chest height (lean ~10 deg, knees bend) -> 2.5 cm 'click' push -> hands let go (release_frame), open apart,
withdraw, small satisfied nod -> idle. Frame 0 and the last frame are exactly L.idle_params(0.0); boots planted
on the idle stance every frame, root fixed. Played backward it reads as pulling the battery out and pocketing it.

The Battery prop (helpers in _insert_core.py) is bone-parented to RightHand; the clip drives the BOX path and
solves the right hand to carry it, then the left glove to the actual box's left face.
"""
import math
from mathutils import Vector, Matrix
import lunar_rig as L
import _insert_core as C
from _insert_core import Hermite, smooth, smoother, Tracks, seg, nlerp

N = 64
GRAB = 12          # battery appears in the right glove (in the pocket)
JOIN = 26          # left glove on the box
PUSH0, PUSH1 = 28, 38
CLICK0, CLICK1 = 40, 43
RELEASE = 44
IDLE = L.idle_params(0.0)
BATTERY = C.make_battery()

X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
# box orientations (columns = box X (palm side is -X), Y (long, = hand direction), Z (thumb))
R_POCKET = C.frame_from(Vector((0.0, -0.22, -1.0)), -X)    # hanging hand, palm toward the thigh, box upright
R_FWD = C.frame_from(Vector((0.0, -1.0, -0.06)), -X)       # hand points forward, palm inward, box level-ish
C_POCKET = Vector((-0.345, -0.115, 0.735))                   # box centre in the pocket (outside of the right thigh)
C_OUT = C_POCKET + Vector((0.0, -0.015, 0.06))             # pulled up out of the pocket
C_CHEST = Vector((0.0, -0.40, 1.05))
C_SLOT = Vector((0.0, -0.52, 1.07))                       # box seated (before the click)
CLICK = 0.025
C_IN = C_SLOT + Vector((0.0, -CLICK, 0.0))                  # clicked home

BOX_PATH = Hermite([(GRAB + 3, C_OUT), (21, Vector((-0.24, -0.34, 0.95))), (JOIN, C_CHEST)])


def box_target(f):
    """desired box centre + orientation at frame f (GRAB..RELEASE)"""
    if f <= GRAB + 3:
        c = C_POCKET.lerp(C_OUT, smooth((f - GRAB) / 3.0))
    elif f <= JOIN:
        c = BOX_PATH(f)
    elif f <= PUSH0:
        c = C_CHEST.copy()
    elif f <= CLICK0:
        c = seg([(PUSH0, C_CHEST), (PUSH1, C_SLOT), (CLICK0, C_SLOT)], f)
    else:
        c = seg([(CLICK0, C_SLOT), (CLICK1, C_IN)], f)
    u = smoother((f - (GRAB + 2)) / (JOIN - 2 - GRAB))
    y = C.nlerp(R_POCKET.col[1], R_FWD.col[1], u)
    x = C.nlerp(R_POCKET.col[0], R_FWD.col[0], u)
    return c, C.frame_from(y, x)


body = Tracks([
    (0, {}),
    (GRAB, {'lean': 6, 'hipRoll': -4.5, 'twist': 7, 'nod': 18, 'headYaw': -20, 'hipZ': -0.045, 'hipY': 0.01,
            'hipX': -0.012}),
    (GRAB + 4, {'lean': 6, 'hipRoll': -3.5, 'twist': 6, 'nod': 17, 'headYaw': -17, 'hipZ': -0.04, 'hipY': 0.01,
                'hipX': -0.01}),
    (JOIN, {'lean': 4, 'hipRoll': 0, 'twist': 0, 'nod': 16, 'headYaw': -2, 'hipZ': -0.03, 'hipY': 0.0}),
    (PUSH1, {'lean': 11, 'nod': 12, 'hipZ': -0.05, 'hipY': 0.02}),
    (CLICK1, {'lean': 12.5, 'nod': 12, 'hipZ': -0.055, 'hipY': 0.022}),
    (RELEASE + 4, {'lean': 9, 'nod': 10, 'hipZ': -0.05, 'hipY': 0.018}),
    (54, {'lean': 3, 'nod': 11, 'hipZ': -0.025, 'hipY': 0.006}),
    (59, {'lean': 1.5, 'nod': -1.5, 'hipZ': -0.014}),
    (N, {}),
], IDLE)


def finish(p, f, ramp=6):
    """blend the solved arms with idle at both ends (exact idle joins), plant the boots"""
    u = min(smooth(f / ramp), smooth((N - f) / ramp))
    for k in 'LR':
        for kk, v in C.arm_params(IDLE, k).items():
            p[kk] = v + (p[kk] - v) * u
    for k in 'LR':
        p['th' + k], p['kn' + k], p['legOut' + k] = IDLE['th' + k], IDLE['kn' + k], IDLE['legOut' + k]
    L.plant_idle_feet(p)
    return p


class Insert:
    def __init__(self):
        self.rows = []
        self.box = {}
        self.miss = {}
        h0 = {k: C.hand_points(IDLE, k) for k in 'LR'}
        T0 = {k: h0[k]['tip'] for k in 'LR'}
        D0 = {k: h0[k]['dir'] for k in 'LR'}
        P0 = {k: (h0[k]['Dh'] @ C.PALM_REST).normalized() for k in 'LR'}
        # right glove: idle -> pocket (arc out a little so the glove does not drag along the thigh)
        tp = C.tail_for_box(C_POCKET, R_POCKET)
        FP = C.hand_frame_for_box(R_POCKET)
        self.R_reach = Hermite([(0, T0['R']), (GRAB * 0.55, T0['R'].lerp(tp, 0.6) + Vector((-0.03, -0.04, 0.0))),
                                (GRAB, tp)])
        # left glove: idle -> approach point 4 cm outside the box's left face (desired path) -> onto the face
        cj, Rj = box_target(JOIN - 2)
        trj = C.tail_for_box(cj, Rj)
        tlj = cj + C.reflect(trj - cj, Rj.col[0]) - Rj.col[0] * 0.045
        self.L_reach = Hermite([(13, T0['L']), (19, T0['L'].lerp(tlj, 0.5) + Vector((0.03, -0.06, 0.05))),
                                (JOIN - 2, tlj)])
        prev = {'L': C.arm_params(IDLE, 'L'), 'R': C.arm_params(IDLE, 'R')}
        rel = None
        for f in range(N + 1):
            p = dict(IDLE)
            p.update(body(f))
            for k in 'LR':
                p.update(prev[k])
            # ---------------- right hand
            if f < GRAB:
                u = smooth(f / GRAB)
                tgt = self.R_reach(f)
                hd = nlerp(D0['R'], FP.col[1], u)
                palm = nlerp(P0['R'], FP @ C.PALM_LOCAL['R'], u)
                wd, wp = 0.05 + 0.25 * u, 0.25 * u
            elif f <= RELEASE:
                cb, Rb = box_target(f)
                tgt = C.tail_for_box(cb, Rb)
                Fh = C.hand_frame_for_box(Rb)
                hd, palm = Fh.col[1], Fh @ C.PALM_LOCAL['R']
                wd, wp = 0.5, 0.5
            else:
                tgt, hd, palm, wd, wp = self.after('R', f)
            m = C.solve_arm(p, 'R', tgt, hdir=hd, wdir=wd, palm=palm, wpalm=wp, prev=prev['R'], wprev=0.0008,
                            elbow_out=self.elb(f))
            self.miss[('R', f)] = m
            prev['R'] = C.arm_params(p, 'R')
            hr = C.hand_points(p, 'R')
            cb_act, Rb_act = C.box_from_hand(hr['tip'], hr['F'])
            self.box[f] = (cb_act, Rb_act)
            n = Rb_act.col[0]
            contactL = cb_act + C.reflect(hr['tip'] - cb_act, n)
            hdL = C.reflect(hr['dir'], n)
            palmL = C.reflect(hr['Dh'] @ C.PALM_REST, n)
            # ---------------- left hand
            if f <= 13:
                tgt, hd, palm, wd, wp = T0['L'], D0['L'], P0['L'], 0.05, 0.0
            elif f < JOIN - 2:
                u = smooth((f - 13) / (JOIN - 2 - 13))
                tgt = self.L_reach(f)
                hd = nlerp(D0['L'], hdL, u)
                palm = nlerp(P0['L'], palmL, u)
                wd, wp = 0.05 + 0.25 * u, 0.25 * u
            elif f <= RELEASE:
                u = smooth((f - (JOIN - 2)) / 3.0)
                tgt = contactL - n * 0.045 * (1 - u)
                hd, palm, wd, wp = hdL, palmL, 0.35, 0.35
            else:
                tgt, hd, palm, wd, wp = self.after('L', f)
            m = C.solve_arm(p, 'L', tgt, hdir=hd, wdir=wd, palm=palm, wpalm=wp, prev=prev['L'], wprev=0.0008,
                            elbow_out=self.elb(f))
            self.miss[('L', f)] = m
            prev['L'] = C.arm_params(p, 'L')
            if f == RELEASE:
                hl = C.hand_points(p, 'L')
                rel = {'R': (hr['tip'], hr['dir'], hr['Dh'] @ C.PALM_REST, -n),
                       'L': (hl['tip'], hl['dir'], hl['Dh'] @ C.PALM_REST, n)}
                self._build_after(rel, T0, D0, P0)
            self.rows.append(finish(p, f))
        self.rows[0] = dict(IDLE)
        self.rows[N] = dict(IDLE)

    def elb(self, f):
        return 0.28 - 0.04 * smooth((f - 16) / 8.0) * smooth((N - 6 - f) / (N - 6 - RELEASE - 4))

    def _build_after(self, rel, T0, D0, P0):
        """after the release: open the gloves 3.5 cm apart (and 1 cm back), then withdraw to idle"""
        self.aft = {}
        for k in 'LR':
            t, d, pm, out = rel[k]
            # out: away from the box (right glove toward -n... n = box X axis = toward the right glove side)
            o = -out if k == 'R' else -out
            o = Vector((o.x, 0.0, 0.0)).normalized() if abs(o.x) > 1e-6 else Vector((1.0 if k == 'L' else -1.0, 0, 0))
            a = t + o * 0.035 + Vector((0, 0.012, 0.0))
            mid = a.lerp(T0[k], 0.5) + Vector((0.04 * o.x, -0.05, 0.02))
            self.aft[k] = (Hermite([(RELEASE, t), (RELEASE + 3, a), (RELEASE + 10, mid), (N - 3, T0[k])]),
                           d, pm, D0[k], P0[k])

    def after(self, k, f):
        path, d, pm, d0, p0 = self.aft[k]
        u = smooth((f - (RELEASE + 3)) / (N - 3 - RELEASE - 3))
        return path(f), nlerp(d, d0, u), nlerp(pm, p0, u), 0.35 * (1 - u) + 0.05, 0.35 * (1 - u)

    def __call__(self, t):
        f = min(max(int(round(t * N)), 0), N)
        return dict(self.rows[f])


INSERT = Insert()
_mx = max(INSERT.miss.values())
L.log('Insert IK miss max %.4f m (R grab..release %.4f, L join..release %.4f)' % (
    _mx, max(INSERT.miss[('R', f)] for f in range(GRAB, RELEASE + 1)),
    max(INSERT.miss[('L', f)] for f in range(JOIN, RELEASE + 1))))
_cr = INSERT.box[RELEASE]
L.log('Insert box at release: centre', tuple(round(v, 4) for v in _cr[0]), 'long axis',
      tuple(round(v, 3) for v in _cr[1].col[1]))

CLIPS = [dict(name='Insert', fn=INSERT, frames=N, loop=False, speed=0.0,
              sheet=[0, GRAB, 20, JOIN, PUSH1, RELEASE, 50, 58],
              meta={'grab_frame': GRAB, 'release_frame': RELEASE,
                    'note': 'right hand takes the Battery from a right-thigh pocket (grab_frame), both hands push it '
                            'into a slot ~0.5 m ahead at chest height, 2.5 cm click, let go (release_frame), back '
                            'to idle; play backward = pull out and pocket. Battery prop: bone child of RightHand',
                    'battery_centre_release': [round(v, 4) for v in _cr[0]],
                    'battery_front_release': [round(v, 4) for v in (_cr[0] + _cr[1].col[1] * 0.08)]})]
