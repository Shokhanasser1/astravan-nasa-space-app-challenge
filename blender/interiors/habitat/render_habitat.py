"""Renders for the habitat interior (Cycles CPU; EEVEE/Metal is blocked in the sandbox).
Run after build_habitat.py:  Blender -b --factory-startup -P render_habitat.py [-- name1,name2]
"""
import bpy, math, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'renders')
os.makedirs(OUT, exist_ok=True)
only = sys.argv[sys.argv.index('--') + 1].split(',') if '--' in sys.argv else None
bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, 'habitat_interior.blend'))
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 32
sc.cycles.use_denoising = True
sc.cycles.max_bounces = 6
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 960, 540, 100
sc.render.image_settings.file_format = 'PNG'
try:
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
except Exception:
    pass

world = bpy.data.worlds.new('w')
sc.world = world
try:
    world.use_nodes = True
except Exception:
    pass
bg = world.node_tree.nodes.get('Background') or world.node_tree.nodes.new('ShaderNodeBackground')
bg.inputs[0].default_value = (0.012, 0.016, 0.03, 1)
bg.inputs[1].default_value = 1.0

COL = bpy.data.collections['habitat_interior']
REF = bpy.data.collections['REF_shell']
LIGHTS = bpy.data.collections.new('render_lights')
sc.collection.children.link(LIGHTS)


def light(name, kind, loc, energy, color=(1, 0.95, 0.88), size=0.5, rot=None):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    ld.color = color
    if kind in ('AREA',):
        ld.size = size
    if kind == 'POINT':
        ld.shadow_soft_size = size
    o = bpy.data.objects.new(name, ld)
    o.location = loc
    if rot:
        o.rotation_euler = rot
    LIGHTS.objects.link(o)
    return o


def P(b, r, z):
    a = math.radians(b)
    return (math.sin(a) * r, math.cos(a) * r, z)


# interior lights (stand-ins for the glow panels' light in the game)
for i in range(8):
    b = i * 45 + 22.5
    light(f'g{i}', 'POINT', P(b, 3.6, 2.75), 90, size=0.6)
    light(f'u{i}', 'POINT', P(b, 3.6, 5.6), 90, size=0.6)
light('shelter', 'POINT', (0, 0.5, 2.6), 70, size=0.5)
light('command', 'POINT', (0, 0.4, 5.55), 70, size=0.5)
light('airlock', 'POINT', (0, -3.9, 2.7), 60, size=0.4)
sun = light('sun', 'SUN', (0, -20, 20), 3.0, color=(1, 0.97, 0.92), rot=(math.radians(58), 0, math.radians(-28)))
sun.data.angle = math.radians(1.5)

# ground for outside shots
me = bpy.data.meshes.new('ground')
me.from_pydata([(-40, -40, -0.01), (40, -40, -0.01), (40, 40, -0.01), (-40, 40, -0.01)], [], [(0, 1, 2, 3)])
gm = bpy.data.materials.new('regolith')
try:
    gm.use_nodes = True
except Exception:
    pass
bs = next(n for n in gm.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
bs.inputs['Base Color'].default_value = (0.32, 0.31, 0.3, 1)
bs.inputs['Roughness'].default_value = 0.95
me.materials.append(gm)
ground = bpy.data.objects.new('ground', me)
LIGHTS.objects.link(ground)

# Do on the shell what HANDOFF asks the game to do: drop shell + band triangles in the hatch box.
# three box x [-0.64, 0.64], y [0.78, 2.56], z [4.80, 5.45]  ->  Blender x, Y = -z, Z = y
import bmesh
for o in REF.objects:
    mn = o.data.materials[0].name if o.data.materials else ''
    if not (mn.startswith('astra_e7e9ec') or mn.startswith('astra_c9ced6')):
        continue
    bm = bmesh.new()
    bm.from_mesh(o.data)
    kill = []
    for f in bm.faces:
        c = o.matrix_world @ f.calc_center_median()
        if -0.64 <= c.x <= 0.64 and -5.45 <= c.y <= -4.80 and 0.78 <= c.z <= 2.56:
            kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(o.data)
    bm.free()
    print('cut', o.name, len(kill), 'faces')

cam_d = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_d)
sc.collection.objects.link(cam)
sc.camera = cam


def aim(loc, target, lens):
    cam.location = Vector(loc)
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    cam_d.lens = lens
    cam_d.clip_start = 0.05


def show(shell=True, levels=('g', 'gL', 'm', 'u', 'uL', 'c'), outside=True, interior_lights=True):
    bg.inputs[0].default_value = (0.012, 0.016, 0.03, 1) if shell else (0.10, 0.12, 0.16, 1)
    for o in REF.objects:
        hide = not shell or o.name.startswith('habitat_0_') or o.name.startswith('habitat_1_')
        o.hide_render = hide
    REF.hide_render = not shell
    for o in COL.objects:
        lv = o.get('level')
        o.hide_render = bool(lv) and lv not in levels
    ground.hide_render = not outside
    sun.hide_render = not outside
    for o in LIGHTS.objects:
        if o.type == 'LIGHT' and o.data.type == 'POINT':
            o.hide_render = not interior_lights


def shot(name, frame=1):
    if only and name not in only:
        return
    sc.frame_set(frame)
    sc.render.filepath = os.path.join(OUT, name + '.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', name)


# 1. cutaway: shell + roof hidden, 3/4 view from front-left above (upper floor)
show(shell=False, levels=('g', 'm', 'u'), outside=False)
aim(P(215, 10.5, 13.0), (0, 0.3, 3.0), 30)
shot('cutaway')
# 1b. ground floor cutaway: upper floor, middle deck and roof hidden
show(shell=False, levels=('g',), outside=False)
aim(P(215, 10.0, 11.0), (0, 0.3, 0.6), 30)
shot('cutaway_ground')
# 2. eye height 1.65 m on the ground floor: inside the inner hatch, looking at the shelter door and the galley
show(shell=True, outside=False)
aim(P(196, 2.55, 0.5 + 1.65), P(258, 3.5, 1.25), 16)
shot('inside_eye')
# 2b. upper floor eye view: command room, from its doorway, over the ladder well to the desk and screens
aim((0.35, -1.62, 3.35 + 1.65), (0.0, 1.3, 3.35 + 0.9), 16)
shot('inside_eye_upper')
# 2c. inside a crew quarters: bunk under the window, desk, locker
aim(P(286, 3.25, 3.35 + 1.55), P(262, 4.3, 3.35 + 0.6), 16)
shot('inside_cq')
# 2d. airlock: standing in the open inner hatch, looking out through the open outer hatch (ground + sun on, so the
#     open hatch shows the lit porch and regolith instead of a black panel)
show(shell=True, outside=True)
aim((0.0, -3.05, 0.5 + 1.65), (0.0, -6.0, 1.2), 18)
shot('inside_airlock', frame=30)
# 3. door closed / open with the shell shown
show(shell=True, outside=True)
aim((1.6, -9.6, 2.1), (0, -5.0, 1.6), 30)
shot('door_closed', 1)
shot('door_open', 30)
