# -*- coding: utf-8 -*-
"""
XKS (Xalqaro Kosmik Stansiya / ISS) station builder for "Oy karvonsaroyi".

Run headless (rebuilds everything from scratch and saves scenes/xks/xks.blend):
  Blender -b --factory-startup -P scenes/xks/build_xks.py -- [options]

Options:
  --render orbit,eva,sprites   which renders to make (default: none)
  --samples 32                 Cycles samples for these renders
  --res 1280x720               background resolution (sprites are always <=512 px)
  --nosave                     do not write xks.blend

Units: 1 Blender unit = 1 metre. Every NASA model is scaled to its real size
(see REAL table below and docs/xks_nasa_taqqoslash.md).

Earth: a real-size sphere (R = 6 371 km) placed 400 km under the ISS. It is a
512x256 UV sphere; at that size one facet bulges only ~120 m, which is far below
one pixel at the 2 300 km horizon distance, so the limb looks perfectly round.
The texture is the Blue Marble image packed in source/models/earth-globe.glb,
mapped from the object-space normal (equirectangular), plus procedural clouds.
Atmosphere: a second sphere 80 km higher with an analytic "limb glow" shader
(tangent-altitude of the camera ray -> exponential density), camera rays only.
"""
import bpy, bmesh, math, os, sys, time
import numpy as np
from mathutils import Vector, Matrix, Euler

ROOT = "/Users/davronoff/dev/oy-karvonsaroyi-3d"
SRC = ROOT + "/source/models"
SCN_DIR = ROOT + "/scenes/xks"
REN_DIR = ROOT + "/renders/xks"
BLEND = SCN_DIR + "/xks.blend"

# ----------------------------------------------------------------------------- args
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith("--") else True
    return default
RENDER = [s for s in str(arg("--render", "")).split(",") if s and s != "True"]
SAMPLES = int(arg("--samples", 32))
RES = tuple(int(v) for v in str(arg("--res", "1280x720")).split("x"))
SAVE = not arg("--nosave", False)
ONLY_SPRITES = [s for s in str(arg("--sprites", "")).split(",") if s and s != "True"]

R_EARTH = 6_371_000.0
ALT = 400_000.0

# Real sizes (metres) used to scale the models; sources in docs/xks_nasa_taqqoslash.md
REAL = {
    # model: (real size in metres, which model bbox axis it matches)
    "iss":           (109.0, "Y"),    # end-to-end truss span 109 m (356 ft)
    "emu":           (1.90, "Z"),     # suited astronaut incl. PLSS/SAFER ~1.9 m
    "astronaut":     (1.90, "Z"),
    "robonaut-2":    (2.40, "Z"),     # gives NASA's 3 ft 4 in (1.02 m) waist-to-head with legs attached
    "crew-lock-bag": (0.46, "Z"),     # EVA tool bag ~0.46 m tall
    "oru":           (1.04, "X"),     # ISS Li-ion battery ORU ~41 in long
    "helmet":        (0.40, "Y"),     # EMU helmet + EVVA ~0.4 m
    "solar-wing":    (18.3, "Y"),     # used as iROSA: 18.3 m x 6 m (60 x 20 ft)
}

t0 = time.time()
def log(*a):
    print(f"[xks {time.time()-t0:6.1f}s]", *a, flush=True)

# ----------------------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
LIB = bpy.context.scene
LIB.name = "XKS_library"
LIB.view_settings.view_transform = "Standard"

# ----------------------------------------------------------------------------- helpers
def new_mat(name):
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m

def principled(name, base, metal=0.0, rough=0.5, spec=0.5, emis=None, emis_str=0.0, coat=0.0, alpha=1.0):
    m = new_mat(name)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = spec
    if coat:
        b.inputs["Coat Weight"].default_value = coat
    if emis:
        b.inputs["Emission Color"].default_value = (*emis, 1)
        b.inputs["Emission Strength"].default_value = emis_str
    b.inputs["Alpha"].default_value = alpha
    return m

def node(nt, typ, loc=(0, 0), **props):
    n = nt.nodes.new(typ)
    n.location = loc
    for k, v in props.items():
        setattr(n, k, v)
    return n

def math_node(nt, op, a=None, b=None, loc=(0, 0), clamp=False):
    n = nt.nodes.new("ShaderNodeMath"); n.operation = op; n.location = loc; n.use_clamp = clamp
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = v
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]

def add_noise_bump(m, scale=40.0, strength=0.15, coords="Object", detail=6.0):
    """Wrinkled-blanket bump for white MLI fabric."""
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = node(nt, "ShaderNodeTexCoord", (-900, -300))
    nz = node(nt, "ShaderNodeTexNoise", (-700, -300))
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = detail
    nt.links.new(tc.outputs[coords], nz.inputs["Vector"])
    bp = node(nt, "ShaderNodeBump", (-450, -300))
    bp.inputs["Strength"].default_value = strength
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

def white_blanket(name, base=(0.80, 0.79, 0.75), rough=0.62, var=0.06, scale=30.0, bump=0.12):
    """Off-white MLI / beta-cloth with a little colour variation + wrinkle bump."""
    m = principled(name, base, rough=rough)
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = node(nt, "ShaderNodeTexCoord", (-1100, 200))
    nz = node(nt, "ShaderNodeTexNoise", (-900, 200))
    nz.inputs["Scale"].default_value = scale * 0.25
    nz.inputs["Detail"].default_value = 3
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    ramp = node(nt, "ShaderNodeValToRGB", (-650, 200))
    ramp.color_ramp.elements[0].color = (base[0] - var, base[1] - var, base[2] - var * 1.2, 1)
    ramp.color_ramp.elements[1].color = (min(base[0] + var, 1), min(base[1] + var, 1), min(base[2] + var, 1), 1)
    nt.links.new(nz.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    add_noise_bump(m, scale=scale, strength=bump)
    return m

def grid_panel(name, cell=(0.35, 0.19), axes=("Z", "Y"), c1=(0.36, 0.17, 0.05), c2=(0.42, 0.21, 0.07),
               mortar=(0.55, 0.45, 0.30), mortar_size=0.012, metal=0.45, rough=0.32, back=None, bump=0.0,
               coords="Object", true_normal=True):
    """Solar-cell / panel grid using a Brick texture on object coordinates."""
    m = principled(name, c1, metal=metal, rough=rough)
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = node(nt, "ShaderNodeTexCoord", (-1300, 0))
    sep = node(nt, "ShaderNodeSeparateXYZ", (-1100, 0))
    nt.links.new(tc.outputs[coords], sep.inputs[0])
    comb = node(nt, "ShaderNodeCombineXYZ", (-900, 0))
    nt.links.new(sep.outputs[axes[0]], comb.inputs[0])
    nt.links.new(sep.outputs[axes[1]], comb.inputs[1])
    br = node(nt, "ShaderNodeTexBrick", (-650, 0))
    br.offset = 0.0
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Brick Width"].default_value = cell[0]
    br.inputs["Row Height"].default_value = cell[1]
    br.inputs["Mortar Size"].default_value = mortar_size
    br.inputs["Mortar Smooth"].default_value = 0.1
    br.inputs["Color1"].default_value = (*c1, 1)
    br.inputs["Color2"].default_value = (*c2, 1)
    br.inputs["Mortar"].default_value = (*mortar, 1)
    br.inputs["Bias"].default_value = 0.0
    nt.links.new(comb.outputs[0], br.inputs["Vector"])
    col = br.outputs["Color"]
    if back is not None:
        geo = node(nt, "ShaderNodeNewGeometry", (-650, 300))
        mix = node(nt, "ShaderNodeMix", (-350, 100)); mix.data_type = 'RGBA'
        nt.links.new(geo.outputs["Backfacing"], mix.inputs["Factor"])
        nt.links.new(col, mix.inputs[6])
        mix.inputs[7].default_value = (*back, 1)
        col = mix.outputs[2]
    nt.links.new(col, b.inputs["Base Color"])
    if true_normal:
        g2 = node(nt, "ShaderNodeNewGeometry", (-350, -500))
        nt.links.new(g2.outputs["True Normal"], b.inputs["Normal"])
    if bump:
        bp = node(nt, "ShaderNodeBump", (-350, -300)); bp.inputs["Strength"].default_value = bump
        nt.links.new(br.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return m

# ----------------------------------------------------------------------------- import
LIB_X = [0.0]
def import_model(name, real=None):
    """Import a NASA glb into its own collection LIB_<name>, parented to ROOT_<name>
    which carries the real-size scale. Returns (collection, root, meshes)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f"{SRC}/{name}.glb")
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        o.animation_data_clear()
    coll = bpy.data.collections.new("LIB_" + name)
    LIB.collection.children.link(coll)
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
    root = bpy.data.objects.new("ROOT_" + name, None)
    root.empty_display_type = 'PLAIN_AXES'
    coll.objects.link(root)
    for o in new:
        if o.parent is None:
            o.parent = root
    bpy.context.view_layer.update()
    meshes = [o for o in new if o.type == 'MESH']
    s = 1.0
    if real:
        size, axis = real
        mn, mx = world_bbox(meshes)
        ext = (mx - mn)["XYZ".index(axis)]
        s = size / ext
        root.scale = (s, s, s)
    bpy.context.view_layer.update()
    log(f"import {name}: {len(meshes)} meshes, scale {s:.5f}")
    return coll, root, meshes, s

def world_bbox(objs):
    mn = Vector((1e18,) * 3); mx = Vector((-1e18,) * 3)
    for o in objs:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
    return mn, mx

def recenter(coll, root, meshes, mode="center"):
    """Move root so the model sits centred on the origin ('center') or stands on z=0 ('floor')."""
    bpy.context.view_layer.update()
    mn, mx = world_bbox(meshes)
    c = (mn + mx) / 2
    off = Vector((c.x, c.y, mn.z if mode == "floor" else c.z))
    root.location -= off
    bpy.context.view_layer.update()

def make_instance(scene_coll, coll, name, loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
    e = bpy.data.objects.new(name, None)
    e.instance_type = 'COLLECTION'
    e.instance_collection = coll
    e.location = loc
    e.rotation_euler = rot
    e.scale = (scale, scale, scale)
    scene_coll.objects.link(e)
    return e

def mats_of(meshes):
    out = {}
    for o in meshes:
        for s in o.material_slots:
            if s.material:
                out.setdefault(s.material.name, []).append((o, s))
    return out

def replace_mat(meshes, old_name, new_mat):
    for o in meshes:
        for s in o.material_slots:
            if s.material and s.material.name == old_name:
                s.link = 'DATA'
                s.material = new_mat

# ============================================================================= LIBRARY
log("building library")

# ---- ISS ---------------------------------------------------------------------
iss_coll, iss_root, iss_meshes, ISS_S = import_model("iss", REAL["iss"])
# stray reference discs at z~41 (7 'bendedtru*'/'pCylinder*' objects, not part of the station)
for o in list(iss_meshes):
    if o.name.startswith(("bendedtru", "pCylinder")):
        iss_meshes.remove(o)
        bpy.data.objects.remove(o)
M = {}
M["array"] = grid_panel("XKS_ISS_legacy_array", cell=(0.30, 0.19), axes=("Z", "Y"),
                        c1=(0.60, 0.27, 0.045), c2=(0.68, 0.32, 0.06), mortar=(0.78, 0.74, 0.66),
                        mortar_size=0.022, metal=0.30, rough=0.30)
M["ru_array"] = grid_panel("XKS_ISS_ru_array", cell=(0.22, 0.22), axes=("Y", "Z"),
                           c1=(0.02, 0.035, 0.09), c2=(0.03, 0.05, 0.12), mortar=(0.45, 0.45, 0.48),
                           mortar_size=0.03, metal=0.4, rough=0.25)
M["radiator"] = grid_panel("XKS_ISS_radiator", cell=(1.0, 0.70), axes=("Z", "Y"),
                           c1=(0.86, 0.86, 0.84), c2=(0.62, 0.63, 0.64), mortar=(0.55, 0.56, 0.57),
                           mortar_size=0.02, metal=0.0, rough=0.38)
M["truss"] = grid_panel("XKS_ISS_truss", cell=(0.42, 0.30), axes=("Y", "X"),
                        c1=(0.80, 0.80, 0.78), c2=(0.72, 0.72, 0.71), mortar=(0.52, 0.52, 0.53),
                        mortar_size=0.03, metal=0.35, rough=0.42)
M["module"] = white_blanket("XKS_ISS_module_white", base=(0.80, 0.79, 0.75), scale=12.0, bump=0.08)
M["module2"] = white_blanket("XKS_ISS_module_silver", base=(0.70, 0.70, 0.69), scale=12.0, bump=0.06)
M["metal"] = principled("XKS_ISS_metal", (0.45, 0.45, 0.46), metal=0.8, rough=0.35)
M["dark"] = principled("XKS_ISS_dark", (0.06, 0.06, 0.065), metal=0.3, rough=0.4)
iss_map = {
    "lambert7SG.001": "array", "lambert4SG.001": "ru_array", "soyuz_blinn4SG.001": "radiator",
    "lambert3SG.001": "truss", "blinn1SG.001": "module", "blinn4SG.001": "module", "blinn5SG.001": "module",
    "anisotropic1SG.001": "module2", "apollohorns_blin.001": "metal", "blinn3SG.001": "metal",
    "bendedtruss_blin.001": "module2", "blinn6SG.001": "dark", "blinn7SG.001": "dark",
    "initialShadingGr.001": "metal", "lambert2SG.001": "metal", "lambert6SG.001": "metal",
    "soyuz_blinn2SG.001": "dark", "soyuz_blinn3SG.001": "metal",
}
for old, key in iss_map.items():
    replace_mat(iss_meshes, old, M[key])

def rebuild_radiators(objs, mat):
    """The model's radiators are zig-zag (accordion) panels: half of them face away from the
    sun and render black. Real HRS / PVR radiators are flat white rows of panels, so the
    radiator faces are deleted and replaced by flat panels at the same places
    (model units; HRS 6 x [1.4 x 8.1], PVR 4 x [3.9 x 1.1], from the component analysis)."""
    removed = 0
    for o in objs:
        idx = [i for i, s_ in enumerate(o.material_slots) if s_.material == mat]
        if not idx:
            continue
        bm = bmesh.new(); bm.from_mesh(o.data)
        dead = [f for f in bm.faces if f.material_index in idx]
        removed += len(dead)
        bmesh.ops.delete(bm, geom=dead, context='FACES')
        bm.to_mesh(o.data); bm.free(); o.data.update()
    bm = bmesh.new()
    def box(c, size):
        r = bmesh.ops.create_cube(bm, size=1.0)
        for v in r["verts"]:
            v.co = Vector((c[0] + v.co.x * size[0], c[1] + v.co.y * size[1], c[2] + v.co.z * size[2]))
    for y in (-9.45, -7.95, -6.45, 6.45, 7.95, 9.45):        # HRS: 3 per side, hang aft of S1/P1
        box((-1.05, y, 6.6), (0.035, 1.38, 8.1))
    for y in (-20.55, -13.95, 13.95, 20.55):                  # PVR: one per array pair, towards nadir
        box((1.2, y, 10.7), (3.9, 1.08, 0.035))
    me = bpy.data.meshes.new("XKS_ISS_radiators"); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("XKS_ISS_radiators", me)
    me.materials.append(M["radiator"]); me.materials.append(M["radiator_pvr"])
    for p in me.polygons:
        if abs(p.center.z - 10.7) < 0.1 and abs(p.center.x - 1.2) < 2.5 and max(abs(p.center.y) - 13.0, 0) > 0:
            p.material_index = 1
    ob.parent = bpy.data.objects["isscombine"]
    iss_coll.objects.link(ob)
    iss_meshes.append(ob)
    log("radiators rebuilt, removed faces:", removed)
M["radiator_pvr"] = grid_panel("XKS_ISS_radiator_pvr", cell=(0.55, 0.36), axes=("X", "Y"),
                               c1=(0.84, 0.84, 0.82), c2=(0.80, 0.80, 0.79), mortar=(0.55, 0.56, 0.57),
                               mortar_size=0.02, metal=0.0, rough=0.38)
rebuild_radiators(iss_meshes, M["radiator"])
recenter(iss_coll, iss_root, iss_meshes, "center")

# ---- iROSA (built from the NASA 'solar-wing' panel, scaled to 18.3 m x 6 m) -----------
sw_coll, sw_root, sw_meshes, SW_S = import_model("solar-wing", None)
M["irosa"] = grid_panel("XKS_iROSA_cells", cell=(1 / 10.0, 1 / 44.0), axes=("X", "Y"), coords="Generated",
                        c1=(0.018, 0.028, 0.075), c2=(0.024, 0.036, 0.095), mortar=(0.30, 0.31, 0.34),
                        mortar_size=0.0012, metal=0.0, rough=0.45)
M["irosa"].node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = 0.12
replace_mat(sw_meshes, "SolarPanels1", M["irosa"])
replace_mat(sw_meshes, "lambert1.002", M["metal"])
# keep a single wing as the iROSA unit (the second wing is deleted)
keep = sw_meshes[0]
for o in sw_meshes[1:]:
    bpy.data.objects.remove(o)
sw_meshes = [keep]
bpy.context.view_layer.update()
mn, mx = world_bbox(sw_meshes)
ext = mx - mn
sw_root.scale = (6.0 / ext.x, 18.3 / ext.y, (0.08 / ext.z) if ext.z > 1e-6 else 1.0)
bpy.context.view_layer.update()
recenter(sw_coll, sw_root, sw_meshes, "center")
mn, mx = world_bbox(sw_meshes)
log("iROSA unit size", tuple(round(v, 2) for v in (mx - mn)))

def add_irosas(iss_parent_coll):
    """Eight iROSA roll-out arrays on top of legacy wings (ISS-model space, before ISS scale).
    Legacy wing roots are at model Z=9.75 (aft wings) / 11.85 (forward wings); wing plane X=-1.1."""
    roots = []
    # (wing centre Y in model units, forward?)
    # model +Y = port. P6 (2B,4B) y=+21, P4 (2A,4A) y=+14.8, S4 (1A,3A) y=-14.8, S6 (1B,3B) y=-21
    for y, fwd in [(21.0, True), (21.0, False), (14.8, True), (14.8, False),
                   (-14.8, True), (-14.8, False), (-21.0, True), (-21.0, False)]:
        roots.append((y, fwd))
    objs = []
    L = 18.3 / ISS_S; W = 6.0 / ISS_S
    for i, (y, fwd) in enumerate(roots):
        z_root = 11.85 if fwd else 9.75
        sign = 1 if fwd else -1
        e = bpy.data.objects.new(f"iROSA_{i+1}", None)
        e.instance_type = 'COLLECTION'; e.instance_collection = sw_coll
        tilt = math.radians(10)
        # centre of the iROSA: starts 0.6 units out from the wing root, lifted to the zenith side (-X)
        zc = z_root + sign * (0.6 + L / 2 * math.cos(tilt))
        xc = -1.1 - 0.35 - L / 2 * math.sin(tilt)
        e.location = (xc, y, zc)
        # unit lies in XY plane (long axis Y); rotate so long axis -> model Z and face -> model X
        e.rotation_euler = Euler((math.radians(90), 0, math.radians(90)), 'XYZ')
        e.rotation_euler.rotate(Euler((0, -sign * tilt, 0)))
        e.scale = (1 / ISS_S,) * 3
        e.parent = iss_root
        iss_coll.objects.link(e)
        objs.append(e)
    return objs
IROSA = add_irosas(iss_coll)

# ---- Earth image ---------------------------------------------------------------
eg_coll, eg_root, eg_meshes, _ = import_model("earth-globe", None)
earth_img = None
for o in eg_meshes:
    for s in o.material_slots:
        for n in s.material.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                earth_img = n.image
earth_img.name = "XKS_blue_marble_oct_glb"
BM_HI = SCN_DIR + "/tex/bluemarble_oct_5400.jpg"   # NASA Blue Marble NG, October 2004, 5400x2700
if os.path.exists(BM_HI):
    earth_img = bpy.data.images.load(BM_HI)
    earth_img.name = "XKS_blue_marble_oct"
log("earth texture", earth_img.name, tuple(earth_img.size))
earth_img.use_fake_user = True
for o in eg_meshes:
    bpy.data.objects.remove(o)
bpy.data.objects.remove(eg_root)
bpy.data.collections.remove(eg_coll)

# ---- texture clean-up helpers -------------------------------------------------------
def img_np(img):
    w, h = img.size
    return np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)

def np_img(img, arr):
    img.pixels[:] = arr.ravel()
    img.update()
    img.pack()

def fill_rect(arr, x0, y0, x1, y1, ring=6):
    """Paint a rectangle (pixel coords, origin bottom-left like Blender) with the median
    colour of a ring around it - removes printed flags/logos from fabric textures."""
    h, w, _ = arr.shape
    x0, x1 = max(0, x0), min(w, x1); y0, y1 = max(0, y0), min(h, y1)
    X0, X1 = max(0, x0 - ring), min(w, x1 + ring); Y0, Y1 = max(0, y0 - ring), min(h, y1 + ring)
    region = arr[Y0:Y1, X0:X1].copy()
    mask = np.ones(region.shape[:2], bool); mask[y0 - Y0:y1 - Y0, x0 - X0:x1 - X0] = False
    med = np.median(region[mask], axis=0)
    noise = (np.random.default_rng(1).normal(0, 0.008, (y1 - y0, x1 - x0, 1))).astype(np.float32)
    arr[y0:y1, x0:x1, :3] = med[:3] + noise
    return arr

def find_logo_boxes(arr, sat_thr=0.22, dark_thr=0.35, min_px=30):
    """Connected boxes of strongly coloured or dark pixels (flags, logos, patches)."""
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

# ---- EMU (spacewalk suit) -------------------------------------------------------------
emu_coll, emu_root, emu_meshes, EMU_S = import_model("emu", REAL["emu"])
M["suit"] = white_blanket("XKS_EMU_fabric", base=(0.86, 0.86, 0.84), rough=0.75, scale=60.0, bump=0.05, var=0.03)
M["suit_hard"] = principled("XKS_EMU_hard_white", (0.82, 0.82, 0.80), rough=0.45)
M["visor_gold"] = principled("XKS_visor_gold", (0.95, 0.70, 0.30), metal=1.0, rough=0.08)
M["suit_grey"] = principled("XKS_EMU_grey", (0.35, 0.35, 0.36), metal=0.4, rough=0.45)
emu_fix = {
    # hidden/replaced (flag, patch, lettered display box)
    "EMU:emusuit21_emusuit5_jetpack2SG": "suit_hard",
    "EMU:emusuit21_lambert9SG": "suit",
    "EMU:emusuit21_lambert8SG": "suit",
    "EMU:emusuit21_lambert7SG": "suit_hard",
    # glTF transmission=1 made the whole suit look like glass -> opaque white fabric
    "EMU:emusuit21_emusuit5_lambert2SG": "suit", "EMU:emusuit21_lambert2SG": "suit",
    "EMU:emusuit21_emusuit4_justbody_lambert2SG": "suit", "EMU:emusuit21_body_lambert2SG": "suit",
    "EMU:emusuit21_jetpack2SG": "suit_hard", "EMU:emusuit21_lambert5SG": "suit_hard",
    "EMU:emusuit21_emusuit5_lambert5SG": "suit_hard", "EMU:initialShadingGroup": "suit_grey",
    "EMU:emusuit21_lambert10SG": "suit_hard",
    "EMU:emusuit21_emusuit4_justbody_blinn3SG": "visor_gold", "EMU:emusuit21_emusuit5_blinn3SG": "visor_gold",
    "EMU:emusuit21_blinn3SG": "visor_gold",
}
for old, key in emu_fix.items():
    replace_mat(emu_meshes, old, M[key])
for name, lst in mats_of(emu_meshes).items():
    m = bpy.data.materials[name]
    if name.startswith("XKS_"):
        continue
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b:
        b.inputs["Transmission Weight"].default_value = 0.0
        b.inputs["Roughness"].default_value = min(b.inputs["Roughness"].default_value, 0.6)
for im in list(bpy.data.images):
    if im.name in ("emusuitFLAGpatch", "emusuitvitruvianpatch", "emusuitbox4"):
        bpy.data.images.remove(im)
recenter(emu_coll, emu_root, emu_meshes, "center")

# ---- astronaut (flag / NASA logo / patch painted in its texture -> painted over) ----------
ast_coll, ast_root, ast_meshes, AST_S = import_model("astronaut", REAL["astronaut"])
ast_img = bpy.data.images.get("astnt1_1")
if ast_img:
    arr = img_np(ast_img)
    boxes = find_logo_boxes(arr)
    painted = []
    for (x0, y0, x1, y1, n) in boxes:
        bw, bh = x1 - x0, y1 - y0
        # long thin red stripe on the leg is a real EMU crew stripe, keep it
        if bw > 6 * bh or bh > 6 * bw:
            continue
        fill_rect(arr, x0 - 3, y0 - 3, x1 + 3, y1 + 3)
        painted.append((x0, y0, x1, y1))
    np_img(ast_img, arr)
    ast_img.name = "astnt1_1_nologo"
    log("astronaut texture: painted over", painted)
recenter(ast_coll, ast_root, ast_meshes, "center")

# ---- Robonaut 2 ---------------------------------------------------------------
r2_coll, r2_root, r2_meshes, _ = import_model("robonaut-2", None)
# a stray duplicate 'R2.Hips' lies under the feet (z<0) - not part of the robot
for o in list(r2_meshes):
    if o.name == "R2.Hips":
        r2_meshes.remove(o); bpy.data.objects.remove(o)
bpy.context.view_layer.update()
_mn, _mx = world_bbox(r2_meshes)
R2_S = REAL["robonaut-2"][0] / (_mx.z - _mn.z)
r2_root.scale = (R2_S,) * 3
bpy.context.view_layer.update()
log(f"robonaut-2 rescaled after stray removal: {R2_S:.4f}")
r2_cols = {
    "BlackMetal": ((0.03, 0.03, 0.035), 0.8, 0.35), "BlueLights": ((0.1, 0.35, 1.0), 0.0, 0.3),
    "Chrome.Rough": ((0.75, 0.75, 0.76), 1.0, 0.25), "GreyMetal": ((0.40, 0.40, 0.42), 0.9, 0.35),
    "R2.Backpack": ((0.80, 0.80, 0.78), 0.0, 0.45), "R2.ChestCover": ((0.85, 0.85, 0.83), 0.0, 0.35),
    "R2.GoldMetal": ((0.90, 0.68, 0.32), 1.0, 0.25), "R2.GoldMetal.Head": ((0.92, 0.72, 0.35), 1.0, 0.2),
    "R2.WhiteCloth.Arm": ((0.86, 0.86, 0.84), 0.0, 0.8), "R2.WhiteCloth.Generic": ((0.86, 0.86, 0.84), 0.0, 0.8),
    "R2.WhiteCloth.Generic.001": ((0.86, 0.86, 0.84), 0.0, 0.8), "Visor.001": ((0.02, 0.02, 0.03), 0.6, 0.05),
    "WhitePlastic": ((0.86, 0.86, 0.85), 0.0, 0.4),
}
for name, (col, met, rough) in r2_cols.items():
    m = bpy.data.materials.get(name)
    if not m:
        continue
    nt = m.node_tree
    for l in list(nt.links):
        if l.to_node.type == 'BSDF_PRINCIPLED' and l.to_socket.name == "Base Color":
            nt.links.remove(l)
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Metallic"].default_value = met
    b.inputs["Roughness"].default_value = rough
    if name == "BlueLights":
        b.inputs["Emission Color"].default_value = (0.1, 0.4, 1.0, 1); b.inputs["Emission Strength"].default_value = 3.0
recenter(r2_coll, r2_root, r2_meshes, "center")

# ---- Crew Lock Bag (soft stowage bag = the game's water-wall brick) -----------------------
clb_coll, clb_root, clb_meshes, CLB_S = import_model("crew-lock-bag", REAL["crew-lock-bag"])
# two small barcode labels with tiny lettering at the bottom of the bag -> painted over
clb_img = bpy.data.images.get("crwlckbg")
if clb_img:
    arr = img_np(clb_img)
    for (x0, y0, x1, y1) in ((472, 11, 520, 38), (796, 11, 847, 39)):
        fill_rect(arr, x0, y0, x1, y1, ring=4)
    np_img(clb_img, arr)
    clb_img.name = "crwlckbg_nolabels"
recenter(clb_coll, clb_root, clb_meshes, "center")

# ---- ORU -----------------------------------------------------------------------
oru_coll, oru_root, oru_meshes, ORU_S = import_model("oru", REAL["oru"])
for name in ("spstob_eal_1", "spstob_slic_1a", "spstob_slic_2", "naming"):
    m = bpy.data.materials.get(name)
    if m:
        b = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
        b.inputs["Metallic"].default_value = 1.0
        b.inputs["Roughness"].default_value = 0.32
        nt = m.node_tree
        lk = next((l for l in nt.links if l.to_node == b and l.to_socket.name == "Base Color"), None)
        if lk:
            hs = nt.nodes.new("ShaderNodeHueSaturation")
            hs.inputs["Value"].default_value = 1.6; hs.inputs["Saturation"].default_value = 1.1
            src = lk.from_socket; nt.links.remove(lk)
            nt.links.new(src, hs.inputs["Color"]); nt.links.new(hs.outputs["Color"], b.inputs["Base Color"])
recenter(oru_coll, oru_root, oru_meshes, "center")

# ---- helmet ----------------------------------------------------------------------
hel_coll, hel_root, hel_meshes, HEL_S = import_model("helmet", REAL["helmet"])
replace_mat(hel_meshes, "helmet", M["suit_hard"])
replace_mat(hel_meshes, "White", M["suit_hard"])
replace_mat(hel_meshes, "visor", M["visor_gold"])
replace_mat(hel_meshes, "Tree", M["suit_grey"])
recenter(hel_coll, hel_root, hel_meshes, "center")

# spread library roots along X for browsing; instances use instance_offset
lib_items = [(iss_coll, iss_root, 0), (sw_coll, sw_root, 120), (emu_coll, emu_root, 150), (ast_coll, ast_root, 153),
             (r2_coll, r2_root, 156), (clb_coll, clb_root, 159), (oru_coll, oru_root, 161), (hel_coll, hel_root, 163)]
for coll, root, x in lib_items:
    root.location.x += x
    coll.instance_offset = (x, 0, 0)
bpy.context.view_layer.update()

# ============================================================================= WORLD / EARTH
def make_world(name, strength=0.0):
    w = bpy.data.worlds.new(name)
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0, 0, 0, 1)
    bg.inputs[1].default_value = strength
    return w

def earth_material(sun_dir):
    m = new_mat("XKS_Earth_BlueMarble")
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    tc = node(nt, "ShaderNodeTexCoord", (-1800, 0))
    # unit vector on the sphere (object space)
    nrm = node(nt, "ShaderNodeVectorMath", (-1600, 0)); nrm.operation = 'NORMALIZE'
    nt.links.new(tc.outputs["Object"], nrm.inputs[0])
    sep = node(nt, "ShaderNodeSeparateXYZ", (-1400, 0)); nt.links.new(nrm.outputs[0], sep.inputs[0])
    lon = math_node(nt, 'ARCTAN2', sep.outputs["Y"], sep.outputs["X"], (-1200, 100))
    lat = math_node(nt, 'ARCSINE', sep.outputs["Z"], None, (-1200, -100))
    u = math_node(nt, 'MULTIPLY_ADD', lon, 1 / (2 * math.pi), (-1000, 100))
    nt.nodes[-1].inputs[2].default_value = 0.5
    v = math_node(nt, 'MULTIPLY_ADD', lat, 1 / math.pi, (-1000, -100))
    nt.nodes[-1].inputs[2].default_value = 0.5
    uv = node(nt, "ShaderNodeCombineXYZ", (-800, 0)); nt.links.new(u, uv.inputs[0]); nt.links.new(v, uv.inputs[1])
    tex = node(nt, "ShaderNodeTexImage", (-600, 0)); tex.image = earth_img; tex.interpolation = 'Cubic'
    tex.extension = 'REPEAT'
    nt.links.new(uv.outputs[0], tex.inputs["Vector"])
    # procedural clouds (3D noise on the unit sphere): large-scale coverage x small-scale detail
    nzc = node(nt, "ShaderNodeTexNoise", (-1000, -400)); nzc.noise_dimensions = '3D'
    nzc.inputs["Scale"].default_value = 3.0; nzc.inputs["Detail"].default_value = 2.0
    nt.links.new(nrm.outputs[0], nzc.inputs["Vector"])
    nz = node(nt, "ShaderNodeTexNoise", (-1000, -650)); nz.noise_dimensions = '3D'
    nz.inputs["Scale"].default_value = 30.0; nz.inputs["Detail"].default_value = 15.0
    nz.inputs["Roughness"].default_value = 0.62; nz.inputs["Distortion"].default_value = 0.6
    nt.links.new(nrm.outputs[0], nz.inputs["Vector"])
    cov = math_node(nt, 'MULTIPLY_ADD', nzc.outputs["Fac"], 0.9, (-800, -450)); nt.nodes[-1].inputs[2].default_value = -0.45
    dens = math_node(nt, 'ADD', nz.outputs["Fac"], cov, (-650, -500))
    ramp = node(nt, "ShaderNodeValToRGB", (-550, -400))
    ramp.color_ramp.elements[0].position = 0.50; ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 0.62; ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(dens, ramp.inputs["Fac"])
    hsv = node(nt, "ShaderNodeHueSaturation", (-400, 100))
    hsv.inputs["Saturation"].default_value = 1.18; hsv.inputs["Value"].default_value = 0.95
    nt.links.new(tex.outputs["Color"], hsv.inputs["Color"])
    cl = node(nt, "ShaderNodeMix", (-250, 0)); cl.data_type = 'RGBA'
    nt.links.new(ramp.outputs["Color"], cl.inputs["Factor"])
    nt.links.new(hsv.outputs["Color"], cl.inputs[6])
    cl.inputs[7].default_value = (0.92, 0.93, 0.95, 1)
    nt.links.new(cl.outputs[2], b.inputs["Base Color"])
    # oceans: glossier (blue dominant pixels)
    sepc = node(nt, "ShaderNodeSeparateColor", (-400, -700)); nt.links.new(tex.outputs["Color"], sepc.inputs[0])
    d = math_node(nt, 'SUBTRACT', sepc.outputs[2], sepc.outputs[0], (-200, -700))
    ocean = math_node(nt, 'MULTIPLY', d, 6.0, (-50, -700), clamp=True)
    notcloud = math_node(nt, 'SUBTRACT', 1.0, ramp.outputs["Color"], (-50, -850))
    oc = math_node(nt, 'MULTIPLY', ocean, notcloud, (100, -750))
    rough = math_node(nt, 'MULTIPLY_ADD', oc, -0.55, (250, -750)); nt.nodes[-1].inputs[2].default_value = 0.85
    nt.links.new(rough, b.inputs["Roughness"])
    b.inputs["Specular IOR Level"].default_value = 0.35
    return m

def atmosphere_material(sun_dir, r_shell, suffix=""):
    """Analytic limb glow. For the camera ray at the shell entry point P (object space,
    earth centre = origin) the tangent altitude is h = |P x D| - R. Sky above the limb:
    glow ~ exp(-h/H). Rays that hit the ground get haze ~ 1 - exp(-k/mu)."""
    m = new_mat("XKS_Atmosphere" + suffix)
    nt = m.node_tree; nt.nodes.clear()
    out = node(nt, "ShaderNodeOutputMaterial", (1600, 0))
    geo = node(nt, "ShaderNodeNewGeometry", (-1800, 0))
    tc = node(nt, "ShaderNodeTexCoord", (-1800, 300))
    # D = -Incoming (world == object orientation for the shell)
    dneg = node(nt, "ShaderNodeVectorMath", (-1550, -100)); dneg.operation = 'SCALE'
    nt.links.new(geo.outputs["Incoming"], dneg.inputs[0]); dneg.inputs["Scale"].default_value = -1.0
    cr = node(nt, "ShaderNodeVectorMath", (-1300, 200)); cr.operation = 'CROSS_PRODUCT'
    nt.links.new(tc.outputs["Object"], cr.inputs[0]); nt.links.new(dneg.outputs[0], cr.inputs[1])
    ln = node(nt, "ShaderNodeVectorMath", (-1100, 200)); ln.operation = 'LENGTH'
    nt.links.new(cr.outputs[0], ln.inputs[0])
    h = math_node(nt, 'SUBTRACT', ln.outputs["Value"], R_EARTH, (-900, 200))   # tangent altitude (m)
    hk = math_node(nt, 'DIVIDE', h, 1000.0, (-700, 200))                        # km
    # sky glow above the limb: exp(-h/8.5km), only where h > 0
    hkp = math_node(nt, 'MAXIMUM', hk, 0.0, (-600, 300))      # avoid exp() overflow -> NaN for ground rays
    e1 = math_node(nt, 'DIVIDE', hkp, -8.5, (-500, 300))
    sky = math_node(nt, 'EXPONENT', e1, None, (-300, 300))
    pos = math_node(nt, 'GREATER_THAN', hk, 0.0, (-300, 450))
    sky2 = math_node(nt, 'MULTIPLY', sky, pos, (-100, 350))
    # ground haze: mu = |N.D| at entry, haze = 1-exp(-0.06/mu), only where h <= 0
    dot = node(nt, "ShaderNodeVectorMath", (-1100, -250)); dot.operation = 'DOT_PRODUCT'
    nt.links.new(geo.outputs["Normal"], dot.inputs[0]); nt.links.new(geo.outputs["Incoming"], dot.inputs[1])
    mu = math_node(nt, 'ABSOLUTE', dot.outputs["Value"], None, (-900, -250))
    mu2 = math_node(nt, 'MAXIMUM', mu, 0.02, (-700, -250))
    q = math_node(nt, 'DIVIDE', -0.035, mu2, (-500, -250))
    qe = math_node(nt, 'EXPONENT', q, None, (-300, -250))
    haze = math_node(nt, 'SUBTRACT', 1.0, qe, (-100, -250))
    neg = math_node(nt, 'SUBTRACT', 1.0, pos, (-100, -400))
    haze2 = math_node(nt, 'MULTIPLY', haze, neg, (100, -300))
    # sun side factor (day side of the planet only; reddish near the terminator)
    sd = node(nt, "ShaderNodeVectorMath", (-1100, -600)); sd.operation = 'DOT_PRODUCT'
    nt.links.new(geo.outputs["Normal"], sd.inputs[0]); sd.inputs[1].default_value = sun_dir
    day = node(nt, "ShaderNodeMapRange", (-800, -600))
    nt.links.new(sd.outputs["Value"], day.inputs["Value"])
    day.inputs["From Min"].default_value = -0.25; day.inputs["From Max"].default_value = 0.25
    # colours
    skyc = node(nt, "ShaderNodeValToRGB", (100, 500))    # by tangent altitude in km
    cr_ = skyc.color_ramp
    cr_.elements[0].position = 0.0; cr_.elements[0].color = (0.55, 0.80, 1.0, 1)
    cr_.elements[1].position = 1.0; cr_.elements[1].color = (0.01, 0.03, 0.25, 1)
    e = cr_.elements.new(0.15); e.color = (0.18, 0.45, 1.0, 1)
    hn = math_node(nt, 'DIVIDE', hk, 45.0, (-100, 550), clamp=True)
    nt.links.new(hn, skyc.inputs["Fac"])
    e_sky = node(nt, "ShaderNodeMix", (400, 400)); e_sky.data_type = 'RGBA'; e_sky.blend_type = 'MULTIPLY'
    e_sky.inputs["Factor"].default_value = 1.0
    nt.links.new(skyc.outputs["Color"], e_sky.inputs[6])
    nt.links.new(sky2, e_sky.inputs[7])
    hazec = (0.16, 0.30, 0.65)
    e_hz = node(nt, "ShaderNodeVectorMath", (400, -200)); e_hz.operation = 'SCALE'
    e_hz.inputs[0].default_value = hazec
    nt.links.new(haze2, e_hz.inputs["Scale"])
    add = node(nt, "ShaderNodeVectorMath", (650, 100)); add.operation = 'ADD'
    nt.links.new(e_sky.outputs[2], add.inputs[0]); nt.links.new(e_hz.outputs[0], add.inputs[1])
    dayscale = node(nt, "ShaderNodeVectorMath", (850, 100)); dayscale.operation = 'SCALE'
    nt.links.new(add.outputs[0], dayscale.inputs[0]); nt.links.new(day.outputs["Result"], dayscale.inputs["Scale"])
    em = node(nt, "ShaderNodeEmission", (1050, 100)); em.inputs["Strength"].default_value = 2.2
    em.name = "LimbGlow"
    nt.links.new(dayscale.outputs[0], em.inputs["Color"])
    tr = node(nt, "ShaderNodeBsdfTransparent", (1050, -100))
    # camera rays only, front faces only: emission colour * gate, then + transparent
    lp = node(nt, "ShaderNodeLightPath", (800, 400))
    front = math_node(nt, 'SUBTRACT', 1.0, geo.outputs["Backfacing"], (900, 500))
    gate = math_node(nt, 'MULTIPLY', lp.outputs["Is Camera Ray"], front, (1050, 450))
    gated = node(nt, "ShaderNodeVectorMath", (950, 100)); gated.operation = 'SCALE'
    nt.links.new(dayscale.outputs[0], gated.inputs[0]); nt.links.new(gate, gated.inputs["Scale"])
    nt.links.new(gated.outputs[0], em.inputs["Color"])
    addsh = node(nt, "ShaderNodeAddShader", (1420, 0))
    nt.links.new(em.outputs[0], addsh.inputs[0]); nt.links.new(tr.outputs[0], addsh.inputs[1])
    nt.links.new(addsh.outputs[0], out.inputs["Surface"])
    return m

def make_earth(coll, center, sun_dir, sub_lat=25.0, sub_lon=55.0, north_deg=90.0, suffix=""):
    """Real-size Earth + atmosphere shell. sub_lat/lon: the point under the ISS."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=512, v_segments=256, radius=R_EARTH)
    me = bpy.data.meshes.new("XKS_Earth_mesh" + suffix); bm.to_mesh(me); bm.free()
    for p in me.polygons:
        p.use_smooth = True
    earth = bpy.data.objects.new("Earth" + suffix, me)
    earth.data.materials.append(bpy.data.materials.get("XKS_Earth_BlueMarble") or earth_material(sun_dir))
    earth.location = center
    # rotate so that (sub_lat, sub_lon) points to +Z (towards the ISS)
    earth.rotation_mode = 'XYZ'
    rot = Euler((0, 0, -math.radians(sub_lon)), 'XYZ').to_matrix()
    rot = Matrix.Rotation(-math.radians(90 - sub_lat), 3, 'Y') @ rot
    # local north now points to world -X; turn it to the requested heading
    rot = Matrix.Rotation(math.radians(north_deg - 180.0), 3, 'Z') @ rot
    earth.rotation_euler = rot.to_euler()
    coll.objects.link(earth)
    r_shell = R_EARTH + 80_000.0
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=512, v_segments=256, radius=r_shell)
    me2 = bpy.data.meshes.new("XKS_Atmo_mesh" + suffix); bm.to_mesh(me2); bm.free()
    for p in me2.polygons:
        p.use_smooth = True
    atmo = bpy.data.objects.new("Atmosphere" + suffix, me2)
    atmo.data.materials.append(atmosphere_material(sun_dir, r_shell, suffix))
    atmo.location = center
    atmo.visible_shadow = False
    atmo.visible_diffuse = False
    atmo.visible_glossy = False
    atmo.visible_transmission = False
    atmo.visible_volume_scatter = False
    coll.objects.link(atmo)
    return earth, atmo

def setup_render(sc, res=(1280, 720), samples=32, transparent=False):
    sc.render.engine = 'CYCLES'
    cy = sc.cycles
    cy.device = 'CPU'
    cy.samples = samples
    cy.use_denoising = True
    try:
        cy.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    cy.use_adaptive_sampling = True
    cy.max_bounces = 6; cy.diffuse_bounces = 3; cy.glossy_bounces = 3; cy.transparent_max_bounces = 8
    cy.caustics_reflective = False; cy.caustics_refractive = False
    cy.blur_glossy = 1.0
    sc.render.threads_mode = 'FIXED'; sc.render.threads = 2
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA' if transparent else 'RGB'
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    sc.render.use_persistent_data = False

def add_sun(coll, direction, strength=4.5, angle=0.53, name="Sun"):
    ld = bpy.data.lights.new(name, 'SUN')
    ld.energy = strength
    ld.angle = math.radians(angle)
    ld.color = (1.0, 0.98, 0.95)
    sun = bpy.data.objects.new(name, ld)
    sun.rotation_euler = Vector(direction).normalized().to_track_quat('Z', 'Y').to_euler()  # light points along -Z
    coll.objects.link(sun)
    return sun

def add_camera(coll, name, loc, target, lens=35.0, up=(0, 0, 1)):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.sensor_width = 36.0
    cd.clip_start = 0.05
    cd.clip_end = 2.0e7
    cam = bpy.data.objects.new(name, cd)
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    coll.objects.link(cam)
    return cam

# ============================================================================= SCENE 1: ORBIT
def build_orbit():
    sc = bpy.data.scenes.new("XKS_1_orbit")
    sc.world = make_world("XKS_space_black")
    setup_render(sc, RES, SAMPLES)
    sun_dir = Vector((-0.35, -0.75, 0.62)).normalized()     # direction TO the sun
    # ISS: model nadir (+X) -> world -Z, velocity (+Z) -> world +X, truss along world Y
    make_instance(sc.collection, iss_coll, "ISS", (0, 0, 0), (0, math.radians(90), 0))
    make_earth(sc.collection, (0, 0, -(R_EARTH + ALT)), tuple(sun_dir), sub_lat=19.0, sub_lon=61.0, north_deg=34.0)
    add_sun(sc.collection, sun_dir, strength=4.0)
    cam = add_camera(sc.collection, "CAM_orbit", (-105.0, -70.0, 80.0), (6.0, 4.0, 3.0), lens=30.0)
    sc.camera = cam
    return sc

# ============================================================================= SPRITES
def coll_points(coll, inst_mat):
    """World-space vertices of a collection instance (for fitting sprite cameras)."""
    pts = []
    off = Matrix.Translation(-Vector(coll.instance_offset))
    for o in coll.all_objects:
        if o.type != 'MESH' or len(o.data.vertices) == 0:
            continue
        n = len(o.data.vertices)
        co = np.empty(n * 3, np.float32); o.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        if n > 20000:
            co = co[:: max(1, n // 20000)]
        m = np.array(inst_mat @ off @ o.matrix_world)
        pts.append(co @ m[:3, :3].T + m[:3, 3])
    return np.concatenate(pts)

SPRITES = {
    # name: (collection, instance rotation (deg), view direction from object to camera, key light dir)
    "xks_iss":           ("iss",  (0, 90, 0),   (-0.62, -0.55, 0.62)),
    "xks_emu":           ("emu",  (0, 0, 180),  (-0.55, -1.0, 0.18)),
    "xks_robonaut":      ("r2",   (0, 0, 180),  (-0.45, -1.0, 0.12)),
    "xks_crew_lock_bag": ("clb",  (0, 0, 0),    (-0.65, -1.0, 0.35)),
    "xks_oru":           ("oru",  (0, 0, 0),    (-0.75, -1.0, 0.55)),
    "xks_helmet":        ("hel",  (0, 0, 0),    (-0.6, -1.0, 0.25)),
}
LIBC = {"iss": iss_coll, "emu": emu_coll, "r2": r2_coll, "clb": clb_coll, "oru": oru_coll, "hel": hel_coll,
        "ast": ast_coll}

def build_sprite(name, key, rot_deg, view, px=512, margin=1.06):
    sc = bpy.data.scenes.new("XKS_spr_" + name.replace("xks_", ""))
    w = bpy.data.worlds.get("XKS_sprite_world") or make_world("XKS_sprite_world", 0.0)
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.58, 0.65, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    sc.world = w
    setup_render(sc, (px, px), max(16, SAMPLES), transparent=True)
    coll = LIBC[key]
    inst = make_instance(sc.collection, coll, "OBJ_" + name, (0, 0, 0), tuple(math.radians(a) for a in rot_deg))
    # (objects of other scenes are not updated by the library view layer -> build matrices by hand)
    inst_mw = Matrix.LocRotScale(inst.location, inst.rotation_euler.to_quaternion(), inst.scale)
    pts = coll_points(coll, inst_mw)
    ctr = Vector(((pts.min(0) + pts.max(0)) / 2).tolist())
    rad = float(np.linalg.norm(pts.max(0) - pts.min(0))) / 2
    v = Vector(view).normalized()
    cd = bpy.data.cameras.new("CAM_" + name); cd.type = 'ORTHO'
    cam = bpy.data.objects.new("CAM_" + name, cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = ctr + v * rad * 4
    cam.rotation_euler = (-v).to_track_quat('-Z', 'Y').to_euler()
    cd.clip_start = rad * 0.1; cd.clip_end = rad * 10
    cam_mw = Matrix.LocRotScale(cam.location, cam.rotation_euler.to_quaternion(), None)
    # fit: camera-space extents of all vertices
    mi = np.array(cam_mw.inverted())
    cp = pts @ mi[:3, :3].T + mi[:3, 3]
    x0, x1 = cp[:, 0].min(), cp[:, 0].max(); y0, y1 = cp[:, 1].min(), cp[:, 1].max()
    wdt, hgt = (x1 - x0) * margin, (y1 - y0) * margin
    cd.ortho_scale = max(wdt, hgt)
    if wdt >= hgt:
        sc.render.resolution_x, sc.render.resolution_y = px, max(16, int(round(px * hgt / wdt)))
    else:
        sc.render.resolution_x, sc.render.resolution_y = max(16, int(round(px * wdt / hgt))), px
    cd.shift_x = ((x0 + x1) / 2) / cd.ortho_scale
    cd.shift_y = ((y0 + y1) / 2) / cd.ortho_scale
    # lights: warm key from upper camera-left, cool rim from behind
    right = cam_mw.to_3x3() @ Vector((1, 0, 0))
    up = cam_mw.to_3x3() @ Vector((0, 1, 0))
    add_sun(sc.collection, v * 1.0 - right * 0.8 + up * 0.9, strength=3.2, angle=3.0, name="Key_" + name)
    add_sun(sc.collection, -v * 1.0 + right * 0.6 + up * 0.5, strength=1.6, angle=6.0, name="Rim_" + name)
    return sc

# ============================================================================= SCENE 2: SPACEWALK
def legacy_wing_mesh(name, length=32.0, width=4.6, gap=1.4):
    """One legacy solar array wing (2 blankets + mast) in ISS-model units so the
    XKS_ISS_legacy_array material (object coords) looks identical to the station's."""
    S = ISS_S
    bm = bmesh.new()
    def quad(y0, y1, z0, z1, x=0.0):
        vs = [bm.verts.new((x, y0, z0)), bm.verts.new((x, y1, z0)), bm.verts.new((x, y1, z1)), bm.verts.new((x, y0, z1))]
        bm.faces.new(vs)
    hw = width / S; g = gap / 2 / S; L = length / S
    quad(g, g + hw, 0.6 / S, L)
    quad(-g - hw, -g, 0.6 / S, L)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(M["array"])
    ob = bpy.data.objects.new(name, me); ob.scale = (S, S, S)
    # mast (thin lattice look: grey cylinder) + blanket box at the root
    return ob

def build_truss(coll, length=26.0, wx=4.2, hz=3.0, bay=2.6, gap=(-3.2, 3.2)):
    """Detailed square truss segment (along world Y) for the close-up: longerons, struts,
    diagonals, equipment boxes and gold EVA handrails. Top deck at z=0."""
    tm = principled("XKS_truss_alu", (0.80, 0.80, 0.78), metal=0.25, rough=0.38)
    rail = principled("XKS_handrail_gold", (0.95, 0.66, 0.22), metal=1.0, rough=0.28)
    box = white_blanket("XKS_equipment_white", base=(0.84, 0.84, 0.82), rough=0.5, scale=4.0, bump=0.03, var=0.03)
    dark = M["dark"]
    bm = bmesh.new()
    mats = {"tm": 0, "rail": 1, "box": 2, "dark": 3}
    def beam(a, b, r, mat="tm", seg=8):
        a = Vector(a); b = Vector(b); d = b - a
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=d.length)
        q = d.normalized().to_track_quat('Z', 'Y')
        M4 = Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=M4, verts=res["verts"])
        for f in {f for v in res["verts"] for f in v.link_faces}:
            f.material_index = mats[mat]; f.smooth = True
    def cube(c, size, mat="box"):
        res = bmesh.ops.create_cube(bm, size=1.0)
        for v in res["verts"]:
            v.co = Vector((c[0] + v.co.x * size[0], c[1] + v.co.y * size[1], c[2] + v.co.z * size[2]))
        for f in {f for v in res["verts"] for f in v.link_faces}:
            f.material_index = mats[mat]
    y0, y1 = -length / 2, length / 2
    corners = [(-wx / 2, 0.0), (wx / 2, 0.0), (wx / 2, -hz), (-wx / 2, -hz)]
    for (x, z) in corners:
        cube((x, 0, z), (0.13, length, 0.13), "tm")                       # longerons
    n = int(length / bay)
    for i in range(n + 1):
        y = y0 + i * bay
        for k in range(4):
            (xa, za), (xb, zb) = corners[k], corners[(k + 1) % 4]
            beam((xa, y, za), (xb, y, zb), 0.045)                          # frames
        if i < n:
            yn = y + bay
            beam((-wx / 2, y, -hz), (wx / 2, yn, -hz), 0.045)               # diagonals
            beam((wx / 2, y, 0.0), (wx / 2, yn, -hz), 0.045)
            beam((-wx / 2, yn, 0.0), (-wx / 2, y, -hz), 0.045)
    # top deck equipment (white boxes / ORUs) leaving a free worksite near y in [-2.5, 2.5]
    rng = np.random.default_rng(7)
    y = y0 + 0.4
    while y < y1 - 1.0:
        L = float(rng.uniform(1.2, 2.6))
        if not (gap[0] - L / 2 < y + L / 2 < gap[1] + L / 2):
            w_ = float(rng.uniform(1.4, 2.6)); h = float(rng.uniform(0.35, 0.9))
            x = float(rng.uniform(-wx / 2 + w_ / 2 + 0.2, wx / 2 - w_ / 2 - 0.2))
            cube((x, y + L / 2, h / 2 + 0.08), (w_, L * 0.92, h), "box")
            if rng.random() < 0.5:
                cube((x, y + L / 2, h + 0.1), (w_ * 0.6, L * 0.5, 0.05), "dark")
        y += L + 0.15
    # side panels / boxes on both faces (the real truss is packed with equipment)
    for i in range(0, n):
        yc = y0 + (i + 0.5) * bay
        if i % 3 != 1:
            cube((-wx / 2 - 0.05, yc, -hz / 2), (0.06, bay * 0.95, hz * 0.9), "box")
        if i % 2 == 0:
            cube((wx / 2 - 0.55, yc, -hz * 0.55), (1.0, bay * 0.8, hz * 0.6), "box")
        cube((0.0, yc, -hz + 0.35), (wx * 0.8, bay * 0.9, 0.6), "box")
    # gold handrails along both top edges, on standoffs
    for x in (-wx / 2 + 0.15, wx / 2 - 0.15):
        for yy in np.arange(y0 + 1.0, y1 - 1.0, 3.0):
            a, b = float(yy), float(min(yy + 2.4, y1 - 0.5))
            beam((x, a, 0.22), (x, b, 0.22), 0.022, "rail")
            beam((x, a, 0.0), (x, a, 0.22), 0.02, "rail")
            beam((x, b, 0.0), (x, b, 0.22), 0.02, "rail")
    me = bpy.data.meshes.new("XKS_truss_segment"); bm.to_mesh(me); bm.free()
    for m in (tm, rail, box, dark):
        me.materials.append(m)
    ob = bpy.data.objects.new("Truss_segment", me)
    coll.objects.link(ob)
    return ob

def build_eva():
    """Spacewalk close-up. Truss runs along world +Y (deck top at z=0); the camera stands
    beside the truss looking along it, so the deck recedes on the left, Earth (400 km below)
    fills the lower right and a legacy wing + iROSA hangs in black space upper right."""
    sc = bpy.data.scenes.new("XKS_2_spacewalk")
    sc.world = make_world("XKS_space_black_eva")
    setup_render(sc, RES, SAMPLES)
    sun_dir = Vector((-0.30, -0.62, 0.72)).normalized()
    make_earth(sc.collection, (0, 0, -(R_EARTH + ALT)), tuple(sun_dir), sub_lat=-6.0, sub_lon=70.0,
               north_deg=60.0, suffix="_eva")
    add_sun(sc.collection, sun_dir, strength=4.0, name="Sun_eva")
    truss = build_truss(sc.collection, length=34.0, gap=(-10.0, -1.2))
    truss.location = (0, 6.0, 0)
    # astronaut (EMU faces +Y in the library) at the +X edge of the deck, turned towards camera
    emu = make_instance(sc.collection, emu_coll, "EMU_astronaut", (1.25, 2.6, 1.02),
                        (math.radians(4), math.radians(-6), math.radians(-128)))
    # ORU (Li-ion battery size) on the worksite next to the astronaut's hands
    oru = make_instance(sc.collection, oru_coll, "ORU_battery", (0.40, 2.35, 0.58), (0, 0, math.radians(-35)))
    clb = make_instance(sc.collection, clb_coll, "CrewLockBag", (1.80, 3.45, 0.30),
                        (math.radians(-8), 0, math.radians(-75)))
    # background: legacy wing (+ its iROSA) at the truss end, extending outboard along +X
    rot = Euler((math.radians(90), 0, math.radians(90)), 'XYZ').to_matrix()
    tilt = Matrix.Rotation(math.radians(-28), 3, 'X')
    wing = legacy_wing_mesh("Legacy_wing_eva")
    wing.matrix_world = Matrix.Translation((3.5, 27.0, -3.0)) @ (tilt @ rot).to_4x4() @ Matrix.Scale(ISS_S, 4)
    sc.collection.objects.link(wing)
    mast = principled("XKS_mast_grey", (0.55, 0.55, 0.55), metal=0.5, rough=0.4)
    bm = bmesh.new()
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.35, radius2=0.35, depth=33.0)
    me = bpy.data.meshes.new("XKS_wing_mast"); bm.to_mesh(me); bm.free(); me.materials.append(mast)
    mo = bpy.data.objects.new("Wing_mast_eva", me)
    mo.matrix_world = Matrix.Translation((3.5, 27.0, -3.0)) @ (tilt @ rot).to_4x4() @ Matrix.Translation((0, 0, 16.5))
    sc.collection.objects.link(mo)
    u2w = Matrix(((0, 1, 0), (0, 0, -1), (-1, 0, 0)))          # iROSA unit: long Y->X, normal Z->-Y
    ir = make_instance(sc.collection, sw_coll, "iROSA_eva", (0, 0, 0))
    ir.matrix_world = Matrix.Translation((3.5, 27.0, -3.0)) @ (tilt @ Matrix.Rotation(math.radians(-10), 3, 'Z') @ u2w).to_4x4() \
        @ Matrix.Translation((0, 10.0, 0.0)) @ Matrix.Translation((0, 0, 1.2))
    cam = add_camera(sc.collection, "CAM_eva", (4.3, -0.9, 2.15), (0.6, 6.0, 0.55), lens=24.0)
    cam.rotation_euler.rotate_axis('Z', math.radians(-8))
    sc.camera = cam
    return sc

# ============================================================================= REFERENCE MATCH
def build_ref():
    """Same view as NASA photo iss072e316172 (docs/ref/xks/iss_overview.jpg): looking straight
    down on the station from the zenith, Node 2 at the top, Russian segment at the bottom."""
    sc = bpy.data.scenes.new("XKS_3_ref_iss072e316172")
    sc.world = make_world("XKS_space_black_ref")
    setup_render(sc, (960, 640), SAMPLES)
    sc.render.resolution_x, sc.render.resolution_y = 960, 640
    sun_dir = Vector((0.35, -0.25, 0.90)).normalized()
    make_instance(sc.collection, iss_coll, "ISS_ref", (0, 0, 0), (0, math.radians(90), 0))
    make_earth(sc.collection, (0, 0, -(R_EARTH + ALT)), tuple(sun_dir), sub_lat=-47.0, sub_lon=-58.0,
               north_deg=90.0, suffix="_ref")
    add_sun(sc.collection, sun_dir, strength=4.0, name="Sun_ref")
    cam = add_camera(sc.collection, "CAM_ref", (0.0, 0.0, 330.0), (0.0, 0.0, 0.0), lens=50.0)
    cam.rotation_euler = (0, 0, math.radians(-90))     # velocity (+X) points up in the image
    sc.camera = cam
    return sc

# ============================================================================= main
scenes = {}
scenes["ref"] = build_ref()
scenes["orbit"] = build_orbit()
scenes["eva"] = build_eva()
for nm, (key, rot, view) in SPRITES.items():
    scenes[nm] = build_sprite(nm, key, rot, view)
# brand-rule check renders of the cleaned 'astronaut' (its texture had flags / NASA logo / patch)
CHECKS = {"chk_astronaut_front": ("ast", (0, 0, 0), (0.25, -1.0, 0.15)),
          "chk_astronaut_back": ("ast", (0, 0, 0), (-0.25, 1.0, 0.15)),
          "chk_emu_back": ("emu", (0, 0, 180), (0.3, 1.0, 0.2))}
for nm, (key, rot, view) in CHECKS.items():
    scenes[nm] = build_sprite(nm, key, rot, view)

def render_scene(sc, path, res=None):
    if res:
        sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = path
    log("render", sc.name, path, sc.render.resolution_x, sc.render.resolution_y, sc.cycles.samples)
    with bpy.context.temp_override(scene=sc):
        bpy.ops.render.render(write_still=True, scene=sc.name)
    log("done", path)

def to_jpg(png, jpg, q=82):
    img = bpy.data.images.load(png)
    sc = bpy.data.scenes[0]
    s = sc.render.image_settings
    old = (s.file_format, s.color_mode, s.quality)
    s.file_format = 'JPEG'; s.color_mode = 'RGB'; s.quality = q
    img.save_render(jpg, scene=sc)
    s.file_format, s.color_mode, s.quality = old
    bpy.data.images.remove(img)

os.makedirs(REN_DIR, exist_ok=True)
for key, fname in (("orbit", "xks_bg_orbit"), ("eva", "xks_bg_spacewalk"), ("ref", "xks_ref_compare")):
    if key in RENDER:
        rx, ry = scenes[key].render.resolution_x, scenes[key].render.resolution_y
        p = f"{REN_DIR}/{fname}_{rx}x{ry}.png"
        render_scene(scenes[key], p)
        to_jpg(p, p.replace(".png", ".jpg"))
if "check" in RENDER:
    os.makedirs(REN_DIR + "/check", exist_ok=True)
    for nm in CHECKS:
        render_scene(scenes[nm], f"{REN_DIR}/check/{nm}.png")
if "sprites" in RENDER:
    os.makedirs(REN_DIR + "/sprites", exist_ok=True)
    for nm in SPRITES:
        if ONLY_SPRITES and nm not in ONLY_SPRITES:
            continue
        render_scene(scenes[nm], f"{REN_DIR}/sprites/{nm}.png")

# ----------------------------------------------------------------------------- save
if SAVE:
    for sc in bpy.data.scenes:
        if sc.render.engine == 'CYCLES':
            sc.cycles.device = 'GPU'
            sc.cycles.samples = 256 if not sc.render.film_transparent else 128
            sc.render.threads_mode = 'AUTO'
            if sc.name in ("XKS_1_orbit", "XKS_2_spacewalk"):
                sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
    bpy.context.window_manager.windows  # noqa
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    log("saved", BLEND)
