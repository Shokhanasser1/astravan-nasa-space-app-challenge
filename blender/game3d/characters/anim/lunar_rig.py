"""Shared animation kit for the astronaut rig (Blender 5.3, runs inside Blender).

    import sys; sys.path.insert(0, ANIM_DIR); import lunar_rig as L

Same pose language as build_astronaut.py (scalar params in degrees / metres, rotations as deltas about the
REST WORLD AXES: X = character's left, Y = back, Z = up; the character faces -Y), plus:

  * leg IK that plants a boot exactly:  L.place_foot(p, 'L', pivot, pivot_world, pitch, yaw, toe)
      pivot = 'heel' (bottom of the heel), 'ball' (toe joint, 3.5 cm above the sole), 'tip' (toe tip, toe kept
            straight unless toe= is given), 'ankle' (free swing)
      pitch > 0 = toes down (heel up), pitch < 0 = toes up (heel strike)
  * bake_clip(name, fn, nframes, loop, meta)  -> replaces the action of that name (+ its NLA track)
  * measure(name, speed)                     -> sole sink, planted-boot slide, hips accel vs Moon g, flight
  * export_glb(path, draco)                  -> same exporter settings as build_astronaut.py
  * contact_sheet(...)                       -> Cycles CPU side-view tiles on a 10 cm checker floor

Clips are IN PLACE: the game moves the character at `speed` m/s along -Y. A planted boot therefore moves
BACKWARD (+Y) in clip space at exactly `speed`; measure() adds the root motion back before judging slide.
"""
import bpy, math, json, os, sys
from mathutils import Vector, Quaternion, Matrix

G_MOON = 1.62
FPS = 30
HERE = os.path.dirname(os.path.abspath(__file__))

rig = bpy.data.objects['AstronautRig']
body = bpy.data.objects['Astronaut']
arm_data = rig.data
REST = {b.name: b.matrix_local.to_3x3() for b in arm_data.bones}
JH = {b.name: Vector(b.head_local) for b in arm_data.bones}
JT = {b.name: Vector(b.tail_local) for b in arm_data.bones}
PARENT = {b.name: (b.parent.name if b.parent else None) for b in arm_data.bones}
ORDER = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
         'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
         'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
         'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
         'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']
ALL_BONES = ORDER + ['BagSocket']
SIDE = {'L': 'Left', 'R': 'Right'}
AX = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}
S, C, TAU = math.sin, math.cos, 2 * math.pi
ARM_DOWN = 55.0
HANG = {'elbL': 18, 'elbR': 18, 'armTwL': 10, 'armTwR': 10}

# boot sole landmarks (rest, world), measured from the mesh: sole flat at z = 0, heel back edge y = +0.05,
# toe tip y = -0.33, toe joint (ToeBase head) y = -0.22 z = 0.035
SOLE = {}
for k, sg in (('L', 1), ('R', -1)):
    ank = JH[SIDE[k] + 'Foot']
    ball = JH[SIDE[k] + 'ToeBase']
    SOLE[k] = {'ankle': ank.copy(), 'ball': ball.copy(),
               'heel': Vector((ank.x, 0.05, 0.0)), 'tip': Vector((ball.x, -0.33, 0.0))}
THIGH = (JH['LeftLeg'] - JH['LeftUpLeg']).length
SHIN = (JH['LeftFoot'] - JH['LeftLeg']).length


def log(*a):
    print('ANIM', *a, flush=True)


def qw(*rots):
    q = Quaternion()
    for ax, deg in rots:
        q = Quaternion(AX[ax], math.radians(deg)) @ q
    return q


def q_local(name, q):
    R = REST[name].to_quaternion()
    return R.inverted() @ q @ R


def pose_from_params(p):
    """Identical to build_astronaut.py, plus quaternion overrides 'qFtL'/'qFtR' (foot delta, set by the IK)."""
    g = lambda k, d=0.0: p.get(k, d)
    lean, twist = g('lean'), g('twist')
    out = {}
    out['Hips'] = (qw(('X', g('hipPitch')), ('Z', g('hipYaw')), ('Y', g('hipRoll'))),
                   Vector((g('hipX'), g('hipY'), g('hipZ'))))
    out['Spine'] = (qw(('X', 0.4 * lean), ('Z', 0.3 * twist)), None)
    out['Spine1'] = (qw(('X', 0.3 * lean), ('Z', 0.3 * twist)), None)
    out['Spine2'] = (qw(('X', 0.3 * lean + g('chest')), ('Z', 0.4 * twist)), None)
    out['Neck'] = (qw(('X', -0.4 * lean + 0.5 * g('nod')), ('Z', 0.5 * g('headYaw'))), None)
    out['Head'] = (qw(('X', -0.3 * lean + 0.5 * g('nod')), ('Z', 0.5 * g('headYaw'))), None)
    for side, sg in (('Left', 1), ('Right', -1)):
        k = side[0]
        out[side + 'Shoulder'] = (qw(('Y', -sg * g('shrug' + k))), None)
        out[side + 'Arm'] = (qw(('X', g('armTw' + k)),
                                ('Y', sg * (ARM_DOWN - g('armOut' + k))),
                                ('X', -g('arm' + k))), None)
        out[side + 'ForeArm'] = (qw(('Z', -sg * g('elb' + k)), ('X', g('foreTw' + k))), None)
        out[side + 'Hand'] = (qw(('Z', -sg * g('wristB' + k)), ('X', g('wristR' + k))), None)
        out[side + 'UpLeg'] = (qw(('Y', -sg * g('legOut' + k)), ('X', -g('th' + k))), None)
        out[side + 'Leg'] = (qw(('X', g('kn' + k))), None)
        out[side + 'Foot'] = (p['qFt' + k], None) if ('qFt' + k) in p else (qw(('X', g('ft' + k))), None)
        out[side + 'ToeBase'] = (qw(('X', g('toe' + k))), None)
    if 'sockQ' in p:
        out['BagSocket'] = (p['sockQ'], p['sockT'])
    return out


def fk(p):
    """World (armature-space) head positions and rotation deltas of every bone for params p."""
    pose = pose_from_params(p)
    D, H = {}, {}
    for n in ALL_BONES:
        q = pose.get(n, (Quaternion(), None))[0]
        par = PARENT[n]
        if par is None:
            off = pose[n][1] if n in pose and pose[n][1] is not None else Vector()
            D[n] = q
            H[n] = JH[n] + off
        else:
            D[n] = D[par] @ q
            H[n] = H[par] + D[par] @ (JH[n] - JH[par])
    return D, H


def _leg_chain(p, k):
    """Fast FK for one leg: (D_shin, ankle_world)."""
    g = lambda kk, d=0.0: p.get(kk, d)
    sg = 1 if k == 'L' else -1
    s = SIDE[k]
    Dh = qw(('X', g('hipPitch')), ('Z', g('hipYaw')), ('Y', g('hipRoll')))
    hh = JH['Hips'] + Vector((g('hipX'), g('hipY'), g('hipZ')))
    up = hh + Dh @ (JH[s + 'UpLeg'] - JH['Hips'])
    Du = Dh @ qw(('Y', -sg * g('legOut' + k)), ('X', -g('th' + k)))
    knee = up + Du @ (JH[s + 'Leg'] - JH[s + 'UpLeg'])
    Dk = Du @ qw(('X', g('kn' + k)))
    ank = knee + Dk @ (JH[s + 'Foot'] - JH[s + 'Leg'])
    return Dk, ank, up, knee


def hip_joint(p, k):
    return _leg_chain(p, k)[2]


LIM = {'th': (-70.0, 125.0), 'legOut': (-12.0, 35.0), 'kn': (0.5, 150.0)}


def leg_ik(p, k, ankle_target, iters=40):
    """Solve th/legOut/kn of leg k so the ankle reaches ankle_target. Damped Gauss-Newton, numeric Jacobian.
    Writes into p, returns the remaining distance (m). Unreachable -> leg stretched toward the target."""
    keys = ['th' + k, 'legOut' + k, 'kn' + k]
    x = [p.get(kk, 0.0) for kk in keys]
    if x[2] < 2.0:
        x[2] = 8.0   # start bent: a straight knee has no gradient to pick the bend direction
    lo = [LIM[kk[:-1]][0] for kk in keys]
    hi = [LIM[kk[:-1]][1] for kk in keys]

    def f(xx):
        q = dict(p)
        q.update(zip(keys, xx))
        return _leg_chain(q, k)[1] - ankle_target

    lam = 1e-3
    r = f(x)
    for _ in range(iters):
        if r.length < 2e-5:
            break
        Jc = []
        for i in range(3):
            y = list(x)
            y[i] += 0.25
            Jc.append((f(y) - r) / 0.25)
        # normal equations (3x3): (J^T J + lam I) dx = -J^T r
        JTJ = Matrix([[Jc[i].dot(Jc[j]) + (lam if i == j else 0.0) for j in range(3)] for i in range(3)])
        JTr = Vector([Jc[i].dot(r) for i in range(3)])
        try:
            dx = -(JTJ.inverted() @ JTr)
        except ValueError:
            break
        y = [min(max(x[i] + dx[i], lo[i]), hi[i]) for i in range(3)]
        ry = f(y)
        if ry.length < r.length:
            x, r = y, ry
            lam = max(lam * 0.3, 1e-7)
        else:
            lam *= 10.0
            if lam > 1e4:
                break
    p.update(zip(keys, x))
    return r.length


def foot_rot(pitch, yaw=0.0, roll=0.0):
    """World rotation of the boot: pitch about X (+ = toes down), then roll about Y, then yaw about Z."""
    return qw(('X', pitch), ('Y', roll), ('Z', yaw))


def place_foot(p, k, pivot, pivot_world, pitch=0.0, yaw=0.0, toe=None, roll=0.0):
    """Put boot k so its `pivot` landmark ('heel', 'ball', 'ankle', 'tip') sits at pivot_world with the boot
    pitched/yawed as given. toe=None: with pivot 'ball' the toe stays flat on the ground (toe = -pitch),
    else 0. Writes th/legOut/kn, qFt<k>, toe<k> into p. Returns the IK miss (m)."""
    R = foot_rot(pitch, yaw, roll)
    sole = SOLE[k]
    ank = Vector(pivot_world) + R @ (sole['ankle'] - sole[pivot])
    miss = leg_ik(p, k, ank)
    Dk = _leg_chain(p, k)[0]
    p['qFt' + k] = Dk.inverted() @ R
    if toe is None:   # heel-off about the ball: the toe stays flat; rolling on the tip: the toe stays straight
        toe = -pitch if pivot == 'ball' and pitch > 0 else 0.0
    p['toe' + k] = toe
    return miss


def boot_points(p, k):
    """World positions of the sole landmarks for params p (heel, ball-ground, tip) — fast, no mesh."""
    D, H = fk(p)
    s = SIDE[k]
    Df, Dt = D[s + 'Foot'], D[s + 'ToeBase']
    a, b = H[s + 'Foot'], H[s + 'ToeBase']
    sole = SOLE[k]
    heel = a + Df @ (sole['heel'] - sole['ankle'])
    ballg = a + Df @ (sole['ball'] - Vector((0, 0, 0.035)) - sole['ankle'])
    tip = b + Dt @ (sole['tip'] - sole['ball'])
    return {'heel': heel, 'ball': ballg, 'tip': tip, 'ankle': a}


# ------------------------------------------------------------------ helpers for writing clips
def smooth(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def lerp(a, b, u):
    return a + (b - a) * u


def lerp_keys(keys, t, cyclic=True):
    """keys: list of (t in [0,1], dict). Smooth (cosine) interpolation (same as build_astronaut.py)."""
    ks = sorted(keys, key=lambda kk: kk[0])
    if cyclic:
        ks = ks + [(ks[0][0] + 1.0, ks[0][1])]
    t = t % 1.0 if cyclic else min(max(t, 0.0), ks[-1][0])
    for (t0, a), (t1, b) in zip(ks, ks[1:]):
        if t0 <= t <= t1:
            u = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
            u = 0.5 - 0.5 * math.cos(math.pi * u)
            names = set(a) | set(b)
            return {n: a.get(n, 0.0) * (1 - u) + b.get(n, 0.0) * u for n in names}
    return dict(ks[-1][1])


IDLE_STANCE = {k: SOLE[k]['heel'] + Vector((0.008 * (1 if k == 'L' else -1), 0, 0)) for k in 'LR'}


def plant_idle_feet(p):
    """Both boots flat at the Idle stance (toes out 4 deg)."""
    for k in 'LR':
        p.setdefault('th' + k, 2.0)
        p.setdefault('kn' + k, 4.0)
        place_foot(p, k, 'heel', IDLE_STANCE[k], 0.0, 4.0 * (1 if k == 'L' else -1))
    return p


def idle_params(t):
    """The Idle clip (t in [0,1) over 2 s), boots planted. idle_params(0.0) = the neutral standing pose that
    Jump/JumpLand start and end on (15 Nov: replaced the old unplanted idle, which slid the boots ~2.7 cm)."""
    ph = TAU * t
    p = dict(HANG)
    p.update({'hipZ': -0.012 + 0.004 * S(ph), 'hipX': 0.012 * S(ph), 'hipRoll': 0.8 * S(ph),
              'chest': 1.2 * S(ph), 'lean': 1.5, 'headYaw': 5 * S(ph), 'nod': 1.5 * S(2 * ph),
              'armL': 2 * S(ph), 'armR': 2 * S(ph + 0.6), 'elbL': 18 + 3 * S(ph), 'elbR': 18 + 3 * S(ph + 1)})
    return plant_idle_feet(p)


def carry_arms():
    """The solved two-hand grip on the bag (BagSocket at rest) — values printed by build_astronaut.py."""
    path = os.path.join(HERE, 'carry_arms.json')
    if os.path.exists(path):
        return json.load(open(path))
    raise RuntimeError('carry_arms.json missing (run extract_carry_arms.py)')


# ------------------------------------------------------------------ baking
def _ad():
    if rig.animation_data is None:
        rig.animation_data_create()
    return rig.animation_data


def apply_pose(prm, prev):
    pose = pose_from_params(prm)
    for n in ALL_BONES:
        pb = rig.pose.bones[n]
        qwld, offw = pose.get(n, (Quaternion(), None))
        q = q_local(n, qwld)
        if n in prev and prev[n].dot(q) < 0:
            q = -q
        prev[n] = q
        pb.rotation_quaternion = q
        pb.location = (REST[n].inverted() @ offw) if offw is not None else Vector()


def action_fcurves(act):
    """F-curves of a (slotted, Blender 4.4+) action."""
    try:
        from bpy_extras import anim_utils
        cb = anim_utils.action_get_channelbag_for_slot(act, act.slots[0])
        if cb is not None:
            return list(cb.fcurves)
    except Exception:
        pass
    return list(getattr(act, 'fcurves', []))


def _linear_keys(act):
    """A key on every frame, so interpolate LINEARLY like three.js does: Blender's default Bezier gives the first and
    last keys flat 'ease' handles, which bends the in-between values near a loop seam (found by the lope agent)."""
    n = 0
    for fc in action_fcurves(act):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
            n += 1
        fc.update()
    return n


def bake_clip(name, fn, nframes, loop, meta=None):
    """fn(t) -> params, t in [0, 1]. Frames 0..nframes (last = first for loops). Replaces an existing clip."""
    ad = _ad()
    for tr in list(ad.nla_tracks):
        if tr.name == name or any(s.action and s.action.name == name for s in tr.strips):
            ad.nla_tracks.remove(tr)
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    for pb in rig.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ad.action = act
    prev = {}
    for f in range(nframes + 1):
        t = f / nframes
        apply_pose(fn(0.0 if (loop and f == nframes) else t), prev)
        for n in ALL_BONES:
            pb = rig.pose.bones[n]
            pb.keyframe_insert('rotation_quaternion', frame=f, group=n)
            if n in ('Hips', 'BagSocket'):
                pb.keyframe_insert('location', frame=f, group=n)
    _linear_keys(act)
    act.frame_range = (0, nframes)
    act.use_frame_range = True
    act.use_cyclic = bool(loop)
    for k2, v in (meta or {}).items():
        act[k2] = v
    tr = ad.nla_tracks.new()
    tr.name = name
    st = tr.strips.new(name, 0, act)
    st.name = name
    tr.mute = True
    ad.action = None
    for pb in rig.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    log('baked', name, nframes, 'frames', round(nframes / FPS, 3), 's', 'loop' if loop else 'once', meta or '')
    return act


def order_nla(names):
    """Re-create NLA tracks in this order (glTF export order = clip order in the file)."""
    ad = _ad()
    acts = {}
    for tr in list(ad.nla_tracks):
        for s in tr.strips:
            if s.action:
                acts[s.action.name] = s.action
        ad.nla_tracks.remove(tr)
    for a in bpy.data.actions:
        acts.setdefault(a.name, a)
    for n in names + sorted(set(acts) - set(names)):
        if n not in acts:
            continue
        tr = ad.nla_tracks.new()
        tr.name = n
        st = tr.strips.new(n, 0, acts[n])
        st.name = n
        tr.mute = True


# ------------------------------------------------------------------ measuring (on the skinned mesh)
_boot = None


def _boot_verts():
    global _boot
    if _boot is None:
        groups = {g.index: g.name for g in body.vertex_groups}
        _boot = {'L': [], 'R': []}
        for v in body.data.vertices:
            for g in v.groups:
                n = groups.get(g.group, '')
                if g.weight > 0.3 and n in ('LeftFoot', 'LeftToeBase'):
                    _boot['L'].append(v.index)
                    break
                if g.weight > 0.3 and n in ('RightFoot', 'RightToeBase'):
                    _boot['R'].append(v.index)
                    break
    return _boot


def _set_action(name):
    ad = _ad()
    for tr in ad.nla_tracks:
        tr.mute = True
    act = bpy.data.actions[name]
    ad.action = act
    ad.action_slot = act.slots[0]
    return act


def sample_mesh(frame, contact_tol=0.012):
    sc = bpy.context.scene
    sc.frame_set(int(math.floor(frame)), subframe=frame - math.floor(frame))
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg)
    me = ev.to_mesh()
    res = {}
    bv = _boot_verts()
    for k in 'LR':
        pts = [me.vertices[i].co.copy() for i in bv[k]]
        zmin = min(q.z for q in pts)
        low = [q for q in pts if q.z < zmin + 0.02]
        res[k] = {'zmin': zmin, 'x': sum(q.x for q in low) / len(low), 'y': sum(q.y for q in low) / len(low),
                  'ymin': min(q.y for q in pts), 'ymax': max(q.y for q in pts),
                  'touch': {i: (q.x, q.y, q.z) for i, q in zip(bv[k], pts) if q.z < contact_tol}}
    res['mesh_zmin'] = min(v.co.z for v in me.vertices)
    ev.to_mesh_clear()
    pb = rig.pose.bones
    res['hips'] = tuple(pb['Hips'].head)
    res['head'] = tuple(pb['Head'].tail)
    return res


def measure(name, speed=0.0, step=0.5, contact_tol=0.012, verbose=True):
    """Judge a clip as the game plays it (character moving at `speed` m/s along -Y, clip in place).
    Returns a dict; prints a short report. Pass = sink > -1 cm, planted slide < 2 cm, hips accel >= -g_moon."""
    act = _set_action(name)
    f0, f1 = act.frame_range
    fr = []
    f = f0
    while f <= f1 + 1e-6:
        r = sample_mesh(f, contact_tol)
        r['f'] = f
        r['t'] = (f - f0) / FPS
        fr.append(r)
        f += step
    _ad().action = None
    out = {'name': name, 'speed': speed, 'dur': (f1 - f0) / FPS}
    out['sink'] = min(min(x['L']['zmin'], x['R']['zmin']) for x in fr)
    out['mesh_zmin'] = min(x['mesh_zmin'] for x in fr)
    # planted slide, per boot vertex: while a vertex stays on the ground (z < contact_tol) its WORLD position
    # (clip y - speed * t; forward is -Y) must not move. Rolling heel -> toe is fine, sliding is not.
    slide = {}
    duty = {}
    for k in 'LR':
        duty[k] = sum(1 for x in fr if x[k]['zmin'] < contact_tol) / len(fr)
        start = {}
        worst = 0.0
        for x in fr:
            now = {i: (q[0], q[1] - speed * x['t']) for i, q in x[k]['touch'].items()}
            for i in list(start):
                if i not in now:
                    del start[i]
            for i, q in now.items():
                if i in start:
                    d = math.hypot(q[0] - start[i][0], q[1] - start[i][1])
                    worst = max(worst, d)
                else:
                    start[i] = q
        slide[k] = worst
    out['slide'] = slide
    out['duty'] = duty
    hz = [x['hips'][2] for x in fr]
    dt = step / FPS
    acc = [(hz[i + 1] - 2 * hz[i] + hz[i - 1]) / (dt * dt) for i in range(1, len(hz) - 1)]
    # smooth the 2nd difference a little (3-tap) so frame quantisation does not dominate
    acc_s = [(acc[i - 1] + 2 * acc[i] + acc[i + 1]) / 4 for i in range(1, len(acc) - 1)] or acc
    out['hips_z'] = (min(hz), max(hz))
    out['hips_acc'] = (min(acc_s), max(acc_s)) if acc_s else (0, 0)
    # flight: both boots above contact
    fl = [x['t'] for x in fr if x['L']['zmin'] >= contact_tol and x['R']['zmin'] >= contact_tol]
    out['flight_s'] = len(fl) * dt
    out['frames'] = fr
    if verbose:
        log('MEASURE %-10s %.2fs @ %.2f m/s | sink %+.3f m | slide L %.3f R %.3f m | duty L %.2f R %.2f | '
            'hips z %.3f..%.3f | hips acc %+.2f..%+.2f m/s2 (moon -%.2f) | flight %.2fs'
            % (name, out['dur'], speed, out['sink'], slide['L'], slide['R'], duty['L'], duty['R'],
               out['hips_z'][0], out['hips_z'][1], out['hips_acc'][0], out['hips_acc'][1], G_MOON,
               out['flight_s']))
    return out


# ------------------------------------------------------------------ export
def export_glb(path, draco=False):
    ad = _ad()
    for t2 in ad.nla_tracks:
        t2.mute = False
    ad.action = None
    for pb in rig.pose.bones:
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector()
    bpy.ops.object.mode_set(mode='OBJECT') if bpy.context.object and bpy.context.object.mode != 'OBJECT' else None
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = rig
    want = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=False,
                export_yup=True, export_texcoords=True, export_normals=True, export_tangents=False,
                export_materials='EXPORT', export_image_format='JPEG', export_jpeg_quality=88,
                export_cameras=False, export_lights=False, export_extras=False,
                export_skins=True, export_all_influences=False, export_def_bones=False,
                export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
                export_frame_range=False, export_anim_slide_to_zero=True, export_optimize_animation_size=True,
                export_reset_pose_bones=True, export_rest_position_armature=True,
                export_anim_single_armature=True, export_morph=False,
                export_draco_mesh_compression_enable=bool(draco))
    if draco:
        want.update(export_draco_mesh_compression_level=6, export_draco_position_quantization=14,
                    export_draco_normal_quantization=10, export_draco_texcoord_quantization=12)
    props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    kw = {k: v for k, v in want.items() if k in props}
    bpy.ops.export_scene.gltf(**kw)
    for t2 in ad.nla_tracks:
        t2.mute = True
    log('exported', path, os.path.getsize(path), 'bytes', 'draco' if draco else 'raw')


# ------------------------------------------------------------------ contact sheet (Cycles CPU)
def _floor_and_light():
    sc = bpy.context.scene
    if 'SheetFloor' not in bpy.data.objects:
        me = bpy.data.meshes.new('SheetFloor')
        s = 6.0
        me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
        ob = bpy.data.objects.new('SheetFloor', me)
        sc.collection.objects.link(ob)
        mat = bpy.data.materials.new('SheetFloorMat')
        mat.use_nodes = True
        nt = mat.node_tree
        bsdf = nt.nodes.get('Principled BSDF')
        tc = nt.nodes.new('ShaderNodeTexCoord')
        ck = nt.nodes.new('ShaderNodeTexChecker')
        ck.inputs['Scale'].default_value = 1.0
        ck.inputs['Color1'].default_value = (0.55, 0.55, 0.55, 1)
        ck.inputs['Color2'].default_value = (0.35, 0.35, 0.35, 1)
        mp = nt.nodes.new('ShaderNodeMapping')
        mp.inputs['Scale'].default_value = (5.0, 5.0, 5.0)   # 10 cm squares
        nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
        nt.links.new(mp.outputs['Vector'], ck.inputs['Vector'])
        nt.links.new(ck.outputs['Color'], bsdf.inputs['Base Color'])
        bsdf.inputs['Roughness'].default_value = 0.9
        me.materials.append(mat)
    if 'SheetSun' not in bpy.data.objects:
        ld = bpy.data.lights.new('SheetSun', 'SUN')
        ld.energy = 3.5
        ld.angle = math.radians(3)
        ob = bpy.data.objects.new('SheetSun', ld)
        ob.rotation_euler = (math.radians(50), math.radians(-25), math.radians(35))
        sc.collection.objects.link(ob)
    w = sc.world or bpy.data.worlds.new('SheetWorld')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (0.05, 0.05, 0.06, 1)
        bg.inputs['Strength'].default_value = 1.0


def contact_sheet(rows, out_png, tile=(260, 360), samples=24, view='side', ortho=2.3):
    """rows: list of (clip_name, speed, [frames]). Side view from the character's left (+X), ortho camera that
    stays still while the character is moved forward by speed * t, so a planted boot stays on the same floor
    squares across the tiles of a row. Writes one PNG grid."""
    import numpy as np
    sc = bpy.context.scene
    _floor_and_light()
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    try:
        sc.cycles.use_denoising = True
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = tile
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    cam = bpy.data.objects.get('SheetCam')
    if cam is None:
        cd = bpy.data.cameras.new('SheetCam')
        cam = bpy.data.objects.new('SheetCam', cd)
        sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = ortho
    sc.camera = cam
    tmp = os.path.join(bpy.app.tempdir or '/tmp', 'sheet_tiles')
    os.makedirs(tmp, exist_ok=True)
    ncol = max(len(r[2]) for r in rows)
    W, H = tile
    big = np.zeros((H * len(rows), W * ncol, 4), np.float32)
    ad = _ad()
    rig_loc0 = rig.location.copy()
    for ri, (name, speed, frames) in enumerate(rows):
        act = _set_action(name)
        f0 = act.frame_range[0]
        tmid = (frames[0] + frames[-1]) / 2 / FPS
        for ci, f in enumerate(frames):
            t = (f - f0) / FPS
            rig.location = rig_loc0 + Vector((0, -speed * t, 0))
            yc = -speed * tmid
            if view == 'side':   # from the character's left, 12 deg above so the 10 cm floor squares show
                cam.location = (4.0, yc, 0.95 + 4.0 * math.tan(math.radians(12)))
                cam.rotation_euler = (math.radians(78), 0, math.radians(90))
            else:   # 3/4 front
                cam.location = (2.6, yc - 3.2, 0.95 + 4.12 * math.tan(math.radians(12)))
                cam.rotation_euler = (math.radians(78), 0, math.radians(39))
            sc.frame_set(int(f))
            fp = os.path.join(tmp, '%s_%03d.png' % (name, int(f)))
            sc.render.filepath = fp
            bpy.ops.render.render(write_still=True)
            im = bpy.data.images.load(fp)
            px = np.array(im.pixels[:], np.float32).reshape(H, W, 4)
            bpy.data.images.remove(im)
            r0 = (len(rows) - 1 - ri) * H     # image rows are bottom-up
            big[r0:r0 + H, ci * W:(ci + 1) * W] = px
    rig.location = rig_loc0
    ad.action = None
    out = bpy.data.images.new('sheet', W * ncol, H * len(rows), alpha=True)
    out.pixels = big.ravel()
    out.filepath_raw = out_png
    out.file_format = 'PNG'
    out.save()
    log('sheet', out_png, '%dx%d' % (W * ncol, H * len(rows)))
