# Diagnostic 2: connected components per material (bbox), proper ortho views with labels
import bpy, bmesh, os, colorsys
from mathutils import Vector
ROOT = "/Users/davronoff/dev/oy-karvonsaroyi-3d"
OUT = os.environ.get("DIAG_OUT", "/tmp")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=ROOT + "/source/models/iss.glb")
want = {"lambert7SG.001", "lambert4SG.001", "soyuz_blinn4SG.001", "anisotropic1SG.001", "lambert3SG.001", "blinn1SG.001", "blinn3SG.001"}
for o in [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith("polySurfa")]:
    bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world)
    bm.faces.ensure_lookup_table()
    seen = set()
    for f in bm.faces:
        if f.index in seen: continue
        mname = o.material_slots[f.material_index].material.name
        if mname not in want: seen.add(f.index); continue
        stack = [f]; comp = []
        seen.add(f.index)
        while stack:
            g = stack.pop(); comp.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen and h.material_index == f.material_index:
                        seen.add(h.index); stack.append(h)
        vs = [v.co for g in comp for v in g.verts]
        mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
        mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
        area = sum(g.calc_area() for g in comp)
        if area > 1.5:
            sz = mx - mn
            print(f"COMP {o.name} {mname:20s} n={len(comp):5d} area={area:7.1f} size=({sz.x:5.1f},{sz.y:5.1f},{sz.z:5.1f}) center=({(mn.x+mx.x)/2:5.1f},{(mn.y+mx.y)/2:5.1f},{(mn.z+mx.z)/2:5.1f})")
    bm.free()
