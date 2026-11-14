# Diagnostic: dump packed textures and quick turntable-ish previews of the small models
import bpy, os, math
from mathutils import Vector
ROOT = "/Users/davronoff/dev/oy-karvonsaroyi-3d"
OUT = os.environ.get("DIAG_OUT", "/tmp")
for n in ["emu", "astronaut", "robonaut-2", "crew-lock-bag", "oru", "helmet", "solar-wing", "earth-globe"]:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f"{ROOT}/source/models/{n}.glb")
    sc = bpy.context.scene
    for im in bpy.data.images:
        if im.size[0] == 0: continue
        im2 = im.copy(); im2.scale(min(512, im.size[0]), min(512, im.size[1]))
        im2.filepath_raw = f"{OUT}/tex_{n}_{im.name.replace('.','_')}.png"; im2.file_format = 'PNG'; im2.save()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn = Vector((1e9,)*3); mx = Vector((-1e9,)*3)
    for o in meshes:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c); mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    ctr = (mn + mx) / 2; rad = (mx - mn).length / 2
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 8; sc.cycles.device = 'CPU'
    sc.render.threads_mode = 'FIXED'; sc.render.threads = 2
    sc.render.resolution_x = 900; sc.render.resolution_y = 450
    w = bpy.data.worlds.new("w"); w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.55, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    sc.world = w
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = rad * 2.2 * 2
    # front (-Y) view on left half? do two renders: front (-Y) and side (+X)
    for vn, d in {"front": Vector((0, -1, 0.15)), "side": Vector((1, 0, 0.15))}.items():
        cam.location = ctr + d.normalized() * rad * 4
        cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.clip_end = rad * 10
        sc.render.filepath = f"{OUT}/view_{n}_{vn}.png"
        bpy.ops.render.render(write_still=True)
