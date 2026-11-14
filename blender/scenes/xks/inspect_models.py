# Inspect NASA glb models: objects, dims, materials, animations, images
import bpy, sys, os
from mathutils import Vector
SRC = "/Users/davronoff/dev/oy-karvonsaroyi-3d/source/models"
names = sys.argv[sys.argv.index("--")+1:]
for n in names:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, n + ".glb"))
    print("=" * 20, n)
    sc = bpy.context.scene
    print("frames", sc.frame_start, sc.frame_end, "actions", [a.name for a in bpy.data.actions][:20])
    for o in bpy.data.objects:
        mins = Vector((1e9,)*3); maxs = Vector((-1e9,)*3)
        if o.type == 'MESH':
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c)
                mins = Vector(map(min, mins, w)); maxs = Vector(map(max, maxs, w))
            mats = [s.material.name if s.material else None for s in o.material_slots]
            print(f"  {o.type} {o.name!r} parent={o.parent.name if o.parent else None} tris~{len(o.data.polygons)} loc={tuple(round(x,2) for x in o.location)} rot={tuple(round(x,2) for x in o.rotation_euler)} scl={tuple(round(x,3) for x in o.scale)} min={tuple(round(x,2) for x in mins)} max={tuple(round(x,2) for x in maxs)} anim={bool(o.animation_data and o.animation_data.action)} mats={mats}")
        else:
            print(f"  {o.type} {o.name!r} parent={o.parent.name if o.parent else None} loc={tuple(round(x,2) for x in o.location)} rot={tuple(round(x,2) for x in o.rotation_euler)} scl={tuple(round(x,3) for x in o.scale)} anim={bool(o.animation_data and o.animation_data.action)}")
    for m in bpy.data.materials:
        if not m.use_nodes: continue
        bsdf = next((nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED'), None)
        imgs = [nd.image.name for nd in m.node_tree.nodes if nd.type == 'TEX_IMAGE' and nd.image]
        if bsdf:
            bc = bsdf.inputs['Base Color'].default_value
            print(f"  MAT {m.name!r} base=({bc[0]:.2f},{bc[1]:.2f},{bc[2]:.2f}) metal={bsdf.inputs['Metallic'].default_value:.2f} rough={bsdf.inputs['Roughness'].default_value:.2f} alpha={bsdf.inputs['Alpha'].default_value:.2f} imgs={imgs}")
