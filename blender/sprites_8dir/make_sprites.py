"""Oy karvonsaroyi — NASA 3D modellaridan bir xil uslubdagi sprite'lar.

Ishlatish (bitta model):
  Blender -b --factory-startup -P make_sprites.py -- --model emu
Katalog (barcha single rasmlardan):
  Blender -b --factory-startup -P make_sprites.py -- --katalog

Natija:
  sprites_8dir/<id>_8dir.png   4x2 katak, 256 px; katak k = kamera modelni old tomondan
                               boshlab soat strelkasiga teskari k*45 gradusga aylanib ko'radi
                               (0=old, 1=old-o'ng 3/4, 2=o'ng yon, 3=orqa-o'ng, 4=orqa,
                                5=orqa-chap, 6=chap yon, 7=old-chap)
  sprites_8dir/single/<id>.png 3/4 ko'rinish (katak 1 burchagi), 512 px
"""
import bpy, sys, os, math, json
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODELS = os.path.join(ROOT, 'source', 'models')
INV = os.path.join(ROOT, 'source', 'inventory.json')
WORK = os.path.join(HERE, '_work')

CELL = 256
SINGLE = 512
SAMPLES = 20
ELEV = 20.0

TERRAIN = {'moon-near-side', 'apollo-11-site', 'mount-hadley', 'mission-control'}
GLOBES = {'moon-globe', 'earth-globe', 'mars-globe'}
SINGLE_ONLY = TERRAIN | GLOBES

# stray objects floating far from the model (removed before normalising)
DROP = {'iss': ('bendedtru', 'pCylinder')}

# extra yaw (degrees) so that view 0 shows the model's front
YAW = {'emu': 180, 'mark-3': 180}

# ---------------------------------------------------------------- logo fixes
# Image-name prefix -> list of ops. Rects are (x0, y0, x1, y1) in texture pixels,
# top-left origin (as seen in an image viewer). 'rect' fills with the median
# colour of a thin border ring around the rect; 'flat' fills the whole image;
# 'redkey' replaces red lettering pixels (dilated) with the image's median colour.
WHITE = (0.92, 0.92, 0.90)
FIXES = {
    'emu': {
        'emusuitFLAGpatch': [('flat', WHITE)],
        'emusuitvitruvianpatch': [('flat', WHITE)],
        'emusuitbox4': [('flat', None)],
    },
    'mark-3': {'texturelogo': [('flat', WHITE)]},
    'astronaut': {'astnt1_1': [('rect', (878, 22, 960, 85)), ('rect', (890, 182, 955, 238)),
                               ('rect', (792, 382, 865, 443)), ('rect', (800, 712, 858, 763))]},
    'hdu-1': {'HDU_01': [('rect', (131, 36, 152, 652)),           # tiny flag/meatball column
                         ('rect', (193, 68, 247, 124)), ('rect', (188, 152, 252, 208)),
                         ('rect', (188, 232, 260, 285)), ('rect', (193, 393, 247, 449)),
                         ('rect', (188, 475, 252, 531)), ('rect', (188, 557, 260, 608)),
                         ('rect', (36, 238, 92, 280)), ('rect', (64, 560, 120, 602)),
                         ('rect', (662, 812, 693, 988))]},          # AIRLOCK lettering
    'saturn-v': {'SATURNVA': [('redkey', None)], 'SATURNVU': [('redkey', None)],
                 'SATURNVT': [('rect', (316, 508, 606, 538))]},
    'apollo-lm': {'TEXTURE_': [('rect', (74, 538, 510, 774))],
                  'TEXTUREA': [('rect', (70, 496, 564, 800))]},
    'curiosity': {'tex_05': [('rect', (8, 74, 113, 412)), ('rect', (412, 42, 508, 412))]},
    'perseverance': {'arm_graphics': [('rect', (14, 28, 498, 202)), ('rect', (98, 266, 298, 342))],
                     'blade': [('rect', (14, 132, 180, 230)), ('rect', (888, 204, 1022, 392)),
                               ('rect', (878, 392, 1022, 510))]},
    'gateway': {'DSXR_BaseColor': [('rect', (22, 645, 76, 820))]},
}


def img_array(im):
    w, h = im.size
    a = np.empty(w * h * 4, dtype=np.float32)
    im.pixels.foreach_get(a)
    return a.reshape(h, w, 4)


def apply_fixes(model_id, log):
    fx = FIXES.get(model_id, {})
    for im in bpy.data.images:
        for key, ops in fx.items():
            if not im.name.startswith(key):
                continue
            w, h = im.size
            if w == 0:
                continue
            base = img_array(im)
            a = base[::-1]  # top-left origin view
            for op, arg in ops:
                if op == 'flat':
                    col = arg if arg else np.median(a[..., :3].reshape(-1, 3), axis=0)
                    a[..., :3] = col
                elif op == 'rect':
                    x0, y0, x1, y1 = arg
                    p = 4
                    ring = np.concatenate([
                        a[max(y0 - p, 0):y0, x0:x1, :3].reshape(-1, 3),
                        a[y1:y1 + p, x0:x1, :3].reshape(-1, 3),
                        a[y0:y1, max(x0 - p, 0):x0, :3].reshape(-1, 3),
                        a[y0:y1, x1:x1 + p, :3].reshape(-1, 3)])
                    a[y0:y1, x0:x1, :3] = np.median(ring, axis=0)
                elif op == 'redkey':
                    r, g, b = a[..., 0], a[..., 1], a[..., 2]
                    m = (r > 0.45) & (r - g > 0.15) & (r - b > 0.15)
                    for _ in range(2):
                        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
                    a[m, :3] = np.median(a[~m][:, :3], axis=0)
            im.pixels.foreach_set(base.ravel())
            im.update()
            log.append(f'{im.name}: ' + ', '.join(o for o, _ in ops))


# ---------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def setup_render(scene, res):
    scene.render.engine = 'CYCLES'
    cy = scene.cycles
    cy.device = 'CPU'
    cy.samples = SAMPLES
    cy.use_denoising = True
    try:
        cy.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    cy.max_bounces = 6
    cy.transparent_max_bounces = 16
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 2
    scene.render.film_transparent = True
    scene.render.resolution_x = scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    bg = w.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (0.20, 0.22, 0.27, 1)
    bg.inputs[1].default_value = 0.6
    scene.world = w


def add_sun(name, rot_deg, color, strength, angle=8):
    d = bpy.data.lights.new(name, 'SUN')
    d.color = color
    d.energy = strength
    d.angle = math.radians(angle)
    o = bpy.data.objects.new(name, d)
    o.rotation_euler = [math.radians(v) for v in rot_deg]
    bpy.context.scene.collection.objects.link(o)
    return o


def lights(key_tilt=50):
    # Camera looks from -Y toward +Y. Sun rotation: X tilt then Z spin.
    add_sun('key', (key_tilt, 0, -40), (1.0, 0.86, 0.70), 4.0)    # warm, front-left-high
    add_sun('fill', (65, 0, 60), (0.70, 0.82, 1.0), 1.3)    # cool, front-right
    add_sun('rim', (60, 0, 165), (0.90, 0.95, 1.0), 3.5)    # behind


GLASSY = ('glass', 'visor', 'clear', 'transparent', 'window', 'lens')


def fix_transmission(log):
    """Many NASA glTFs carry Transmission=1 on opaque parts (suits look like glass).
    Turn transmission off unless the material name says it is glass."""
    n = 0
    for m in bpy.data.materials:
        if not m.node_tree or any(g in m.name.lower() for g in GLASSY):
            continue
        for nd in m.node_tree.nodes:
            if nd.type == 'BSDF_PRINCIPLED':
                t = nd.inputs.get('Transmission Weight')
                if t is not None and not t.is_linked and t.default_value > 0:
                    t.default_value = 0.0
                    n += 1
    if n:
        log.append(f'transmission off on {n} materials')


ROOM_PALETTE = [  # (name substring, base colour, emission strength)
    ('screen', (0.10, 0.45, 0.40), 1.5), ('picture', (0.15, 0.30, 0.55), 1.2),
    ('lights', (1.0, 0.95, 0.80), 3.0), ('keyboard', (0.10, 0.10, 0.11), 0),
    ('namep', (0.70, 0.70, 0.66), 0), ('console_face', (0.20, 0.22, 0.24), 0),
    ('console', (0.55, 0.57, 0.58), 0), ('crstation', (0.45, 0.47, 0.50), 0),
    ('projector', (0.30, 0.30, 0.32), 0), ('floor', (0.22, 0.24, 0.30), 0),
    ('cabnet', (0.50, 0.50, 0.48), 0), ('', (0.62, 0.62, 0.60), 0)]


def paint_room(log):
    """mission-control glTF has black base colours everywhere: give a simple palette."""
    for m in bpy.data.materials:
        if not m.node_tree:
            continue
        b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if b is None or b.inputs['Base Color'].is_linked:
            continue
        for key, col, em in ROOM_PALETTE:
            if key in m.name.lower():
                b.inputs['Base Color'].default_value = (*col, 1)
                if em:
                    b.inputs['Emission Color'].default_value = (*col, 1)
                    b.inputs['Emission Strength'].default_value = em
                break
    log.append('room: palette by material name (source colours were black)')


def cut_room(objs, log):
    """Room model: remove ceiling and the camera-side (-Y) wall so we see inside."""
    import bmesh
    P = world_verts(objs)
    lo, hi = P.min(0), P.max(0)
    zc = lo[2] + 0.80 * (hi[2] - lo[2])
    yc = lo[1] + 0.04 * (hi[1] - lo[1])
    n = 0
    for o in objs:
        if o.type != 'MESH':
            continue
        bm = bmesh.new(); bm.from_mesh(o.data)
        M = o.matrix_world
        kill = [f for f in bm.faces if (M @ f.calc_center_median()).z > zc or (M @ f.calc_center_median()).y < yc]
        n += len(kill)
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(o.data); bm.free()
    log.append(f'room: removed ceiling + front wall ({n} faces)')


def cull_backfaces(log):
    """Room models: make back faces transparent so we look into the room."""
    for m in bpy.data.materials:
        if not m.node_tree:
            continue
        nt = m.node_tree
        out = next((n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output), None)
        if out is None or not out.inputs['Surface'].is_linked:
            continue
        src = out.inputs['Surface'].links[0].from_socket
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(geo.outputs['Backfacing'], mix.inputs[0])
        nt.links.new(src, mix.inputs[1])
        nt.links.new(tr.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
    log.append('room: back faces transparent (cutaway)')


def import_model(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in list(new):
        if o.type in {'CAMERA', 'LIGHT'}:
            bpy.data.objects.remove(o, do_unlink=True)
    return [o for o in bpy.data.objects if o not in before]


def world_verts(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objs:
        if o.type != 'MESH' or o.hide_render:
            continue
        oe = o.evaluated_get(dg)
        me = oe.to_mesh()
        n = len(me.vertices)
        if n:
            co = np.empty(n * 3, dtype=np.float32)
            me.vertices.foreach_get('co', co)
            co = co.reshape(-1, 3)
            if n > 60000:
                co = co[:: max(1, n // 60000)]
            M = np.array(o.matrix_world, dtype=np.float32)
            co = co @ M[:3, :3].T + M[:3, 3]
            pts.append(co)
        oe.to_mesh_clear()
    return np.concatenate(pts) if pts else np.zeros((1, 3), np.float32)


def normalise(objs):
    """Parent roots to an empty; scale to unit box, centre XY, base on z=0."""
    root = bpy.data.objects.new('ROOT', None)
    bpy.context.scene.collection.objects.link(root)
    for o in objs:
        if o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    P = world_verts(objs)
    lo, hi = P.min(0), P.max(0)
    s = 1.0 / float(max(hi - lo))
    c = (lo + hi) / 2
    root.scale = (s, s, s)
    root.location = (-c[0] * s, -c[1] * s, -lo[2] * s)
    # pivot at the world origin: rotating it spins the model around its own centre
    pivot = bpy.data.objects.new('PIVOT', None)
    bpy.context.scene.collection.objects.link(pivot)
    root.parent = pivot
    bpy.context.view_layer.update()
    return pivot


def make_camera(elev):
    cd = bpy.data.cameras.new('cam')
    cd.type = 'ORTHO'
    cam = bpy.data.objects.new('cam', cd)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    e = math.radians(elev)
    # look direction: from -Y, tilted down by elev
    cam.rotation_euler = (math.radians(90) - e, 0, 0)
    cd.clip_start = 0.01
    cd.clip_end = 100
    return cam


def frame(cam, pts_list, margin=1.06):
    """Fit the ortho camera to the union of projected point sets."""
    R = np.array(cam.rotation_euler.to_matrix(), dtype=np.float64)
    right, up, fwd = R[:, 0], R[:, 1], -R[:, 2]
    xs, ys = [], []
    for P in pts_list:
        xs.append(P @ right); ys.append(P @ up)
    xs, ys = np.concatenate(xs), np.concatenate(ys)
    cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
    size = max(xs.max() - xs.min(), ys.max() - ys.min()) * margin
    cam.data.ortho_scale = size
    centre = right * cx + up * cy
    cam.location = Vector(centre - fwd * 10.0)


def rot_points(P, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    Rz = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    return P @ Rz.T


def render_to(path, res):
    sc = bpy.context.scene
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def load_px(path):
    im = bpy.data.images.load(path, check_existing=False)
    a = img_array(im).copy()
    bpy.data.images.remove(im)
    return a  # bottom-left origin


def save_px(arr, path):
    h, w = arr.shape[:2]
    im = bpy.data.images.new('out', w, h, alpha=True)
    im.pixels.foreach_set(arr.astype(np.float32).ravel())
    im.filepath_raw = path
    im.file_format = 'PNG'
    im.save()
    bpy.data.images.remove(im)


def do_model(mid, only=None):
    reset()
    sc = bpy.context.scene
    setup_render(sc, CELL)
    # Using a colour-managed save: write raw pixels with Standard so sheet == renders.
    objs = import_model(os.path.join(MODELS, mid + '.glb'))
    fixlog = []
    for o in list(objs):
        if o.name.startswith(DROP.get(mid, ())) and o.name in bpy.data.objects:
            objs.remove(o)
            bpy.data.objects.remove(o, do_unlink=True)
            fixlog.append('dropped stray object')
    apply_fixes(mid, fixlog)
    fix_transmission(fixlog)
    root = normalise(objs)
    terrain = mid in TERRAIN
    elev = 32.0 if terrain else ELEV
    prints = mid in TERRAIN and mid != 'mission-control'
    if prints:
        # 3D-print terrains are untextured white: give them a regolith grey,
        # look from higher up and use a low (grazing) key light for relief.
        elev = 50.0
        grey = bpy.data.materials.new('regolith')
        grey.use_nodes = True
        bs = grey.node_tree.nodes['Principled BSDF']
        bs.inputs['Base Color'].default_value = (0.36, 0.35, 0.34, 1)
        bs.inputs['Roughness'].default_value = 0.95
        for o in objs:
            if o.type == 'MESH':
                o.data.materials.clear()
                o.data.materials.append(grey)
        sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.15
        fixlog.append('terrain: regolith grey material')
    root.rotation_euler[2] = math.radians(YAW.get(mid, 0))
    if mid in GLOBES:
        root.rotation_euler[2] = math.radians(200)  # show an interesting hemisphere
    if mid == 'mission-control':
        elev = 45.0
        cut_room(objs, fixlog)
        paint_room(fixlog)
    lights(76 if prints else 50)
    if mid == 'mission-control':
        for L in bpy.data.lights:
            L.use_shadow = False
        sc.world.node_tree.nodes['Background'].inputs[1].default_value = 1.2
    cam = make_camera(elev)
    bpy.context.view_layer.update()
    P = world_verts(objs)
    os.makedirs(os.path.join(HERE, 'single'), exist_ok=True)
    tmp = os.path.join(WORK, 'r_' + mid)
    os.makedirs(tmp, exist_ok=True)
    base_rot = root.rotation_euler[2]
    # model rotates (lights stay fixed relative to the camera)
    # camera azimuth k*45 CCW around model == model rotated by -k*45
    if mid not in SINGLE_ONLY and only != 'single':
        frame(cam, [rot_points(P, -45 * k) for k in range(8)])
        sheet = np.zeros((CELL * 2, CELL * 4, 4), np.float32)
        for k in range(8):
            root.rotation_euler[2] = base_rot - math.radians(45 * k)
            p = os.path.join(tmp, f'v{k}.png')
            render_to(p, CELL)
            a = load_px(p)
            r, c = divmod(k, 4)
            y0 = CELL * (1 - r)  # row 0 on top (bottom-left origin array)
            sheet[y0:y0 + CELL, c * CELL:(c + 1) * CELL] = a
        save_px(sheet, os.path.join(HERE, f'{mid}_8dir.png'))
    # single 3/4 view (k=1), tight framing
    k = 0 if mid == 'mission-control' else 1
    if mid in GLOBES:
        k = 0
    root.rotation_euler[2] = base_rot - math.radians(45 * k)
    frame(cam, [rot_points(P, -45 * k)], margin=1.04)
    render_to(os.path.join(HERE, 'single', f'{mid}.png'), SINGLE)
    return fixlog


# ---------------------------------------------------------------- katalog
def do_katalog():
    reset()
    sc = bpy.context.scene
    inv = json.load(open(INV))
    ids = sorted(m for m in inv if os.path.exists(os.path.join(HERE, 'single', m + '.png')))
    cols = 7
    rows = math.ceil(len(ids) / cols)
    cw, ch = 1.0, 1.22
    setup_render(sc, 100)
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    sc.world.node_tree.nodes['Background'].inputs[0].default_value = (0.035, 0.04, 0.07, 1)
    sc.world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    sc.cycles.samples = 24
    sc.cycles.use_denoising = False
    sc.cycles.max_bounces = 0
    for i, mid in enumerate(ids):
        r, c = divmod(i, cols)
        x, y = c * cw, -r * ch
        im = bpy.data.images.load(os.path.join(HERE, 'single', mid + '.png'))
        mat = bpy.data.materials.new(mid)
        mat.use_nodes = True
        nt = mat.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = im
        em = nt.nodes.new('ShaderNodeEmission')
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(tex.outputs['Color'], em.inputs['Color'])
        nt.links.new(tex.outputs['Alpha'], mix.inputs[0])
        nt.links.new(tr.outputs[0], mix.inputs[1])
        nt.links.new(em.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs[0])
        bpy.ops.mesh.primitive_plane_add(size=0.94, location=(x, y + 0.08, 0))
        bpy.context.object.data.materials.append(mat)
        # label
        td = bpy.data.curves.new('t' + mid, 'FONT')
        td.body = mid
        td.align_x = 'CENTER'
        td.size = 0.085
        to = bpy.data.objects.new('t' + mid, td)
        to.location = (x, y - 0.50, 0.001)
        sc.collection.objects.link(to)
        tm = bpy.data.materials.new('lbl')
        tm.use_nodes = True
        tm.node_tree.nodes.clear()
        e = tm.node_tree.nodes.new('ShaderNodeEmission')
        e.inputs[0].default_value = (0.95, 0.85, 0.55, 1)
        o2 = tm.node_tree.nodes.new('ShaderNodeOutputMaterial')
        tm.node_tree.links.new(e.outputs[0], o2.inputs[0])
        td.materials.append(tm)
    # title
    td = bpy.data.curves.new('title', 'FONT')
    td.body = 'Oy karvonsaroyi - NASA 3D model sprite katalogi  (3D models: NASA 3D Resources / NASA Science. Not endorsed by NASA.)'
    td.size = 0.07
    to = bpy.data.objects.new('title', td)
    to.location = (-0.45, 0.68, 0)
    sc.collection.objects.link(to)
    td.materials.append(bpy.data.materials['lbl'])
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    W = cols * cw
    H = rows * ch + 0.25
    cd.ortho_scale = W
    cam.location = ((cols - 1) * cw / 2, 0.8 - H / 2, 5)
    sc.render.resolution_x = 2100
    sc.render.resolution_y = int(2100 * H / W)
    sc.render.filepath = os.path.join(HERE, 'KATALOG.png')
    sc.render.image_settings.color_mode = 'RGB'
    bpy.ops.render.render(write_still=True)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if '--katalog' in argv:
        do_katalog()
    else:
        mid = argv[argv.index('--model') + 1]
        only = argv[argv.index('--only') + 1] if '--only' in argv else None
        log = do_model(mid, only)
        print('FIXES', mid, json.dumps(log))
        print('DONE', mid)
