"""Cycles CPU renders for the lab interior. Executed at the end of build_lab.py (`-- render`), shares its globals.
Optional extra args after `render`: names of the shots to render (cutaway inside_eye door_closed door_open)."""
import bpy, math, os
from mathutils import Vector

RD = os.path.join(HERE, 'renders')
os.makedirs(RD, exist_ok=True)
SHOTS = [a for a in ARGS if a in ('cutaway', 'inside_eye', 'door_closed', 'door_open')] or \
    ['cutaway', 'inside_eye', 'door_closed', 'door_open']

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 32
sc.cycles.use_denoising = True
try:
    sc.cycles.denoiser = 'OPENIMAGEDENOISE'
except Exception:
    pass
sc.render.resolution_x, sc.render.resolution_y = 960, 540
sc.render.resolution_percentage = 100
sc.view_settings.view_transform = 'AgX'
sc.cycles.max_bounces = 6

world = bpy.data.worlds.new('moon')
sc.world = world
try:
    world.use_nodes = True
except Exception:
    pass
bg = world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.02, 0.022, 0.03, 1)
bg.inputs['Strength'].default_value = 1.0

# the ASTRA hatch cut the game must do (HANDOFF.md): faces of the shell with every vertex in the box
CUT = dict(x0=-2.05, x1=-1.84, r=0.47)


def cut_shell():
    import bmesh
    for o in SHELL:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        kill = []
        for f in bm.faces:
            ok = True
            for v in f.verts:
                w = o.matrix_world @ v.co
                x, y3, z3 = w.x, w.z, -w.y
                if not (CUT['x0'] <= x <= CUT['x1'] and math.hypot(y3 - HY, z3) <= CUT['r']):
                    ok = False
                    break
            if ok:
                kill.append(f)
        if kill:
            bmesh.ops.delete(bm, geom=kill, context='FACES')
            bm.to_mesh(o.data)
            print('CUT', o.name, len(kill), 'faces')
        bm.free()


def look(cam, eye3, at3):
    e, a = T(eye3), T(at3)
    cam.location = e
    cam.rotation_euler = (a - e).to_track_quat('-Z', 'Y').to_euler()


cam_data = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_data)
sc.collection.objects.link(cam)
sc.camera = cam

sun_d = bpy.data.lights.new('sun', 'SUN')
sun_d.energy = 3.5
sun_d.angle = math.radians(1)
sun = bpy.data.objects.new('sun', sun_d)
sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(55), 0, math.radians(-130))

fill_d = bpy.data.lights.new('fill', 'POINT')
fill_d.energy = 25
fill_d.shadow_soft_size = 0.4
fill = bpy.data.objects.new('fill', fill_d)
sc.collection.objects.link(fill)
fill.location = T((0.0, 2.0, 0.0))


def set_hidden(objs, hidden):
    for o in objs:
        o.hide_render = hidden


def shoot(name):
    sc.render.filepath = os.path.join(RD, name + '.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', sc.render.filepath)


walls_cut = [bpy.data.objects[n] for n in ('lab_wall_S', 'lab_wall_top', 'lab_lights_S', 'lab_light_housings_S', 'lab_rails_S')]

if 'cutaway' in SHOTS:
    set_hidden(SHELL, True)
    set_hidden(walls_cut, True)
    sc.frame_set(1)
    cam_data.lens = 26
    look(cam, (1.25, 3.25, 2.55), (0.1, 1.15, -0.25))
    sun.hide_render = False
    shoot('cutaway')
    set_hidden(walls_cut, False)
    set_hidden(SHELL, False)

if 'inside_eye' in SHOTS:
    sc.frame_set(1)
    sun.hide_render = True
    cam_data.lens = 14
    look(cam, (-1.30, 1.95, 0.05), (1.6, 1.40, 0.0))
    shoot('inside_eye')
    sun.hide_render = False

if 'door_closed' in SHOTS or 'door_open' in SHOTS:
    cam_data.lens = 30
    look(cam, (-4.6, 2.1, 1.9), (-1.9, 1.25, 0.0))
    sun.rotation_euler = (T((-1.9, 1.25, 0.0)) - T((-4.0, 4.5, 3.0))).to_track_quat('-Z', 'Y').to_euler()
    if 'door_closed' in SHOTS:
        sc.frame_set(1)
        shoot('door_closed')
    if 'door_open' in SHOTS:
        cut_shell()
        sc.frame_set(30)
        shoot('door_open')
        sc.frame_set(1)
