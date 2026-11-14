# -*- coding: utf-8 -*-
"""
MARS station (ST = "mars") - Oy karvonsaroyi / Team OUTPOST, NASA Space Apps 2026.

Builds mars.blend from scratch out of the NASA 3D models in ../../source and renders
game art.  Re-running rebuilds everything and re-saves scenes/mars/mars.blend.

  Blender -b --factory-startup -P build_mars.py -- [options]

options
  --render LIST   comma list of: day,family,sunset,globe,sprites,compare  (default: none)
  --res N         render width (16:9), default 1280
  --samples N     Cycles samples for test renders, default 48
  --nosave        do not save mars.blend
  --suffix S      extra suffix for render file names
  --threads N     fixed Cycles CPU thread count (default: AUTO = all cores)

Scenes in mars.blend
  mars_gale_day   Curiosity in Gale crater, butterscotch sky, Mount Sharp on the horizon
  mars_family     Curiosity + Perseverance + Viking "family photo" (in reality 3 different sites)
  mars_sunset     blue Mars sunset, rover silhouette
  mars_globe      Mars from orbit (black space, thin atmosphere limb)
  mars_sprites    sprite turntable (transparent PNG), one asset at a time

1 Blender unit = 1 metre.
3D models: NASA 3D Resources / NASA Science (NASA/JPL-Caltech). Not endorsed by NASA.
"""
import bpy, sys, os, math, random, time
import numpy as np
import mathutils
from mathutils import Vector, Matrix, noise as mnoise

ROOT = "/Users/davronoff/dev/oy-karvonsaroyi-3d"
SRC = ROOT + "/source"
SCN = ROOT + "/scenes/mars"
REN = ROOT + "/renders/mars"
TEXOUT = SCN + "/tex_clean"          # logo-free texture copies (for inspection)

# ----------------------------------------------------------------------------- args
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) and not argv[i + 1].startswith("--") else True
    return default
RENDER = [s for s in str(arg("--render", "")).split(",") if s]
RES = int(arg("--res", 1280))
SAMPLES = int(arg("--samples", 48))
NOSAVE = bool(arg("--nosave", False))
SUFFIX = str(arg("--suffix", "")) if arg("--suffix") else ""
os.makedirs(REN, exist_ok=True); os.makedirs(TEXOUT, exist_ok=True)
T0 = time.time()
def log(*a):
    print("[mars %6.1fs]" % (time.time() - T0), *a, flush=True)

# ----------------------------------------------------------------------------- real sizes (see docs/mars_nasa_taqqoslash.md)
REAL = {
    "curiosity_height": 2.2,      # m, NASA: about 7 ft (2.2 m) tall
    "perseverance_wheel": 0.525,  # m, NASA: 52.5 cm (20.7 in)
    "viking_height": 2.0,         # m, overall height to top of S-band antenna (approx, NSSDC)
    "tube_length": 0.142,         # m, model is in inches -> 5.6 in
    "mars_radius": 3389500.0,     # m
}
SCALE = {  # model unit -> metre  (filled after measuring bboxes)
    "curiosity": 1.0, "perseverance": 1.0, "viking": 0.2229, "sample-tube": 0.0254,
    "mars-globe": REAL["mars_radius"],
}
MARS_R = REAL["mars_radius"]

# ----------------------------------------------------------------------------- helpers
def new_mat(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    return m

def principled(m):
    for n in m.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            return n
    return None

def node(nt, typ, loc=(0, 0), **props):
    n = nt.nodes.new(typ)
    n.location = loc
    for k, v in props.items():
        setattr(n, k, v)
    return n

def link(nt, a, b):
    nt.links.new(a, b)

def srgb(r, g, b, a=1.0):
    def c(x):
        x = x / 255.0
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4
    return (c(r), c(g), c(b), a)

def look_at(obj, target, roll=0.0):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    if roll:
        obj.rotation_euler.rotate_axis("Z", roll)

def sun_rot(direction_to_sun):
    d = Vector(direction_to_sun).normalized()
    return d.to_track_quat("Z", "Y").to_euler()

def dir_from_az_el(az_deg, el_deg):
    az, el = math.radians(az_deg), math.radians(el_deg)
    return Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))

def world_bbox(objs):
    lo = Vector((1e30,) * 3); hi = Vector((-1e30,) * 3)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in objs:
        if o.type != "MESH":
            continue
        oe = o.evaluated_get(dg)
        for c in oe.bound_box:
            w = oe.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi

def coll_objects(coll):
    return list(coll.all_objects)

def calc_world(o):
    """world matrix from data only (works for objects in scenes that are not evaluated)"""
    if o.parent is None:
        return o.matrix_basis.copy()
    return calc_world(o.parent) @ o.matrix_parent_inverse @ o.matrix_basis

def data_bbox(objs, root_identity=None):
    lo = Vector((1e30,) * 3); hi = Vector((-1e30,) * 3)
    for o in objs:
        if o.type != "MESH":
            continue
        M = calc_world(o)
        if root_identity is not None:
            M = root_identity.matrix_basis.inverted() @ M
        for c in o.bound_box:
            w = M @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi

# ----------------------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
for s in list(bpy.data.scenes)[1:]:
    bpy.data.scenes.remove(s)
BASE = bpy.data.scenes[0]
BASE.name = "mars_gale_day"

def make_lib_collection(name):
    c = bpy.data.collections.new(name)
    return c

def import_glb(name, coll):
    """import into a fresh library collection (temporarily linked to BASE)"""
    BASE.collection.children.link(coll)
    lc = bpy.context.view_layer.layer_collection.children[coll.name]
    bpy.context.view_layer.active_layer_collection = lc
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=f"{SRC}/models/{name}.glb")
    new = [o for o in bpy.data.objects if o not in before]
    BASE.collection.children.unlink(coll)
    return new

def add_root(name, objs, coll):
    root = bpy.data.objects.new(name + "_root", None)
    root.empty_display_size = 0.5
    coll.objects.link(root)
    for o in objs:
        if o.parent is None:
            mw = o.matrix_world.copy()
            o.parent = root
            o.matrix_parent_inverse = Matrix.Identity(4)
            o.matrix_world = mw
    return root

# ----------------------------------------------------------------------------- image painting (logo removal)
def img_arr(img):
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(h, w, 4)[::-1].copy()   # top-down rows

def img_put(img, arr):
    img.pixels.foreach_set(arr[::-1].ravel())
    img.update()

def ring_median(a, x, y, w, h, pad=4):
    H, W = a.shape[:2]
    x0, y0, x1, y1 = max(0, x - pad), max(0, y - pad), min(W, x + w + pad), min(H, y + h + pad)
    blk = a[y0:y1, x0:x1].reshape(-1, 4)
    inner = np.zeros((y1 - y0, x1 - x0), bool)
    inner[(y - y0):(y - y0 + h), (x - x0):(x - x0 + w)] = True
    ring = blk[~inner.ravel()]
    if len(ring) == 0:
        ring = blk
    return np.median(ring, axis=0)

def paint(img, ops, ref_size=None, noise_amp=0.012):
    """ops: list of (kind, params, color)  kind rect: (x,y,w,h); disc: (cx,cy,r)
       coordinates are top-left based in ref_size pixels; color None -> ring median"""
    a = img_arr(img)
    H, W = a.shape[:2]
    sx = W / (ref_size[0] if ref_size else W); sy = H / (ref_size[1] if ref_size else H)
    rng = np.random.default_rng(7)
    for kind, p, col in ops:
        if kind == "rect":
            x, y, w, h = int(p[0] * sx), int(p[1] * sy), int(p[2] * sx), int(p[3] * sy)
            x1, y1 = min(W, x + w), min(H, y + h); x, y = max(0, x), max(0, y)
            c = np.array(col, np.float32) if col is not None else ring_median(a, x, y, x1 - x, y1 - y)
            a[y:y1, x:x1, :3] = c[:3] + rng.normal(0, noise_amp, (y1 - y, x1 - x, 1)).astype(np.float32)
        elif kind == "disc":
            cx, cy, r = p[0] * sx, p[1] * sy, p[2] * sx
            yy, xx = np.mgrid[0:H, 0:W]
            m = (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r
            c = np.array(col, np.float32)
            a[m, :3] = c[:3]
    img_put(img, a)
    img.pack()
    try:
        img.save(filepath=f"{TEXOUT}/{img.name.replace('.', '_')}.png")
    except Exception as e:
        log("tex save fail", img.name, e)

def px(r, g, b):
    """colour for painting into an 8-bit image buffer (values stay in sRGB)"""
    return (r / 255.0, g / 255.0, b / 255.0, 1.0)

def find_image(prefix):
    for im in bpy.data.images:
        if im.name == prefix:
            return im
    for im in bpy.data.images:
        if im.name.startswith(prefix):
            return im
    return None

# ----------------------------------------------------------------------------- dust tint
def add_dust(mat, amount, dust=srgb(176, 120, 82)):
    nt = mat.node_tree
    b = principled(mat)
    if b is None or amount <= 0:
        return
    inp = b.inputs["Base Color"]
    mix = node(nt, "ShaderNodeMix", (b.location.x - 250, b.location.y + 200))
    mix.data_type = "RGBA"; mix.blend_type = "MIX"; mix.clamp_factor = True
    if inp.is_linked:
        link(nt, inp.links[0].from_socket, mix.inputs[6])
    else:
        mix.inputs[6].default_value = inp.default_value
    mix.inputs[7].default_value = dust
    geo = node(nt, "ShaderNodeNewGeometry", (b.location.x - 900, b.location.y + 300))
    sep = node(nt, "ShaderNodeSeparateXYZ", (b.location.x - 700, b.location.y + 300))
    link(nt, geo.outputs["Normal"], sep.inputs[0])
    up = node(nt, "ShaderNodeMapRange", (b.location.x - 550, b.location.y + 300))
    up.inputs["From Min"].default_value = -0.3; up.inputs["From Max"].default_value = 1.0
    up.inputs["To Min"].default_value = 0.25; up.inputs["To Max"].default_value = 1.0
    link(nt, sep.outputs["Z"], up.inputs["Value"])
    nz = node(nt, "ShaderNodeTexNoise", (b.location.x - 700, b.location.y + 500))
    nz.inputs["Scale"].default_value = 7.0; nz.inputs["Detail"].default_value = 4.0
    link(nt, geo.outputs["Position"], nz.inputs["Vector"])
    m1 = node(nt, "ShaderNodeMath", (b.location.x - 400, b.location.y + 400), operation="MULTIPLY")
    link(nt, up.outputs["Result"], m1.inputs[0]); link(nt, nz.outputs["Fac"], m1.inputs[1])
    m2 = node(nt, "ShaderNodeMath", (b.location.x - 400, b.location.y + 250), operation="MULTIPLY")
    m2.inputs[1].default_value = amount * 1.8
    link(nt, m1.outputs[0], m2.inputs[0])
    link(nt, m2.outputs[0], mix.inputs[0])
    link(nt, mix.outputs[2], inp)
    # dust is not metal: fade metallic where dust lies (otherwise dusty aluminium turns into copper)
    met = b.inputs["Metallic"]
    if met.is_linked or met.default_value > 0.0:
        inv = node(nt, "ShaderNodeMath", (b.location.x - 250, b.location.y - 50), operation="SUBTRACT")
        inv.use_clamp = True; inv.inputs[0].default_value = 1.0
        link(nt, m2.outputs[0], inv.inputs[1])
        mm_ = node(nt, "ShaderNodeMath", (b.location.x - 120, b.location.y - 50), operation="MULTIPLY")
        if met.is_linked:
            link(nt, met.links[0].from_socket, mm_.inputs[0])
        else:
            mm_.inputs[0].default_value = met.default_value
        link(nt, inv.outputs[0], mm_.inputs[1])
        link(nt, mm_.outputs[0], met)
    # dust is matte: push roughness up a bit
    r = b.inputs["Roughness"]
    if not r.is_linked:
        r.default_value = min(1.0, r.default_value + amount * 0.6)

# ============================================================================ ASSETS
LIB = {}

# ---------------- Curiosity
log("import curiosity")
c_cur = make_lib_collection("MARS_curiosity")
objs = import_glb("curiosity", c_cur)
cur_root = add_root("curiosity", objs, c_cur)
# logo-free tex_05 ("CURIOSITY" lettering, MSL/JPL/flag/NASA medallions, MAHLI text, penny)
im = find_image("tex_05")
if im:
    medal = px(150, 140, 122)
    paint(im, [
        ("rect", (22, 74, 88, 346), None),           # CURIOSITY lettering + rover drawing plate
        ("disc", (461, 89, 50), medal),               # Mars Science Laboratory medallion
        ("disc", (461, 186, 50), medal),              # JPL medallion
        ("disc", (461, 290, 50), medal),              # US flag medallion
        ("disc", (461, 393, 50), medal),              # NASA meatball medallion
        ("rect", (284, 133, 96, 100), None),         # MAHLI calibration target text
        ("disc", (321, 256, 30), px(176, 120, 84)),   # Lincoln penny -> plain copper disc
    ], ref_size=(512, 512))
    log("painted", im.name)
for o in objs:
    if o.type == "MESH":
        for s in o.material_slots:
            if s.material:
                add_dust(s.material, 0.22)
cur_root.scale = (SCALE["curiosity"],) * 3
LIB["curiosity"] = (c_cur, cur_root)

# ---------------- Perseverance
log("import perseverance")
c_per = make_lib_collection("MARS_perseverance")
objs = import_glb("perseverance", c_per)
# helper sphere (2 m, no material) -> remove
for o in list(objs):
    if o.name.startswith("Icosphere"):
        objs.remove(o); bpy.data.objects.remove(o, do_unlink=True)
# bake the "mast up" pose (active glTF action, frame 120) and drop animations
BASE.collection.children.link(c_per)
BASE.frame_set(120)
mw = {o.name: o.matrix_world.copy() for o in objs}
for o in objs:
    o.animation_data_clear()
def depth(o):
    d = 0
    while o.parent:
        d += 1; o = o.parent
    return d
for o in sorted(objs, key=depth):
    o.matrix_world = mw[o.name]
BASE.frame_set(1)
BASE.collection.children.unlink(c_per)
per_root = add_root("perseverance", objs, c_per)
im = find_image("arm_graphics")
if im:
    paint(im, [
        ("rect", (0, 22, 512, 84), None),        # MARS 2020 + logo + tiny vertical text
        ("rect", (0, 138, 512, 70), None),       # PERSEVERANCE lettering
        ("rect", (98, 276, 210, 66), None),      # NASA meatball + JPL logo on white plate
        ("rect", (26, 352, 180, 66), px(205, 205, 205)),   # letter-like fiducials
        ("rect", (24, 426, 482, 82), px(205, 205, 205)),
    ], ref_size=(512, 512))
    log("painted", im.name)
im = find_image("blade")
if im:
    plate = px(196, 196, 198)
    paint(im, [
        ("rect", (14, 130, 166, 102), plate),    # JPL plate
        ("rect", (886, 204, 138, 188), plate),   # US flag plate
        ("rect", (878, 392, 146, 120), plate),   # NASA meatball plate
    ], ref_size=(1024, 512))
    log("painted", im.name)
im = find_image("mars_2020_03")
if im:
    paint(im, [("rect", (184, 890, 100, 48), None),   # NASA worm grille (mirrored)
               ("rect", (392, 836, 80, 54), None)],   # JPL grille
          ref_size=(1024, 1024))
    log("painted", im.name)
im = find_image("mars_2020_04")
if im:
    paint(im, [("rect", (634, 76, 94, 24), None)], ref_size=(1024, 1024))  # "10,932,295 Explorers"
    log("painted", im.name)
for o in objs:
    if o.type == "MESH":
        for s in o.material_slots:
            if s.material and s.material.name not in ("transparent", "glass_trans", "glass_2", "glass lens"):
                add_dust(s.material, 0.07)
LIB["perseverance"] = (c_per, per_root)

# ---------------- Viking lander
log("import viking")
c_vik = make_lib_collection("MARS_viking")
objs = import_glb("viking", c_vik)
vik_root = add_root("viking", objs, c_vik)
for m in {s.material for o in objs if o.type == "MESH" for s in o.material_slots if s.material}:
    b = principled(m)
    if b:
        b.inputs["Roughness"].default_value = 0.55
    add_dust(m, 0.14)
LIB["viking"] = (c_vik, vik_root)

# ---------------- Sample tube (one metal material)
log("import sample tube")
c_tub = make_lib_collection("MARS_sample_tube")
objs = import_glb("sample-tube", c_tub)
tub_root = add_root("sample_tube", objs, c_tub)
mt = new_mat("sample_tube_metal")
b = principled(mt)
# real tube: titanium, white alumina exterior coating, gold TiN coating, bare titanium near the open end;
# here a single light satin-metal material (the GLB came from an STL print file without materials)
b.inputs["Base Color"].default_value = srgb(226, 224, 218)
b.inputs["Metallic"].default_value = 0.85
b.inputs["Roughness"].default_value = 0.32
for o in objs:
    if o.type == "MESH":
        o.data.materials.clear(); o.data.materials.append(mt)
        for p in o.data.polygons:
            p.use_smooth = True
LIB["sample-tube"] = (c_tub, tub_root)

# ---------------- Mars globe
log("import mars globe")
c_glb = make_lib_collection("MARS_globe")
objs = import_glb("mars-globe", c_glb)
glb_root = add_root("mars_globe", objs, c_glb)
hi = bpy.data.images.load(SRC + "/tex/mars-globe.jpg"); hi.pack()
for o in objs:
    if o.type == "MESH":
        for p in o.data.polygons:
            p.use_smooth = True
        for s in o.material_slots:
            if s.material:
                for n in s.material.node_tree.nodes:
                    if n.type == "TEX_IMAGE":
                        n.image = hi; n.interpolation = "Cubic"
                bb = principled(s.material)
                if bb:
                    bb.inputs["Roughness"].default_value = 1.0
                    bb.inputs["Metallic"].default_value = 0.0
                    try:
                        bb.inputs["Specular IOR Level"].default_value = 0.1
                    except Exception:
                        pass
LIB["mars-globe"] = (c_glb, glb_root)

# --------------------------------------------------------------------------- scale + place on ground
MEAS = {}
for key, (c, r) in LIB.items():
    r.scale = (1, 1, 1); r.location = (0, 0, 0); r.rotation_euler = (0, 0, 0)
    lo, hi_ = data_bbox(coll_objects(c))
    MEAS[key] = {"model_size": tuple(round(v, 4) for v in (hi_ - lo))}

# ============================================================================ TERRAIN
log("terrain")
c_ter = bpy.data.collections.new("MARS_terrain")
c_far = bpy.data.collections.new("MARS_far")
c_protos = bpy.data.collections.new("MARS_rock_protos")   # instanced only, never linked to a scene

HAZE_GROUP = None
def haze_group():
    """node group: Shader in -> Shader out, mixes toward world-level haze colour by view distance.
    haze colour/distance are read from scene custom props haze_color / haze_dist (Attribute: View Layer)."""
    global HAZE_GROUP
    if HAZE_GROUP:
        return HAZE_GROUP
    g = bpy.data.node_groups.new("MarsHaze", "ShaderNodeTree")
    g.interface.new_socket("Shader", in_out="INPUT", socket_type="NodeSocketShader")
    g.interface.new_socket("Shader", in_out="OUTPUT", socket_type="NodeSocketShader")
    gi = node(g, "NodeGroupInput", (-800, 0)); go = node(g, "NodeGroupOutput", (400, 0))
    cam = node(g, "ShaderNodeCameraData", (-800, -200))
    ac = node(g, "ShaderNodeAttribute", (-800, -400)); ac.attribute_type = "VIEW_LAYER"; ac.attribute_name = "haze_color"
    ad = node(g, "ShaderNodeAttribute", (-800, -600)); ad.attribute_type = "VIEW_LAYER"; ad.attribute_name = "haze_dist"
    mx = node(g, "ShaderNodeMath", (-600, -600), operation="MAXIMUM"); mx.inputs[1].default_value = 10.0
    link(g, ad.outputs["Fac"], mx.inputs[0])
    dv = node(g, "ShaderNodeMath", (-450, -300), operation="DIVIDE")
    link(g, cam.outputs["View Distance"], dv.inputs[0]); link(g, mx.outputs[0], dv.inputs[1])
    ng = node(g, "ShaderNodeMath", (-300, -300), operation="MULTIPLY"); ng.inputs[1].default_value = -1.0
    link(g, dv.outputs[0], ng.inputs[0])
    ex = node(g, "ShaderNodeMath", (-150, -300), operation="EXPONENT"); link(g, ng.outputs[0], ex.inputs[0])
    fac = node(g, "ShaderNodeMath", (0, -300), operation="SUBTRACT"); fac.inputs[0].default_value = 1.0
    link(g, ex.outputs[0], fac.inputs[1])
    em = node(g, "ShaderNodeEmission", (0, -500)); link(g, ac.outputs["Color"], em.inputs["Color"])
    ms = node(g, "ShaderNodeMixShader", (200, 0))
    link(g, fac.outputs[0], ms.inputs[0]); link(g, gi.outputs[0], ms.inputs[1]); link(g, em.outputs[0], ms.inputs[2])
    link(g, ms.outputs[0], go.inputs[0])
    HAZE_GROUP = g
    return g

ground_img = bpy.data.images.load(SRC + "/tex/mars-ground.jpg"); ground_img.pack()
ground_img.colorspace_settings.name = "Non-Color"

def mars_surface_mat(name, c_a, c_b, c_dust, macro_scale=None, bump=0.35, layers=False, rough=0.95):
    m = new_mat(name)
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = node(nt, "ShaderNodeOutputMaterial", (900, 0))
    bs = node(nt, "ShaderNodeBsdfPrincipled", (300, 0))
    bs.inputs["Roughness"].default_value = rough
    try:
        bs.inputs["Specular IOR Level"].default_value = 0.12
    except Exception:
        pass
    geo = node(nt, "ShaderNodeNewGeometry", (-1400, 0))
    n1 = node(nt, "ShaderNodeTexNoise", (-1100, 200)); n1.inputs["Scale"].default_value = 0.35
    n1.inputs["Detail"].default_value = 6; n1.inputs["Roughness"].default_value = 0.6
    link(nt, geo.outputs["Position"], n1.inputs["Vector"])
    n2 = node(nt, "ShaderNodeTexNoise", (-1100, -100)); n2.inputs["Scale"].default_value = 6.0
    n2.inputs["Detail"].default_value = 8; n2.inputs["Roughness"].default_value = 0.65
    link(nt, geo.outputs["Position"], n2.inputs["Vector"])
    r1 = node(nt, "ShaderNodeValToRGB", (-850, 200))
    r1.color_ramp.elements[0].position = 0.35; r1.color_ramp.elements[0].color = c_a
    r1.color_ramp.elements[1].position = 0.65; r1.color_ramp.elements[1].color = c_b
    link(nt, n1.outputs["Fac"], r1.inputs["Fac"])
    col = r1.outputs["Color"]
    if layers:   # Mount Sharp sedimentary layering
        sep = node(nt, "ShaderNodeSeparateXYZ", (-1200, -400)); link(nt, geo.outputs["Position"], sep.inputs[0])
        nz = node(nt, "ShaderNodeTexNoise", (-1100, -600)); nz.inputs["Scale"].default_value = 0.0004
        link(nt, geo.outputs["Position"], nz.inputs["Vector"])
        ad_ = node(nt, "ShaderNodeMath", (-950, -450), operation="MULTIPLY_ADD")
        link(nt, nz.outputs["Fac"], ad_.inputs[0]); ad_.inputs[1].default_value = 400.0
        link(nt, sep.outputs["Z"], ad_.inputs[2])
        sn = node(nt, "ShaderNodeMath", (-800, -450), operation="SINE")
        sc_ = node(nt, "ShaderNodeMath", (-900, -300), operation="MULTIPLY"); sc_.inputs[1].default_value = 1 / 90.0
        link(nt, ad_.outputs[0], sc_.inputs[0]); link(nt, sc_.outputs[0], sn.inputs[0])
        lr = node(nt, "ShaderNodeMapRange", (-650, -450)); lr.inputs["From Min"].default_value = -1
        lr.inputs["To Min"].default_value = 0.0; lr.inputs["To Max"].default_value = 0.35
        link(nt, sn.outputs[0], lr.inputs["Value"])
        mL = node(nt, "ShaderNodeMix", (-500, 100)); mL.data_type = "RGBA"
        link(nt, lr.outputs["Result"], mL.inputs[0]); link(nt, col, mL.inputs[6])
        mL.inputs[7].default_value = srgb(205, 160, 120)
        col = mL.outputs[2]
    if macro_scale:   # HiRISE greyscale tile as macro albedo variation (dark Bagnold-like sand bands)
        mp = node(nt, "ShaderNodeMapping", (-1100, 500)); mp.inputs["Scale"].default_value = (1 / macro_scale,) * 3
        mp.inputs["Location"].default_value = (0.37, 0.21, 0)
        link(nt, geo.outputs["Position"], mp.inputs["Vector"])
        ti = node(nt, "ShaderNodeTexImage", (-900, 500)); ti.image = ground_img; ti.extension = "MIRROR"
        link(nt, mp.outputs["Vector"], ti.inputs["Vector"])
        mr = node(nt, "ShaderNodeMapRange", (-650, 500)); mr.inputs["From Min"].default_value = 0.15
        mr.inputs["From Max"].default_value = 0.75; mr.inputs["To Min"].default_value = 0.55
        mr.inputs["To Max"].default_value = 1.2
        link(nt, ti.outputs["Color"], mr.inputs["Value"])
        mm = node(nt, "ShaderNodeMix", (-450, 300)); mm.data_type = "RGBA"; mm.blend_type = "MULTIPLY"
        ln = node(nt, "ShaderNodeVectorMath", (-900, 700), operation="LENGTH")
        link(nt, geo.outputs["Position"], ln.inputs[0])
        lf = node(nt, "ShaderNodeMapRange", (-700, 700)); lf.inputs["From Min"].default_value = 90.0
        lf.inputs["From Max"].default_value = 900.0
        link(nt, ln.outputs["Value"], lf.inputs["Value"]); link(nt, lf.outputs["Result"], mm.inputs[0])
        link(nt, col, mm.inputs[6]); link(nt, mr.outputs["Result"], mm.inputs[7])
        col = mm.outputs[2]
    # dust on up-facing surfaces
    sp = node(nt, "ShaderNodeSeparateXYZ", (-800, -150)); link(nt, geo.outputs["Normal"], sp.inputs[0])
    du = node(nt, "ShaderNodeMapRange", (-650, -150)); du.inputs["From Min"].default_value = 0.6
    du.inputs["From Max"].default_value = 0.95; du.inputs["To Max"].default_value = 0.55
    link(nt, sp.outputs["Z"], du.inputs["Value"])
    md = node(nt, "ShaderNodeMix", (-250, 0)); md.data_type = "RGBA"
    link(nt, du.outputs["Result"], md.inputs[0]); link(nt, col, md.inputs[6]); md.inputs[7].default_value = c_dust
    # fine grain variation
    mg = node(nt, "ShaderNodeMix", (-50, 0)); mg.data_type = "RGBA"; mg.blend_type = "MULTIPLY"
    gr = node(nt, "ShaderNodeMapRange", (-250, -250)); gr.inputs["To Min"].default_value = 0.8
    gr.inputs["To Max"].default_value = 1.15; link(nt, n2.outputs["Fac"], gr.inputs["Value"])
    mg.inputs[0].default_value = 1.0
    link(nt, md.outputs[2], mg.inputs[6])
    cg = node(nt, "ShaderNodeCombineColor", (-100, -250))
    for i in range(3):
        link(nt, gr.outputs["Result"], cg.inputs[i])
    link(nt, cg.outputs[0], mg.inputs[7])
    link(nt, mg.outputs[2], bs.inputs["Base Color"])
    bp = node(nt, "ShaderNodeBump", (100, -300)); bp.inputs["Strength"].default_value = bump
    link(nt, n2.outputs["Fac"], bp.inputs["Height"]); link(nt, bp.outputs["Normal"], bs.inputs["Normal"])
    hz = nt.nodes.new("ShaderNodeGroup"); hz.node_tree = haze_group(); hz.location = (600, 0)
    link(nt, bs.outputs[0], hz.inputs[0]); link(nt, hz.outputs[0], out.inputs["Surface"])
    return m

SOIL_A = srgb(108, 86, 76); SOIL_B = srgb(134, 108, 92); DUST = srgb(158, 124, 104)
mat_ground = mars_surface_mat("mars_ground", SOIL_A, SOIL_B, DUST, macro_scale=None, bump=0.25)
mat_far = mars_surface_mat("mars_ground_far", SOIL_A, SOIL_B, DUST, macro_scale=6000.0, bump=0.1)
mat_rock = mars_surface_mat("mars_rock", srgb(72, 64, 60), srgb(104, 88, 78), srgb(160, 120, 96), bump=0.6, rough=0.8)
mat_slab = mars_surface_mat("mars_bedrock_slab", srgb(168, 128, 104), srgb(194, 150, 122), srgb(204, 160, 130), bump=0.5, rough=0.85)
mat_mtn = mars_surface_mat("mount_sharp", srgb(140, 100, 76), srgb(166, 120, 90), srgb(186, 140, 106),
                           layers=True, bump=0.05)

def curv(x, y):
    return (x * x + y * y) / (2 * MARS_R)

def grid(name, size_x, size_y, nx, ny, coll, center=(0, 0)):
    me = bpy.data.meshes.new(name)
    xs = np.linspace(-size_x / 2, size_x / 2, nx + 1) + center[0]
    ys = np.linspace(-size_y / 2, size_y / 2, ny + 1) + center[1]
    X, Y = np.meshgrid(xs, ys)
    verts = np.stack([X.ravel(), Y.ravel(), np.zeros(X.size)], 1)
    idx = np.arange((nx + 1) * (ny + 1)).reshape(ny + 1, nx + 1)
    faces = np.stack([idx[:-1, :-1].ravel(), idx[:-1, 1:].ravel(), idx[1:, 1:].ravel(), idx[1:, :-1].ravel()], 1)
    me.vertices.add(len(verts)); me.vertices.foreach_set("co", verts.astype(np.float32).ravel())
    me.loops.add(faces.size); me.loops.foreach_set("vertex_index", faces.astype(np.int32).ravel())
    me.polygons.add(len(faces))
    me.polygons.foreach_set("loop_start", (np.arange(len(faces)) * 4).astype(np.int32))
    me.polygons.foreach_set("loop_total", np.full(len(faces), 4, np.int32))
    me.update(); me.validate()
    ob = bpy.data.objects.new(name, me); coll.objects.link(ob)
    return ob

def set_heights(ob, fn):
    me = ob.data
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    for i in range(len(co)):
        co[i, 2] = fn(co[i, 0], co[i, 1])
    me.vertices.foreach_set("co", co.ravel()); me.update()
    for p in me.polygons:
        p.use_smooth = True

def fbm(x, y, s, octaves=5, seed=0.0):
    return mnoise.fractal(Vector((x / s + seed, y / s - seed, 0.37 * seed)), 0.6, 2.0, octaves, noise_basis="PERLIN_NEW")

KEEP_FLAT = [((0.0, 0.0), 3.2), ((3.9, -1.0), 2.4), ((-4.4, 1.6), 2.6)]   # rover / lander pads
def near_h(x, y):
    h = 0.35 * fbm(x, y, 22.0, 4, 1.3) + 0.06 * fbm(x, y, 3.5, 4, 7.1) + 0.015 * fbm(x, y, 0.7, 3, 3.3)
    w = 1.0
    for (cx, cy), r in KEEP_FLAT:
        d = math.hypot(x - cx, y - cy)
        w = min(w, max(0.0, min(1.0, (d - r * 0.55) / (r * 0.6))))
    return h * (0.15 + 0.85 * w) - curv(x, y)

NEAR = 120.0
g_near = grid("ground_near", NEAR, NEAR, 360, 360, c_ter)
set_heights(g_near, near_h)
g_near.data.materials.append(mat_ground)

g_far = grid("ground_far", 30000, 30000, 240, 240, c_far)
def far_h(x, y):
    d = max(abs(x), abs(y))
    h = 1.5 * fbm(x, y, 400.0, 5, 2.2) + 8.0 * fbm(x, y, 2500.0, 4, 5.5)
    if d < NEAR * 0.5:
        h = min(h, near_h(x, y)) - 0.12
    else:
        h = h * min(1.0, (d - NEAR * 0.5) / 200.0) - 0.12
    return h - curv(x, y)
set_heights(g_far, far_h)
g_far.data.materials.append(mat_far)

# Mount Sharp (Aeolis Mons): broad layered mound, centre ~34 km away, summit ~4.6 km over this plain
# (real: ~5.5 km above the crater floor; Curiosity has already climbed part of it), hazy foothills/buttes in front.
SOUTH = Vector((0.608, 0.794, 0)).normalized()        # direction to Mount Sharp in this scene
PERP = Vector((SOUTH.y, -SOUTH.x, 0))
MTN_C = SOUTH * 34000.0
MTN_A = (-27000.0, 40000.0)      # extent along SOUTH (near, far)
MTN_B = 48000.0                  # half extent sideways
def mtn_h(x, y):
    p = Vector((x, y, 0)) - MTN_C
    a_ = p.dot(SOUTH); b_ = p.dot(PERP)
    r = math.sqrt((a_ / 15500.0) ** 2 + (b_ / 30000.0) ** 2)
    base = 4600.0 * math.exp(-1.35 * r * r) * (1 + 0.16 * fbm(x, y, 9000.0, 4, 9.1))
    terr = base
    if base > 40:
        step = 230.0
        k = base / step; f = k - math.floor(k)
        terr = (math.floor(k) + min(1.0, f * 1.7) ** 1.5) * step
        terr = 0.5 * terr + 0.5 * base
    ridges = 380.0 * (mnoise.ridged_multi_fractal(Vector((x / 4200.0, y / 4200.0, 1.7)), 0.9, 2.0, 5, 1.0, 2.0) - 0.6)
    h = terr + ridges * min(1.0, base / 1500.0)
    # foothill buttes in front (towards the rover)
    h += 320.0 * max(0.0, fbm(x, y, 1500.0, 4, 4.4) - 0.08) * max(0.0, 1 - abs(r - 1.05) / 0.3)
    # fade to the plain at the mesh border (no visible cliff)
    ea = min((a_ - MTN_A[0]) / 6000.0, (MTN_A[1] - a_) / 6000.0, (MTN_B - abs(b_)) / 6000.0)
    h *= max(0.0, min(1.0, ea))
    return h - curv(x, y)
mtn = grid("mount_sharp", 2 * MTN_B, MTN_A[1] - MTN_A[0], 320, 220, c_far)
me = mtn.data
co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
bl = co[:, 0].copy(); al = co[:, 1].copy() + (MTN_A[0] + MTN_A[1]) / 2
co[:, 0] = MTN_C.x + bl * PERP.x + al * SOUTH.x
co[:, 1] = MTN_C.y + bl * PERP.y + al * SOUTH.y
me.vertices.foreach_set("co", co.ravel()); me.update()
set_heights(mtn, mtn_h)
mtn.data.materials.append(mat_mtn)
mtn.location.z = -6.0

# Gale crater rim (77 km radius around Mount Sharp), low hazy ridge on the far horizon
def make_rim():
    R0, R1 = 70000.0, 84000.0
    na, nr = 720, 10
    me = bpy.data.meshes.new("gale_rim")
    verts = []
    for i in range(na):
        a = 2 * math.pi * i / na
        for j in range(nr):
            rr = R0 + (R1 - R0) * j / (nr - 1)
            x = MTN_C.x + rr * math.cos(a); y = MTN_C.y + rr * math.sin(a)
            prof = math.sin(math.pi * j / (nr - 1)) ** 0.8
            h = (1700.0 + 700.0 * fbm(x, y, 12000.0, 4, 2.9)) * prof
            verts.append((x, y, h - curv(x, y) - 60.0))
    faces = []
    for i in range(na):
        i2 = (i + 1) % na
        for j in range(nr - 1):
            faces.append((i * nr + j, i2 * nr + j, i2 * nr + j + 1, i * nr + j + 1))
    me.from_pydata(verts, [], faces); me.update()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new("gale_rim", me); c_far.objects.link(ob)
    ob.data.materials.append(mat_mtn)
    return ob
make_rim()

# rock prototypes: 6 blocky rocks + 4 flat bedrock slabs (Gale mudstone / sandstone plates)
rng = random.Random(42)
for i in range(10):
    slab = i >= 6
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0)
    ob = bpy.context.active_object
    ob.name = f"rock_proto_{i}"
    me = ob.data
    if slab:
        sx, sy, sz = rng.uniform(1.6, 2.6), rng.uniform(1.1, 1.8), rng.uniform(0.12, 0.2)
    else:
        sx, sy, sz = rng.uniform(0.8, 1.3), rng.uniform(0.7, 1.1), rng.uniform(0.4, 0.8)
    seed = rng.uniform(0, 100)
    for v in me.vertices:
        p = v.co.copy()
        n = mnoise.fractal(p * 1.3 + Vector((seed, 0, 0)), 0.7, 2.0, 4, noise_basis="PERLIN_NEW")
        cell = mnoise.voronoi(p * 1.7 + Vector((0, seed, 0)), distance_metric="DISTANCE")[0][0]
        p *= (1 + 0.22 * n - 0.18 * cell)
        p.z = max(p.z, -0.35)
        if i % 2 == 0 or slab:
            p.z = min(p.z, 0.5 + 0.08 * n)
        v.co = Vector((p.x * sx, p.y * sy, p.z * sz + 0.12 * sz))
    for p in me.polygons:
        p.use_smooth = True      # flat shading made big slabs look like crumpled paper
    me.materials.append(mat_slab if slab else mat_rock)
    for c in ob.users_collection:
        c.objects.unlink(ob)
    c_protos.objects.link(ob)

# density vertex group (none under the vehicles), stronger in the camera area
vg = g_near.vertex_groups.new(name="rocks")
vg2 = g_near.vertex_groups.new(name="pebbles")
for v in g_near.data.vertices:
    x, y = v.co.x, v.co.y
    w = 1.0
    for (cx, cy), r in KEEP_FLAT:
        d = math.hypot(x - cx, y - cy)
        w = min(w, max(0.0, min(1.0, (d - r) / 1.5)))
    d0 = math.hypot(x, y)
    fall = max(0.0, 1.0 - d0 / 58.0)
    patch = 0.5 + 0.5 * fbm(x, y, 6.0, 3, 8.8)
    vg.add([v.index], w * fall * min(1.0, max(0.0, patch * 1.4 - 0.15)), "REPLACE")
    vg2.add([v.index], (0.25 + 0.75 * w) * fall, "REPLACE")

def gn_scatter(ob):
    """Geometry Nodes: rocks / pebbles / boulders instanced on the near ground (density = vertex groups)."""
    g = bpy.data.node_groups.new("MarsScatter", "GeometryNodeTree")
    g.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    g.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    gi = node(g, "NodeGroupInput", (-1200, 0)); go = node(g, "NodeGroupOutput", (900, 0))
    ci = node(g, "GeometryNodeCollectionInfo", (-600, -600))
    ci.inputs["Collection"].default_value = c_protos
    ci.inputs["Separate Children"].default_value = True; ci.inputs["Reset Children"].default_value = True
    join = node(g, "GeometryNodeJoinGeometry", (700, 0))
    link(g, gi.outputs[0], join.inputs[0])
    y = 0
    # (vertex group, density per m2, min size, max size, seed, proto index range): protos 0-5 rocks, 6-9 slabs
    for (vgname, dens, smin, smax, seed, i0, i1) in (("pebbles", 14.0, 0.01, 0.045, 3, 0, 5),
                                                      ("rocks", 0.9, 0.05, 0.24, 11, 0, 5),
                                                      ("rocks", 0.012, 0.3, 0.75, 5, 0, 5),
                                                      ("rocks", 0.08, 0.2, 0.5, 17, 6, 9)):
        y -= 300
        na = node(g, "GeometryNodeInputNamedAttribute", (-1000, y)); na.data_type = "FLOAT"
        na.inputs["Name"].default_value = vgname
        mul = node(g, "ShaderNodeMath", (-850, y), operation="MULTIPLY"); mul.inputs[1].default_value = dens
        link(g, na.outputs["Attribute"], mul.inputs[0])
        dp = node(g, "GeometryNodeDistributePointsOnFaces", (-650, y)); dp.distribute_method = "RANDOM"
        link(g, gi.outputs[0], dp.inputs["Mesh"]); link(g, mul.outputs[0], dp.inputs["Density"])
        dp.inputs["Seed"].default_value = seed
        rs = node(g, "FunctionNodeRandomValue", (-450, y - 100)); rs.data_type = "FLOAT"
        rs.inputs["Min"].default_value = smin; rs.inputs["Max"].default_value = smax
        rs.inputs["Seed"].default_value = seed + 1
        pw = node(g, "ShaderNodeMath", (-300, y - 100), operation="POWER")   # many small, few big
        link(g, rs.outputs["Value"], pw.inputs[0]); pw.inputs[1].default_value = 1.0
        rr = node(g, "FunctionNodeRandomValue", (-450, y - 250)); rr.data_type = "FLOAT_VECTOR"
        tilt = 0.0 if i0 >= 6 else 0.12
        rr.inputs["Min"].default_value = (-tilt, -tilt, 0.0); rr.inputs["Max"].default_value = (tilt, tilt, 6.283)
        rr.inputs["Seed"].default_value = seed + 2
        ri = node(g, "FunctionNodeRandomValue", (-450, y - 400)); ri.data_type = "INT"
        ri.inputs["Min"].default_value = i0; ri.inputs["Max"].default_value = i1
        ri.inputs["Seed"].default_value = seed + 3
        ip = node(g, "GeometryNodeInstanceOnPoints", (100, y))
        link(g, dp.outputs["Points"], ip.inputs["Points"]); link(g, ci.outputs[0], ip.inputs["Instance"])
        ip.inputs["Pick Instance"].default_value = True
        link(g, ri.outputs["Value"], ip.inputs["Instance Index"])
        # random yaw (+ small tilt for rocks), then align Z to the ground normal so slabs lie flat on slopes
        e2r = node(g, "FunctionNodeEulerToRotation", (-300, y - 250))
        link(g, rr.outputs["Value"], e2r.inputs[0])
        al = node(g, "FunctionNodeAlignRotationToVector", (-150, y - 250)); al.axis = "Z"
        link(g, e2r.outputs[0], al.inputs["Rotation"]); link(g, dp.outputs["Normal"], al.inputs["Vector"])
        link(g, al.outputs[0], ip.inputs["Rotation"])
        link(g, pw.outputs[0], ip.inputs["Scale"])
        # sink a bit into the soil
        st = node(g, "GeometryNodeTranslateInstances", (350, y))
        link(g, ip.outputs[0], st.inputs["Instances"])
        cz = node(g, "ShaderNodeCombineXYZ", (200, y - 200))
        mz = node(g, "ShaderNodeMath", (50, y - 200), operation="MULTIPLY")
        mz.inputs[1].default_value = -0.03 if i0 >= 6 else -0.25
        link(g, pw.outputs[0], mz.inputs[0]); link(g, mz.outputs[0], cz.inputs["Z"])
        link(g, cz.outputs[0], st.inputs["Translation"])
        link(g, st.outputs[0], join.inputs[0])
    link(g, join.outputs[0], go.inputs[0])
    mod = ob.modifiers.new("MarsScatter", "NODES"); mod.node_group = g
    return mod
gn_scatter(g_near)

# ============================================================================ WORLDS
def world_mars_day(name, sun_dir, exposure_sky=1.0):
    w = bpy.data.worlds.new(name)
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = node(nt, "ShaderNodeOutputWorld", (900, 0))
    tc = node(nt, "ShaderNodeTexCoord", (-1200, 0))
    nrm = node(nt, "ShaderNodeVectorMath", (-1000, 0), operation="NORMALIZE")
    link(nt, tc.outputs["Generated"], nrm.inputs[0])
    sep = node(nt, "ShaderNodeSeparateXYZ", (-800, 100)); link(nt, nrm.outputs[0], sep.inputs[0])
    el = node(nt, "ShaderNodeValToRGB", (-600, 200))
    cr = el.color_ramp
    cr.elements[0].position = 0.0; cr.elements[0].color = srgb(230, 186, 146)
    cr.elements[1].position = 1.0; cr.elements[1].color = srgb(184, 126, 88)
    e = cr.elements.new(0.12); e.color = srgb(218, 168, 126)
    link(nt, sep.outputs["Z"], el.inputs["Fac"])
    dot = node(nt, "ShaderNodeVectorMath", (-800, -200), operation="DOT_PRODUCT")
    link(nt, nrm.outputs[0], dot.inputs[0]); dot.inputs[1].default_value = Vector(sun_dir).normalized()
    au = node(nt, "ShaderNodeMapRange", (-600, -200)); au.inputs["From Min"].default_value = 0.75
    au.inputs["From Max"].default_value = 1.0; au.inputs["To Max"].default_value = 0.85
    au.interpolation_type = "SMOOTHERSTEP"
    link(nt, dot.outputs["Value"], au.inputs["Value"])
    mx = node(nt, "ShaderNodeMix", (-300, 0)); mx.data_type = "RGBA"
    link(nt, au.outputs["Result"], mx.inputs[0]); link(nt, el.outputs["Color"], mx.inputs[6])
    mx.inputs[7].default_value = srgb(246, 228, 206)
    # sun disc (visible only to camera); lamp does the lighting
    disc = node(nt, "ShaderNodeMapRange", (-300, -300)); disc.inputs["From Min"].default_value = math.cos(math.radians(0.25))
    disc.inputs["From Max"].default_value = math.cos(math.radians(0.15)); disc.inputs["To Max"].default_value = 60.0
    link(nt, dot.outputs["Value"], disc.inputs["Value"])
    lp = node(nt, "ShaderNodeLightPath", (-300, -500))
    dm = node(nt, "ShaderNodeMath", (-100, -350), operation="MULTIPLY")
    link(nt, disc.outputs["Result"], dm.inputs[0]); link(nt, lp.outputs["Is Camera Ray"], dm.inputs[1])
    bg = node(nt, "ShaderNodeBackground", (300, 100)); bg.inputs["Strength"].default_value = exposure_sky
    link(nt, mx.outputs[2], bg.inputs["Color"])
    bd = node(nt, "ShaderNodeBackground", (300, -200)); bd.inputs["Color"].default_value = (1.0, 0.97, 0.92, 1)
    link(nt, dm.outputs[0], bd.inputs["Strength"])
    ad = node(nt, "ShaderNodeAddShader", (600, 0))
    link(nt, bg.outputs[0], ad.inputs[0]); link(nt, bd.outputs[0], ad.inputs[1])
    link(nt, ad.outputs[0], out.inputs["Surface"])
    return w

def world_mars_sunset(name, sun_dir):
    w = bpy.data.worlds.new(name)
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = node(nt, "ShaderNodeOutputWorld", (1100, 0))
    tc = node(nt, "ShaderNodeTexCoord", (-1200, 0))
    nrm = node(nt, "ShaderNodeVectorMath", (-1000, 0), operation="NORMALIZE")
    link(nt, tc.outputs["Generated"], nrm.inputs[0])
    sep = node(nt, "ShaderNodeSeparateXYZ", (-800, 200)); link(nt, nrm.outputs[0], sep.inputs[0])
    el = node(nt, "ShaderNodeValToRGB", (-600, 300)); cr = el.color_ramp
    cr.elements[0].position = 0.0; cr.elements[0].color = srgb(92, 92, 100)
    e = cr.elements.new(0.08); e.color = srgb(74, 75, 84)
    cr.elements[1].position = 0.6; cr.elements[1].color = srgb(30, 31, 38)
    link(nt, sep.outputs["Z"], el.inputs["Fac"])
    dot = node(nt, "ShaderNodeVectorMath", (-800, -200), operation="DOT_PRODUCT")
    link(nt, nrm.outputs[0], dot.inputs[0]); dot.inputs[1].default_value = Vector(sun_dir).normalized()
    # blue aureole: dust scatters blue light forward, close to the Sun
    halo = node(nt, "ShaderNodeValToRGB", (-600, -100)); hr = halo.color_ramp
    hr.interpolation = "EASE"
    hr.elements[0].position = 0.55; hr.elements[0].color = (0, 0, 0, 1)
    e = hr.elements.new(0.85); e.color = srgb(28, 36, 50)
    e = hr.elements.new(0.95); e.color = srgb(64, 86, 116)
    e = hr.elements.new(0.985); e.color = srgb(112, 146, 190)
    e = hr.elements.new(0.997); e.color = srgb(170, 202, 238)
    hr.elements[-1].position = 1.0; hr.elements[-1].color = srgb(225, 238, 255)
    link(nt, dot.outputs["Value"], halo.inputs["Fac"])
    hs = node(nt, "ShaderNodeVectorMath", (-350, -100), operation="SCALE"); hs.inputs["Scale"].default_value = 1.2
    link(nt, halo.outputs["Color"], hs.inputs[0])
    # horizon glow band around the sun azimuth (warm grey)
    hb = node(nt, "ShaderNodeMapRange", (-600, -400)); hb.inputs["From Min"].default_value = 0.2
    hb.inputs["From Max"].default_value = 1.0; hb.inputs["To Max"].default_value = 1.0
    link(nt, dot.outputs["Value"], hb.inputs["Value"])
    hz = node(nt, "ShaderNodeMapRange", (-600, -600)); hz.inputs["From Min"].default_value = 0.25
    hz.inputs["From Max"].default_value = 0.0; hz.inputs["To Max"].default_value = 1.0
    link(nt, sep.outputs["Z"], hz.inputs["Value"])
    hm = node(nt, "ShaderNodeMath", (-400, -500), operation="MULTIPLY")
    link(nt, hb.outputs["Result"], hm.inputs[0]); link(nt, hz.outputs["Result"], hm.inputs[1])
    hm2 = node(nt, "ShaderNodeMix", (-200, -500)); hm2.data_type = "RGBA"; hm2.blend_type = "ADD"
    link(nt, hm.outputs[0], hm2.inputs[0]); link(nt, el.outputs["Color"], hm2.inputs[6])
    hm2.inputs[7].default_value = srgb(60, 66, 78)
    add = node(nt, "ShaderNodeVectorMath", (0, 0), operation="ADD")
    link(nt, hm2.outputs[2], add.inputs[0]); link(nt, hs.outputs[0], add.inputs[1])
    disc = node(nt, "ShaderNodeMapRange", (-300, -800)); disc.inputs["From Min"].default_value = math.cos(math.radians(0.24))
    disc.inputs["From Max"].default_value = math.cos(math.radians(0.14)); disc.inputs["To Max"].default_value = 80.0
    link(nt, dot.outputs["Value"], disc.inputs["Value"])
    lp = node(nt, "ShaderNodeLightPath", (-300, -1000))
    dm = node(nt, "ShaderNodeMath", (-100, -850), operation="MULTIPLY")
    link(nt, disc.outputs["Result"], dm.inputs[0]); link(nt, lp.outputs["Is Camera Ray"], dm.inputs[1])
    bg = node(nt, "ShaderNodeBackground", (400, 100))
    lp0 = node(nt, "ShaderNodeLightPath", (100, 300))
    st0 = node(nt, "ShaderNodeMapRange", (250, 300)); st0.inputs["To Min"].default_value = 0.45
    st0.inputs["To Max"].default_value = 1.0
    link(nt, lp0.outputs["Is Camera Ray"], st0.inputs["Value"]); link(nt, st0.outputs["Result"], bg.inputs["Strength"])
    link(nt, add.outputs[0], bg.inputs["Color"])
    bd = node(nt, "ShaderNodeBackground", (400, -200)); bd.inputs["Color"].default_value = (0.92, 0.96, 1.0, 1)
    link(nt, dm.outputs[0], bd.inputs["Strength"])
    ad = node(nt, "ShaderNodeAddShader", (700, 0))
    link(nt, bg.outputs[0], ad.inputs[0]); link(nt, bd.outputs[0], ad.inputs[1])
    link(nt, ad.outputs[0], out.inputs["Surface"])
    return w

def world_flat(name, color, strength):
    w = bpy.data.worlds.new(name)
    try:
        w.use_nodes = True
    except Exception:
        pass
    bgn = [n for n in w.node_tree.nodes if n.type == "BACKGROUND"]
    if not bgn:
        bgn = [w.node_tree.nodes.new("ShaderNodeBackground")]
        outn = w.node_tree.nodes.new("ShaderNodeOutputWorld")
        w.node_tree.links.new(bgn[0].outputs[0], outn.inputs[0])
    bgn[0].inputs["Color"].default_value = color
    bgn[0].inputs["Strength"].default_value = strength
    return w

def world_studio(name):
    """sprite lighting: soft gradient (bright top, warm-dark bottom) so metals read well"""
    w = bpy.data.worlds.new(name)
    try:
        w.use_nodes = True
    except Exception:
        pass
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = node(nt, "ShaderNodeOutputWorld", (600, 0))
    tc = node(nt, "ShaderNodeTexCoord", (-800, 0))
    nrm = node(nt, "ShaderNodeVectorMath", (-600, 0), operation="NORMALIZE")
    link(nt, tc.outputs["Generated"], nrm.inputs[0])
    sep = node(nt, "ShaderNodeSeparateXYZ", (-400, 0)); link(nt, nrm.outputs[0], sep.inputs[0])
    mr = node(nt, "ShaderNodeMapRange", (-250, 0)); mr.inputs["From Min"].default_value = -1.0
    link(nt, sep.outputs["Z"], mr.inputs["Value"])
    cr = node(nt, "ShaderNodeValToRGB", (-100, 0))
    cr.color_ramp.elements[0].color = srgb(70, 52, 42); cr.color_ramp.elements[1].color = srgb(225, 225, 230)
    cr.color_ramp.elements[0].position = 0.3; cr.color_ramp.elements[1].position = 0.75
    link(nt, mr.outputs["Result"], cr.inputs["Fac"])
    bg = node(nt, "ShaderNodeBackground", (300, 0)); bg.inputs["Strength"].default_value = 0.9
    link(nt, cr.outputs["Color"], bg.inputs["Color"]); link(nt, bg.outputs[0], out.inputs["Surface"])
    return w

# ============================================================================ SCENES
def setup_render(sc, w=RES, h=None, samples=SAMPLES, transparent=False):
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    if arg("--threads"):                      # optional fixed thread count
        sc.render.threads_mode = "FIXED"; sc.render.threads = int(arg("--threads"))
    else:                                     # default: all CPU cores (performance + efficiency)
        sc.render.threads_mode = "AUTO"
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True; sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    sc.cycles.max_bounces = 6; sc.cycles.diffuse_bounces = 3; sc.cycles.glossy_bounces = 3
    sc.cycles.transmission_bounces = 6; sc.cycles.transparent_max_bounces = 8
    sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 1.0
    sc.render.resolution_x = w; sc.render.resolution_y = h if h else int(round(w * 9 / 16))
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = transparent
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    try:
        sc.view_settings.view_transform = "AgX"
        sc.view_settings.look = "None"
    except Exception:
        try:
            sc.view_settings.look = "Medium High Contrast"
        except Exception:
            pass

def link_colls(sc, colls):
    for c in colls:
        if c.name not in sc.collection.children:
            sc.collection.children.link(c)

def add_cam(sc, name, loc, target, lens=35.0, roll=0.0):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.clip_start = 0.05; cd.clip_end = 2.0e5
    cd.sensor_width = 36.0
    co = bpy.data.objects.new(name, cd); sc.collection.objects.link(co)
    co.location = loc; look_at(co, target, roll)
    sc.camera = co
    return co

def add_sun(sc, name, sun_dir, strength, color=(1, 1, 1), angle_deg=0.6):
    ld = bpy.data.lights.new(name, "SUN"); ld.energy = strength; ld.color = color
    ld.angle = math.radians(angle_deg)
    lo = bpy.data.objects.new(name, ld); sc.collection.objects.link(lo)
    lo.rotation_euler = sun_rot(sun_dir)
    return lo

def set_haze(sc, color, dist):
    sc["haze_color"] = list(color[:3]) + [1.0]
    sc["haze_dist"] = float(dist)

# ---- placement (shared objects: Curiosity at origin facing -Y; Perseverance / Viking only in family scene)
LIB["curiosity"][1].scale = (SCALE["curiosity"],) * 3
LIB["perseverance"][1].scale = (SCALE["perseverance"],) * 3
LIB["viking"][1].scale = (SCALE["viking"],) * 3
LIB["sample-tube"][1].scale = (SCALE["sample-tube"],) * 3
LIB["mars-globe"][1].scale = (SCALE["mars-globe"],) * 3

def place(key, loc, rot_z_deg):
    c, r = LIB[key]
    r.location = (0, 0, 0); r.rotation_euler = (0, 0, 0)
    lo, hi_ = data_bbox(c.all_objects, root_identity=r)     # root-space bbox (scaled by root.scale)
    S = r.scale[0]
    lo, hi_ = lo * S, hi_ * S
    ctr = Vector(((lo.x + hi_.x) / 2, (lo.y + hi_.y) / 2, lo.z))
    rz = math.radians(rot_z_deg)
    r.rotation_euler = (0, 0, rz)
    r.location = Vector(loc) - Matrix.Rotation(rz, 3, "Z") @ ctr
    MEAS[key]["placed_size_m"] = tuple(round(v, 4) for v in (hi_ - lo))
    return lo, hi_

place("curiosity", (0, 0, near_h(0, 0) - 0.005), 0)
place("perseverance", (3.9, -1.0, near_h(3.9, -1.0) - 0.005), 18)
place("viking", (-4.4, 1.6, near_h(-4.4, 1.6) - 0.01), -35)
place("sample-tube", (2.35, -2.9, near_h(2.35, -2.9) + 0.0), 0)
tub_root = LIB["sample-tube"][1]
tub_root.rotation_euler = (math.radians(90), 0, math.radians(35))
tub_root.location = (2.35, -2.9, near_h(2.35, -2.9) + 0.002)
LIB["mars-globe"][1].location = (0, 0, 0)

# ---- scene 1: Gale crater day
DAY_SUN = dir_from_az_el(-172.0, 40.0)
sc = BASE
setup_render(sc)
link_colls(sc, [c_ter, c_far, LIB["curiosity"][0]])
sc.world = world_mars_day("mars_sky_day", DAY_SUN)
set_haze(sc, srgb(212, 168, 130), 46000.0)
add_sun(sc, "sun_day", DAY_SUN, 3.2, color=(1.0, 0.95, 0.88), angle_deg=1.2)
cam_mtn = SOUTH.copy(); cam_mtn.rotate(Matrix.Rotation(math.radians(-12), 3, "Z"))
add_cam(sc, "cam_gale_day", (-4.9, -6.4, 1.55), (0.25, 0.35, 1.05), lens=32)
sc.view_settings.exposure = 0.0
SC_DAY = sc

# ---- scene 2: family photo
sc = bpy.data.scenes.new("mars_family")
setup_render(sc)
link_colls(sc, [c_ter, c_far, LIB["curiosity"][0], LIB["perseverance"][0], LIB["viking"][0], LIB["sample-tube"][0]])
sc.world = SC_DAY.world
set_haze(sc, srgb(212, 168, 130), 46000.0)
add_sun(sc, "sun_family", DAY_SUN, 3.2, color=(1.0, 0.95, 0.88), angle_deg=1.2)
add_cam(sc, "cam_family", (-2.2, -13.5, 2.3), (-0.2, 0.0, 0.95), lens=30)
SC_FAM = sc

# ---- scene 3: sunset (looking west; Mount Sharp is to the left/south)
WEST = SOUTH.copy(); WEST.rotate(Matrix.Rotation(math.radians(-90), 3, "Z"))
SUNSET_AZ = math.degrees(math.atan2(WEST.y, WEST.x))
SUNSET_SUN = dir_from_az_el(SUNSET_AZ + 4.0, 3.2)
sc = bpy.data.scenes.new("mars_sunset")
setup_render(sc)
link_colls(sc, [c_ter, c_far, LIB["curiosity"][0]])
sc.world = world_mars_sunset("mars_sky_sunset", SUNSET_SUN)
set_haze(sc, srgb(84, 86, 96), 14000.0)
add_sun(sc, "sun_sunset", SUNSET_SUN, 1.6, color=(1.0, 0.93, 0.85), angle_deg=0.6)
back = -Vector((SUNSET_SUN.x, SUNSET_SUN.y, 0)).normalized()
side = Vector((-back.y, back.x, 0))
cam_loc = back * 8.5 + side * 2.6 + Vector((0, 0, 0.55))
add_cam(sc, "cam_sunset", tuple(cam_loc), tuple(Vector((0.0, 0.0, 1.45)) + side * 1.3), lens=40)
sc.view_settings.exposure = -0.3
SC_SUN = sc

# ---- scene 4: globe from orbit
sc = bpy.data.scenes.new("mars_globe")
setup_render(sc)
link_colls(sc, [LIB["mars-globe"][0]])
sc.world = world_flat("space_black", (0, 0, 0, 1), 0.0)
cam_dir = Vector((0, -1, 0.12)).normalized()
add_cam(sc, "cam_globe", tuple(cam_dir * MARS_R * 4.3), (MARS_R * 0.18, 0, 0), lens=35)
sc.camera.data.clip_start = 1000.0; sc.camera.data.clip_end = MARS_R * 20
g_sun = Vector((-0.75, -0.55, 0.25)).normalized()
add_sun(sc, "sun_globe", g_sun, 5.0, color=(1.0, 0.97, 0.93), angle_deg=0.35)
# thin atmosphere limb shell
bpy.ops.mesh.primitive_uv_sphere_add(segments=128, ring_count=64, radius=MARS_R * 1.012)
atm = bpy.context.active_object; atm.name = "mars_atmosphere_limb"
for c in atm.users_collection:
    c.objects.unlink(atm)
LIB["mars-globe"][0].objects.link(atm)
for p in atm.data.polygons:
    p.use_smooth = True
ma = new_mat("mars_atmosphere")
nt = ma.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
o_ = node(nt, "ShaderNodeOutputMaterial", (800, 0))
lw = node(nt, "ShaderNodeLayerWeight", (-600, 0)); lw.inputs["Blend"].default_value = 0.5
pw = node(nt, "ShaderNodeMath", (-400, 0), operation="POWER"); pw.inputs[1].default_value = 7.0
link(nt, lw.outputs["Facing"], pw.inputs[0])
geo = node(nt, "ShaderNodeNewGeometry", (-800, -300))
pn = node(nt, "ShaderNodeVectorMath", (-700, -300), operation="NORMALIZE")
link(nt, geo.outputs["Position"], pn.inputs[0])
dt = node(nt, "ShaderNodeVectorMath", (-600, -300), operation="DOT_PRODUCT")
link(nt, pn.outputs[0], dt.inputs[0]); dt.inputs[1].default_value = g_sun
dm = node(nt, "ShaderNodeMapRange", (-400, -300)); dm.inputs["From Min"].default_value = -0.25
dm.inputs["From Max"].default_value = 0.35; dm.interpolation_type = "SMOOTHSTEP"
link(nt, dt.outputs["Value"], dm.inputs["Value"])
mm = node(nt, "ShaderNodeMath", (-200, -100), operation="MULTIPLY")
link(nt, pw.outputs[0], mm.inputs[0]); link(nt, dm.outputs["Result"], mm.inputs[1])
ms_ = node(nt, "ShaderNodeMath", (0, -100), operation="MULTIPLY"); ms_.inputs[1].default_value = 2.0
link(nt, mm.outputs[0], ms_.inputs[0])
em = node(nt, "ShaderNodeEmission", (200, -100)); em.inputs["Color"].default_value = srgb(236, 196, 168)
link(nt, ms_.outputs[0], em.inputs["Strength"])
tr = node(nt, "ShaderNodeBsdfTransparent", (200, 100))
ad = node(nt, "ShaderNodeAddShader", (500, 0))
link(nt, tr.outputs[0], ad.inputs[0]); link(nt, em.outputs[0], ad.inputs[1]); link(nt, ad.outputs[0], o_.inputs["Surface"])
atm.data.materials.append(ma)
atm.visible_shadow = False
SC_GLB = sc
# Viking map: lon 0 at +X, east towards +Y; rotate so Valles Marineris (lon -70) faces the camera, a bit sunward
LIB["mars-globe"][1].rotation_euler = (0, 0, math.radians(float(arg("--globe_rot", -32))))

# ---- scene 5: sprites
sc = bpy.data.scenes.new("mars_sprites")
setup_render(sc, 512, 512, transparent=True)
link_colls(sc, [LIB[k][0] for k in ("curiosity", "perseverance", "viking", "sample-tube")])
sc.world = world_studio("sprite_studio")
add_sun(sc, "sun_sprite", dir_from_az_el(-130, 45), 3.0, color=(1.0, 0.96, 0.9), angle_deg=3.0)
cd = bpy.data.cameras.new("cam_sprite"); cd.type = "ORTHO"; cd.clip_start = 0.01; cd.clip_end = 1000
cs = bpy.data.objects.new("cam_sprite", cd); sc.collection.objects.link(cs); sc.camera = cs
SC_SPR = sc

# ============================================================================ RENDER
def save_render(sc, path_png, jpg=True):
    sc.render.filepath = path_png
    bpy.ops.render.render(write_still=True, scene=sc.name)
    log("wrote", path_png)
    if jpg:
        img = bpy.data.images.get("Render Result")
        s_fmt = sc.render.image_settings.file_format
        sc.render.image_settings.file_format = "JPEG"; sc.render.image_settings.quality = 82
        sc.render.image_settings.color_mode = "RGB"
        img.save_render(path_png[:-4] + ".jpg", scene=sc)
        sc.render.image_settings.file_format = s_fmt
        log("wrote", path_png[:-4] + ".jpg")

def frame_sprite(sc, objs, az=-128.0, el=18.0, margin=1.08, maxpx=512):
    cam = sc.camera
    d = dir_from_az_el(az, el)
    pts = []
    for o in objs:
        if o.type != "MESH" or o.hide_render:
            continue
        M = calc_world(o)
        pts += [M @ Vector(c) for c in o.bound_box]
    ctr = sum(pts, Vector()) / len(pts)
    cam.location = ctr + d * 50.0 * max((p - ctr).length for p in pts)
    look_at(cam, ctr)
    inv = cam.matrix_basis.inverted()
    loc = [inv @ p for p in pts]
    xs = [p.x for p in loc]; ys = [p.y for p in loc]
    w = max(xs) - min(xs); h = max(ys) - min(ys)
    # recentre
    off = cam.matrix_basis.to_3x3() @ Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, 0))
    cam.location += off
    if w >= h:
        sc.render.resolution_x = maxpx; sc.render.resolution_y = max(16, int(round(maxpx * h / w)) + 8)
    else:
        sc.render.resolution_y = maxpx; sc.render.resolution_x = max(16, int(round(maxpx * w / h)) + 8)
    cam.data.ortho_scale = max(w, h) * margin
    cam.data.clip_end = 200.0 * max((p - ctr).length for p in pts) + 10

def render_sprites():
    sc = SC_SPR
    out = REN + "/sprites"; os.makedirs(out, exist_ok=True)
    for key, nm, az, el in (("curiosity", "mars_curiosity", -125, 16), ("perseverance", "mars_perseverance", -125, 16),
                            ("viking", "mars_viking", -120, 16), ("sample-tube", "mars_sample_tube", -90, 35)):
        for lc in sc.view_layers[0].layer_collection.children:
            lc.exclude = (lc.collection != LIB[key][0])
            sc.view_layers[0].update()
        frame_sprite(sc, list(LIB[key][0].all_objects), az=az, el=el)
        sc.cycles.samples = max(SAMPLES, 64)
        save_render(sc, f"{out}/{nm}.png", jpg=False)
    for lc in sc.view_layers[0].layer_collection.children:
        lc.exclude = False
    # globe sprite from the orbit scene, transparent
    g = SC_GLB
    rx, ry, ft = g.render.resolution_x, g.render.resolution_y, g.render.film_transparent
    cam_loc = g.camera.location.copy(); cam_rot = g.camera.rotation_euler.copy(); lens = g.camera.data.lens
    g.render.resolution_x = g.render.resolution_y = 512; g.render.film_transparent = True
    g.render.image_settings.color_mode = "RGBA"
    g.camera.location = Vector((0, -1, 0.12)).normalized() * MARS_R * 4.3; look_at(g.camera, (0, 0, 0))
    g.camera.data.lens = 50.0 * (MARS_R * 1.02 * 2.0) / (MARS_R * 4.3) * 36 / 36 * 1.0
    # fit the disc: half-width at distance D = 18mm*D/lens  -> want ~ 1.04 R
    D = MARS_R * 4.3; g.camera.data.lens = 18.0 * D / (MARS_R * 1.05)
    save_render(g, f"{out}/mars_globe.png", jpg=False)
    g.render.resolution_x, g.render.resolution_y, g.render.film_transparent = rx, ry, ft
    g.render.image_settings.color_mode = "RGB"
    g.camera.location = cam_loc; g.camera.rotation_euler = cam_rot; g.camera.data.lens = lens

def render_compare():
    """Curiosity from an angle similar to the MAHLI selfie (front 3/4, slightly above)."""
    sc = SC_DAY
    cam = sc.camera
    keep = (cam.location.copy(), cam.rotation_euler.copy(), cam.data.lens)
    cam.location = (-2.6, -3.6, 2.6); look_at(cam, (0.1, 0.1, 0.8)); cam.data.lens = 18
    os.makedirs(REN + "/compare", exist_ok=True)
    save_render(sc, f"{REN}/compare/curiosity_selfie_angle{SUFFIX}.png", jpg=False)
    cam.location, cam.rotation_euler, cam.data.lens = keep
    sc2 = SC_FAM
    cam = sc2.camera
    keep = (cam.location.copy(), cam.rotation_euler.copy(), cam.data.lens)
    pc = Vector((3.9, -1.0, 0))
    cam.location = pc + Vector((-2.4, -3.0, 2.4)); look_at(cam, pc + Vector((0, 0, 0.9))); cam.data.lens = 18
    save_render(sc2, f"{REN}/compare/perseverance_selfie_angle{SUFFIX}.png", jpg=False)
    cam.location, cam.rotation_euler, cam.data.lens = keep

shots = {"day": (SC_DAY, "mars_gale_day"), "family": (SC_FAM, "mars_family"),
         "sunset": (SC_SUN, "mars_sunset"), "globe": (SC_GLB, "mars_globe_orbit")}
for r in RENDER:
    if r in shots:
        sc, nm = shots[r]
        save_render(sc, f"{REN}/{nm}_{RES}{SUFFIX}.png")
    elif r == "sprites":
        render_sprites()
    elif r == "compare":
        render_compare()

# ============================================================================ SAVE
import json
with open(SCN + "/mars_measurements.json", "w") as f:
    json.dump({"scale": SCALE, "measure": MEAS}, f, indent=1)
log("measurements", MEAS)

if not NOSAVE:
    for sc in bpy.data.scenes:
        sc.cycles.device = "GPU"            # user renders on Metal in the Blender app
        sc.cycles.samples = 64 if sc == SC_SPR else 256
        sc.render.threads_mode = "AUTO"
        if sc != SC_SPR:
            sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
    try:
        bpy.context.preferences.filepaths.save_version = 0   # no mars.blend1 backup copies
    except Exception:
        pass
    bpy.ops.wm.save_as_mainfile(filepath=SCN + "/mars.blend", compress=True)
    log("saved", SCN + "/mars.blend")
log("done")
