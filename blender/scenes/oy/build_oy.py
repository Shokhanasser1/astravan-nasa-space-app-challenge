"""OY station (Moon) - Oy karvonsaroyi.  Builds oy.blend from NASA 3D models.

Run (headless):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
      -P scenes/oy/build_oy.py -- [--render ext,ext_storm,cut,cut_storm,sprites,ref]
      [--sprites oy_hdu,oy_sev] [--samples 48] [--res 1280x720] [--threads 0] [--nosave]

--threads 0 (default) = all CPU cores (threads_mode AUTO); N > 0 = fixed N threads.

Re-running rebuilds everything from scratch and overwrites scenes/oy/oy.blend.
1 Blender unit = 1 metre.  Source .glb files are only read, never modified.
3D models: NASA 3D Resources / NASA Science. Not endorsed by NASA.
"""
import bpy, bmesh, math, os, sys, random, time
import numpy as np
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import oy_texclean  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'source', 'models')
TEX = os.path.join(ROOT, 'source', 'tex')
REN = os.path.join(ROOT, 'renders', 'oy')
BLEND = os.path.join(HERE, 'oy.blend')
MOON_R = 1737400.0  # m

# ---------------------------------------------------------------- arguments
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def _arg(name, default=None):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith('--') else True
    return default
RENDER = [r for r in str(_arg('--render', '')).split(',') if r and r != 'True']
SAMPLES = int(_arg('--samples', 48))
RES = tuple(int(v) for v in str(_arg('--res', '1280x720')).split('x'))
NOSAVE = bool(_arg('--nosave', False))
THREADS = int(_arg('--threads', 0))   # 0 = AUTO (all cores)
T0 = time.time()
def log(*a):
    print(f'[oy {time.time()-T0:6.1f}s]', *a, flush=True)

# ------------------------------------------------------------ real scales
# scale = metres per model unit (see docs/oy_nasa_taqqoslash.md for sources)
SCALES = {
    'hdu-1': 5.0 / 165.93,     # PEM hard-shell diameter 5.0 m  (model Y = 165.9 u)
    'hdu-2': 5.0 / 165.93,     # same unit system as hdu-1
    'crew-lock-bag': 0.0254,   # ASSUMED inches - NASA publishes no size for this bag (not a real size)
    'rassor': 1.0,             # already metres
    'sev': 0.76,               # model 5.91 m long; real LER 4.48 m long, 3.05 m high
    'orion': 0.3048 * 5.03 / 4.971,  # STL in feet; heat shield 16.5 ft = 5.03 m
    'mark-3': 0.95,            # 1.99 -> 1.89 m suit height
    'emu': 0.92,               # 2.00 -> 1.84 m incl. PLSS
    'hammer': 1.098,           # 39.1 cm length = UNVERIFIED (not on the NSSDC page, which only gives 1.32 kg)
    'sample-tube': 0.0254,     # inches
    'solar-wing': 50.0,        # tiny generic wing -> 4.5 m x 5 m pair
    'earth-globe': 1.0,
    'apollo-lm': 1.0,
    'moon-near-side': 400000.0 / 78.416,   # 1:5,000,000 print, 400 km across (no exaggeration stated)
}
A11_XY = 30000.0 / 255.5         # apollo-11-site: 30 km tile
A11_Z = A11_XY / 60.0            # undo NASA's 60x vertical exaggeration
HADLEY_Z = 4500.0 / 34.3         # Mons Hadley rises ~4,500 m above the plain (AS15-87-11849)
HADLEY_XY = HADLEY_Z               # no exaggeration stated on the NASA page -> equal scales (tile ~40 km)

# ------------------------------------------------------------------ helpers
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def new_col(name, parent=None, scene=None):
    c = bpy.data.collections.new(name)
    if parent is not None:
        parent.children.link(c)
    elif scene is not None:
        scene.collection.children.link(c)
    return c

def set_active_col(scene, col):
    def find(lc):
        if lc.collection == col:
            return lc
        for ch in lc.children:
            r = find(ch)
            if r:
                return r
    lc = find(scene.view_layers[0].layer_collection)
    scene.view_layers[0].active_layer_collection = lc

def world_coords(objs):
    pts = []
    for o in objs:
        if o.type != 'MESH':
            continue
        n = len(o.data.vertices)
        co = np.empty(n * 3, np.float32)
        o.data.vertices.foreach_get('co', co)
        co = co.reshape(-1, 3)
        M = np.array(o.matrix_world)
        pts.append(co @ M[:3, :3].T + M[:3, 3])
    return np.concatenate(pts) if pts else np.zeros((1, 3))

def principled(m):
    if not m or not m.node_tree:
        return None
    return next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)

def setp(b, name, val):
    i = b.inputs.get(name)
    if i is None:
        return
    for l in list(i.links):
        b.id_data.links.remove(l)
    i.default_value = val

def mat_simple(name, color, rough=0.6, metal=0.0, emit=None, emit_strength=0.0, alpha=1.0, transmission=0.0, ior=1.45):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = principled(m)
    b.inputs['Base Color'].default_value = (*color[:3], 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Transmission Weight'].default_value = transmission
    b.inputs['IOR'].default_value = ior
    b.inputs['Alpha'].default_value = alpha
    if emit:
        b.inputs['Emission Color'].default_value = (*emit[:3], 1)
        b.inputs['Emission Strength'].default_value = emit_strength
    return m

def mat_emit(name, color, strength):
    """Pure emission (alarm beacons): not lit by the red glow lights next to it, so
    AgX keeps it red instead of washing it out to pink/white."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission'); out = nt.nodes.new('ShaderNodeOutputMaterial')
    e.inputs['Color'].default_value = (*color[:3], 1); e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs[0], out.inputs['Surface'])
    return m

def look_at(obj, target, roll=0.0):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    if roll:
        obj.rotation_euler.rotate_axis('Z', roll)

def link_instance(col_asset, scene_col, name, loc=(0, 0, 0), rot_z_deg=0.0, scale=1.0, rot=None):
    e = bpy.data.objects.new(name, None)
    e.instance_type = 'COLLECTION'
    e.instance_collection = col_asset
    e.location = loc
    e.rotation_euler = rot if rot else (0, 0, math.radians(rot_z_deg))
    e.scale = (scale, scale, scale)
    e.empty_display_size = 0.5
    scene_col.objects.link(e)
    return e

# ------------------------------------------------------------ asset import
ASSETS = {}

def import_asset(name, lib_scene, lib_col, rot=(0, 0, 0), scale=None, ground=True, decimate=None, join=False, frame=None):
    """Import source/models/<name>.glb into its own collection, scaled to metres,
    base-centred at origin (x,y centre, z min = 0 when ground=True)."""
    col = new_col('A_' + name, parent=lib_col)
    set_active_col(lib_scene, col)
    bpy.context.window_manager  # noqa
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + '.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:  # importer may also put objects in the scene collection
        if col not in o.users_collection:
            col.objects.link(o)
        for c in list(o.users_collection):
            if c != col:
                c.objects.unlink(o)
    # stop any imported animation
    for o in new:
        if o.animation_data:
            o.animation_data_clear()
    root = bpy.data.objects.new(name + '_ROOT', None)
    col.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    s = SCALES.get(name, 1.0) if scale is None else scale
    R = Euler([math.radians(a) for a in rot]).to_matrix().to_4x4()
    S = Matrix.Diagonal((s, s, s, 1.0))
    root.matrix_world = R @ S
    bpy.context.view_layer.update()
    meshes = [o for o in new if o.type == 'MESH']
    pts = world_coords(meshes)
    mn, mx = pts.min(0), pts.max(0)
    off = Vector((-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2] if ground else -(mn[2] + mx[2]) / 2))
    if frame is not None:          # share another asset's frame (hdu-1 shell sits on hdu-2 deck)
        off = Vector(frame)
    root.matrix_world = Matrix.Translation(off) @ R @ S
    bpy.context.view_layer.update()
    size = mx - mn
    if decimate:
        for o in meshes:
            md = o.modifiers.new('Decimate', 'DECIMATE')
            md.ratio = decimate
            dg = bpy.context.evaluated_depsgraph_get()
            newme = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
            old = o.data; o.modifiers.remove(md); o.data = newme
            bpy.data.meshes.remove(old)
    ASSETS[name] = dict(col=col, root=root, objs=new, meshes=meshes, size=tuple(float(v) for v in size))
    log(f'asset {name}: {len(meshes)} meshes, size m = {size[0]:.2f} x {size[1]:.2f} x {size[2]:.2f}')
    return col

def sanitize_materials(objs, metallic=None, rough=None):
    """glTF exports of these models set Transmission=1 (glass) on opaque parts."""
    done = set()
    for o in objs:
        for sl in getattr(o, 'material_slots', []):
            m = sl.material
            if not m or m.name in done:
                continue
            done.add(m.name)
            b = principled(m)
            if not b:
                continue
            b.inputs['Transmission Weight'].default_value = 0.0
            if metallic is not None:
                b.inputs['Metallic'].default_value = metallic
            if rough is not None:
                b.inputs['Roughness'].default_value = rough

def mats_of(objs):
    out = {}
    for o in objs:
        for sl in getattr(o, 'material_slots', []):
            if sl.material:
                out[sl.material.name] = sl.material
    return out

def find_mat(objs, key):
    for n, m in mats_of(objs).items():
        if key in n:
            return m
    return None

def plain_out(m, color, rough=0.8, metal=0.0):
    """Replace a logo/flag material's texture with a plain colour (brand rules)."""
    if m is None:
        return
    b = principled(m)
    for n in list(m.node_tree.nodes):
        if n.type == 'TEX_IMAGE':
            m.node_tree.nodes.remove(n)
    setp(b, 'Base Color', (*color, 1))
    setp(b, 'Metallic', metal)
    setp(b, 'Roughness', rough)
    setp(b, 'Transmission Weight', 0.0)

# --------------------------------------------------------------- materials
def mat_regolith(name='M_Regolith', base=0.16, coord='Object'):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    b = principled(m)
    tc = N.new('ShaderNodeTexCoord')
    # large albedo patches (ray-like / ejecta variation)
    n1 = N.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 0.012; n1.inputs['Detail'].default_value = 6
    n1.inputs['Roughness'].default_value = 0.6
    L.new(tc.outputs[coord], n1.inputs['Vector'])
    ramp = N.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[0].color = (base * 0.72, base * 0.70, base * 0.68, 1)
    ramp.color_ramp.elements[1].position = 0.75; ramp.color_ramp.elements[1].color = (base * 1.25, base * 1.22, base * 1.18, 1)
    L.new(n1.outputs['Fac'], ramp.inputs['Fac'])
    # fine speckle
    n2 = N.new('ShaderNodeTexNoise'); n2.inputs['Scale'].default_value = 3.0; n2.inputs['Detail'].default_value = 4
    L.new(tc.outputs[coord], n2.inputs['Vector'])
    mix = N.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'OVERLAY'
    mix.inputs['Factor'].default_value = 0.35
    L.new(ramp.outputs['Color'], mix.inputs[6]); L.new(n2.outputs['Fac'], mix.inputs[7])
    L.new(mix.outputs[2], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 1.0
    b.inputs['Specular IOR Level'].default_value = 0.15
    b.inputs['Diffuse Roughness'].default_value = 1.0
    # bump: footprints-scale grain + small pits
    n3 = N.new('ShaderNodeTexNoise'); n3.inputs['Scale'].default_value = 6.0; n3.inputs['Detail'].default_value = 8
    n3.inputs['Roughness'].default_value = 0.65
    L.new(tc.outputs[coord], n3.inputs['Vector'])
    vor = N.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 1.2
    vor.feature = 'F1'
    L.new(tc.outputs[coord], vor.inputs['Vector'])
    mr = N.new('ShaderNodeMath'); mr.operation = 'SMOOTH_MIN'
    mr.inputs[1].default_value = 0.25; mr.inputs[2].default_value = 0.2
    L.new(vor.outputs['Distance'], mr.inputs[0])
    add = N.new('ShaderNodeMath'); add.operation = 'ADD'
    L.new(n3.outputs['Fac'], add.inputs[0]); L.new(mr.outputs[0], add.inputs[1])
    bump = N.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = 0.7; bump.inputs['Distance'].default_value = 0.08
    L.new(add.outputs[0], bump.inputs['Height'])
    L.new(bump.outputs['Normal'], b.inputs['Normal'])
    return m

# ----------------------------------------------------------------- terrain
def a11_height_sampler(lib_col):
    """Load apollo-11-site, scale to 30 km, undo 60x exaggeration.
    Returns (object, f(x,y)->z) where z is relative to tile centre height."""
    col = new_col('DATA_apollo11_site', parent=lib_col)
    set_active_col(bpy.context.scene, col)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, 'apollo-11-site.glb'))
    o = [x for x in bpy.data.objects if x not in before and x.type == 'MESH'][0]
    for c in list(o.users_collection):
        if c != col:
            c.objects.unlink(o)
    if col not in o.users_collection:
        col.objects.link(o)
    o.scale = (A11_XY, A11_XY, A11_Z)
    bpy.context.view_layer.update()
    pts = world_coords([o])
    top = pts[pts[:, 2] > pts[:, 2].min() + 0.01]
    # regular grid from the top surface (nearest-sample binning)
    G = 256
    xs = (top[:, 0] + 15000) / 30000 * (G - 1)
    ys = (top[:, 1] + 15000) / 30000 * (G - 1)
    ix = np.clip(np.round(xs).astype(int), 0, G - 1); iy = np.clip(np.round(ys).astype(int), 0, G - 1)
    grid = np.full((G, G), np.nan)
    grid[iy, ix] = top[:, 2]
    # fill holes
    mask = np.isnan(grid)
    if mask.any():
        grid[mask] = np.nanmean(grid)
    zc = grid[G // 2, G // 2]
    grid -= zc
    o.location.z = -zc
    o.hide_render = True
    o.hide_viewport = True
    log(f'apollo-11-site: real relief {np.nanmax(grid)-np.nanmin(grid):.1f} m over 30 km (after /60)')
    def f(x, y):
        gx = np.clip((x + 15000) / 30000 * (G - 1), 0, G - 1.001)
        gy = np.clip((y + 15000) / 30000 * (G - 1), 0, G - 1.001)
        x0 = np.floor(gx).astype(int); y0 = np.floor(gy).astype(int)
        tx = gx - x0; ty = gy - y0
        g = grid
        return (g[y0, x0] * (1 - tx) * (1 - ty) + g[y0, x0 + 1] * tx * (1 - ty) +
                g[y0 + 1, x0] * (1 - tx) * ty + g[y0 + 1, x0 + 1] * tx * ty)
    return o, f

def build_ground(scene_col, center, height_fn, keepout, rmax=9000.0, nr=300, na=900, seed=7, corridor=None):
    """Polar terrain mesh around the camera: fine near, coarse far, with
    procedural craters, Moon curvature (R = 1737.4 km) and real base heights."""
    rng = np.random.default_rng(seed)
    cx, cy = center
    radii = 0.35 * (rmax / 0.35) ** (np.arange(nr) / (nr - 1))
    ang = np.linspace(0, 2 * np.pi, na, endpoint=False)
    RR, AA = np.meshgrid(radii, ang, indexing='ij')
    X = cx + RR * np.cos(AA); Y = cy + RR * np.sin(AA)
    X = np.concatenate([[cx], X.ravel()]); Y = np.concatenate([[cy], Y.ravel()])
    Z = height_fn(X, Y).astype(np.float64)
    # gentle undulation (spectral synthesis)
    for k in range(40):
        wl = 8.0 * (1500.0 / 8.0) ** rng.random()
        th = rng.random() * np.pi; ph = rng.random() * 2 * np.pi
        amp = 0.0025 * wl * (0.5 + rng.random())
        Z += amp * np.sin((X * np.cos(th) + Y * np.sin(th)) * 2 * np.pi / wl + ph)
    # craters: N(>R) ~ R^-2, small ones only near the camera
    craters = []
    for _ in range(1400):
        Rc = 0.6 * (1.0 / max(1e-4, rng.random())) ** (1 / 1.7)
        Rc = min(Rc, 160.0)
        dmax = min(rmax * 0.9, 60 * Rc + 30)
        rr = dmax * math.sqrt(rng.random()); aa = rng.random() * 2 * math.pi
        px, py = cx + rr * math.cos(aa), cy + rr * math.sin(aa)
        ok = True
        if Rc > 2.0 and corridor is not None:
            (ax, ay), (bx2, by2) = corridor
            vx, vy = bx2 - ax, by2 - ay; L2 = vx * vx + vy * vy
            t = max(0.0, min(1.0, ((px - ax) * vx + (py - ay) * vy) / L2))
            dd = math.hypot(px - (ax + t * vx), py - (ay + t * vy))
            if dd < Rc * 2.2 + 25:
                ok = False
        for (kx, ky, kr) in keepout:
            if math.hypot(px - kx, py - ky) < kr + Rc * 1.6:
                ok = False; break
        if ok:
            craters.append((px, py, Rc))
    log(f'ground: {len(X)} verts, {len(craters)} craters')
    for (px, py, Rc) in craters:
        reach = Rc * 2.5
        m = (np.abs(X - px) < reach) & (np.abs(Y - py) < reach)
        if not m.any():
            continue
        r = np.hypot(X[m] - px, Y[m] - py) / Rc
        fresh = rng.random()
        d = Rc * (0.18 + 0.22 * fresh) * 0.9
        h = Rc * (0.03 + 0.05 * fresh)
        z = np.where(r < 1, -d + (d + h) * r ** 2.2, h * np.exp(-(r - 1) * (3.0 + 2 * (1 - fresh))))
        Z[m] += z
    # flatten the base pad + keepouts
    for (kx, ky, kr) in keepout:
        r = np.hypot(X - kx, Y - ky)
        w = np.clip((r - kr) / (kr * 0.3 + 3), 0, 1)
        w = w * w * (3 - 2 * w)
        inside = r < kr
        z0 = float(Z[inside].mean()) if inside.any() else float(height_fn(np.array([kx]), np.array([ky]))[0])
        Z = z0 + (Z - z0) * w
    # Moon curvature relative to camera ground point
    Z -= ((X - cx) ** 2 + (Y - cy) ** 2) / (2 * MOON_R)
    verts = np.stack([X, Y, Z], 1)
    faces = []
    # centre fan
    for j in range(na):
        faces.append((0, 1 + j, 1 + (j + 1) % na))
    idx = lambda i, j: 1 + i * na + (j % na)
    I = np.arange(nr - 1)[:, None]; J = np.arange(na)[None, :]
    a = 1 + I * na + J; b2 = 1 + I * na + (J + 1) % na
    c = 1 + (I + 1) * na + (J + 1) % na; d2 = 1 + (I + 1) * na + J
    quads = np.stack([a, b2, c, d2], -1).reshape(-1, 4)
    me = bpy.data.meshes.new('Ground')
    me.from_pydata(verts.tolist(), [], faces + quads.tolist())
    me.update()
    for p in me.polygons:
        pass
    me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
    ob = bpy.data.objects.new('Ground', me)
    scene_col.objects.link(ob)
    return ob, craters

def make_rocks(scene_col, lib_col, center, keepout, craters, n=520, seed=11, rmax=150.0, mat=None):
    rng = np.random.default_rng(seed)
    rcol = new_col('A_rocks', parent=lib_col)
    protos = []
    for k in range(6):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
        for v in bm.verts:
            p = v.co
            nz = (math.sin(p.x * 3.1 + k) * math.cos(p.y * 2.7 + 2 * k) * 0.18 +
                  math.sin(p.z * 4.3 + 3 * k) * 0.1 + (rng.random() - 0.5) * 0.08)
            v.co = p * (1 + nz)
            v.co.z *= 0.62 + 0.2 * rng.random()
            v.co.x *= 0.8 + 0.4 * rng.random()
        me = bpy.data.meshes.new(f'rock{k}'); bm.to_mesh(me); bm.free()
        me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool))
        o = bpy.data.objects.new(f'rock_proto{k}', me)
        o.data.materials.append(mat)
        rcol.objects.link(o)
        protos.append(me)
    cx, cy = center
    out = []
    for i in range(n):
        r = rmax * rng.random() ** 1.6 + 2.5
        a = rng.random() * 2 * math.pi
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        if any(math.hypot(x - kx, y - ky) < kr for (kx, ky, kr) in keepout):
            continue
        s = 0.06 + 0.5 * rng.random() ** 3
        if rng.random() < 0.03:
            s *= 3
        o = bpy.data.objects.new(f'rock_{i:03d}', protos[i % len(protos)])
        o.location = (x, y, 0)
        o.rotation_euler = (rng.random() * 0.4, rng.random() * 0.4, rng.random() * 6.28)
        o.scale = (s, s, s)
        scene_col.objects.link(o)
        out.append(o)
    return out

_BVH = {}
def drop_to_ground(objs, ground, extra=0.0, sink=0.0):
    """Place objects/instances on the ground surface (ray down)."""
    if ground.name not in _BVH:
        bm = bmesh.new(); bm.from_mesh(ground.data)
        _BVH[ground.name] = BVHTree.FromBMesh(bm); bm.free()
    bvh = _BVH[ground.name]
    for o in objs:
        loc = o.location
        hit = bvh.ray_cast(Vector((loc.x, loc.y, 5000.0)), Vector((0, 0, -1)))
        if hit[0] is not None:
            o.location.z = hit[0].z + extra - sink * (o.scale.z if o.type == 'MESH' else 0)

def import_hadley(scene_col, lib_col, center, az_deg=12.0, dist=20000.0, plain_z=-140.0, cut_r=9500.0):
    """Mount Hadley terrain print -> real metres, placed on the horizon with curvature."""
    before = set(bpy.data.objects)
    set_active_col(bpy.context.scene, lib_col)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, 'mount-hadley.glb'))
    o = [x for x in bpy.data.objects if x not in before and x.type == 'MESH'][0]
    for c in list(o.users_collection):
        if c != scene_col:
            c.objects.unlink(o)
    if scene_col not in o.users_collection:
        scene_col.objects.link(o)
    o.name = 'MountHadley'
    me = o.data
    n = len(me.vertices)
    co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3).astype(np.float64)
    M = np.array(o.matrix_world); co = co @ M[:3, :3].T + M[:3, 3]
    zmin = co[:, 2].min()
    bottom = co[:, 2] < zmin + 1e-3
    plain_u = np.median(co[~bottom, 2][co[~bottom, 2] < np.percentile(co[~bottom, 2], 60)])
    # massif centroid (top 15% heights) -> aim it at the camera direction
    hi = co[:, 2] > np.percentile(co[~bottom, 2], 85)
    mc = co[hi, :2].mean(0)
    xy = (co[:, :2] - mc) * HADLEY_XY
    z = (co[:, 2] - plain_u) * HADLEY_Z + plain_z
    a = math.radians(az_deg)
    # tile +Y (where the massif is cut by the tile edge) must point away from camera
    ca, sa = math.cos(-a), math.sin(-a)
    rx = xy[:, 0] * ca - xy[:, 1] * sa; ry = xy[:, 0] * sa + xy[:, 1] * ca
    cx, cy = center
    X = cx + dist * math.sin(a) + rx; Y = cy + dist * math.cos(a) + ry
    Z = z - ((X - cx) ** 2 + (Y - cy) ** 2) / (2 * MOON_R)
    newco = np.stack([X, Y, Z], 1)
    o.matrix_world = Matrix.Identity(4)
    me.vertices.foreach_set('co', newco.astype(np.float32).ravel())
    me.update()
    # delete slab bottom and anything inside the near-ground radius
    bm = bmesh.new(); bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    kill = [v for i, v in enumerate(bm.verts) if bottom[i] or math.hypot(v.co.x - cx, v.co.y - cy) < cut_r]
    bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    peak = newco[:, 2].max() - plain_z
    log(f'Mount Hadley: peak {peak:.0f} m above plain, massif at {dist/1000:.1f} km')
    return o

def import_earth(scene_col, lib_col, cam_loc, az_deg, el_deg, dist=60000.0, ang_diam_deg=1.9):
    col = import_asset('earth-globe', bpy.context.scene, lib_col, ground=False, scale=1.0)
    r = dist * math.tan(math.radians(ang_diam_deg / 2))
    a, e = math.radians(az_deg), math.radians(el_deg)
    d = Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))
    inst = link_instance(col, scene_col, 'Earth', loc=Vector(cam_loc) + d * dist, scale=r)
    inst.rotation_euler = (math.radians(-23.4), 0, math.radians(200))
    m = find_mat(ASSETS['earth-globe']['objs'], 'Earth')
    if m:
        b = principled(m); b.inputs['Roughness'].default_value = 0.7
        b.inputs['Specular IOR Level'].default_value = 0.3
    return inst

# ------------------------------------------------------------ asset fixes
def fix_hdu1():
    objs = ASSETS['hdu-1']['objs']
    sanitize_materials(objs, metallic=0.0, rough=0.55)
    for m in mats_of(objs).values():
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and n.image.name.startswith('HDU_01'):
                clean = oy_texclean.clean_image(bpy, n.image, oy_texclean.TEX_RECTS['HDU_01'], 'HDU_01_clean_nologo')
                n.image = clean
                log('hdu-1: flags / NASA logos / lettering painted out -> HDU_01_clean_nologo')

def fix_hdu2():
    """hdu-2 = deck/cradle, stairs, porch, cable box, plus 8 dark radial fins that do
    NOT exist on the real DSH (NASA photo 2011) -> remove the fins; yellow rails -> white."""
    objs = ASSETS['hdu-2']['objs']
    sanitize_materials(objs, metallic=0.0, rough=0.6)
    o = ASSETS['hdu-2']['meshes'][0]
    M = o.matrix_world.copy(); M3 = M.to_3x3()
    bm = bmesh.new(); bm.from_mesh(o.data)
    kill = []
    for f in bm.faces:
        c = M @ f.calc_center_median()
        n = (M3 @ f.normal)
        if n.length == 0:
            continue
        n.normalize()
        r = math.hypot(c.x, c.y)
        if 0.05 < r < 3.95 and 0.45 < c.z < 6.8 and abs(n.z) < 0.3:
            radial = Vector((c.x, c.y, 0)).normalized()
            if abs(n.dot(radial)) < 0.35:
                kill.append(f)
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(o.data); bm.free()
    log(f'hdu-2: removed {len(kill)} fin faces (not on the real habitat)')
    for m in mats_of(objs).values():
        for nd in m.node_tree.nodes:
            if nd.type == 'TEX_IMAGE' and nd.image and nd.image.name.startswith('HDU_02'):
                nd.image = oy_texclean.recolor_yellow(bpy, nd.image, 'HDU_02_whiterails')


def fix_suits():
    if 'mark-3' in ASSETS:
        objs = ASSETS['mark-3']['objs']
        sanitize_materials(objs)
        for n, m in mats_of(objs).items():
            b = principled(m)
            if any(k in n for k in ('lambert2SG', 'lambert6SG', 'torso', 'legs', 'hand')):
                b.inputs['Metallic'].default_value = 0.0; b.inputs['Roughness'].default_value = 0.85
            elif 'blinn1SG' in n:   # visor
                setp(b, 'Base Color', (0.02, 0.02, 0.025, 1)); b.inputs['Metallic'].default_value = 1.0
                b.inputs['Roughness'].default_value = 0.08
            else:
                b.inputs['Metallic'].default_value = 0.7; b.inputs['Roughness'].default_value = 0.4
        plain_out(find_mat(objs, 'lambert5SG'), (0.82, 0.83, 0.86), rough=0.85)   # NASA meatball
    if 'emu' in ASSETS:
        objs = ASSETS['emu']['objs']
        sanitize_materials(objs, metallic=0.0)
        for key in ('emusuit5_jetpack2SG', 'lambert9SG', 'lambert8SG'):   # flag + mission patch
            plain_out(find_mat(objs, key), (0.86, 0.86, 0.86), rough=0.9)
        plain_out(find_mat(objs, 'lambert7SG'), (0.80, 0.80, 0.80), rough=0.8)  # control-box lettering
        v = find_mat(objs, 'blinn12SG')   # gold visor
        if v:
            b = principled(v); b.inputs['Metallic'].default_value = 1.0; b.inputs['Roughness'].default_value = 0.12
            setp(b, 'Base Color', (0.85, 0.55, 0.2, 1))
        for key in ('lambert4SG',):   # bright red stripe -> commander stripe is red on real EMU, keep but darker
            m = find_mat(objs, key)
            if m:
                setp(principled(m), 'Base Color', (0.7, 0.08, 0.08, 1))

def fix_small():
    if 'hammer' in ASSETS:
        objs = ASSETS['hammer']['objs']
        m = find_mat(objs, 'HAMMER-HEAD'); setp(principled(m), 'Base Color', (0.55, 0.56, 0.58, 1)); setp(principled(m), 'Roughness', 0.35)
        m = find_mat(objs, 'grip'); setp(principled(m), 'Base Color', (0.12, 0.12, 0.12, 1)); setp(principled(m), 'Metallic', 0.0); setp(principled(m), 'Roughness', 0.8)
        for n, m in mats_of(objs).items():
            if n == 'HAMMER':
                setp(principled(m), 'Base Color', (0.75, 0.76, 0.78, 1)); setp(principled(m), 'Roughness', 0.3)
    if 'sample-tube' in ASSETS:
        # Mars 2020 tube: titanium, gold TiN zone, white alumina zone (science.nasa.gov 'anatomy of a sample tube')
        o = ASSETS['sample-tube']['meshes'][0]; me = o.data
        ti = mat_simple('M_Tube_titanium', (0.72, 0.72, 0.74), rough=0.3, metal=1.0)
        tin = mat_simple('M_Tube_TiN_gold', (0.9, 0.68, 0.3), rough=0.25, metal=1.0)
        alu = mat_simple('M_Tube_alumina_white', (0.92, 0.92, 0.9), rough=0.35)
        me.materials.clear(); me.materials.append(ti); me.materials.append(tin); me.materials.append(alu)
        n = len(me.polygons); cen = np.empty(n * 3, np.float32); me.polygons.foreach_get('center', cen); z = cen.reshape(-1, 3)[:, 2]
        t = (z - z.min()) / max(1e-6, z.max() - z.min())
        idx = np.where(t < 0.33, 1, np.where(t < 0.7, 2, 0)).astype(np.int32)
        me.polygons.foreach_set('material_index', idx); me.update()
    if 'crew-lock-bag' in ASSETS:
        objs = ASSETS['crew-lock-bag']['objs']
        sanitize_materials(objs)
        for m in mats_of(objs).values():   # barcode stickers painted out (copy of the texture)
            for nd in m.node_tree.nodes:
                if nd.type == 'TEX_IMAGE' and nd.image and nd.image.name.startswith('crwlckbg') and 'clean' not in nd.image.name:
                    nd.image = oy_texclean.clean_image(bpy, nd.image, oy_texclean.TEX_RECTS['crwlckbg'], 'crwlckbg_clean_nolabel')
                    log('crew-lock-bag: barcode stickers painted out -> crwlckbg_clean_nolabel')
    if 'solar-wing' in ASSETS:
        for n, m in mats_of(ASSETS['solar-wing']['objs']).items():
            b = principled(m)
            if 'Solar' in n:
                setp(b, 'Metallic', 0.3); setp(b, 'Roughness', 0.25)
                nt = m.node_tree
                tc = nt.nodes.new('ShaderNodeTexCoord')
                br = nt.nodes.new('ShaderNodeTexBrick')
                br.inputs['Color1'].default_value = (0.02, 0.04, 0.14, 1)
                br.inputs['Color2'].default_value = (0.03, 0.06, 0.18, 1)
                br.inputs['Mortar'].default_value = (0.45, 0.47, 0.5, 1)
                br.inputs['Scale'].default_value = 14.0
                br.inputs['Mortar Size'].default_value = 0.025
                br.offset = 0.0
                br.inputs['Brick Width'].default_value = 0.5; br.inputs['Row Height'].default_value = 0.5
                nt.links.new(tc.outputs['Generated'], br.inputs['Vector'])
                nt.links.new(br.outputs['Color'], b.inputs['Base Color'])
            else:
                setp(b, 'Base Color', (0.75, 0.75, 0.72, 1)); setp(b, 'Metallic', 0.6)
    if 'rassor' in ASSETS:
        for m in mats_of(ASSETS['rassor']['objs']).values():
            b = principled(m); setp(b, 'Base Color', (0.62, 0.63, 0.64, 1)); setp(b, 'Metallic', 0.6); setp(b, 'Roughness', 0.45)
    if 'orion' in ASSETS:
        paint_orion()

def paint_orion():
    """Orion STL has one grey material. Real look: white/silver back-shell tiles,
    brown AVCOAT heat shield (bottom), dark windows, grey docking hatch."""
    objs = ASSETS['orion']['meshes']
    o = objs[0]
    me = o.data
    shell = mat_simple('M_Orion_backshell', (0.78, 0.79, 0.81), rough=0.3, metal=0.85)   # aluminised TUFI tiles (Artemis)
    heat = mat_simple('M_Orion_heatshield', (0.22, 0.15, 0.10), rough=0.85)              # Avcoat
    dock = mat_simple('M_Orion_dock', (0.45, 0.46, 0.48), rough=0.4, metal=0.7)
    win = mat_simple('M_Orion_window', (0.01, 0.012, 0.02), rough=0.05, metal=0.0)
    me.materials.clear()
    for m in (shell, heat, dock, win):
        me.materials.append(m)
    n = len(me.polygons)
    cen = np.empty(n * 3, np.float32); me.polygons.foreach_get('center', cen); cen = cen.reshape(-1, 3)
    nor = np.empty(n * 3, np.float32); me.polygons.foreach_get('normal', nor); nor = nor.reshape(-1, 3)
    z = cen[:, 2]; zmin, zmax = z.min(), z.max(); h = zmax - zmin
    idx = np.zeros(n, np.int32)
    idx[(z < zmin + 0.10 * h) & (nor[:, 2] < -0.3)] = 1          # heat shield (bottom)
    idx[z > zmin + 0.80 * h] = 2                                   # docking tunnel / top
    me.polygons.foreach_set('material_index', idx)
    me.update()

# ----------------------------------------------------------- render setup
def setup_render(scene, samples=SAMPLES, res=RES, transparent=False):
    scene.render.engine = 'CYCLES'
    c = scene.cycles
    c.device = 'CPU'
    c.samples = samples
    c.use_adaptive_sampling = True
    c.adaptive_threshold = 0.02
    c.use_denoising = True
    try:
        c.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    c.max_bounces = 6; c.diffuse_bounces = 3; c.glossy_bounces = 3
    c.transmission_bounces = 6; c.transparent_max_bounces = 8
    c.caustics_reflective = False; c.caustics_refractive = False
    c.blur_glossy = 1.0
    if THREADS > 0:
        scene.render.threads_mode = 'FIXED'
        scene.render.threads = THREADS
    else:
        scene.render.threads_mode = 'AUTO'
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'
    scene.render.use_persistent_data = True
    try:
        scene.view_settings.view_transform = 'AgX'
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception as e:
        log('view transform', e)

def finalize_for_user(scene, final_samples):
    """What the user gets when opening oy.blend on the Mac: Metal GPU, more samples."""
    scene.cycles.device = 'GPU'
    scene.cycles.samples = final_samples
    scene.render.threads_mode = 'AUTO'
    if not scene.render.film_transparent:   # sprite scene keeps its per-sprite resolution
        scene.render.resolution_x, scene.render.resolution_y = 1920, 1080

README_UZ = """OY bekati (Oy karvonsaroyi) - oy.blend haqida qisqa yo'riqnoma
=================================================================
1 Blender birligi = 1 metr. Fayl scenes/oy/build_oy.py skripti bilan qurilgan.
3D models: NASA 3D Resources / NASA Science. Not endorsed by NASA.

Scene lar (yuqoridagi Scene ro'yxatidan tanlang):
  OY_1_Karvonsaroy        - tashqi umumiy kadr (Quyosh 10.5 daraja, uzun soyalar)
  OY_2_Kesim              - kesim: bolaning devori (chapda, bo'sh slotlar) va etalon devor (o'ngda), suv baki
  OY_3_Karvonsaroy_Storm  - bo'ron: pushti #ffb4c8 yorug'lik + qizil signal chiroqlari
  OY_4_Kesim_Storm        - kesimning bo'ron varianti
  OY_5_Sprites            - shaffof fonli spraytlar (har biriga alohida kamera: CAM_oy_...)
  OY_6_NASA_Taqqoslash    - haqiqiy NASA fotolari bilan taqqoslash kadrlari
  OY_Assets               - kutubxona (render qilinmaydi)

Final render (Mac, Blender ilovasida):
  1) Edit > Preferences > System > Cycles Render Devices: "Metal" ni tanlang va GPU ni belgilang.
  2) Render Properties: Device = GPU Compute (allaqachon qo'yilgan), Samples = 256, Denoise = yoqilgan.
  3) F12 (Render Image), keyin Image > Save As.

Spraytni qayta render qilish (OY_5_Sprites):
  - Outliner da kerakli SPR_oy_... obyektining kamera (render) belgisini yoqing, qolganlarini o'chiring.
  - Shu nomdagi CAM_oy_... kamerani aktiv qiling (Scene Properties > Camera).
  - Output o'lchamini kameraning "sprite_res" xususiyatidan oling (Object Properties > Custom Properties).
  Yoki terminalda:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P scenes/oy/build_oy.py -- --render sprites --sprites oy_sev --samples 128 --res 1920x1080
  (skript hamma narsani qayta quradi va oy.blend ni qayta yozadi; yozmaslik uchun oxiriga --nosave qo'shing)
"""

def write_readme():
    t = bpy.data.texts.get('OY_README') or bpy.data.texts.new('OY_README')
    t.clear(); t.write(README_UZ)

def black_world(name='W_MoonBlack', strength=0.0, color=(0, 0, 0)):
    w = bpy.data.worlds.new(name); w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (*color, 1); bg.inputs[1].default_value = strength
    return w

def add_sun(col, az_deg, el_deg, strength, color=(1.0, 0.98, 0.95), name='Sun'):
    ld = bpy.data.lights.new(name, 'SUN'); ld.energy = strength; ld.color = color
    ld.angle = math.radians(0.53)   # real solar disc
    o = bpy.data.objects.new(name, ld); col.objects.link(o)
    a, e = math.radians(az_deg), math.radians(el_deg)
    to_sun = Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))
    o.rotation_euler = (-to_sun).to_track_quat('-Z', 'Y').to_euler()
    return o

def add_camera(col, name, loc, target, lens=35.0, clip_end=120000.0):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.clip_start = 0.05; cd.clip_end = clip_end
    cd.sensor_width = 36.0
    o = bpy.data.objects.new(name, cd); col.objects.link(o)
    o.location = loc; look_at(o, target)
    return o

# -------------------------------------------------------------- props
def solar_mast(col, lib, name, loc, face_az_deg, mast_h=7.0):
    """Vertical solar array on a mast (low lunar sun -> arrays stand upright, like NASA VSAT)."""
    grp = bpy.data.objects.new(name, None); grp.location = loc; col.objects.link(grp)
    grp.rotation_euler = (0, 0, math.radians(-face_az_deg))
    mm = mat_simple('M_Mast', (0.7, 0.7, 0.68), rough=0.4, metal=0.8)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.09, depth=mast_h, location=(0, 0, mast_h / 2))
    m = bpy.context.active_object; m.name = name + '_mast'; m.data.materials.append(mm)
    for c in list(m.users_collection): c.objects.unlink(m)
    col.objects.link(m); m.parent = grp
    bpy.ops.mesh.primitive_cylinder_add(radius=0.6, depth=0.25, location=(0, 0, 0.12))
    b = bpy.context.active_object; b.name = name + '_base'; b.data.materials.append(mm)
    for c in list(b.users_collection): c.objects.unlink(b)
    col.objects.link(b); b.parent = grp
    # wing pair stood upright, facing the sun (+Y local faces sun after rotation)
    w = link_instance(lib, col, name + '_wing', loc=(0, 0.12, mast_h * 0.55), rot=(math.radians(90), 0, 0))
    w.parent = grp
    return grp

def ice_chunks(col, center, n=7, seed=5, spread=2.5):
    rng = np.random.default_rng(seed)
    ice = bpy.data.materials.new('M_Ice'); ice.use_nodes = True
    b = principled(ice)
    b.inputs['Base Color'].default_value = (0.75, 0.9, 1.0, 1)
    b.inputs['Roughness'].default_value = 0.15
    b.inputs['Transmission Weight'].default_value = 0.6
    b.inputs['IOR'].default_value = 1.31
    b.inputs['Subsurface Weight'].default_value = 0.0
    b.inputs['Emission Color'].default_value = (0.5, 0.8, 1.0, 1)
    b.inputs['Emission Strength'].default_value = 0.15
    out = []
    for i in range(n):
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        for v in bm.verts:
            v.co *= 0.7 + 0.5 * rng.random()
        me = bpy.data.meshes.new(f'ice{i}'); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new(f'Ice_{i}', me); me.materials.append(ice)
        s = 0.12 + 0.25 * rng.random()
        o.scale = (s, s * (0.7 + 0.6 * rng.random()), s * 0.8)
        o.location = (center[0] + (rng.random() - 0.5) * spread * 2, center[1] + (rng.random() - 0.5) * spread, 0)
        o.rotation_euler = tuple(rng.random() * 3 for _ in range(3))
        col.objects.link(o); out.append(o)
    return out

def regolith_pile(col, loc, mat, r=1.4, h=0.45):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0, location=loc)
    o = bpy.context.active_object; o.name = 'RASSOR_pile'
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
    o.scale = (r, r * 0.8, h)
    md = o.modifiers.new('d', 'DISPLACE')
    tex = bpy.data.textures.new('pile_noise', 'CLOUDS'); tex.noise_scale = 0.4
    md.texture = tex; md.strength = 0.35
    o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = True
    return o

def dig_trench(ground, center, length=5.0, width=0.9, depth=0.18, angle_deg=0.0):
    me = ground.data
    n = len(me.vertices)
    co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
    a = math.radians(angle_deg)
    dx = co[:, 0] - center[0]; dy = co[:, 1] - center[1]
    u = dx * math.cos(a) + dy * math.sin(a); v = -dx * math.sin(a) + dy * math.cos(a)
    m = (np.abs(u) < length / 2) & (np.abs(v) < width)
    t = np.clip(1 - np.abs(v[m]) / width, 0, 1); t = t * t * (3 - 2 * t)
    t *= np.clip((length / 2 - np.abs(u[m])) / 0.6, 0, 1)
    co[m, 2] -= depth * t
    me.vertices.foreach_set('co', co.ravel()); me.update()

# ================================================================ SCENES
SUN_AZ, SUN_EL = 118.0, 10.5
PINK = (1.0, 0.456, 0.578)       # #ffb4c8 (sRGB) in scene-linear      # low sun from the right (Apollo landings: ~10-15 deg)
EXT_CAM = dict(loc=(-2.5, -31.0, 2.7), target=(0.5, 0.0, 1.5), lens=30.0)

def build_library():
    lib_scene = bpy.context.scene
    lib_scene.name = 'OY_Assets'
    lib = new_col('OY_ASSETS', scene=lib_scene)
    for name, kw in [
        ('hdu-1', dict(frame=(0, 0, 0.6879 * SCALES['hdu-2']))),
        ('hdu-2', dict(frame=(0, 0, 0.6879 * SCALES['hdu-2']))), ('crew-lock-bag', {}), ('solar-wing', {}),
        ('rassor', dict(decimate=0.12)), ('sev', {}), ('orion', {}),
        ('mark-3', {}), ('emu', {}), ('hammer', {}), ('sample-tube', {}),
        ('moon-near-side', {}),
    ]:
        import_asset(name, lib_scene, lib, **kw)
    fix_hdu1(); fix_hdu2(); fix_suits(); fix_small()
    for m in mats_of(ASSETS['moon-near-side']['objs']).values():
        b = principled(m); setp(b, 'Base Color', (0.2, 0.2, 0.2, 1)); setp(b, 'Roughness', 1.0); setp(b, 'Metallic', 0.0)
    # full habitat = hdu-1 shell + hdu-2 deck/stairs/interior fins (same NASA coordinate frame)
    def _wfull(img):
        return water_img(img, 1.0) if img.name.startswith('crwlckbg') else img
    clone_asset('crew-lock-bag', 'water_brick_full', _wfull)
    full = new_col('A_hdu_full', parent=lib)
    full.children.link(ASSETS['hdu-1']['col']); full.children.link(ASSETS['hdu-2']['col'])
    ASSETS['hdu_full'] = dict(col=full)
    return lib_scene, lib

def build_exterior(lib_scene, lib):
    sc = bpy.data.scenes.new('OY_1_Karvonsaroy')
    setup_render(sc)
    sc.world = black_world()
    col = new_col('EXT_Base', scene=sc)
    env = new_col('EXT_Terrain', scene=sc)
    lights = new_col('EXT_Lights', scene=sc)
    cam = add_camera(lights, 'CAM_Karvonsaroy', EXT_CAM['loc'], EXT_CAM['target'], EXT_CAM['lens'])
    sc.camera = cam
    add_sun(lights, SUN_AZ, SUN_EL, 9.0)
    # --- terrain
    a11, hfn = a11_height_sampler(lib)
    keepout = [(0, 2.0, 13.0), (-7.5, -13.0, 4.0), (9.5, -5, 5.0)]
    center = (EXT_CAM['loc'][0], EXT_CAM['loc'][1])
    ground, craters = build_ground(env, center, hfn, keepout, corridor=((center[0], center[1] - 10), (0.0, 25.0)))
    reg = mat_regolith()
    ground.data.materials.append(reg)
    dig_trench(ground, (-9.6, -11.8), length=5.0, angle_deg=30)
    _BVH.clear()
    rocks = make_rocks(env, lib, center, keepout, craters, mat=reg)
    drop_to_ground(rocks, ground, sink=0.25)
    had = import_hadley(env, lib, center, az_deg=14.0, dist=21000.0)
    had.data.materials.clear(); had.data.materials.append(mat_regolith('M_Regolith_far', base=0.19))
    import_earth(env, lib, EXT_CAM['loc'], az_deg=-17.0, el_deg=10.0)
    # --- base
    A = {k: v['col'] for k, v in ASSETS.items()}
    placed = []
    placed.append(link_instance(A['hdu_full'], col, 'HDU_home', loc=(0, 2.0, 0), rot_z_deg=0))
    placed.append(link_instance(A['sev'], col, 'SEV_parked', loc=(9.5, -5.0, 0), rot_z_deg=-35))
    placed.append(link_instance(A['rassor'], col, 'RASSOR_scout', loc=(-7.6, -13.2, 0), rot_z_deg=-60))
    placed.append(link_instance(A['mark-3'], col, 'Astro_1', loc=(3.6, -6.0, 0), rot_z_deg=200))
    placed.append(link_instance(A['mark-3'], col, 'Astro_2', loc=(-5.8, -6.8, 0), rot_z_deg=150))
    placed.append(link_instance(A['emu'], col, 'Astro_3', loc=(6.6, -9.4, 0), rot_z_deg=170))
    for i, (x, y) in enumerate([(4.6, -2.2), (5.0, -2.2), (5.4, -2.2), (4.8, -2.2), (5.2, -2.2)][:3]):
        pass
    # water-brick pallet by the door (crew lock bags)
    bag = A['crew-lock-bag']
    bs = ASSETS['crew-lock-bag']['size']
    for i in range(3):
        for j in range(2):
            placed.append(link_instance(bag, col, f'WaterBrick_{i}{j}', loc=(5.2 + i * (bs[0] + 0.02), -6.0, j * (bs[2] - 0.06)), rot_z_deg=0))
    for k, (x, y) in enumerate([(-9.0, 12.5), (10.5, 13.5), (13.5, 9.0)]):
        m = solar_mast(col, A['solar-wing'], f'SolarMast_{k}', (x, y, 0), SUN_AZ)
        placed.append(m)
    pile = regolith_pile(col, (-6.2, -14.4, 0), reg, r=0.75, h=0.32)
    placed.append(pile)
    placed += ice_chunks(col, (3.8, -17.0))
    drop_to_ground([p for p in placed if p.parent is None and not p.name.startswith('WaterBrick')], ground)
    z0 = None
    for p in placed:
        if p.name.startswith('WaterBrick'):
            if z0 is None:
                _tmp = bpy.data.objects.new('tmp', None); _tmp.location = (5.6, -6.0, 0); drop_to_ground([_tmp], ground); z0 = _tmp.location.z
                bpy.data.objects.remove(_tmp)
            p.location.z += z0
    return sc


def clone_asset(src, dst, img_fn=None):
    """Copy an asset collection (new root + mesh copies); img_fn(image)->image swaps textures."""
    A = ASSETS[src]
    col = new_col('A_' + dst, parent=A['col'].users_collection[0] if False else None)
    lib = bpy.data.collections['OY_ASSETS']; lib.children.link(col)
    root = A['root'].copy(); col.objects.link(root)
    objs = []
    for o in A['objs']:
        n = o.copy()
        if o.data is not None:
            n.data = o.data.copy()
        col.objects.link(n); n.parent = root if o.parent == A['root'] else n.parent
        objs.append(n)
        if n.type == 'MESH' and img_fn:
            for i, m in enumerate(n.data.materials):
                if m is None:
                    continue
                m2 = m.copy(); m2.name = m.name + '_' + dst
                for nd in m2.node_tree.nodes:
                    if nd.type == 'TEX_IMAGE' and nd.image:
                        nd.image = img_fn(nd.image)
                n.data.materials[i] = m2
    ASSETS[dst] = dict(col=col, root=root, objs=objs, meshes=[o for o in objs if o.type == 'MESH'], size=A['size'])
    return col

_WATER_IMG = {}
def water_img(img, fill=1.0):
    key = (img.name, fill)
    if key not in _WATER_IMG:
        _WATER_IMG[key] = oy_texclean.water_tint(bpy, img, fill=fill, new_name=f'{img.name}_water{int(fill*100)}')
    return _WATER_IMG[key]

def box(col, name, size, loc, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object; o.name = name
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
    o.scale = size
    o.data.materials.append(mat)
    if bevel:
        b = o.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = 2
    return o

def cyl(col, name, r, depth, loc, mat, rot=(0, 0, 0), verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
    o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = True
    return o

def area_light(col, name, loc, target, size, power, color=(1, 0.95, 0.88), shape='RECTANGLE', size_y=None):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = power; ld.color = color
    ld.shape = shape; ld.size = size; ld.size_y = size_y or size
    o = bpy.data.objects.new(name, ld); col.objects.link(o); o.location = loc; look_at(o, target)
    return o

def point_light(col, name, loc, power, color, radius=0.05):
    ld = bpy.data.lights.new(name, 'POINT'); ld.energy = power; ld.color = color; ld.shadow_soft_size = radius
    o = bpy.data.objects.new(name, ld); col.objects.link(o); o.location = loc
    return o

def hdu_cut_shell(col):
    """Real copy of the hdu-1 shell, cut in half through its axis (front half removed),
    given wall thickness with a light interior and an orange cut edge."""
    src = ASSETS['hdu-1']['meshes'][0]
    o = src.copy(); o.data = src.data.copy(); o.parent = None
    o.matrix_world = src.matrix_world.copy()
    col.objects.link(o); o.name = 'HDU_cutaway_shell'
    o.data.transform(o.matrix_world); o.matrix_world = Matrix.Identity(4)
    bm = bmesh.new(); bm.from_mesh(o.data)
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(0, 0.0, 0), plane_no=(0, -1, 0), clear_outer=True)
    bm.to_mesh(o.data); bm.free()
    inner = mat_simple('M_HDU_inner', (0.50, 0.52, 0.54), rough=0.7)
    rim = mat_simple('M_Cut_edge', (1.0, 0.45, 0.12), rough=0.5, emit=(1.0, 0.45, 0.12), emit_strength=0.4)
    o.data.materials.append(inner); o.data.materials.append(rim)
    sd = o.modifiers.new('wall', 'SOLIDIFY'); sd.thickness = 0.10; sd.offset = 1.0
    sd.use_rim = True; sd.material_offset = 1; sd.material_offset_rim = 2
    sd.use_even_offset = True
    pts = world_coords([o])
    rr = np.hypot(pts[:, 0], pts[:, 1])
    body = pts[(rr > 2.2) & (np.abs(pts[:, 0]) < 1.2)]
    top = float(body[:, 2].max()) if len(body) else 3.5
    bot = float(pts[:, 2].min())
    log(f'cutaway shell: floor {bot:.2f} m, cylinder top {top:.2f} m, total {pts[:,2].max():.2f} m')
    return o, bot, top

def brick_wall(col, brick_col, prefix, origin, n_along, n_rows, axis, face_rot, bs, empty=(), slot_mat=None):
    """Stack crew-lock-bag 'water bricks'. axis: 'x' or 'y' direction of the row.
    Returns list of (row, i, filled) slots."""
    W, D, H = bs   # bag width (x), thickness (y), height (z)
    pitch_h = H - 0.035
    slots = []
    for r in range(n_rows):
        for i in range(n_along):
            off = (i + 0.5) * (W + 0.012)
            loc = Vector(origin) + (Vector((off, 0, 0)) if axis == 'x' else Vector((0, off, 0))) + Vector((0, 0, r * pitch_h))
            if (r, i) in empty:
                if slot_mat is not None:
                    fr = box(col, f'{prefix}_slot_{r}_{i}', (W * 0.98, D * 0.98, pitch_h * 0.98) if axis == 'x' else (D * 0.98, W * 0.98, pitch_h * 0.98),
                             loc + Vector((0, 0, pitch_h / 2)), slot_mat)
                    w = fr.modifiers.new('wire', 'WIREFRAME'); w.thickness = 0.022
                slots.append((r, i, False))
                continue
            link_instance(brick_col, col, f'{prefix}_{r}_{i}', loc=loc, rot_z_deg=face_rot)
            slots.append((r, i, True))
    return slots

def build_cutaway(storm=False):
    name = 'OY_4_Kesim_Storm' if storm else 'OY_2_Kesim'
    sc = bpy.data.scenes.new(name)
    setup_render(sc)
    col = new_col(name + '_Hab', scene=sc)
    lights = new_col(name + '_Lights', scene=sc)
    shell, floor_z, top_z = hdu_cut_shell(col)
    reg = bpy.data.materials.get('M_Regolith') or mat_regolith()
    bpy.ops.mesh.primitive_circle_add(vertices=96, radius=40, fill_type='NGON', location=(0, 0, 0))
    g = bpy.context.active_object; g.name = name + '_ground'
    for c in list(g.users_collection): c.objects.unlink(g)
    col.objects.link(g); g.data.materials.append(reg)
    deck = mat_simple('M_Deck', (0.25, 0.26, 0.28), rough=0.5, metal=0.6)
    flo = mat_simple('M_Floor', (0.22, 0.25, 0.30), rough=0.6)
    cyl(col, 'Deck', 3.2, 0.3, (0, 0, 0.15), deck, verts=64)
    fz = floor_z + 0.08
    floor = cyl(col, 'Floor', 2.45, 0.08, (0, 0, fz - 0.04), flo, verts=96)
    # cut the floor disc too (keep the whole disc: furniture stands on it)
    # --- sleeping quarters (child's = left, reference = right)
    A = {k: v['col'] for k, v in ASSETS.items()}
    bs = ASSETS['crew-lock-bag']['size']
    W, D, H = bs
    slot_mat = mat_simple('M_EmptySlot', (1.0, 0.85, 0.3), rough=0.5, emit=(1.0, 0.78, 0.25), emit_strength=2.0)
    panel = mat_simple('M_Panel', (0.35, 0.37, 0.40), rough=0.6)
    bed_m = {'child': mat_simple('M_Bed_child', (1.0, 0.55, 0.15), rough=0.9),
             'ref': mat_simple('M_Bed_ref', (0.25, 0.55, 0.95), rough=0.9)}
    pillow = mat_simple('M_Pillow', (0.92, 0.92, 0.9), rough=0.9)
    nx = 3; ny = 5; rows = 5
    inner_w = nx * (W + 0.012) - 2 * D
    length = ny * (W + 0.012)
    rng = random.Random(42)
    pods = {}
    for key, x0 in (('child', -1.62), ('ref', 0.22)):
        y_back = 1.62; y_front = y_back - length - D
        z = fz
        prefix = 'Child' if key == 'child' else 'Ref'
        # empty slots in the child's wall (top-down per column)
        def empties(n_along, n_rows):
            if key != 'child':
                return set()
            e = set()
            for i in range(n_along):
                h = rng.choice([2, 3, 3, 4, 5])
                for r in range(h, n_rows):
                    e.add((r, i))
            return e
        brick = A['water_brick_full']
        # back wall (windows face the camera: -Y)
        brick_wall(col, brick, f'{prefix}_back', (x0, y_back - D / 2, z), nx, rows, 'x', 0, bs, empties(nx, rows), slot_mat)
        # side walls (rows along Y), windows face outwards
        brick_wall(col, brick, f'{prefix}_L', (x0 + D / 2, y_front, z), ny, rows, 'y', -90, bs, empties(ny, rows), slot_mat)
        brick_wall(col, brick, f'{prefix}_R', (x0 + nx * (W + 0.012) - D / 2, y_front, z), ny, rows, 'y', 90, bs, empties(ny, rows), slot_mat)
        # low front wall (2 rows) so the bed stays visible
        brick_wall(col, brick, f'{prefix}_front', (x0, y_front - D / 2 + 0.0, z), nx, 2, 'x', 0, bs,
                   {(1, 1)} if key == 'child' else set(), slot_mat)
        # bed
        bx = x0 + nx * (W + 0.012) / 2
        by = (y_back + y_front) / 2
        box(col, f'{prefix}_bunk', (inner_w - 0.06, length - 0.1, 0.32), (bx, by, z + 0.16), panel, bevel=0.02)
        box(col, f'{prefix}_sleepbag', (inner_w - 0.14, length - 0.55, 0.16), (bx, by - 0.2, z + 0.4), bed_m[key], bevel=0.06)
        box(col, f'{prefix}_pillow', (inner_w - 0.25, 0.32, 0.12), (bx, y_back - D - 0.25, z + 0.40), pillow, bevel=0.05)
        # reading lamp inside the pod
        point_light(lights, f'{prefix}_lamp', (bx, y_back - D - 0.3, z + 1.5), 25, (1.0, 0.85, 0.65), radius=0.1)
        pods[key] = (bx, by)
    # --- water tank (front right): clear shell + water
    glass = bpy.data.materials.new('M_TankGlass'); glass.use_nodes = True
    b = principled(glass); b.inputs['Base Color'].default_value = (0.9, 0.95, 1.0, 1); b.inputs['Transmission Weight'].default_value = 1.0
    b.inputs['Roughness'].default_value = 0.05; b.inputs['IOR'].default_value = 1.49
    water = bpy.data.materials.new('M_Water'); water.use_nodes = True
    b = principled(water); b.inputs['Base Color'].default_value = (0.15, 0.5, 0.95, 1); b.inputs['Transmission Weight'].default_value = 0.85
    b.inputs['Roughness'].default_value = 0.02; b.inputs['IOR'].default_value = 1.33
    b.inputs['Emission Color'].default_value = (0.1, 0.45, 1.0, 1); b.inputs['Emission Strength'].default_value = 0.25
    metal = mat_simple('M_TankMetal', (0.7, 0.72, 0.75), rough=0.3, metal=1.0)
    tx, ty = 2.0, -0.35
    cyl(col, 'Tank_shell', 0.36, 1.5, (tx, ty, fz + 0.85), glass)
    cyl(col, 'Tank_water', 0.34, 1.05, (tx, ty, fz + 0.1 + 1.05 / 2), water)
    cyl(col, 'Tank_cap_top', 0.38, 0.08, (tx, ty, fz + 1.64), metal)
    cyl(col, 'Tank_cap_bot', 0.38, 0.12, (tx, ty, fz + 0.06), metal)
    # hose from tank to the walls
    cyl(col, 'Hose_1', 0.035, 0.75, (tx - 0.45, ty + 0.12, fz + 0.12), mat_simple('M_Hose', (0.1, 0.45, 0.9), rough=0.4), rot=(0, math.radians(90), math.radians(20)))
    # drinking-water dispenser + oxygen (electrolysis) box on the left
    box(col, 'Dispenser', (0.35, 0.3, 0.55), (-2.0, -0.55, fz + 0.9), mat_simple('M_Disp', (0.85, 0.87, 0.9), rough=0.4), bevel=0.03)
    box(col, 'OxygenGen', (0.45, 0.45, 0.8), (-1.95, -1.3, fz + 0.4), mat_simple('M_OGA', (0.75, 0.78, 0.8), rough=0.5), bevel=0.03)
    # --- lights
    if storm:
        sc.world = black_world('W_Storm', strength=1.0, color=(0.06, 0.02, 0.03))
        add_sun(lights, SUN_AZ, SUN_EL + 4, 3.5, color=PINK, name='Sun_storm')   # #ffb4c8
        area_light(lights, 'Ceiling_dim', (0, 0.6, fz + 3.1), (0, 0.6, 0), 2.0, 30, color=PINK)
        red = mat_emit('M_Alarm', (1.0, 0.04, 0.02), 3.0)
        for i, (x, y) in enumerate([(-2.15, 0.9), (2.15, 0.9), (0, 2.38)]):
            cyl(col, f'Alarm_{i}', 0.13, 0.18, (x, y, fz + 2.55), red, rot=(math.radians(90), 0, math.atan2(y, x) + math.radians(90)))
            gl = point_light(lights, f'AlarmGlow_{i}', (x * 0.85, y * 0.85 - 0.15, fz + 2.15), 220, (1.0, 0.05, 0.03), radius=0.25)
            gl.visible_camera = False
        area_light(lights, 'Fill_pink', (0.5, -6.5, 4.0), (0, 0.5, 1.2), 3.0, 90, color=PINK)
        sc.view_settings.look = 'AgX - Punchy'   # keeps the alarm red saturated
    else:
        sc.world = black_world()
        add_sun(lights, SUN_AZ, SUN_EL + 4, 4.0)
        area_light(lights, 'Ceiling_A', (-0.9, 0.6, fz + 3.1), (-0.9, 0.6, 0), 1.2, 70, size_y=0.5)
        area_light(lights, 'Ceiling_B', (0.9, 0.6, fz + 3.1), (0.9, 0.6, 0), 1.2, 70, size_y=0.5)
        area_light(lights, 'Fill_cam', (0.5, -6.5, 4.0), (0, 0.5, 1.2), 3.0, 110, color=(0.95, 0.97, 1.0))
    cam = add_camera(lights, 'CAM_Kesim', (0.65, -5.7, 3.5), (-0.05, 0.62, 1.05), lens=30)
    sc.camera = cam
    return sc


def build_exterior_storm(ext):
    """Storm-alarm variant: same base + terrain collections, pink light + red alarm glow."""
    sc = bpy.data.scenes.new('OY_3_Karvonsaroy_Storm')
    setup_render(sc)
    sc.world = black_world('W_StormSky', strength=1.0, color=(0.035, 0.012, 0.02))
    for c in ext.collection.children:
        if c.name in ('EXT_Base', 'EXT_Terrain'):
            sc.collection.children.link(c)
    lights = new_col('EXT_Storm_Lights', scene=sc)
    cam = add_camera(lights, 'CAM_Karvonsaroy_Storm', EXT_CAM['loc'], EXT_CAM['target'], EXT_CAM['lens'])
    sc.camera = cam
    add_sun(lights, SUN_AZ, SUN_EL, 7.0, color=PINK, name='Sun_storm')
    red = mat_emit('M_Alarm_ext', (1.0, 0.04, 0.02), 3.0)
    beacons = new_col('EXT_Storm_Beacons', scene=sc)
    hdu = bpy.data.objects['HDU_home']
    spots = [(hdu.location.x, hdu.location.y - 0.4, hdu.location.z + 6.95)]
    for o in bpy.data.objects:
        if o.name.startswith('SolarMast_') and o.parent is None and o.type == 'EMPTY':
            spots.append((o.location.x, o.location.y, o.location.z + 7.15))
    sev = bpy.data.objects['SEV_parked']
    # SEV beacon sits on the real roof (~2.5 m; the 3.0 m bbox top is the antennas):
    # ray-cast down onto the SEV mesh, 1 m from the centre towards the camera so it is visible.
    # matrix_basis, not matrix_world: the instance lives in a scene that is not evaluated here.
    zs = []
    to_cam = Vector((EXT_CAM['loc'][0] - sev.location.x, EXT_CAM['loc'][1] - sev.location.y, 0)).normalized()
    bx, by = sev.location.x + to_cam.x * 1.0, sev.location.y + to_cam.y * 1.0
    for me_o in ASSETS['sev']['meshes']:
        bm = bmesh.new(); bm.from_mesh(me_o.data)
        bm.transform(sev.matrix_basis @ me_o.matrix_world)
        bvh = BVHTree.FromBMesh(bm); bm.free()
        for dx, dy in ((0, 0), (0.15, 0), (-0.15, 0), (0, 0.15), (0, -0.15)):
            hit = bvh.ray_cast(Vector((bx + dx, by + dy, sev.location.z + 10.0)), Vector((0, 0, -1)))
            if hit[0] is not None:
                zs.append(hit[0].z)
    sz = float(np.median(zs)) + 0.11 if zs else sev.location.z + 2.6   # cylinder centre (depth 0.24), slightly sunk
    log(f'SEV storm beacon on roof at z = {sz - sev.location.z:.2f} m above SEV base ({len(zs)} roof hits)')
    spots.append((bx, by, sz))
    for i, p in enumerate(spots):
        cyl(beacons, f'Beacon_{i}', 0.16 if i == 0 else 0.11, 0.24, p, red)
        gl = point_light(lights, f'BeaconGlow_{i}', (p[0], p[1] - 0.45, p[2] + 0.05), 2600 if i == 0 else 700, (1.0, 0.05, 0.03), radius=0.25)
        gl.visible_camera = False
    sc.view_settings.look = 'AgX - Punchy'
    return sc

SPRITES = [
    # name, asset, view az, view el, extra rotation (deg xyz)
    ('oy_hdu', 'hdu_full', -32, 18, (0, 0, 0)),
    ('oy_crew_lock_bag', 'crew-lock-bag', -30, 12, (0, 0, 0)),
    ('oy_water_brick', 'water_brick_full', -30, 12, (0, 0, 0)),
    ('oy_rassor', 'rassor', -55, 18, (0, 0, 0)),
    ('oy_sev', 'sev', -35, 15, (0, 0, -20)),
    ('oy_solar_wing', 'solar-wing', -20, 10, (90, 0, 0)),
    ('oy_astronaut', 'mark-3', -20, 8, (0, 0, 180)),
    ('oy_astronaut_emu', 'emu', -20, 8, (0, 0, 180)),
    ('oy_hammer', 'hammer', -30, 35, (0, 0, 60)),
    ('oy_sample_tube', 'sample-tube', -20, 15, (0, 65, 0)),
    ('oy_orion', 'orion', -30, 15, (0, 0, 0)),
    ('oy_near_side_map', 'moon-near-side', 0, 89.5, (0, 0, 0)),
]

def build_sprites():
    sc = bpy.data.scenes.new('OY_5_Sprites')
    setup_render(sc, res=(512, 512), transparent=True)
    sc.world = black_world('W_Sprite', strength=1.0, color=(0.22, 0.22, 0.24))
    col = new_col('SPR_Items', scene=sc)
    lights = new_col('SPR_Lights', scene=sc)
    add_sun(lights, -60, 40, 3.2, name='Sun_key')
    add_sun(lights, 120, 25, 1.2, color=(0.85, 0.9, 1.0), name='Sun_rim')
    cd = bpy.data.cameras.new('CAM_Sprite'); cd.type = 'ORTHO'
    cam = bpy.data.objects.new('CAM_Sprite', cd); lights.objects.link(cam); sc.camera = cam
    items = []
    for (nm, asset, az, el, rot) in SPRITES:
        if asset not in ASSETS:
            continue
        e = link_instance(ASSETS[asset]['col'], col, 'SPR_' + nm, rot=tuple(math.radians(r) for r in rot))
        e.hide_render = True
        items.append((nm, asset, az, el, e))
    return sc, cam, items

def asset_world_points(asset):
    A = ASSETS[asset]
    objs = []
    def gather(c):
        for o in c.objects:
            if o.type == 'MESH':
                objs.append(o)
        for ch in c.children:
            gather(ch)
    gather(A['col'])
    pts = world_coords(objs)
    if len(pts) > 20000:
        pts = pts[np.random.default_rng(0).choice(len(pts), 20000, replace=False)]
    return pts

def frame_sprite(sc, cam, e, asset, az, el, max_px=512, margin=1.06):
    pts = asset_world_points(asset)
    M = np.array(Matrix.Translation(e.location) @ e.rotation_euler.to_matrix().to_4x4())
    pts = pts @ M[:3, :3].T + M[:3, 3]
    c = (pts.min(0) + pts.max(0)) / 2
    a, l = math.radians(az), math.radians(el)
    d = Vector((math.sin(a) * math.cos(l), -math.cos(a) * math.cos(l), math.sin(l)))
    R = float(np.linalg.norm(pts.max(0) - pts.min(0)))
    loc = Vector(c) + d * (R * 3 + 1)
    q = (-d).to_track_quat('-Z', 'Y')
    CM = Matrix.Translation(loc) @ q.to_matrix().to_4x4()
    cam.matrix_world = CM
    cam.data.clip_end = R * 10 + 10
    Mi = np.array(CM.inverted())
    pc = pts @ Mi[:3, :3].T + Mi[:3, 3]
    w = pc[:, 0].max() - pc[:, 0].min(); h = pc[:, 1].max() - pc[:, 1].min()
    cx = (pc[:, 0].max() + pc[:, 0].min()) / 2; cy = (pc[:, 1].max() + pc[:, 1].min()) / 2
    if w >= h:
        rx, ry = max_px, max(64, int(round(max_px * h / w)))
    else:
        rx, ry = max(64, int(round(max_px * w / h))), max_px
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    cam.data.ortho_scale = max(w, h) * margin
    cam.data.sensor_fit = 'AUTO'
    # recentre (ortho shift is in units of ortho_scale)
    cam.data.shift_x = cx / cam.data.ortho_scale
    cam.data.shift_y = cy / cam.data.ortho_scale


def build_ref():
    """Comparison scene: real-size models posed like the NASA reference photos (docs/ref/oy)."""
    sc = bpy.data.scenes.new('OY_6_NASA_Taqqoslash')
    setup_render(sc)
    sc.world = black_world('W_Ref', strength=1.0, color=(0.30, 0.34, 0.42))   # Earth-like sky fill for the desert photos
    col = new_col('REF_Items', scene=sc); lights = new_col('REF_Lights', scene=sc)
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
    g = bpy.context.active_object; g.name = 'REF_ground'
    for c in list(g.users_collection): c.objects.unlink(g)
    col.objects.link(g); g.data.materials.append(mat_simple('M_RefDesert', (0.42, 0.36, 0.30), rough=1.0))
    add_sun(lights, -60, 22, 4.5, name='Sun_ref')
    link_instance(ASSETS['hdu_full']['col'], col, 'REF_HDU', loc=(0, 0, 0))
    link_instance(ASSETS['sev']['col'], col, 'REF_SEV', loc=(40, 0, 0), rot_z_deg=0)
    link_instance(ASSETS['mark-3']['col'], col, 'REF_person_scale', loc=(-6.5, -6.0, 0), rot_z_deg=180)
    cams = {
        'hdu': add_camera(lights, 'CAM_ref_hdu', (-2.0, -27.0, 1.6), (0.5, 0.0, 2.9), lens=42),
        'sev': add_camera(lights, 'CAM_ref_sev', (40 + 4.6, -5.6, 1.6), (40, 0, 1.25), lens=32),
    }
    sc.camera = cams['hdu']
    return sc, cams

def render_scene(sc, path, cam=None, jpg=False):
    if cam:
        sc.camera = cam
    sc.render.filepath = path
    t = time.time()
    with bpy.context.temp_override(scene=sc):
        bpy.ops.render.render(write_still=True, scene=sc.name)
    log(f'rendered {os.path.basename(path)} in {time.time()-t:.0f}s')
    if jpg:   # web copy for the Phaser game
        img = bpy.data.images['Render Result']
        st = sc.render.image_settings
        fmt, cm = st.file_format, st.color_mode
        st.file_format = 'JPEG'; st.color_mode = 'RGB'; st.quality = 82
        img.save_render(os.path.splitext(path)[0] + '.jpg', scene=sc)
        st.file_format = fmt; st.color_mode = cm

def main():
    reset()
    lib_scene, lib = build_library()
    ext = build_exterior(lib_scene, lib)
    cut = build_cutaway(storm=False)
    cut_s = build_cutaway(storm=True)
    ext_s = build_exterior_storm(ext)
    spr, spr_cam, spr_items = build_sprites()
    ref, ref_cams = build_ref()
    hcam = add_camera(bpy.data.collections['EXT_Lights'], 'CAM_ref_hadley', (-48.0, -22.0, 1.5),
                      (-48.0 + 21000 * math.sin(math.radians(14)), 21000 * math.cos(math.radians(14)), 1500), lens=35)
    os.makedirs(REN, exist_ok=True)
    suf = '' if RES[0] >= 1920 else '_preview'
    if 'ext' in RENDER:
        render_scene(ext, os.path.join(REN, f'oy_karvonsaroy{suf}.png'), jpg=True)
    if 'ext_storm' in RENDER:
        render_scene(ext_s, os.path.join(REN, f'oy_karvonsaroy_storm{suf}.png'), jpg=True)
    if 'cut' in RENDER:
        render_scene(cut, os.path.join(REN, f'oy_kesim{suf}.png'), jpg=True)
    if 'cut_storm' in RENDER:
        render_scene(cut_s, os.path.join(REN, f'oy_kesim_storm{suf}.png'), jpg=True)
    if 'ref' in RENDER:
        render_scene(ref, os.path.join(REN, 'ref', 'oy_ref_hdu.png'), ref_cams['hdu'])
        render_scene(ref, os.path.join(REN, 'ref', 'oy_ref_sev.png'), ref_cams['sev'])
        ref.camera = ref_cams['hdu']
        render_scene(ext, os.path.join(REN, 'ref', 'oy_ref_hadley.png'), hcam)
        ext.camera = bpy.data.objects['CAM_Karvonsaroy']
    only = _arg('--sprites', None)
    for (nm, asset, az, el, e) in spr_items:
        if 'sprites' not in RENDER or (only and nm not in str(only).split(',')):
            continue
        for (_, _, _, _, e2) in spr_items:
            e2.hide_render = e2 is not e
        frame_sprite(spr, spr_cam, e, asset, az, el)
        render_scene(spr, os.path.join(REN, 'sprites', nm + '.png'))
    # one framed camera per sprite, so sprites can be re-rendered from the Blender app
    spr_lights = bpy.data.collections['SPR_Lights']
    for (nm, asset, az, el, e) in spr_items:
        frame_sprite(spr, spr_cam, e, asset, az, el)
        c2 = spr_cam.copy(); c2.data = spr_cam.data.copy()
        c2.name = 'CAM_' + nm; c2.data.name = 'CAM_' + nm
        c2['sprite_res'] = f'{spr.render.resolution_x}x{spr.render.resolution_y}'
        spr_lights.objects.link(c2)
    # saved state: only oy_hdu visible, with its own camera and resolution
    first = spr_items[0]
    for (_, _, _, _, e2) in spr_items:
        e2.hide_render = e2 is not first[4]
    frame_sprite(spr, spr_cam, first[4], first[1], first[2], first[3])
    spr.camera = bpy.data.objects['CAM_' + first[0]]
    for sc in bpy.data.scenes:
        if sc.name != 'OY_Assets':
            finalize_for_user(sc, 256)
    lib_scene.render.engine = 'CYCLES'
    write_readme()
    bpy.context.window_manager  # noqa
    if not NOSAVE:
        bpy.context.preferences.filepaths.save_version = 0   # no oy.blend1 backups (disk budget)
        bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
        log('saved', BLEND)

if __name__ == '__main__':
    main()
