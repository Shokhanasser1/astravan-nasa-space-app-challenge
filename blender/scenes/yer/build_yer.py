# -*- coding: utf-8 -*-
"""
OUTPOST / "Oy karvonsaroyi" -- EARTH station ("yer") scene builder.

Rebuilds yer.blend from scratch out of the NASA 3D models in ../../source/models.
Run headless:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P build_yer.py
Optional args after "--":  scenes=pad,mcc,dsn,sprites   (default: all)

1 Blender unit = 1 metre.  Every model is scaled to its real size (see
docs/yer_nasa_taqqoslash.md for the NASA numbers and the scale factors).
NASA brand rule: no logos, flags, lettering -- the models used here carry no
texture lettering; plain materials are applied everywhere.
3D models: NASA 3D Resources / NASA Science. Not endorsed by NASA.
"""
import bpy, bmesh, sys, math, os
import numpy as np
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'source', 'models')
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OPT = dict(a.split('=', 1) for a in ARGS if '=' in a)
BLEND = OPT.get('out', os.path.join(HERE, 'yer.blend'))
WANT = OPT.get('scenes', 'pad,mcc,dsn,sprites').split(',')

# ----------------------------------------------------------------------------
# Real-size data (NASA).  See docs/yer_nasa_taqqoslash.md for sources.
# ----------------------------------------------------------------------------
SLS_HEIGHT_M = 98.1          # SLS Block 1 crew vehicle, 322 ft
SLS_MODEL_BASE_Z = 5.0       # STL print stand is 0..5.19 units; rocket starts at ~5.0
SLS_MODEL_TOP_Z = 198.7409
SLS_SCALE = SLS_HEIGHT_M / (SLS_MODEL_TOP_Z - SLS_MODEL_BASE_Z)   # ~0.5063
ML_TOWER_W_M = 12.19         # ML-1 tower is 40 ft square (fact sheet)
ML_MODEL_TOWER_W = 0.251     # tower x-extent in the model (0.303..0.554)
ML_SCALE = ML_TOWER_W_M / ML_MODEL_TOWER_W                        # ~48.6
# -> total height 2.4643*48.6 = 119.7 m (NASA ML-1 page: ~380 ft = 116 m; +3.4%),
#    0-deck 0.30*48.6 = 14.6 m (NASA: 47 ft = 14.3 m)
ML_HOLE_MODEL_XY = (-0.02, 0.0)   # exhaust hole centre in the ML model (raycast map)
ORION_CM_DIAM_M = 5.03       # Orion crew module, 16.5 ft
ORION_SCALE = ORION_CM_DIAM_M / 16.3094
DSN_SCALE = 34.0 / 34.0248   # dish is already ~34 m across
HELMET_DIAM_M = 0.40         # pressure-helmet bubble ~ 40 cm
HELMET_SCALE = HELMET_DIAM_M / 14.07


# ----------------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------------
def srgb(h):
    """'#rrggbb' -> linear RGBA"""
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, 1.0)


def mat(name, color, rough=0.5, metal=0.0, emit=None, emit_strength=0.0,
        noise=0.0, noise_scale=8.0, coat=0.0):
    """Principled material; optional procedural 'grime' noise darkening."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs[0], out.inputs[0])
    col = srgb(color) if isinstance(color, str) else color
    b.inputs['Base Color'].default_value = col
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if coat:
        b.inputs['Coat Weight'].default_value = coat
    if emit is not None:
        b.inputs['Emission Color'].default_value = srgb(emit) if isinstance(emit, str) else emit
        b.inputs['Emission Strength'].default_value = emit_strength
    if noise > 0:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        nz = nt.nodes.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = noise_scale
        nz.inputs['Detail'].default_value = 6.0
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[0].color = (1 - noise, 1 - noise, 1 - noise, 1)
        ramp.color_ramp.elements[1].position = 0.75
        ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
        nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs[6].default_value = col
        nt.links.new(ramp.outputs['Color'], mix.inputs[7])
        nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    return m


def import_glb(name, coll):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, name + '.glb'))
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
    return new


def new_scene(name):
    sc = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    return sc


def link_coll(sc, name):
    c = bpy.data.collections.new(name)
    sc.collection.children.link(c)
    return c


def bbox_world(objs):
    mn = Vector((1e18,) * 3)
    mx = Vector((-1e18,) * 3)
    for o in objs:
        if o.type != 'MESH':
            continue
        for v in o.bound_box:
            p = o.matrix_world @ Vector(v)
            mn = Vector(map(min, mn, p))
            mx = Vector(map(max, mx, p))
    return mn, mx


def set_render(sc, w=1920, h=1080, samples=256, final=True, exposure=0.0):
    r = sc.render
    r.engine = 'CYCLES'
    r.resolution_x, r.resolution_y = w, h
    r.resolution_percentage = 100
    r.image_settings.file_format = 'PNG'
    r.image_settings.color_mode = 'RGBA'
    cy = sc.cycles
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.use_denoising = True
    cy.max_bounces = 8
    cy.transparent_max_bounces = 16
    if final:
        cy.device = 'GPU'           # Metal in the Blender app
        r.threads_mode = 'AUTO'
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    sc.view_settings.exposure = exposure


def add_cam(sc, coll, name, loc, target, lens=35.0, clip_end=20000.0):
    cd = bpy.data.cameras.new(name)
    cd.lens = lens
    cd.clip_start = 0.05
    cd.clip_end = clip_end
    c = bpy.data.objects.new(name, cd)
    coll.objects.link(c)
    c.location = Vector(loc)
    d = Vector(target) - Vector(loc)
    c.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return c


def sky_world(name, sun_elev_deg, sun_rot_deg, strength=1.0, air=1.0, dust=1.0, ozone=1.0,
              tint=None):
    w = bpy.data.worlds.new(name)
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    sky = nt.nodes.new('ShaderNodeTexSky')
    try:
        sky.sky_type = 'MULTIPLE_SCATTERING'
    except Exception:
        sky.sky_type = 'SINGLE_SCATTERING'
    sky.sun_disc = False   # the sun lamp gives the direct light
    sky.sun_elevation = math.radians(sun_elev_deg)
    sky.sun_rotation = math.radians(sun_rot_deg)
    sky.altitude = 10.0
    sky.air_density = air
    sky.aerosol_density = dust
    sky.ozone_density = ozone
    sky.sun_size = math.radians(1.2)
    try:
        sky.sun_intensity = 0.6
    except Exception:
        pass
    last = sky.outputs[0]
    hs = nt.nodes.new('ShaderNodeHueSaturation')
    hs.inputs['Saturation'].default_value = 1.35
    nt.links.new(last, hs.inputs['Color'])
    last = hs.outputs[0]
    if tint:
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Factor'].default_value = 1.0
        mix.inputs[7].default_value = tint
        nt.links.new(last, mix.inputs[6])
        last = mix.outputs[2]
    nt.links.new(last, bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    nt.links.new(bg.outputs[0], out.inputs[0])
    return w


def sun_lamp(coll, name, elev_deg, rot_deg, energy, color='#ffd2a0', angle_deg=1.0):
    ld = bpy.data.lights.new(name, 'SUN')
    ld.energy = energy
    ld.color = srgb(color)[:3]
    ld.angle = math.radians(angle_deg)
    o = bpy.data.objects.new(name, ld)
    coll.objects.link(o)
    # Sky texture convention: sun_rotation 0 = sun towards +Y?  We point the lamp
    # so that light travels from the sun position towards the origin.
    el, az = math.radians(elev_deg), math.radians(rot_deg)
    # same convention as the Sky Texture node (checked with a shadow test)
    sun_dir = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el)))
    o.rotation_euler = (-sun_dir).to_track_quat('-Z', 'Y').to_euler()
    return o


def apply_xform(objs):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


# ----------------------------------------------------------------------------
# SLS: one grey STL -> real colours by part/height
# ----------------------------------------------------------------------------
def checker_mat(name, scale=1.2):
    """black/white photogrammetry 'roll target' squares seen on the real stack."""
    m = mat(name, '#ffffff', rough=0.55)
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    ck = nt.nodes.new('ShaderNodeTexChecker')
    ck.inputs['Color1'].default_value = srgb('#efeee9')
    ck.inputs['Color2'].default_value = srgb('#151515')
    ck.inputs['Scale'].default_value = scale
    nt.links.new(tc.outputs['Object'], ck.inputs['Vector'])
    nt.links.new(ck.outputs['Color'], b.inputs['Base Color'])
    return m


def band_mat(name, base_hex, bands=(), checker_bands=(), rough=0.6, noise=0.0, noise_scale=3.0,
             zmax=200.0):
    """Colour bands along the object's local Z (model units) -> crisp rings even on the
    long thin STL triangles.  bands: [(z0, z1, hex)], checker_bands: [(z0, z1)]."""
    m = mat(name, base_hex, rough=rough, noise=noise, noise_scale=noise_scale)
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    dv = nt.nodes.new('ShaderNodeMath'); dv.operation = 'DIVIDE'
    dv.inputs[1].default_value = zmax
    nt.links.new(sep.outputs['Z'], dv.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.interpolation = 'CONSTANT'
    cr.elements[0].position = 0.0
    cr.elements[0].color = srgb(base_hex)
    cr.elements[1].position = 1.0
    cr.elements[1].color = srgb(base_hex)
    for z0, z1, hx in sorted(bands):
        e = cr.elements.new(z0 / zmax); e.color = srgb(hx)
        e = cr.elements.new(z1 / zmax); e.color = srgb(base_hex)
    nt.links.new(dv.outputs[0], ramp.inputs['Fac'])
    col = ramp.outputs['Color']
    if checker_bands:
        mr = nt.nodes.new('ShaderNodeValToRGB')
        mr.color_ramp.interpolation = 'CONSTANT'
        mr.color_ramp.elements[0].color = (0, 0, 0, 1)
        mr.color_ramp.elements[1].position = 1.0
        mr.color_ramp.elements[1].color = (0, 0, 0, 1)
        for z0, z1 in sorted(checker_bands):
            e = mr.color_ramp.elements.new(z0 / zmax); e.color = (1, 1, 1, 1)
            e = mr.color_ramp.elements.new(z1 / zmax); e.color = (0, 0, 0, 1)
        nt.links.new(dv.outputs[0], mr.inputs['Fac'])
        ck = nt.nodes.new('ShaderNodeTexChecker')
        ck.inputs['Color1'].default_value = srgb('#efeee9')
        ck.inputs['Color2'].default_value = srgb('#151515')
        ck.inputs['Scale'].default_value = 0.55
        nt.links.new(tc.outputs['Object'], ck.inputs['Vector'])
        mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'
        nt.links.new(mr.outputs['Color'], mx.inputs['Factor'])
        nt.links.new(col, mx.inputs[6])
        nt.links.new(ck.outputs['Color'], mx.inputs[7])
        col = mx.outputs[2]
    # keep the grime noise: multiply
    mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'
    mul.inputs['Factor'].default_value = 1.0
    nt.links.new(col, mul.inputs[6])
    old = b.inputs['Base Color'].links[0].from_node if b.inputs['Base Color'].is_linked else None
    if old is not None and old.bl_idname == 'ShaderNodeMix':
        # grime multiplier = old mix's 'B' input (noise ramp)
        src = old.inputs[7].links[0].from_socket if old.inputs[7].is_linked else None
        if src is not None:
            nt.links.new(src, mul.inputs[7])
        else:
            mul.inputs[7].default_value = (1, 1, 1, 1)
    else:
        mul.inputs[7].default_value = (1, 1, 1, 1)
    nt.links.new(mul.outputs[2], b.inputs['Base Color'])
    return m


def sls_materials():
    return {
        'core':      band_mat('SLS_core_orange_foam', '#c8792f', rough=0.75, noise=0.12, noise_scale=3.0,
                              bands=[(5.0, 12.6, '#2b2b2c'), (12.6, 22.0, '#bd6a2b'),
                                     (92.0, 105.5, '#d38d48'), (126.0, 129.0, '#d08a45'),
                                     (131.5, 134.0, '#d08a45')],
                              checker_bands=[(129.0, 131.5)]),
        'booster_b': band_mat('SLS_booster_white_bands', '#ecebe6', rough=0.55, noise=0.05, noise_scale=2.0,
                              bands=[(5.0, 15.5, '#e2e0da')] + [(zj - 0.3, zj + 0.3, '#1c1c1c')
                                                                for zj in (30.0, 46.5, 62.5, 78.5)],
                              checker_bands=[(100.5, 102.5)]),
        'upper':     band_mat('SLS_upper_stack', '#f2f1ee', rough=0.45,
                              bands=[(130.0, 146.0, '#c8792f'), (156.0, 159.0, '#c9cbcd'),
                                     (183.0, 188.5, '#2c2d30'), (194.0, 196.5, '#2c2d30')],
                              checker_bands=[(160.5, 162.0)]),
        'intertank': mat('SLS_intertank_foam', '#d08a45', rough=0.8, noise=0.15, noise_scale=6.0),
        'fwd_skirt': mat('SLS_forward_skirt_foam', '#cf8642', rough=0.8, noise=0.1, noise_scale=6.0),
        'feedline':  mat('SLS_feedline_foam', '#c0692b', rough=0.75),
        'engine_sec':mat('SLS_engine_section', '#bd6a2b', rough=0.8, noise=0.2, noise_scale=4.0),
        'heatshield':mat('SLS_base_heatshield', '#2b2b2c', rough=0.9),
        'rs25':      mat('SLS_RS25_nozzle', '#9a9a98', rough=0.35, metal=0.8),
        'booster':   mat('SLS_booster_white', '#ecebe6', rough=0.55, noise=0.05, noise_scale=2.0),
        'boost_band':mat('SLS_booster_joint_black', '#1c1c1c', rough=0.6),
        'checker':   checker_mat('SLS_roll_target_checker'),
        'boost_aft': mat('SLS_booster_aft_skirt', '#e4e2dc', rough=0.6, noise=0.1, noise_scale=3.0),
        'lvsa':      mat('SLS_LVSA_orange_foam', '#c8792f', rough=0.75, noise=0.12, noise_scale=3.0),
        'icps':      mat('SLS_ICPS_white', '#eceae5', rough=0.5),
        'osa':       mat('SLS_OSA_silver', '#c9cbcd', rough=0.4, metal=0.3),
        'saj':       mat('SLS_Orion_fairing', '#efefec', rough=0.45),
        'las':       mat('SLS_LAS_white', '#f2f1ee', rough=0.45),
        'las_dark':  mat('SLS_LAS_nozzles', '#2c2d30', rough=0.5, metal=0.4),
        'bracket':   mat('SLS_bracket_grey', '#8a8a88', rough=0.5, metal=0.5),
    }


def build_sls(coll):
    objs = import_glb('sls', coll)
    o = [x for x in objs if x.type == 'MESH'][0]
    o.name = 'SLS_Block1'
    o.data.materials.clear()
    SLS_COL = sls_materials()
    keys = list(SLS_COL.keys())
    for k in keys:
        o.data.materials.append(SLS_COL[k])
    K = {k: i for i, k in enumerate(keys)}
    me = o.data
    # --- loose-part ids via numpy union-find on edges
    nv = len(me.vertices)
    ev = np.zeros(len(me.edges) * 2, np.int64)
    me.edges.foreach_get('vertices', ev)
    ev = ev.reshape(-1, 2)
    parent = np.arange(nv)

    def find_all(p):
        while True:
            q = p[p]
            if np.array_equal(q, p):
                return p
            p = q
    # iterative label propagation (min label across edges)
    lab = np.arange(nv)
    for _ in range(400):
        a = np.minimum(lab[ev[:, 0]], lab[ev[:, 1]])
        old = lab.copy()
        np.minimum.at(lab, ev[:, 0], a)
        np.minimum.at(lab, ev[:, 1], a)
        lab = lab[lab]
        if np.array_equal(old, lab):
            break
    co = np.zeros(nv * 3)
    me.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    # per-part bbox
    parts = {}
    for l in np.unique(lab):
        m = lab == l
        p = co[m]
        parts[l] = (m.sum(), p.min(0), p.max(0))
    # polygon -> part
    npoly = len(me.polygons)
    lt = np.zeros(npoly, np.int64)
    me.polygons.foreach_get('loop_start', lt)
    lv = np.zeros(len(me.loops), np.int64)
    me.loops.foreach_get('vertex_index', lv)
    pv = lv[lt]                       # first vertex of each polygon
    plab = lab[pv]
    pc = np.zeros(npoly * 3)
    me.polygons.foreach_get('center', pc)
    pc = pc.reshape(-1, 3)
    pz = pc[:, 2]
    pr = np.hypot(pc[:, 0], pc[:, 1])
    midx = np.full(npoly, K['bracket'])
    delete_parts = []
    for l, (n, mn, mx) in parts.items():
        sel = plab == l
        size = mx - mn
        cx = (mn[0] + mx[0]) / 2
        if n <= 8 and mx[2] < 5.5:                     # STL print stand
            delete_parts.append(l)
            continue
        # colour bands are done in the shaders (object-space Z): the STL has long thin
        # triangles, so per-face colouring would give jagged edges.
        if n > 30000 and abs(cx) < 1 and mx[2] < 140:   # core stage (+ engine section)
            midx[sel] = K['core']
        elif n > 5000 and abs(cx) > 5:                  # boosters
            midx[sel] = K['booster_b']
        elif n > 5000 and mn[2] > 130:                  # LVSA + ICPS + OSA + Orion fairing + LAS
            midx[sel] = K['upper']
        elif n == 499:                                   # RS-25 engines
            midx[sel] = K['rs25']
        elif n in (24,):                                 # booster systems tunnel
            midx[sel] = K['booster']
        elif size[2] > 60:                               # LOX feedlines / tunnel on core
            midx[sel] = K['feedline']
        elif n == 156:
            midx[sel] = K['feedline']
        else:
            midx[sel] = K['bracket']
    me.polygons.foreach_set('material_index', midx)
    me.update()
    # delete print stand
    if delete_parts:
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.verts.ensure_lookup_table()
        dl = set(np.where(np.isin(lab, delete_parts))[0].tolist())
        bmesh.ops.delete(bm, geom=[bm.verts[i] for i in dl], context='VERTS')
        bm.to_mesh(me)
        bm.free()
    # smooth-ish shading for the big cylinders
    for p in me.polygons:
        p.use_smooth = True
    try:
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.shade_auto_smooth(angle=math.radians(35))
    except Exception:
        try:
            o.modifiers.new('ws', 'WEIGHTED_NORMAL')
        except Exception:
            pass
    # place: model -> metres, boosters along world Y, bottom at z=0 (local)
    o.matrix_world = (Matrix.Rotation(math.radians(90), 4, 'Z') @
                      Matrix.Diagonal((SLS_SCALE,) * 3 + (1,)) @
                      Matrix.Translation((0, 0.1, -SLS_MODEL_BASE_Z)))
    return o


# ----------------------------------------------------------------------------
# Mobile Launcher
# ----------------------------------------------------------------------------
def ml_materials(o):
    """Keep NASA texture detail but lift it to a painted-steel grey.
    Real ML-1 (Artemis I photos): pale grey lattice tower, dark charcoal base."""
    me = o.data
    base_src = o.material_slots[0].material
    dark = base_src.copy()
    dark.name = 'ML_base_charcoal'
    me.materials.append(dark)
    di = len(me.materials) - 1
    n = len(me.polygons)
    pc = np.zeros(n * 3)
    me.polygons.foreach_get('center', pc)
    pc = pc.reshape(-1, 3) * 0.01           # mesh units are cm of the model
    mi = np.zeros(n, np.int64)
    me.polygons.foreach_get('material_index', mi)
    in_tower = (pc[:, 0] > 0.28) & (pc[:, 0] < 0.58) & (np.abs(pc[:, 1]) < 0.20)
    base = (pc[:, 2] < 0.335) & ~(in_tower & (pc[:, 2] > 0.30)) & (mi == 0)
    mi[base] = di
    me.polygons.foreach_set('material_index', mi)
    for slot in o.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if not b:
            continue
        b.inputs['Metallic'].default_value = 0.25
        b.inputs['Roughness'].default_value = 0.6
        if b.inputs['Base Color'].is_linked:
            src = b.inputs['Base Color'].links[0].from_socket
            mix = nt.nodes.new('ShaderNodeMix')
            mix.data_type = 'RGBA'
            mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1.0
            nt.links.new(src, mix.inputs[6])
            is_base = m.name == 'ML_base_charcoal'
            mix.inputs[7].default_value = srgb('#55575a') if is_base else srgb('#e3eae4')
            br = nt.nodes.new('ShaderNodeBrightContrast')
            br.inputs['Bright'].default_value = 0.0 if is_base else 0.10
            br.inputs['Contrast'].default_value = -0.10
            nt.links.new(mix.outputs[2], br.inputs['Color'])
            hsv = nt.nodes.new('ShaderNodeHueSaturation')
            hsv.inputs['Saturation'].default_value = 0.35
            hsv.inputs['Value'].default_value = 1.0 if is_base else 1.9
            nt.links.new(br.outputs[0], hsv.inputs['Color'])
            nt.links.new(hsv.outputs[0], b.inputs['Base Color'])
        else:
            b.inputs['Base Color'].default_value = srgb('#8c9096')


def build_ml(coll):
    objs = import_glb('mobile-launcher', coll)
    o = [x for x in objs if x.type == 'MESH'][0]
    o.name = 'Mobile_Launcher'
    o.animation_data_clear()
    for x in objs:
        if x is not o and x.type == 'EMPTY':
            bpy.data.objects.remove(x)
    o.rotation_euler = (0, 0, 0)
    o.scale = (ML_SCALE * 0.01,) * 3     # glTF import already had 0.01
    o.location = (-ML_HOLE_MODEL_XY[0] * ML_SCALE, -ML_HOLE_MODEL_XY[1] * ML_SCALE, 0)
    ml_materials(o)
    bpy.context.view_layer.update()
    # deck height by ray cast next to the exhaust hole
    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(o, dg)
    inv = o.matrix_world.inverted()
    hits = []
    for (x, y) in [(-12, 14), (-12, -14), (-14, 0), (8, 14)]:
        p = inv @ Vector((x, y, 60))
        d = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
        h = bvh.ray_cast(p, d)
        if h[0] is not None:
            hits.append((o.matrix_world @ h[0]).z)
    deck = float(np.median(hits)) if hits else 0.31 * ML_SCALE
    return o, deck


# ----------------------------------------------------------------------------
# Pad 39B environment
# ----------------------------------------------------------------------------
def lattice_tower(coll, name, loc, height, base_w, top_w, mat_):
    bm = bmesh.new()
    segs = max(6, int(height / 14))
    rings = []
    for i in range(segs + 1):
        t = i / segs
        z = t * height
        w = (base_w * (1 - t) + top_w * t) / 2
        ring = [bm.verts.new((sx * w, sy * w, z)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        rings.append(ring)
    for i in range(segs):
        a, b = rings[i], rings[i + 1]
        for k in range(4):
            bm.edges.new((a[k], b[k]))           # legs
            bm.edges.new((a[k], a[(k + 1) % 4]))  # horizontals
            bm.edges.new((a[k], b[(k + 1) % 4]))  # diagonals
            bm.edges.new((b[k], a[(k + 1) % 4]))
    for k in range(4):
        bm.edges.new((rings[-1][k], rings[-1][(k + 1) % 4]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.location = loc
    sk = o.modifiers.new('skin', 'SKIN')
    for v in me.skin_vertices[0].data:
        v.radius = (0.35, 0.35)
    o.data.materials.append(mat_)
    return o


def catenary(coll, name, p0, p1, sag, mat_, r=0.12):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 1
    sp = cu.splines.new('POLY')
    n = 24
    sp.points.add(n - 1)
    p0, p1 = Vector(p0), Vector(p1)
    for i in range(n):
        t = i / (n - 1)
        p = p0.lerp(p1, t)
        p.z -= sag * 4 * t * (1 - t)
        sp.points[i].co = (*p, 1)
    o = bpy.data.objects.new(name, cu)
    o.data.materials.append(mat_)
    coll.objects.link(o)
    return o


def water_tower(coll, loc, mat_leg, mat_tank):
    """Pad 39B sound-suppression water tower (~290 ft / 88 m, 400,000 gal = 1,514 m3).
    Simplified: tank = spheroid r 7.8 m x 0.78 -> ~1,550 m3."""
    objs = []
    h_leg = 74.0
    for k in range(6):
        a = k / 6 * 2 * math.pi
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.6, depth=h_leg,
                                            location=(loc[0] + 5.5 * math.cos(a), loc[1] + 5.5 * math.sin(a), loc[2] + h_leg / 2))
        objs.append(bpy.context.object)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=1.6, depth=h_leg, location=(loc[0], loc[1], loc[2] + h_leg / 2))
    objs.append(bpy.context.object)
    for o in objs:
        o.data.materials.append(mat_leg)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=7.8, location=(loc[0], loc[1], loc[2] + h_leg + 5.5))
    t = bpy.context.object
    t.scale = (1, 1, 0.78)
    t.data.materials.append(mat_tank)
    bpy.ops.object.shade_smooth()
    objs.append(t)
    for o in objs:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
        o.name = 'WaterTower_part'
    return objs


def cloud_layer(coll, name, z, size, col_lo, col_hi, strength=1.2, coverage=0.52, scale=2.5,
                center=(0, 0), stretch=(1.0, 3.0)):
    """Cheap dusk clouds: emissive+transparent plane high in the sky (no volumes)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=(center[0], center[1], z))
    o = bpy.context.object
    o.name = name
    o.scale = (size, size, 1)
    for c in list(o.users_collection):
        c.objects.unlink(o)
    coll.objects.link(o)
    m = bpy.data.materials.new(name + '_mat')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (scale * stretch[0], scale * stretch[1], 1)
    nt.links.new(tc.outputs['Generated'], mp.inputs['Vector'])
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Detail'].default_value = 8.0
    nz.inputs['Roughness'].default_value = 0.62
    nz.inputs['Scale'].default_value = 3.0
    nt.links.new(mp.outputs[0], nz.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = coverage
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = min(0.99, coverage + 0.16)
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac'])
    # colour varies across the layer (gradient along X: towards the sun = warmer)
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    cr = nt.nodes.new('ShaderNodeValToRGB')
    cr.color_ramp.elements[0].color = srgb(col_lo)
    cr.color_ramp.elements[1].color = srgb(col_hi)
    nt.links.new(sep.outputs['X'], cr.inputs['Fac'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = strength
    nt.links.new(cr.outputs['Color'], em.inputs['Color'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(ramp.outputs['Color'], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    o.data.materials.append(m)
    o.visible_shadow = False
    o.visible_diffuse = False
    o.visible_glossy = False
    return o


def tree_rings(coll, gz):
    """Far Florida tree line around the pad (simple height-varied ring meshes)."""
    rng = np.random.default_rng(3)
    m = mat('PAD_treeline', '#2f3d24', rough=0.95, noise=0.3, noise_scale=0.02)
    for k, (R, hmin, hmax) in enumerate(((900, 6, 16), (1500, 8, 22), (2600, 10, 28))):
        n = 1440
        th = np.linspace(0, 2 * np.pi, n, endpoint=False)
        h = hmin + (hmax - hmin) * np.clip(
            0.5 + 0.25 * np.sin(th * 37 + k) + 0.25 * np.sin(th * 113 + 2 * k) + rng.normal(0, 0.18, n), 0, 1)
        verts = []
        for i in range(n):
            x, y = R * np.cos(th[i]), R * np.sin(th[i])
            verts.append((x, y, gz - 1))
            verts.append((x, y, gz + h[i]))
        faces = [(2 * i, 2 * ((i + 1) % n), 2 * ((i + 1) % n) + 1, 2 * i + 1) for i in range(n)]
        me = bpy.data.meshes.new(f'Treeline_{k}')
        me.from_pydata(verts, [], faces)
        o = bpy.data.objects.new(f'Treeline_{k}', me)
        o.data.materials.append(m)
        coll.objects.link(o)


def steam_volume(coll, name, loc, size, density=0.06, noise_scale=1.6, rot_z=0.0,
                 color='#f4efe9'):
    """Soft venting vapour: cube + Principled Volume (noise * spherical falloff)."""
    bpy.ops.mesh.primitive_cube_add(size=2, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    o.rotation_euler.z = rot_z
    for c in list(o.users_collection):
        c.objects.unlink(o)
    coll.objects.link(o)
    m = bpy.data.materials.new(name + '_vol')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = srgb(color)
    vol.inputs['Anisotropy'].default_value = 0.25
    vol.inputs['Emission Color'].default_value = srgb('#ffe6cf')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    gr = nt.nodes.new('ShaderNodeTexGradient')
    gr.gradient_type = 'SPHERICAL'
    nt.links.new(tc.outputs['Object'], gr.inputs['Vector'])
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = noise_scale
    nz.inputs['Detail'].default_value = 6.0
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    r1 = nt.nodes.new('ShaderNodeValToRGB')
    r1.color_ramp.elements[0].position = 0.42
    r1.color_ramp.elements[1].position = 0.75
    nt.links.new(nz.outputs['Fac'], r1.inputs['Fac'])
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    nt.links.new(gr.outputs['Fac'], mul.inputs[0])
    nt.links.new(r1.outputs['Color'], mul.inputs[1])
    mul2 = nt.nodes.new('ShaderNodeMath')
    mul2.operation = 'MULTIPLY'
    mul2.inputs[1].default_value = density
    nt.links.new(mul.outputs[0], mul2.inputs[0])
    nt.links.new(mul2.outputs[0], vol.inputs['Density'])
    em = nt.nodes.new('ShaderNodeMath')
    em.operation = 'MULTIPLY'
    em.inputs[1].default_value = 0.6      # faint self-glow: reads as white vapour, not smoke
    nt.links.new(mul.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], vol.inputs['Emission Strength'])
    nt.links.new(vol.outputs[0], out.inputs['Volume'])
    o.data.materials.append(m)
    return o


def build_pad(sc):
    root = sc.collection
    c_rk = link_coll(sc, 'PAD_rocket')
    c_env = link_coll(sc, 'PAD_environment')
    c_cam = link_coll(sc, 'PAD_cameras')
    ml, deck = build_ml(c_rk)
    sls = build_sls(c_rk)
    post = 1.5   # 8 vehicle support posts, 5 ft tall (ML-1 fact sheet)
    sls.matrix_world = Matrix.Translation((0, 0, deck + post)) @ sls.matrix_world
    # ground: pad concrete + Florida grass + ocean to the east (+X)
    m_conc = mat('PAD_concrete', '#a49d90', rough=0.85, noise=0.25, noise_scale=0.08)
    m_grass = mat('PAD_grass', '#56683a', rough=0.95, noise=0.35, noise_scale=0.004)
    m_sea = mat('PAD_ocean', '#3c5a74', rough=0.08)
    m_trench = mat('PAD_flame_trench', '#2a2826', rough=0.9)
    GZ = -13.0     # surrounding marsh/grass level; the pad top is z=0
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, GZ))
    g = bpy.context.object
    g.name = 'Ground_grass'
    g.scale = (6000, 6000, 1)
    g.data.materials.append(m_grass)
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=190, radius2=125, depth=13.5,
                                    location=(0, 0, GZ + 13.5 / 2 - 0.25))
    pad = bpy.context.object
    pad.name = 'Pad_hardstand_mound'
    pad.rotation_euler.z = math.radians(22.5)
    pad.data.materials.append(m_conc)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.52))
    tr = bpy.context.object
    tr.name = 'Flame_trench_shadow'
    tr.scale = (14, 60, 1)
    tr.data.materials.append(m_trench)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(4500, 0, GZ + 0.3))
    sea = bpy.context.object
    sea.name = 'Atlantic'
    sea.scale = (6000, 12000, 1)
    sea.data.materials.append(m_sea)
    for o in (g, pad, tr, sea):
        for c in list(o.users_collection):
            c.objects.unlink(o)
        c_env.objects.link(o)
    # lightning protection: three ~600 ft towers + catenary wires
    m_tw = mat('PAD_lightning_tower', '#b5b3ad', rough=0.6, metal=0.3)
    m_wire = mat('PAD_wire', '#3a3a3a', rough=0.5, metal=0.6)
    H = 181.0   # ~594-600 ft lightning towers
    tpos = []
    for k, ang in enumerate((20, 140, 260)):
        a = math.radians(ang)
        p = (230 * math.cos(a), 230 * math.sin(a), GZ)
        tpos.append(Vector((p[0], p[1], H + GZ)))
        lattice_tower(c_env, f'Lightning_tower_{k}', p, H, 9.0, 2.5, m_tw)
    for i in range(3):
        catenary(c_env, f'Catenary_{i}', tpos[i], tpos[(i + 1) % 3], 35, m_wire)
        # ground anchors outward
        out = Vector((tpos[i].x, tpos[i].y, 0)).normalized() * 420
        catenary(c_env, f'Anchor_{i}', tpos[i], (out.x, out.y, GZ), 15, m_wire)
    # water tower (sound suppression), north-east of the pad
    water_tower(c_env, (150, 300, GZ), mat('PAD_wt_leg', '#c9c6be', rough=0.6),
                mat('PAD_wt_tank', '#eceae4', rough=0.4))
    # light + sky: dawn
    sc.world = sky_world('Yer_dusk_sky', sun_elev_deg=4.0, sun_rot_deg=-60.0, strength=0.35, dust=2.0)
    sun_lamp(c_env, 'Sun_dusk', 6.0, -60.0, energy=4.0, color='#ffb878', angle_deg=0.8)
    # a little cryogenic venting: vapour rolling off the core stage + low steam at the base
    c_fx = link_coll(sc, 'PAD_steam')
    steam_volume(c_fx, 'Steam_base', (-6, -22, deck + 3), (34, 14, 8), density=0.4, noise_scale=1.2)
    steam_volume(c_fx, 'Steam_vent_core', (-7.5, -2.0, deck + 1.5 + 60), (4.5, 4.5, 12), density=0.9,
                 noise_scale=1.8)
    # dusk clouds (pink/orange, warmer towards the sun in the west)
    cl = cloud_layer(c_env, 'Clouds_dusk', 1800, 16000, '#ffb98f', '#f29fb4', strength=1.15,
                     coverage=0.5, scale=3.0, stretch=(1.0, 1.7))
    tree_rings(c_env, GZ)
    cl.rotation_euler.z = math.radians(-60 + 90)
    # cameras
    add_cam(sc, c_cam, 'CAM_pad_wide', (-200, -175, 14), (0, 12, 55), lens=30)
    # same angle as NASA photo KSC-20220323-PH-JBS01_0012 (tower left, one booster in front)
    add_cam(sc, c_cam, 'CAM_pad_ref', (-25, 720, -6), (0, 0, 60), lens=110)
    add_cam(sc, c_cam, 'CAM_pad_low', (-95, -120, 3), (0, 0, 60), lens=22)
    sc.camera = bpy.data.objects['CAM_pad_wide']
    set_render(sc, exposure=-0.6)
    return sls, ml, deck


# ----------------------------------------------------------------------------
# ----------------------------------------------------------------------------
# Mission Control "Houston" (historic Apollo MOCR, Johnson Space Center)
# ----------------------------------------------------------------------------
def make_image(name, arr):
    """numpy HxWx3/4 float (0..1, sRGB) -> packed Blender image"""
    h, w = arr.shape[:2]
    if arr.shape[2] == 3:
        arr = np.concatenate([arr, np.ones((h, w, 1), np.float32)], 2)
    img = bpy.data.images.get(name)
    if img:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).astype(np.float32).ravel())
    img.pack()
    return img


def trajectory_screen_image(W=1536, H=576):
    """Big front-wall screen: Earth -> Moon free-return path (no text)."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    img = np.zeros((H, W, 3), np.float32)
    img[:] = (0.03, 0.07, 0.16)
    # grid
    g = ((x % 64) < 2) | ((y % 64) < 2)
    img[g] = (0.07, 0.16, 0.30)
    # stars
    rng = np.random.default_rng(7)
    sx, sy = rng.integers(0, W, 260), rng.integers(0, H, 260)
    img[sy, sx] = (0.7, 0.75, 0.9)
    def disc(cx, cy, r, col, soft=2.0):
        d = np.hypot(x - cx, y - cy)
        a = np.clip((r - d) / soft, 0, 1)[..., None]
        img[:] = img * (1 - a) + np.array(col, np.float32) * a
        return d
    ex, ey, er = 250, H / 2, 150
    # moon (right)
    mx_, my_, mr = 1330, H / 2 - 20, 48
    dm = disc(mx_, my_, mr, (0.62, 0.62, 0.60))
    cr = (dm < mr - 3) & ((np.sin(x * 0.21) * np.sin(y * 0.19)) > 0.75)
    img[cr] = (0.55, 0.55, 0.54)
    # figure-8 free-return path (dashed, warm yellow)
    t = np.linspace(0, 2 * np.pi, 4000)
    px = (ex + mx_) / 2 + ((mx_ - ex) / 2 + 40) * np.cos(t) * 1.0
    py = H / 2 + 150 * np.sin(2 * t) * 0.9 * np.cos(t) ** 0 * 0.6
    px = (ex + mx_) / 2 - ((mx_ - ex) / 2 + 30) * np.cos(t)
    py = H / 2 - 20 + 160 * np.sin(t) * np.cos(t) * 2 * 0.6
    keep = (np.floor(t / (2 * np.pi) * 120) % 2) == 0
    for X, Y in zip(px[keep].astype(int), py[keep].astype(int)):
        img[max(0, Y - 5):Y + 5, max(0, X - 5):X + 5] = (1.0, 0.70, 0.10)
    # earth (left) with simple continents from noise
    d = disc(ex, ey, er, (0.05, 0.25, 0.80))
    n = (np.sin(x * 0.045) * np.cos(y * 0.06) + np.sin((x + y) * 0.03) * 0.8)
    land = (d < er - 2) & (n > 0.55)
    img[land] = (0.15, 0.55, 0.18)
    glow = np.clip(1 - np.abs(d - er) / 10, 0, 1)[..., None] * 0.5
    img[:] = img + glow * np.array((0.35, 0.6, 1.0), np.float32)
    # little capsule marker on the path
    k = 1250
    disc(px[k], py[k], 14, (1.0, 0.45, 0.2))
    disc(px[k], py[k], 6, (1.0, 0.95, 0.8))
    return np.clip(img, 0, 1)


def console_screen_image(W=512, H=256):
    """Small CRT pattern: wave + bars, green."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    img = np.zeros((H, W, 3), np.float32)
    img[:] = (0.02, 0.07, 0.04)
    wave = np.abs(y - (H * 0.35 + 30 * np.sin(x / 23.0) * np.cos(x / 61.0))) < 2.2
    img[wave] = (0.45, 1.0, 0.55)
    for i in range(10):
        bh = int(H * (0.12 + 0.3 * ((i * 37) % 10) / 10))
        img[H - 12 - bh:H - 12, 30 + i * 46:30 + i * 46 + 26] = (0.25, 0.85, 0.4) if i % 3 else (0.95, 0.75, 0.25)
    rows = ((y % 6) < 1)
    img[rows] *= 0.6
    return img


def emis_image_mat(name, img, strength=2.0, base='#101418', mapping='UV', scale=(1, 1, 1)):
    if img is None and bpy.data.materials.get(name):
        return bpy.data.materials[name]
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    b.inputs['Base Color'].default_value = srgb(base)
    b.inputs['Roughness'].default_value = 0.25
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.extension = 'REPEAT' if mapping != 'UV' else 'EXTEND'
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = scale
    nt.links.new(tc.outputs[mapping], mp.inputs['Vector'])
    nt.links.new(mp.outputs[0], tex.inputs['Vector'])
    nt.links.new(tex.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = strength
    nt.links.new(b.outputs[0], out.inputs[0])
    return m


def button_panel_mat(name):
    """Dark console face with random little lit buttons (procedural)."""
    m = mat(name, '#2d3236', rough=0.4)
    nt = m.node_tree
    b = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 28.0
    nt.links.new(tc.outputs['Object'], vor.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.0, srgb('#ff5a3c')
    el[1].position, el[1].color = 1.0, srgb('#7dff9e')
    e2 = el.new(0.35); e2.color = srgb('#ffcf4a')
    e3 = el.new(0.7); e3.color = srgb('#e8f4ff')
    nt.links.new(vor.outputs['Color'], ramp.inputs['Fac'])
    # only ~1 in 6 cells lit: threshold on the cell's random value (Color.r)
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(vor.outputs['Color'], sep.inputs[0])
    gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'GREATER_THAN'
    gt.inputs[1].default_value = 0.82
    nt.links.new(sep.outputs[1], gt.inputs[0])
    small = nt.nodes.new('ShaderNodeMath'); small.operation = 'LESS_THAN'
    small.inputs[1].default_value = 0.18
    nt.links.new(vor.outputs['Distance'], small.inputs[0])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
    nt.links.new(gt.outputs[0], mul.inputs[0]); nt.links.new(small.outputs[0], mul.inputs[1])
    mul2 = nt.nodes.new('ShaderNodeMath'); mul2.operation = 'MULTIPLY'
    mul2.inputs[1].default_value = 4.0
    nt.links.new(mul.outputs[0], mul2.inputs[0])
    nt.links.new(ramp.outputs['Color'], b.inputs['Emission Color'])
    nt.links.new(mul2.outputs[0], b.inputs['Emission Strength'])
    return m


def timer_panel_image(W=1024, H=128, col=(1.0, 0.62, 0.18)):
    """Row of abstract 7-segment style blocks (no real text) like the MOCR clocks."""
    img = np.zeros((H, W, 3), np.float32)
    img[:] = (0.02, 0.02, 0.025)
    rng = np.random.default_rng(11)
    x = 40
    while x < W - 60:
        for g in range(int(rng.integers(2, 4))):
            # real 7-segment digits only (clock numbers, no letters)
            DIG = ['1110111', '0000101', '1101011', '1111001', '0101101', '1011101', '1011111',
                   '1001001', '1111111', '1111101']   # order: top, mid, bottom, ul, ur, ll, lr
            segs = [int(ch) for ch in DIG[int(rng.integers(0, 10))]]
            w, h, t = 34, 70, 7
            y0 = (H - h) // 2
            boxes = [(x, y0, w, t), (x, y0 + h // 2 - t // 2, w, t), (x, y0 + h - t, w, t),
                     (x, y0, t, h // 2), (x + w - t, y0, t, h // 2),
                     (x, y0 + h // 2, t, h // 2), (x + w - t, y0 + h // 2, t, h // 2)]
            for on, (bx, by, bw, bh) in zip(segs, boxes):
                if on:
                    img[by:by + bh, bx:bx + bw] = col
            x += w + 14
        img[H // 2 - 14:H // 2 - 6, x:x + 7] = col
        img[H // 2 + 6:H // 2 + 14, x:x + 7] = col
        x += 30
    return img


def set_planar_uv(obj, mat_names, axes=(0, 2), flip_u=False):
    """UVs from world position for faces of the given materials (per material bbox)."""
    me = obj.data
    if not me.uv_layers:
        me.uv_layers.new(name='UVMap')
    uv = me.uv_layers.active.data
    mw = obj.matrix_world
    names = [m.name if m else '' for m in me.materials]
    for mn in mat_names:
        idx = [i for i, n in enumerate(names) if n.split('.')[0] == mn]
        polys = [p for p in me.polygons if p.material_index in idx]
        if not polys:
            continue
        pts = [mw @ me.vertices[v].co for p in polys for v in p.vertices]
        lo = [min(pt[a] for pt in pts) for a in axes]
        hi = [max(pt[a] for pt in pts) for a in axes]
        for p in polys:
            for li in p.loop_indices:
                co = mw @ me.vertices[me.loops[li].vertex_index].co
                u = (co[axes[0]] - lo[0]) / max(1e-6, hi[0] - lo[0])
                v = (co[axes[1]] - lo[1]) / max(1e-6, hi[1] - lo[1])
                uv[li].uv = (1 - u if flip_u else u, v)


def build_mcc(sc):
    c = link_coll(sc, 'MCC_room')
    c_l = link_coll(sc, 'MCC_lights')
    c_cam = link_coll(sc, 'MCC_cameras')
    objs = import_glb('mission-control', c)
    room = [o for o in objs if o.type == 'MESH'][0]
    room.name = 'MissionControl_MOCR'
    big = make_image('mcc_trajectory_screen', trajectory_screen_image())
    crt = make_image('mcc_console_crt', console_screen_image())
    M = {
        'Keyboards': mat('MCC_keyboard', '#3b3f44', rough=0.5),
        'keyboard_special': mat('MCC_keyboard_special', '#59616a', rough=0.5),
        'console_body': mat('MCC_console_body', '#7e9796', rough=0.55),
        'console_back': mat('MCC_console_back', '#6c8282', rough=0.6),
        'console_desk': mat('MCC_console_desk', '#cfc6b4', rough=0.45),
        'console_face': button_panel_mat('MCC_console_face_buttons'),
        'crstation_1': mat('MCC_crstation', '#5e666c', rough=0.5),
        'crstation_2': mat('MCC_crstation', '#5e666c', rough=0.5),
        'screens': emis_image_mat('MCC_console_crt', crt, strength=2.2, mapping='Object', scale=(3, 3, 3)),
        'screen': emis_image_mat('MCC_big_screen', big, strength=1.25, mapping='UV'),
        'wall_screen': mat('MCC_screen_wall', '#232a33', rough=0.7),
        'mid': emis_image_mat('MCC_timer_amber', make_image('mcc_timer_amber', timer_panel_image()), strength=2.5),
        'midle': emis_image_mat('MCC_timer_green', make_image('mcc_timer_green', timer_panel_image(col=(0.45, 1.0, 0.55))), strength=2.5),
        'right': emis_image_mat('MCC_timer_amber', None, strength=2.5),
        'edge': emis_image_mat('MCC_timer_amber', None, strength=2.5),
        'far_right': emis_image_mat('MCC_timer_green', None, strength=2.5),
        'cabnet': mat('MCC_cabinet', '#8f7e68', rough=0.6),
        'ceiling': mat('MCC_ceiling', '#6d645a', rough=0.9),
        'lights': mat('MCC_ceiling_light', '#fff4e0', emit='#ffe2b8', emit_strength=6.0),
        'floor': mat('MCC_carpet', '#6a5040', rough=0.95, noise=0.15, noise_scale=40),
        'wall': mat('MCC_wall', '#b9a687', rough=0.8),
        'wall_top': mat('MCC_wall_top', '#a99a80', rough=0.8),
        'projector1': mat('MCC_projector', '#4b4f55', rough=0.5),
    }
    plaque = mat('MCC_wall_plaque', '#2f4166', rough=0.4)
    frame_gold = mat('MCC_plaque_frame', '#b8954f', rough=0.35, metal=0.8)
    nameplate = mat('MCC_nameplate_blank', '#1e2428', rough=0.4)
    # the screen faces have no usable UVs -> project from world X/Z (screens face -Y)
    set_planar_uv(room, ['screen'], axes=(0, 2))
    for nm in ('mid', 'midle', 'right', 'edge', 'far_right'):
        set_planar_uv(room, [nm], axes=(0, 2))
    for slot in room.material_slots:
        n = slot.material.name if slot.material else ''
        base = n.split('.')[0]
        if base in M:
            slot.material = M[base]
        elif base.startswith('picture'):
            slot.material = plaque      # wall plaques (no patches / lettering)
        elif base.startswith('console_name'):
            slot.material = nameplate   # blank nameplates (no lettering)

    # light: warm area lights under the ceiling + soft fill from the big screen
    for i, (x, y) in enumerate([(-6.5, -6), (-2.5, -6), (1.8, -6), (-6.5, 1), (-2.5, 1), (1.8, 1), (-2.5, -12)]):
        ld = bpy.data.lights.new(f'MCC_ceiling_area_{i}', 'AREA')
        ld.shape = 'RECTANGLE'
        ld.size, ld.size_y = 3.0, 2.0
        ld.energy = 420
        ld.color = srgb('#ffd9a8')[:3]
        lo = bpy.data.objects.new(ld.name, ld)
        c_l.objects.link(lo)
        lo.location = (x, y, 5.6)
    ld = bpy.data.lights.new('MCC_screen_glow', 'AREA')
    ld.size, ld.size_y = 9.0, 3.4
    ld.shape = 'RECTANGLE'
    ld.energy = 350
    ld.color = srgb('#7fb2ff')[:3]
    lo = bpy.data.objects.new(ld.name, ld)
    c_l.objects.link(lo)
    lo.location = (-3.15, 8.4, 2.9)
    lo.rotation_euler = (math.radians(90), 0, 0)   # facing -Y into the room
    # world: dim warm
    w = bpy.data.worlds.new('MCC_world')
    w.use_nodes = True
    w.node_tree.nodes.clear()
    o = w.node_tree.nodes.new('ShaderNodeOutputWorld')
    bg = w.node_tree.nodes.new('ShaderNodeBackground')
    bg.inputs[0].default_value = srgb('#30261d')
    bg.inputs[1].default_value = 0.3
    w.node_tree.links.new(bg.outputs[0], o.inputs[0])
    sc.world = w
    # camera: standing at the back (floor height by ray cast), looking at the big screen
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    bvh = BVHTree.FromObject(room, dg)
    inv = room.matrix_world.inverted()
    def floor_z(x, y):
        p = inv @ Vector((x, y, 5.5))
        d = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
        h = bvh.ray_cast(p, d)
        return (room.matrix_world @ h[0]).z if h[0] is not None else 0.0
    # the main floor is z=0 for y in -10.3..8.7; a raised viewing room sits behind
    # the glass wall at y=-7.3 (z>2.4).  Cameras float just in front of that glass.
    fz, fz2 = floor_z(-2.6, -6.9), floor_z(3.9, -6.9)
    add_cam(sc, c_cam, 'CAM_mcc_back', (-2.6, -6.95, 3.3), (-3.0, 8.6, 1.9), lens=20)
    add_cam(sc, c_cam, 'CAM_mcc_corner', (3.95, -6.95, 3.2), (-4.5, 6.0, 1.0), lens=18)
    sc.camera = bpy.data.objects['CAM_mcc_back']
    set_render(sc, exposure=0.0)
    print('MCC floor at camera', fz, fz2)


# ----------------------------------------------------------------------------
# DSN 34 m beam-waveguide antenna at sunset (Goldstone-like desert)
# ----------------------------------------------------------------------------
def calc_world(o):
    """world matrix from the parent chain (no depsgraph needed)"""
    m = o.matrix_basis.copy()
    while o.parent:
        m = o.matrix_parent_inverse @ m
        o = o.parent
        m = o.matrix_basis @ m
    return m


def build_dsn_antenna(coll, point_dir=(0.7, -0.4, 0.6), loc=(0, 0, 0)):
    """Import the DSN 34 m antenna and aim the dish boresight along point_dir
    (azimuth about Z on 'azimuth', elevation about local X on 'elevation')."""
    objs = import_glb('dsn-34m', coll)
    by = {o.name.split('.')[0]: o for o in objs}
    root = by['_root']
    root.hide_render = True          # helper box of the source file
    root.hide_viewport = True
    root.location = loc
    root.scale = (DSN_SCALE,) * 3
    # real DSN dishes are white all over; the model's inner panel ring is dark grey
    dc = by['dish_center']
    for slot in dc.material_slots:
        slot.material = mat('DSN_dish_inner_white', '#e6e8e9', rough=0.45)
    want = Vector(point_dir).normalized()
    by['azimuth'].rotation_mode = 'XYZ'      # glTF import uses quaternions
    by['elevation'].rotation_mode = 'XYZ'
    best = None
    for az in range(-180, 180, 3):
        for tilt in range(-75, 76, 3):
            by['azimuth'].rotation_euler.z = math.radians(az)
            by['elevation'].rotation_euler.x = math.radians(tilt)
            ax = (calc_world(by['elevation']).to_3x3() @ Vector((0, 0, 1))).normalized()
            d = ax.dot(want)
            if best is None or d > best[0]:
                best = (d, az, tilt)
    by['azimuth'].rotation_euler.z = math.radians(best[1])
    by['elevation'].rotation_euler.x = math.radians(best[2])
    bpy.context.view_layer.update()
    print('DSN aim', best)
    return by


def moon_disc(coll, name, pos, radius):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=radius, location=pos)
    o = bpy.context.object
    o.name = name
    for c in list(o.users_collection):
        c.objects.unlink(o)
    coll.objects.link(o)
    bpy.ops.object.shade_smooth()
    m = bpy.data.materials.new(name + '_mat')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 4.0
    texp = os.path.join(ROOT, 'source', 'tex', 'moon-globe.jpg')
    if os.path.exists(texp):
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(texp, check_existing=True)
        tex.image.pack()   # keep yer.blend self-contained
        tc = nt.nodes.new('ShaderNodeTexCoord')
        nt.links.new(tc.outputs['UV'], tex.inputs['Vector'])
        nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    else:
        em.inputs['Color'].default_value = srgb('#d8d4cc')
    nt.links.new(em.outputs[0], out.inputs[0])
    o.data.materials.append(m)
    o.visible_shadow = False
    return o


def build_dsn(sc):
    c = link_coll(sc, 'DSN_antenna')
    c_env = link_coll(sc, 'DSN_environment')
    c_cam = link_coll(sc, 'DSN_cameras')
    # sun sets in the west (-X); the full Moon rises in the east (+X): dish points at it
    by = build_dsn_antenna(c, point_dir=(0.80, -0.35, 0.50))
    # dish axis -> put the Moon where the dish points
    dish = by['dish']
    mn, mx = bbox_world([dish])
    centre = (mn + mx) / 2
    axis = (calc_world(by['elevation']).to_3x3() @ Vector((0, 0, 1))).normalized()
    moon_pending = (centre, axis)
    # desert ground + far hills
    m_sand = mat('DSN_desert', '#b98f63', rough=0.95, noise=0.3, noise_scale=0.02)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, -1.0))
    g = bpy.context.object
    g.name = 'Desert_ground'
    g.scale = (8000, 8000, 1)
    g.data.materials.append(m_sand)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=19, depth=1.2, location=(0, 0, -0.9))
    pad = bpy.context.object
    pad.name = 'DSN_concrete_pad'
    pad.data.materials.append(mat('DSN_concrete', '#b7b2a8', rough=0.8, noise=0.15, noise_scale=0.3))
    for o in (g, pad):
        for cc in list(o.users_collection):
            cc.objects.unlink(o)
        c_env.objects.link(o)
    rng = np.random.default_rng(5)
    m_hill = mat('DSN_hills', '#7d5a4a', rough=0.95, noise=0.25, noise_scale=0.01)
    for k, (R, hmax) in enumerate(((1400, 120), (2600, 260))):
        n = 720
        th = np.linspace(0, 2 * np.pi, n, endpoint=False)
        h = hmax * np.clip(0.45 + 0.3 * np.sin(th * 5 + k) + 0.2 * np.sin(th * 17 + 3 * k)
                           + 0.08 * np.sin(th * 61) + rng.normal(0, 0.03, n), 0.05, 1)
        verts, faces = [], []
        for i in range(n):
            x, y = R * np.cos(th[i]), R * np.sin(th[i])
            verts += [(x, y, -2), (x * 1.08, y * 1.08, h[i])]
        faces = [(2 * i, 2 * ((i + 1) % n), 2 * ((i + 1) % n) + 1, 2 * i + 1) for i in range(n)]
        me = bpy.data.meshes.new(f'Hills_{k}')
        me.from_pydata(verts, [], faces)
        o = bpy.data.objects.new(f'Hills_{k}', me)
        o.data.materials.append(m_hill)
        c_env.objects.link(o)
    # sunset light: sun low in the west (-X), camera looks north-ish
    sc.world = sky_world('DSN_sunset_sky', sun_elev_deg=2.5, sun_rot_deg=-100.0, strength=0.45, dust=2.5)
    sun_lamp(c_env, 'Sun_sunset', 3.5, -100.0, energy=3.5, color='#ff9f5a', angle_deg=0.8)
    cl = cloud_layer(c_env, 'Clouds_sunset', 2200, 16000, '#ffb07a', '#e889a4', strength=1.2,
                     coverage=0.52, scale=3.0, stretch=(1.0, 2.0))
    cam = add_cam(sc, c_cam, 'CAM_dsn_sunset', (14, -80, 2.5), (-6, 0, 21), lens=28)
    # comparison camera: in front of the dish, low, like NASA photo PIA25136
    ah = Vector((axis.x, axis.y, 0)).normalized()
    add_cam(sc, c_cam, 'CAM_dsn_ref', tuple(Vector((0, 0, 2.0)) + ah * 62), (0, 0, 21), lens=24)
    sc.camera = cam
    sc.render.resolution_x, sc.render.resolution_y = 1920, 1080
    # Moon: put it on screen where the dish's boresight points (2D), far away.
    from bpy_extras.object_utils import world_to_camera_view
    centre, axis = moon_pending
    cam.matrix_world = calc_world(cam)
    p0 = world_to_camera_view(sc, cam, centre)
    p1 = world_to_camera_view(sc, cam, centre + axis * 40)
    d2 = Vector((p1.x - p0.x, p1.y - p0.y))
    d2.normalize()
    t = min([(0.88 - p0.x) / d2.x if d2.x > 1e-4 else 9, (0.86 - p0.y) / d2.y if d2.y > 1e-4 else 9,
             (p0.x - 0.12) / -d2.x if d2.x < -1e-4 else 9])
    sx, sy = p0.x + d2.x * t, p0.y + d2.y * t
    fr = [cam.matrix_world @ v for v in cam.data.view_frame(scene=sc)]   # tr, br, bl, tl
    pt = fr[2] + (fr[1] - fr[2]) * sx + (fr[3] - fr[2]) * sy
    ray = (pt - cam.matrix_world.translation).normalized()
    moon_disc(c_env, 'Moon_in_sky', cam.matrix_world.translation + ray * 4000, 75)  # artistic ~2 deg
    set_render(sc, exposure=-0.4)


# ----------------------------------------------------------------------------
# Sprites (transparent PNG, <=512 px)
# ----------------------------------------------------------------------------
def studio_world(name='Sprite_studio'):
    w = bpy.data.worlds.new(name)
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    grad = nt.nodes.new('ShaderNodeTexGradient')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = srgb('#6d6a66')
    ramp.color_ramp.elements[1].color = srgb('#dfe8f5')
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.8
    nt.links.new(bg.outputs[0], out.inputs[0])
    return w


def frame_cam(sc, coll, name, objs, direction, lens=50.0, margin=1.08, aspect=1.0):
    mn, mx = bbox_world(objs)
    cen = (mn + mx) / 2
    size = (mx - mn).length
    d = Vector(direction).normalized()
    cd = bpy.data.cameras.new(name)
    cd.type = 'ORTHO'
    cam = bpy.data.objects.new(name, cd)
    coll.objects.link(cam)
    cam.location = cen + d * size * 3
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    # fit ortho scale to the projected bbox
    inv = cam.matrix_world.inverted()
    xs, ys = [], []
    for o in objs:
        if o.type != 'MESH':
            continue
        for v in o.bound_box:
            p = inv @ (o.matrix_world @ Vector(v))
            xs.append(p.x)
            ys.append(p.y)
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    cam.location = cam.matrix_world @ Vector((cx, cy, 0))
    cd.ortho_scale = max(w / aspect if aspect >= 1 else w, h) * margin if aspect >= 1 else max(w, h * aspect) * margin
    cd.ortho_scale = max(w, h) * margin
    cd.clip_end = size * 10
    return cam


def build_sprites(sc):
    sc.world = studio_world()
    c_l = link_coll(sc, 'SPR_lights')
    key = sun_lamp(c_l, 'SPR_key', 35, -140, energy=3.5, color='#fff1de', angle_deg=3)
    rim = sun_lamp(c_l, 'SPR_rim', 20, 60, energy=1.5, color='#cfe0ff', angle_deg=5)
    cams = {}
    # SLS (copy of the pad mesh, no launcher)
    c = link_coll(sc, 'SPR_sls')
    src = bpy.data.objects.get('SLS_Block1')
    if src is None:
        src = build_sls(c)
        sls = src
    else:
        sls = src.copy()
        c.objects.link(sls)
    sls.matrix_world = (Matrix.Rotation(math.radians(90), 4, 'Z') @
                        Matrix.Diagonal((SLS_SCALE,) * 3 + (1,)) @
                        Matrix.Translation((0, 0.1, -SLS_MODEL_BASE_Z)))
    sls.location.x += 0
    cams['yer_sls'] = (frame_cam(sc, c, 'CAM_spr_sls', [sls], (-1, -0.35, 0.12), margin=1.03), 'SPR_sls')
    # Mobile launcher
    c = link_coll(sc, 'SPR_mobile_launcher')
    srcm = bpy.data.objects.get('Mobile_Launcher')
    if srcm is None:
        ml, _ = build_ml(c)
    else:
        ml = srcm.copy()
        c.objects.link(ml)
    ml.location = (500, 0, 0)
    bpy.context.view_layer.update()
    cams['yer_mobile_launcher'] = (frame_cam(sc, c, 'CAM_spr_ml', [ml], (-1, -0.8, 0.25)), 'SPR_mobile_launcher')
    # Orion crew module
    c = link_coll(sc, 'SPR_orion')
    objs = import_glb('orion', c)
    orion = [o for o in objs if o.type == 'MESH'][0]
    orion.name = 'Orion_CM'
    orion.data.materials.clear()
    m_shell = mat('ORION_backshell_silver', '#d9dcdf', rough=0.35, metal=0.55, noise=0.08, noise_scale=1.5)
    m_heat = mat('ORION_heatshield', '#6b4a33', rough=0.85)
    orion.data.materials.append(m_shell)
    orion.data.materials.append(m_heat)
    me = orion.data
    n = len(me.polygons)
    pc = np.zeros(n * 3)
    me.polygons.foreach_get('center', pc)
    pc = pc.reshape(-1, 3)
    nr = np.zeros(n * 3)
    me.polygons.foreach_get('normal', nr)
    nr = nr.reshape(-1, 3)
    mi = np.where((pc[:, 2] < -1.6) & (nr[:, 2] < -0.3), 1, 0)   # blunt heat shield underside
    me.polygons.foreach_set('material_index', mi)
    for p in me.polygons:
        p.use_smooth = True
    orion.scale = (ORION_SCALE,) * 3
    orion.location = (1000, 0, 0)
    bpy.context.view_layer.update()
    cams['yer_orion'] = (frame_cam(sc, c, 'CAM_spr_orion', [orion], (-1, -0.6, 0.45)), 'SPR_orion')
    # DSN antenna
    c = link_coll(sc, 'SPR_dsn')
    by = build_dsn_antenna(c, point_dir=(0.5, -0.6, 0.65), loc=(1500, 0, 0))
    bpy.context.view_layer.update()
    dobjs = [o for o in by.values() if o.type == 'MESH' and o.name.split('.')[0] != '_root']
    cams['yer_dsn'] = (frame_cam(sc, c, 'CAM_spr_dsn', dobjs, (0.35, -1, 0.3)), 'SPR_dsn')
    # Helmet
    c = link_coll(sc, 'SPR_helmet')
    objs = import_glb('helmet', c)
    hel = None
    for o in objs:
        o.animation_data_clear()
        if o.name.startswith('helmet_uv2'):
            hel = o
        elif o.type == 'MESH':
            bpy.data.objects.remove(o)       # tiny stray pieces in the source file
    m_h = mat('HELMET_shell_white', '#f1f0ec', rough=0.3, coat=0.5)
    m_v = mat('HELMET_visor_gold', '#d9a646', rough=0.08, metal=1.0)
    for slot in hel.material_slots:
        if slot.material and slot.material.name.startswith('visor'):
            slot.material = m_v
        else:
            slot.material = m_h
    hel.scale = (0.01 * HELMET_SCALE,) * 3
    hel.location = (2000, 0, 0)
    bpy.context.view_layer.update()
    cams['yer_helmet'] = (frame_cam(sc, c, 'CAM_spr_helmet', [hel], (-0.6, -1, 0.25), margin=1.1), 'SPR_helmet')
    sc['sprite_cams'] = {k: v[0].name for k, v in cams.items()}
    sc['sprite_colls'] = {k: v[1] for k, v in cams.items()}
    sc.camera = cams['yer_sls'][0]
    set_render(sc, w=512, h=512, samples=128)
    sc.render.film_transparent = True


README = """YER (Earth) station -- built by scenes/yer/build_yer.py (do not edit by hand; re-run the script)
Scenes / cameras:
  Yer_Pad      CAM_pad_wide (game bg), CAM_pad_low, CAM_pad_ref (= NASA photo KSC-20220323-PH-JBS01_0012 angle)
  Yer_Houston  CAM_mcc_back (game bg), CAM_mcc_corner (= NASA photo S69-59525 angle)
  Yer_DSN      CAM_dsn_sunset (game bg), CAM_dsn_ref (= NASA photo PIA25136 angle)
  Yer_Sprites  CAM_spr_sls / _ml / _orion / _dsn / _helmet  (film transparent; hide the other SPR_* collections)
Render settings saved for the Blender app: Cycles, GPU (enable Metal in Preferences > System), 256 samples.
1 unit = 1 m.  3D models: NASA 3D Resources / NASA Science. Not endorsed by NASA.
"""


class in_scene:
    """Make `sc` the active scene/view layer so bpy.ops work on it (also in -b)."""
    def __init__(self, sc):
        self.sc = sc
    def __enter__(self):
        win = bpy.context.window
        if win:
            win.scene = self.sc
            self.ov = None
        else:
            self.ov = bpy.context.temp_override(scene=self.sc, view_layer=self.sc.view_layers[0])
            self.ov.__enter__()
        return self.sc
    def __exit__(self, *a):
        if self.ov:
            self.ov.__exit__(*a)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    first = bpy.data.scenes[0]
    if 'pad' in WANT:
        first.name = 'Yer_Pad'
        with in_scene(first) as sc:
            build_pad(sc)
    if 'mcc' in WANT and 'build_mcc' in globals():
        sc = bpy.data.scenes.new('Yer_Houston')
        with in_scene(sc):
            build_mcc(sc)
    if 'dsn' in WANT and 'build_dsn' in globals():
        sc = bpy.data.scenes.new('Yer_DSN')
        with in_scene(sc):
            build_dsn(sc)
    if 'sprites' in WANT and 'build_sprites' in globals():
        sc = bpy.data.scenes.new('Yer_Sprites')
        with in_scene(sc):
            build_sprites(sc)
    if first.name == 'Scene' and len(bpy.data.scenes) > 1:
        bpy.data.scenes.remove(first)
    t = bpy.data.texts.new('README_yer')
    t.write(README)
    bpy.context.preferences.filepaths.save_version = 0   # no yer.blend1 backups
    bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=True)
    print('SAVED', BLEND)


if __name__ == '__main__':
    main()
