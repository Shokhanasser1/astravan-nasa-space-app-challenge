# Skin weights for the AI-made kid astronaut (15 Nov): an armature with the game rig's 23 bone names, its joints
# fitted to the mesh (joints.json from scripts/models/astronaut_ai.mjs fit), Blender's automatic (bone heat) weights,
# exported with the skin. scripts/models/astronaut_ai.mjs assemble then moves the mesh and these weights onto the
# game's rig, so the game's 15 clips drive it.
#   Blender -b --factory-startup -P bind_ai.py -- mesh.glb joints.json out_skinned.glb [render.png]
import bpy, json, math, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
MESH, JOINTS, OUT = argv[0], argv[1], argv[2]
RENDER = argv[3] if len(argv) > 3 else None
J = json.load(open(JOINTS))  # {name: {pos: [x, y, z] glTF, parent: name | None}}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=MESH)
meshes = [o for o in scene.objects if o.type == 'MESH']
# one mesh object (join the parts: one skin)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
# the fit's scale and offset sit on a parent node: keep them in the vertices, free of any parent
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
if len(meshes) > 1:
    bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# bone heat needs one closed skin: weld the duplicate vertices along the generated mesh's seams (UVs are per corner)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0008)
bpy.ops.object.mode_set(mode='OBJECT')


def G(p):
    return Vector((p[0], -p[2], p[1]))


arm_data = bpy.data.armatures.new('AstronautRig')
arm = bpy.data.objects.new('AstronautRig', arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = {}
for name, j in J.items():
    b = arm_data.edit_bones.new(name)
    b.head = G(j['pos'])
    eb[name] = b
for name, j in J.items():
    b = eb[name]
    kids = [k for k, v in J.items() if v['parent'] == name and k != 'BagSocket']
    if kids:
        tail = sum((G(J[k]['pos']) for k in kids), Vector()) / len(kids)
    elif j['parent']:
        d = (b.head - G(J[j['parent']]['pos'])).normalized()
        tail = b.head + d * (0.18 if name == 'Head' else 0.08)
    else:
        tail = b.head + Vector((0, 0, 0.1))
    if (tail - b.head).length < 0.02:
        tail = b.head + Vector((0, 0, 0.05))
    b.tail = tail
    if j['parent']:
        b.parent = eb[j['parent']]
# the bag socket is not a body bone
arm_data.edit_bones['BagSocket'].use_deform = False
bpy.ops.object.mode_set(mode='OBJECT')

bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
# bone heat leaves loose pieces (a visor, a strap) without weights: those follow the nearest bone
from mathutils.geometry import intersect_point_line
mw = body.matrix_world
segs = [(b.name, arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local) for b in arm.data.bones if b.use_deform]
def nearest(co):
    best, bn = 1e9, None
    for name, h, t in segs:
        p, f = intersect_point_line(co, h, t)
        p = h if f < 0 else t if f > 1 else p
        d = (co - p).length
        if d < best:
            best, bn = d, name
    return bn
def near3(co):
    ds = []
    for name, h, t in segs:
        p, f = intersect_point_line(co, h, t)
        p = h if f < 0 else t if f > 1 else p
        ds.append(((co - p).length, name))
    ds.sort()
    w = [(n, 1.0 / (d + 0.015) ** 6) for d, n in ds[:3]]
    s_ = sum(x for _, x in w)
    return [(n, x / s_) for n, x in w]
fixed = 0
for v in body.data.vertices:
    if not any(g.weight > 1e-4 for g in v.groups):
        # smooth: the three nearest bones by distance (^6), so knees and elbows still bend softly
        for name, wt in near3(mw @ v.co):
            vg = body.vertex_groups.get(name) or body.vertex_groups.new(name=name)
            vg.add([v.index], wt, 'REPLACE')
        fixed += 1
groups = {vg.index: vg.name for vg in body.vertex_groups}
unweighted = sum(1 for v in body.data.vertices if not any(g.weight > 1e-4 for g in v.groups))
print('AI nearest-bone fallback for', fixed, 'vertices')
print('AI bound: vertices', len(body.data.vertices), 'groups', len(groups), 'unweighted', unweighted)

bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_skins=True, export_animations=False,
                          export_yup=True, export_apply=False)
print('AI exported', OUT)

if RENDER:
    # a quick look: rest pose and a bent pose (arms down, a knee up) to see the weights work
    w = bpy.data.worlds.new('w')
    scene.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.05, 0.055, 1)
    for e, rz, en in ((55, 30, 3.0), (30, 200, 1.2)):
        L = bpy.data.lights.new('l', 'SUN')
        L.energy = en
        lo = bpy.data.objects.new('l', L)
        scene.collection.objects.link(lo)
        lo.rotation_euler = (math.radians(e), 0, math.radians(rz))
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 24
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 520
    scene.render.resolution_y = 720
    cam = bpy.data.cameras.new('c')
    cam.lens = 55
    co = bpy.data.objects.new('c', cam)
    scene.collection.objects.link(co)
    scene.camera = co
    a = math.radians(30)
    co.location = (4.4 * math.sin(a), -4.4 * math.cos(a), 1.0)
    co.rotation_euler = (math.radians(89), 0, a)
    scene.render.filepath = RENDER.replace('.png', '_rest.png')
    bpy.ops.render.render(write_still=True)
    pb = arm.pose.bones
    for s, sign in (('Left', 1), ('Right', -1)):
        pb[f'{s}Arm'].rotation_mode = 'XYZ'
        pb[f'{s}Arm'].rotation_euler = (0, 0, sign * math.radians(-60))
    pb['LeftUpLeg'].rotation_mode = 'XYZ'
    pb['LeftUpLeg'].rotation_euler = (math.radians(-50), 0, 0)
    pb['LeftLeg'].rotation_mode = 'XYZ'
    pb['LeftLeg'].rotation_euler = (math.radians(70), 0, 0)
    bpy.context.view_layer.update()
    scene.render.filepath = RENDER.replace('.png', '_bent.png')
    bpy.ops.render.render(write_still=True)
    print('AI rendered')
