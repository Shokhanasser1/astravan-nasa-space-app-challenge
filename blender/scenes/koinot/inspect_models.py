# Inspection helper (not part of the final build): imports each koinot model,
# prints object/material info and renders quick 3/4 views + dumps textures.
# Usage: Blender -b --factory-startup -P inspect_models.py -- OUTDIR model1 model2 ...
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
MODELS = argv[1:]
SRC = "/Users/davronoff/dev/oy-karvonsaroyi-3d/source/models"


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def world_bbox(objs):
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for o in objs:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    return mn, mx


for name in MODELS:
    clear()
    sc = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + ".glb"))
    objs = list(sc.objects)
    bpy.context.view_layer.update()
    mn, mx = world_bbox(objs)
    print("=== MODEL", name, "bbox", tuple(round(v, 3) for v in mn), tuple(round(v, 3) for v in mx),
          "size", tuple(round(v, 3) for v in (mx - mn)))
    for o in objs:
        info = f"  OBJ {o.name} type={o.type} parent={o.parent.name if o.parent else None} loc={tuple(round(v,3) for v in o.location)} scale={tuple(round(v,4) for v in o.scale)} rot={tuple(round(math.degrees(v),1) for v in o.rotation_euler)}"
        if o.type == 'MESH':
            m = o.data
            info += f" verts={len(m.vertices)} polys={len(m.polygons)}"
            # per-material face count and bbox centre
            counts = {}
            for p in m.polygons:
                counts.setdefault(p.material_index, []).append(p)
            for mi, polys in counts.items():
                mat = o.material_slots[mi].material if mi < len(o.material_slots) else None
                cs = Vector((0, 0, 0))
                pmn = Vector((1e9,) * 3); pmx = Vector((-1e9,) * 3)
                for p in polys:
                    for vi in p.vertices:
                        w = o.matrix_world @ m.vertices[vi].co
                        pmn = Vector(map(min, pmn, w)); pmx = Vector(map(max, pmx, w))
                info += f"\n     mat[{mi}] {mat.name if mat else None}: {len(polys)} faces bbox {tuple(round(v,3) for v in pmn)}..{tuple(round(v,3) for v in pmx)}"
        print(info)
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            bc = bsdf.inputs['Base Color']
            col = tuple(round(v, 3) for v in bc.default_value)
            linked = bc.is_linked
            print(f"  MAT {mat.name}: base={col} linked={linked} metal={round(bsdf.inputs['Metallic'].default_value,2)} rough={round(bsdf.inputs['Roughness'].default_value,2)} alpha={round(bsdf.inputs['Alpha'].default_value,2)} blend={getattr(mat,'surface_render_method',None)}")
    # dump images
    for img in bpy.data.images:
        if img.size[0] == 0:
            continue
        safe = "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in img.name)
        p = os.path.join(OUT, f"{name}__{safe}.png")
        try:
            img2 = img.copy()
            img2.filepath_raw = p
            img2.file_format = 'PNG'
            img2.save()
        except Exception as e:
            print("  img save fail", img.name, e)

    # quick render: camera on 3/4 view
    ctr = (mn + mx) / 2
    size = (mx - mn).length
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.lens = 50
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", 'SUN'))
    sun.data.energy = 4
    sun.rotation_euler = (math.radians(50), 0, math.radians(30))
    sc.collection.objects.link(sun)
    world = bpy.data.worlds.new("w"); sc.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.25, 0.25, 0.28, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 12
    sc.cycles.use_denoising = True
    sc.render.threads_mode = 'FIXED'; sc.render.threads = 2
    sc.render.resolution_x = 640; sc.render.resolution_y = 480
    views = {"a": (1, -1, 0.6), "b": (-1, 1, 0.4), "top": (0.01, 0.01, 1), "front": (0, -1, 0.05)}
    for vn, d in views.items():
        dv = Vector(d).normalized()
        cam.location = ctr + dv * size * 1.25
        cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(OUT, f"view_{name}_{vn}.png")
        bpy.ops.render.render(write_still=True)
    print("=== DONE", name)
