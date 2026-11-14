"""Fresh-run check of game3d/characters/astronaut.glb (re-import in a new Blender session).

  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
      -P game3d/characters/verify_astronaut.py -- [--renders]

Prints: bone count + names, clip names + lengths (s), triangle count, size (m), texture sizes,
and a logo check (coloured pixels where the flags / NASA logo / patch were painted over -> CLEAN).
--renders: Cycles CPU 16 sample renders of poses -> _work/verify_<clip>_<frame>_<az>.png
   options: Clip:frame ... (frames at 24 fps after import), --az=<deg> (repeatable), --res=<px height>,
            --dist=<m>;  --dump-tex: save the embedded textures to _work/tex_*.png
"""
import bpy, sys, os, math
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.join(HERE, 'astronaut.glb')
WORK = os.path.join(HERE, '_work')
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=GLB, bone_heuristic='BLENDER')
sc = bpy.context.scene
fps = sc.render.fps / sc.render.fps_base
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
# the glTF importer adds an 'Icosphere' bone-shape helper that is NOT in the file: skip it
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and o.find_armature() is not None]
print('VERIFY bones', len(rig.data.bones), [b.name for b in rig.data.bones])
print('VERIFY deform bones', sum(1 for b in rig.data.bones if b.use_deform))
tris = 0
for m in meshes:
    m.data.calc_loop_triangles()
    tris += len(m.data.loop_triangles)
    print('VERIFY mesh', m.name, 'tris', len(m.data.loop_triangles), 'groups', len(m.vertex_groups),
          'mods', [x.type for x in m.modifiers])
print('VERIFY tris total', tris)
dg = bpy.context.evaluated_depsgraph_get()
pts = []
for m in meshes:
    pts += [m.matrix_world @ v.co for v in m.data.vertices]
mn = Vector([min(p[i] for p in pts) for i in range(3)])
mx = Vector([max(p[i] for p in pts) for i in range(3)])
print('VERIFY bbox min', tuple(round(v, 3) for v in mn), 'max', tuple(round(v, 3) for v in mx))
print('VERIFY height %.3f m, feet centre x=%.3f y=%.3f' % (mx.z - mn.z, (mn.x + mx.x) / 2, (mn.y + mx.y) / 2))
for im in bpy.data.images:
    if '--dump-tex' in ARGS and im.size[0] > 0:
        im.filepath_raw = os.path.join(WORK, 'tex_' + im.name + '.png'); im.file_format = 'PNG'; im.save()
for im in bpy.data.images:
    print('VERIFY image', im.name, tuple(im.size))
# logo check: the 4 painted-over places (flags / NASA meatball / patch) must be plain white fabric.
# Flags and logos are strongly coloured (red/blue); clean fabric has very low saturation.
LOGO_RECTS = [(878, 22, 960, 85), (890, 182, 955, 238), (792, 382, 865, 443), (800, 712, 858, 763)]
for im in bpy.data.images:
    if im.size[0] != 1024:
        continue
    import numpy as np
    px = np.empty(im.size[0] * im.size[1] * 4, np.float32)
    im.pixels.foreach_get(px)
    t = px.reshape(im.size[1], im.size[0], 4)[::-1, :, :3]   # top-left origin
    worst = 0.0
    for x0, y0, x1, y1 in LOGO_RECTS:
        r = t[y0:y1, x0:x1]
        sat = (r.max(2) - r.min(2)) / np.maximum(r.max(2), 1e-4)
        worst = max(worst, float((sat > 0.35).mean()))
    print('VERIFY logo check %s: coloured pixel share in logo rects %.4f -> %s'
          % (im.name, worst, 'CLEAN' if worst < 0.01 else 'LOGOS STILL THERE'))
for a in bpy.data.actions:
    fr = a.frame_range
    print('VERIFY clip %-6s frames %.0f-%.0f  length %.3f s' % (a.name, fr[0], fr[1], (fr[1] - fr[0]) / fps))
# facing: the visor (visor material) must be on the -Y side in Blender (= +Z in glTF)
for m in meshes:
    for i, mat in enumerate(m.data.materials):
        if mat and 'Visor' in mat.name:
            vs = [m.matrix_world @ m.data.vertices[v].co for p in m.data.polygons if p.material_index == i
                  for v in p.vertices]
            c = sum(vs, Vector()) / len(vs)
            print('VERIFY visor centre', tuple(round(x, 3) for x in c), '-> faces', '-Y (glTF +Z) OK' if c.y < 0 else '+Y WRONG')

if '--renders' in ARGS:
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 16
    sc.render.threads_mode = 'AUTO'
    res = int(next((a[6:] for a in ARGS if a.startswith('--res=')), 400))
    sc.render.resolution_x, sc.render.resolution_y = res * 3 // 4, res
    w = bpy.data.worlds.new('w')
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.18, 0.2, 0.25, 1)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sc.collection.objects.link(sun)
    sun.data.energy = 3.5
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    bpy.ops.mesh.primitive_plane_add(size=6)
    bpy.ops.mesh.primitive_cube_add(size=1)
    bag = bpy.context.active_object
    bag.scale = (0.42, 0.24, 0.30)
    bpy.ops.object.transform_apply(scale=True)
    mat = bpy.data.materials.new('bag')
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.15, 0.3, 0.8, 1)
    bag.data.materials.append(mat)
    # bag follows the BagSocket node exactly as a child with identity transform would in three.js
    sock_rest = rig.data.bones['BagSocket'].matrix_local.copy()
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    sc.collection.objects.link(cam)
    sc.camera = cam
    ad = rig.animation_data or rig.animation_data_create()
    for t in ad.nla_tracks:
        t.mute = True
    checks = [a for a in ARGS if ':' in a] or ['Idle:0', 'Walk:9', 'Walk:27', 'Run:4', 'Run:15',
                                                'Jump:5', 'Jump:9', 'Jump:20', 'Carry:10', 'Carry:31',
                                                'Pour:0', 'Pour:30']
    views = [int(a[5:]) for a in ARGS if a.startswith('--az=')] or [-35, 70]
    dist = float(next((a[7:] for a in ARGS if a.startswith('--dist=')), 4.0))
    out = []
    for ck in checks:
        clip, fr = ck.split(':')
        act = bpy.data.actions[clip]
        ad.action = act
        if hasattr(ad, 'action_slot') and act.slots:
            ad.action_slot = act.slots[0]
        bag.hide_render = clip not in ('Carry', 'Pour')
        sc.frame_set(int(fr))
        pbm = rig.matrix_world @ rig.pose.bones['BagSocket'].matrix
        bag.matrix_world = pbm @ sock_rest.inverted() @ Matrix.Translation(sock_rest.translation)
        for az in views:
            a = math.radians(az)
            cam.location = (dist * math.sin(a), -dist * math.cos(a), 1.2)
            cam.rotation_euler = (Vector((0, 0, 0.92)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
            f = os.path.join(WORK, 'verify_%s_%02d_%d.png' % (clip, int(fr), az))
            sc.render.filepath = f
            bpy.ops.render.render(write_still=True)
            out.append(f)
    print('VERIFY renders', len(out))
