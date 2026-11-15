import bpy, sys, math
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.045, 0.045, 0.05, 1)
for e, rz, en in ((55, 30, 3.0), (30, 200, 1.2)):
    L = bpy.data.lights.new('l', 'SUN'); L.energy = en; lo = bpy.data.objects.new('l', L); sc.collection.objects.link(lo); lo.rotation_euler = (math.radians(e), 0, math.radians(rz))
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = True
sc.render.resolution_x = 460; sc.render.resolution_y = 640
cam = bpy.data.cameras.new('c'); cam.lens = 60; co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co
a = math.radians(40); co.location = (4.2 * math.sin(a), -4.2 * math.cos(a), 1.0); co.rotation_euler = (math.radians(89), 0, a)
for name, f in (('Idle', 10), ('Walk', 9), ('Run', 6), ('SeatedSteer', 10)):
    act = bpy.data.actions.get(name)
    if not act: print('no', name); continue
    arm.animation_data.action = act
    if hasattr(arm.animation_data, 'action_slot') and act.slots: arm.animation_data.action_slot = act.slots[0]
    sc.frame_set(f)
    sc.render.filepath = out.replace('.png', f'_{name}.png'); bpy.ops.render.render(write_still=True)
print('POSED')
