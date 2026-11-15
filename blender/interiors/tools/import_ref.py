"""Import ASTRA shell dumps (ref/<name>.json, three.js Y-up metres) into ref/<name>_shell.blend (Blender Z-up).
three (x, y, z) -> Blender (x, -z, y). ASTRA models face north (-z three) = +Y Blender; their local +z (front,
toward the habitat in ASTRA) = -Y Blender. Run: Blender -b -P import_ref.py -- <ref_dir>"""
import bpy, json, sys, os
ref = sys.argv[sys.argv.index('--') + 1]
for name in ['habitat', 'greenhouse', 'lab', 'lander']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    d = json.load(open(os.path.join(ref, name + '.json')))
    col = bpy.data.collections.new('ASTRA_shell_' + name)
    bpy.context.scene.collection.children.link(col)
    mats = {}
    for i, m in enumerate(d['meshes']):
        p = m['pos']
        verts = [(p[k], -p[k + 2], p[k + 1]) for k in range(0, len(p), 3)]
        ix = m['idx']
        faces = [tuple(ix[k:k + 3]) for k in range(0, len(ix), 3)]
        me = bpy.data.meshes.new(f'{name}_{i}')
        me.from_pydata(verts, [], faces)
        me.validate(); me.update()
        key = (m['color'], round(m['opacity'], 2))
        if key not in mats:
            mt = bpy.data.materials.new(f"astra_{m['color'][1:]}_{key[1]}")
            h = m['color'].lstrip('#'); c = [int(h[j:j + 2], 16) / 255 for j in (0, 2, 4)]
            mt.diffuse_color = (*[x ** 2.2 for x in c], key[1])
            mt.use_nodes = True
            b = mt.node_tree.nodes['Principled BSDF']
            b.inputs['Base Color'].default_value = (*[x ** 2.2 for x in c], 1)
            b.inputs['Alpha'].default_value = key[1]
            mats[key] = mt
        me.materials.append(mats[key])
        ob = bpy.data.objects.new(f"{name}_{i}_{m['name'] or 'part'}", me)
        col.objects.link(ob)
    bb = d['bbox']
    print(name, 'bbox three', bb)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ref, name + '_shell.blend'))
