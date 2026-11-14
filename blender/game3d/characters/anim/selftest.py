import bpy, sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lunar_rig as L
from mathutils import Vector
L.log('thigh', round(L.THIGH, 4), 'shin', round(L.SHIN, 4), 'sole', {k: {n: tuple(round(c, 3) for c in v) for n, v in s.items()} for k, s in L.SOLE.items()})
# IK: rest standing -> boots exactly where they are at rest
p = {}
for k in 'LR':
    s = L.SOLE[k]
    miss = L.place_foot(p, k, 'heel', s['heel'], 0.0)
    L.log('rest IK', k, 'miss', round(miss, 6), {kk: round(v, 3) for kk, v in p.items() if not kk.startswith('qFt')})
# crouch 10 cm, boot flat
p = {'hipZ': -0.10}
for k in 'LR':
    L.place_foot(p, k, 'heel', L.SOLE[k]['heel'], 0.0)
    L.log('crouch', k, {kk: round(p[kk + k], 2) for kk in ('th', 'legOut', 'kn')}, 'pts', {n: tuple(round(c, 3) for c in v) for n, v in L.boot_points(p, k).items()})
# heel-off 30 deg about the ball
p = {'hipZ': -0.06}
miss = L.place_foot(p, 'L', 'ball', L.SOLE['L']['ball'] + Vector((0, 0.15, 0)), 30.0)
L.log('heel-off miss', round(miss, 5), 'pts', {n: tuple(round(c, 3) for c in v) for n, v in L.boot_points(p, 'L').items()})
# measure the OLD clips (known: walk toes sink ~14 cm, slide ~13 cm)
t0 = time.time()
L.measure('Walk', 0.92)
L.measure('Idle', 0.0)
L.log('measure time', round(time.time() - t0, 1), 's')
t0 = time.time()
L.contact_sheet([('Walk', 0.92, [0, 9, 18, 27])], os.path.join(bpy.app.tempdir, 'selftest_sheet.png'), samples=8)
L.log('sheet time', round(time.time() - t0, 1), 's', bpy.app.tempdir)
