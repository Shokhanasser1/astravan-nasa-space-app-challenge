"""EnterHatch: from standing on the porch at (0, -2.05, 2.98) facing +Y (= L.idle_params(0.0)), crouch, walk through
the hatch (opening x -0.45..0.45, z 3.00..4.40, wall y -1.55..-1.40) and stand up inside at (0, -0.55, 3.00)
(= idle_params(0.0) shifted by root_end). Root motion is baked into the hips: the scene keeps the root at the
start point for the whole clip, then moves it by root_end and plays Idle.

Rig space: world offset (dx, dy, dz) from the start root = (-dx, -dy, dz). The wall band is rig y -0.50..-0.65,
the porch top is rig z 0 (y > -0.50), the sill / cabin floor rig z +0.02 (y < -0.50).
"""
import math
from mathutils import Vector
import lunar_rig as L
import _lander_core as C
from _lander_core import Tracks, smooth
from _steps import Boot

IDLE = C.idle0()
ROOT0 = Vector((0.0, -2.05, 2.98))
ROOT1 = Vector((0.0, -0.55, 3.00))
END = C.w2r(ROOT1, ROOT0)          # (0, -1.5, 0.02) rig
N = 224
XL, XR = L.IDLE_STANCE['L'].x, L.IDLE_STANCE['R'].x
FZ = END.z

BOOTS = {
    'L': Boot('L', [('flat', 0, 50, Vector((XL, 0.05, 0)), 4.0),
                    ('flat', 74, 114, Vector((XL, -0.10, 0)), 4.0),
                    ('flat', 142, 178, Vector((XL, -1.05, FZ)), 4.0),
                    ('flat', 202, N, Vector((XL, END.y + 0.05, FZ)), 4.0)], lift=0.09),
    'R': Boot('R', [('flat', 0, 82, Vector((XR, 0.05, 0)), -4.0),
                    ('flat', 110, 148, Vector((XR, -0.68, FZ)), -4.0),
                    ('flat', 174, N, Vector((XR, END.y + 0.05, FZ)), -4.0)], lift=0.09),
}

CROUCH = {'hipZ': -0.32, 'hipPitch': 32.0, 'lean': 27.0, 'nod': -40.0, 'chest': 2.0,
          'armL': 46.0, 'armR': 46.0, 'armOutL': -22.0, 'armOutR': -22.0, 'elbL': 45.0, 'elbR': 45.0,
          'armTwL': 20.0, 'armTwR': 20.0, 'wristBL': 8.0, 'wristBR': 8.0}


def _c(**kw):
    d = dict(CROUCH)
    d.update(kw)
    return d


END_BODY = {'hipY': END.y, 'hipZ': IDLE['hipZ'] + END.z}
KEYS = [
    (0, {}),
    (18, _c(hipZ=-0.07, hipPitch=3, lean=4, nod=-3, armL=12, armR=12, elbL=30, elbR=30, armOutL=-6, armOutR=-6,
            hipY=0.03)),
    (34, _c(hipZ=-0.21, hipPitch=12, lean=10, nod=-14, hipY=0.055, armL=30, armR=30)),
    (50, _c(hipY=0.035, hipX=-0.025)),
    (74, _c(hipY=-0.06, hipX=0.0, hipZ=-0.33)),
    (82, _c(hipY=-0.12, hipX=0.025, armL=52, armR=40)),
    (110, _c(hipY=-0.42, hipX=0.0, hipZ=-0.33)),
    (116, _c(hipY=-0.48, hipX=-0.025, armL=40, armR=52)),
    (142, _c(hipY=-0.80, hipX=0.0, hipZ=-0.33)),
    (148, _c(hipY=-0.86, hipX=0.025, armL=50, armR=42)),
    (160, _c(hipY=-0.99, hipX=0.012)),
    (176, dict(_c(hipY=-1.17, hipX=0.0), hipZ=-0.20, hipPitch=17, lean=17, nod=-22)),
    (186, dict(hipY=-1.27, hipX=-0.02, hipZ=-0.12, hipPitch=9, lean=10, nod=-10, armL=20, armR=20, elbL=40,
               elbR=40, armOutL=4, armOutR=4, armTwL=12, armTwR=12)),
    (204, dict(hipY=-1.45, hipX=0.0, hipZ=END_BODY['hipZ'] - 0.01, hipPitch=2, lean=3, nod=-2)),
    (N, END_BODY),
]
TR = Tracks(KEYS, dict(IDLE, hipY=0.0))


def pose(f, state):
    p = dict(IDLE)
    p.update(TR(f))
    for k in 'LR':
        for n, v in state.get('legs' + k, {'th': IDLE['th' + k], 'kn': IDLE['kn' + k],
                                            'legOut': IDLE['legOut' + k]}).items():
            p[n + k] = v
    miss = 0.0
    for k in 'LR':
        miss = max(miss, BOOTS[k].place(p, f))
        state['legs' + k] = {'th': p['th' + k], 'kn': p['kn' + k], 'legOut': p['legOut' + k]}
    state['miss'] = miss
    return p


class Clip:
    def __init__(self):
        st = {}
        self.rows = []
        self.miss = []
        for f in range(N + 1):
            self.rows.append(pose(f, st))
            self.miss.append(st['miss'])
        # exact joins: frame 0 = idle, last frame = idle shifted by root_end
        self.rows[0] = dict(IDLE)
        last = dict(IDLE)
        last['hipY'] = END.y
        last['hipZ'] = IDLE['hipZ'] + END.z
        self.rows[N] = last
        self.N = N

    def __call__(self, t):
        f = min(max(int(round(t * self.N)), 0), self.N)
        return dict(self.rows[f])


ENTER = Clip()


def contacts(f):
    out = {}
    for k in 'LR':
        piv, pos, pitch, yaw, planted = BOOTS[k].state(f)
        if planted and piv == 'heel' and abs(pitch) < 1e-6:
            out['foot' + k] = ('heel', C.r2w(pos, ROOT0))
    return out


CLIPS = [
    dict(name='EnterHatch', fn=ENTER, frames=N, loop=False, speed=0.0,
         sheet=[0, 30, 62, 96, 128, 160, 186, 224],
         meta={'note': 'porch (0,-2.05,2.98) -> crouch-walk through the hatch -> stand inside at (0,-0.55,3.00); '
                       'root motion baked into the hips; at the end move the root by root_end and play Idle',
               'root_start_world': [0.0, -2.05, 2.98], 'root_end': [0.0, 1.5, 0.02],
               'root_end_rig': [0.0, -1.5, 0.02], 'facing': '+Y', 'door': 'HatchOpen must be finished (door at 100 deg) before frame 38',
               'body_in_wall_frames': [38, 164]}),
]

SCENE = {'EnterHatch': dict(root=lambda f: ROOT0, contacts=contacts, look=ROOT0 + Vector((0, 0.75, 0.85)), ortho=2.9,
                            mesh=True, views=['side', 'rear34'], sheet=CLIPS[0]['sheet'], hide={'side': ['wallL', 'door']})}
