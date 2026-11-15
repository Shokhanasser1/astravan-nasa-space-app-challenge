"""Lander v2 -- walk-in INTERIOR of the ascent-stage cabin (worker B). See SPEC.md.

build(ctx) is called by build_lander_v2.py. Everything lives in collection LI_interior, is parented to
lander_body and uses LI_* materials.  Owned volume: the inner surface (x -1.30..1.30, y -1.40..1.20,
chamfers 0.50, floor z 3.00, walls to z 5.05, ceiling chamfer to the flat ceiling at z 5.20) and inward.

Hero buttons: one object each, origin = spec face centre, local +Z = out of the face (press = -Z local,
which is the spec press direction).  Actions (fake user, 30 fps, NOT assigned at the end of the build):
  Press_<btn>  slot 'OB<btn>' (location) + slot 'NT<mat>' on the button material node tree (emission on)
  CoverOpen    slot on btn_launch_cover (rotation_euler.x, hinge = object origin on the cover's top edge)
  PanelBoot    one NODETREE slot per boot material (screens, gauges, lamps), slot name = material name
Use assign_action('<name>') from this module to hook an action up to all of its IDs.
"""
import bpy, math, random
from mathutils import Vector, Matrix

R2 = math.sqrt(2.0)
YC = -0.10                 # cabin centre in y
H_IN, K_IN = 1.30, 2.10    # inner octagon: |x|<=H, |y-YC|<=H, |x|+|y-YC|<=K
FLOOR, WALL_TOP, CEIL = 3.00, 5.05, 5.20
CEIL_IN = 0.15             # ceiling chamfer: inset 0.15 between WALL_TOP and CEIL
DOCK_C = (0.0, YC)         # overhead docking hatch centre (cabin centre)
FPS = 30
MAT = {}
rng = random.Random(7)

# facet ids (edge i of the CCW octagon)
FR, RT, BR, BK, BL, LT, FL, FT = range(8)


# ------------------------------------------------------------------ geometry helpers
def octagon(h=H_IN, k=K_IN, yc=YC):
    c = k - h
    pts = [(c, -h), (h, -c), (h, c), (c, h), (-c, h), (-h, c), (-h, -c), (-c, -h)]
    return [(x, y + yc) for x, y in pts]


def oct_off(d):
    """inner octagon pushed d into the cabin (d<0 = behind the wall surface)"""
    return octagon(H_IN - d, K_IN - d * R2)


OCT = octagon()


def facet(i, oct_pts=OCT):
    a = Vector((*oct_pts[i], 0)); b = Vector((*oct_pts[(i + 1) % 8], 0))
    e = (b - a).normalized(); N = Vector((-e.y, e.x, 0)); t = -e; c = (a + b) / 2
    M = Matrix(((t.x, 0, N.x, c.x), (t.y, 0, N.y, c.y), (0, 1, 0, 0), (0, 0, 0, 1)))
    return M, (b - a).length / 2


def P(fi, s, z, d):
    M, _ = facet(fi)
    return M @ Vector((s, z, d))


S15, C15 = math.sin(math.radians(15)), math.cos(math.radians(15))
PANEL_C = Vector((0, 1.15, 4.35))
PM = Matrix(((1, 0, 0, PANEL_C.x), (0, S15, -C15, PANEL_C.y), (0, C15, S15, PANEL_C.z), (0, 0, 0, 1)))


def T(x, y, z=0.0):
    return Matrix.Translation((x, y, z))


def RZ(a):
    return Matrix.Rotation(a, 4, 'Z')


def RX(a):
    return Matrix.Rotation(a, 4, 'X')


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def circle(r, n, cx=0.0, cy=0.0, start=0.0):
    return [(cx + r * math.cos(start + 2 * math.pi * i / n), cy + r * math.sin(start + 2 * math.pi * i / n))
            for i in range(n)]


def rrect(x0, y0, x1, y1, r, n=3):
    """rounded rectangle outline, CCW"""
    pts = []
    for cx, cy, a0 in ((x1 - r, y0 + r, -90), (x1 - r, y1 - r, 0), (x0 + r, y1 - r, 90), (x0 + r, y0 + r, 180)):
        for k in range(n + 1):
            a = math.radians(a0 + 90 * k / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def clip_poly(poly, a, b, c):
    """keep part of convex poly with a*x+b*y <= c"""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        fp, fq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if fp <= 0:
            out.append(p)
        if fp * fq < 0:
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def clip_oct(poly, shrink=0.0):
    h = H_IN - shrink; k = K_IN - shrink * R2
    for a, b, c in ((1, 0, h), (-1, 0, h), (0, 1, h + YC), (0, -1, h - YC),
                    (1, 1, k + YC), (-1, 1, k + YC), (1, -1, k - YC), (-1, -1, k - YC)):
        poly = clip_poly(poly, a, b, c)
        if not poly:
            break
    return poly


def fillet(pts, r, n=5):
    pts = [Vector(p) for p in pts]
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = pts[i - 1], pts[i], pts[i + 1]
        d1, d2 = b - a, c - b
        rr = min(r, d1.length * 0.45, d2.length * 0.45)
        p0 = b - d1.normalized() * rr; p2 = b + d2.normalized() * rr
        for k in range(n + 1):
            t = k / n
            out.append((1 - t) ** 2 * p0 + 2 * (1 - t) * t * b + t * t * p2)
    out.append(pts[-1])
    return out


def offset_poly(pts, d):
    """offset a convex CCW polygon outward by d (same as worker A's helper, so contours match)"""
    n = len(pts)
    lines = []
    for i in range(n):
        a = Vector(pts[i]); b = Vector(pts[(i + 1) % n])
        t = (b - a).normalized()
        lines.append((a + Vector((t.y, -t.x)) * d, t))
    out = []
    for i in range(n):
        p1, t1 = lines[i - 1]; p2, t2 = lines[i]
        den = t1.x * t2.y - t1.y * t2.x
        s = ((p2.x - p1.x) * t2.y - (p2.y - p1.y) * t2.x) / den
        q = p1 + t1 * s
        out.append((q.x, q.y))
    return out


def round_poly(pts, r, n=6):
    """fillet every corner of a convex CCW polygon (same as worker A's helper)"""
    out = []
    N = len(pts)
    for i in range(N):
        rr = max(r, 1e-4)
        a = Vector(pts[i - 1]); b = Vector(pts[i]); c = Vector(pts[(i + 1) % N])
        d1 = (a - b).normalized(); d2 = (c - b).normalized()
        ang = d1.angle(d2)
        bis = (d1 + d2).normalized()
        cen = b + bis * (rr / math.sin(ang / 2))
        p1 = b + d1 * (rr / math.tan(ang / 2)); p2 = b + d2 * (rr / math.tan(ang / 2))
        a1 = math.atan2(p1.y - cen.y, p1.x - cen.x); a2 = math.atan2(p2.y - cen.y, p2.x - cen.x)
        da = a2 - a1
        while da <= -math.pi:
            da += 2 * math.pi
        while da > math.pi:
            da -= 2 * math.pi
        for k in range(n + 1):
            t = a1 + da * k / n
            out.append((cen.x + rr * math.cos(t), cen.y + rr * math.sin(t)))
    return out


def ccw(poly):
    a = sum(poly[k][0] * poly[(k + 1) % len(poly)][1] - poly[(k + 1) % len(poly)][0] * poly[k][1]
            for k in range(len(poly)))
    return list(poly) if a > 0 else list(reversed(poly))


EXT = {'HATCH': (-0.45, 3.00, 0.45, 4.40), 'HATCH_R': 0.12, 'WIN_Z': 4.80, 'WIN_R': 0.045,
       'WIN': [(-0.19, -0.215), (0.19, -0.215), (0.25, 0.18), (-0.25, 0.18)]}


def read_exterior_consts(here):
    """keep the openings in sync with worker A's exterior.py (HATCH, WIN, WIN_Z), if it is there"""
    import ast, os
    f = os.path.join(here, 'exterior.py')
    if not os.path.exists(f):
        return
    try:
        for node in ast.parse(open(f).read()).body:
            if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                nm = node.targets[0].id
                if nm == 'WIN':
                    EXT['WIN'] = [tuple(p) for p in ast.literal_eval(node.value)]
                elif nm == 'WIN_Z':
                    EXT['WIN_Z'] = float(ast.literal_eval(node.value))
                elif nm == 'HATCH' and isinstance(node.value, ast.Call):
                    EXT['HATCH'] = tuple(float(ast.literal_eval(a)) for a in node.value.args)
    except Exception as e:
        print('LV2-B could not read exterior constants:', e, flush=True)


def win_contour(d=0.0, n=5):
    """window opening in (s, z) on the inner chamfer facet (s = -u of worker A's facet frame)"""
    pts = round_poly(offset_poly(EXT['WIN'], d), EXT['WIN_R'] + d, n)
    return [(-u, EXT['WIN_Z'] + v) for u, v in pts]


def hatch_contour(d=0.0, n=6):
    """hatch opening in (x, z), CCW, corners BL, BR, TR, TL (7 points each for n = 6)"""
    return round_poly(offset_poly(rect(*EXT['HATCH']), d), EXT['HATCH_R'] + d, n)


class MB:
    """mesh builder: accumulates primitives (in body space) with per-face materials and optional UVs"""

    def __init__(self):
        self.v, self.f, self.mi, self.uv, self.mats = [], [], [], [], []

    def _m(self, m):
        if m not in self.mats:
            self.mats.append(m)
        return self.mats.index(m)

    def add(self, verts, faces, m, uvs=None):
        i0 = len(self.v)
        self.v.extend([tuple(v) for v in verts])
        mi = self._m(m)
        for k, fc in enumerate(faces):
            self.f.append([i0 + j for j in fc])
            self.mi.append(mi)
            self.uv.append(uvs.get(k) if uvs else None)

    def prism(self, outline, z0, z1, M, m, top_uv=None):
        n = len(outline)
        vs = [M @ Vector((x, y, z0)) for x, y in outline] + [M @ Vector((x, y, z1)) for x, y in outline]
        faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
        faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        uvs = None
        if top_uv:
            x0, y0, x1, y1 = top_uv
            uvs = {1: [((x - x0) / (x1 - x0), (y - y0) / (y1 - y0)) for x, y in outline]}
        self.add(vs, faces, m, uvs)

    def box(self, x0, y0, z0, x1, y1, z1, M, m, top_uv=False):
        self.prism(rect(x0, y0, x1, y1), z0, z1, M, m, top_uv=(x0, y0, x1, y1) if top_uv else None)

    def cyl(self, r, z0, z1, M, m, n=16, uv=False, cx=0.0, cy=0.0):
        self.prism(circle(r, n, cx, cy), z0, z1, M, m, top_uv=(cx - r, cy - r, cx + r, cy + r) if uv else None)

    def ring(self, outer, inner, z0, z1, M, m):
        n = len(outer)
        vs = [M @ Vector((x, y, z0)) for x, y in outer] + [M @ Vector((x, y, z1)) for x, y in outer]
        vs += [M @ Vector((x, y, z0)) for x, y in inner] + [M @ Vector((x, y, z1)) for x, y in inner]
        faces = []
        for i in range(n):
            j = (i + 1) % n
            faces += [(n + i, n + j, 3 * n + j, 3 * n + i), (2 * n + i, 2 * n + j, j, i),
                      (i, j, n + j, n + i), (2 * n + j, 2 * n + i, 3 * n + i, 3 * n + j)]
        self.add(vs, faces, m)

    def cup(self, outer, inner, z0, z1, t, M, m):
        """open at z0, closed at z1 (wall thickness from outer->inner, roof thickness t)"""
        n = len(outer)
        vs = [M @ Vector((x, y, z0)) for x, y in outer] + [M @ Vector((x, y, z1)) for x, y in outer]
        vs += [M @ Vector((x, y, z0)) for x, y in inner] + [M @ Vector((x, y, z1 - t)) for x, y in inner]
        faces = [tuple(range(n, 2 * n)), tuple(range(4 * n - 1, 3 * n - 1, -1))]
        for i in range(n):
            j = (i + 1) % n
            faces += [(2 * n + i, 2 * n + j, j, i), (i, j, n + j, n + i), (2 * n + j, 2 * n + i, 3 * n + i, 3 * n + j)]
        self.add(vs, faces, m)

    def sweep(self, path, profile, m, caps=True, up=None):
        path = [Vector(p) for p in path]
        n = len(path); k = len(profile)
        Ts = []
        for i in range(n):
            a = path[max(i - 1, 0)]; b = path[min(i + 1, n - 1)]
            Ts.append((b - a).normalized())
        ref = Vector(up) if up else (Vector((0, 0, 1)) if abs(Ts[0].z) < 0.9 else Vector((1, 0, 0)))
        N = (ref - ref.dot(Ts[0]) * Ts[0]).normalized()
        vs = []
        for i in range(n):
            if i:
                N = (N - N.dot(Ts[i]) * Ts[i]).normalized()
            B = Ts[i].cross(N)
            vs += [path[i] + N * px + B * py for px, py in profile]
        faces = []
        for i in range(n - 1):
            for j in range(k):
                jj = (j + 1) % k
                faces.append((i * k + j, i * k + jj, (i + 1) * k + jj, (i + 1) * k + j))
        if caps:
            faces.append(tuple(range(k - 1, -1, -1)))
            faces.append(tuple(range((n - 1) * k, n * k)))
        self.add(vs, faces, m)

    def tube(self, path, r, m, sides=8, caps=True):
        self.sweep(path, circle(r, sides), m, caps)

    def slab3(self, quad, t, m, inward):
        """slab whose front face is the 3D quad (any order), thickness t away from the point `inward`"""
        q = [Vector(p) for p in quad]
        nrm = (q[1] - q[0]).cross(q[2] - q[0]).normalized()
        c = sum(q, Vector()) / 4
        if nrm.dot(Vector(inward) - c) < 0:
            q.reverse(); nrm = -nrm
        back = [p - nrm * t for p in q]
        vs = back + q   # prism: bottom = back, top = front
        n = 4
        faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
        faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        self.add(vs, faces, m)


def make_obj(ctx, name, mb, bevel=0.0, seg=2, smooth=True, angle=30.0):
    me = bpy.data.meshes.new(name)
    me.from_pydata(mb.v, [], mb.f)
    for m in mb.mats:
        me.materials.append(MAT[m])
    me.polygons.foreach_set('material_index', mb.mi)
    uvl = me.uv_layers.new(name='UVMap')
    flat = []
    for fc, uv in zip(mb.f, mb.uv):
        if uv:
            for p in uv:
                flat += [p[0], p[1]]
        else:
            flat += [0.0, 0.0] * len(fc)
    uvl.data.foreach_set('uv', flat)
    me.polygons.foreach_set('use_smooth', [smooth] * len(me.polygons))
    try:
        me.set_sharp_from_angle(angle=math.radians(angle))
    except Exception:
        pass
    me.validate()
    me.update()
    o = bpy.data.objects.new(name, me)
    ctx['col_int'].objects.link(o)
    o.parent = ctx['body']
    if bevel:
        b = o.modifiers.new('Bevel', 'BEVEL')
        b.width = bevel
        b.segments = seg
        b.limit_method = 'ANGLE'
        b.angle_limit = math.radians(40)
        b.harden_normals = True
        b.use_clamp_overlap = True
    return o


# ------------------------------------------------------------------ materials
class NB:
    def __init__(self, nt):
        self.nt = nt

    def n(self, typ, **kw):
        nd = self.nt.nodes.new(typ)
        for k, v in kw.items():
            setattr(nd, k, v)
        return nd

    def put(self, sock, v):
        if isinstance(v, (int, float)):
            sock.default_value = v
        elif isinstance(v, (tuple, list)):
            sock.default_value = tuple(v) if len(sock.default_value) == len(v) else tuple(v) + (1.0,)
        else:
            self.nt.links.new(v, sock)

    def m(self, op, a, b=None, c=None):
        nd = self.n('ShaderNodeMath', operation=op)
        self.put(nd.inputs[0], a)
        if b is not None:
            self.put(nd.inputs[1], b)
        if c is not None:
            self.put(nd.inputs[2], c)
        return nd.outputs[0]

    # convenience
    def lt(self, a, b): return self.m('LESS_THAN', a, b)
    def gt(self, a, b): return self.m('GREATER_THAN', a, b)
    def mul(self, *xs):
        r = xs[0]
        for x in xs[1:]:
            r = self.m('MULTIPLY', r, x)
        return r
    def add(self, a, b): return self.m('ADD', a, b)
    def sub(self, a, b): return self.m('SUBTRACT', a, b)
    def ab(self, a): return self.m('ABSOLUTE', a)
    def fr(self, a): return self.m('FRACT', a)
    def mx(self, *xs):
        r = xs[0]
        for x in xs[1:]:
            r = self.m('MAXIMUM', r, x)
        return r
    def band(self, a, lo, hi): return self.mul(self.gt(a, lo), self.lt(a, hi))

    def vscale(self, col, s):
        nd = self.n('ShaderNodeVectorMath', operation='SCALE')
        self.put(nd.inputs[0], col)
        self.put(nd.inputs['Scale'], s)
        return nd.outputs[0]

    def vadd(self, a, b):
        nd = self.n('ShaderNodeVectorMath', operation='ADD')
        self.put(nd.inputs[0], a); self.put(nd.inputs[1], b)
        return nd.outputs[0]

    def mix_colors(self, base, layers):
        acc = base
        for mask, col in layers:
            acc = self.vadd(acc, self.vscale(col, mask))
        return acc


def new_mat(name, col=(0.5, 0.5, 0.5), rough=0.5, metal=0.0, emit=None, estr=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*col, 1)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    if emit:
        p.inputs['Emission Color'].default_value = (*emit, 1)
        p.inputs['Emission Strength'].default_value = estr
    if coat:
        p.inputs['Coat Weight'].default_value = coat
    m.diffuse_color = (*col, 1)
    MAT[name] = m
    return m


def add_grime(m, scale=3.0, amount=0.12, rough_var=0.12):
    nt = m.node_tree; nb = NB(nt)
    p = nt.nodes['Principled BSDF']
    tc = nb.n('ShaderNodeTexCoord')
    nz = nb.n('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = 6.0
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    base = p.inputs['Base Color'].default_value[:3]
    k = nb.add(nb.mul(nb.m('MAXIMUM', nb.sub(nz.outputs['Fac'], 0.45), 0.0), -amount * 3.0), 1.0)
    nb.put(p.inputs['Base Color'], nb.vscale(tuple(base), k))
    r0 = p.inputs['Roughness'].default_value
    nb.put(p.inputs['Roughness'], nb.add(nb.mul(nz.outputs['Fac'], rough_var), r0 - rough_var / 2))


def principled(m):
    return m.node_tree.nodes['Principled BSDF']


def emission_socket(m):
    return principled(m).inputs['Emission Strength']


def build_materials():
    MAT.clear()
    w = new_mat('LI_wall', (0.56, 0.57, 0.56), 0.55); add_grime(w, 2.5, 0.10)
    w = new_mat('LI_wall_low', (0.30, 0.31, 0.31), 0.6); add_grime(w, 3.0, 0.12)
    new_mat('LI_backing', (0.025, 0.025, 0.027), 0.8)
    w = new_mat('LI_ceiling', (0.62, 0.62, 0.60), 0.6); add_grime(w, 2.0, 0.06)
    new_mat('LI_trim', (0.16, 0.165, 0.17), 0.35, 0.6)
    new_mat('LI_trim_dark', (0.045, 0.047, 0.05), 0.4, 0.5)
    principled(new_mat('LI_panel', (0.016, 0.017, 0.019), 0.6)).inputs['Specular IOR Level'].default_value = 0.25
    principled(new_mat('LI_subplate', (0.03, 0.032, 0.035), 0.5)).inputs['Specular IOR Level'].default_value = 0.3
    new_mat('LI_fabric', (0.36, 0.34, 0.29), 0.95)
    new_mat('LI_velcro', (0.11, 0.11, 0.115), 0.95)
    new_mat('LI_console', (0.085, 0.09, 0.095), 0.5)
    new_mat('LI_metal', (0.62, 0.62, 0.63), 0.28, 1.0)
    new_mat('LI_black', (0.012, 0.012, 0.013), 0.4)
    new_mat('LI_white', (0.70, 0.70, 0.68), 0.45)
    new_mat('LI_rubber', (0.035, 0.035, 0.037), 0.85)
    new_mat('LI_strap', (0.10, 0.105, 0.11), 0.9)
    w = new_mat('LI_locker', (0.27, 0.285, 0.30), 0.5); add_grime(w, 3.0, 0.08)
    new_mat('LI_case', (0.05, 0.075, 0.11), 0.45)
    new_mat('LI_cap_dark', (0.09, 0.09, 0.095), 0.35)
    new_mat('LI_bottle', (0.55, 0.06, 0.04), 0.35, 0.0, coat=0.6)
    for nm, c in (('LI_cable_k', (0.02, 0.02, 0.022)), ('LI_cable_g', (0.25, 0.26, 0.26)),
                  ('LI_cable_r', (0.45, 0.04, 0.03)), ('LI_cable_b', (0.03, 0.10, 0.35)),
                  ('LI_cable_y', (0.55, 0.40, 0.04))):
        new_mat(nm, c, 0.55)
    # floor: non-slip grid of small raised squares (bump)
    m = new_mat('LI_floor', (0.075, 0.077, 0.08), 0.6, 0.35)
    nt = m.node_tree; nb = NB(nt)
    tc = nb.n('ShaderNodeTexCoord')
    br = nb.n('ShaderNodeTexBrick', offset=0.0, squash=1.0)
    nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Brick Width'].default_value = 0.022
    br.inputs['Row Height'].default_value = 0.022
    br.inputs['Mortar Size'].default_value = 0.005
    br.inputs['Color1'].default_value = (1, 1, 1, 1); br.inputs['Color2'].default_value = (1, 1, 1, 1)
    br.inputs['Mortar'].default_value = (0, 0, 0, 1)
    bump = nb.n('ShaderNodeBump')
    bump.inputs['Strength'].default_value = 0.6
    bump.inputs['Distance'].default_value = 0.0015
    nt.links.new(br.outputs['Color'], bump.inputs['Height'])
    nt.links.new(bump.outputs['Normal'], principled(m).inputs['Normal'])
    nz = nb.n('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 4.0
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nb.put(principled(m).inputs['Roughness'], nb.add(nb.mul(nz.outputs['Fac'], 0.25), 0.45))
    new_mat('LI_floor_dark', (0.012, 0.012, 0.013), 0.8)
    # lights
    new_mat('LI_light', (0.9, 0.85, 0.75), 0.4, emit=(1.0, 0.84, 0.66), estr=14.0)
    new_mat('LI_light_panel', (0.9, 0.85, 0.75), 0.4, emit=(1.0, 0.88, 0.74), estr=6.0)
    # boot materials (PanelBoot keys their emission strength)
    for nm, c, s in (('LI_lamp_green', (0.15, 1.0, 0.25), 3.0), ('LI_lamp_amber', (1.0, 0.55, 0.06), 3.0),
                     ('LI_lamp_red', (1.0, 0.07, 0.04), 3.0), ('LI_lamp_blue', (0.15, 0.45, 1.0), 3.0),
                     ('LI_lamp_white', (1.0, 0.95, 0.85), 2.5)):
        new_mat(nm, tuple(x * 0.35 for x in c), 0.25, emit=c, estr=s)
    # needle
    new_mat('LI_needle', (0.9, 0.35, 0.05), 0.4, emit=(1.0, 0.45, 0.08), estr=1.5)
    # hazard stripes
    m = new_mat('LI_hazard', (0.6, 0.45, 0.02), 0.45)
    nt = m.node_tree; nb = NB(nt)
    tc = nb.n('ShaderNodeTexCoord'); sep = nb.n('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['UV'], sep.inputs[0])
    st = nb.lt(nb.fr(nb.mul(nb.add(sep.outputs[0], sep.outputs[1]), 5.0)), 0.5)
    mix = nb.n('ShaderNodeMix', data_type='RGBA')
    nb.put(mix.inputs['Factor'], st)
    mix.inputs['A'].default_value = (0.62, 0.42, 0.02, 1); mix.inputs['B'].default_value = (0.015, 0.015, 0.015, 1)
    nt.links.new(mix.outputs['Result'], principled(m).inputs['Base Color'])
    # transparent red launch cover
    # gauges
    gauge_mat()
    screen_mat('LI_screen_L', left=True)
    screen_mat('LI_screen_R', left=False)


def uv_xy(nb):
    tc = nb.n('ShaderNodeTexCoord'); sep = nb.n('ShaderNodeSeparateXYZ')
    nb.nt.links.new(tc.outputs['UV'], sep.inputs[0])
    return sep.outputs[0], sep.outputs[1]


def gauge_mat():
    m = new_mat('LI_gauge', (0.01, 0.01, 0.011), 0.3, emit=(1, 1, 1), estr=1.2)
    nt = m.node_tree; nb = NB(nt); p = principled(m)
    u, v = uv_xy(nb)
    px, py = nb.sub(u, 0.5), nb.sub(v, 0.5)
    r = nb.mul(nb.m('SQRT', nb.add(nb.mul(px, px), nb.mul(py, py))), 2.0)
    a = nb.mul(nb.add(nb.m('ARCTAN2', py, px), math.pi), 1 / (2 * math.pi))   # 0..1, bottom = 0.25
    ok = nb.sub(1.0, nb.band(a, 0.17, 0.33))
    ticks = nb.mul(nb.lt(nb.fr(nb.add(nb.mul(a, 48), 0.06)), 0.12), nb.band(r, 0.74, 0.88), ok)
    major = nb.mul(nb.lt(nb.fr(nb.add(nb.mul(a, 8), 0.02)), 0.04), nb.band(r, 0.62, 0.88), ok)
    arc = nb.mul(nb.band(r, 0.90, 0.95), ok)
    green = nb.mul(arc, nb.band(a, 0.33, 0.78))
    amber = nb.mul(arc, nb.band(a, 0.78, 0.92))
    red = nb.mul(arc, nb.sub(1.0, nb.band(a, 0.17, 0.92)))
    col = nb.mix_colors((0.0, 0.0, 0.0), [(nb.mx(ticks, major), (0.85, 0.85, 0.8)), (green, (0.05, 0.6, 0.12)),
                                          (amber, (0.9, 0.5, 0.03)), (red, (0.9, 0.05, 0.02))])
    nb.put(p.inputs['Emission Color'], col)
    nb.put(p.inputs['Base Color'], nb.vadd(nb.vscale(col, 0.7), (0.012, 0.012, 0.013)))


def screen_mat(name, left=True):
    m = new_mat(name, (0.005, 0.006, 0.007), 0.3, emit=(1, 1, 1), estr=2.0)
    nt = m.node_tree; nb = NB(nt); p = principled(m)
    u, v = uv_xy(nb)
    border = nb.mx(nb.lt(u, 0.008), nb.gt(u, 0.992), nb.lt(v, 0.014), nb.gt(v, 0.986))
    if left:
        area = nb.gt(v, 0.36)
        grid = nb.mul(nb.mx(nb.lt(nb.fr(nb.add(nb.mul(u, 10), 0.012)), 0.024),
                            nb.lt(nb.fr(nb.add(nb.mul(v, 7), 0.02)), 0.04)), area)
        amp = nb.add(0.55, nb.mul(0.45, nb.m('SINE', nb.add(nb.mul(u, 3.7), 1.0))))
        y1 = nb.add(0.68, nb.mul(nb.mul(0.15, nb.m('SINE', nb.mul(u, 15.0))), amp))
        line1 = nb.mul(nb.lt(nb.ab(nb.sub(v, y1)), 0.011), area)
        y2 = nb.add(0.58, nb.mul(0.09, nb.m('SINE', nb.add(nb.mul(u, 6.0), 2.0))))
        line2 = nb.mul(nb.lt(nb.ab(nb.sub(v, y2)), 0.007), nb.lt(nb.fr(nb.mul(u, 40)), 0.6), area)
        idx = nb.m('FLOOR', nb.mul(u, 14))
        wn = nb.n('ShaderNodeTexWhiteNoise', noise_dimensions='1D')
        nb.put(wn.inputs['W'], idx)
        h = nb.add(0.07, nb.mul(wn.outputs['Value'], 0.21))
        bars = nb.mul(nb.lt(v, h), nb.gt(v, 0.04), nb.lt(nb.fr(nb.mul(u, 14)), 0.7))
        sep = nb.lt(nb.ab(nb.sub(v, 0.33)), 0.004)
        col = nb.mix_colors((0.004, 0.018, 0.022), [
            (grid, (0.02, 0.12, 0.12)), (line1, (0.25, 1.0, 0.45)), (line2, (1.0, 0.55, 0.1)),
            (bars, (0.12, 0.45, 1.0)), (sep, (0.2, 0.6, 0.6)), (border, (0.15, 0.5, 0.5))])
    else:
        asp = 1.667
        px = nb.mul(nb.sub(u, 0.42), asp); py = nb.sub(v, 0.5)
        r = nb.m('SQRT', nb.add(nb.mul(px, px), nb.mul(py, py)))
        inside = nb.lt(r, 0.44)
        rings = nb.mul(nb.lt(nb.fr(nb.add(nb.mul(r, 9.0), 0.04)), 0.08), inside)
        cross = nb.mul(nb.mx(nb.lt(nb.ab(px), 0.003), nb.lt(nb.ab(py), 0.003)), inside)
        ex = nb.mul(px, 1 / 0.34); ey = nb.mul(nb.sub(py, 0.04), 1 / 0.19)
        orbit = nb.lt(nb.ab(nb.sub(nb.m('SQRT', nb.add(nb.mul(ex, ex), nb.mul(ey, ey))), 1.0)), 0.03)
        bx = nb.sub(px, 0.24); by = nb.sub(py, 0.16)
        blip = nb.lt(nb.add(nb.mul(bx, bx), nb.mul(by, by)), 0.00035)
        ang = nb.mul(nb.add(nb.m('ARCTAN2', py, px), math.pi), 1 / (2 * math.pi))
        wedge = nb.mul(nb.lt(nb.fr(nb.add(ang, 0.12)), 0.09), inside, nb.fr(nb.add(ang, 0.12)), 10.0)
        tape = nb.mul(nb.band(u, 0.90, 0.955), nb.band(v, 0.08, 0.92), nb.lt(nb.fr(nb.mul(v, 22)), 0.45))
        level = nb.mul(nb.band(u, 0.90, 0.955), nb.band(v, 0.08, 0.62))
        col = nb.mix_colors((0.004, 0.012, 0.008), [
            (rings, (0.05, 0.35, 0.12)), (cross, (0.05, 0.35, 0.12)), (orbit, (1.0, 0.6, 0.12)),
            (blip, (1.0, 0.2, 0.15)), (wedge, (0.03, 0.25, 0.08)), (tape, (0.05, 0.25, 0.3)),
            (level, (0.1, 0.7, 0.8)), (border, (0.1, 0.45, 0.25))])
    nb.put(p.inputs['Emission Color'], col)


def hero_mat(name, col):
    m = new_mat('LI_' + name, tuple(c * 0.55 for c in col), 0.3, emit=col, estr=0.0)
    return m


# ------------------------------------------------------------------ widgets (local frame: x,y on the surface, z out)
def w_screw(mb, M, x, y, z=0.0):
    mb.cyl(0.0042, z - 0.001, z + 0.0028, M @ T(x, y), 'LI_metal', n=8)


def w_screws(mb, M, x0, y0, x1, y1, z, inset=0.012):
    for x in (x0 + inset, x1 - inset):
        for y in (y0 + inset, y1 - inset):
            w_screw(mb, M, x, y, z)


def w_toggle(mb, M, x, y, up=True):
    L = M @ T(x, y)
    mb.cyl(0.0095, -0.001, 0.0035, L, 'LI_metal', n=6)
    mb.cyl(0.0068, 0.0, 0.009, L, 'LI_metal', n=12)
    s = 1 if up else -1
    tip = Vector((0, s * 0.012, 0.033))
    mb.tube([L @ Vector((0, 0, 0.006)), L @ tip], 0.0027, 'LI_metal', sides=8)
    mb.tube([L @ (tip - Vector((0, s * 0.0016, 0.0045))), L @ (tip + Vector((0, s * 0.0009, 0.0032)))], 0.0042,
            'LI_metal', sides=8)


def w_fin(mb, M, x, y, h=0.07, depth=0.034, m='LI_metal'):
    o = [(-0.0022, -h / 2), (0.0022, -h / 2), (0.0022, h / 2), (-0.0022, h / 2)]
    # fin is a plate standing out of the surface, rounded top edge approximated by a chamfer
    L = M @ T(x, y)
    vs = []
    prof = [(-h / 2, -0.001), (h / 2, -0.001), (h / 2, depth * 0.65), (h * 0.3, depth), (-h * 0.3, depth),
            (-h / 2, depth * 0.65)]
    # extrude the profile (y,z) along x
    outline = [(py, pz) for py, pz in prof]
    R = Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # local (a,b,c) -> (c,a,b)
    mb.prism(outline, -0.0022, 0.0022, L @ R, m)


def w_lamp(mb, M, x, y, r, mat):
    L = M @ T(x, y)
    mb.ring(circle(r + 0.0035, 16), circle(r, 16), -0.001, 0.0065, L, 'LI_trim_dark')
    mb.cyl(r, -0.001, 0.0075, L, mat, n=16)


def w_sqbutton(mb, M, x, y, s, mat):
    L = M @ T(x, y)
    h = s / 2
    mb.ring(rect(-h - 0.0045, -h - 0.0045, h + 0.0045, h + 0.0045), rect(-h - 0.001, -h - 0.001, h + 0.001, h + 0.001),
            -0.001, 0.006, L, 'LI_black')
    mb.box(-h, -h, -0.002, h, h, 0.0105, L, mat)


def w_gauge(mb, M, x, y, r, needle):
    L = M @ T(x, y)
    mb.ring(circle(r, 28), circle(r - 0.010, 28), -0.001, 0.013, L, 'LI_trim')
    mb.cyl(r - 0.009, -0.001, 0.004, L, 'LI_gauge', n=28, uv=True)
    mb.cyl(0.0045, 0.0, 0.0085, L, 'LI_black', n=10)
    Ln = L @ RZ(needle)
    mb.prism([(-0.0018, -0.006), (0.0018, -0.006), (0.0008, r * 0.72), (-0.0008, r * 0.72)], 0.0055, 0.0068, Ln,
             'LI_needle')


def w_knob(mb, M, x, y, ang=0.0):
    L = M @ T(x, y) @ RZ(ang)
    mb.cyl(0.024, -0.001, 0.004, L, 'LI_trim', n=24)
    mb.cyl(0.016, 0.0, 0.024, L, 'LI_black', n=18)
    mb.cyl(0.012, 0.0, 0.028, L, 'LI_black', n=18)
    mb.box(-0.0016, 0.0, 0.026, 0.0016, 0.0115, 0.0295, L, 'LI_white')


def w_plate(mb, M, x0, y0, x1, y1, z0=-0.003, z1=0.004, m='LI_subplate', screws=True):
    mb.box(x0, y0, z0, x1, y1, z1, M, m)
    if screws:
        w_screws(mb, M, x0, y0, x1, y1, z1)


def w_locker(mb_body, mb_det, M, x0, y0, x1, y1, hinge_left=True, m='LI_locker'):
    """stowage locker door: raised inner panel, captive fasteners in the corners, flush pull at the top"""
    mb_body.box(x0, y0, -0.006, x1, y1, 0.014, M, m)
    ins = 0.026
    mb_body.box(x0 + ins, y0 + ins, 0.008, x1 - ins, y1 - ins, 0.019, M, m)
    for x in (x0 + 0.013, x1 - 0.013):
        for y in (y0 + 0.013, y1 - 0.013):
            L = M @ T(x, y)
            mb_det.cyl(0.0068, 0.010, 0.0172, L, 'LI_metal', n=10)
            mb_det.box(-0.0052, -0.0011, 0.0168, 0.0052, 0.0011, 0.0182, L @ RZ(0.5), 'LI_black')
    xm = (x0 + x1) / 2
    yt = y1 - ins - 0.032 if (y1 - y0) > 0.2 else (y0 + y1) / 2
    L = M @ T(xm, yt)
    w = min(0.05, (x1 - x0) * 0.25)
    mb_det.box(-w, -0.013, 0.0175, w, 0.013, 0.0205, L, 'LI_black')
    mb_det.tube([L @ Vector((-w + 0.008, 0.0, 0.019)), L @ Vector((-w + 0.010, 0.0, 0.031)),
                 L @ Vector((w - 0.010, 0.0, 0.031)), L @ Vector((w - 0.008, 0.0, 0.019))], 0.0038, 'LI_metal', sides=8)
    # small status tab (latched = green) beside the pull
    mb_det.box(w + 0.008, -0.006, 0.0175, w + 0.022, 0.006, 0.0215, L, 'LI_lamp_green')


def w_handle(mb, p0, p1, normal, standoff=0.065, r=0.012, m='LI_metal'):
    p0, p1, nrm = Vector(p0), Vector(p1), Vector(normal).normalized()
    path = fillet([p0 - nrm * 0.005, p0 + nrm * standoff, p1 + nrm * standoff, p1 - nrm * 0.005], 0.035, 5)
    mb.tube(path, r, m, sides=10)
    for p in (p0, p1):
        d = (p1 - p0).normalized()
        side = nrm.cross(d)
        M = Matrix((list(side) + [0], list(d) + [0], list(nrm) + [0], [0, 0, 0, 1])).transposed()
        M = Matrix.Translation(p) @ M
        mb.box(-0.022, -0.028, -0.004, 0.022, 0.028, 0.010, M, 'LI_trim')


# ------------------------------------------------------------------ build
def build(ctx):
    read_exterior_consts(ctx.get('here', ''))
    build_materials()
    body = ctx['body']
    spec = ctx['spec']

    walls = MB(); backing = MB(); trim = MB(); det = MB(); lockers = MB(); floor = MB(); sub = MB()
    ceil = MB(); dock = MB(); panel = MB(); cables = MB(); handles = MB(); lights = MB(); feet = MB()

    # ---------------- floor: non-slip grid plates clipped to the octagon
    sub.prism(oct_off(-0.02), 2.93, 2.992, Matrix(), 'LI_floor_dark')
    xs = [-1.30, -0.65, 0.0, 0.65, 1.30]
    ys = [-1.40, -0.75, -0.10, 0.55, 1.20]
    g = 0.004
    for i in range(4):
        for j in range(4):
            poly = clip_oct(rect(xs[i] + g, ys[j] + g, xs[i + 1] - g, ys[j + 1] - g), shrink=0.002)
            if len(poly) >= 3:
                floor.prism(poly, 2.972, FLOOR, Matrix(), 'LI_floor')
                # countersunk screws at plate corners (only where the corner is a real rect corner)
                for cx, cy in ((xs[i] + 0.03, ys[j] + 0.03), (xs[i + 1] - 0.03, ys[j] + 0.03),
                               (xs[i] + 0.03, ys[j + 1] - 0.03), (xs[i + 1] - 0.03, ys[j + 1] - 0.03)):
                    if len(clip_oct([(cx - .01, cy - .01), (cx + .01, cy - .01), (cx + .01, cy + .01),
                                     (cx - .01, cy + .01)], 0.02)) == 4:
                        det.cyl(0.006, FLOOR - 0.003, FLOOR + 0.0008, T(cx, cy), 'LI_metal', n=8)

    # ---------------- skirting (mitred kick strip) + corner trims
    Wo = oct_off(-0.012); Wi = oct_off(0.016)
    for i in range(8):
        if i == BK:
            continue
        j = (i + 1) % 8
        if i == FT:   # split around the hatch (and keep clear of the door hinge)
            M, _ = facet(FT)
            for s0, s1 in ((0.58, 0.80), (-0.80, -0.45)):
                pts = [M @ Vector((s, 0, d)) for s, d in ((s0, -0.012), (s1, -0.012), (s1, 0.016), (s0, 0.016))]
                if s1 == 0.80:      # s = -x: the s = +0.80 end is octagon corner i (x = -0.80)
                    pts[1] = Vector((*Wo[i], 0)); pts[2] = Vector((*Wi[i], 0))
                if s0 == -0.80:
                    pts[0] = Vector((*Wo[j], 0)); pts[3] = Vector((*Wi[j], 0))
                ol = [(p.x, p.y) for p in pts]
                if sum((ol[k][0] * ol[(k + 1) % 4][1] - ol[(k + 1) % 4][0] * ol[k][1]) for k in range(4)) < 0:
                    ol.reverse()
                trim.prism(ol, 2.99, 3.11, Matrix(), 'LI_trim_dark')
            continue
        ol = [Wo[i], Wo[j], Wi[j], Wi[i]]
        if sum((ol[k][0] * ol[(k + 1) % 4][1] - ol[(k + 1) % 4][0] * ol[k][1]) for k in range(4)) < 0:
            ol.reverse()
        trim.prism(ol, 2.99, 3.11, Matrix(), 'LI_trim_dark')
    for i in range(8):
        if i in (BK + 0, BL):    # corners pts[3], pts[4] are inside the main console cheeks
            continue
        pi_, pp, pn = Vector((*OCT[i], 0)), Vector((*OCT[i - 1], 0)), Vector((*OCT[(i + 1) % 8], 0))
        a = pi_ + (pp - pi_).normalized() * 0.03; b = pi_ + (pn - pi_).normalized() * 0.03
        Mi, _ = facet(i); Mp_, _ = facet((i - 1) % 8)
        Ni = Mi.col[2].to_3d(); Np = Mp_.col[2].to_3d()
        bis = (Ni + Np).normalized()
        dc = 0.012
        ol = [a - Np * 0.01, pi_ - bis * 0.012, b - Ni * 0.01, b + Ni * dc, pi_ + bis * dc * 1.08, a + Np * dc]
        ol = [(p.x, p.y) for p in ol]
        if sum((ol[k][0] * ol[(k + 1) % 6][1] - ol[(k + 1) % 6][0] * ol[k][1]) for k in range(6)) < 0:
            ol.reverse()
        trim.prism(ol, 3.10, WALL_TOP + 0.005, Matrix(), 'LI_trim')

    # ---------------- wall tiles per facet (s, z rects; front at d=0, 0.03 thick)
    con_y = (-0.55, 0.55)   # side console extent in y
    con_z = (3.90, 4.70)

    def side_s(fi, y):
        return (y - YC) if fi == LT else -(y - YC)

    tiles = {i: [] for i in range(8)}
    # front wall: hatch opening x -0.45..0.45 (s = -x), z 3.00..4.40
    for s0, s1 in ((0.45, 0.80), (-0.80, -0.45)):
        tiles[FT] += [(s0, s1, 3.08, 3.72), (s0, s1, 3.72, 4.40), (s0, s1, 4.40, WALL_TOP)]
    tiles[FT] += [(-0.45, 0.45, 4.40, WALL_TOP)]
    # front chamfers: windows centred, 0.55 wide, z 4.55..5.05
    hole = [(s, z) for s, z in ccw([(-u, EXT['WIN_Z'] + v) for u, v in offset_poly(EXT['WIN'], 0.03)])]
    hb = min(z for s, z in hole); ht = min(max(z for s, z in hole), WALL_TOP - 0.012)
    for fi in (FL, FR):
        tiles[fi] += [(-0.354, 0.354, 3.08, 3.80), (-0.354, 0.354, 3.80, hb)]
    # side walls with the console cut-out
    for fi in (LT, RT):
        a, b = sorted((side_s(fi, con_y[0]), side_s(fi, con_y[1])))
        for s0, s1 in ((-0.80, a), (b, 0.80)):
            tiles[fi] += [(s0, s1, 3.08, con_z[0]), (s0, s1, con_z[0], con_z[1]), (s0, s1, con_z[1], WALL_TOP)]
        tiles[fi] += [(a, b, 3.08, 3.88), (a, b, con_z[1], WALL_TOP)]
    for fi in (BL, BR):
        tiles[fi] += [(-0.354, 0.354, 3.08, 3.90), (-0.354, 0.354, 3.90, 4.80), (-0.354, 0.354, 4.80, WALL_TOP)]
    tiles[BK] += [(-0.80, 0.80, 4.93, WALL_TOP)]
    seam = 0.0035
    for fi, lst in tiles.items():
        M, half = facet(fi)
        for s0, s1, z0, z1 in lst:
            mat = 'LI_wall_low' if z1 <= 3.90 else 'LI_wall'
            e0 = -seam if s0 <= -half + 1e-3 else seam   # run tiles into the corners
            e1 = seam if s1 >= half - 1e-3 else -seam
            walls.box(s0 + e0, z0 + seam, -0.03, s1 + e1 if s1 < half - 1e-3 else s1 + 0.02, z1 - seam, 0.0, M, mat)
            backing.box(s0, z0, -0.045, s1, z1, -0.028, M, 'LI_backing')

    # wall pieces around the window holes (convex quads), same seams/backing as the tiles
    bl_, br_ = sorted([p for p in hole if p[1] < hb + 1e-6], key=lambda p: p[0])
    tl_, tr_ = sorted(sorted(hole, key=lambda p: -p[1])[:2], key=lambda p: p[0])

    def at_z(p, q, z):
        t = (z - p[1]) / (q[1] - p[1]); return p[0] + t * (q[0] - p[0])
    for fi in (FL, FR):
        M, _ = facet(fi)
        z0 = hb + seam
        pieces = [[(-0.354 - seam, z0), (at_z(bl_, tl_, z0), z0), (at_z(bl_, tl_, ht), ht), (-0.354 - seam, ht)],
                  [(at_z(br_, tr_, z0), z0), (0.374, z0), (0.374, ht), (at_z(br_, tr_, ht), ht)]]
        if WALL_TOP - ht > 0.004:
            pieces.append([(-0.354 - seam, ht), (0.374, ht), (0.374, WALL_TOP - seam), (-0.354 - seam, WALL_TOP - seam)])
        for pc in pieces:
            walls.prism(ccw(pc), -0.03, 0.0, M, 'LI_wall')
            backing.prism(ccw(pc), -0.045, -0.028, M, 'LI_backing')

    # ---------------- hatch trim matching worker A's rounded opening (contour 4 mm inside A's jamb).
    # latch side + top bar protrude 24 mm; the hinge side stays flush so the 100 deg door clears it.
    M, _ = facet(FT)
    C = hatch_contour(-0.004)
    x0h, z0h, x1h, z1h = EXT['HATCH']
    p1 = [(x1h + 0.07, z0h - 0.005), (x1h + 0.07, z1h + 0.07), (-0.33, z1h + 0.07)] + [C[k] for k in range(21, 6, -1)]
    p2 = [(x0h - 0.07, z1h + 0.07), (x0h - 0.07, z0h - 0.005)] + [C[k] for k in range(6, -1, -1)] + \
         [C[k] for k in range(27, 20, -1)] + [(-0.33, z1h + 0.07)]
    trim.prism(ccw([(-x, z) for x, z in p1]), -0.01, 0.024, M, 'LI_trim')
    trim.prism(ccw([(-x, z) for x, z in p2]), -0.01, 0.0012, M, 'LI_trim_dark')
    # door seal strip details on the trim
    for z in (3.4, 3.9):
        det.box(-0.50, z - 0.03, 0.023, -0.47, z + 0.03, 0.03, M, 'LI_black')

    # ---------------- window bezels: inner lip 4 mm inside worker A's window jamb, outer edge covers the wall hole
    wo = win_contour(0.08); wi = win_contour(-0.004)
    if sum(wo[k][0] * wo[(k + 1) % len(wo)][1] - wo[(k + 1) % len(wo)][0] * wo[k][1] for k in range(len(wo))) < 0:
        wo.reverse(); wi.reverse()
    for fi in (FL, FR):
        M, _ = facet(fi)
        trim.ring(wo, wi, -0.012, 0.03, M, 'LI_trim')
        for s in (-0.20, 0.20):
            det.cyl(0.006, -0.001, 0.02, M @ T(s, hb - 0.10), 'LI_metal', n=8)

    # ---------------- ceiling: chamfer band + flat ceiling with the docking-hatch flange
    Wt = OCT; Cc = octagon(H_IN - CEIL_IN, K_IN - CEIL_IN * R2)
    cab = (0, YC, 4.0)
    for i in range(8):
        j = (i + 1) % 8
        q = [(*Wt[i], WALL_TOP), (*Wt[j], WALL_TOP), (*Cc[j], CEIL), (*Cc[i], CEIL)]
        ceil.slab3(q, 0.03, 'LI_ceiling', cab)
    # flat ceiling as a ring: octagon outline (4 samples per edge) bridged to the flange hole
    outer = []
    for i in range(8):
        a, b = Vector(Cc[i]), Vector(Cc[(i + 1) % 8])
        for k in range(4):
            outer.append(tuple(a + (b - a) * (k / 4)))
    inner = []
    for x, y in outer:
        ang = math.atan2(y - DOCK_C[1], x - DOCK_C[0])
        inner.append((DOCK_C[0] + 0.47 * math.cos(ang), DOCK_C[1] + 0.47 * math.sin(ang)))
    ceil.ring(outer, inner, CEIL, CEIL + 0.03, Matrix(), 'LI_ceiling')
    # transverse ribs
    for yy in (-0.80, 0.60):
        ceil.box(-1.15, yy - 0.03, CEIL - 0.022, 1.15, yy + 0.03, CEIL + 0.01, Matrix(), 'LI_trim')
    # light strips (warm white) along y at x = +-0.86
    for xx in (-0.86, 0.86):
        ceil.box(xx - 0.06, -0.74, CEIL - 0.022, xx + 0.06, 0.54, CEIL + 0.005, Matrix(), 'LI_trim_dark')
        lights.box(xx - 0.042, -0.725, CEIL - 0.032, xx + 0.042, 0.525, CEIL - 0.018, Matrix(), 'LI_light')

    # ---------------- overhead docking hatch
    D = T(DOCK_C[0], DOCK_C[1])
    dock.ring(circle(0.52, 48), circle(0.40, 48), CEIL - 0.03, CEIL + 0.004, D, 'LI_trim')
    dock.ring(circle(0.43, 48), circle(0.40, 48), CEIL - 0.01, 5.404, D, 'LI_trim_dark')
    dock.cyl(0.405, 5.36, 5.40, D, 'LI_ceiling', n=48)
    for k in range(16):
        a = 2 * math.pi * (k + 0.5) / 16
        det.cyl(0.007, CEIL - 0.036, CEIL - 0.025, D @ T(0.46 * math.cos(a), 0.46 * math.sin(a)), 'LI_metal', n=8)
    # hatch underside: hub, crank wheel, latch arms and dogs
    dock.cyl(0.07, 5.32, 5.365, D, 'LI_trim', n=24)
    dock.ring(circle(0.17, 32), circle(0.15, 32), 5.30, 5.315, D, 'LI_metal')
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.3
        R = D @ RZ(a)
        dock.box(0.05, -0.008, 5.302, 0.16, 0.008, 5.313, R, 'LI_metal')
    for k in range(6):
        a = 2 * math.pi * k / 6
        R = D @ RZ(a)
        dock.box(0.07, -0.012, 5.345, 0.36, 0.012, 5.362, R, 'LI_trim_dark')
        dock.box(0.355, -0.03, 5.335, 0.395, 0.03, 5.365, R, 'LI_metal')
    # handholds around the hatch
    for xx in (-0.62, 0.62):
        w_handle(handles, (xx, -0.45, CEIL), (xx, 0.25, CEIL), (0, 0, -1), standoff=0.07)
    for yy in (-0.70, 0.50):
        w_handle(handles, (-0.22, yy, CEIL), (0.22, yy, CEIL), (0, 0, -1), standoff=0.06)

    # ---------------- main console on the back wall
    # panel face plate + bezel
    panel.box(-0.799, -0.499, -0.02, 0.799, 0.499, 0.0, PM, 'LI_panel')
    trim.ring(rect(-0.85, -0.55, 0.85, 0.55), rect(-0.80, -0.50, 0.80, 0.50), -0.02, 0.025, PM, 'LI_trim')
    # lower console body, toe kick, cheeks, hood
    W = Matrix()
    trim.box(-0.80, 1.022, 3.11, 0.80, 1.085, 3.832, W, 'LI_console')
    trim.box(-0.80, 1.095, 2.99, 0.80, 1.20, 3.115, W, 'LI_trim_dark')
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 0.80, sx * 0.865))
        trim.box(x0, 0.972, 2.99, x1, 1.32, 4.95, W, 'LI_console')
    trim.box(-0.865, 0.972, 4.874, 0.865, 1.32, 4.955, W, 'LI_console')
    lights.box(-0.76, 0.99, 4.864, 0.76, 1.015, 4.876, W, 'LI_light_panel')
    # lower console lockers
    Mlc = Matrix(((1, 0, 0, 0), (0, 0, -1, 1.022), (0, 1, 0, 0), (0, 0, 0, 1)))   # (x, z, d) with d toward -y
    for x0, x1 in ((-0.76, -0.27), (-0.235, 0.235), (0.27, 0.76)):
        w_locker(lockers, det, Mlc, x0, 3.50, x1, 3.79)
        w_locker(lockers, det, Mlc, x0, 3.15, x1, 3.465)

    # --- panel instruments (panel coords a, u, w)
    # screens with bezels and soft keys
    for sx in (-1, 1):
        a0, a1 = sorted((sx * 0.18, sx * 0.76))
        trim.ring(rect(a0, 0.075, a1, 0.475), rect(a0 + 0.035, 0.125, a1 - 0.035, 0.44), -0.004, 0.022, PM, 'LI_trim_dark')
        panel.box(a0 + 0.034, 0.124, -0.004, a1 - 0.034, 0.441, 0.006, PM,
                  'LI_screen_L' if sx < 0 else 'LI_screen_R', top_uv=True)
        for k in range(5):
            aa = a0 + 0.075 + k * (a1 - a0 - 0.15) / 4
            det.box(aa - 0.017, 0.088, 0.02, aa + 0.017, 0.110, 0.029, PM, 'LI_cap_dark')
        for uu in (0.20, 0.28, 0.36):
            for aa in (a0 + 0.0175, a1 - 0.0175):
                det.box(aa - 0.008, uu - 0.014, 0.02, aa + 0.008, uu + 0.014, 0.028, PM, 'LI_cap_dark')
    # centre column: two gauges + lamp cluster
    w_plate(panel, PM, -0.165, 0.09, 0.165, 0.475)
    w_gauge(det, PM @ T(0, 0, 0.004), -0.083, 0.37, 0.068, math.radians(35))
    w_gauge(det, PM @ T(0, 0, 0.004), 0.083, 0.37, 0.068, math.radians(-60))
    lamp_cols = ['LI_lamp_green', 'LI_lamp_green', 'LI_lamp_amber', 'LI_lamp_white',
                 'LI_lamp_blue', 'LI_lamp_green', 'LI_lamp_red', 'LI_lamp_amber']
    for k in range(8):
        w_lamp(det, PM @ T(0, 0, 0.004), -0.105 + 0.07 * (k % 4), 0.25 - 0.055 * (k // 4), 0.011, lamp_cols[k])
    # toggle switch rows with guards (u ~ 0)
    for sx in (-1, 1):
        a0, a1 = sorted((sx * 0.18, sx * 0.77))
        w_plate(panel, PM, a0, -0.075, a1, 0.065)
        xs_ = [a0 + 0.06 + k * 0.067 for k in range(8)]
        for k, x in enumerate(xs_):
            w_toggle(det, PM @ T(0, 0, 0.004), x, -0.012, up=rng.random() < 0.55)
            w_lamp(det, PM @ T(0, 0, 0.004), x, 0.042, 0.006,
                   rng.choice(['LI_lamp_green', 'LI_lamp_green', 'LI_lamp_amber', 'LI_cap_dark']))
        for k in range(5):
            w_fin(det, PM @ T(0, 0, 0.004), a0 + 0.0265 + k * 0.134, -0.012, 0.075, 0.036)
    # centre knobs
    w_plate(panel, PM, -0.155, -0.075, 0.155, 0.065)
    w_knob(det, PM @ T(0, 0, 0.004), -0.07, -0.005, 0.6)
    w_knob(det, PM @ T(0, 0, 0.004), 0.07, -0.005, -1.1)
    # hero row (u = -0.15): collars (buttons are separate objects)
    for a in (-0.30, 0.0, 0.30):
        panel.ring(rect(a - 0.037, -0.187, a + 0.037, -0.113), rect(a - 0.0265, -0.1765, a + 0.0265, -0.1235),
                   -0.003, 0.0075, PM, 'LI_trim')
        w_lamp(det, PM, a, -0.085, 0.006, 'LI_lamp_white')
    for a in (-0.15, 0.15):
        for uu in (-0.125, -0.175):
            w_lamp(det, PM, a, uu, 0.008, 'LI_lamp_amber' if uu > -0.15 else 'LI_lamp_green')
    # push-button matrices
    caps = ['LI_lamp_green', 'LI_lamp_amber', 'LI_cap_dark', 'LI_lamp_blue', 'LI_cap_dark', 'LI_lamp_white',
            'LI_lamp_red', 'LI_cap_dark', 'LI_lamp_green', 'LI_cap_dark']
    for sx in (-1, 1):
        a0, a1 = sorted((sx * 0.405, sx * 0.77))
        w_plate(panel, PM, a0, -0.235, a1, -0.085)
        for r_ in range(2):
            for c_ in range(5):
                a = a0 + 0.05 + c_ * 0.066
                w_sqbutton(det, PM @ T(0, 0, 0.004), a, -0.125 - r_ * 0.07, 0.03, caps[(r_ * 5 + c_ + (sx > 0) * 3) % 10])
    # bottom-left gauges
    w_plate(panel, PM, -0.77, -0.475, -0.25, -0.26)
    for k, a in enumerate((-0.675, -0.51, -0.345)):
        w_gauge(det, PM @ T(0, 0, 0.004), a, -0.368, 0.068, math.radians(rng.uniform(-110, 110)))
    # bottom-right: toggles with guards + lamps
    w_plate(panel, PM, 0.25, -0.475, 0.77, -0.26)
    for k in range(6):
        x = 0.31 + k * 0.08
        w_toggle(det, PM @ T(0, 0, 0.004), x, -0.33, up=k % 3 != 1)
        w_lamp(det, PM @ T(0, 0, 0.004), x, -0.425, 0.009,
               ['LI_lamp_green', 'LI_lamp_amber', 'LI_lamp_green', 'LI_lamp_red', 'LI_lamp_green', 'LI_lamp_blue'][k])
    for k in range(4):
        w_fin(det, PM @ T(0, 0, 0.004), 0.27 + k * 0.16, -0.33, 0.07, 0.036)
    # launch: hazard plate, collar, cover hinge block
    panel.box(-0.105, -0.47, -0.003, 0.105, -0.275, 0.004, PM, 'LI_hazard', top_uv=True)
    panel.ring(circle(0.052, 32, 0, -0.38), circle(0.0375, 32, 0, -0.38), -0.002, 0.009, PM, 'LI_trim')
    panel.box(-0.075, -0.298, -0.002, 0.075, -0.276, 0.010, PM, 'LI_trim_dark')
    for a in (-0.055, 0.0, 0.055):
        Lh = PM @ T(a, -0.30, 0.010) @ Matrix.Rotation(math.pi / 2, 4, 'Y')
        det.cyl(0.0058, -0.012 if a else -0.016, 0.012 if a else 0.016, Lh, 'LI_metal', n=10)
    # screws around the panel bezel
    for a in (-0.825, 0.825):
        for uu in (-0.42, 0.0, 0.42):
            w_screw(det, PM, a, uu, 0.025)

    # ---------------- side consoles (face at the wall surface d = 0)
    for fi in (LT, RT):
        M, _ = facet(fi)
        a, b = sorted((side_s(fi, con_y[0]), side_s(fi, con_y[1])))
        sgn = 1 if fi == LT else -1     # mirror so both consoles read the same in world
        panel.box(a, con_z[0], -0.04, b, con_z[1], 0.0, M, 'LI_panel')
        trim.ring(rect(a - 0.04, con_z[0] - 0.04, b + 0.04, con_z[1] + 0.04), rect(a, con_z[0], b, con_z[1]),
                  -0.012, 0.024, M, 'LI_trim')
        sb = side_s(fi, 0.20)

        def S(u):          # console coordinate: u = 0 at the hero button, + toward the back wall
            return sb + sgn * u

        def zone(u0, u1, z0, z1, m='LI_subplate', screws=True):
            s0, s1 = sorted((S(u0), S(u1)))
            w_plate(panel, M, s0, z0, s1, z1, -0.003, 0.003, m, screws)
            return s0, s1
        Mz = M @ T(0, 0, 0.003)
        # hero zone: collar + guard fins + lamp above
        zone(-0.10, 0.10, 4.18, 4.44)
        panel.ring(rect(sb - 0.04, 4.26, sb + 0.04, 4.34), rect(sb - 0.029, 4.271, sb + 0.029, 4.329),
                   -0.003, 0.009, M, 'LI_trim')
        for ds in (-0.058, 0.058):
            w_fin(det, Mz, sb + ds, 4.30, 0.09, 0.04)
        w_lamp(det, Mz, sb, 4.395, 0.01, 'LI_lamp_green' if fi == LT else 'LI_lamp_amber')
        for k in range(3):
            w_lamp(det, Mz, S(-0.075 + 0.075 * k), 4.215, 0.006, ['LI_lamp_white', 'LI_lamp_blue', 'LI_lamp_red'][k])
        # small display above the hero
        s0, s1 = sorted((S(-0.12), S(0.12)))
        trim.ring(rect(s0, 4.475, s1, 4.685), rect(s0 + 0.02, 4.495, s1 - 0.02, 4.665), -0.003, 0.018, M, 'LI_trim_dark')
        panel.box(s0 + 0.019, 4.494, -0.003, s1 - 0.019, 4.666, 0.005, M,
                  'LI_screen_R' if fi == LT else 'LI_screen_L', top_uv=True)
        # gauges / 3x3 buttons / knobs toward the back
        zone(0.14, 0.33, 4.475, 4.685)
        for u in (0.188, 0.282):
            w_gauge(det, Mz, S(u), 4.58, 0.046, math.radians(rng.uniform(-100, 100)))
        zone(0.14, 0.33, 4.18, 4.44)
        for r_ in range(3):
            for c_ in range(3):
                w_sqbutton(det, Mz, S(0.172 + c_ * 0.063), 4.235 + r_ * 0.075, 0.026, caps[(r_ * 3 + c_ + fi) % 10])
        zone(0.14, 0.33, 3.925, 4.15)
        w_knob(det, Mz, S(0.19), 4.04, 0.8)
        w_knob(det, Mz, S(0.282), 4.04, -0.5)
        # bottom centre: lamp row + guarded toggle pair
        zone(-0.12, 0.12, 3.925, 4.15)
        for k in range(5):
            w_lamp(det, Mz, S(-0.08 + 0.04 * k), 4.115, 0.0065,
                   ['LI_lamp_green', 'LI_lamp_green', 'LI_lamp_amber', 'LI_cap_dark', 'LI_lamp_blue'][k])
        for k, u in enumerate((-0.04, 0.04)):
            w_toggle(det, Mz, S(u), 4.0, up=k == 0)
        for u in (-0.08, 0.0, 0.08):
            w_fin(det, Mz, S(u), 4.0, 0.075, 0.036)
        # toward the hatch: two toggle rows with guards and a gauge row between them
        for zz in (4.58, 4.04):
            zone(-0.72, -0.15, zz - 0.105, zz + 0.105)
            for k in range(8):
                u = -0.685 + k * 0.0705
                w_toggle(det, Mz, S(u), zz - 0.02, up=rng.random() < 0.6)
                w_lamp(det, Mz, S(u), zz + 0.05, 0.0058, rng.choice(['LI_lamp_green', 'LI_lamp_amber', 'LI_cap_dark']))
            for k in range(5):
                w_fin(det, Mz, S(-0.7205 + 0.0353 + k * 0.141), zz - 0.02, 0.075, 0.036)
        zone(-0.72, -0.15, 4.18, 4.44)
        for k, u in enumerate((-0.63, -0.485, -0.34)):
            w_gauge(det, Mz, S(u), 4.31, 0.06, math.radians(rng.uniform(-110, 110)))
        for k in range(3):
            w_lamp(det, Mz, S(-0.215), 4.24 + 0.07 * k, 0.009, ['LI_lamp_red', 'LI_lamp_amber', 'LI_lamp_green'][k])
        # lockers below the console
        mid = (a + b) / 2
        w_locker(lockers, det, M, a + 0.03, 3.17, mid - 0.02, 3.82, hinge_left=True)
        w_locker(lockers, det, M, mid + 0.02, 3.17, b - 0.03, 3.82, hinge_left=False)
        # vent grille above the console
        w_plate(panel, M, a + 0.10, 4.80, b - 0.10, 4.98, -0.002, 0.006, 'LI_trim_dark', screws=False)
        for k in range(7):
            zz = 4.82 + k * 0.022
            panel.box(a + 0.115, zz, 0.004, b - 0.115, zz + 0.008, 0.013, M, 'LI_trim')
        # grab handle along the wall in front of the console
        s_f = side_s(fi, -0.78)
        w_handle(handles, M @ Vector((s_f, 3.75, 0)), M @ Vector((s_f, 4.45, 0)), M.col[2].to_3d(), standoff=0.06)

    # ---------------- back chamfers: circuit-breaker panels + lockers
    for fi, (s0, s1) in ((BR, (-0.24, 0.30)), (BL, (-0.30, 0.24))):
        M, _ = facet(fi)
        panel.box(s0, 3.95, -0.01, s1, 4.78, 0.022, M, 'LI_panel')
        w_screws(det, M, s0, 3.95, s1, 4.78, 0.022)
        rows, cols = 5, 6
        for r_ in range(rows):
            zz = 4.66 - r_ * 0.15
            det.box(s0 + 0.03, zz + 0.038, 0.021, s1 - 0.03, zz + 0.05, 0.0245, M, 'LI_white')
            for c_ in range(cols):
                s = s0 + 0.065 + c_ * (s1 - s0 - 0.13) / (cols - 1)
                L = M @ T(s, zz, 0.021)
                det.cyl(0.0115, -0.001, 0.004, L, 'LI_white', n=12)
                pulled = rng.random() < 0.12
                det.cyl(0.0078, 0.0, 0.017 if pulled else 0.011, L, 'LI_black', n=12)
                if pulled:
                    det.cyl(0.0079, 0.011, 0.0135, L, 'LI_white', n=12)
        w_locker(lockers, det, M, s0 + 0.0, 3.16, s1 - 0.0, 3.84, hinge_left=(fi == BR))

    # ---------------- front chamfers: tall locker (left), extinguisher + kit box (right)
    M, _ = facet(FL)
    w_locker(lockers, det, M, -0.28, 3.16, 0.28, 4.40, hinge_left=False)
    M, _ = facet(FR)
    cpos = M @ Vector((0.05, 0, 0.105))      # bottle axis is vertical
    det.cyl(0.075, 3.24, 3.86, T(cpos.x, cpos.y), 'LI_bottle', n=24)
    det.cyl(0.055, 3.86, 3.90, T(cpos.x, cpos.y), 'LI_bottle', n=24)
    tv, nv = M.col[0].to_3d(), M.col[2].to_3d()
    det.cyl(0.024, 3.90, 3.975, T(cpos.x, cpos.y), 'LI_metal', n=16)
    ang = math.atan2(tv.y, tv.x)
    Lv = T(cpos.x, cpos.y) @ RZ(ang)
    det.box(-0.02, -0.011, 3.975, 0.10, 0.011, 3.988, Lv, 'LI_black')          # carry handle
    det.box(-0.015, -0.009, 3.95, 0.09, 0.009, 3.962, Lv @ T(0, 0, 0) @ Matrix.Rotation(math.radians(-8), 4, 'Y'), 'LI_black')
    hose = [cpos + tv * -0.02 + Vector((0, 0, 3.94)), cpos + tv * -0.07 + Vector((0, 0, 3.93)),
            cpos + tv * -0.085 + nv * 0.01 + Vector((0, 0, 3.80)), cpos + tv * -0.084 + nv * 0.02 + Vector((0, 0, 3.47))]
    det.tube(fillet(hose, 0.04, 5), 0.009, 'LI_black', sides=10)
    det.cyl(0.013, 3.42, 3.48, T(*(cpos + tv * -0.084 + nv * 0.02).xy), 'LI_metal', n=12)
    for zz in (3.36, 3.74):
        det.ring(circle(0.083, 24, cpos.x, cpos.y), circle(0.0745, 24, cpos.x, cpos.y), zz, zz + 0.03, Matrix(), 'LI_trim_dark')
        lockers.box(-0.03, zz - 0.004, -0.004, 0.03, zz + 0.034, 0.035, M @ T(0.05, 0), 'LI_trim_dark')
    lockers.box(-0.30, 4.02, -0.004, 0.30, 4.38, 0.11, M, 'LI_case')
    det.box(-0.303, 4.322, -0.002, 0.303, 4.331, 0.113, M, 'LI_black')          # lid seam
    for s_ in (-0.30, 0.30):
        for z_ in (4.02, 4.38):
            det.box(s_ - 0.022, z_ - 0.022, 0.08, s_ + 0.022, z_ + 0.022, 0.116, M, 'LI_black')   # corner bumpers
    Lk = M @ T(0, 0, 0.11)
    for s in (-0.18, 0.18):
        det.cyl(0.012, -0.002, 0.008, Lk @ T(s, 4.20), 'LI_metal', n=14)
        det.box(-0.009, -0.002, 0.006, 0.009, 0.002, 0.011, Lk @ T(s, 4.20), 'LI_black')
    det.tube([Lk @ Vector((-0.06, 4.33, 0.0)), Lk @ Vector((-0.06, 4.33, 0.03)), Lk @ Vector((0.06, 4.33, 0.03)),
              Lk @ Vector((0.06, 4.33, 0.0))], 0.005, 'LI_metal', sides=8)

    # ---------------- front wall: interior hatch button plate, handles, vent, comm box
    M, _ = facet(FT)
    w_plate(panel, M, 0.64, 3.86, 0.76, 4.12, -0.004, 0.003, 'LI_hazard', screws=False)
    panel.box(0.652, 3.872, 0.002, 0.748, 4.108, 0.0035, M, 'LI_subplate')   # inner plate over the stripes
    panel.ring(rect(0.70 - 0.036, 3.95 - 0.036, 0.70 + 0.036, 3.95 + 0.036),
               rect(0.70 - 0.0255, 3.95 - 0.0255, 0.70 + 0.0255, 3.95 + 0.0255), -0.002, 0.007, M, 'LI_trim')
    w_lamp(det, M @ T(0, 0, 0.003), 0.70, 4.06, 0.009, 'LI_lamp_red')
    w_lamp(det, M @ T(0, 0, 0.003), 0.70, 3.89, 0.006, 'LI_lamp_green')
    w_handle(handles, M @ Vector((-0.64, 3.55, 0)), M @ Vector((-0.64, 4.25, 0)), (0, 1, 0), standoff=0.06)
    w_handle(handles, M @ Vector((0.32, 4.62, 0)), M @ Vector((-0.32, 4.62, 0)), (0, 1, 0), standoff=0.06)
    w_plate(panel, M, -0.30, 4.80, 0.30, 4.98, -0.002, 0.006, 'LI_trim_dark', screws=False)
    for k in range(7):
        zz = 4.82 + k * 0.022
        panel.box(-0.285, zz, 0.004, 0.285, zz + 0.008, 0.013, M, 'LI_trim')
    # small comm/audio box right of the hatch
    w_plate(panel, M, -0.76, 4.52, -0.56, 4.74, -0.004, 0.02, 'LI_console')
    w_knob(det, M @ T(0, 0, 0.02), -0.705, 4.63, 0.4)
    w_knob(det, M @ T(0, 0, 0.02), -0.615, 4.63, -0.9)
    w_lamp(det, M @ T(0, 0, 0.02), -0.66, 4.70, 0.006, 'LI_lamp_green')

    # ---------------- cable bundles (along the wall tops into the breaker panels, and down the console cheeks)
    def oct_wall(p):
        best = None
        for fi_ in range(8):
            Mf, half = facet(fi_)
            Nf = Mf.col[2].to_3d(); cf = Mf.col[3].to_3d(); q = Vector((p.x, p.y, 0))
            d_ = (q - cf).dot(Nf); s_ = (q - cf).dot(Mf.col[0].to_3d())
            if abs(s_) <= half + 0.05 and (best is None or d_ < best[1]):
                best = (Nf, d_)
        return best

    def bundle(path_pts, n=5, r=0.0065, spread=0.012, clamp_every=0.30, wall_fn=oct_wall):
        path = fillet(path_pts, 0.06, 6)
        cols = ['LI_cable_k', 'LI_cable_g', 'LI_cable_k', 'LI_cable_r', 'LI_cable_b', 'LI_cable_y', 'LI_cable_g']
        offs = [(0, 0)] + [(spread * math.cos(2 * math.pi * k / (n - 1)), spread * math.sin(2 * math.pi * k / (n - 1)))
                           for k in range(n - 1)]
        for k, (ox, oy) in enumerate(offs):
            prof = [(ox + (r if k else r * 1.15) * math.cos(2 * math.pi * q / 6),
                     oy + (r if k else r * 1.15) * math.sin(2 * math.pi * q / 6)) for q in range(6)]
            cables.sweep(path, prof, cols[k % len(cols)], caps=True)
        # clamps every clamp_every metres, each with a foot down to the nearest wall
        total_len = sum((path[i] - path[i - 1]).length for i in range(1, len(path)))
        total = 0.0; nxt = 0.12
        foot = [(-0.006, -0.011), (0.006, -0.011), (0.006, 0.011), (-0.006, 0.011)]
        for i in range(1, len(path)):
            a, b = path[i - 1], path[i]
            L = (b - a).length
            while L > 1e-6 and nxt <= total + L and nxt < total_len - 0.08:
                p = a.lerp(b, (nxt - total) / L); tdir = (b - a).normalized()
                cables.sweep([p - tdir * 0.008, p + tdir * 0.008], circle(spread + r + 0.005, 10), 'LI_trim_dark', caps=True)
                wn = wall_fn(p) if wall_fn else None
                if wn and wn[1] > spread + r + 0.006:
                    Nw, dist = wn
                    cables.sweep([p - Nw * (spread + r + 0.003), p - Nw * (dist + 0.004)], foot, 'LI_trim_dark',
                                 caps=True, up=tdir)
                nxt += clamp_every
            total += L

    for fi, bfi, sgn in ((LT, BL, 1), (RT, BR, -1)):
        Mw, _ = facet(fi); Mb, _ = facet(bfi)
        z = 4.995
        s_start = side_s(fi, -0.80)
        s_end = side_s(fi, 0.66)
        sm = -0.02 * sgn if fi == LT else 0.02
        pts = [Mw @ Vector((s_start, 5.13, 0.03)), Mw @ Vector((s_start, z, 0.03)), Mw @ Vector((s_end, z, 0.03)),
               Mb @ Vector((-0.25 * sgn, z, 0.03)), Mb @ Vector((0.0, z, 0.032)), Mb @ Vector((0.0, 4.80, 0.04))]
        bundle(pts)
    # down the console cheeks to the floor
    for sx in (-1, 1):
        x = sx * 0.885
        pts = [Vector((x, 1.05, 4.94)), Vector((x, 1.05, 4.10)), Vector((x, 1.0, 3.40)), Vector((x, 1.05, 3.02))]
        bundle(pts, n=4, r=0.006, spread=0.01, wall_fn=None)

    # ---------------- foot restraints at the standing spot
    sx_, sy_, sz_ = spec['stand_panel']
    for fx in (-0.13, 0.13):
        cx = sx_ + fx; cy = sy_ + 0.02
        feet.box(cx - 0.075, cy - 0.17, FLOOR - 0.004, cx + 0.075, cy + 0.15, FLOOR + 0.007, Matrix(), 'LI_rubber')
        arch = [Vector((cx - 0.072, cy + 0.03, FLOOR + 0.004)), Vector((cx - 0.066, cy + 0.03, FLOOR + 0.065)),
                Vector((cx + 0.066, cy + 0.03, FLOOR + 0.065)), Vector((cx + 0.072, cy + 0.03, FLOOR + 0.004))]
        prof = [(-0.005, -0.04), (0.005, -0.04), (0.005, 0.04), (-0.005, 0.04)]
        feet.sweep(fillet(arch, 0.03, 5), prof, 'LI_strap', caps=True, up=(0, 1, 0))
        for ex in (-0.072, 0.072):
            feet.box(cx + ex - 0.014, cy - 0.018, FLOOR, cx + ex + 0.014, cy + 0.078, FLOOR + 0.02, Matrix(), 'LI_trim')

    # ---------------- soft stowage bags on the side walls' front sections + velcro patches
    bags = MB()
    for fi, (y0, y1, z0, z1) in ((LT, (-0.86, -0.56, 3.22, 3.66)), (RT, (-0.86, -0.60, 3.20, 3.52))):
        M, _ = facet(fi)
        s0, s1 = sorted((side_s(fi, y0), side_s(fi, y1)))
        bags.prism(ccw(rrect(s0, z0, s1, z1, 0.035, 3)), -0.004, 0.10, M, 'LI_fabric')
        for sc_ in (s0 + (s1 - s0) * 0.28, s0 + (s1 - s0) * 0.72):
            det.box(sc_ - 0.014, z0 - 0.03, -0.002, sc_ + 0.014, z1 + 0.03, 0.108, M, 'LI_strap')
            det.box(sc_ - 0.02, z1 + 0.01, 0.0, sc_ + 0.02, z1 + 0.05, 0.012, M, 'LI_trim')
    for fi, s, z in ((LT, -0.62, 4.62), (LT, 0.74, 3.98), (RT, -0.70, 4.20), (RT, 0.62, 4.62), (FT, 0.62, 4.75),
                     (FT, -0.62, 3.25), (BL, 0.0, 4.88), (BR, 0.0, 4.88), (FL, -0.25, 3.60), (FR, 0.25, 3.65)):
        M, _ = facet(fi)
        det.box(s - 0.025, z - 0.035, -0.001, s + 0.025, z + 0.035, 0.0025, M, 'LI_velcro')

    # ---------------- objects
    make_obj(ctx, 'int_subfloor', sub, smooth=False)
    make_obj(ctx, 'int_floor_plates', floor, bevel=0.003, seg=2)
    make_obj(ctx, 'int_wall_backing', backing, smooth=False)
    make_obj(ctx, 'int_wall_panels', walls, bevel=0.007, seg=3)
    make_obj(ctx, 'int_trim', trim, bevel=0.004, seg=2)
    make_obj(ctx, 'int_ceiling', ceil, bevel=0.005, seg=2)
    make_obj(ctx, 'int_docking_hatch', dock, bevel=0.003, seg=2)
    make_obj(ctx, 'int_panels', panel, bevel=0.0018, seg=2)
    make_obj(ctx, 'int_lockers', lockers, bevel=0.005, seg=3)
    make_obj(ctx, 'int_details', det, angle=35)
    make_obj(ctx, 'int_handles', handles, angle=50)
    make_obj(ctx, 'int_cables', cables, angle=70)
    make_obj(ctx, 'int_light_strips', lights, bevel=0.004)
    make_obj(ctx, 'int_foot_restraints', feet, bevel=0.003)
    make_obj(ctx, 'int_stowage_bags', bags, bevel=0.03, seg=4, angle=60)

    build_heroes(ctx)
    build_lights(ctx)
    build_actions(ctx)

    # report
    dg = bpy.context.evaluated_depsgraph_get()
    tris = 0
    for o in ctx['col_int'].all_objects:
        if o.type == 'MESH':
            me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles(); tris += len(me.loop_triangles)
            o.evaluated_get(dg).to_mesh_clear()
    print('LV2-B interior objects', len(ctx['col_int'].all_objects), 'triangles', tris, flush=True)


# ------------------------------------------------------------------ hero buttons
HERO = {   # name: (shape, half size / radius, colour)
    'btn_main_1': ('sq', 0.0235, (0.15, 1.0, 0.3)),
    'btn_main_2': ('sq', 0.0235, (1.0, 0.6, 0.06)),
    'btn_main_3': ('sq', 0.0235, (0.15, 0.5, 1.0)),
    'btn_launch': ('round', 0.0335, (1.0, 0.05, 0.03)),
    'btn_side_L': ('sq', 0.026, (0.15, 1.0, 0.3)),
    'btn_side_R': ('sq', 0.026, (1.0, 0.6, 0.06)),
    'btn_hatch_int': ('sq', 0.023, (1.0, 0.75, 0.05)),
}


def frame_for(name, spec):
    face, pdir = spec['buttons'][name]
    z = -Vector(pdir).normalized()
    up = Vector((0, 0, 1))
    if abs(z.dot(up)) > 0.5:
        up = Vector((0, 1, 0))
    y = (up - up.dot(z) * z).normalized()
    x = y.cross(z)
    R = Matrix((x, y, z)).transposed()
    return Vector(face), R


def build_heroes(ctx):
    spec = ctx['spec']
    for name, (shape, h, col) in HERO.items():
        face, R = frame_for(name, spec)
        if name.startswith('btn_main') or name == 'btn_launch':
            R = PM.to_3x3()      # exact panel frame (local x = world x)
        mb = MB()
        mat = hero_mat(name, col)
        MAT[mat.name] = mat
        if shape == 'sq':
            mb.box(-h, -h, -0.03, h, h, 0.0, Matrix(), mat.name)
            mb.box(-h * 0.55, -h * 0.55, -0.0005, h * 0.55, h * 0.55, 0.0006, Matrix(), mat.name)
        else:
            mb.cyl(h, -0.03, -0.004, Matrix(), mat.name, n=32)
            mb.cyl(h * 0.93, -0.0045, 0.0, Matrix(), mat.name, n=32)
        o = make_obj(ctx, name, mb, bevel=0.0028 if shape == 'sq' else 0.0035, seg=3)
        o.location = face
        o.rotation_euler = R.to_euler()
        o['press_dir'] = list(spec['buttons'][name][1])
        o['travel'] = 0.012
    # flip cover over btn_launch: origin on the hinge (top edge), local x = panel x
    mb = MB()
    mat = new_mat('LI_btn_launch_cover', (1.0, 0.30, 0.24), 0.04)
    principled(mat).inputs['Transmission Weight'].default_value = 1.0
    principled(mat).inputs['IOR'].default_value = 1.49
    outer = rrect(-0.064, -0.166, 0.064, -0.002, 0.008)
    inner = rrect(-0.060, -0.162, 0.060, -0.006, 0.005)
    mb.cup(outer, inner, -0.0075, 0.042, 0.0035, Matrix(), mat.name)
    # hinge knuckles on the cover + a finger tab at the free edge
    for a in (-0.0275, 0.0275):
        mb.cyl(0.0055, -0.013, 0.013, T(a, 0.0, 0.0) @ Matrix.Rotation(math.pi / 2, 4, 'Y'), 'LI_metal', n=10)
    mb.box(-0.03, -0.178, 0.026, 0.03, -0.163, 0.034, Matrix(), mat.name)
    o = make_obj(ctx, 'btn_launch_cover', mb, bevel=0.0012, seg=2)
    o.location = PM @ Vector((0, -0.30, 0.010))
    o.rotation_euler = PM.to_3x3().to_euler()
    o['open_deg'] = 110.0


# ------------------------------------------------------------------ lights
def build_lights(ctx):
    def area(name, loc, size, size_y, energy, rot=(0, 0, 0), col=(1.0, 0.86, 0.70)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.shape = 'RECTANGLE'
        ld.size, ld.size_y = size, size_y
        ld.energy = energy
        ld.color = col
        o = bpy.data.objects.new(name, ld)
        o.location = loc
        o.rotation_euler = rot
        ctx['col_int'].objects.link(o)
        o.parent = ctx['body']
        try:
            o.visible_camera = False
            o.visible_glossy = False
        except Exception:
            pass
        return o
    area('LI_cabin_light', (0, YC, 5.12), 1.9, 1.6, 140.0)
    area('LI_panel_light', (0, 1.02, 4.85), 1.4, 0.06, 18.0, rot=(math.radians(-20), 0, 0), col=(1.0, 0.9, 0.78))


# ------------------------------------------------------------------ actions
def _channelbag(act, slot):
    if not act.layers:
        lay = act.layers.new('Layer')
        lay.strips.new(type='KEYFRAME')
    strip = act.layers[0].strips[0]
    return strip.channelbag(slot, ensure=True)


def _key(fc, pts, interp='BEZIER'):
    for f, v in pts:
        kp = fc.keyframe_points.insert(f, v)
        kp.interpolation = interp
    fc.update()


def _new_action(name, f0, f1):
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    act.use_frame_range = True
    act.frame_start, act.frame_end = f0, f1
    return act


def _emission_path(m):
    return emission_socket(m).path_from_id('default_value')


def press_action(name, obj_loc, pdir_parent, mat, on=6.0):
    """0.5 s at 30 fps: in 0.1 s (f1->f4), hold 0.1 s (f4->f7), out 0.3 s (f7->f16); light on at the press."""
    act = _new_action('Press_' + name, 1, 16)
    slot = act.slots.new(id_type='OBJECT', name=name)
    cb = _channelbag(act, slot)
    loc0 = Vector(obj_loc); d = Vector(pdir_parent).normalized() * 0.012
    for i in range(3):
        fc = cb.fcurves.new('location', index=i)
        fc.group = cb.groups.new('Object Transforms') if not cb.groups.get('Object Transforms') else cb.groups['Object Transforms']
        _key(fc, [(1, loc0[i]), (4, loc0[i] + d[i]), (7, loc0[i] + d[i]), (16, loc0[i])])
    if mat is not None:
        s2 = act.slots.new(id_type='NODETREE', name=mat.name)
        cb2 = _channelbag(act, s2)
        fc = cb2.fcurves.new(_emission_path(mat))
        _key(fc, [(1, 0.0), (3, 0.0), (5, on), (16, on)])
    return act


def build_actions(ctx):
    spec = ctx['spec']
    for name in list(HERO) + ['btn_hatch_ext']:
        o = bpy.data.objects.get(name)
        pdir = Vector(spec['buttons'][name][1])
        if o is not None:
            if o.parent:
                Mp = o.parent.matrix_world @ o.matrix_parent_inverse
                pdir_p = Mp.to_3x3().inverted() @ pdir
            else:
                pdir_p = pdir
            mat = None
            if o.type == 'MESH' and o.active_material and o.active_material.users <= 1 and o.active_material.node_tree:
                if o.active_material.node_tree.nodes.get('Principled BSDF'):
                    mat = o.active_material
            press_action(name, o.location, pdir_p, mat, on=6.0 if name != 'btn_hatch_ext' else 5.0)
        else:
            # worker A's object is not in the scene yet: absolute keys at the spec face centre (lander_body space)
            press_action(name, spec['buttons'][name][0], pdir, None)
    # CoverOpen: hinge flips the cover up 110 deg in 0.6 s
    cov = bpy.data.objects['btn_launch_cover']
    act = _new_action('CoverOpen', 1, 19)
    slot = act.slots.new(id_type='OBJECT', name='btn_launch_cover')
    cb = _channelbag(act, slot)
    r0 = cov.rotation_euler.copy()
    for i in range(3):
        fc = cb.fcurves.new('rotation_euler', index=i)
        v1 = r0[i] - math.radians(110.0) if i == 0 else r0[i]
        _key(fc, [(1, r0[i]), (16, v1 + (math.radians(-4) if i == 0 else 0)), (19, v1)])
    # PanelBoot: 2 s (f1..f61): screens flicker on, gauges, then lamps cascade
    act = _new_action('PanelBoot', 1, 61)
    plan = {
        'LI_screen_L': [(1, 0), (8, 0), (9, 2.6), (11, 0.3), (14, 2.2), (16, 0.8), (24, 2.0)],
        'LI_screen_R': [(1, 0), (14, 0), (15, 2.4), (17, 0.2), (20, 2.2), (22, 1.0), (30, 2.0)],
        'LI_gauge': [(1, 0), (18, 0), (34, 1.2)],
        'LI_needle': [(1, 0), (18, 0), (34, 1.5)],
        'LI_lamp_white': [(1, 0), (4, 0), (6, 2.5)],
        'LI_lamp_green': [(1, 0), (26, 0), (30, 3.0)],
        'LI_lamp_amber': [(1, 0), (34, 0), (38, 3.0)],
        'LI_lamp_blue': [(1, 0), (42, 0), (46, 3.0)],
        'LI_lamp_red': [(1, 0), (10, 0), (12, 3.0), (20, 3.0), (22, 0.0), (50, 0.0), (54, 3.0)],
        'LI_light_panel': [(1, 0.6), (3, 6.0)],
    }
    for mname, keys in plan.items():
        m = MAT[mname]
        slot = act.slots.new(id_type='NODETREE', name=mname)
        cb = _channelbag(act, slot)
        fc = cb.fcurves.new(_emission_path(m))
        _key(fc, [(f, float(v)) for f, v in keys], interp='LINEAR')
        _key(fc, [(61, float(keys[-1][1]))], interp='LINEAR')
    act['slots_to_ids'] = 'each NODETREE slot is named after the material whose node_tree it drives'


def assign_action(name):
    """Hook action `name` up to every ID it has a slot for (objects by name, node trees by material name)."""
    act = bpy.data.actions[name]
    for slot in act.slots:
        nm = slot.name_display
        if slot.target_id_type == 'OBJECT':
            idb = bpy.data.objects.get(nm)
        else:
            m = bpy.data.materials.get(nm)
            if m is None:   # Press_btn_hatch_ext etc: material named after the slot may not exist
                continue
            idb = m.node_tree
        if idb is None:
            continue
        ad = idb.animation_data_create()
        ad.action = act
        ad.action_slot = slot
    return act
