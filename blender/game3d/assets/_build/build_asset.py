"""Oy karvonsaroyi - game-ready GLB for one NASA model (Three.js / any glTF engine).

Run (headless, one model per Blender run):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
      -P game3d/assets/_build/build_asset.py -- --model sev

Output: game3d/assets/<id>.glb  (Draco meshes, WebP textures, metres, glTF Y-up,
        origin bottom-centre (globes: centre), front = +Z where it makes sense)
        + COL_<id> collision proxy object (boxes, no material) in the same file.
        game3d/assets/_work/build_<id>.json  (stats for the manifest)

Source .glb files are only read.  Logo cleaning reuses scenes/oy/oy_texclean.py,
scenes/xks (astronaut box finder), sprites_8dir FIXES and the cleaned PNGs in
scenes/mars/tex_clean and scenes/koinot/tex.
3D models: NASA 3D Resources / NASA Science (NASA/JPL-Caltech). Not endorsed by NASA.
"""
import bpy, bmesh, sys, os, math, json, time
import numpy as np
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(ASSETS))
SRC = os.path.join(ROOT, 'source', 'models')
WORK = os.path.join(ASSETS, '_work')
sys.path.insert(0, os.path.join(ROOT, 'scenes', 'oy'))
import oy_texclean  # noqa: E402

T0 = time.time()
LOG = []


def log(*a):
    s = ' '.join(str(x) for x in a)
    LOG.append(s)
    print(f'[asset {time.time() - T0:6.1f}s]', s, flush=True)


# --------------------------------------------------------------------------- config
# scale = metres per imported Blender unit (bbox numbers in source/inventory.json).
# ('fitz', h) = scale so that height (Z) becomes h metres after the pre-fixes.
BUDGET = dict(prop=5000, suit=30000, rover=30000, vehicle=50000, station=50000,
              terrain=60000, globe=10000, room=50000)
MAXBOX = dict(prop=2, suit=4, rover=5, vehicle=6, station=8, room=0, terrain=0, globe=1)

HDU_S = 5.0 / 165.93
CFG = {
    # --- Moon base (oy)
    'hdu-1':         dict(kind='station', scale=HDU_S, tex=1024, frame=(0, 0, 0.6879), yaw=90),
    'hdu-2':         dict(kind='station', scale=HDU_S, tex=1024, frame=(0, 0, 0.6879), yaw=90),
    'sev':           dict(kind='rover', scale=0.76, tex=1024),
    'rassor':        dict(kind='rover', scale=1.0, tex=512),
    'solar-wing':    dict(kind='prop', scale=50.0, tex=256),
    'crew-lock-bag': dict(kind='prop', scale=0.0254, tex=512),
    'astronaut':     dict(kind='suit', scale=1.90 / 74.3, tex=1024),
    'mark-3':        dict(kind='suit', scale=0.95, tex=512, yaw=180),
    'emu':           dict(kind='suit', scale=0.949, tex=512, yaw=180),
    'helmet':        dict(kind='prop', scale=0.40 / 14.07, tex=256),
    'hammer':        dict(kind='prop', scale=1.098, tex=256),
    'sample-tube':   dict(kind='prop', scale=0.0254, tex=256),
    'orion':         dict(kind='vehicle', scale=5.03 / 16.3094, tex=512),
    'apollo-lm':     dict(kind='vehicle', scale=7.0 / 5.01, tex=512),
    'lro':           dict(kind='vehicle', scale=1.0, tex=512),
    'gateway':       dict(kind='station', scale=1.0, tex=512),
    # --- terrains / globes
    'apollo-11-site': dict(kind='terrain', scale=(30000.0 / 255.5, 30000.0 / 255.5 / 60.0)),
    'moon-near-side': dict(kind='terrain', scale=400000.0 / 78.416),
    'mount-hadley':   dict(kind='terrain', scale=4500.0 / 34.3),
    'moon-globe':     dict(kind='globe', scale=1.0, tex=1024, origin='center'),
    'earth-globe':    dict(kind='globe', scale=1.0, tex=1024, origin='center'),
    'mars-globe':     dict(kind='globe', scale=1.0, tex=1024, origin='center'),
    # --- ISS (xks)
    'iss':           dict(kind='station', scale=109.0 / 45.54, tex=512),
    'robonaut-2':    dict(kind='suit', scale=('fitz', 2.40), tex=512, yaw=180),
    'oru':           dict(kind='prop', scale=1.04 / 173.5, tex=512),
    # --- Earth (yer)
    'sls':           dict(kind='vehicle', scale=98.1 / (198.7409 - 5.0), tex=512),
    'mobile-launcher': dict(kind='station', scale=12.19 / 0.251, tex=512),
    'mission-control': dict(kind='room', scale=1.0, tex=512),
    'dsn-34m':       dict(kind='station', scale=34.0 / 34.0248, tex=512),
    'saturn-v':      dict(kind='vehicle', scale=('fitz', 111.0), tex=512),
    'goes':          dict(kind='vehicle', scale=105.6, tex=512),
    'sdo':           dict(kind='vehicle', scale=6.25 / 37.03, tex=512),
    # --- Mars
    'curiosity':     dict(kind='rover', scale=1.0, tex=1024),
    'perseverance':  dict(kind='rover', scale=1.0, tex=1024),
    'viking':        dict(kind='rover', scale=0.2229, tex=512),
}

GLASSY = ('glass', 'visor', 'clear', 'transparent', 'window', 'lens')


# --------------------------------------------------------------------------- helpers
def principled(m):
    if not m or not m.node_tree:
        return None
    return next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)


def setp(b, name, val):
    i = b.inputs.get(name) if b else None
    if i is None:
        return
    for l in list(i.links):
        b.id_data.links.remove(l)
    i.default_value = val


def plain(m, color, rough=0.8, metal=0.0, keep_normal=False):
    """Replace a material's textures with a flat colour (brand rule / procedural looks)."""
    if m is None:
        return
    b = principled(m)
    if b is None:
        return
    for n in list(m.node_tree.nodes):
        if n.type == 'TEX_IMAGE':
            if keep_normal and any(l.to_socket.name == 'Color' and l.to_node.type == 'NORMAL_MAP'
                                   for o in n.outputs for l in o.links):
                continue
            m.node_tree.nodes.remove(n)
    setp(b, 'Base Color', (*color[:3], 1))
    setp(b, 'Metallic', metal)
    setp(b, 'Roughness', rough)
    setp(b, 'Transmission Weight', 0.0)
    setp(b, 'Alpha', 1.0)


def new_mat(name, color, rough=0.6, metal=0.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = principled(m)
    b.inputs['Base Color'].default_value = (*color[:3], 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (*emit[:3], 1)
        b.inputs['Emission Strength'].default_value = emit_strength
    return m


def img_np(img):
    w, h = img.size
    a = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(h, w, 4)            # bottom-up rows


def np_to_img(img, a):
    img.pixels.foreach_set(a.astype(np.float32).ravel())
    img.update()
    img.pack()


def find_img(prefix):
    for im in bpy.data.images:
        if im.name == prefix:
            return im
    for im in bpy.data.images:
        if im.name.startswith(prefix):
            return im
    return None


def load_png_into(img, path):
    """Replace img pixels with a cleaned PNG of the same size (top-down file -> Blender buffer)."""
    src = bpy.data.images.load(path, check_existing=False)
    if tuple(src.size) != tuple(img.size):
        src.scale(*img.size)
    a = img_np(src)
    if a.shape[2] == 4 and img.channels == 4:
        pass
    bpy.data.images.remove(src)
    np_to_img(img, a)


def mesh_objs():
    return [o for o in bpy.data.objects if o.type == 'MESH']


def tri_count(me):
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def world_pts(objs):
    pts = []
    for o in objs:
        if o.type != 'MESH':
            continue
        n = len(o.data.vertices)
        if not n:
            continue
        co = np.empty(n * 3, np.float64)
        o.data.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        M = np.array(o.matrix_world)
        pts.append(co @ M[:3, :3].T + M[:3, 3])
    return np.concatenate(pts) if pts else np.zeros((1, 3))


def delete_faces(o, pred):
    """pred(face_center_world, normal_world) -> bool  (o has identity matrix here)."""
    bm = bmesh.new(); bm.from_mesh(o.data)
    kill = [f for f in bm.faces if pred(f.calc_center_median(), f.normal)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(o.data); bm.free()
    return len(kill)


def loose_labels(me):
    """connected-component label per vertex (numpy label propagation)."""
    nv = len(me.vertices)
    ev = np.zeros(len(me.edges) * 2, np.int64)
    me.edges.foreach_get('vertices', ev)
    ev = ev.reshape(-1, 2)
    lab = np.arange(nv)
    for _ in range(2000):
        a = np.minimum(lab[ev[:, 0]], lab[ev[:, 1]])
        old = lab.copy()
        np.minimum.at(lab, ev[:, 0], a)
        np.minimum.at(lab, ev[:, 1], a)
        lab = lab[lab]
        if np.array_equal(old, lab):
            break
    return lab


# --------------------------------------------------------------------------- generic fixes
def fix_transmission():
    """NASA glTFs often carry Transmission=1 on opaque parts (suits/habitat look like glass).
    Opaque parts -> transmission 0.  Real glass -> light alpha-blended glass (cheap in WebGL)."""
    n = g = 0
    for m in bpy.data.materials:
        b = principled(m)
        if b is None:
            continue
        t = b.inputs.get('Transmission Weight')
        glassy = any(k in m.name.lower() for k in GLASSY)
        if t is not None and not t.is_linked and t.default_value > 0:
            t.default_value = 0.0
            if glassy and 'visor' not in m.name.lower():
                setp(b, 'Alpha', 0.35)
                setp(b, 'Roughness', 0.05)
                g += 1
            else:
                n += 1
    if n or g:
        log(f'transmission off on {n} opaque materials, {g} glass materials -> alpha 0.35')


def clear_custom_normals(o):
    me = o.data
    try:
        with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o]):
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except Exception:
        for nm in ('custom_normal',):
            a = me.attributes.get(nm)
            if a is not None:
                me.attributes.remove(a)


def smooth_by_angle(o, deg=35.0):
    me = o.data
    clear_custom_normals(o)
    me.shade_smooth()
    try:
        me.set_sharp_from_angle(angle=math.radians(deg))
    except Exception as e:
        log('set_sharp_from_angle failed', e)


def decimate_to(o, target, weld=True):
    me = o.data
    t0 = tri_count(me)
    if t0 <= target:
        return t0
    if weld:
        P = world_pts([o])
        diag = float(np.linalg.norm(P.max(0) - P.min(0)))
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=diag * 2e-6)
        bm.to_mesh(me); bm.free()
    for it in range(4):
        t = tri_count(o.data)
        if t <= target:
            break
        md = o.modifiers.new('dec', 'DECIMATE')
        md.decimate_type = 'COLLAPSE'
        md.ratio = max(0.0005, target / t * (0.985 if it == 0 else 0.95))
        md.use_collapse_triangulate = True
        dg = bpy.context.evaluated_depsgraph_get()
        newme = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
        old = o.data
        o.modifiers.remove(md)
        o.data = newme
        bpy.data.meshes.remove(old)
    t1 = tri_count(o.data)
    smooth_by_angle(o)
    log(f'decimate: {t0} -> {t1} tris (budget {target})')
    return t1


def image_roles():
    """image -> 'color' if it feeds a Base Color / Emission (directly or via simple nodes), else 'data'."""
    roles = {}
    for m in bpy.data.materials:
        if not m.node_tree:
            continue
        for n in m.node_tree.nodes:
            if n.type != 'TEX_IMAGE' or not n.image:
                continue
            role = 'data'
            stack = [n]; seen = set()
            while stack:
                x = stack.pop()
                if x.name in seen:
                    continue
                seen.add(x.name)
                for out in x.outputs:
                    for l in out.links:
                        if l.to_node.type == 'BSDF_PRINCIPLED' and l.to_socket.name in ('Base Color', 'Emission Color'):
                            role = 'color'
                        elif l.to_node.type not in ('BSDF_PRINCIPLED', 'NORMAL_MAP', 'OUTPUT_MATERIAL'):
                            stack.append(l.to_node)
            if roles.get(n.image.name) != 'color':
                roles[n.image.name] = role
    return roles


def used_images():
    out = {}
    for o in mesh_objs():
        for m in o.data.materials:
            if m and m.node_tree:
                for n in m.node_tree.nodes:
                    if n.type == 'TEX_IMAGE' and n.image:
                        out[n.image.name] = n.image
    return out


def downscale_textures(cap_color, cap_data):
    roles = image_roles()
    res = {}
    for name, im in used_images().items():
        w, h = im.size
        if w == 0 or h == 0:
            log('WARNING image without data', name)
            continue
        cap = cap_color if roles.get(name) == 'color' else cap_data
        s = min(1.0, cap / max(w, h))
        if s < 1.0:
            nw, nh = max(1, int(round(w * s))), max(1, int(round(h * s)))
            im.scale(nw, nh)
            im.pack()
            res[name] = f'{w}x{h} -> {nw}x{nh}'
        else:
            res[name] = f'{w}x{h}'
    log('textures:', json.dumps(res))
    return res


# --------------------------------------------------------------------------- per-model fixes
FIXLOG = []


def fl(s):
    FIXLOG.append(s)
    log('fix:', s)


def pre_hdu_1(objs):
    for m in bpy.data.materials:
        for n in (m.node_tree.nodes if m.node_tree else []):
            if n.type == 'TEX_IMAGE' and n.image and n.image.name.startswith('HDU_01'):
                n.image = oy_texclean.clean_image(bpy, n.image, oy_texclean.TEX_RECTS['HDU_01'], 'HDU_01_clean')
                fl('HDU_01 texture: 2 US flags, 2 NASA meatballs, X-Hab/HDU logos, "Segment" labels, "AIRLOCK" painted out (oy_texclean)')
        b = principled(m)
        if b:
            setp(b, 'Metallic', 0.0); setp(b, 'Roughness', 0.55)


def pre_hdu_2(objs):
    for m in bpy.data.materials:
        for n in (m.node_tree.nodes if m.node_tree else []):
            if n.type == 'TEX_IMAGE' and n.image and n.image.name.startswith('HDU_02'):
                n.image = oy_texclean.recolor_yellow(bpy, n.image, 'HDU_02_white')
                fl('HDU_02 texture: yellow rails -> white (NASA DSH photo 2011); no logos found')
        b = principled(m)
        if b:
            setp(b, 'Metallic', 0.0); setp(b, 'Roughness', 0.6)


def post_hdu_2(o):
    """8 dark radial fins around the shell do not exist on the real DSH -> removed (oy fix_hdu2)."""
    M3 = Matrix.Identity(3)

    def pred(c, n):
        if n.length == 0:
            return False
        n = n.normalized()
        r = math.hypot(c.x, c.y)
        if 0.05 < r < 3.95 and 0.45 < c.z < 6.8 and abs(n.z) < 0.3:
            radial = Vector((c.x, c.y, 0)).normalized()
            return abs(n.dot(radial)) < 0.35
        return False
    k = delete_faces(o, pred)
    fl(f'removed {k} fin faces (not on the real habitat)')


def pre_crew_lock_bag(objs):
    for m in bpy.data.materials:
        for n in (m.node_tree.nodes if m.node_tree else []):
            if n.type == 'TEX_IMAGE' and n.image and n.image.name.startswith('crwlckbg'):
                n.image = oy_texclean.clean_image(bpy, n.image, oy_texclean.TEX_RECTS['crwlckbg'], 'crwlckbg_clean')
                fl('crwlckbg texture: 2 barcode / part-number stickers painted out (oy_texclean)')


def pre_rassor(objs):
    for m in bpy.data.materials:
        b = principled(m)
        if b:
            setp(b, 'Base Color', (0.62, 0.63, 0.64, 1)); setp(b, 'Metallic', 0.6); setp(b, 'Roughness', 0.45)
    fl('aluminium-grey material (source is untextured)')


def drop_bump_maps():
    """Blender Bump nodes and zero-strength normal maps cannot add anything in glTF -> drop them
    (and their height images) to save bytes."""
    n = 0
    for m in bpy.data.materials:
        if not m.node_tree:
            continue
        nt = m.node_tree
        kill = []
        for nd in nt.nodes:
            zero_nm = nd.type == 'NORMAL_MAP' and not nd.inputs['Strength'].is_linked and nd.inputs['Strength'].default_value == 0
            if nd.type == 'BUMP' or zero_nm:
                sock = nd.inputs['Height' if nd.type == 'BUMP' else 'Color']
                kill += [l.from_node for l in sock.links if l.from_node.type == 'TEX_IMAGE']
                kill.append(nd)
        names = {k.name for k in kill}
        for name in names:
            nt.nodes.remove(nt.nodes[name])
        n += len(names)
    return n


def pre_sev(objs):
    if drop_bump_maps():
        fl('bump map dropped (source glTF had it as a normal map with strength 0 - no visual effect)')
    for m in bpy.data.materials:
        b = principled(m)
        if b:
            setp(b, 'Metallic', 0.0) if not b.inputs['Metallic'].is_linked else None
            if not b.inputs['Roughness'].is_linked:
                b.inputs['Roughness'].default_value = 0.5


def make_cell_texture(name, w=256, h=256, nx=8, ny=8):
    """Solar-cell grid texture (dark blue cells, light grid) - replaces the procedural brick shader."""
    yy, xx = np.mgrid[0:h, 0:w]
    cx = (xx % (w // nx)); cy = (yy % (h // ny))
    grid = (cx < 2) | (cy < 2)
    a = np.zeros((h, w, 4), np.float32)
    a[..., 0] = 0.020; a[..., 1] = 0.045; a[..., 2] = 0.16; a[..., 3] = 1
    rng = np.random.default_rng(3)
    a[..., :3] *= (0.85 + 0.3 * rng.random((h, w, 1))).astype(np.float32)
    a[grid, :3] = (0.42, 0.44, 0.48)
    im = bpy.data.images.new(name, w, h, alpha=False)
    im.colorspace_settings.name = 'sRGB'
    np_to_img(im, a)
    return im


def pre_solar_wing(objs):
    cells = make_cell_texture('solar_cells')
    for m in bpy.data.materials:
        b = principled(m)
        if b is None:
            continue
        if 'Solar' in m.name:
            plain(m, (1, 1, 1), rough=0.3, metal=0.3)
            t = m.node_tree.nodes.new('ShaderNodeTexImage'); t.image = cells
            m.node_tree.links.new(t.outputs['Color'], b.inputs['Base Color'])
        else:
            plain(m, (0.75, 0.75, 0.72), rough=0.4, metal=0.6)
    fl('solar cells: generated 256 px cell-grid texture (dark blue), frame light metal')


def find_logo_boxes(arr, sat_thr=0.22, dark_thr=0.35, min_px=30):
    """scenes/xks/build_xks.py: connected boxes of strongly coloured or dark pixels."""
    rgb = arr[..., :3]
    mx = rgb.max(-1); mn = rgb.min(-1)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    mask = ((sat > sat_thr) & (mx > 0.15)) | (mx < dark_thr)
    h, w = mask.shape
    seen = np.zeros_like(mask)
    boxes = []
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys, xs):
        if seen[y, x]:
            continue
        stack = [(y, x)]; seen[y, x] = True
        bx0 = bx1 = x; by0 = by1 = y; n = 0
        while stack:
            cy, cx = stack.pop(); n += 1
            bx0 = min(bx0, cx); bx1 = max(bx1, cx); by0 = min(by0, cy); by1 = max(by1, cy)
            for dy in (-2, -1, 0, 1, 2):
                for dx in (-2, -1, 0, 1, 2):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; stack.append((ny, nx))
        if n >= min_px:
            boxes.append((bx0, by0, bx1 + 1, by1 + 1, n))
    return boxes


def fill_rect(arr, x0, y0, x1, y1, ring=6):
    h, w, _ = arr.shape
    x0, x1 = max(0, x0), min(w, x1); y0, y1 = max(0, y0), min(h, y1)
    X0, X1 = max(0, x0 - ring), min(w, x1 + ring); Y0, Y1 = max(0, y0 - ring), min(h, y1 + ring)
    region = arr[Y0:Y1, X0:X1].copy()
    mask = np.ones(region.shape[:2], bool); mask[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = False
    med = np.median(region[mask], axis=0)
    noise = (np.random.default_rng(1).normal(0, 0.008, (y1 - y0, x1 - x0, 1))).astype(np.float32)
    arr[y0:y1, x0:x1, :3] = med[:3] + noise
    return arr


def pre_astronaut(objs):
    # whole US flags (2), NASA meatball, mission patch: rects from sprites_8dir FIXES (top-left px)
    sprite_fixes({'astnt1_1': [('rect', (874, 18, 964, 89)), ('rect', (886, 178, 959, 242)),
                               ('rect', (788, 378, 869, 447)), ('rect', (796, 708, 862, 767))]})
    im = find_img('astnt1_1')
    if im:
        arr = img_np(im)
        painted = []
        for (x0, y0, x1, y1, n) in find_logo_boxes(arr):
            bw, bh = x1 - x0, y1 - y0
            if bw > 6 * bh or bh > 6 * bw:      # long thin red crew stripe: real EMU detail, keep
                continue
            fill_rect(arr, x0 - 3, y0 - 3, x1 + 3, y1 + 3)
            painted.append((x0, y0, x1, y1))
        np_to_img(im, arr)
        fl(f'astnt1_1 texture: {len(painted)} flag / NASA logo / patch areas painted with suit white (xks method)')


def pre_mark_3(objs):
    for m in bpy.data.materials:
        b = principled(m)
        if b is None:
            continue
        n = m.name
        if 'lambert5SG' in n:            # texturelogo = NASA meatball
            plain(m, (0.82, 0.83, 0.86), rough=0.85)
            continue
        if any(k in n for k in ('lambert2SG', 'lambert6SG', 'torso', 'legs', 'hand')):
            setp(b, 'Metallic', 0.0); setp(b, 'Roughness', 0.85)
        elif 'blinn1SG' in n:            # visor
            setp(b, 'Base Color', (0.02, 0.02, 0.025, 1)); setp(b, 'Metallic', 1.0); setp(b, 'Roughness', 0.08)
        else:
            setp(b, 'Metallic', 0.7); setp(b, 'Roughness', 0.4)
    for im in list(bpy.data.images):
        if im.name.startswith('texturelogo'):
            bpy.data.images.remove(im)
    fl('texturelogo (NASA meatball) material -> plain white; visor black; fabric non-metal (oy fix_suits)')


def pre_emu(objs):
    for m in bpy.data.materials:
        b = principled(m)
        if b is None:
            continue
        n = m.name
        if any(k in n for k in ('emusuit5_jetpack2SG', 'lambert9SG', 'lambert8SG')):   # US flag + mission patch
            plain(m, (0.86, 0.86, 0.86), rough=0.9)
        elif 'lambert7SG' in n:          # lettered display/control box
            plain(m, (0.80, 0.80, 0.80), rough=0.8)
        elif 'blinn12SG' in n or 'blinn3SG' in n:   # visor
            setp(b, 'Base Color', (0.85, 0.55, 0.2, 1)); setp(b, 'Metallic', 1.0); setp(b, 'Roughness', 0.12)
        elif 'lambert4SG' in n:
            setp(b, 'Base Color', (0.7, 0.08, 0.08, 1))
        else:
            setp(b, 'Metallic', 0.0)
            if not b.inputs['Roughness'].is_linked:
                b.inputs['Roughness'].default_value = min(b.inputs['Roughness'].default_value, 0.6)
    for im in list(bpy.data.images):
        if im.name.split('.')[0] in ('emusuitFLAGpatch', 'emusuitvitruvianpatch', 'emusuitbox4'):
            bpy.data.images.remove(im)
    fl('emusuitFLAGpatch (US flag), emusuitvitruvianpatch (mission patch), emusuitbox4 (lettering) -> plain white materials, images deleted')


def pre_helmet(objs):
    for o in list(objs):
        if o.type == 'MESH' and not o.name.startswith('helmet_uv2'):
            bpy.data.objects.remove(o, do_unlink=True)
    shell = new_mat('helmet_shell_white', (0.88, 0.87, 0.84), rough=0.3)
    visor = new_mat('helmet_visor_gold', (0.85, 0.62, 0.22), rough=0.08, metal=1.0)
    for o in mesh_objs():
        for s in o.material_slots:
            s.material = visor if (s.material and s.material.name.startswith('visor')) else shell
    fl('stray small parts removed; white shell + gold visor')


def pre_hammer(objs):
    for m in list(bpy.data.materials):
        b = principled(m)
        if b is None:
            continue
        if 'HAMMER-HEAD' in m.name:
            plain(m, (0.55, 0.56, 0.58), rough=0.35, metal=1.0)
        elif 'grip' in m.name.lower():
            plain(m, (0.12, 0.12, 0.12), rough=0.8)
        else:
            plain(m, (0.75, 0.76, 0.78), rough=0.3, metal=1.0)
    fl('steel head, aluminium handle, black grip')


def pre_sample_tube(objs):
    ti = new_mat('tube_titanium', (0.72, 0.72, 0.74), rough=0.3, metal=1.0)
    tin = new_mat('tube_TiN_gold', (0.9, 0.68, 0.3), rough=0.25, metal=1.0)
    alu = new_mat('tube_alumina_white', (0.92, 0.92, 0.9), rough=0.35)
    for o in mesh_objs():
        me = o.data
        me.materials.clear(); me.materials.append(ti); me.materials.append(tin); me.materials.append(alu)
        n = len(me.polygons)
        cen = np.empty(n * 3, np.float32); me.polygons.foreach_get('center', cen)
        M = np.array(o.matrix_world)
        z = (cen.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3])[:, 2]
        t = (z - z.min()) / max(1e-6, z.max() - z.min())
        idx = np.where(t < 0.33, 1, np.where(t < 0.7, 2, 0)).astype(np.int32)
        me.polygons.foreach_set('material_index', idx); me.update()
    fl('3 coating zones painted: gold TiN, white alumina, bare titanium (oy fix_small)')


def post_orion(o):
    me = o.data
    shell = new_mat('orion_backshell', (0.78, 0.79, 0.81), rough=0.3, metal=0.85)
    heat = new_mat('orion_heatshield', (0.22, 0.15, 0.10), rough=0.85)
    dock = new_mat('orion_dock', (0.45, 0.46, 0.48), rough=0.4, metal=0.7)
    me.materials.clear()
    for m in (shell, heat, dock):
        me.materials.append(m)
    n = len(me.polygons)
    cen = np.empty(n * 3, np.float32); me.polygons.foreach_get('center', cen); cen = cen.reshape(-1, 3)
    nor = np.empty(n * 3, np.float32); me.polygons.foreach_get('normal', nor); nor = nor.reshape(-1, 3)
    z = cen[:, 2]; zmin, zmax = z.min(), z.max(); h = zmax - zmin
    idx = np.zeros(n, np.int32)
    idx[(z < zmin + 0.10 * h) & (nor[:, 2] < -0.3)] = 1
    idx[z > zmin + 0.80 * h] = 2
    me.polygons.foreach_set('material_index', idx); me.update()
    fl('silver back-shell, brown Avcoat heat shield, grey docking tunnel (oy paint_orion)')


def pre_apollo_lm(objs):
    sprite_fixes({'TEXTURE_': [('rect', (74, 538, 510, 774))],          # US flag
                  'TEXTUREA': [('rect', (70, 496, 564, 800))]})         # 'UNITED STATES'


def pre_saturn_v(objs):
    sprite_fixes({'SATURNVA': [('redkey', None)], 'SATURNVU': [('redkey', None)],
                  'SATURNVT': [('rect', (316, 508, 606, 538))]})


def sprite_fixes(fx):
    """sprites_8dir/make_sprites.py apply_fixes (rects top-left origin)."""
    for im in list(bpy.data.images):
        for key, ops in fx.items():
            if not im.name.startswith(key):
                continue
            w, h = im.size
            if w == 0:
                continue
            base = img_np(im)
            a = base[::-1]
            for op, arg in ops:
                if op == 'rect':
                    x0, y0, x1, y1 = arg
                    p = 4
                    ring = np.concatenate([
                        a[max(y0 - p, 0):y0, x0:x1, :3].reshape(-1, 3), a[y1:y1 + p, x0:x1, :3].reshape(-1, 3),
                        a[y0:y1, max(x0 - p, 0):x0, :3].reshape(-1, 3), a[y0:y1, x1:x1 + p, :3].reshape(-1, 3)])
                    a[y0:y1, x0:x1, :3] = np.median(ring, axis=0)
                elif op == 'redkey':
                    r, g, b = a[..., 0], a[..., 1], a[..., 2]
                    m = (r > 0.45) & (r - g > 0.15) & (r - b > 0.15)
                    for _ in range(2):
                        m = m | np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)
                    a[m, :3] = np.median(a[~m][:, :3], axis=0)
            np_to_img(im, base)
            fl(f'{im.name}: ' + ', '.join(f'{o}{"" if a_ is None else a_}' for o, a_ in ops) + ' (sprites_8dir FIXES)')


def pre_curiosity(objs):
    im = find_img('tex_05')
    if im:
        load_png_into(im, os.path.join(ROOT, 'scenes', 'mars', 'tex_clean', 'tex_05_jpg.png'))
        fl('tex_05: cleaned copy from scenes/mars/tex_clean (CURIOSITY lettering, MSL/JPL/flag/NASA medallions, MAHLI text, penny)')


def pre_perseverance(objs):
    sc = bpy.context.scene
    sc.frame_set(120)          # "mast up" pose of the glTF action (scenes/mars)
    fl('pose: frame 120 of the glTF action (mast up, 2.23 m)')
    for o in list(objs):
        if o.type != 'MESH':
            continue
        mats = [m.name for m in o.data.materials if m]
        if o.name.startswith('Icosphere') or (mats and all(m == 'transparent' for m in mats)):
            o.hide_render = True    # removed after baking (children keep their pose)
    for nm, fn in (('arm_graphics', 'arm_graphics.png'), ('blade', 'blade.png'),
                   ('mars_2020_03', 'mars_2020_03.png'), ('mars_2020_04', 'mars_2020_04.png')):
        im = find_img(nm)
        if im:
            load_png_into(im, os.path.join(ROOT, 'scenes', 'mars', 'tex_clean', fn))
            fl(f'{nm}: cleaned copy from scenes/mars/tex_clean')


def pre_gateway(objs):
    im = find_img('DSXR_BaseColor')
    if im:
        load_png_into(im, os.path.join(ROOT, 'scenes', 'koinot', 'tex', 'gateway_DSXR_BaseColor_clean.png'))
        fl("DSXR_BaseColor: 'Canada' wordmark - cleaned copy from scenes/koinot/tex")


def pre_lro(objs):
    for o in list(objs):
        if o.name.startswith('_root') and o.type == 'MESH':
            o.hide_render = True
    GOLD = (0.92, 0.62, 0.22)
    for mn in ('foil_silver', 'foil_silver_dish', 'foil_gold'):
        m = bpy.data.materials.get(mn)
        if m:
            col = GOLD if mn == 'foil_gold' else ((0.78, 0.78, 0.80) if mn == 'foil_silver' else (0.85, 0.85, 0.86))
            plain(m, col, rough=0.3, metal=0.95, keep_normal=True)
    fl('helper cube removed; foil blankets silver/gold (koinot)')


def pre_dsn_34m(objs):
    by = {o.name.split('.')[0]: o for o in objs}
    if '_root' in by:
        by['_root'].hide_render = True
    # dish: white inner ring (real DSN dishes are white)
    if 'dish_center' in by:
        w = new_mat('DSN_dish_inner_white', (0.79, 0.80, 0.81), rough=0.45)
        for s in by['dish_center'].material_slots:
            s.material = w
    # aim the dish 45 deg up toward the front (-Y Blender = +Z glTF) instead of the zenith
    if 'azimuth' in by and 'elevation' in by:
        az_o, el_o = by['azimuth'], by['elevation']
        az_o.rotation_mode = 'XYZ'; el_o.rotation_mode = 'XYZ'
        want = Vector((0, -0.7071, 0.7071))
        best = None
        for az in range(-180, 180, 10):
            for tilt in range(-75, 76, 5):
                az_o.rotation_euler.z = math.radians(az)
                el_o.rotation_euler.x = math.radians(tilt)
                bpy.context.view_layer.update()
                ax = (el_o.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
                d = ax.dot(want)
                if best is None or d > best[0]:
                    best = (d, az, tilt)
        az_o.rotation_euler.z = math.radians(best[1]); el_o.rotation_euler.x = math.radians(best[2])
        bpy.context.view_layer.update()
        fl(f'helper _root box removed; dish inner ring white; dish aimed 45 deg up to the front (az {best[1]}, tilt {best[2]})')


def pre_iss(objs):
    for o in list(objs):
        if o.name.startswith(('bendedtru', 'pCylinder')):
            bpy.data.objects.remove(o, do_unlink=True)
    for m in bpy.data.materials:
        b = principled(m)
        if b is None:
            continue
        if m.name.startswith('lambert7SG'):          # the 8 big solar wings (flat, 45 x 30 model units)
            plain(m, (0.42, 0.27, 0.09), rough=0.35, metal=0.4)
        elif m.name.startswith(('lambert3SG', 'anisotropic')):   # truss / radiators
            plain(m, (0.62, 0.62, 0.63), rough=0.45, metal=0.3)
        else:                                          # pressurised modules: white blankets
            plain(m, (0.78, 0.78, 0.75), rough=0.6)
    fl('7 stray discs/trusses 41 units away removed (xks); flat grey source -> amber solar wings, white modules, grey truss')


def pre_robonaut_2(objs):
    for o in list(objs):
        if o.name == 'R2.Hips' and o.type == 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    cols = {
        'BlackMetal': ((0.03, 0.03, 0.035), 0.8, 0.35), 'BlueLights': ((0.1, 0.35, 1.0), 0.0, 0.3),
        'Chrome.Rough': ((0.75, 0.75, 0.76), 1.0, 0.25), 'GreyMetal': ((0.40, 0.40, 0.42), 0.9, 0.35),
        'R2.Backpack': ((0.80, 0.80, 0.78), 0.0, 0.45), 'R2.ChestCover': ((0.85, 0.85, 0.83), 0.0, 0.35),
        'R2.GoldMetal': ((0.90, 0.68, 0.32), 1.0, 0.25), 'R2.GoldMetal.Head': ((0.92, 0.72, 0.35), 1.0, 0.2),
        'R2.WhiteCloth.Arm': ((0.86, 0.86, 0.84), 0.0, 0.8), 'R2.WhiteCloth.Generic': ((0.86, 0.86, 0.84), 0.0, 0.8),
        'R2.WhiteCloth.Generic.001': ((0.86, 0.86, 0.84), 0.0, 0.8), 'Visor.001': ((0.02, 0.02, 0.03), 0.6, 0.05),
        'WhitePlastic': ((0.86, 0.86, 0.85), 0.0, 0.4)}
    for name, (col, met, rough) in cols.items():
        m = bpy.data.materials.get(name)
        if m:
            plain(m, col, rough=rough, metal=met)
            if name == 'BlueLights':
                b = principled(m)
                b.inputs['Emission Color'].default_value = (0.1, 0.4, 1.0, 1)
                b.inputs['Emission Strength'].default_value = 3.0
    fl("stray 'R2.Hips' under the feet removed; colours white/gold/black (xks)")


def pre_oru(objs):
    for name in ('spstob_eal_1', 'spstob_slic_1a', 'spstob_slic_2', 'naming'):
        m = bpy.data.materials.get(name)
        b = principled(m)
        if b:
            setp(b, 'Metallic', 1.0); setp(b, 'Roughness', 0.32)


def post_sls(o):
    """yer build_sls: per-part materials (orange core, white boosters/upper stack, grey engines);
    the STL 3D-print stand (z < 5.5 units before scaling) is deleted."""
    me = o.data
    lab = loose_labels(me)
    nv = len(me.vertices)
    co = np.zeros(nv * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    # o is in metres already (scaled about the model base) -> convert part tests to model units
    s = CFG['sls']['scale']
    cou = co / s
    cou[:, 2] += 5.0       # undo the base offset (model z 5.0 -> 0)
    parts = {}
    for l in np.unique(lab):
        m = lab == l
        p = cou[m]
        parts[l] = (int(m.sum()), p.min(0), p.max(0))
    mats = dict(core=new_mat('SLS_core_orange', (0.58, 0.20, 0.03), rough=0.75),
                booster=new_mat('SLS_booster_white', (0.82, 0.82, 0.79), rough=0.55),
                upper=new_mat('SLS_upper_white', (0.86, 0.86, 0.84), rough=0.45),
                feed=new_mat('SLS_feedline_orange', (0.52, 0.16, 0.03), rough=0.75),
                rs25=new_mat('SLS_RS25_nozzle', (0.32, 0.32, 0.31), rough=0.35, metal=0.8),
                bracket=new_mat('SLS_bracket_grey', (0.25, 0.25, 0.24), rough=0.5, metal=0.5))
    keys = list(mats)
    me.materials.clear()
    for k in keys:
        me.materials.append(mats[k])
    K = {k: i for i, k in enumerate(keys)}
    npoly = len(me.polygons)
    lt = np.zeros(npoly, np.int64); me.polygons.foreach_get('loop_start', lt)
    lv = np.zeros(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
    plab = lab[lv[lt]]
    midx = np.full(npoly, K['bracket'])
    stand = []
    for l, (n, mn, mx) in parts.items():
        sel = plab == l
        size = mx - mn
        cx = (mn[0] + mx[0]) / 2
        if n <= 8 and mx[2] < 5.5:
            stand.append(l); continue
        if n > 30000 and abs(cx) < 1 and mx[2] < 140:
            midx[sel] = K['core']
        elif n > 5000 and abs(cx) > 5:
            midx[sel] = K['booster']
        elif n > 5000 and mn[2] > 130:
            midx[sel] = K['upper']
        elif n == 499:
            midx[sel] = K['rs25']
        elif n == 24 or size[2] > 60 or n == 156:
            midx[sel] = K['feed']
    me.polygons.foreach_set('material_index', midx.astype(np.int32)); me.update()
    if stand:
        bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
        dl = np.where(np.isin(lab, stand))[0]
        bmesh.ops.delete(bm, geom=[bm.verts[i] for i in dl], context='VERTS')
        bm.to_mesh(me); bm.free()
    fl(f'{len(parts)} parts coloured (orange core stage, white boosters/upper stack, grey RS-25); print stand ({len(stand)} parts) deleted')


ROOM_PALETTE = [('screen', (0.10, 0.45, 0.40), 1.5), ('picture', (0.15, 0.30, 0.55), 1.2),
                ('lights', (1.0, 0.95, 0.80), 3.0), ('keyboard', (0.10, 0.10, 0.11), 0),
                ('namep', (0.70, 0.70, 0.66), 0), ('console_face', (0.20, 0.22, 0.24), 0),
                ('console', (0.55, 0.57, 0.58), 0), ('crstation', (0.45, 0.47, 0.50), 0),
                ('projector', (0.30, 0.30, 0.32), 0), ('floor', (0.22, 0.24, 0.30), 0),
                ('cabnet', (0.50, 0.50, 0.48), 0), ('', (0.62, 0.62, 0.60), 0)]


def pre_mission_control(objs):
    for m in bpy.data.materials:
        b = principled(m)
        if b is None or b.inputs['Base Color'].is_linked:
            continue
        for key, col, em in ROOM_PALETTE:
            if key in m.name.lower():
                setp(b, 'Base Color', (*col, 1)); setp(b, 'Metallic', 0.0); setp(b, 'Roughness', 0.6)
                if em:
                    b.inputs['Emission Color'].default_value = (*col, 1)
                    b.inputs['Emission Strength'].default_value = em
                break
    fl('palette by material name (source colours are all black); console name plates plain (no lettering)')


def enhance_by_name(cell_col=(0.018, 0.032, 0.10)):
    """koinot enhance_by_name without procedural bump: CAD colours -> space-hardware looks."""
    GOLD = (0.92, 0.62, 0.22); SILVER = (0.86, 0.86, 0.88)
    for m in bpy.data.materials:
        b = principled(m)
        if b is None:
            continue
        n = m.name.lower()
        base = b.inputs['Base Color'].default_value
        if ('solar' in n and 'back' not in n) or 'calipso' in n or 'parasol' in n:
            setp(b, 'Base Color', (base[0] * 0.35 + cell_col[0], base[1] * 0.35 + cell_col[1], base[2] * 0.45 + cell_col[2], 1))
            setp(b, 'Metallic', 0.1); setp(b, 'Roughness', 0.38)
        elif 'solarback' in n:
            setp(b, 'Base Color', (0.55, 0.55, 0.58, 1)); setp(b, 'Metallic', 0.2); setp(b, 'Roughness', 0.5)
        elif 'gold' in n:
            setp(b, 'Base Color', (*GOLD, 1)); setp(b, 'Metallic', 1.0); setp(b, 'Roughness', 0.32)
        elif 'bronze' in n:
            setp(b, 'Base Color', (0.80, 0.55, 0.30, 1)); setp(b, 'Metallic', 1.0); setp(b, 'Roughness', 0.38)
        elif 'silver' in n:
            setp(b, 'Base Color', (*SILVER, 1)); setp(b, 'Metallic', 1.0); setp(b, 'Roughness', 0.28)
        elif 'white' in n or 'dish' in n:
            setp(b, 'Base Color', (0.80, 0.80, 0.78, 1)); setp(b, 'Metallic', 0.0); setp(b, 'Roughness', 0.55)
        elif 'black' in n or 'magboom' in n:
            setp(b, 'Base Color', (0.035, 0.035, 0.04, 1)); setp(b, 'Metallic', 0.0); setp(b, 'Roughness', 0.42)
        elif 'brown' in n:
            setp(b, 'Base Color', (0.62, 0.60, 0.57, 1)); setp(b, 'Metallic', 0.0); setp(b, 'Roughness', 0.6)
        elif 'grey' in n or 'mainbody' in n:
            setp(b, 'Metallic', 0.0); setp(b, 'Roughness', 0.55)


def pre_sdo(objs):
    enhance_by_name()
    for mn in ('SDO-mainbody-sm', 'SDO-mainbody-fl', 'SDO-mainbody2-sm2', 'SDO-mainbodyTop-sm'):
        m = bpy.data.materials.get(mn)
        if m:
            plain(m, (0.075, 0.08, 0.10), rough=0.33, metal=0.7)
    fl('custom normals pointed inward (render black) -> cleared + recomputed; black/silver/gold blankets (koinot)')


def post_sdo(o):
    clear_custom_normals(o)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(o.data); bm.free()
    smooth_by_angle(o)


def pre_goes(objs):
    enhance_by_name(cell_col=(0.02, 0.035, 0.11))
    for m in bpy.data.materials:
        if m.name.startswith('Parasol') or m.name == 'Goes2-solarpanel-faces':
            b = principled(m); setp(b, 'Base Color', (0.10, 0.065, 0.035, 1)); setp(b, 'Metallic', 0.55); setp(b, 'Roughness', 0.28)
        elif m.name in ('Goes2-main-silver-sm', 'Goes2-main-silver-fl'):
            b = principled(m); setp(b, 'Base Color', (0.10, 0.10, 0.11, 1)); setp(b, 'Metallic', 0.5); setp(b, 'Roughness', 0.35)
    fl('black blankets, dark bronze solar wing (koinot)')


def pre_mobile_launcher(objs):
    """yer ml_materials: lift the dark NASA texture to a pale painted-steel grey (Artemis I photos)."""
    for m in bpy.data.materials:
        b = principled(m)
        if b is None:
            continue
        setp(b, 'Metallic', 0.25)
        if not b.inputs['Roughness'].is_linked:
            b.inputs['Roughness'].default_value = 0.6
    im = find_img('mobilelauncher_d')
    if im and not im.name.startswith('mobilelauncher_railings'):
        a = img_np(im)
        a[..., :3] = 0.22 + 0.85 * a[..., :3]
        np_to_img(im, a)
        fl('mobilelauncher_d texture lifted to painted-steel grey (yer)')


def pre_viking(objs):
    for m in bpy.data.materials:
        b = principled(m)
        if b:
            setp(b, 'Roughness', 0.55)


def pre_globe(objs):
    for o in mesh_objs():
        o.data.shade_smooth()
    for m in bpy.data.materials:
        b = principled(m)
        if b:
            setp(b, 'Roughness', 1.0 if 'earth' not in m.name.lower() else 0.7); setp(b, 'Metallic', 0.0)


def post_terrain(o, mid):
    """3D-print tiles: drop the slab (base + side walls) -> only the top surface stays."""
    co = np.empty(len(o.data.vertices) * 3); o.data.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    zmin = co[:, 2].min(); span = co[:, 2].max() - zmin
    eps = span * 1e-3
    bm = bmesh.new(); bm.from_mesh(o.data)
    kill = [f for f in bm.faces if any(v.co.z < zmin + eps for v in f.verts)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.to_mesh(o.data); bm.free()
    reg = new_mat('regolith', (0.36, 0.35, 0.34), rough=0.95)
    o.data.materials.clear(); o.data.materials.append(reg)
    fl(f'print slab removed ({len(kill)} faces); regolith grey material')


PRE = {'hdu-1': pre_hdu_1, 'hdu-2': pre_hdu_2, 'crew-lock-bag': pre_crew_lock_bag, 'rassor': pre_rassor,
       'sev': pre_sev, 'solar-wing': pre_solar_wing, 'astronaut': pre_astronaut, 'mark-3': pre_mark_3,
       'emu': pre_emu, 'helmet': pre_helmet, 'hammer': pre_hammer, 'sample-tube': pre_sample_tube,
       'apollo-lm': pre_apollo_lm, 'saturn-v': pre_saturn_v, 'curiosity': pre_curiosity,
       'perseverance': pre_perseverance, 'gateway': pre_gateway, 'lro': pre_lro, 'dsn-34m': pre_dsn_34m,
       'iss': pre_iss, 'robonaut-2': pre_robonaut_2, 'oru': pre_oru, 'mission-control': pre_mission_control,
       'sdo': pre_sdo, 'goes': pre_goes, 'viking': pre_viking, 'mobile-launcher': pre_mobile_launcher,
       'moon-globe': pre_globe, 'earth-globe': pre_globe, 'mars-globe': pre_globe}
def post_rassor(o):
    """2.0 M-tri shrink-wrapped CAD mesh with thin sheet-metal drums.  Plain collapse decimation stalls
    (~49k tris) and crumples the drums, so: weld, thicken sheets (solidify 12 mm), voxel remesh (6 mm)
    -> one clean watertight surface, which then decimates evenly to the budget."""
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bm.to_mesh(me); bm.free()
    so = o.modifiers.new('so', 'SOLIDIFY'); so.thickness = 0.012; so.offset = 0.0
    rm = o.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = 0.006; rm.adaptivity = 0.0
    dg = bpy.context.evaluated_depsgraph_get()
    nm = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); old = o.data
    o.modifiers.clear(); o.data = nm
    if not nm.materials:
        for m in old.materials:
            nm.materials.append(m)
    bpy.data.meshes.remove(old)
    fl(f'solidify 12 mm + voxel remesh 6 mm -> {tri_count(nm)} tris (clean watertight surface), then collapse')


def post_sample_tube(o):
    mats = list(o.data.materials)
    rm = o.modifiers.new('rm', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = 0.0004; rm.adaptivity = 0.0
    dg = bpy.context.evaluated_depsgraph_get()
    nm = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); old = o.data
    o.modifiers.clear(); o.data = nm
    bpy.data.meshes.remove(old)
    nm.materials.clear()
    for m in mats:
        nm.materials.append(m)
    n = len(nm.polygons)
    cen = np.empty(n * 3, np.float32); nm.polygons.foreach_get('center', cen)
    z = cen.reshape(-1, 3)[:, 2]
    t = (z - z.min()) / max(1e-6, z.max() - z.min())
    idx = np.where(t < 0.33, 1, np.where(t < 0.7, 2, 0)).astype(np.int32)
    nm.polygons.foreach_set('material_index', idx); nm.update()
    fl('voxel remesh 0.4 mm before decimation (clean open end)')


POST = {'hdu-2': post_hdu_2, 'orion': post_orion, 'sls': post_sls, 'sdo': post_sdo, 'rassor': post_rassor,
        'sample-tube': post_sample_tube}


# --------------------------------------------------------------------------- collision
def surface_samples(o, n=40000, seed=0):
    me = o.data
    me.calc_loop_triangles()
    nt = len(me.loop_triangles)
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    if nt == 0:
        return co
    tv = np.empty(nt * 3, np.int64); me.loop_triangles.foreach_get('vertices', tv); tv = tv.reshape(-1, 3)
    A, B, C = co[tv[:, 0]], co[tv[:, 1]], co[tv[:, 2]]
    area = 0.5 * np.linalg.norm(np.cross(B - A, C - A), axis=1)
    rng = np.random.default_rng(seed)
    p = area / max(area.sum(), 1e-12)
    idx = rng.choice(nt, size=n, p=p)
    r1 = np.sqrt(rng.random(n)); r2 = rng.random(n)
    pts = (1 - r1)[:, None] * A[idx] + (r1 * (1 - r2))[:, None] * B[idx] + (r1 * r2)[:, None] * C[idx]
    return np.concatenate([pts, co])


def fit_boxes(P, maxb, minsize):
    """Greedy SAH-like splitting of the point cloud into <= maxb axis-aligned boxes."""
    def box(Q):
        lo, hi = Q.min(0), Q.max(0)
        c = (lo + hi) / 2
        s = np.maximum(hi - lo, minsize)
        return c - s / 2, c + s / 2

    def vol(b):
        return float(np.prod(b[1] - b[0]))
    sets = [P]
    total = vol(box(P))
    while len(sets) < maxb:
        best = None
        for si, Q in enumerate(sets):
            if len(Q) < 200:
                continue
            v0 = vol(box(Q))
            for ax in range(3):
                qs = np.sort(Q[:, ax])
                for f in np.linspace(0.08, 0.92, 22):
                    t = qs[int(f * (len(qs) - 1))]
                    L, R = Q[Q[:, ax] <= t], Q[Q[:, ax] > t]
                    if len(L) < 50 or len(R) < 50:
                        continue
                    gain = v0 - vol(box(L)) - vol(box(R))
                    if best is None or gain > best[0]:
                        best = (gain, si, L, R, v0)
        if best is None:
            break
        gain, si, L, R, v0 = best
        if gain < 0.15 * v0 or gain < 0.03 * total:
            break
        sets[si:si + 1] = [L, R]
    return [box(Q) for Q in sets]


def make_collider(main, mid, kind):
    name = 'COL_' + mid
    P = world_pts([main])
    lo, hi = P.min(0), P.max(0)
    extent = float(max(hi - lo))
    if kind == 'terrain':
        me = main.data.copy()
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.clear()
        decimate_to(o, 4000, weld=False)
        o['collider'] = 'mesh'
        return o, None
    if kind == 'room':
        S = surface_samples(main)
        t = 0.2
        boxes = [(np.array([lo[0], lo[1], lo[2] - t]), np.array([hi[0], hi[1], lo[2]])),          # floor
                 (np.array([lo[0] - t, lo[1], lo[2]]), np.array([lo[0], hi[1], hi[2]])),          # walls
                 (np.array([hi[0], lo[1], lo[2]]), np.array([hi[0] + t, hi[1], hi[2]])),
                 (np.array([lo[0], lo[1] - t, lo[2]]), np.array([hi[0], lo[1], hi[2]])),
                 (np.array([lo[0], hi[1], lo[2]]), np.array([hi[0], hi[1] + t, hi[2]]))]
        inner = S[(S[:, 2] > lo[2] + 0.05) & (S[:, 2] < lo[2] + 1.6) &
                  (S[:, 0] > lo[0] + 0.4) & (S[:, 0] < hi[0] - 0.4) & (S[:, 1] > lo[1] + 0.4) & (S[:, 1] < hi[1] - 0.4)]
        if len(inner) > 500:
            boxes += fit_boxes(inner, 8, 0.1)
    else:
        S = surface_samples(main)
        minsize = max(0.02 * extent, 0.004)
        boxes = fit_boxes(S, MAXBOX[kind], minsize)
    verts, faces = [], []
    for (a, b) in boxes:
        k = len(verts)
        for z in (a[2], b[2]):
            for (x, y) in ((a[0], a[1]), (b[0], a[1]), (b[0], b[1]), (a[0], b[1])):
                verts.append((float(x), float(y), float(z)))
        faces += [(k, k + 3, k + 2, k + 1), (k + 4, k + 5, k + 6, k + 7), (k, k + 1, k + 5, k + 4),
                  (k + 1, k + 2, k + 6, k + 5), (k + 2, k + 3, k + 7, k + 6), (k + 3, k, k + 4, k + 7)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces); me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    # boxes in glTF axes (x, y-up, z = -blender y): [cx, cy, cz, sx, sy, sz]
    gl = []
    for (a, b) in boxes:
        c = (a + b) / 2; s = b - a
        gl.append([round(float(c[0]), 4), round(float(c[2]), 4), round(float(-c[1]), 4),
                   round(float(s[0]), 4), round(float(s[2]), 4), round(float(s[1]), 4)])
    o['collider'] = 'boxes'
    o['boxes'] = json.dumps(gl)
    return o, gl


# --------------------------------------------------------------------------- main
def build(mid):
    cfg = CFG[mid]
    kind = cfg['kind']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, mid + '.glb'))
    for o in list(bpy.data.objects):
        if o.type in ('CAMERA', 'LIGHT'):
            bpy.data.objects.remove(o, do_unlink=True)
    objs = list(bpy.data.objects)
    src_tris = sum(tri_count(o.data) for o in objs if o.type == 'MESH')
    log(f'{mid}: imported {len(objs)} objects, {src_tris} tris')
    if mid in PRE:
        PRE[mid](objs)
    fix_transmission()
    bpy.context.view_layer.update()
    # --- bake every visible mesh into world space (evaluated: pose/armature/modifiers), join
    dg = bpy.context.evaluated_depsgraph_get()
    baked = []
    originals = list(bpy.data.objects)
    for o in [x for x in originals if x.type == 'MESH' and not x.hide_render]:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
        M = o.matrix_world.copy()
        me.transform(M)
        if M.determinant() < 0:
            me.flip_normals()
        nb = bpy.data.objects.new(o.name + '_b', me)
        baked.append(nb)
    for o in originals:
        bpy.data.objects.remove(o, do_unlink=True)
    for o in baked:
        sc.collection.objects.link(o)
    # unify UV layer names so join keeps one UV map
    for o in baked:
        uvs = o.data.uv_layers
        while len(uvs) > 1:
            uvs.remove(uvs[-1])
        if len(uvs) == 1:
            uvs[0].name = 'UVMap'
    main = baked[0]
    if len(baked) > 1:
        with bpy.context.temp_override(active_object=main, object=main, selected_objects=baked,
                                       selected_editable_objects=baked):
            bpy.ops.object.join()
    main.name = mid
    main.data.name = mid
    # --- scale / yaw / origin
    sc_ = cfg['scale']
    if isinstance(sc_, tuple) and sc_[0] == 'fitz':
        P = world_pts([main])
        s = sc_[1] / float(P[:, 2].max() - P[:, 2].min())
        S = Matrix.Diagonal((s, s, s, 1.0))
        scale_info = s
    elif isinstance(sc_, tuple):
        S = Matrix.Diagonal((sc_[0], sc_[0], sc_[1], 1.0))
        scale_info = list(sc_)
    else:
        S = Matrix.Diagonal((sc_, sc_, sc_, 1.0))
        scale_info = sc_
    if mid == 'sls':       # rocket base (model z = 5.0) -> 0, before the stand is removed
        main.data.transform(Matrix.Translation((0, 0, -5.0)))
    R = Matrix.Rotation(math.radians(cfg.get('yaw', 0)), 4, 'Z')
    main.data.transform(R @ S)
    if 'frame' in cfg:     # hdu-1/hdu-2 share NASA's frame: deck base z = 0, shell axis at x = y = 0
        f = cfg['frame']
        s0 = scale_info if not isinstance(scale_info, list) else scale_info[0]
        main.data.transform(Matrix.Translation((f[0] * s0, f[1] * s0, f[2] * s0)))
    if mid in POST:
        POST[mid](main)
    if kind == 'terrain':
        post_terrain(main, mid)
    P = world_pts([main])
    lo, hi = P.min(0), P.max(0)
    if 'frame' not in cfg:
        if cfg.get('origin') == 'center':
            off = -(lo + hi) / 2
        else:
            off = np.array([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]])
        main.data.transform(Matrix.Translation(Vector(off.tolist())))
    # --- triangles
    budget = BUDGET[kind]
    tris = decimate_to(main, budget)
    if kind == 'globe':
        main.data.shade_smooth()
    # --- textures
    tex = cfg.get('tex', 512)
    texinfo = downscale_textures(tex, min(tex, 512))
    for im in list(bpy.data.images):
        if im.users == 0:
            bpy.data.images.remove(im)
    # --- collision
    col, boxes = make_collider(main, mid, kind)
    main['asset_id'] = mid
    main['units'] = 'metres'
    P = world_pts([main])
    lo, hi = P.min(0), P.max(0)
    size_gl = [float(hi[0] - lo[0]), float(hi[2] - lo[2]), float(hi[1] - lo[1])]
    # --- export
    for o in bpy.data.objects:
        o.select_set(o in (main, col))
    out = os.path.join(ASSETS, mid + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
        export_image_format='WEBP', export_image_quality=82,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=18 if kind == 'terrain' else 14,
        export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
        export_extras=True, export_animations=False, export_cameras=False, export_lights=False,
        export_materials='EXPORT', export_tangents=False)
    st = dict(id=mid, kind=kind, file=os.path.basename(out), bytes=os.path.getsize(out),
              source_tris=src_tris, tris=tri_count(main.data), budget=budget,
              scale_from_source=scale_info, yaw_deg=cfg.get('yaw', 0),
              bbox_m_gltf_xyz=[round(v, 4) for v in size_gl],
              materials=len([m for m in main.data.materials if m]), textures=texinfo,
              collider=('mesh' if boxes is None else f'{len(boxes)} boxes'), col_boxes_gltf=boxes,
              fixes=FIXLOG, seconds=round(time.time() - T0, 1))
    with open(os.path.join(WORK, f'build_{mid}.json'), 'w') as f:
        json.dump(st, f, indent=1)
    log(f'EXPORTED {out} {st["bytes"] / 1e6:.2f} MB, tris {st["tris"]}, size {st["bbox_m_gltf_xyz"]}, collider {st["collider"]}')


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    mid = argv[argv.index('--model') + 1]
    os.makedirs(WORK, exist_ok=True)
    try:
        build(mid)
        print('DONE', mid)
    except Exception:
        import traceback
        traceback.print_exc()
        print('FAILED', mid)
        sys.exit(1)
