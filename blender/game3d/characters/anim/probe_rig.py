import bpy
from mathutils import Vector
rig = bpy.data.objects['AstronautRig']; body = bpy.data.objects['Astronaut']
print('PROBE rig mw', [list(r) for r in rig.matrix_world], 'body parent', body.parent and body.parent.name, 'mods', [(m.type, getattr(m,'object',None) and m.object.name) for m in body.modifiers])
print('PROBE body mw ident', body.matrix_world == rig.matrix_world)
for b in rig.data.bones:
    print('PROBE bone', b.name, 'parent', b.parent and b.parent.name, 'head', tuple(round(x,4) for x in b.head_local), 'tail', tuple(round(x,4) for x in b.tail_local), 'conn', b.use_connect, 'deform', b.use_deform)
print('PROBE actions', [(a.name, tuple(a.frame_range), len(a.slots), a.use_fake_user) for a in bpy.data.actions])
ad = rig.animation_data
print('PROBE nla', [(t.name, [s.action.name for s in t.strips], t.mute) for t in ad.nla_tracks], 'active', ad.action)
print('PROBE fps', bpy.context.scene.render.fps, 'objects', [(o.name, o.type) for o in bpy.data.objects])
groups = {g.index: g.name for g in body.vertex_groups}
for side in ('Left',):
    pts = {'Foot': [], 'ToeBase': []}
    for v in body.data.vertices:
        for g in v.groups:
            n = groups.get(g.group, '')
            if g.weight > 0.3 and n in (side+'Foot', side+'ToeBase'):
                pts[n[len(side):]].append(body.matrix_world @ v.co); break
    allp = pts['Foot'] + pts['ToeBase']
    zmin = min(p.z for p in allp)
    print('PROBE', side, 'boot verts', len(pts['Foot']), len(pts['ToeBase']), 'zmin', round(zmin,4))
    for k, P in pts.items():
        lo = [p for p in P if p.z < zmin + 0.015]
        if lo:
            print('PROBE', k, 'sole patch n', len(lo), 'y range', round(min(p.y for p in lo),4), round(max(p.y for p in lo),4), 'x range', round(min(p.x for p in lo),4), round(max(p.x for p in lo),4))
        print('PROBE', k, 'y range all', round(min(p.y for p in P),4), round(max(p.y for p in P),4), 'z range', round(min(p.z for p in P),4), round(max(p.z for p in P),4))
    # sole profile: lowest z per 2cm y bin
    bins = {}
    for p in allp:
        k = round(p.y / 0.02)
        bins[k] = min(bins.get(k, 9), p.z)
    print('PROBE sole profile y->zmin', [(round(k*0.02,2), round(z,3)) for k, z in sorted(bins.items())])
print('PROBE mesh zmin', min((body.matrix_world @ v.co).z for v in body.data.vertices))
