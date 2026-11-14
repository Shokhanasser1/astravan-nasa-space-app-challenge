"""Run = Apollo-style alternate-foot LOPE, planted for 2.0 m/s (clip keeps the name 'Run' for the game).

Physics (Moon g = 1.62 m/s^2), one step = contact t_c + flight t_f, a cycle is two steps (L then R):
  t_c = 10 f (0.333 s), t_f = 10 f (0.333 s), step 20 f (0.667 s), cycle 40 f (1.333 s)
  step length = speed * (t_c + t_f) = 1.333 m, ground contact length = speed * t_c = 0.667 m
  take-off vertical speed v_z = g t_f / 2 = 0.27 m/s, flight rise g t_f^2 / 8 = 2.25 cm
  contact: vertical ground force is a half sine (spring-mass runner), so the hips acceleration is
  -g + A sin(pi s / t_c), A = (pi/2) g (t_c + t_f) / t_c  ->  peak +3.47 m/s^2, continuous at -g at both ends,
  hips dip 3.5 cm below touchdown height at mid-stance. In flight the hips follow z'' = -g exactly.
Timeline (clip frames of 40): 0 flight apex | 5 left touchdown | 15 left take-off | 20 apex | 25 right touchdown |
35 right take-off | 40 = 0. The loop seam sits at the flight apex (hips z' = 0, both boots in the air): the baked
F-curves get flat "ease" end handles (no Cycles modifier), which would fake a hips-acc spike / boot slide in
Blender's sub-frame measure if the seam were at a touchdown. Per-frame values (what the glTF exports) are exact.
Boots: one IK pivot for the whole cycle ('ball' = toe joint), so nothing can snap when contact starts or ends.
Contact: land on the forefoot (heel 6 deg up, toes flat), heel settles flat, heel-off to 30 deg pushing from the
ball; the ball moves backward at exactly `speed` in clip space while planted. The swing curves leave / arrive
moving back at exactly `speed` with zero acceleration, so a boot within a centimetre of the ground never drifts.
Body: ~11 deg forward lean (lean 9 + pelvis 3.5), pelvis yaw 5 deg with the legs and the chest counter-turning,
arms out ~14 deg, elbows ~32-38 deg, gentle counter-swing; arm spread / lean / shrug follow the vertical load.
"""
import math
import lunar_rig as L
from mathutils import Vector

FPS = L.FPS
G = L.G_MOON
SPEED = 2.0
NC, NF = 10, 10                 # frames of contact / flight per step
NS = NC + NF                    # frames per step
N = 2 * NS                      # frames per cycle
TC, TF, TS, TCYC = NC / FPS, NF / FPS, NS / FPS, N / FPS
VZ = G * TF / 2.0               # take-off / landing vertical speed of the hips
A_GRF = 0.5 * math.pi * G * TS / TC   # peak (ground force / mass) in contact
STEP_LEN = SPEED * TS
CONTACT_LEN = SPEED * TC

# ---------------------------------------------------------------- tunables
Z_TD = -0.050          # hipZ at touchdown / take-off (m, relative to standing)
HIP_Y = 0.0            # pelvis fore/aft offset
FOOT_X = 0.215         # boot track half width (ball joint x)
FOOT_YAW = 3.0         # toe-out, deg
TH_TD = 6.0            # boot pitch at touchdown (heel up = forefoot landing)
TH_TO = 30.0           # boot pitch at take-off (heel-off about the ball)
LIFT_W = 0.2           # toe-region verts carry ~20 % Foot weight: lift the pivot by that share of their drop
Y_TD = -0.465          # ball y at touchdown (clip space); take-off at Y_TD + CONTACT_LEN


def hips_z(tsec):
    """hipZ over the cycle: half-sine force in contact, Moon parabola in flight (same for both steps)."""
    s = tsec % TS
    if s <= TC:
        return (Z_TD - VZ * s - 0.5 * G * s * s
                + 0.5 * G * TS * (s - TC / math.pi * math.sin(math.pi * s / TC)))
    u = s - TC
    return Z_TD + VZ * u - 0.5 * G * u * u


def hips_acc(tsec):
    s = tsec % TS
    if s <= TC:
        return -G + A_GRF * math.sin(math.pi * s / TC)
    return -G


# ---------------------------------------------------------------- Hermite tracks
class Track:
    """Piecewise Hermite through knots (t, value, slope[, acc]). A None slope comes from the 3-point parabola.
    A segment is quintic (C2: matches the accelerations too) when either end gives an acceleration (a None
    acceleration is then estimated from the neighbouring slopes), otherwise cubic."""

    def __init__(self, knots):
        ks = [list(k) + [False] * (4 - len(k)) for k in knots]
        for i, k in enumerate(ks):
            if k[2] is None:
                t0, v0 = ks[i - 1][0], ks[i - 1][1]
                t1, v1 = k[0], k[1]
                t2, v2 = ks[i + 1][0], ks[i + 1][1]
                d0 = (v1 - v0) / (t1 - t0)
                d1 = (v2 - v1) / (t2 - t1)
                k[2] = (d0 * (t2 - t1) + d1 * (t1 - t0)) / (t2 - t0)
        for i, k in enumerate(ks):
            if k[3] is None:
                j0, j1 = max(i - 1, 0), min(i + 1, len(ks) - 1)
                k[3] = (ks[j1][2] - ks[j0][2]) / (ks[j1][0] - ks[j0][0])
        self.k = ks

    def __call__(self, t):
        ks = self.k
        if t <= ks[0][0]:
            return ks[0][1]
        for (t0, v0, m0, a0), (t1, v1, m1, a1) in zip(ks, ks[1:]):
            if t <= t1:
                h = t1 - t0
                u = (t - t0) / h
                if a0 is False and a1 is False:
                    h00 = 2 * u ** 3 - 3 * u ** 2 + 1
                    h10 = u ** 3 - 2 * u ** 2 + u
                    h01 = -2 * u ** 3 + 3 * u ** 2
                    h11 = u ** 3 - u ** 2
                    return h00 * v0 + h10 * h * m0 + h01 * v1 + h11 * h * m1
                a0 = 0.0 if a0 is False else a0
                a1 = 0.0 if a1 is False else a1
                u2, u3, u4, u5 = u * u, u ** 3, u ** 4, u ** 5
                H0 = 1 - 10 * u3 + 15 * u4 - 6 * u5
                H1 = u - 6 * u3 + 8 * u4 - 3 * u5
                H2 = 0.5 * (u2 - 3 * u3 + 3 * u4 - u5)
                H3 = 0.5 * (u3 - 2 * u4 + u5)
                H4 = -4 * u3 + 7 * u4 - 3 * u5
                H5 = 10 * u3 - 15 * u4 + 6 * u5
                return (H0 * v0 + H1 * h * m0 + H2 * h * h * a0
                        + H3 * h * h * a1 + H4 * h * m1 + H5 * v1)
        return ks[-1][1]


Y_TO = Y_TD + CONTACT_LEN
TSW = TCYC - TC          # swing time (s) = t_c + 2 t_f

# contact pitch: forefoot landing, heel settles, flat, heel-off
M_TD = -TH_TD / (0.30 * TC) * 1.2
M_TO = TH_TO / (0.55 * TC) * 1.9
PITCH_C = Track([(0.0, TH_TD, M_TD), (0.30 * TC, 0.0, 0.0), (0.45 * TC, 0.0, 0.0), (TC, TH_TO, M_TO)])

# swing (sigma = seconds since take-off, 0..TSW): ball y, ball height, pitch, toe.
# y leaves and arrives moving back at exactly SPEED with zero acceleration (quintic ends), so a boot that is
# still / already within a centimetre of the ground does not drift in the world.
SW_Y = Track([(0.00, Y_TO, SPEED, 0.0),
              (0.12, Y_TO + 0.05, 0.0, None),
              (0.33, Y_TO - 0.12, None),
              (0.55, -0.30, None),
              (0.70, Y_TD - 0.015, None),
              (0.92, Y_TD - 0.045, 0.0, None),
              (TSW, Y_TD, SPEED, 0.0)])
SW_H = Track([(0.00, 0.0, 0.25),
              (0.05, 0.035, 0.8),
              (0.15, 0.08, None),
              (0.35, 0.08, None),
              (0.55, 0.065, None),
              (0.75, 0.065, None),
              (0.90, 0.05, None),
              (TSW, 0.0, -0.55)])
SW_P = Track([(0.00, TH_TO, M_TO),
              (0.12, 40.0, None),
              (0.33, 34.0, None),
              (0.55, 15.0, None),
              (0.75, -4.0, None),
              (0.90, 0.0, None),
              (TSW, TH_TD, M_TD)])
SW_T = Track([(0.00, -TH_TO, -M_TO),
              (0.10, -38.0, None),
              (0.25, -22.0, None),
              (0.45, -5.0, None),
              (0.75, 0.0, None),
              (TSW, -TH_TD, -M_TD)])


def pivot_lift(th):
    """While the heel is up, the toe-region vertices that are partly skinned to the Foot bone dip below the
    flat toe (5 cm ahead of the joint, 3.5 cm under it). Lift the pivot by their weighted drop."""
    if th <= 0.0:
        return 0.0
    r = math.radians(th)
    return LIFT_W * (0.05 * math.sin(r) + 0.035 * (1.0 - math.cos(r)))


def foot_state(tau):
    """Boot state at tau seconds after this boot's touchdown: (ball y, ball height, pitch, toe, planted)."""
    tau = tau % TCYC
    if tau <= TC:
        th = max(0.0, PITCH_C(tau))
        return Y_TD + SPEED * tau, pivot_lift(th), th, -th, True
    sg = tau - TC
    th = SW_P(sg)
    lift = pivot_lift(th) * (1.0 - L.smooth(sg / 0.15))
    return SW_Y(sg), max(0.0, SW_H(sg)) + lift, th, SW_T(sg), False


def seed_leg(p, k, ank):
    """Planar 2-bone seed for the numeric IK (keeps the knee forward and converges in a few steps)."""
    hj = L.hip_joint(p, k)
    d = ank - hj
    f, dn = -d.y, -d.z
    r = min(math.hypot(f, dn), L.THIGH + L.SHIN - 1e-4)
    ci = (L.THIGH ** 2 + L.SHIN ** 2 - r * r) / (2 * L.THIGH * L.SHIN)
    kn = 180.0 - math.degrees(math.acos(max(-1.0, min(1.0, ci))))
    ca = (L.THIGH ** 2 + r * r - L.SHIN ** 2) / (2 * L.THIGH * r)
    th = math.degrees(math.atan2(f, dn) + math.acos(max(-1.0, min(1.0, ca))))
    p['th' + k] = th - 2.0
    p['kn' + k] = max(kn, 3.0)
    p.setdefault('legOut' + k, 0.0)


MISS = {}


def body(tsec):
    t = tsec / TCYC
    ph = L.TAU * t
    c2 = TC / TCYC / 2.0                    # phase of left mid-stance (t = 0.125)
    stance = math.cos(L.TAU * (t - c2))     # +1 left mid-stance, -1 right mid-stance
    p = {}
    p['hipZ'] = hips_z(tsec)
    p['hipY'] = HIP_Y
    p['hipX'] = 0.006 * stance
    p['hipRoll'] = -2.0 * stance
    yaw = -5.0 * math.cos(L.TAU * (t + 0.25 - c2))   # left hip forward when the left leg reaches
    p['hipYaw'] = yaw
    p['hipPitch'] = 3.5
    acc = hips_acc(tsec - 0.05)             # lagged vertical load drives the soft secondary motion
    load = (acc + G) / (A_GRF)              # 0 in flight .. 1 at peak stance load
    p['lean'] = 9.0 + 1.5 * load
    p['twist'] = -1.4 * yaw
    p['headYaw'] = 0.4 * yaw
    p['nod'] = -1.0 * load + 1.0
    p['chest'] = 0.5 * load
    # arms: out for balance, stiff and slightly bent, gentle counter-swing to the legs (lagging a little)
    for k, sg in (('L', 1.0), ('R', -1.0)):
        sw = math.cos(L.TAU * (t - 0.47) + (0.0 if k == 'L' else math.pi))   # +1 = this arm forward
        p['arm' + k] = 7.0 + 9.0 * sw
        p['armOut' + k] = 14.0 - 2.5 * load + 1.0 * sw
        p['elb' + k] = 32.0 + 6.0 * max(0.0, sw) + 2.0 * load
        p['armTw' + k] = 14.0
        p['foreTw' + k] = 0.0
        p['wristB' + k] = 6.0
        p['shrug' + k] = 1.0 - 1.0 * load
    return p


T0 = (NF // 2) / FPS     # clip starts at the flight apex: the loop seam has hips z' = 0 and both boots in the air


def lope(t):
    tsec = ((t % 1.0) * TCYC - T0) % TCYC    # model time: left touchdown at tsec = 0 (clip frame NF/2)
    p = body(tsec)
    for k, off, sg in (('L', 0.0, 1.0), ('R', TS, -1.0)):
        y, h, th, toe, planted = foot_state(tsec - off)
        piv = Vector((sg * FOOT_X, y, L.SOLE[k]['ball'].z + h))
        yaw = sg * FOOT_YAW
        R = L.foot_rot(th, yaw)
        ank = piv + R @ (L.SOLE[k]['ankle'] - L.SOLE[k]['ball'])
        seed_leg(p, k, ank)
        MISS[(k, round(t, 4))] = L.place_foot(p, k, 'ball', piv, pitch=th, yaw=yaw, toe=toe)
    return p


CLIPS = [dict(name='Run', fn=lope, frames=N, loop=True, speed=SPEED,
              sheet=[5, 8, 11, 14, 17, 20],
              meta={'note': 'Apollo alternate-foot lope, 2.0 m/s, contact %.3fs + flight %.3fs per step, '
                            'step %.2f m' % (TC, TF, STEP_LEN)})]
