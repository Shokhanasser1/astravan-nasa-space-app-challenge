"""HOME BY SEVEN - lander entrance (forward hatch + porch) and crew-cabin interior, built from scratch.

Run:  Blender -b --factory-startup -P build_lander.py [-- --no-render] [-- --only cutaway,inside_eye]
Writes lander_interior.blend, lander_interior.glb, fit_check.json, walk.json, stats.json, shell_cut.json (renders only)
and renders/*.png next to this file. Optimise with the SPEC gltf-transform command plus `--palette false` (HANDOFF.md).

Frame: ASTRA native metres, Blender Z-up; three (x, y, z) -> Blender (x, -z, y). ASTRA front (+z three, the hatch)
= Blender -Y. Cabin = ASTRA 'lm-cabin' lathe (10 sides, vertices every 36 deg in Blender, flat faces at +-Y),
floor of our cabin z 3.00. All real-world facts: see SOURCES.md (NASA NTRS + NASA Image Library).
"""
import bpy, bmesh, math, os, sys, json
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.normpath(os.path.join(HERE, '..', 'ref', 'lander_shell.blend'))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
DO_RENDER = '--no-render' not in ARGS
ONLY = ARGS[ARGS.index('--only') + 1].split(',') if '--only' in ARGS else None
D = math.radians

# ---------------------------------------------------------------- reset
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.unit_settings.system = 'METRIC'
sc.render.fps = 24
sc.frame_start, sc.frame_end = 1, 30

COL = bpy.data.collections.new('LANDER_interior')
sc.collection.children.link(COL)

# ---------------------------------------------------------------- materials (13 of 14)
def hexcol(h):
    h = h.lstrip('#')
    return [((int(h[i:i + 2], 16) / 255) ** 2.2) for i in (0, 2, 4)] + [1.0]

M = {}
def mat(name, hx, rough=0.6, metal=0.0, emit=0.0, cull=True, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hexcol(hx)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = hexcol(hx)
        b.inputs['Emission Strength'].default_value = emit
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
    m.use_backface_culling = cull
    m.diffuse_color = hexcol(hx)
    M[name] = m

mat('int_white', '#e8ecf2', 0.5)            # ASTRA white: hatch frame, ECS box, hoses
mat('int_cream', '#c4c1b7', 0.75)           # cabin lining (perforated cream wall, as11-37-5528 / AS17-145-22224)
mat('int_panel', '#6d7378', 0.55, 0.1)      # panel grey (as11-36-5389, as09-23-3595)
mat('int_grey', '#a9b2c0', 0.5, 0.2)        # ASTRA grey: hatch leaves (ASTRA's hatch panel is this grey)
mat('int_dark', '#2a3140', 0.5, 0.2)        # ASTRA dark: knobs, bezels, frames
mat('int_steel', '#8b94a3', 0.35, 0.7)      # ASTRA steel: hinges, rails, toggles, porch
mat('int_floor', '#757675', 0.85)           # simulator floor grey (S67-15794)
mat('int_fabric', '#d5d7e0', 0.9)           # white stowage bags (S69-56700)
mat('int_orange', '#ff8a3d', 0.5)           # ASTRA orange: handles (orange handles as11-36-5389; orange hatch edge as11-40-5863)
mat('int_glass', '#152238', 0.08, 0.0, cull=False)   # ASTRA window glass colour (shell lander_13)
mat('glow_screen', '#3ee39a', 0.4, 0, emit=3.0)      # EL numerics (NTRS 19760011098) in ASTRA's light green
mat('glow_lamp', '#ffe2b0', 0.4, 0, emit=6.0)        # incandescent floodlights (NTRS 19760011098)
mat('glow_amber', '#ff8a3d', 0.4, 0, emit=4.0)       # lit breaker / caution lamps (as11-37-5528), ASTRA orange

# ---------------------------------------------------------------- hierarchy
def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.2
    e.location = loc
    COL.objects.link(e)
    if parent:
        e.parent = parent
    return e

ROOT = empty('lander_interior')
FURN = empty('lander_furniture', ROOT)
GLOW = empty('lander_glow', ROOT)
HINGE = Vector((-0.40, -1.405, 3.005))          # forward hatch hinge line (vertical), see door section
DOOR = empty('lander_door', ROOT, HINGE)

# ---------------------------------------------------------------- geometry helper
def R(ax=0.0, ay=0.0, az=0.0):
    return Euler((ax, ay, az), 'XYZ').to_matrix().to_4x4()

def frame(o, az=0.0, ax=0.0):
    """Mount frame: local x = right, local +y = into the wall, local z = up along the surface."""
    return Matrix.Translation(Vector(o)) @ R(0, 0, az) @ R(ax)

class Part:
    def __init__(self, name, parent):
        self.name, self.parent, self.bm, self.mats = name, parent, bmesh.new(), []

    def mi(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def _tag(self, verts, m):
        i = self.mi(m)
        for f in {f for v in verts for f in v.link_faces}:
            f.material_index = i

    def box(self, size, loc, m, F=None, rot=(0, 0, 0)):
        Mx = (F or Matrix()) @ Matrix.Translation(Vector(loc)) @ R(*rot) @ Matrix.Diagonal((*size, 1))
        self._tag(bmesh.ops.create_cube(self.bm, size=1.0, matrix=Mx)['verts'], m)

    def cyl(self, r, h, loc, m, F=None, rot=(0, 0, 0), seg=12, r2=None):
        Mx = (F or Matrix()) @ Matrix.Translation(Vector(loc)) @ R(*rot)
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r,
                                    radius2=r if r2 is None else r2, depth=h, matrix=Mx)
        self._tag(res['verts'], m)

    def tube(self, p, q, r, m, seg=6):
        p, q = Vector(p), Vector(q)
        d = q - p
        Mx = Matrix.Translation((p + q) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        res = bmesh.ops.create_cone(self.bm, cap_ends=True, cap_tris=False, segments=seg, radius1=r, radius2=r,
                                    depth=d.length, matrix=Mx)
        self._tag(res['verts'], m)

    def path(self, pts, r, m, seg=6):
        for a, b in zip(pts[:-1], pts[1:]):
            self.tube(a, b, r, m, seg)
        for p in pts[1:-1]:
            self.ball(p, r * 1.05, m)

    def ball(self, p, r, m, seg=8):
        res = bmesh.ops.create_uvsphere(self.bm, u_segments=seg, v_segments=max(4, seg // 2), radius=r,
                                        matrix=Matrix.Translation(Vector(p)))
        self._tag(res['verts'], m)

    def poly(self, pts, m):
        vs = [self.bm.verts.new(Vector(p)) for p in pts]
        f = self.bm.faces.new(vs)
        f.material_index = self.mi(m)
        return f

    def slab(self, pts, thick, m, normal=None):
        """Extrude a planar polygon by thick along -face normal (polygon wound so its normal faces the viewer)."""
        f = self.poly(pts, m)
        f.normal_update()
        n = f.normal.copy() if normal is None else Vector(normal)
        ext = bmesh.ops.extrude_face_region(self.bm, geom=[f], use_keep_orig=True)
        nv = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(self.bm, verts=nv, vec=-n * thick)
        bmesh.ops.recalc_face_normals(self.bm, faces=list({fc for v in nv for fc in v.link_faces}) + [f])
        for fc in {fc for v in nv for fc in v.link_faces}:
            fc.material_index = self.mi(m)

    def build(self, local_to=None):
        me = bpy.data.meshes.new(self.name)
        if local_to is not None:   # store verts relative to a parent pivot
            bmesh.ops.transform(self.bm, matrix=Matrix.Translation(-local_to), verts=self.bm.verts)
        self.bm.normal_update()
        self.bm.to_mesh(me)
        self.bm.free()
        for m in self.mats:
            me.materials.append(M[m])
        ob = bpy.data.objects.new(self.name, me)
        COL.objects.link(ob)
        ob.parent = self.parent
        for p in me.polygons:
            p.use_smooth = False
        return ob

# ---------------------------------------------------------------- shell facts (ASTRA site.ts buildLander, moon)
SHELL = [(1.25, 2.78), (1.35, 3.0), (1.35, 4.2), (1.15, 4.65), (0.75, 4.85), (0.0, 4.9)]  # (vertex r, z)
C18 = math.cos(D(18))
FLOOR = 3.00
LIN = [(1.23, FLOOR), (1.23, 4.15), (1.05, 4.56), (0.68, 4.745), (0.47, 4.775)]  # our lining (vertex r, z)

def lin_r(z):
    for (r0, z0), (r1, z1) in zip(LIN[:-1], LIN[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return LIN[-1][0]

def lin_ap(z):
    return lin_r(z) * C18

def vtx(k, r, z):  # lining/shell vertex k (every 36 deg from +X)
    a = D(36 * k)
    return Vector((r * math.cos(a), r * math.sin(a), z))

def face_pt(alpha_deg, ap, z):  # point on a flat face with outward normal angle alpha at apothem ap
    a = D(alpha_deg)
    return Vector((ap * math.cos(a), ap * math.sin(a), z))

# ---------------------------------------------------------------- lining walls (10 columns, inward faces)
HATCH_W, HATCH_TOP = 0.405, 3.90          # half-width / top of the clear opening (see SOURCES: 32 in wide)
walls = []
for k in range(10):
    col = Part(f'lining_wall_{k}', FURN)
    alpha = 36 * k + 18
    for (r0, z0), (r1, z1) in zip(LIN[:-1], LIN[1:]):
        a0, b0, a1, b1 = vtx(k, r0, z0), vtx(k + 1, r0, z0), vtx(k, r1, z1), vtx(k + 1, r1, z1)
        if z0 == FLOOR and alpha in (234, 270, 306):
            # hatch opening: cut the front column below HATCH_TOP and notch the two neighbours
            zc = HATCH_TOP
            ac, bc = vtx(k, r0, zc), vtx(k + 1, r0, zc)
            if alpha == 270:
                col.poly([ac, a1, b1, bc], 'int_cream')
            else:
                # neighbour columns: lower part starts at x = +-HATCH_W on the face line
                if alpha == 234:   # k=6: verts 216 -> 252 ; notch at the 252 end (b side)
                    t = (-HATCH_W - a0.x) / (b0.x - a0.x)
                    pn = a0.lerp(b0, t)
                    col.poly([a0, Vector((pn.x, pn.y, z0)), Vector((pn.x, pn.y, zc)), Vector((a0.x, a0.y, zc))][::-1], 'int_cream')
                else:              # k=8: verts 288 -> 324 ; notch at the 288 end (a side)
                    t = (HATCH_W - a0.x) / (b0.x - a0.x)
                    pn = a0.lerp(b0, t)
                    col.poly([Vector((pn.x, pn.y, z0)), b0, Vector((b0.x, b0.y, zc)), Vector((pn.x, pn.y, zc))][::-1], 'int_cream')
                col.poly([ac, a1, b1, bc], 'int_cream')
        else:
            col.poly([a0, a1, b1, b0], 'int_cream')   # wound to face inward
    walls.append(col.build())

# floor (10-gon, faces up) + roof ring around the overhead hatch is the last lining ring (r 0.47)
fl = Part('cabin_floor', FURN)
fl.poly([vtx(k, LIN[0][0], FLOOR) for k in range(10)], 'int_floor')
fl.build()

# ---------------------------------------------------------------- window bulkhead (crew faces ASTRA's windows, +Y)
TILT = 0.12                                   # ASTRA windowPane rotation.x
Y0 = 0.90                                     # bulkhead at floor level
U = Vector((0, -math.sin(TILT), math.cos(TILT)))
BF = frame((0, Y0, FLOOR), 0.0, TILT)         # bulkhead mount frame: local (u, -d, w)

def bw(u, w):
    return BF @ Vector((u, 0, w))

def umax(w, margin=0.02):
    p = bw(0, w)
    ap = lin_ap(p.z) - margin
    n = Vector((math.cos(D(54)), math.sin(D(54))))
    return (ap - n.y * p.y) / n.x

W_TOP = (4.50 - FLOOR) / math.cos(TILT)
W_K = (4.15 - FLOOR) / math.cos(TILT)
outline = [(-umax(0), 0), (umax(0), 0), (umax(W_K), W_K), (umax(W_TOP), W_TOP), (-umax(W_TOP), W_TOP), (-umax(W_K), W_K)]
bk = Part('bulkhead', FURN)
bk.slab([bw(u, w) for u, w in outline][::-1], 0.03, 'int_panel', normal=(BF.to_3x3() @ Vector((0, -1, 0))))
bk_ob = bk.build()
# window openings = ASTRA windows (x +-0.45, centre y 4.1 three, 0.42 x 0.55, tilt 0.12)
WIN_W, WIN_H = 0.42, 0.55
WIN_WC = (4.10 - FLOOR) / math.cos(TILT)
cutters = []
for sx in (-1, 1):
    bpy.ops.mesh.primitive_cube_add(size=1)
    c = bpy.context.active_object
    c.scale = (WIN_W, 0.4, WIN_H)
    c.rotation_euler = (TILT, 0, 0)
    c.location = bw(sx * 0.45, WIN_WC)
    cutters.append(c)
for c in cutters:
    md = bk_ob.modifiers.new('cut', 'BOOLEAN')
    md.operation, md.solver, md.object = 'DIFFERENCE', 'EXACT', c
dg = bpy.context.evaluated_depsgraph_get()
me_new = bpy.data.meshes.new_from_object(bk_ob.evaluated_get(dg))
bk_ob.modifiers.clear()
bk_ob.data = me_new
me_new.materials.clear()
me_new.materials.append(M['int_panel'])
for p_ in me_new.polygons:
    p_.material_index = 0
for c in cutters:
    bpy.data.objects.remove(c, do_unlink=True)
# cap between bulkhead top and the sloped lining
p_l, p_r = bw(-umax(W_TOP), W_TOP), bw(umax(W_TOP), W_TOP)
rz = lin_r(p_l.z)
cap = Part('bulkhead_cap', FURN)
cap.poly([p_l, vtx(3, rz, p_l.z), vtx(2, rz, p_l.z), p_r], 'int_panel')
cap.build()

# ---------------------------------------------------------------- windows from inside (glass + bezel)
win = Part('windows_inner', FURN)
for sx in (-1, 1):
    u0, w0 = sx * 0.45, WIN_WC
    win.box((WIN_W, 0.004, WIN_H), (u0, 0.02, w0), 'int_glass', F=BF)
    bz = 0.035
    for (du, dw, su, sw) in [(0, WIN_H / 2 + bz / 2, WIN_W + 2 * bz, bz), (0, -WIN_H / 2 - bz / 2, WIN_W + 2 * bz, bz),
                             (WIN_W / 2 + bz / 2, 0, bz, WIN_H), (-WIN_W / 2 - bz / 2, 0, bz, WIN_H)]:
        win.box((su, 0.03, sw), (u0 + du, -0.012, w0 + dw), 'int_dark', F=BF)
win.build()

# ---------------------------------------------------------------- centre stack: panels 1 + 2, AOT, DSKY
cs = Part('centre_stack', FURN)
gl = Part('glow_centre', GLOW)
SW = 0.20                                      # half-width between the windows' bezels
# upper part = main display panels 1 (CDR, left half) and 2 (LMP, right half)
cs.box((2 * SW, 0.07, 0.62), (0, -0.035, 1.14), 'int_panel', F=BF)
cs.box((0.006, 0.075, 0.60), (0, -0.04, 1.14), 'int_dark', F=BF)        # seam between panel 1 and 2
for sx in (-1, 1):
    u = sx * SW / 2
    # FDAI "8-ball" in an octagonal frame (round instruments in octagonal frames, as11-36-5389 / S67-15794)
    cs.cyl(0.078, 0.02, (u, -0.08, 1.26), 'int_dark', F=BF, rot=(D(90), D(22.5), 0), seg=8)
    cs.cyl(0.058, 0.012, (u, -0.092, 1.27), 'int_white', F=BF, rot=(D(90), 0, 0), seg=12)
    cs.box((0.115, 0.012, 0.024), (u, -0.096, 1.255), 'int_dark', F=BF)  # horizon bar
    # rows of lamps (no text) and toggle switches
    for i in range(3):
        gl.box((0.03, 0.008, 0.018), (u - 0.05 + i * 0.05, -0.074, 1.40), 'glow_amber', F=BF)
    for j in range(2):
        for i in range(4):
            uu = u - 0.06 + i * 0.04
            ww = 0.98 + j * 0.07
            cs.box((0.014, 0.012, 0.014), (uu, -0.076, ww), 'int_dark', F=BF)
            cs.box((0.006, 0.03, 0.006), (uu, -0.09, ww + 0.006), 'int_steel', F=BF, rot=(D(-25), 0, 0))
    gl.box((0.07, 0.008, 0.04), (u, -0.074, 0.90), 'glow_screen', F=BF)  # small readout window
# lower centre console with the DSKY on a sloped face
LF = BF @ Matrix.Translation((0, -0.0, 0.42)) @ R(-0.45)
cs.box((2 * SW, 0.20, 0.40), (0, -0.10, 0.20), 'int_panel', F=LF)
cs.box((2 * SW, 0.16, 0.42), (0, -0.08, 0.20), 'int_panel', F=BF)      # kick panel to the floor
cs.box((0.26, 0.03, 0.30), (0, -0.21, 0.22), 'int_dark', F=LF)          # DSKY housing
gl.box((0.10, 0.008, 0.10), (0.05, -0.227, 0.29), 'glow_screen', F=LF)  # EL numerics window (blank)
for i in range(4):
    gl.box((0.035, 0.008, 0.016), (-0.07, -0.227, 0.33 - i * 0.025), 'glow_amber' if i == 0 else 'glow_lamp', F=LF)
for rrow in range(3):
    for i in range(6):
        cs.box((0.028, 0.012, 0.024), (-0.09 + i * 0.036, -0.232, 0.17 - rrow * 0.034), 'int_white', F=LF)
# AOT (alignment optical telescope) above the stack, between the stations
AOT = Vector((0, 0.70, 4.40))
cs.cyl(0.075, 0.30, AOT + Vector((0, 0, 0.15)), 'int_dark', seg=12)
cs.cyl(0.04, 0.12, AOT + Vector((0, -0.10, 0.06)), 'int_dark', rot=(D(90), 0, 0), seg=10)
cs.cyl(0.05, 0.03, AOT + Vector((0, -0.17, 0.06)), 'int_steel', rot=(D(90), 0, 0), seg=10)
cs.cyl(0.03, 0.05, AOT + Vector((0.09, 0, 0.16)), 'int_steel', rot=(0, D(90), 0), seg=8)
cs.build()
gl.build()

# ---------------------------------------------------------------- hand controllers (ACA right hand, TTCA left hand)
hc = Part('hand_controllers', FURN)
STATIONS = {'CDR': -0.45, 'LMP': 0.45}       # CDR left, LMP right when facing the windows (S69-56700)
for who, sx0 in STATIONS.items():
    for kind, du in (('ACA', 0.19), ('TTCA', -0.19)):
        u = sx0 + du
        p = bw(u, 0.80) + Vector((0, -0.22, 0))
        # light-grey mounting block on a bracket (S67-15794)
        hc.box((0.11, 0.18, 0.07), p + Vector((0, 0.02, 0)), 'int_grey')
        hc.box((0.04, 0.20, 0.04), p + Vector((0, 0.17, -0.05)), 'int_steel')
        if kind == 'ACA':     # pistol grip, cream (S67-15794)
            hc.cyl(0.026, 0.035, p + Vector((0, -0.02, 0.05)), 'int_dark', seg=8)
            hc.box((0.035, 0.045, 0.13), p + Vector((0, -0.03, 0.12)), 'int_cream', rot=(D(-12), 0, 0))
            hc.box((0.012, 0.02, 0.03), p + Vector((0, -0.06, 0.15)), 'int_orange')   # trigger
        else:                 # T-handle
            hc.tube(p + Vector((0, -0.02, 0.03)), p + Vector((0, -0.02, 0.13)), 0.012, 'int_steel')
            hc.box((0.11, 0.03, 0.03), p + Vector((0, -0.02, 0.14)), 'int_cream')
hc.build()

# ---------------------------------------------------------------- restraint cables (stowed) with floor reels
rc = Part('restraints', FURN)
for who, sx0 in STATIONS.items():
    for du in (-0.24, 0.24):
        base = Vector((sx0 + du, 0.60, FLOOR))
        rc.box((0.07, 0.07, 0.06), base + Vector((0, 0, 0.03)), 'int_dark')
        hook = bw(sx0 + du, 0.45) + Vector((0, -0.02, 0))
        rc.tube(base + Vector((0, 0, 0.06)), hook, 0.006, 'int_steel', seg=5)
        rc.cyl(0.03, 0.01, hook, 'int_orange', rot=(D(90), 0, 0), seg=8)    # D-ring clip
rc.build()

# ---------------------------------------------------------------- side panels (circuit breakers outboard, upper; switches lower)
sp = Part('side_panels', FURN)
gs = Part('glow_side', GLOW)
for alpha in (18, 162):
    ap = lin_ap(FLOOR) - 0.035
    F = frame(face_pt(alpha, ap, FLOOR), D(alpha - 90))
    sp.box((0.62, 0.04, 0.84), (0, 0.0, 0.72), 'int_panel', F=F)
    for r_ in range(4):
        for i in range(10):
            sp.cyl(0.011, 0.022, (-0.25 + i * 0.0555, -0.03, 0.82 + r_ * 0.085), 'int_dark', F=F,
                   rot=(D(90), 0, 0), seg=6)
    sp.box((0.58, 0.012, 0.01), (0, -0.026, 0.775), 'int_steel', F=F)
    for i in range(6):
        sp.box((0.014, 0.012, 0.014), (-0.2 + i * 0.08, -0.026, 0.55), 'int_dark', F=F)
        sp.box((0.006, 0.03, 0.006), (-0.2 + i * 0.08, -0.04, 0.556), 'int_steel', F=F, rot=(D(-25), 0, 0))
        gs.box((0.026, 0.008, 0.018), (-0.2 + i * 0.08, -0.024, 0.66), 'glow_amber' if i % 3 == 0 else 'glow_screen', F=F)
sp.build()
gs.build()

# ---------------------------------------------------------------- ECS station (aft of the LMP: right side, toward the hatch)
ec = Part('ecs_station', FURN)
A_ECS = 342
ap = lin_ap(FLOOR) - 0.16
F = frame(face_pt(A_ECS, ap, FLOOR), D(A_ECS - 90))
ec.box((0.58, 0.30, 1.10), (0, 0.0, 0.55), 'int_white', F=F)
for w in (0.42, 0.68):                         # two large round suit-loop ports (S67-15794, as13-62-8929)
    ec.cyl(0.095, 0.03, (0.10, -0.16, w), 'int_steel', F=F, rot=(D(90), 0, 0), seg=16)
    ec.cyl(0.07, 0.034, (0.10, -0.165, w), 'int_dark', F=F, rot=(D(90), 0, 0), seg=16)
for r_ in range(2):                            # block of valve knobs
    for i in range(3):
        ec.cyl(0.022, 0.04, (-0.17 + i * 0.06, -0.17, 0.86 + r_ * 0.08), 'int_white', F=F, rot=(D(90), 0, 0), seg=8)
        ec.cyl(0.026, 0.01, (-0.17 + i * 0.06, -0.152, 0.86 + r_ * 0.08), 'int_dark', F=F, rot=(D(90), 0, 0), seg=8)
for w in (0.42, 0.68):                         # white ribbed hoses down to the floor
    p0 = F @ Vector((0.10, -0.18, w))
    p1 = F @ Vector((0.10, -0.32, w - 0.15))
    p2 = F @ Vector((0.0, -0.40, 0.04))
    ec.path([p0, p1, p2], 0.028, 'int_white', seg=8)
ec.build()

# ---------------------------------------------------------------- stowage (aft of the CDR: left side) - bags behind straps
st = Part('stowage', FURN)
A_ST = 198
ap = lin_ap(FLOOR) - 0.15
F = frame(face_pt(A_ST, ap, FLOOR), D(A_ST - 90))
st.box((0.62, 0.30, 0.04), (0, 0, 0.02), 'int_steel', F=F)
st.box((0.62, 0.30, 0.03), (0, 0, 1.0), 'int_steel', F=F)
for su in (-0.30, 0.30):
    st.box((0.03, 0.30, 1.0), (su, 0, 0.5), 'int_steel', F=F)
for i, (w, h) in enumerate(((0.22, 0.34), (0.56, 0.30), (0.84, 0.24))):
    st.box((0.54, 0.26, h - 0.03), (0, -0.01, w), 'int_fabric', F=F)
    st.box((0.56, 0.27, 0.025), (0, -0.01, w), 'int_dark', F=F)          # retaining strap
st.build()

# ---------------------------------------------------------------- overhead (docking) hatch, round, hinged into the cabin
oh = Part('overhead_hatch', FURN)
OZ = 4.792
oh.cyl(0.47, 0.03, (0, 0, OZ - 0.012), 'int_steel', seg=24, r2=0.47)
oh.cyl(0.405, 0.03, (0, 0, OZ - 0.035), 'int_grey', seg=24)
for x in (-0.2, 0.0, 0.2):                     # stiffening ribs (NTRS 19760011098 fig. 21)
    half = math.sqrt(0.39 ** 2 - x ** 2)
    oh.box((0.025, 2 * half, 0.035), (x, 0, OZ - 0.065), 'int_grey')
oh.box((0.70, 0.025, 0.035), (0, 0, OZ - 0.065), 'int_grey')
oh.box((0.06, 0.12, 0.04), (0, 0.40, OZ - 0.055), 'int_steel')          # hinge block
oh.box((0.06, 0.12, 0.04), (0.22, 0.33, OZ - 0.055), 'int_steel')
oh.tube((-0.10, -0.30, OZ - 0.09), (0.10, -0.30, OZ - 0.09), 0.014, 'int_orange')   # latch handle
oh.tube((-0.10, -0.30, OZ - 0.09), (-0.10, -0.27, OZ - 0.05), 0.012, 'int_orange')
oh.tube((0.10, -0.30, OZ - 0.09), (0.10, -0.27, OZ - 0.05), 0.012, 'int_orange')
oh.cyl(0.05, 0.03, (0.15, 0.05, OZ - 0.065), 'int_dark', seg=10)       # dump valve
oh.build()

# ---------------------------------------------------------------- floodlights (incandescent in the LM)
lp = Part('floodlights', GLOW)
for x, y in ((-0.58, -0.05), (0.58, -0.05)):
    z = 4.69
    lp.box((0.22, 0.09, 0.025), (x, y, z), 'glow_lamp')
    lp.box((0.24, 0.11, 0.02), (x, y, z + 0.02), 'int_dark')
z = 4.55
lp.box((0.30, 0.03, 0.06), (0, -0.84, z), 'glow_lamp', rot=(D(-50), 0, 0))
lp.build()

# ---------------------------------------------------------------- forward hatch: frame, jamb, leaf, handles
FRONT_OUT = -1.47      # outer face of our exterior frame (ASTRA hatch ring front at three z 1.43 -> 4 cm proud)
SILL = FLOOR
hf = Part('hatch_frame', FURN)
# exterior frame around the opening (covers ASTRA's 0.85 x 1.0 grey hatch panel)
fw = 0.07
for (cx, cz, sx_, sz_) in [(0, HATCH_TOP + fw / 2 + 0.005, 2 * HATCH_W + 2 * fw, fw),
                           (-(HATCH_W + fw / 2), (2.98 + 3.975) / 2, fw, 3.975 - 2.98),
                           ((HATCH_W + fw / 2), (2.98 + 3.975) / 2, fw, 3.975 - 2.98)]:
    hf.box((sx_, 0.04, sz_), (cx, FRONT_OUT + 0.02, cz), 'int_dark')
# orange lip around the opening (orange-lined hatch frame, as11-40-5863)
for (cx, cz, sx_, sz_) in [(0, HATCH_TOP + 0.012, 2 * HATCH_W + 0.05, 0.025),
                           (-(HATCH_W + 0.012), (SILL + HATCH_TOP) / 2, 0.025, HATCH_TOP - SILL),
                           ((HATCH_W + 0.012), (SILL + HATCH_TOP) / 2, 0.025, HATCH_TOP - SILL)]:
    hf.box((sx_, 0.012, sz_), (cx, FRONT_OUT - 0.004, cz), 'int_orange')
hf.box((2 * HATCH_W + 2 * fw, 0.10, 0.025), (0, FRONT_OUT + 0.05, SILL - 0.0125), 'int_steel')   # sill plate
# jamb (orange-lined opening, as11-40-5863) from the frame to the lining
JIN = -1.15
for sx in (-1, 1):
    hf.box((0.012, abs(FRONT_OUT - JIN), HATCH_TOP - SILL), (sx * (HATCH_W + 0.006), (FRONT_OUT + JIN) / 2, (SILL + HATCH_TOP) / 2), 'int_orange')
hf.box((2 * HATCH_W + 0.024, abs(FRONT_OUT - JIN) + 0.02, 0.012), (0, (FRONT_OUT + JIN) / 2, HATCH_TOP + 0.006), 'int_orange')
hf.box((2 * HATCH_W, abs(FRONT_OUT + 0.0 - JIN) + 0.02, 0.01), (0, (FRONT_OUT + JIN) / 2, SILL - 0.005), 'int_floor')
# hull patch: the game deletes the whole front facet of ASTRA's lm-cabin lathe band (three y 3.0-4.2, see HANDOFF);
# this white plate (ASTRA white, 0.4-1.8 cm proud of the facet plane at apothem 1.2839) closes it above our frame
PATCH_Y0, PATCH_Y1 = 1.288, 1.302          # Blender -y range (three z)
hf.box((2 * 0.4172, PATCH_Y1 - PATCH_Y0, 4.20 - (HATCH_TOP + 0.012)),
       (0, -(PATCH_Y0 + PATCH_Y1) / 2, (HATCH_TOP + 0.012 + 4.20) / 2), 'int_white')
hf.build()

# leaf (opens inward, hinge on the right as seen from inside facing the hatch = Blender -X; latch on +X)
LW, LH, LT = 0.79, 0.885, 0.05
lf = Part('hatch_leaf', DOOR)
O = HINGE
lf.box((LW, LT, LH), O + Vector((0.005 + LW / 2, -LT / 2, LH / 2)), 'int_grey')
# inner stiffening ribs (fig. 20) + dump valve in the middle + latch handle near the free edge
for z in (0.22, 0.48, 0.72):
    lf.box((LW - 0.08, 0.025, 0.03), O + Vector((0.005 + LW / 2, 0.012, z)), 'int_grey')
for x in (0.20, 0.58):
    lf.box((0.03, 0.022, LH - 0.08), O + Vector((x, 0.011, LH / 2)), 'int_grey')
lf.cyl(0.075, 0.03, O + Vector((0.40, 0.03, 0.50)), 'int_steel', rot=(D(90), 0, 0), seg=16)
lf.cyl(0.05, 0.035, O + Vector((0.40, 0.035, 0.50)), 'int_dark', rot=(D(90), 0, 0), seg=16)
lf.box((0.05, 0.04, 0.10), O + Vector((0.70, 0.03, 0.50)), 'int_steel')               # latch housing
lf.tube(O + Vector((0.70, 0.05, 0.50)), O + Vector((0.70, 0.12, 0.50)), 0.014, 'int_orange')
lf.tube(O + Vector((0.70, 0.12, 0.50)), O + Vector((0.58, 0.12, 0.47)), 0.016, 'int_orange')   # inner T-handle
# outside: grab handle + latch handle (operable from outside), hinges on the -X edge
lf.tube(O + Vector((0.70, -LT, 0.42)), O + Vector((0.70, -LT - 0.06, 0.42)), 0.012, 'int_orange')
lf.tube(O + Vector((0.70, -LT, 0.62)), O + Vector((0.70, -LT - 0.06, 0.62)), 0.012, 'int_orange')
lf.tube(O + Vector((0.70, -LT - 0.06, 0.42)), O + Vector((0.70, -LT - 0.06, 0.62)), 0.014, 'int_orange')
lf.cyl(0.05, 0.012, O + Vector((0.40, -LT - 0.006, 0.50)), 'int_dark', rot=(D(90), 0, 0), seg=12)  # valve access
for z in (0.15, 0.73):
    lf.cyl(0.018, 0.12, O + Vector((-0.005, -LT / 2, z)), 'int_steel', seg=8)
leaf_ob = lf.build(local_to=O)

# DoorOpen: rotate the pivot about its vertical hinge axis, 0 -> 90 deg inward over 1.25 s (eased)
DOOR.rotation_mode = 'XYZ'
DOOR.rotation_euler = (0, 0, 0)
DOOR.keyframe_insert('rotation_euler', frame=1)
DOOR.rotation_euler = (0, 0, D(90))
DOOR.keyframe_insert('rotation_euler', frame=30)
act = DOOR.animation_data.action
act.name = 'DoorOpen'
act.use_fake_user = True
sc.frame_set(1)

# ---------------------------------------------------------------- porch (0.9 m square) + walkway to ASTRA's ladder + rails
PZ = 2.98            # porch top = just under the hatch sill (crew crawl out at floor level, as11-40-5863)
la = D(135)          # ASTRA ladder azimuth (three) -> Blender rail tops:
lad = [Vector((math.cos(la) * 1.95 + math.sin(la) * 0.25 * k, -(math.sin(la) * 1.95 - math.cos(la) * 0.25 * k), 2.6)) for k in (-1, 1)]
pc = Part('porch', FURN)
deck = [(0.45, -1.30), (0.45, -2.20), (-0.45, -2.20), (lad[1].x + 0.03, lad[1].y + 0.04),
        (lad[0].x + 0.04, lad[0].y + 0.03), (-0.45, -1.30)]
pc.slab([Vector((x, y, PZ)) for x, y in deck], 0.03, 'int_steel', normal=(0, 0, 1))
for x, y in ((0.40, -1.75), (-0.40, -1.75), (-0.95, -1.55)):          # posts down to the descent stage deck
    pc.tube((x, y, PZ - 0.03), (x, y, 2.77), 0.025, 'int_steel')
RH = 0.90             # rail height above the deck (plain choice; rails seen in as11-40-5863)
rail = [Vector((0.45, -1.50, PZ)), Vector((0.45, -2.20, PZ)), Vector((-0.45, -2.20, PZ)), Vector((lad[1].x + 0.03, lad[1].y + 0.04, PZ))]
for p in rail:
    pc.tube(p, p + Vector((0, 0, RH)), 0.02, 'int_steel')
pc.path([p + Vector((0, 0, RH)) for p in rail], 0.02, 'int_steel')
pc.path([p + Vector((0, 0, RH * 0.5)) for p in rail], 0.014, 'int_steel')
for p in lad:         # extend ASTRA's ladder rails up to the deck and into grab handles (start 8 mm above
    p0 = p + Vector((0, 0, 0.008))   # ASTRA's strut end so the fit check keeps >= 5 mm clearance)
    pc.path([p0, Vector((p.x, p.y, PZ)), Vector((p.x, p.y, PZ + 0.9))], 0.022, 'int_steel')
pc.tube(lad[0] + Vector((0, 0, 0.19)), lad[1] + Vector((0, 0, 0.19)), 0.018, 'int_steel')   # top rung
pc.build()

# ---------------------------------------------------------------- reference shell (excluded from export)
with bpy.data.libraries.load(REF, link=False) as (src, dst):
    dst.objects = [n for n in src.objects]
REFC = bpy.data.collections.new('REF_shell')
sc.collection.children.link(REFC)
shell = []
for o in dst.objects:
    if o is not None and o.type == 'MESH':
        REFC.objects.link(o)
        shell.append(o)
LATHE = next(o for o in shell if o.name.startswith('lander_9_'))       # lm-cabin lathe (white)
HPANEL = next(o for o in shell if o.name.startswith('lander_14_'))     # ASTRA decorative hatch panel

# ---------------------------------------------------------------- fit check
dg = bpy.context.evaluated_depsgraph_get()
def bvh_of(objs):
    bm = bmesh.new()
    for o in objs:
        t = bmesh.new()
        t.from_object(o, dg)
        t.transform(o.matrix_world)
        me = bpy.data.meshes.new('tmp')
        t.to_mesh(me); t.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    tree = BVHTree.FromBMesh(bm)
    bm.free()
    return tree

ALL = bvh_of(shell)
LATHE_T = bvh_of([LATHE])

def inside_lathe(p):
    # analytic: inside the 10-gon lathe at this height
    z = p.z
    if z <= SHELL[0][1] or z >= SHELL[-1][1]:
        return False
    for (r0, z0), (r1, z1) in zip(SHELL[:-1], SHELL[1:]):
        if z0 <= z <= z1:
            rv = r0 + (r1 - r0) * (z - z0) / (z1 - z0)
            break
    ap = rv * C18
    return all(p.x * math.cos(D(36 * k + 18)) + p.y * math.sin(D(36 * k + 18)) <= ap for k in range(10))

def check(objs, need_inside=True):
    res = {'verts': 0, 'bad': 0, 'min_clear': 9.0, 'worst': []}
    for o in objs:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            res['verts'] += 1
            loc, n, i, dist = ALL.find_nearest(p)
            ins = inside_lathe(p)
            ok = (ins == need_inside) and dist >= (0.02 if need_inside else 0.005) and (p.z >= 2.96 or not need_inside)
            res['min_clear'] = min(res['min_clear'], dist)
            if not ok:
                res['bad'] += 1
                if len(res['worst']) < 12:
                    res['worst'].append([o.name, [round(c, 3) for c in p], round(dist, 4), ins])
    res['min_clear'] = round(res['min_clear'], 4)
    return res

def subtree(e):
    out = []
    for c in e.children:
        out.append(c)
        out += subtree(c)
    return out

inner = [o for o in subtree(ROOT) if o.type == 'MESH' and not o.name.startswith(('hatch_', 'porch'))]
fit = {'interior_inside_shell_2cm': check(inner, True),
       'porch_outside_cabin': check([bpy.data.objects['porch']], False),
       'door_parts_exempt': ['hatch_frame', 'hatch_leaf']}
# door swing check: leaf at 0/45/90 deg must not hit other interior meshes (sampled leaf verts vs. their BVH)
others = bvh_of([o for o in inner if o.name not in ('cabin_floor',)])
swing = {}
for f_ in (1, 10, 20, 30):
    sc.frame_set(f_)
    dg2 = bpy.context.evaluated_depsgraph_get()
    mw = leaf_ob.matrix_world
    mind = 9.0
    for v in leaf_ob.data.vertices:
        loc, n, i, dist = others.find_nearest(mw @ v.co)
        if dist is not None:
            mind = min(mind, dist)
    swing[f'frame_{f_}'] = round(mind, 4)
sc.frame_set(1)
fit['door_leaf_min_dist_to_furniture'] = swing
json.dump(fit, open(os.path.join(HERE, 'fit_check.json'), 'w'), indent=1)
print('FIT', json.dumps(fit))

# ---------------------------------------------------------------- walk.json (three coords: x, z = -blender y; yaw = blender rot z)
def fp(name, cx, cy, hx, hy, yaw_deg):
    return {'name': name, 'x': round(cx, 3), 'z': round(-cy, 3), 'hx': round(hx, 3), 'hz': round(hy, 3), 'yaw': round(D(yaw_deg), 4)}
walk = []
for k in range(10):
    a = 36 * k + 18
    if a == 270:
        continue
    c = face_pt(a, lin_ap(FLOOR) + 0.03, 0)
    walk.append(fp(f'wall_{k}', c.x, c.y, 0.38, 0.03, a - 90))
walk.append(fp('bulkhead', 0, Y0 + 0.02, 0.75, 0.03, 0))
walk.append(fp('centre_stack', 0, Y0 - 0.16, SW, 0.14, 0))
for a, name, d in ((18, 'side_panel_R', 0.04), (162, 'side_panel_L', 0.04), (A_ECS, 'ecs_station', 0.30), (A_ST, 'stowage', 0.30)):
    c = face_pt(a, lin_ap(FLOOR) - d / 2 - (0.0 if d < 0.1 else 0.0), 0)
    walk.append(fp(name, c.x, c.y, 0.31 if d < 0.1 else 0.30, d / 2, a - 90))
walk.append(fp('porch_deck', 0, -1.75, 0.45, 0.45, 0))
walk.append(fp('porch_walkway', -0.95, -1.62, 0.55, 0.18, 35))
json.dump(walk, open(os.path.join(HERE, 'walk.json'), 'w'), indent=1)

# ---------------------------------------------------------------- stats + export
def tri_count(objs):
    t = 0
    for o in objs:
        if o.type == 'MESH':
            t += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return t
mats_used = sorted({m.name for o in subtree(ROOT) if o.type == 'MESH' for m in o.data.materials})
stats = {'triangles': tri_count(subtree(ROOT)), 'materials': mats_used, 'n_materials': len(mats_used),
         'objects': len(subtree(ROOT))}
print('STATS', json.dumps(stats))
json.dump(stats, open(os.path.join(HERE, 'stats.json'), 'w'), indent=1)

REFC.hide_render = False
bpy.ops.object.select_all(action='DESELECT')
for o in [ROOT] + subtree(ROOT):
    o.select_set(True)
bpy.context.view_layer.objects.active = ROOT
glb = os.path.join(HERE, 'lander_interior.glb')
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
                          export_yup=True, export_animations=True, export_cameras=False, export_lights=False,
                          export_materials='EXPORT')
print('EXPORTED', glb, os.path.getsize(glb))

# ---------------------------------------------------------------- renders (Cycles CPU)
def setup_render():
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 32
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = 960, 540
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'AgX' if 'AgX' in [i.identifier for i in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
    w = bpy.data.worlds.new('w')
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.02, 0.022, 0.03, 1)
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    sc.world = w

def cam(name, loc, target, lens=24):
    c = bpy.data.cameras.new(name)
    c.lens = lens
    o = bpy.data.objects.new(name, c)
    sc.collection.objects.link(o)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.camera = o
    return o

def light(name, kind, loc, energy, size=0.5, rot=None, color=(1, 1, 1)):
    l = bpy.data.lights.new(name, kind)
    l.energy = energy
    l.color = color
    if kind == 'AREA':
        l.size = size
    if kind == 'SUN':
        l.angle = D(1.0)
    o = bpy.data.objects.new(name, l)
    sc.collection.objects.link(o)
    o.location = loc
    if rot:
        o.rotation_euler = rot
    return o

def show_shell(on):
    for o in shell:
        o.hide_render = not on

def render(name):
    if ONLY and name not in ONLY:
        return
    sc.render.filepath = os.path.join(HERE, 'renders', name + '.png')
    bpy.ops.render.render(write_still=True)
    print('RENDERED', name)

if DO_RENDER:
    os.makedirs(os.path.join(HERE, 'renders'), exist_ok=True)
    setup_render()
    sun = light('sun', 'SUN', (0, 0, 10), 3.5, rot=(D(50), 0, D(-35)))
    fill = light('cabin_fill', 'POINT', (0, 0.0, 4.35), 60, color=(1, 0.93, 0.82))
    # 1) cutaway: shell hidden, near walls hidden, 3/4 view from the front-right, above
    show_shell(False)
    cut_hide = [o for o in walls if o.name.endswith(('_6', '_7', '_8', '_9', '_0'))]
    for o in cut_hide:
        o.hide_render = True
    cam('cam_cut', (2.2, -3.0, 5.9), (0.0, 0.25, 3.65), lens=26)
    render('cutaway')
    for o in cut_hide:
        o.hide_render = False
    # 2) eye height 1.65 m inside, looking at the windows / panels
    cam('cam_eye', (0.0, -0.75, FLOOR + 1.65), (0.0, 0.9, 3.95), lens=16)
    sun.hide_render = True
    render('inside_eye')
    sun.hide_render = False
    # 3/4) door closed / open with the shell shown; game cut emulated: ASTRA hatch panel hidden, lathe cut
    show_shell(True)
    # emulate the game cut exactly as written in HANDOFF.md: delete every shell triangle whose 3 vertices all lie in
    # the box three x [-0.43, 0.43], y [2.945, 4.21], z [1.27, 1.45]  (= Blender x, -y, z below)
    def in_cut(p):
        return -0.43 <= p.x <= 0.43 and -1.45 <= p.y <= -1.27 and 2.945 <= p.z <= 4.21
    cut_report = {}
    for o in shell:
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
        mw = o.matrix_world
        kill = [f for f in bm.faces if all(in_cut(mw @ v.co) for v in f.verts)]
        if kill:
            cut_report[o.name] = {'deleted_tris': len(kill), 'of': len(bm.faces),
                                  'material': o.data.materials[0].name if o.data.materials else ''}
            bmesh.ops.delete(bm, geom=kill, context='FACES')
            bm.to_mesh(o.data)
        bm.free()
    print('CUT', json.dumps(cut_report))
    json.dump(cut_report, open(os.path.join(HERE, 'shell_cut.json'), 'w'), indent=1)
    fill.location = (0, -0.3, 4.3)
    cam('cam_door', (1.35, -4.6, 3.75), (-0.05, -1.35, 3.35), lens=30)
    sc.frame_set(1)
    render('door_closed')
    sc.frame_set(30)
    render('door_open')
    sc.frame_set(1)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'lander_interior.blend'))
print('DONE')
