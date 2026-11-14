# -*- coding: utf-8 -*-
"""
KOINOT (space / Sun / route) scenes for "Oy karvonsaroyi" — Team OUTPOST, NASA Space Apps 2026.

Rebuilds scenes/koinot/koinot.blend from scratch out of the NASA 3D Resources models in source/
and (optionally) renders previews / game art into renders/koinot/.

Run (headless):
  Blender -b --factory-startup -P build_koinot.py -- [--render LIST] [--samples N] [--res WxH]
                                                     [--test] [--nosave]
  LIST = comma list of shot keys or "all", "bg", "sprites", "none" (default none)
  shot keys: marshrut, marshrut_yolli, quyosh_kamera, boron_signal, oy_olchov, gateway,
             spr_sdo, spr_goes, spr_lro, spr_gateway, spr_earth, spr_moon, spr_mars, spr_sun,
             cmp_sdo, cmp_goes, cmp_lro, cmp_gateway   (cmp_* = comparison views vs NASA photos)

Staging (NOT to scale): spacecraft are 1 unit = 1 m at their real size; planets and the Sun are
staged backdrops whose size/distance is chosen for the picture, not for astronomy.
"""
import bpy, sys, os, math, random
import numpy as np
from mathutils import Vector, Matrix, Euler

ROOT = "/Users/davronoff/dev/oy-karvonsaroyi-3d"
SRC = f"{ROOT}/source/models"
SCN = f"{ROOT}/scenes/koinot"
TEXD = f"{SCN}/tex"
REN = f"{ROOT}/renders/koinot"
BLEND = f"{SCN}/koinot.blend"
os.makedirs(TEXD, exist_ok=True)
os.makedirs(REN, exist_ok=True)
os.makedirs(f"{REN}/sprites", exist_ok=True)
os.makedirs(f"{REN}/compare", exist_ok=True)

# ----------------------------------------------------------------------------------------------
# args
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None, flag=False):
    if name in argv:
        if flag:
            return True
        return argv[argv.index(name) + 1]
    return False if flag else default
RENDER = arg("--render", "none")
SAMPLES = int(arg("--samples", "48"))
RES = arg("--res", "1280x720")
TEST = arg("--test", flag=True)
NOSAVE = arg("--nosave", flag=True)
RES_X, RES_Y = map(int, RES.split("x"))

# ----------------------------------------------------------------------------------------------
# REAL SIZES (metres) -> scale factors. Model bbox numbers are from source/inventory.json.
# The fact sources are listed in docs/koinot_nasa_taqqoslash.md.
REAL = {
    # SDO: solar panel span 6.25 m (sdo.gsfc.nasa.gov/mission/spacecraft.php) = model Y extent (arrays tip-to-tip)
    "sdo":     ("y", 6.25, "solar panel span 6.25 m"),
    # GOES-R: spacecraft bus 6.1 x 5.6 x 3.9 m (nesdis.noaa.gov) = model bus box (black-fl blankets) longest side
    "goes":    ("bus", 6.1, "bus 6.1 x 5.6 x 3.9 m"),
    # LRO: model is already in metres: its 3-panel array is ~11 m2 vs NASA 10.7 m2 (NSSDCA) -> scale 1.0
    "lro":     ("none", 1.0, "array area 10.7 m2"),
    # Gateway: model is already in metres (HALO incl. docking ports 8.0 m vs ~7 m body; station 39 m tall
    # vs NASA FAQ ~43 m) -> scale 1.0
    "gateway": ("none", 1.0, "NASA FAQ 43 x 19 x 20 m"),
}

# ----------------------------------------------------------------------------------------------
def log(*a):
    print("[koinot]", *a, flush=True)


def srgb2lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def hexcol(h, a=1.0):
    h = h.lstrip("#")
    rgb = srgb2lin([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    return (float(rgb[0]), float(rgb[1]), float(rgb[2]), a)


PINK = hexcol("ffb4c8")

# ----------------------------------------------------------------------------------------------
# fresh file
bpy.ops.wm.read_factory_settings(use_empty=True)
BASE_SCENE = bpy.context.scene
BASE_SCENE.name = "1_marshrut"
ASSETS = bpy.data.scenes.new("_ASSETS")


def mw(o):
    """World matrix computed from the parent chain (matrix_world of objects in a non-active scene is
    not refreshed by view_layer.update())."""
    m = o.matrix_basis.copy()
    while o.parent is not None:
        m = o.parent.matrix_basis @ o.matrix_parent_inverse @ m
        o = o.parent
    return m


def world_bbox(objs):
    mn = Vector((1e18,) * 3); mx = Vector((-1e18,) * 3)
    for o in objs:
        if o.type != 'MESH' or o.hide_render:
            continue
        m = o.data
        if len(m.vertices) == 0:
            continue
        co = np.empty(len(m.vertices) * 3); m.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        M = np.array(mw(o))
        w = co @ M[:3, :3].T + M[:3, 3]
        mn = Vector(np.minimum(mn, w.min(0))); mx = Vector(np.maximum(mx, w.max(0)))
    return mn, mx


def import_glb(key, pre=None):
    """Import source/models/<key>.glb into its own collection (linked under _ASSETS)."""
    coll = bpy.data.collections.new(f"A_{key}")
    BASE_SCENE.collection.children.link(coll)
    vl = BASE_SCENE.view_layers[0]
    vl.active_layer_collection = vl.layer_collection.children[coll.name]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f"{SRC}/{key}.glb")
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.view_layer.update()
    if pre:
        pre(new)
    BASE_SCENE.collection.children.unlink(coll)
    ASSETS.collection.children.link(coll)
    return coll, new


def normalise(coll, objs, scale, centre=None, key=""):
    """Parent everything to one root empty; move model centre to origin and scale to metres."""
    root = bpy.data.objects.new(f"ROOT_{key}", None)
    coll.objects.link(root)
    for o in objs:
        if o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    mn, mx = world_bbox(objs)
    c = (mn + mx) / 2 if centre is None else Vector(centre)
    root.scale = (scale,) * 3
    root.location = -c * scale
    return root, mn, mx


# ---------------------------------------------------------------- material helpers
def bsdf_of(mat):
    if not mat or not mat.node_tree:
        return None
    return next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)


def add_crinkle(mat, strength=0.12, scale=28.0):
    """Subtle crinkled MLI-blanket bump (object space noise)."""
    nt = mat.node_tree; b = bsdf_of(mat)
    if b is None or b.inputs['Normal'].is_linked:
        return
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = 6; nz.inputs['Roughness'].default_value = 0.6
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs['Strength'].default_value = strength
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], bp.inputs['Height'])
    nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])


def set_bsdf(mat, col=None, metal=None, rough=None, spec=None, crinkle=0.0, cscale=28.0, coat=None):
    b = bsdf_of(mat)
    if b is None:
        return
    if col is not None and not b.inputs['Base Color'].is_linked:
        b.inputs['Base Color'].default_value = col
    if metal is not None:
        b.inputs['Metallic'].default_value = metal
    if rough is not None:
        b.inputs['Roughness'].default_value = rough
    if spec is not None:
        b.inputs['Specular IOR Level'].default_value = spec
    if coat is not None:
        b.inputs['Coat Weight'].default_value = coat
    if crinkle > 0:
        add_crinkle(mat, crinkle, cscale)


GOLD = (0.92, 0.62, 0.22, 1)
SILVER = (0.86, 0.86, 0.88, 1)
CELL = (0.018, 0.032, 0.10, 1)


def enhance_by_name(objs, cell_col=CELL):
    """Replace flat CAD colours with space-hardware looks, using only material names."""
    done = set()
    for o in objs:
        if o.type != 'MESH':
            continue
        for s in o.material_slots:
            m = s.material
            if not m or m.name in done:
                continue
            done.add(m.name)
            n = m.name.lower()
            if "solar" in n and "back" not in n or "calipso" in n or "parasol" in n:
                b = bsdf_of(m)
                base = b.inputs['Base Color'].default_value
                set_bsdf(m, (base[0] * 0.35 + cell_col[0], base[1] * 0.35 + cell_col[1], base[2] * 0.45 + cell_col[2], 1),
                         metal=0.1, rough=0.38, spec=0.6)
            elif "solarback" in n:
                set_bsdf(m, (0.55, 0.55, 0.58, 1), metal=0.2, rough=0.5)
            elif "gold" in n:
                set_bsdf(m, GOLD, metal=1.0, rough=0.32, crinkle=0.10)
            elif "bronze" in n:
                set_bsdf(m, (0.80, 0.55, 0.30, 1), metal=1.0, rough=0.38, crinkle=0.08)
            elif "silver" in n:
                set_bsdf(m, SILVER, metal=1.0, rough=0.28, crinkle=0.08)
            elif "white" in n or "dish" in n:
                set_bsdf(m, (0.80, 0.80, 0.78, 1), metal=0.0, rough=0.55)
            elif "black" in n or "magboom" in n:
                set_bsdf(m, (0.035, 0.035, 0.04, 1), metal=0.0, rough=0.42, spec=0.6)
            elif "brown" in n:
                set_bsdf(m, (0.62, 0.60, 0.57, 1), metal=0.0, rough=0.6)
            elif "grey" in n or "mainbody" in n:
                b = bsdf_of(m)
                set_bsdf(m, None, metal=0.0, rough=0.55)


# ---------------------------------------------------------------- model builders
MODEL_INFO = {}


def fix_sdo_normals(objs):
    o = next(x for x in objs if x.type == 'MESH')
    # The model's custom (split) normals point INTO the surface (97% of corners) -> renders black.
    bpy.context.view_layer.objects.active = o
    for x in bpy.context.view_layer.objects:
        x.select_set(False)
    o.select_set(True)
    try:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except Exception as e:
        log("splitnormals_clear failed", e)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
    except Exception as e:
        log("smooth by angle failed", e)
    log("SDO custom normals cleared:", not o.data.has_custom_normals)


def build_sdo():
    coll, objs = import_glb("sdo", pre=fix_sdo_normals)
    enhance_by_name(objs)
    # SDO's instrument module / body: real spacecraft is wrapped in black + silver blankets
    for mn in ("SDO-mainbody-sm", "SDO-mainbody-fl", "SDO-mainbody2-sm2", "SDO-mainbodyTop-sm"):
        m = bpy.data.materials.get(mn)
        if m:
            # NASA art/photos: dark blue-black crinkled blankets on the bus
            set_bsdf(m, (0.075, 0.08, 0.10, 1), metal=0.7, rough=0.33, crinkle=0.10, cscale=6)
    axis, real, _ = REAL["sdo"]
    mn, mx = world_bbox(objs)
    size = (mx - mn)["xyz".index(axis)]
    s = real / size        # 6.25 / 37.03
    root, mn, mx = normalise(coll, objs, s, key="sdo")
    MODEL_INFO["sdo"] = dict(coll=coll, scale=s, size=tuple(mx - mn), real=real)
    log("SDO scale", s, "model size", tuple(round(v, 2) for v in (mx - mn)))
    return coll


def split_goes_array(objs):
    """Cut the solar-array wing (Parasol*/solarpanel materials) into its own object so it can be
    turned about its yoke axis (model X) to face the Sun while the body faces Earth."""
    import bmesh
    o = next(x for x in objs if x.type == 'MESH')
    me = o.data
    arr = o.copy(); arr.data = me.copy(); arr.name = "GOES_solar_array"
    for c in o.users_collection:
        c.objects.link(arr)
    M = o.matrix_world.copy()
    # everything beyond the bus side (x < -0.0405 model units) is the wing + its backing structure
    for ob, keep_array in ((o, False), (arr, True)):
        bm = bmesh.new(); bm.from_mesh(ob.data)
        kill = [f for f in bm.faces if ((M @ f.calc_center_median()).x < -0.0405) != keep_array]
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(ob.data); bm.free()
    objs.append(arr)
    # yoke axis: the wing's inner edge, model X axis at (y=0, z=array plane)
    co = np.empty(len(arr.data.vertices) * 3); arr.data.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    M = np.array(arr.matrix_world); w = co @ M[:3, :3].T + M[:3, 3]
    pivot = Vector((w[:, 0].max(), (w[:, 1].max() + w[:, 1].min()) / 2, w[:, 2].mean()))
    R = Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(GOES_ARRAY_TURN), 4, 'X') @ Matrix.Translation(-pivot)
    arr.matrix_world = R @ arr.matrix_world
    log("GOES array split:", len(arr.data.polygons), "faces, turned", GOES_ARRAY_TURN, "deg")


def goes_truss_boom(objs, s):
    """Replace the model's solid rod magnetometer boom by a thin triangular truss of the real
    length (8.5 m) with two magnetometer canisters, like the real GOES-R boom."""
    import bmesh
    o = next(x for x in objs if x.type == 'MESH' and x.name != "GOES_solar_array")
    me = o.data
    bi = {i for i, m in enumerate(me.materials) if m and m.name == "Goes2-main-MagBoom-sm"}
    M = o.matrix_world.copy()
    pts = np.array([(M @ me.vertices[v].co)[:] for p in me.polygons if p.material_index in bi for v in p.vertices])
    c = pts.mean(0)
    _, _, vt = np.linalg.svd(pts - c)
    d = Vector(vt[0].tolist()).normalized()
    proj = (pts - c) @ np.array(d)
    e0 = Vector((c + d * proj.min())[:] if False else (c + np.array(d) * proj.min()).tolist())
    e1 = Vector((c + np.array(d) * proj.max()).tolist())
    bus_c = Vector((-0.008, 0.0, 0.003))
    if (e1 - bus_c).length < (e0 - bus_c).length:
        e0, e1 = e1, e0
    d = (e1 - e0).normalized()
    model_len = (e1 - e0).length
    bm = bmesh.new(); bm.from_mesh(me)
    dn = np.array(d); e0n = np.array(e0)

    def on_boom(f):
        if f.material_index in bi:
            return True
        q = np.array((M @ f.calc_center_median())[:]) - e0n
        t = q @ dn
        return 0.15 * model_len < t < 1.15 * model_len and np.linalg.norm(q - dn * t) < 0.004
    kill = [f for f in bm.faces if on_boom(f)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm.to_mesh(me); bm.free()
    L = 8.5 / s; r = 0.16 / s
    u = d.orthogonal().normalized(); w = d.cross(u)
    corners = [u * r * math.cos(a) + w * r * math.sin(a) for a in (0, 2.094, 4.189)]
    tb = bmesh.new()

    def rod(a, b, rad, seg=6):
        v = b - a
        mat = Matrix.Translation((a + b) / 2) @ v.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.create_cone(tb, cap_ends=True, segments=seg, radius1=rad, radius2=rad, depth=v.length, matrix=mat)
    bays = 18
    for k in range(3):
        rod(e0 + corners[k], e0 + d * L + corners[k], 0.022 / s)
    for i in range(bays):
        a0 = e0 + d * (L * i / bays); a1 = e0 + d * (L * (i + 1) / bays)
        for k in range(3):
            rod(a0 + corners[k], a1 + corners[(k + 1) % 3], 0.010 / s, 4)
    can = bpy.data.materials.new("GOES_magnetometer_white")
    set_bsdf(can, (0.85, 0.85, 0.83, 1), metal=0.0, rough=0.5)
    trm = bpy.data.materials.new("GOES_boom_truss")
    set_bsdf(trm, (0.62, 0.62, 0.60, 1), metal=0.3, rough=0.5)
    nf = len(tb.faces)
    for at, rr, ll in ((L, 0.17, 0.42), (L * 0.62, 0.13, 0.3)):
        p0 = e0 + d * (at - ll / s / 2); p1 = e0 + d * (at + ll / s / 2)
        rod(p0, p1, rr / s, 16)
    for i, f in enumerate(tb.faces):
        f.material_index = 0 if i < nf else 1
    tm = bpy.data.meshes.new("GOES_mag_boom"); tb.to_mesh(tm); tb.free()
    tm.materials.append(trm); tm.materials.append(can)
    to = bpy.data.objects.new("GOES_mag_boom", tm)
    for col in o.users_collection:
        col.objects.link(to)
    objs.append(to)
    log(f"GOES boom: model rod {model_len * s:.1f} m -> truss {L * s:.1f} m")


GOES_ARRAY_TURN = float(arg("--goesturn", "-75"))
GOES_YAW = float(arg("--goesyaw", "60"))


def build_goes():
    coll, objs = import_glb("goes")
    split_goes_array(objs)
    enhance_by_name(objs, cell_col=(0.02, 0.035, 0.11, 1))
    # real GOES-R: black blankets, dark "giant black wing" array with a bronze sheen
    for m in bpy.data.materials:
        if m.name.startswith("Parasol") or m.name == "Goes2-solarpanel-faces":
            set_bsdf(m, (0.10, 0.065, 0.035, 1), metal=0.55, rough=0.28, spec=0.8)
        elif m.name in ("Goes2-main-silver-sm", "Goes2-main-silver-fl"):
            set_bsdf(m, (0.10, 0.10, 0.11, 1), metal=0.5, rough=0.35, crinkle=0.12, cscale=1200)
        elif m.name == "Goes2-main-MagBoom-sm":
            set_bsdf(m, (0.45, 0.45, 0.47, 1), metal=0.0, rough=0.75)
    # bus box = black blanket faces (Goes2-main-black-fl): longest side -> 6.1 m
    o = next(x for x in objs if x.type == 'MESH' and x.name != "GOES_solar_array")
    me = o.data
    bi = [i for i, m in enumerate(me.materials) if m and m.name == "Goes2-main-black-fl"]
    vids = {v for p in me.polygons if p.material_index in bi for v in p.vertices}
    co = np.array([(o.matrix_world @ me.vertices[v].co)[:] for v in vids])
    bus = co.max(0) - co.min(0)
    s = REAL["goes"][1] / bus.max()
    goes_truss_boom(objs, s)
    root, mn, mx = normalise(coll, objs, s, key="goes")
    MODEL_INFO["goes"] = dict(coll=coll, scale=s, size=tuple(mx - mn), real=REAL["goes"][1], bus=tuple(bus * s))
    log("GOES scale", s, "bus m", tuple(round(v, 2) for v in bus * s), "size m", tuple(round(v * s, 2) for v in (mx - mn)))
    return coll


LRO_ARRAY_TILT = -50.0


def split_lro_array(objs):
    """Cut the 3-panel solar wing (faces of object 'tex' beyond the body, x > 1.33 m) into its own
    object and tilt it about its hinge so the cells face up/sideways like the real gimballed wing."""
    import bmesh
    o = next(x for x in objs if x.name == "tex")
    M = o.matrix_world.copy()
    arr = o.copy(); arr.data = o.data.copy(); arr.name = "LRO_solar_array"
    for c in o.users_collection:
        c.objects.link(arr)
    for ob, keep in ((o, False), (arr, True)):
        bm = bmesh.new(); bm.from_mesh(ob.data)
        kill = [f for f in bm.faces if ((M @ f.calc_center_median()).x > 1.33) != keep]
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(ob.data); bm.free()
    objs.append(arr)
    pivot = Vector((1.34, 0.0, -0.95))
    R = Matrix.Translation(pivot) @ Matrix.Rotation(math.radians(LRO_ARRAY_TILT), 4, 'Y') @ Matrix.Translation(-pivot)
    arr.matrix_world = R @ arr.matrix_world
    log("LRO array split:", len(arr.data.polygons), "faces, tilted", LRO_ARRAY_TILT)


def build_lro():
    coll, objs = import_glb("lro")
    split_lro_array(objs)
    for o in objs:
        if o.name.startswith("_root"):
            # 1 m helper cube with no material inside the model -> hide
            o.hide_render = True; o.hide_viewport = True
    for o in objs:
        if o.type == 'MESH' and not o.hide_render:
            o.data.shade_smooth() if False else None
    for mn in ("foil_silver", "foil_silver_dish", "foil_gold"):
        m = bpy.data.materials.get(mn)
        if m:
            # replace the dark 256 px "ramp" lookup with real blanket colours (NASA photos:
            # silver body, gold instrument deck, copper base)
            b = bsdf_of(m)
            for l in list(b.inputs['Base Color'].links):
                m.node_tree.links.remove(l)
            col = GOLD if mn == "foil_gold" else ((0.78, 0.78, 0.80, 1) if mn == "foil_silver" else (0.85, 0.85, 0.86, 1))
            set_bsdf(m, col, metal=0.95, rough=0.30, crinkle=0.10, cscale=9)
    for mn in ("tex_01", "tex_02", "tex_03"):
        m = bpy.data.materials.get(mn)
        if m:
            set_bsdf(m, None, metal=0.1, rough=0.45)
    m = bpy.data.materials.get("shiny_panel")
    if m:
        set_bsdf(m, None, metal=0.2, rough=0.38)
    vis = [o for o in objs if not o.hide_render]
    s = REAL["lro"][1]
    root, mn, mx = normalise(coll, vis, s, key="lro")
    for o in objs:
        if o.parent is None and o is not root:
            o.parent = root
    MODEL_INFO["lro"] = dict(coll=coll, scale=s, size=tuple(mx - mn), real=REAL["lro"][1])
    log("LRO scale", s, "model size", tuple(round(v, 3) for v in (mx - mn)))
    return coll


def patch_dsxr_logo():
    """Paint over the 'Canada' wordmark on Canadarm3 (DSXR_BaseColor) with neighbouring plain panel."""
    img = next((i for i in bpy.data.images if i.name.startswith("DSXR_BaseColor")), None)
    if img is None:
        log("DSXR image not found"); return
    w, h = img.size
    a = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(a)
    a = a.reshape(h, w, 4)[::-1].copy()          # top-down rows
    sx = w / 1024.0; sy = h / 1024.0
    y0, y1 = int(612 * sy), int(872 * sy)
    x0, x1 = int(14 * sx), int(124 * sx)
    reg = a[y0:y1, x0:x1]
    red = (reg[..., 0] - np.maximum(reg[..., 1], reg[..., 2])) > 0.08
    m = red.copy()                                   # dilate the lettering mask by 3 px
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            m |= np.roll(np.roll(red, dy, 0), dx, 1)
    plain = np.median(reg[~m][:, :3], axis=0)
    reg[m, :3] = plain
    a[y0:y1, x0:x1] = reg
    log("DSXR: painted", int(m.sum()), "px with plain panel colour", np.round(plain, 3))
    new = bpy.data.images.new("DSXR_BaseColor_clean", w, h, alpha=True)
    new.pixels.foreach_set(a[::-1].ravel())
    new.filepath_raw = f"{TEXD}/gateway_DSXR_BaseColor_clean.png"
    new.file_format = 'PNG'
    new.save()
    new.pack()
    for m in bpy.data.materials:
        if m.node_tree:
            for n in m.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image == img:
                    n.image = new
    log("DSXR wordmark painted over")


def build_gateway():
    coll, objs = import_glb("gateway")
    patch_dsxr_logo()
    # HALO length along its long axis -> real size
    halo = next(o for o in objs if o.name.startswith("NG_HALO"))
    hmn, hmx = world_bbox([halo])
    hal = max(hmx - hmn)
    s = REAL["gateway"][1]
    root, mn, mx = normalise(coll, objs, s, key="gateway")
    MODEL_INFO["gateway"] = dict(coll=coll, scale=s, size=tuple(mx - mn), real=REAL["gateway"][1], halo_model=hal)
    log("Gateway scale", s, "HALO model length", round(hal, 2), "size", tuple(round(v, 2) for v in (mx - mn)))
    return coll


# ---------------------------------------------------------------- planets
def build_globe(key, atmo=None, rough=0.85, gain=1.0):
    coll, objs = import_glb(f"{key}-globe")
    g = next(o for o in objs if o.type == 'MESH')
    g.name = f"{key}_globe"
    for p in g.data.polygons:
        p.use_smooth = True
    m = g.active_material
    b = bsdf_of(m)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Specular IOR Level'].default_value = 0.25
    if gain != 1.0:
        nt = m.node_tree
        src = b.inputs['Base Color'].links[0].from_socket
        hsv = nt.nodes.new("ShaderNodeHueSaturation")
        hsv.inputs['Saturation'].default_value = 1.15
        hsv.inputs['Value'].default_value = gain
        nt.links.new(src, hsv.inputs['Color'])
        nt.links.new(hsv.outputs['Color'], b.inputs['Base Color'])
    if atmo:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=atmo["r"])
        sh = bpy.context.active_object
        sh.name = f"{key}_atmosphere"
        for c in sh.users_collection:
            c.objects.unlink(sh)
        coll.objects.link(sh)
        bpy.ops.object.shade_smooth() if False else None
        for p in sh.data.polygons:
            p.use_smooth = True
        sh.data.materials.append(atmo_material(f"{key}_atmo", atmo["col"], atmo.get("glow", 0.25)))
        sh.visible_shadow = False
    MODEL_INFO[key] = dict(coll=coll)
    return coll


def atmo_material(name, col, glow):
    """Thin rim: lit (translucent) on the day side + faint emissive rim for a game look."""
    m = bpy.data.materials.new(name)
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    lw = nt.nodes.new("ShaderNodeLayerWeight"); lw.inputs['Blend'].default_value = 0.35
    pw = nt.nodes.new("ShaderNodeMath"); pw.operation = 'POWER'; pw.inputs[1].default_value = 2.2
    nt.links.new(lw.outputs['Facing'], pw.inputs[0])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    tl = nt.nodes.new("ShaderNodeBsdfTranslucent"); tl.inputs['Color'].default_value = col
    df = nt.nodes.new("ShaderNodeBsdfDiffuse"); df.inputs['Color'].default_value = col
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs['Color'].default_value = col
    em.inputs['Strength'].default_value = glow
    a1 = nt.nodes.new("ShaderNodeAddShader"); a2 = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(tl.outputs[0], a1.inputs[0]); nt.links.new(df.outputs[0], a1.inputs[1])
    nt.links.new(a1.outputs[0], a2.inputs[0]); nt.links.new(em.outputs[0], a2.inputs[1])
    mx = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(pw.outputs[0], mx.inputs[0])
    nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(a2.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs['Surface'])
    return m


def moon_detail(coll):
    """Add procedural crater bump on top of the 2k LRO colour map (helps close views)."""
    g = next(o for o in coll.objects if o.type == 'MESH')
    m = g.active_material; nt = m.node_tree; b = bsdf_of(m)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vo = nt.nodes.new("ShaderNodeTexVoronoi"); vo.feature = 'F1'; vo.inputs['Scale'].default_value = 60
    vo2 = nt.nodes.new("ShaderNodeTexVoronoi"); vo2.feature = 'F1'; vo2.inputs['Scale'].default_value = 220
    rp = nt.nodes.new("ShaderNodeMapRange"); rp.inputs['From Min'].default_value = 0.0; rp.inputs['From Max'].default_value = 0.45
    rp2 = nt.nodes.new("ShaderNodeMapRange"); rp2.inputs['From Min'].default_value = 0.0; rp2.inputs['From Max'].default_value = 0.45
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs['Scale'].default_value = 140; nz.inputs['Detail'].default_value = 8
    ad = nt.nodes.new("ShaderNodeMath"); ad.operation = 'ADD'
    ad2 = nt.nodes.new("ShaderNodeMath"); ad2.operation = 'MULTIPLY_ADD'; ad2.inputs[1].default_value = 0.35
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs['Strength'].default_value = 0.35; bp.inputs['Distance'].default_value = 0.002
    nt.links.new(tc.outputs['Object'], vo.inputs['Vector']); nt.links.new(tc.outputs['Object'], vo2.inputs['Vector'])
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(vo.outputs['Distance'], rp.inputs['Value']); nt.links.new(vo2.outputs['Distance'], rp2.inputs['Value'])
    nt.links.new(rp.outputs['Result'], ad.inputs[0]); nt.links.new(rp2.outputs['Result'], ad.inputs[1])
    nt.links.new(nz.outputs['Fac'], ad2.inputs[0]); nt.links.new(ad.outputs[0], ad2.inputs[2])
    nt.links.new(ad2.outputs[0], bp.inputs['Height'])
    nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])


# ---------------------------------------------------------------- Sun
def emis_mat(name, col, strength):
    m = bpy.data.materials.new(name)
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs['Color'].default_value = col; em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


def sun_surface_mat(name, storm=False):
    m = bpy.data.materials.new(name)
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs['Scale'].default_value = 3.0
    nz.inputs['Detail'].default_value = 10; nz.inputs['Roughness'].default_value = 0.62
    vo = nt.nodes.new("ShaderNodeTexVoronoi"); vo.inputs['Scale'].default_value = 40
    mixv = nt.nodes.new("ShaderNodeMath"); mixv.operation = 'MULTIPLY_ADD'
    mixv.inputs[1].default_value = 0.35
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector']); nt.links.new(tc.outputs['Object'], vo.inputs['Vector'])
    nt.links.new(vo.outputs['Distance'], mixv.inputs[0]); nt.links.new(nz.outputs['Fac'], mixv.inputs[2])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.30; cr.elements[0].color = (1.0, 0.07, 0.0, 1)
    cr.elements[1].position = 0.66; cr.elements[1].color = (1.0, 0.34, 0.0, 1)
    e = cr.elements.new(0.90); e.color = (1.0, 0.72, 0.12, 1)
    nt.links.new(mixv.outputs[0], ramp.inputs['Fac'])
    # limb darkening
    lw = nt.nodes.new("ShaderNodeLayerWeight"); lw.inputs['Blend'].default_value = 0.5
    lr = nt.nodes.new("ShaderNodeValToRGB")
    lr.color_ramp.elements[0].position = 0.0; lr.color_ramp.elements[0].color = (1, 1, 1, 1)
    lr.color_ramp.elements[1].position = 1.0; lr.color_ramp.elements[1].color = (0.55, 0.22, 0.08, 1)
    nt.links.new(lw.outputs['Facing'], lr.inputs['Fac'])
    mul = nt.nodes.new("ShaderNodeMix"); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
    mul.inputs['Factor'].default_value = 1.0
    nt.links.new(ramp.outputs['Color'], mul.inputs[6]); nt.links.new(lr.outputs['Color'], mul.inputs[7])
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs['Strength'].default_value = 1.1
    if storm:
        tint = nt.nodes.new("ShaderNodeMix"); tint.data_type = 'RGBA'; tint.blend_type = 'MULTIPLY'
        tint.inputs['Factor'].default_value = 0.55
        tint.inputs[7].default_value = (1.0, 0.55, 0.62, 1)
        nt.links.new(mul.outputs[2], tint.inputs[6]); nt.links.new(tint.outputs[2], em.inputs['Color'])
    else:
        nt.links.new(mul.outputs[2], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    return m


def glow_shell_mat(name, col, strength, power=3.0):
    """Additive glow shell: Transparent + Emission * (1-facing)^power (never blocks what is behind)."""
    m = bpy.data.materials.new(name)
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    lw = nt.nodes.new("ShaderNodeLayerWeight"); lw.inputs['Blend'].default_value = 0.5
    inv = nt.nodes.new("ShaderNodeMath"); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
    nt.links.new(lw.outputs['Facing'], inv.inputs[1])
    pw = nt.nodes.new("ShaderNodeMath"); pw.operation = 'POWER'; pw.inputs[1].default_value = power
    nt.links.new(inv.outputs[0], pw.inputs[0])
    mu = nt.nodes.new("ShaderNodeMath"); mu.operation = 'MULTIPLY'; mu.inputs[1].default_value = strength
    nt.links.new(pw.outputs[0], mu.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs['Color'].default_value = col
    nt.links.new(mu.outputs[0], em.inputs['Strength'])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    ad = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(tr.outputs[0], ad.inputs[0]); nt.links.new(em.outputs[0], ad.inputs[1])
    nt.links.new(ad.outputs[0], out.inputs['Surface'])
    return m


def prominence_mat(name, col, strength):
    """Emissive loop with streaky noise so it looks like hot plasma, transparent at the gaps."""
    m = bpy.data.materials.new(name)
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs['Scale'].default_value = 6.0
    nz.inputs['Detail'].default_value = 6; nz.inputs['Distortion'].default_value = 2.0
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.30; ramp.color_ramp.elements[0].color = (0.15, 0.15, 0.15, 1)
    ramp.color_ramp.elements[1].position = 0.65; ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    # additive glow: Transparent + Emission * noise * (view-facing core)^2 -> soft plasma tube, no hard rim
    lw = nt.nodes.new("ShaderNodeLayerWeight"); lw.inputs['Blend'].default_value = 0.5
    inv = nt.nodes.new("ShaderNodeMath"); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
    nt.links.new(lw.outputs['Facing'], inv.inputs[1])
    pw = nt.nodes.new("ShaderNodeMath"); pw.operation = 'POWER'; pw.inputs[1].default_value = 2.0
    nt.links.new(inv.outputs[0], pw.inputs[0])
    mu = nt.nodes.new("ShaderNodeMath"); mu.operation = 'MULTIPLY'
    nt.links.new(ramp.outputs['Color'], mu.inputs[0]); nt.links.new(pw.outputs[0], mu.inputs[1])
    mu2 = nt.nodes.new("ShaderNodeMath"); mu2.operation = 'MULTIPLY'; mu2.inputs[1].default_value = strength
    nt.links.new(mu.outputs[0], mu2.inputs[0])
    em = nt.nodes.new("ShaderNodeEmission"); em.inputs['Color'].default_value = col
    nt.links.new(mu2.outputs[0], em.inputs['Strength'])
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    ad = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(tr.outputs[0], ad.inputs[0]); nt.links.new(em.outputs[0], ad.inputs[1])
    nt.links.new(ad.outputs[0], out.inputs['Surface'])
    return m


def link(obj, coll):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)


def uv_sphere(name, r, coll, seg=96, rings=48):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=r)
    o = bpy.context.active_object; o.name = name
    for p in o.data.polygons:
        p.use_smooth = True
    link(o, coll)
    return o


def arc_curve(name, p0, p1, normal, height, thick, coll, mat, twist=0.0):
    """Prominence loop: cubic bezier from p0 to p1 bulging along 'normal'."""
    cd = bpy.data.curves.new(name, 'CURVE'); cd.dimensions = '3D'
    cd.bevel_depth = thick; cd.bevel_resolution = 4; cd.resolution_u = 24
    sp = cd.splines.new('BEZIER'); sp.bezier_points.add(2)
    mid = (p0 + p1) / 2 + normal * height
    side = (p1 - p0)
    pts = [p0, mid, p1]
    hds = [normal * height * 0.9, side * 0.35, -normal * height * 0.9]
    for i, (bp, p) in enumerate(zip(sp.bezier_points, pts)):
        bp.co = p
        if i == 0:
            bp.handle_left = p - hds[0]; bp.handle_right = p + hds[0]
        elif i == 1:
            bp.handle_left = p - hds[1] + normal.cross(side).normalized() * twist
            bp.handle_right = p + hds[1] - normal.cross(side).normalized() * twist
        else:
            bp.handle_left = p - hds[2]; bp.handle_right = p + hds[2]
        bp.radius = 0.5 if i != 1 else 1.0
    o = bpy.data.objects.new(name, cd)
    coll.objects.link(o)
    cd.materials.append(mat)
    return o


def build_sun(key, storm=False):
    """Procedural Sun asset (radius 1): granulated emissive surface, corona glow shell,
    an active region with prominence loops + flare flash. Region sits at local +X limb."""
    coll = bpy.data.collections.new(f"A_{key}")
    ASSETS.collection.children.link(coll)
    s = uv_sphere(f"{key}_surface", 1.0, coll, 128, 64)
    s.data.materials.append(sun_surface_mat(f"{key}_surface_mat", storm))
    s.visible_shadow = False
    if storm:
        ccol = (1.0, 0.40, 0.50, 1); pcol = (1.0, 0.16, 0.24, 1); fcol = (1.0, 0.80, 0.86, 1)
    else:
        ccol = (1.0, 0.42, 0.08, 1); pcol = (1.0, 0.13, 0.02, 1); fcol = (1.0, 0.92, 0.70, 1)
    c1 = uv_sphere(f"{key}_corona", 1.22, coll)
    c1.data.materials.append(glow_shell_mat(f"{key}_corona_mat", ccol, 0.6, 4.0))
    c2 = uv_sphere(f"{key}_corona_outer", 1.9, coll)
    c2.data.materials.append(glow_shell_mat(f"{key}_corona2_mat", ccol, 0.35, 5.0))
    for c in (c1, c2):
        c.visible_shadow = False
        c.visible_diffuse = False; c.visible_glossy = False
    pm = prominence_mat(f"{key}_prom_mat", pcol, 0.9 if not storm else 1.9)
    thk = 1.0 if not storm else 1.5
    rnd = random.Random(7 if not storm else 11)
    # active region at local +X; loops stand in the local X-Z plane so they are seen face-on
    # when +X is turned to the limb (perpendicular to the view)
    ctr = Vector((1, 0, 0))
    # (span, height, thickness, position along limb (rad), depth tilt (rad))
    loops = [(0.42, 0.30, 0.034, 0.02, 0.04), (0.20, 0.12, 0.024, -0.24, 0.06),
             (0.26, 0.14, 0.022, 0.30, -0.03)]
    if storm:
        loops += [(0.66, 0.50, 0.040, 0.0, -0.05)]
    for i, (span, hgt, th, along, tilt) in enumerate(loops):
        c = (Matrix.Rotation(-along, 3, 'Y') @ Matrix.Rotation(tilt, 3, 'Z') @ ctr).normalized()
        z = Vector((0, 0, 1))
        t = (z - c * c.dot(z)).normalized()
        t = Matrix.Rotation(rnd.uniform(-0.3, 0.3), 3, c) @ t
        # each prominence = a bundle of 5 plasma strands (slightly different feet/height/thickness)
        for j in range(3):
            jt = t * rnd.uniform(-0.05, 0.05) + c.cross(t) * rnd.uniform(-0.04, 0.04)
            sp = span * rnd.uniform(0.85, 1.1)
            p0 = (c + jt - t * sp / 2).normalized() * 0.995
            p1 = (c + jt + t * sp / 2).normalized() * 0.995
            arc_curve(f"{key}_loop{i}_{j}", p0, p1, c, hgt * rnd.uniform(0.8, 1.15),
                      th * thk * rnd.uniform(0.45, 0.9), coll, pm, rnd.uniform(-0.06, 0.06))
    # flare flash: white-hot small core + glow
    fl = uv_sphere(f"{key}_flare_core", 0.03, coll, 32, 16)
    fl.location = ctr.normalized() * 0.985 + Vector((0, 0.03, 0.03))
    fl.data.materials.append(emis_mat(f"{key}_flare_mat", fcol, 25.0))
    fh = uv_sphere(f"{key}_flare_glow", 0.22, coll, 48, 24)
    fh.location = fl.location
    fh.data.materials.append(glow_shell_mat(f"{key}_flareglow_mat", fcol, 2.0, 2.0))
    for o in (fl, fh):
        o.visible_shadow = False
    fh.hide_render = True; fh.hide_viewport = True
    MODEL_INFO[key] = dict(coll=coll)
    return coll


# ---------------------------------------------------------------- starfield (numpy, crisp)
def make_starfield(w, h, seed=3):
    path = f"{TEXD}/starfield_{w}x{h}.png"
    rng = np.random.default_rng(seed)
    img = np.zeros((h, w, 3), np.float64)
    # faint nebula: blurred noise via FFT low-pass
    def lowpass(sig):
        n = rng.standard_normal((h, w))
        fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
        k = np.exp(-(fx ** 2 + fy ** 2) * (2 * math.pi * sig) ** 2 / 2)
        r = np.real(np.fft.ifft2(np.fft.fft2(n) * k))
        return (r - r.min()) / (r.max() - r.min() + 1e-9)
    n1 = lowpass(w / 9); n2 = lowpass(w / 14); n3 = lowpass(w / 40)
    neb = np.clip((n1 - 0.55) * 2.2, 0, 1) ** 1.6
    neb2 = np.clip((n2 - 0.58) * 2.4, 0, 1) ** 1.6
    base = np.array([0.0016, 0.0022, 0.0060])
    img += base
    img += neb[..., None] * np.array([0.010, 0.004, 0.026]) * (0.6 + 0.8 * n3[..., None])
    img += neb2[..., None] * np.array([0.002, 0.012, 0.020]) * (0.6 + 0.8 * n3[..., None])
    # stars
    N = int(w * h / 700)
    xs = rng.uniform(0, w, N); ys = rng.uniform(0, h, N)
    mag = rng.pareto(2.2, N) + 1.0
    bri = np.clip(0.035 * mag ** 1.5, 0, 3.0)
    temp = rng.uniform(0, 1, N)
    cols = np.stack([0.85 + 0.25 * temp, 0.88 + 0.08 * temp, 1.12 - 0.35 * temp], 1)
    for x, y, b, c in zip(xs, ys, bri, cols):
        sig = 0.45 + min(b, 1.5) * 0.45
        R = int(math.ceil(sig * 3))
        xi, yi = int(x), int(y)
        x0, x1 = max(0, xi - R), min(w, xi + R + 1); y0, y1 = max(0, yi - R), min(h, yi + R + 1)
        gx = np.arange(x0, x1) + 0.5 - x; gy = np.arange(y0, y1) + 0.5 - y
        k = np.exp(-(gy[:, None] ** 2 + gx[None, :] ** 2) / (2 * sig * sig))
        img[y0:y1, x0:x1] += k[..., None] * c * b
        if b > 1.2:   # soft halo on bright stars
            R2 = int(sig * 9)
            x0, x1 = max(0, xi - R2), min(w, xi + R2 + 1); y0, y1 = max(0, yi - R2), min(h, yi + R2 + 1)
            gx = np.arange(x0, x1) + 0.5 - x; gy = np.arange(y0, y1) + 0.5 - y
            k = np.exp(-(gy[:, None] ** 2 + gx[None, :] ** 2) / (2 * (sig * 3) ** 2))
            img[y0:y1, x0:x1] += k[..., None] * c * b * 0.04
    img = np.clip(img, 0, 1)
    srgb = np.where(img <= 0.0031308, img * 12.92, 1.055 * img ** (1 / 2.4) - 0.055)
    out = np.ones((h, w, 4), np.float32); out[..., :3] = srgb[::-1]
    im = bpy.data.images.new(f"starfield_{w}x{h}", w, h, alpha=False)
    im.pixels.foreach_set(out.ravel())
    im.filepath_raw = path; im.file_format = 'PNG'; im.save()
    im.pack()
    return im


# ---------------------------------------------------------------- scene helpers
def new_scene(name):
    if name == BASE_SCENE.name:
        return BASE_SCENE
    return bpy.data.scenes.new(name)


def setup_render(sc, transparent=True, samples=None, rx=None, ry=None):
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples or SAMPLES
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 2; sc.cycles.glossy_bounces = 3
    sc.cycles.transmission_bounces = 4; sc.cycles.transparent_max_bounces = 16
    sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
    sc.cycles.sample_clamp_indirect = 8.0
    sc.render.threads_mode = 'FIXED'; sc.render.threads = 2
    sc.render.resolution_x = rx or RES_X; sc.render.resolution_y = ry or RES_Y
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Punchy'
    except Exception:
        pass
    sc.render.use_persistent_data = False
    sc.render.compositor_device = 'CPU'    # GPU compositor crashes here (no Metal in sandbox)


def make_world(sc, col=(0.012, 0.015, 0.03), strength=1.0):
    w = bpy.data.worlds.new(f"W_{sc.name}")
    sc.world = w
    bg = w.node_tree.nodes.get('Background')
    bg.inputs[0].default_value = (*col, 1); bg.inputs[1].default_value = strength
    return w


def add_light(sc, name, typ, energy, color=(1, 1, 1), rot=None, loc=None, angle=0.5, size=1.0, coll=None):
    ld = bpy.data.lights.new(name, typ)
    ld.energy = energy; ld.color = color
    if typ == 'SUN':
        ld.angle = math.radians(angle)
    elif typ == 'AREA':
        ld.size = size
    o = bpy.data.objects.new(name, ld)
    (coll or sc.collection).objects.link(o)
    if rot is not None:
        o.rotation_euler = rot
    if loc is not None:
        o.location = loc
    return o


def sun_from_dir(d):
    """Rotation for a SUN lamp so that light travels along -d (comes FROM direction d)."""
    d = Vector(d).normalized()
    return d.to_track_quat('Z', 'Y').to_euler()


def add_camera(sc, name, loc, target, lens=50, up=None):
    cd = bpy.data.cameras.new(name); cd.lens = lens
    cd.clip_start = 0.05; cd.clip_end = 1e5
    o = bpy.data.objects.new(name, cd)
    sc.collection.objects.link(o)
    o.location = Vector(loc)
    look_at(o, target)
    sc.camera = o
    return o


def look_at(o, target, roll=0.0):
    d = Vector(target) - o.location
    q = d.to_track_quat('-Z', 'Y')
    o.rotation_euler = q.to_euler()
    if roll:
        o.rotation_euler.rotate_axis('Z', math.radians(roll))


def instance(sc, key, name, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0, coll=None):
    e = bpy.data.objects.new(name, None)
    e.instance_type = 'COLLECTION'
    e.instance_collection = MODEL_INFO[key]["coll"]
    e.location = Vector(loc); e.rotation_euler = Euler(rot)
    e.scale = (scale,) * 3 if isinstance(scale, (int, float)) else scale
    (coll or sc.collection).objects.link(e)
    return e


def orient(e, local_dir, world_dir, local_up=(0, 0, 1), world_up=(0, 0, 1)):
    """Rotate empty so that local_dir -> world_dir and local_up roughly -> world_up."""
    def basis(f, u):
        f = Vector(f).normalized(); u = Vector(u)
        u = (u - f * f.dot(u)).normalized()
        r = f.cross(u)
        return Matrix((f, u, r)).transposed()
    L = basis(local_dir, local_up); W = basis(world_dir, world_up)
    R = W @ L.inverted()
    e.rotation_euler = R.to_euler()


def lonlat(lon, lat):
    lo, la = math.radians(lon), math.radians(lat)
    return Vector((math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)))


def planet(sc, key, name, loc, radius, face_lonlat, cam_loc, tilt_up=(0, 0, 1)):
    e = instance(sc, key, name, loc, scale=radius)
    to_cam = Vector(cam_loc) - Vector(loc)
    orient(e, lonlat(*face_lonlat), to_cam, (0, 0, 1), tilt_up)
    return e


def compositor(sc, stars=True, glare=0.55, glare_thr=1.1, tint=None, tint_fac=0.0, size=0.6):
    ng = bpy.data.node_groups.new(f"COMP_{sc.name}", "CompositorNodeTree")
    ng.interface.new_socket("Image", in_out='OUTPUT', socket_type='NodeSocketColor')
    N = ng.nodes; L = ng.links
    rl = N.new("CompositorNodeRLayers"); rl.scene = sc
    out = N.new("NodeGroupOutput")
    cur = rl.outputs['Image']
    if stars:
        img = N.new("CompositorNodeImage"); img.image = STARS
        scl = N.new("CompositorNodeScale")
        scl.inputs['Type'].default_value = 'Render Size'
        try:
            scl.inputs['Frame Type'].default_value = 'Crop'
        except Exception:
            pass
        L.new(img.outputs['Image'], scl.inputs['Image'])
        ao = N.new("CompositorNodeAlphaOver")
        L.new(scl.outputs['Image'], ao.inputs['Background']); L.new(cur, ao.inputs['Foreground'])
        cur = ao.outputs['Image']
    if glare > 0:
        g = N.new("CompositorNodeGlare")
        g.inputs['Type'].default_value = 'Bloom'
        g.inputs['Quality'].default_value = 'High'
        g.inputs['Threshold'].default_value = glare_thr
        g.inputs['Strength'].default_value = glare
        g.inputs['Size'].default_value = size
        L.new(cur, g.inputs['Image'])
        cur = g.outputs['Image']
    if tint is not None and tint_fac > 0:
        cb = N.new("CompositorNodeColorBalance")
        cb.inputs['Factor'].default_value = tint_fac
        try:
            cb.inputs['Type'].default_value = 'Offset/Power/Slope (ASC-CDL)'
            for s in cb.inputs:
                if s.name == 'Slope' and s.type == 'RGBA':
                    s.default_value = tint
        except Exception as ex:
            log("tint fail", ex)
        L.new(cur, cb.inputs['Image'])
        cur = cb.outputs['Image']
    L.new(cur, out.inputs[0])
    sc.compositing_node_group = ng
    sc.render.use_compositing = True
    return ng


# ==============================================================================================
# BUILD ASSETS
log("building assets ...")
build_sdo()
build_goes()
build_lro()
build_gateway()
build_globe("earth", atmo=dict(r=1.028, col=(0.25, 0.55, 1.0, 1), glow=0.35), rough=0.75, gain=1.12)
build_globe("moon", rough=0.95, gain=1.05)
moon_detail(MODEL_INFO["moon"]["coll"])
build_globe("mars", atmo=dict(r=1.010, col=(1.0, 0.62, 0.45, 1), glow=0.06), rough=0.9, gain=1.05)
build_sun("sun")
build_sun("sun_storm", storm=True)
STARS = make_starfield(1920, 1080)
log("assets done")

SHOTS = {}   # key -> (scene, output path stem, kind)

# ==============================================================================================
# 1. ROUTE / HOME SCREEN: Earth -> (ISS) -> Moon -> Mars, left to right. Staged, NOT to scale.
def shot_marshrut(with_path=False):
    name = "1_marshrut" if not with_path else "1b_marshrut_yolli"
    sc = BASE_SCENE if not with_path else new_scene(name)
    setup_render(sc)
    make_world(sc, (0.010, 0.012, 0.028), 1.0)
    cam_loc = Vector((0, -60, 0))
    cam = add_camera(sc, f"CAM_{name}", cam_loc, (0, 0, 0), lens=35)
    # frame at y=0: width ~61.7, height ~34.7 -> keep top 1/3 (z > 5.5) empty for the title
    E = planet(sc, "earth", "Earth", (-19.5, 2, -4.6), 9.4, (45, 24), cam_loc + Vector((6, 0, 6)))
    Mn = planet(sc, "moon", "Moon", (-0.8, 5, -1.6), 3.3, (0, 0), cam_loc)
    Ma = planet(sc, "mars", "Mars", (19.0, 4, -5.2), 7.0, (-70, -5), cam_loc)
    # tiny ISS glint near Earth (a dot, not a model: at this size it would be 2 px)
    iss = uv_sphere("ISS_dot", 0.16, sc.collection, 16, 8)
    iss.location = (-8.0, -3.0, 3.6)
    iss.data.materials.append(emis_mat("ISS_dot_mat", (1.0, 0.95, 0.85, 1), 40.0))
    iss.visible_shadow = False
    # lights: Sun far left/up-front -> 3/4 lit planets; cool rim from behind right; warm rim left
    add_light(sc, "KEY_sun", 'SUN', 4.2, (1.0, 0.96, 0.9), rot=sun_from_dir((-0.62, -0.78, 0.42)), angle=0.6)
    add_light(sc, "RIM_cool", 'SUN', 2.2, (0.55, 0.7, 1.0), rot=sun_from_dir((0.7, 0.9, 0.25)), angle=2)
    add_light(sc, "RIM_violet", 'SUN', 1.0, (0.75, 0.55, 1.0), rot=sun_from_dir((-0.2, 0.95, -0.4)), angle=2)
    add_light(sc, "FILL", 'SUN', 0.25, (0.5, 0.6, 1.0), rot=sun_from_dir((0.3, -1, -0.2)), angle=10)
    if with_path:
        pts = [Vector((-9.4, -4, 0.2)), Vector((-6.5, -4, 2.5)), Vector((-3.4, -4, 2.6)),
               Vector((-0.8, -4, 2.2)), Vector((2.4, -4, 2.6)), Vector((6.8, -4, 3.1)),
               Vector((10.4, -4, 1.4))]
        def cr(p0, p1, p2, p3, t):
            return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)
        P = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
        vs = []
        for i in range(1, len(P) - 2):
            for j in range(40):
                vs.append(cr(P[i - 1], P[i], P[i + 1], P[i + 2], j / 40))
        vs.append(pts[-1])
        dm = emis_mat("route_dash_mat", (1.0, 0.82, 0.42, 1), 3.5)
        pc = bpy.data.collections.new("route_path"); sc.collection.children.link(pc)
        acc = [0.0]
        for a_, b_ in zip(vs[:-1], vs[1:]):
            acc.append(acc[-1] + (b_ - a_).length)
        total = acc[-1]; step = 0.9; dist = 0.6
        while dist < total - 0.6:
            i = max(j for j in range(len(acc) - 1) if acc[j] <= dist)
            t = (dist - acc[i]) / max(1e-6, acc[i + 1] - acc[i])
            d = uv_sphere("dash", 0.12, pc, 12, 6)
            d.location = vs[i].lerp(vs[i + 1], t); d.data.materials.append(dm)
            d.visible_shadow = False
            dist += step
    compositor(sc, stars=True, glare=0.45, glare_thr=1.0)
    SHOTS["marshrut_yolli" if with_path else "marshrut"] = (sc, f"{REN}/{name}", "bg")
    return sc


# 2. SUN CAMERA: SDO in front, looking at a bright flaring Sun.
def shot_quyosh_kamera():
    name = "2_quyosh_kamerasi"
    sc = new_scene(name)
    setup_render(sc)
    make_world(sc, (0.008, 0.009, 0.02), 1.0)
    cam_loc = Vector((-2.0, -9.5, -0.6))
    cam_tgt = Vector((3.6, 3.0, 1.4))
    view = (cam_tgt - cam_loc).normalized()
    right = view.cross(Vector((0, 0, 1))).normalized()
    up = right.cross(view).normalized()
    sun_c = cam_loc + view * 48 + right * 22 + up * 8
    S = instance(sc, "sun", "Sun", sun_c, scale=13.0)
    # active region (local +X) toward the left limb as seen from camera
    to_cam = (cam_loc - sun_c).normalized()
    left = to_cam.cross(Vector((0, 0, 1))).normalized()
    orient(S, (1, 0, 0), (left + to_cam * 0.12).normalized(), (0, 0, 1), (0, 0, 1))
    sdo = instance(sc, "sdo", "SDO", (0, 0, 0))
    # SDO +Z (AIA telescopes + array faces) turned toward the Sun on the right. ARTISTIC POSE:
    # it is also turned ~40 deg toward the viewer so children see the telescopes and solar cells
    # (with the Sun in the frame a strictly Sun-pointing SDO would show only its back).
    axis = (right * 0.78 - view * 0.62 + up * 0.10).normalized()
    orient(sdo, (0, 0, 1), axis, (-1, 0, 0), (0, 0, 1))
    add_camera(sc, f"CAM_{name}", cam_loc, cam_tgt, lens=24)
    add_light(sc, "KEY_sun", 'SUN', 5.0, (1.0, 0.92, 0.80), rot=sun_from_dir(right * 0.8 - view * 0.3 + up * 0.45), angle=1.0)
    add_light(sc, "RIM_sun", 'SUN', 3.0, (1.0, 0.75, 0.45), rot=sun_from_dir(sun_c.normalized()), angle=1.0)
    add_light(sc, "RIM_cool", 'SUN', 1.2, (0.5, 0.65, 1.0), rot=sun_from_dir(-right * 0.7 + view * 0.5 + up * 0.5), angle=3)
    add_light(sc, "FILL_cam", 'SUN', 0.5, (0.55, 0.6, 0.9), rot=sun_from_dir(-view - right * 0.3), angle=10)
    compositor(sc, stars=True, glare=0.5, glare_thr=1.2, size=0.7)
    SHOTS["quyosh_kamera"] = (sc, f"{REN}/{name}", "bg")
    return sc


# 3. STORM ALARM: GOES near Earth, flaring Sun behind, pink/red tint (#ffb4c8).
def shot_boron():
    name = "3_boron_signali"
    sc = new_scene(name)
    setup_render(sc)
    make_world(sc, (0.02, 0.008, 0.014), 1.0)
    cam_loc = Vector((0, -23, 0.5))
    goes_loc = Vector((3.4, 0, 2.4))
    goes = instance(sc, "goes", "GOES", goes_loc)
    earth_c = Vector((-48, 45, -40))
    E = planet(sc, "earth", "Earth", earth_c, 44.0, (-75, 25), cam_loc + Vector((0, 0, 10)))
    sun_c = Vector((70, 190, 46))
    S = instance(sc, "sun_storm", "Sun_storm", sun_c, scale=20.0)
    to_cam = (cam_loc - sun_c).normalized()
    left = to_cam.cross(Vector((0, 0, 1))).normalized()
    orient(S, (1, 0, 0), (left + to_cam * 0.12).normalized(), (0, 0, 1), (0, 0, 1))
    # GOES: Earth-pointing deck (model +Z: ABI/GLM side) faces Earth, solar wing (model -X) points north/up
    nad = Matrix.Rotation(math.radians(GOES_YAW), 3, 'Z') @ (earth_c - goes_loc)
    orient(goes, (0, 0, 1), nad, (-1, 0, 0), (0, 0, 1))
    add_camera(sc, f"CAM_{name}", cam_loc, (-1.5, 8, 2.6), lens=30)
    sdir = (sun_c - Vector((0, 0, 0))).normalized()
    add_light(sc, "KEY_sun", 'SUN', 6.0, (1.0, 0.84, 0.88), rot=sun_from_dir(sdir), angle=1.0)
    add_light(sc, "RIM_pink", 'SUN', 4.0, (PINK[0], PINK[1], PINK[2]), rot=sun_from_dir((0.8, 0.6, 0.35)), angle=3)
    add_light(sc, "KEY_front", 'SUN', 2.2, (1.0, 0.86, 0.9), rot=sun_from_dir((0.55, -0.7, 0.45)), angle=5)
    add_light(sc, "FILL_earth", 'SUN', 1.2, (0.45, 0.6, 1.0), rot=sun_from_dir((-0.7, 0.2, -0.6)), angle=15)
    add_light(sc, "FILL_cam", 'SUN', 0.6, (1.0, 0.7, 0.8), rot=sun_from_dir((0.1, -1, 0.2)), angle=15)
    compositor(sc, stars=True, glare=0.8, glare_thr=0.95, size=0.85, tint=(1.0, 0.86, 0.9, 1), tint_fac=1.0)
    SHOTS["boron_signal"] = (sc, f"{REN}/{name}", "bg")
    return sc


# 4. MOON MEASUREMENT: LRO in low orbit over the Moon (CRaTER measures the radiation dose).
def shot_oy_olchov():
    name = "4_oy_olchovi"
    sc = new_scene(name)
    setup_render(sc)
    make_world(sc, (0.008, 0.009, 0.018), 1.0)
    cam_loc = Vector((0, -10.5, 2.0))
    moon_c = cam_loc + Vector((0, 0.70, -0.71)) * 300
    M = planet(sc, "moon", "Moon", moon_c, 190.0, (-25, 10), cam_loc + Vector((0, 0, 150)))
    lro = instance(sc, "lro", "LRO", (0.3, 0, 0.4))
    # LRO: instrument deck (model +Z: LROC, LOLA, CRaTER ... look down) faces the Moon
    orient(lro, (0, 0, 1), (moon_c - lro.location), (1, 0, 0), (1, 0.35, 0))
    cam = add_camera(sc, f"CAM_{name}", cam_loc, (0.0, 4.0, -0.9), lens=30)
    cam.data.dof.use_dof = True
    cam.data.dof.focus_distance = (cam_loc - lro.location).length
    cam.data.dof.aperture_fstop = 2.8
    add_light(sc, "KEY_sun", 'SUN', 5.5, (1.0, 0.95, 0.88), rot=sun_from_dir((-0.9, 0.35, 0.28)), angle=0.6)
    add_light(sc, "RIM_cool", 'SUN', 1.4, (0.55, 0.7, 1.0), rot=sun_from_dir((0.7, 0.8, 0.2)), angle=3)
    add_light(sc, "FILL_cam", 'SUN', 0.35, (0.6, 0.65, 0.9), rot=sun_from_dir((0.2, -1, 0.2)), angle=15)
    compositor(sc, stars=True, glare=0.35, glare_thr=1.2)
    SHOTS["oy_olchov"] = (sc, f"{REN}/{name}", "bg")
    return sc


# 5. GATEWAY around the Moon, Earth far away.
def shot_gateway():
    name = "5_gateway"
    sc = new_scene(name)
    setup_render(sc)
    make_world(sc, (0.008, 0.009, 0.02), 1.0)
    cam_loc = Vector((0, -50, 5))
    gw = instance(sc, "gateway", "Gateway", (0, 0, 0))
    gw.rotation_euler = (math.radians(12), math.radians(-18), math.radians(-35))
    moon_c = Vector((90, 420, -150))
    M = planet(sc, "moon", "Moon", moon_c, 230.0, (-10, 20), cam_loc)
    earth_c = Vector((400, 900, 165))
    E = planet(sc, "earth", "Earth", earth_c, 28.0, (40, 20), cam_loc)
    add_camera(sc, f"CAM_{name}", cam_loc, (2, 0, 1.5), lens=30)
    add_light(sc, "KEY_sun", 'SUN', 5.0, (1.0, 0.96, 0.9), rot=sun_from_dir((-0.8, -0.5, 0.45)), angle=0.6)
    add_light(sc, "RIM_cool", 'SUN', 1.6, (0.55, 0.7, 1.0), rot=sun_from_dir((0.6, 0.9, 0.3)), angle=3)
    add_light(sc, "FILL", 'SUN', 0.3, (0.6, 0.65, 0.9), rot=sun_from_dir((0.3, -1, -0.3)), angle=15)
    compositor(sc, stars=True, glare=0.35, glare_thr=1.2)
    SHOTS["gateway"] = (sc, f"{REN}/{name}", "bg")
    return sc


# 6. SPRITES (transparent PNG, 512 px)
SPRITES = {
    # key: (asset, view direction from object (camera side), lens, pad, extra)
    "sdo":     ("sdo", (0.9, -1.0, 0.35), 70, 1.10),
    "goes":    ("goes", (0.8, 1.0, 0.5), 70, 1.08),
    "lro":     ("lro", (1.0, -0.9, 0.45), 70, 1.10),
    "gateway": ("gateway", (0.8, -1.0, 0.45), 70, 1.06),
    "earth":   ("earth", (0, -1, 0), 120, 1.06),
    "moon":    ("moon", (0, -1, 0), 120, 1.03),
    "mars":    ("mars", (0, -1, 0), 120, 1.05),
    "sun":     ("sun", (0, -1, 0), 120, 1.15),
}


def shot_sprites():
    name = "6_sprites"
    sc = new_scene(name)
    setup_render(sc, transparent=True, rx=512, ry=512)
    make_world(sc, (0.05, 0.055, 0.08), 1.0)
    cam = add_camera(sc, f"CAM_{name}", (0, -20, 0), (0, 0, 0), lens=70)
    insts = {}
    for k, (asset, vd, lens, pad) in SPRITES.items():
        if k in ("earth", "moon", "mars", "sun"):
            e = instance(sc, asset, f"SPR_{k}", (0, 0, 0), scale=1.0)
            face = {"earth": (62, 30), "moon": (0, 0), "mars": (-70, -5), "sun": (0, 0)}[k]
            if k == "sun":
                orient(e, (1, 0, 0), (1, -0.12, 0.0), (0, 0, 1), (0, 0, 1))
            else:
                orient(e, lonlat(*face), (0, -1, 0), (0, 0, 1), (0, 0, 1))
        else:
            e = instance(sc, asset, f"SPR_{k}", (0, 0, 0))
        e.hide_render = True
        insts[k] = e
    add_light(sc, "KEY", 'SUN', 4.5, (1.0, 0.96, 0.9), rot=sun_from_dir((-0.7, -0.6, 0.6)), angle=1)
    add_light(sc, "RIM", 'SUN', 2.5, (0.55, 0.72, 1.0), rot=sun_from_dir((0.8, 0.9, 0.35)), angle=3)
    add_light(sc, "FILL", 'SUN', 0.6, (0.7, 0.75, 1.0), rot=sun_from_dir((0.6, -0.8, -0.3)), angle=15)
    sc.render.use_compositing = False
    for k in SPRITES:
        SHOTS[f"spr_{k}"] = (sc, f"{REN}/sprites/koinot_{k}", "sprite")
    sc["sprite_insts"] = list(insts.keys())
    return sc, insts, cam


def frame_object(sc, cam, inst, vdir, lens, pad):
    """Place cam along vdir and fit the instance into the frame with padding.
    Projection is done by hand (the depsgraph of a non-active scene is not updated here)."""
    key = inst.instance_collection.name[2:]
    objs = [o for o in inst.instance_collection.all_objects if o.type == 'MESH' and not o.hide_render]
    M = Matrix.LocRotScale(inst.location, inst.rotation_euler.to_quaternion(), inst.scale)
    globe = key in ("earth", "moon", "mars") or key.startswith("sun")
    pts = []
    for o in objs:
        me = o.data
        if len(me.vertices) == 0:
            continue
        co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
        step = max(1, len(co) // 4000)
        W = np.array(M @ mw(o))
        pts.append(co[::step] @ W[:3, :3].T + W[:3, 3])
    P = np.concatenate(pts)
    cam.data.lens = lens; cam.data.shift_x = 0; cam.data.shift_y = 0
    cam.data.sensor_fit = 'AUTO'
    d = Vector(vdir).normalized()
    if globe:
        r = {"earth": 1.03, "mars": 1.02, "moon": 1.0}.get(key, 1.6)
        c = Vector(inst.location)
    else:
        c = Vector(((P.min(0) + P.max(0)) / 2).tolist())
        r = float(np.linalg.norm(P - np.array(c), axis=1).max())
    fov = 2 * math.atan(18 / lens)
    dist = r * pad / math.sin(fov / 2)
    cam.location = c + d * dist
    look_at(cam, c)
    if globe:
        return
    Rm = cam.rotation_euler.to_matrix()
    inv = np.array(Rm.transposed())
    pc = (P - np.array(cam.location)) @ inv.T            # camera space
    z = -pc[:, 2]
    u = pc[:, 0] / z * (lens / 36.0); v = pc[:, 1] / z * (lens / 36.0)   # units of the larger frame side
    ar = sc.render.resolution_x / sc.render.resolution_y
    hw, hh = (0.5, 0.5 / ar) if ar >= 1 else (0.5 * ar, 0.5)
    cu = (u.max() + u.min()) / 2; cv = (v.max() + v.min()) / 2
    k = min(hw / ((u.max() - u.min()) / 2), hh / ((v.max() - v.min()) / 2)) / pad
    cam.data.lens = lens * k
    cam.data.shift_x = cu * k
    cam.data.shift_y = cv * k


# 7. COMPARISON views (model vs NASA reference photo angle), neutral grey studio
CMP = {
    "sdo":     ((1.0, -1.15, 0.30), 60),
    "goes":    ((0.9, -1.0, 0.25), 60),
    "lro":     ((1.0, -1.0, 0.20), 60),
    "lro_nadir": ((0.25, -0.35, 1.0), 60),
    "gateway": ((0.55, -1.0, 0.35), 50),
}


def shot_compare():
    name = "7_taqqoslash"
    sc = new_scene(name)
    setup_render(sc, transparent=False, rx=960, ry=720)
    make_world(sc, (0.16, 0.17, 0.19), 1.0)
    cam = add_camera(sc, f"CAM_{name}", (0, -20, 0), (0, 0, 0), lens=60)
    insts = {}
    for k in CMP:
        e = instance(sc, k.split("_")[0], f"CMP_{k}", (0, 0, 0)); e.hide_render = True; insts[k] = e
        SHOTS[f"cmp_{k}"] = (sc, f"{REN}/compare/model_{k}", "cmp")
    add_light(sc, "KEY", 'SUN', 4.0, (1, 0.97, 0.92), rot=sun_from_dir((-0.6, -0.8, 0.7)), angle=3)
    add_light(sc, "FILL", 'SUN', 1.2, (0.8, 0.85, 1.0), rot=sun_from_dir((0.8, -0.4, 0.1)), angle=10)
    sc.render.use_compositing = False
    return sc, insts, cam


# ==============================================================================================
shot_marshrut(False)
shot_marshrut(True)
shot_quyosh_kamera()
shot_boron()
shot_oy_olchov()
shot_gateway()
SPR_SC, SPR_INSTS, SPR_CAM = shot_sprites()
CMP_SC, CMP_INSTS, CMP_CAM = shot_compare()
log("scenes built:", [s.name for s in bpy.data.scenes])


# ---------------------------------------------------------------- rendering
def luminance_key_sprite(path, gain=2.2):
    """Sun sprite: rendered on pure black, alpha = brightness (so emissive glow, corona and
    prominences keep their soft edges in a transparent PNG)."""
    im = bpy.data.images.load(path, check_existing=False)
    w, h = im.size
    a = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(a); a = a.reshape(h, w, 4).astype(np.float64)
    lin = srgb2lin(np.clip(a[..., :3], 0, 1))
    al = np.clip(lin.max(2, keepdims=True) * gain, 0, 1)
    rgb = np.where(al > 1e-4, lin / np.maximum(al, 1e-4), 0)
    rgb = np.clip(rgb, 0, 1)
    srgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * rgb ** (1 / 2.4) - 0.055)
    res = np.concatenate([srgb, al], 2).astype(np.float32)
    im2 = bpy.data.images.new("keytmp", w, h, alpha=True)
    im2.pixels.foreach_set(res.ravel())
    im2.filepath_raw = path; im2.file_format = 'PNG'; im2.save()
    bpy.data.images.remove(im); bpy.data.images.remove(im2)


def save_outputs(sc, stem, kind):
    img = bpy.data.images['Render Result']
    ims = sc.render.image_settings
    if kind == "sprite":
        ims.file_format = 'PNG'; ims.color_mode = 'RGBA'; ims.compression = 90
        img.save_render(f"{stem}.png", scene=sc)
        if stem.endswith("koinot_sun") or stem.endswith("koinot_sun_test"):
            luminance_key_sprite(f"{stem}.png")
    else:
        ims.file_format = 'PNG'; ims.color_mode = 'RGB'; ims.compression = 80
        img.save_render(f"{stem}.png", scene=sc)
        if kind == "bg":
            ims.file_format = 'JPEG'; ims.color_mode = 'RGB'; ims.quality = 82
            img.save_render(f"{stem}.jpg", scene=sc)
    log("saved", stem)


def render_shot(key):
    sc, stem, kind = SHOTS[key]
    if TEST:
        sc.cycles.samples = 8
    if kind == "sprite":
        k = key[4:]
        for kk, e in SPR_INSTS.items():
            e.hide_render = (kk != k)
        asset, vd, lens, pad = SPRITES[k]
        frame_object(sc, SPR_CAM, SPR_INSTS[k], vd, lens, pad)
        sc.cycles.samples = min(SAMPLES, 48) if not TEST else 8
        is_sun = (k == "sun")
        sc.render.film_transparent = not is_sun
        sc.world.node_tree.nodes['Background'].inputs[1].default_value = 0.0 if is_sun else 1.0
        sc.render.use_compositing = is_sun
        if is_sun and not sc.compositing_node_group:
            compositor(sc, stars=False, glare=0.6, glare_thr=0.8, size=0.7)
    elif kind == "cmp":
        k = key[4:]
        for kk, e in CMP_INSTS.items():
            e.hide_render = (kk != k)
        vd, lens = CMP[k]
        frame_object(sc, CMP_CAM, CMP_INSTS[k], vd, lens, 1.08)
    else:
        if TEST:
            sc.render.resolution_x = 480; sc.render.resolution_y = 270
    import time
    t = time.time()
    bpy.ops.render.render(write_still=False, scene=sc.name)
    save_outputs(sc, stem + ("_test" if TEST else ""), kind)
    log(f"render {key} took {time.time() - t:.1f}s")


if RENDER and RENDER != "none":
    keys = []
    for tok in RENDER.split(","):
        if tok == "all":
            keys += list(SHOTS.keys())
        elif tok == "bg":
            keys += [k for k, v in SHOTS.items() if v[2] == "bg"]
        elif tok == "sprites":
            keys += [k for k, v in SHOTS.items() if v[2] == "sprite"]
        elif tok == "cmp":
            keys += [k for k, v in SHOTS.items() if v[2] == "cmp"]
        else:
            keys.append(tok)
    for k in keys:
        render_shot(k)

# ---------------------------------------------------------------- final .blend settings
if not NOSAVE:
    for sc in bpy.data.scenes:
        if sc.name == "_ASSETS":
            continue
        sc.cycles.device = 'GPU'           # Metal on the user's Mac
        sc.render.compositor_device = 'GPU'
        sc.render.threads_mode = 'AUTO'
        if sc.name == "6_sprites":
            sc.cycles.samples = 128
            for kk, e in SPR_INSTS.items():
                e.hide_render = (kk != "sdo")
            frame_object(sc, SPR_CAM, SPR_INSTS["sdo"], *SPRITES["sdo"][1:])
        elif sc.name == "7_taqqoslash":
            sc.cycles.samples = 64
            for kk, e in CMP_INSTS.items():
                e.hide_render = (kk != "sdo")
        else:
            sc.cycles.samples = 256
            sc.render.resolution_x = 1920; sc.render.resolution_y = 1080
        sc.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
    except Exception:
        pass
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    log("saved", BLEND)
