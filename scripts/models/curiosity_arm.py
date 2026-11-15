# Blender (background): cut NASA's Curiosity robotic arm out of the rover model into three movable parts and
# export them as one GLB (glTF axes: +Y up, the arm reaching along +Z; the shoulder pivot at the origin).
#   arm_upper   shoulder joint + upper arm        pivot: shoulder (rotates about X = lift)
#   arm_fore    elbow joint + forearm (child)     pivot: elbow    (rotates about X = bend)
#   arm_turret  wrist joint + tool turret (child) pivot: wrist    (rotates about X)
# Usage: blender -b --factory-startup --python scripts/models/curiosity_arm.py -- <in curiosity.glb> <out arm.glb> [preview.png]
# (curiosity.glb: the catalog model, blender/game3d/assets/curiosity.glb on origin/asilbek/work; out:
#  public/models/curiosity-arm/ after gltf-transform optimize --compress meshopt --texture-compress webp
#  --flatten false --join false --instance false --palette false --simplify false). Claude Code, Blender 5.3, 15 Nov 2026.
import bpy, bmesh, os, sys, math, json
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = argv[0], argv[1]
PREVIEW = argv[2] if len(argv) > 2 else None

# Blender axes of the imported rover (Z up, the rover's front towards -Y). Measured from orthographic renders.
X_AXIS = 0.45                       # the arm's mid-plane
SHOULDER = Vector((X_AXIS, -0.983, 0.843))
ELBOW = Vector((X_AXIS, -1.794, 0.840))
WRIST = Vector((X_AXIS, -1.794, 1.625))


def in_arm(c):
    if c.y < -0.95 and -0.85 < c.x < 0.85:
        return True
    # the shoulder joint housing reaches a little behind y = -0.95
    return c.y < -0.86 and 0.15 < c.x < 0.78 and 0.66 < c.z < 1.03


def part_of(c):
    if c.z >= 1.55 and c.y < -1.3:
        return 'arm_turret'
    if c.y < -1.70:
        return 'arm_fore'
    return 'arm_upper'


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH' or o.name.startswith('COL_'):
        bpy.data.objects.remove(o, do_unlink=True)
rover = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = rover
rover.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
rover.parent = None

stats = {}
objs = {}
for name in ('arm_upper', 'arm_fore', 'arm_turret'):
    me = rover.data.copy()
    me.name = name
    bm = bmesh.new()
    bm.from_mesh(me)
    kill = []
    for f in bm.faces:
        c = f.calc_center_median()
        if not (in_arm(c) and part_of(c) == name):
            kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    objs[name] = ob
    stats[name] = {'verts': len(me.vertices), 'faces': len(me.polygons)}
bpy.data.objects.remove(rover, do_unlink=True)

# pivots: move each part's origin to its joint, then chain them (world positions stay)
pivots = {'arm_upper': SHOULDER, 'arm_fore': ELBOW, 'arm_turret': WRIST}
for name, p in pivots.items():
    objs[name].data.transform(Matrix.Translation(-p))      # mesh around its own joint
# chain with plain offsets: shoulder at the origin, each child placed at its joint relative to the parent's joint
root = bpy.data.objects.new('curiosity_arm', None)
bpy.context.scene.collection.objects.link(root)
links = [('arm_upper', root, Vector((0, 0, 0))),
         ('arm_fore', objs['arm_upper'], ELBOW - SHOULDER),
         ('arm_turret', objs['arm_fore'], WRIST - ELBOW)]
for name, parent, offset in links:
    ob = objs[name]
    ob.parent = parent
    ob.matrix_parent_inverse = Matrix.Identity(4)
    ob.location = offset
bpy.context.view_layer.update()

# drop materials no face uses
for ob in objs.values():
    used = {p.material_index for p in ob.data.polygons}
    stats[ob.name]['materials'] = [ob.data.materials[i].name for i in sorted(used) if i < len(ob.data.materials)]

stats['elbow_local'] = list(objs['arm_fore'].location)
stats['wrist_local'] = list(objs['arm_turret'].location)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', use_selection=False, export_yup=True,
    export_apply=False, export_materials='EXPORT', export_image_format='WEBP',
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
    export_animations=False, export_extras=False)
stats['bytes'] = os.path.getsize(OUT)

if PREVIEW:
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x = sc.render.resolution_y = 700
    sc.world = bpy.data.worlds.new('w'); sc.world.color = (0.08, 0.09, 0.12)
    # pose test: lift the upper arm 35 deg, open the elbow 30 deg
    objs['arm_upper'].rotation_euler = (math.radians(35), 0, 0)
    objs['arm_fore'].rotation_euler = (math.radians(-30), 0, 0)
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = 2.6
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (5, -0.9, 0.6); cam.rotation_euler = (math.pi / 2, 0, math.pi / 2)
    sc.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)

print('RESULT ' + json.dumps(stats))
