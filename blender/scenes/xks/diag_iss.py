# Diagnostic: per-material stats + false-colour renders of the NASA ISS model
import bpy, bmesh, os, sys, colorsys, math
from mathutils import Vector
ROOT = "/Users/davronoff/dev/oy-karvonsaroyi-3d"
OUT = os.environ.get("DIAG_OUT", "/tmp")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ROOT + "/source/models/iss.glb")
sc = bpy.context.scene
for a in bpy.data.actions:
    print("ACTION", a.name, "range", tuple(a.frame_range))
    try:
        for layer in a.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    for fc in cb.fcurves:
                        vals = [k.co[1] for k in fc.keyframe_points]
                        print("   ", fc.data_path, fc.array_index, "n=", len(vals), "min/max", round(min(vals),3), round(max(vals),3))
    except Exception as e:
        print("  fcurve read err", e)
sc.frame_set(1)
stats = {}
for o in bpy.data.objects:
    if o.type != 'MESH': continue
    me = o.data
    mw = o.matrix_world
    for p in me.polygons:
        m = o.material_slots[p.material_index].material.name if o.material_slots else None
        s = stats.setdefault(m, {"n":0, "area":0.0, "min":Vector((1e9,)*3), "max":Vector((-1e9,)*3), "objs":set()})
        s["n"] += 1; s["area"] += p.area; s["objs"].add(o.name)
        c = mw @ p.center
        s["min"] = Vector(map(min, s["min"], c)); s["max"] = Vector(map(max, s["max"], c))
mats = sorted(stats.keys())
for i, m in enumerate(mats):
    s = stats[m]
    print(f"MATSTAT {i:2d} {m:24s} faces={s['n']:6d} area={s['area']:8.1f} min={tuple(round(x,1) for x in s['min'])} max={tuple(round(x,1) for x in s['max'])} objs={sorted(s['objs'])}")
# false colours
for i, m in enumerate(mats):
    mat = bpy.data.materials[m]
    nt = mat.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); em = nt.nodes.new("ShaderNodeEmission")
    r, g, b = colorsys.hsv_to_rgb((i * 0.618) % 1.0, 0.9, 1.0)
    em.inputs[0].default_value = (r, g, b, 1)
    nt.links.new(em.outputs[0], out.inputs[0])
    print("COLOR", i, m, (round(r,2), round(g,2), round(b,2)))
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 4
sc.render.threads_mode = 'FIXED'; sc.render.threads = 2
sc.render.resolution_x = 960; sc.render.resolution_y = 540
w = bpy.data.worlds.new("w"); w.color = (0.02, 0.02, 0.02); sc.world = w
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'
center = Vector((0, 0, 11)); cam.data.ortho_scale = 52
views = {"top": Vector((0, 0, 1)), "side": Vector((1, 0, 0)), "front": Vector((0, 1, 0)), "persp": Vector((1, 0.8, 0.7))}
for name, d in views.items():
    cam.location = center + d.normalized() * 120
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Z' if name != "top" else 'Y').to_euler()
    sc.render.filepath = f"{OUT}/diag_iss_{name}.png"
    bpy.ops.render.render(write_still=True)
