"""Re-import an exported game asset in a fresh Blender, check it, render a 512 px preview.

  Blender -b --factory-startup -P game3d/assets/_build/verify_asset.py -- --model sev [--norender]

Writes game3d/assets/_work/verify_<id>.json, _work/prev/<id>.png and the texture images
(as PNG, for the brand/logo check) to _work/tex/<id>/.
"""
import bpy, sys, os, math, json
import numpy as np
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
WORK = os.path.join(ASSETS, '_work')


def tri_count(me):
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def world_pts(objs):
    pts = []
    for o in objs:
        n = len(o.data.vertices)
        if not n:
            continue
        co = np.empty(n * 3); o.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
        M = np.array(o.matrix_world)
        pts.append(co @ M[:3, :3].T + M[:3, 3])
    return np.concatenate(pts)


def main(mid, render=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path = os.path.join(ASSETS, mid + '.glb')
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    vis = [o for o in meshes if not o.name.startswith('COL_')]
    col = [o for o in meshes if o.name.startswith('COL_')]
    P = world_pts(vis)
    lo, hi = P.min(0), P.max(0)
    imgs = {}
    missing = []
    os.makedirs(os.path.join(WORK, 'tex', mid), exist_ok=True)
    for im in bpy.data.images:
        w, h = im.size
        if w == 0 or h == 0 or not im.has_data:
            missing.append(im.name)
            continue
        imgs[im.name] = [w, h]
        # dump a PNG copy for the logo check
        c = im.copy()
        c.filepath_raw = os.path.join(WORK, 'tex', mid, im.name.replace('/', '_').replace('.', '_') + '.png')
        c.file_format = 'PNG'
        try:
            c.save()
        except Exception as e:
            print('tex save failed', im.name, e)
        bpy.data.images.remove(c)
    mats_without = []
    for o in vis:
        for s in o.material_slots:
            if s.material is None:
                mats_without.append(o.name)
    colinfo = {}
    for o in col:
        colinfo[o.name] = dict(tris=tri_count(o.data), extras=dict((k, str(o.get(k))[:200]) for k in o.keys() if not k.startswith('_')),
                               has_material=any(s.material for s in o.material_slots))
    res = dict(id=mid, bytes=os.path.getsize(path), objects=[o.name for o in bpy.data.objects],
               tris=sum(tri_count(o.data) for o in vis),
               bbox_blender_min=[round(float(v), 4) for v in lo], bbox_blender_max=[round(float(v), 4) for v in hi],
               size_m_gltf_xyz=[round(float(hi[0] - lo[0]), 4), round(float(hi[2] - lo[2]), 4), round(float(hi[1] - lo[1]), 4)],
               images=imgs, missing_images=missing, slots_without_material=mats_without, colliders=colinfo,
               materials=sorted({s.material.name for o in vis for s in o.material_slots if s.material}))
    with open(os.path.join(WORK, f'verify_{mid}.json'), 'w') as f:
        json.dump(res, f, indent=1)
    print('VERIFY', json.dumps({k: res[k] for k in ('id', 'bytes', 'tris', 'size_m_gltf_xyz', 'missing_images')}))
    for o in col:
        o.hide_render = True
    if render:
        preview(mid, vis, P)


def preview(mid, vis, P):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 16
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 4
    sc.render.threads_mode = 'AUTO'
    sc.render.resolution_x = sc.render.resolution_y = 512
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    w = bpy.data.worlds.new('w'); w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.20, 0.22, 0.27, 1); bg.inputs[1].default_value = 0.7
    sc.world = w
    for name, rot, col, e in (('key', (50, 0, -40), (1.0, 0.88, 0.75), 4.0), ('fill', (65, 0, 60), (0.7, 0.82, 1.0), 1.3),
                              ('rim', (60, 0, 165), (0.9, 0.95, 1.0), 3.0)):
        d = bpy.data.lights.new(name, 'SUN'); d.color = col; d.energy = e; d.angle = math.radians(5)
        o = bpy.data.objects.new(name, d); o.rotation_euler = [math.radians(v) for v in rot]
        sc.collection.objects.link(o)
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    # front 3/4 view: front faces -Y (= glTF +Z); camera front-right, 22 deg up
    terrain = (P.max(0) - P.min(0))[2] < 0.25 * max((P.max(0) - P.min(0))[:2])
    az, el = math.radians(35), math.radians(45 if terrain else 22)
    fwd = Vector((-math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), -math.sin(el)))
    cam.rotation_euler = fwd.to_track_quat('-Z', 'Y').to_euler()
    R = np.array(cam.rotation_euler.to_matrix())
    right, up = R[:, 0], R[:, 1]
    Q = P[:: max(1, len(P) // 50000)]
    xs, ys = Q @ right, Q @ up
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    size = max(xs.max() - xs.min(), ys.max() - ys.min()) * 1.08
    cd.ortho_scale = size
    ext = float(np.linalg.norm(P.max(0) - P.min(0)))
    cd.clip_start = ext * 0.001; cd.clip_end = ext * 10
    c = right * cx + up * cy
    cam.location = Vector(c.tolist()) - fwd * ext * 3
    os.makedirs(os.path.join(WORK, 'prev'), exist_ok=True)
    sc.render.filepath = os.path.join(WORK, 'prev', mid + '.png')
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    mid = argv[argv.index('--model') + 1]
    try:
        main(mid, render='--norender' not in argv)
        print('VDONE', mid)
    except Exception:
        import traceback
        traceback.print_exc()
        print('VFAILED', mid)
        sys.exit(1)
