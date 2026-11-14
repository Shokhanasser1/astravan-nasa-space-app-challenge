"""Contact sheet of all asset previews (re-imported GLBs) -> game3d/assets/_preview.png
  Blender -b --factory-startup -P game3d/assets/_build/make_contact.py
"""
import bpy, os, json, math

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
PREV = os.path.join(ASSETS, '_work', 'prev')
ids = sorted(f[:-4] for f in os.listdir(PREV) if f.endswith('.png') and not f.startswith('hdu_both'))
tris = {}
for m in ids:
    p = os.path.join(ASSETS, '_work', f'verify_{m}.json')
    if os.path.exists(p):
        tris[m] = json.load(open(p))['tris']

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 8
sc.cycles.use_denoising = False
sc.cycles.max_bounces = 0
sc.render.threads_mode = 'AUTO'
sc.view_settings.view_transform = 'Standard'
w = bpy.data.worlds.new('w'); w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.035, 0.04, 0.07, 1)
sc.world = w

lbl = bpy.data.materials.new('lbl'); lbl.use_nodes = True
lbl.node_tree.nodes.clear()
e = lbl.node_tree.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (0.95, 0.85, 0.55, 1)
o2 = lbl.node_tree.nodes.new('ShaderNodeOutputMaterial'); lbl.node_tree.links.new(e.outputs[0], o2.inputs[0])

cols = 7
rows = math.ceil(len(ids) / cols)
cw, ch = 1.0, 1.18
for i, mid in enumerate(ids):
    r, c = divmod(i, cols)
    x, y = c * cw, -r * ch
    im = bpy.data.images.load(os.path.join(PREV, mid + '.png'))
    mat = bpy.data.materials.new(mid); mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = im
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs[0])
    bpy.ops.mesh.primitive_plane_add(size=0.96, location=(x, y + 0.06, 0))
    bpy.context.object.data.materials.append(mat)
    td = bpy.data.curves.new('t' + mid, 'FONT')
    td.body = f'{mid}  ({tris.get(mid, 0):,} tris)'
    td.align_x = 'CENTER'; td.size = 0.07
    to = bpy.data.objects.new('t' + mid, td); to.location = (x, y - 0.50, 0.001)
    sc.collection.objects.link(to); td.materials.append(lbl)
td = bpy.data.curves.new('title', 'FONT')
td.body = ('Oy karvonsaroyi - game3d/assets (35 GLB, metres, Draco + WebP)   '
           '3D models: NASA 3D Resources / NASA Science (NASA/JPL-Caltech). Not endorsed by NASA.')
td.size = 0.065
to = bpy.data.objects.new('title', td); to.location = (-0.46, 0.66, 0)
sc.collection.objects.link(to); td.materials.append(lbl)
cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
W = cols * cw
H = rows * ch + 0.22
cd.ortho_scale = W
cam.location = ((cols - 1) * cw / 2, 0.78 - H / 2, 5)
sc.render.resolution_x = 2100
sc.render.resolution_y = int(2100 * H / W)
sc.render.filepath = os.path.join(ASSETS, '_preview.png')
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode = 'RGB'
bpy.ops.render.render(write_still=True)
print('CONTACT', sc.render.filepath)
