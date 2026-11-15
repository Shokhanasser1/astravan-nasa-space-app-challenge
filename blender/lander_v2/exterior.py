"""Lander v2 — EXTERIOR (worker A). Called by build_lander_v2.py as build(ctx). Local only.

Builds, all procedurally (no imported models):
  descent stage (gold-foil octagon, frame, bell, legs, pads, probes, RCS crosses, boxes), porch + handrails,
  ladder (SPEC rung/rail contract), ascent-stage SHELL (0.04 m skin with real hatch/window holes + jambs that
  reach the 0.15 m inner surface), hatch door on `hatch_pivot`, exterior hatch button + lamp, windows, sensor
  strip, docking tunnel, whips, small dish, RCS quads, big 12-gore mesh antenna (`antenna_big_pivot`), round
  mesh dish (`antenna_small_pivot`), robotic arm (named pivots, three-claw gripper) and the actions
  HatchOpen / HatchClose / ArmIdle / AntennaScan.
Materials are prefixed LX_. Nothing is built inside the interior volume x±1.30, y -1.40..1.20, z 3.00..5.20
(except the hatch door, which swings into it).
"""
import math
import bpy
import bmesh
from mathutils import Vector, Matrix, noise as mnoise

V = Vector
ZUP = V((0, 0, 1))
CTX = {}


def log(*a):
    print('LV2 ext', *a, flush=True)


# =============================================================================================== geometry helpers
def frame(n):
    """u, v, n with u x v = n."""
    n = V(n).normalized()
    a = V((0, 0, 1)) if abs(n.z) < 0.9 else V((1, 0, 0))
    u = a.cross(n).normalized()
    v = n.cross(u)
    return u, v, n


def mframe(c, U, Vv, N, s=(1, 1, 1)):
    m = Matrix.Identity(4)
    for i in range(3):
        m[i][0] = U[i] * s[0]
        m[i][1] = Vv[i] * s[1]
        m[i][2] = N[i] * s[2]
        m[i][3] = c[i]
    return m


def offset_poly(pts, d):
    """Offset a convex CCW 2D polygon outward by d (negative = inward)."""
    n = len(pts)
    lines = []
    for i in range(n):
        a = V(pts[i]); b = V(pts[(i + 1) % n])
        t = (b - a).normalized()
        nr = V((t.y, -t.x))
        lines.append((a + nr * d, t))
    out = []
    for i in range(n):
        p1, t1 = lines[i - 1]
        p2, t2 = lines[i]
        den = t1.x * t2.y - t1.y * t2.x
        s = ((p2.x - p1.x) * t2.y - (p2.y - p1.y) * t2.x) / den
        q = p1 + t1 * s
        out.append((q.x, q.y))
    return out


def round_poly(pts, r, n=6):
    """Fillet every corner of a convex CCW polygon (r = float or per-corner list). Same point count for same n."""
    out = []
    N = len(pts)
    for i in range(N):
        rr = r[i] if isinstance(r, (list, tuple)) else r
        rr = max(rr, 1e-4)
        a = V(pts[i - 1]); b = V(pts[i]); c = V(pts[(i + 1) % N])
        d1 = (a - b).normalized(); d2 = (c - b).normalized()
        ang = d1.angle(d2)
        bis = (d1 + d2).normalized()
        cen = b + bis * (rr / math.sin(ang / 2))
        p1 = b + d1 * (rr / math.tan(ang / 2))
        p2 = b + d2 * (rr / math.tan(ang / 2))
        a1 = math.atan2(p1.y - cen.y, p1.x - cen.x)
        a2 = math.atan2(p2.y - cen.y, p2.x - cen.x)
        da = a2 - a1
        while da <= -math.pi:
            da += 2 * math.pi
        while da > math.pi:
            da -= 2 * math.pi
        for k in range(n + 1):
            t = a1 + da * k / n
            out.append((cen.x + rr * math.cos(t), cen.y + rr * math.sin(t)))
    return out


def rect(x0, y0, x1, y1):
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]


def fillet(pts, r, n=8):
    pts = [V(p) for p in pts]
    out = [pts[0]]
    for i in range(1, len(pts) - 1):
        a, b, c = pts[i - 1], pts[i], pts[i + 1]
        d1 = a - b; d2 = c - b
        l1, l2 = d1.length, d2.length
        d1.normalize(); d2.normalize()
        ang = d1.angle(d2)
        if ang > math.pi - 1e-3:
            out.append(b)
            continue
        td = min(r / math.tan(ang / 2), l1 * 0.48, l2 * 0.48)
        p1 = b + d1 * td; p2 = b + d2 * td
        for k in range(n + 1):
            t = k / n
            out.append((1 - t) ** 2 * p1 + 2 * (1 - t) * t * b + t * t * p2)
    out.append(pts[-1])
    return out


class MB:
    """bmesh builder: many parts, several materials, one object."""

    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.mats = []

    def mi(self, mat):
        if mat not in self.mats:
            self.mats.append(mat)
        return self.mats.index(mat)

    def nf(self):
        return len(self.bm.faces)

    def _tag(self, f0, mat, smooth=True):
        self.bm.faces.ensure_lookup_table()
        i = self.mi(mat)
        for f in self.bm.faces[f0:]:
            f.material_index = i
            f.smooth = smooth

    def strip(self, rings, closed=True, cap0=False, cap1=False):
        bm = self.bm
        for a, b in zip(rings[:-1], rings[1:]):
            n = len(a)
            for i in range(n if closed else n - 1):
                j = (i + 1) % n
                bm.faces.new((a[i], a[j], b[j], b[i]))
        if cap0:
            bm.faces.new(list(reversed(rings[0])))
        if cap1:
            bm.faces.new(rings[-1])

    def revolve(self, origin, axis, prof, mat, segs=24, cap0=True, cap1=True, smooth=True, phase=0.0):
        O = V(origin); ax = V(axis).normalized()
        u, v, _ = frame(ax)
        f0 = self.nf()
        rings = []
        for (r, h) in prof:
            rings.append([self.bm.verts.new(O + ax * h + (u * math.cos(phase + 2 * math.pi * k / segs) +
                                                          v * math.sin(phase + 2 * math.pi * k / segs)) * r)
                          for k in range(segs)])
        self.strip(rings, True, cap0 and prof[0][0] > 1e-6, cap1 and prof[-1][0] > 1e-6)
        self._tag(f0, mat, smooth)

    def cyl(self, p0, p1, r, mat, segs=16, caps=True, r1=None):
        p0 = V(p0); p1 = V(p1)
        L = (p1 - p0).length
        self.revolve(p0, p1 - p0, [(r, 0.0), (r if r1 is None else r1, L)], mat, segs, caps, caps)

    def sphere(self, c, r, mat, segs=16, rings=8):
        f0 = self.nf()
        bmesh.ops.create_uvsphere(self.bm, u_segments=segs, v_segments=rings, radius=r,
                                  matrix=Matrix.Translation(V(c)))
        self._tag(f0, mat)

    def box(self, c, size, mat, axes=None, smooth=True):
        U, Vv, N = axes or (V((1, 0, 0)), V((0, 1, 0)), V((0, 0, 1)))
        f0 = self.nf()
        bmesh.ops.create_cube(self.bm, size=1.0, matrix=mframe(V(c), V(U), V(Vv), V(N), size))
        self._tag(f0, mat, smooth)

    def beam(self, p0, p1, w, h, mat, up=None):
        """box from p0 to p1 with cross-section w x h (h along `up`)."""
        p0 = V(p0); p1 = V(p1)
        d = p1 - p0
        L = d.length
        ax = d / L
        up = V(up) if up is not None else (ZUP if abs(ax.z) < 0.9 else V((1, 0, 0)))
        s = up.cross(ax).normalized()
        u2 = ax.cross(s)
        self.box((p0 + p1) / 2, (L, w, h), mat, (ax, s, u2))

    def sweep(self, pts, r, mat, segs=12, cap0=True, cap1=True):
        pts = [V(p) for p in pts]
        n = len(pts)
        tans = []
        for i in range(n):
            if i == 0:
                t = pts[1] - pts[0]
            elif i == n - 1:
                t = pts[-1] - pts[-2]
            else:
                t = (pts[i + 1] - pts[i]).normalized() + (pts[i] - pts[i - 1]).normalized()
            tans.append(t.normalized())
        u, v, _ = frame(tans[0])
        f0 = self.nf()
        rings = []
        for i in range(n):
            if i > 0:
                u = (u - tans[i] * u.dot(tans[i])).normalized()
            v = tans[i].cross(u)
            rings.append([self.bm.verts.new(pts[i] + (u * math.cos(2 * math.pi * k / segs) +
                                                       v * math.sin(2 * math.pi * k / segs)) * r)
                          for k in range(segs)])
        self.strip(rings, True, cap0, cap1)
        self._tag(f0, mat)

    def prism(self, poly, O, U, Vv, N, d0, d1, mat, smooth=False):
        O = V(O)
        f0 = self.nf()
        b = [self.bm.verts.new(O + U * x + Vv * y + N * d0) for x, y in poly]
        t = [self.bm.verts.new(O + U * x + Vv * y + N * d1) for x, y in poly]
        self.strip([b, t], True, True, True)
        self._tag(f0, mat, smooth)

    def ring_prism(self, outer, inner, O, U, Vv, N, d0, d1, mat, smooth=False):
        O = V(O)
        bm = self.bm
        f0 = self.nf()
        P = lambda x, y, d: bm.verts.new(O + U * x + Vv * y + N * d)
        ob = [P(x, y, d0) for x, y in outer]; ot = [P(x, y, d1) for x, y in outer]
        ib = [P(x, y, d0) for x, y in inner]; it = [P(x, y, d1) for x, y in inner]
        n = len(outer)
        self.strip([ob, ot], True)
        self.strip([it, ib], True)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((it[i], ot[i], ot[j], it[j]))
            bm.faces.new((ib[i], ib[j], ob[j], ob[i]))
        self._tag(f0, mat, smooth)

    def to_object(self, parent, mw=None, sharp=32.0, bevel=None, merge=0.0, origin=None, name=None):
        """Make the object. mw = parent's world matrix (geometry is given in world space)."""
        bm = self.bm
        if merge > 0:
            bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=merge)
        thr = math.radians(sharp)
        for e in bm.edges:
            if len(e.link_faces) == 2:
                try:
                    if e.calc_face_angle() > thr:
                        e.smooth = False
                except ValueError:
                    e.smooth = False
            else:
                e.smooth = False
        nm = name or self.name
        me = bpy.data.meshes.new(nm)
        bm.to_mesh(me)
        bm.free()
        for m in self.mats:
            me.materials.append(m)
        if mw is not None:
            me.transform(mw.inverted())
        o = bpy.data.objects.new(nm, me)
        CTX['col_ext'].objects.link(o)
        o.parent = parent
        if origin is not None:
            me.transform(Matrix.Translation(-V(origin)))
            o.location = V(origin)
        if bevel:
            w, segs = bevel[0], bevel[1]
            ang = bevel[2] if len(bevel) > 2 else 32.0
            b = o.modifiers.new('bevel', 'BEVEL')
            b.width = w
            b.segments = segs
            b.limit_method = 'ANGLE'
            b.angle_limit = math.radians(ang)
            b.use_clamp_overlap = True
            b.harden_normals = True
            b.miter_outer = 'MITER_ARC'
        return o


def empty(name, parent, parent_mw, mw, size=0.25, rot_mode='XYZ'):
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = size
    o.empty_display_type = 'PLAIN_AXES'
    CTX['col_ext'].objects.link(o)
    o.parent = parent
    o.rotation_mode = rot_mode
    o.matrix_basis = parent_mw.inverted() @ mw
    return o


# =============================================================================================== materials
def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)


class NT:
    def __init__(self, mat):
        self.t = mat.node_tree
        self.N = self.t.nodes
        self.L = self.t.links

    def n(self, typ, **kw):
        nd = self.N.new(typ)
        for k, v in kw.items():
            setattr(nd, k, v)
        return nd

    def s(self, sock, val):
        if isinstance(val, bpy.types.NodeSocket):
            self.L.new(val, sock)
        else:
            if sock.type == 'RGBA' and isinstance(val, (tuple, list)) and len(val) == 3:
                val = tuple(val) + (1.0,)
            if sock.type == 'VECTOR' and isinstance(val, (int, float)):
                val = (val, val, val)
            sock.default_value = val

    def math(self, op, a, b=0.0, clamp=False):
        nd = self.N.new('ShaderNodeMath')
        nd.operation = op
        nd.use_clamp = clamp
        self.s(nd.inputs[0], a)
        self.s(nd.inputs[1], b)
        return nd.outputs[0]

    def vmath(self, op, a, b=None, scale=None):
        nd = self.N.new('ShaderNodeVectorMath')
        nd.operation = op
        self.s(nd.inputs[0], a)
        if b is not None:
            self.s(nd.inputs[1], b)
        if scale is not None:
            self.s(nd.inputs[3], scale)
        return nd.outputs[1] if op in ('DOT_PRODUCT', 'LENGTH', 'DISTANCE') else nd.outputs[0]

    def mix(self, fac, a, b):
        nd = self.N.new('ShaderNodeMix')
        nd.data_type = 'RGBA'
        nd.clamp_factor = True
        self.s(nd.inputs[0], fac)
        self.s(nd.inputs[6], a)
        self.s(nd.inputs[7], b)
        return nd.outputs[2]

    def mixf(self, fac, a, b):
        nd = self.N.new('ShaderNodeMix')
        nd.data_type = 'FLOAT'
        nd.clamp_factor = True
        self.s(nd.inputs[0], fac)
        self.s(nd.inputs[2], a)
        self.s(nd.inputs[3], b)
        return nd.outputs[0]

    def mr(self, val, a, b, c=0.0, d=1.0, smooth=True):
        if a > b:   # smoothstep needs from_min < from_max: flip the range and the output instead
            a, b, c, d = b, a, d, c
        nd = self.N.new('ShaderNodeMapRange')
        nd.interpolation_type = 'SMOOTHSTEP' if smooth else 'LINEAR'
        nd.clamp = True
        self.s(nd.inputs[0], val)
        nd.inputs[1].default_value = a
        nd.inputs[2].default_value = b
        nd.inputs[3].default_value = c
        nd.inputs[4].default_value = d
        return nd.outputs[0]

    def noise(self, vec, scale, detail=2.0, rough=0.5, dist=0.0):
        nd = self.N.new('ShaderNodeTexNoise')
        self.s(nd.inputs['Vector'], vec)
        nd.inputs['Scale'].default_value = scale
        nd.inputs['Detail'].default_value = detail
        nd.inputs['Roughness'].default_value = rough
        nd.inputs['Distortion'].default_value = dist
        return nd

    def vor(self, vec, scale, feature='F1', rnd=1.0):
        nd = self.N.new('ShaderNodeTexVoronoi')
        nd.feature = feature
        self.s(nd.inputs['Vector'], vec)
        nd.inputs['Scale'].default_value = scale
        nd.inputs['Randomness'].default_value = rnd
        return nd

    def sep(self, vec):
        nd = self.N.new('ShaderNodeSeparateXYZ')
        self.s(nd.inputs[0], vec)
        return nd.outputs

    def gridd(self, c, pitch, off=0.0):
        """distance from scalar c to the nearest line off + k*pitch."""
        t = self.math('ADD', self.math('DIVIDE', self.math('SUBTRACT', c, off), pitch), 0.5)
        return self.math('MULTIPLY', self.math('ABSOLUTE', self.math('SUBTRACT', self.math('FRACT', t), 0.5)), pitch)


def mat_base(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = NT(m)
    P = nt.N.get('Principled BSDF')
    return m, nt, P


REGO = (0.16, 0.152, 0.142, 1)


def foil_mat(name, c1, c2, scale=5.0, facet=0.55, r_lo=0.10, r_hi=0.36, dust_h=0.0, crease=0.55, bump=0.5):
    """Crinkled Kapton/gold foil: noise-distorted Voronoi facets tilt the normal per cell, Voronoi edges make
    darker creases, fine noise bump for micro-crinkle, per-cell roughness, optional regolith dust near z=0."""
    m, nt, P = mat_base(name)
    tc0 = nt.n('ShaderNodeTexCoord').outputs['Object']
    tc = nt.vmath('MULTIPLY', tc0, (1.0, 1.0, 0.62))          # creases run mostly vertically
    geo = nt.n('ShaderNodeNewGeometry')
    half = (0.5, 0.5, 0.5)
    nd = nt.noise(tc, 0.8, 3.0, 0.55)
    nd2 = nt.noise(tc, 7.0, 2.0, 0.5)
    pd = nt.vmath('ADD', tc, nt.vmath('SCALE', nt.vmath('SUBTRACT', nd.outputs['Color'], half), scale=0.55))
    pd = nt.vmath('ADD', pd, nt.vmath('SCALE', nt.vmath('SUBTRACT', nd2.outputs['Color'], half), scale=0.9 / scale))
    pd2 = nt.vmath('ADD', pd, (3.1, 1.7, 0.4))
    v1 = nt.vor(pd, scale)
    v2 = nt.vor(pd2, scale * 2.4)
    v3 = nt.vor(nt.vmath('ADD', pd, (7.3, 2.2, 5.1)), scale * 6.0)
    ve = nt.vor(pd, scale, 'DISTANCE_TO_EDGE')
    ve2 = nt.vor(pd2, scale * 2.4, 'DISTANCE_TO_EDGE')
    pert = nt.vmath('ADD', nt.vmath('SCALE', nt.vmath('SUBTRACT', v1.outputs['Color'], half), scale=facet),
                    nt.vmath('SCALE', nt.vmath('SUBTRACT', v2.outputs['Color'], half), scale=facet * 0.75))
    pert = nt.vmath('ADD', pert, nt.vmath('SCALE', nt.vmath('SUBTRACT', v3.outputs['Color'], half), scale=facet * 0.35))
    nrm = nt.vmath('NORMALIZE', nt.vmath('ADD', geo.outputs['Normal'], pert))
    fine = nt.noise(tc0, 90.0, 6.0, 0.62)
    patch = nt.mr(nt.noise(tc0, 2.2, 3.0, 0.5).outputs['Fac'], 0.42, 0.58)       # creases only in patches
    cr1 = nt.mr(ve.outputs['Distance'], 0.0, 0.035)
    cr2 = nt.mr(ve2.outputs['Distance'], 0.0, 0.03)
    crease_m = nt.math('MULTIPLY', cr1, nt.mixf(patch, 1.0, cr2))
    h = nt.math('ADD', nt.math('MULTIPLY', fine.outputs['Fac'], 0.30), nt.math('MULTIPLY', crease_m, 0.7))
    bu = nt.n('ShaderNodeBump')
    bu.inputs['Strength'].default_value = bump
    bu.inputs['Distance'].default_value = 0.003
    nt.s(bu.inputs['Height'], h)
    nt.s(bu.inputs['Normal'], nrm)
    nt.s(P.inputs['Normal'], bu.outputs['Normal'])
    cs = nt.sep(v1.outputs['Color'])
    cs2 = nt.sep(v2.outputs['Color'])
    big = nt.noise(tc0, 1.4, 4.0, 0.55)
    colvar = nt.math('ADD', nt.math('MULTIPLY', cs2[0], 0.25), big.outputs['Fac'])
    col = nt.mix(nt.mr(colvar, 0.55, 1.05), c1, c2)
    col = nt.mix(nt.math('MULTIPLY', nt.math('SUBTRACT', 1.0, crease_m), crease), col, (0.10, 0.05, 0.012, 1))
    rough = nt.mr(nt.math('ADD', nt.math('MULTIPLY', cs[1], 0.6), nt.math('MULTIPLY', cs2[2], 0.4)), 0.0, 1.0,
                  r_lo, r_hi, smooth=False)
    rough = nt.math('ADD', rough, nt.math('MULTIPLY', nt.math('SUBTRACT', 1.0, crease_m), 0.10))
    metal = 1.0
    if dust_h > 0:
        z = nt.sep(tc0)[2]
        dn = nt.noise(tc0, 5.0, 4.0, 0.6)
        df = nt.math('MULTIPLY', nt.mr(z, dust_h, 0.0), nt.mr(dn.outputs['Fac'], 0.30, 0.62))
        col = nt.mix(df, col, REGO)
        rough = nt.mixf(df, rough, 0.92)
        metal = nt.mixf(df, 1.0, 0.0)
    nt.s(P.inputs['Base Color'], col)
    nt.s(P.inputs['Metallic'], metal)
    nt.s(P.inputs['Roughness'], rough)
    return m


def paint_mat(name, col, rough=0.45, seams=True, rivets=True, wear=0.8, grime=0.55, tread=False,
              pitches=(0.62, 0.58, 0.75), offs=(0.11, 0.04, 3.45), dust_h=0.0):
    """Painted aluminium: panel seams (object space, masked by object-space normal), rivet rows along the
    horizontal seams, AO grime + vertical streaks, Bevel-node edge wear down to bare metal, orange-peel bump."""
    m, nt, P = mat_base(name)
    tcn = nt.n('ShaderNodeTexCoord')
    tc = tcn.outputs['Object']
    geo = nt.n('ShaderNodeNewGeometry')
    x, y, z = nt.sep(tc)
    on = nt.sep(tcn.outputs['Normal'])          # object-space normal
    sel = lambda c: nt.mr(nt.math('ABSOLUTE', c), 0.42, 0.25)
    height = nt.math('MULTIPLY', nt.noise(tc, 160.0, 2.0, 0.5).outputs['Fac'], 0.10)
    seam = 0.0
    if seams:
        lx = nt.math('MULTIPLY', nt.mr(nt.gridd(x, pitches[0], offs[0]), 0.0055, 0.0028), sel(on[0]))
        ly = nt.math('MULTIPLY', nt.mr(nt.gridd(y, pitches[1], offs[1]), 0.0055, 0.0028), sel(on[1]))
        dz = nt.gridd(z, pitches[2], offs[2])
        lz = nt.math('MULTIPLY', nt.mr(dz, 0.0055, 0.0028), sel(on[2]))
        # per-panel tone variation
        cid = nt.math('ADD', nt.math('FLOOR', nt.math('DIVIDE', nt.math('SUBTRACT', x, offs[0]), pitches[0])),
                      nt.math('MULTIPLY', nt.math('FLOOR', nt.math('DIVIDE', nt.math('SUBTRACT', y, offs[1]),
                                                                       pitches[1])), 7.0))
        cid = nt.math('ADD', cid, nt.math('MULTIPLY', nt.math('FLOOR', nt.math('DIVIDE', nt.math('SUBTRACT', z, offs[2]),
                                                                                    pitches[2])), 31.0))
        wn = nt.n('ShaderNodeTexWhiteNoise', noise_dimensions='1D')
        nt.s(wn.inputs['W'], cid)
        tint = wn.outputs['Value']
        seam = nt.math('MAXIMUM', nt.math('MAXIMUM', lx, ly), lz)
        height = nt.math('SUBTRACT', height, seam)
        if rivets:
            rz = nt.math('ABSOLUTE', nt.math('SUBTRACT', dz, 0.028))
            dh = nt.gridd(nt.math('ADD', x, y), 0.075, 0.0)
            rd = nt.math('SQRT', nt.math('ADD', nt.math('MULTIPLY', rz, rz), nt.math('MULTIPLY', dh, dh)))
            riv = nt.math('MULTIPLY', nt.mr(rd, 0.0068, 0.0045), sel(on[2]))
            height = nt.math('ADD', height, nt.math('MULTIPLY', riv, 0.7))
    if tread:
        sx = nt.math('SINE', nt.math('MULTIPLY', x, 2 * math.pi / 0.045))
        sy = nt.math('SINE', nt.math('MULTIPLY', y, 2 * math.pi / 0.045))
        tr = nt.math('MULTIPLY', nt.mr(nt.math('MULTIPLY', sx, sy), 0.35, 0.6), nt.mr(on[2], 0.7, 0.9))
        height = nt.math('ADD', height, nt.math('MULTIPLY', tr, 0.8))
    ao = nt.n('ShaderNodeAmbientOcclusion', only_local=True, samples=8)
    ao.inputs['Distance'].default_value = 0.35
    streak = nt.noise(nt.vmath('MULTIPLY', tc, (7.0, 7.0, 0.8)), 1.0, 5.0, 0.6)
    gf = nt.math('ADD', nt.math('MULTIPLY', nt.math('SUBTRACT', 1.0, ao.outputs['AO']), 0.9),
                 nt.math('MULTIPLY', nt.mr(streak.outputs['Fac'], 0.48, 0.75), 0.45))
    blot = nt.noise(tc, 3.0, 5.0, 0.65)
    gf = nt.math('ADD', gf, nt.math('MULTIPLY', nt.mr(blot.outputs['Fac'], 0.5, 0.75), 0.3))
    gf = nt.math('MULTIPLY', gf, grime, clamp=True)
    bv = nt.n('ShaderNodeBevel', samples=6)
    bv.inputs['Radius'].default_value = 0.008
    e = nt.math('SUBTRACT', 1.0, nt.vmath('DOT_PRODUCT', bv.outputs['Normal'], geo.outputs['Normal']))
    em = nt.mr(e, 0.004, 0.05)
    wm = nt.mr(nt.noise(tc, 24.0, 8.0, 0.7).outputs['Fac'], 0.50, 0.60)
    wf = nt.math('MULTIPLY', nt.math('MULTIPLY', em, wm), wear, clamp=True)
    if seams:
        col = nt.mix(nt.math('MULTIPLY', tint, 0.55), col, (col[0] * 0.86, col[1] * 0.86, col[2] * 0.84, 1))
        if rivets:
            col = nt.mix(nt.math('MULTIPLY', riv, 0.6), col, (0.42, 0.42, 0.42, 1))
    c = nt.mix(nt.math('MULTIPLY', seam, 0.85) if seams else 0.0, col, (0.08, 0.08, 0.08, 1))
    c = nt.mix(gf, c, (0.30, 0.27, 0.23, 1))
    if dust_h > 0:
        dn = nt.noise(tc, 5.0, 4.0, 0.6)
        df = nt.math('MULTIPLY', nt.mr(z, dust_h, 0.0), nt.mr(dn.outputs['Fac'], 0.30, 0.62))
        c = nt.mix(df, c, REGO)
    c = nt.mix(wf, c, (0.62, 0.62, 0.64, 1))
    rv = nt.noise(tc, 9.0, 3.0, 0.5)
    r = nt.math('ADD', rough, nt.math('MULTIPLY', nt.math('SUBTRACT', rv.outputs['Fac'], 0.5), 0.16))
    r = nt.math('ADD', r, nt.math('MULTIPLY', gf, 0.2))
    r = nt.mixf(wf, r, 0.28)
    bu = nt.n('ShaderNodeBump')
    bu.inputs['Strength'].default_value = 0.6
    bu.inputs['Distance'].default_value = 0.0012
    nt.s(bu.inputs['Height'], height)
    nt.s(P.inputs['Normal'], bu.outputs['Normal'])
    nt.s(P.inputs['Base Color'], c)
    nt.s(P.inputs['Metallic'], nt.math('MULTIPLY', wf, 0.9))
    nt.s(P.inputs['Roughness'], r)
    return m


def metal_mat(name, col, rough=0.25, grime=0.35, brushed=True, dust_h=0.0, metallic=1.0):
    m, nt, P = mat_base(name)
    tc = nt.n('ShaderNodeTexCoord').outputs['Object']
    z = nt.sep(tc)[2]
    sv = (40.0, 40.0, 1.5) if brushed else (1, 1, 1)
    br = nt.noise(nt.vmath('MULTIPLY', tc, sv), 3.0, 6.0, 0.6)
    r = nt.math('ADD', rough, nt.math('MULTIPLY', nt.math('SUBTRACT', br.outputs['Fac'], 0.5), 0.18))
    ao = nt.n('ShaderNodeAmbientOcclusion', only_local=True, samples=6)
    ao.inputs['Distance'].default_value = 0.25
    gf = nt.math('MULTIPLY', nt.math('SUBTRACT', 1.0, ao.outputs['AO']), grime, clamp=True)
    c = nt.mix(gf, col, (0.18, 0.16, 0.14, 1))
    c = nt.mix(nt.math('MULTIPLY', nt.noise(tc, 4.0, 3.0).outputs['Fac'], 0.25), c, (col[0] * 0.8, col[1] * 0.8, col[2] * 0.82, 1))
    met = metallic
    if dust_h > 0:
        dn = nt.noise(tc, 6.0, 4.0, 0.6)
        df = nt.math('MULTIPLY', nt.mr(z, dust_h, 0.0), nt.mr(dn.outputs['Fac'], 0.30, 0.62))
        c = nt.mix(df, c, REGO)
        r = nt.mixf(df, r, 0.9)
        met = nt.mixf(df, metallic, 0.0)
    bu = nt.n('ShaderNodeBump')
    bu.inputs['Strength'].default_value = 0.15
    bu.inputs['Distance'].default_value = 0.001
    nt.s(bu.inputs['Height'], br.outputs['Fac'])
    nt.s(P.inputs['Normal'], bu.outputs['Normal'])
    nt.s(P.inputs['Base Color'], c)
    nt.s(P.inputs['Metallic'], met)
    nt.s(P.inputs['Roughness'], r)
    return m


def simple_mat(name, col, metal=0.0, rough=0.5, emis=None, strength=0.0):
    m, nt, P = mat_base(name)
    nt.s(P.inputs['Base Color'], col)
    P.inputs['Metallic'].default_value = metal
    P.inputs['Roughness'].default_value = rough
    if emis is not None:
        nt.s(P.inputs['Emission Color'], emis)
        P.inputs['Emission Strength'].default_value = strength
    return m


def bell_mat(name):
    m, nt, P = mat_base(name)
    tc = nt.n('ShaderNodeTexCoord').outputs['Object']
    z = nt.sep(tc)[2]
    t = nt.mr(z, 1.32, 0.80, smooth=False)
    st = nt.noise(nt.vmath('MULTIPLY', tc, (9.0, 9.0, 0.6)), 2.0, 6.0, 0.6)
    t2 = nt.math('ADD', t, nt.math('MULTIPLY', nt.math('SUBTRACT', st.outputs['Fac'], 0.5), 0.25))
    cr = nt.n('ShaderNodeValToRGB')
    el = cr.color_ramp.elements
    el[0].position = 0.0; el[0].color = (0.10, 0.075, 0.12, 1)
    el[1].position = 1.0; el[1].color = (0.055, 0.052, 0.05, 1)
    e2 = el.new(0.25); e2.color = (0.20, 0.10, 0.045, 1)
    e3 = el.new(0.55); e3.color = (0.09, 0.08, 0.075, 1)
    nt.s(cr.inputs[0], t2)
    nt.s(P.inputs['Base Color'], cr.outputs[0])
    P.inputs['Metallic'].default_value = 0.9
    nt.s(P.inputs['Roughness'], nt.math('ADD', 0.32, nt.math('MULTIPLY', st.outputs['Fac'], 0.25)))
    bu = nt.n('ShaderNodeBump')
    bu.inputs['Strength'].default_value = 0.2
    bu.inputs['Distance'].default_value = 0.002
    nt.s(bu.inputs['Height'], st.outputs['Fac'])
    nt.s(P.inputs['Normal'], bu.outputs['Normal'])
    return m


def glass_mat(name):
    m, nt, P = mat_base(name)
    P.inputs['Base Color'].default_value = (0.26, 0.29, 0.33, 1)
    P.inputs['Roughness'].default_value = 0.015
    P.inputs['IOR'].default_value = 1.52
    P.inputs['Transmission Weight'].default_value = 1.0
    P.inputs['Specular IOR Level'].default_value = 0.7
    P.inputs['Coat Weight'].default_value = 0.0
    P.inputs['Thin Film Thickness'].default_value = 380.0     # faint coated-optics sheen
    P.inputs['Thin Film IOR'].default_value = 1.38
    tc = nt.n('ShaderNodeTexCoord').outputs['Object']
    smudge = nt.noise(tc, 14.0, 6.0, 0.7)
    nt.s(P.inputs['Roughness'], nt.mr(smudge.outputs['Fac'], 0.45, 0.8, 0.01, 0.08))
    return m


def mesh_fine_mat(name, col):
    """Fine knitted gold mesh: object-space line grid as alpha over a gold metal."""
    m, nt, P = mat_base(name)
    tc = nt.n('ShaderNodeTexCoord').outputs['Object']
    x, y, z = nt.sep(tc)
    p, w0, w1 = 0.018, 0.0022, 0.0009
    lx = nt.mr(nt.gridd(x, p), w0, w1)
    ly = nt.mr(nt.gridd(y, p), w0, w1)
    lz = nt.mr(nt.gridd(z, p), w0, w1)
    a = nt.math('MAXIMUM', nt.math('MAXIMUM', lx, ly), lz)
    nt.s(P.inputs['Alpha'], nt.math('ADD', nt.math('MULTIPLY', a, 0.85), 0.07, clamp=True))
    nt.s(P.inputs['Base Color'], col)
    P.inputs['Metallic'].default_value = 1.0
    P.inputs['Roughness'].default_value = 0.32
    return m


def make_materials():
    M = {}
    gold1, gold2 = (0.80, 0.46, 0.10, 1), (0.52, 0.22, 0.03, 1)
    M['foil'] = foil_mat('LX_foil_gold', gold1, gold2, scale=6.5, facet=0.55, dust_h=0.0)
    M['foil_strut'] = foil_mat('LX_foil_strut', gold1, gold2, scale=12.0, facet=0.45, dust_h=0.5)
    M['foil_pad'] = foil_mat('LX_foil_pad', (0.72, 0.47, 0.16, 1), (0.42, 0.24, 0.06, 1), scale=8.0, facet=0.3,
                             r_lo=0.22, r_hi=0.5, dust_h=0.22)
    M['foil_black'] = foil_mat('LX_foil_black', (0.035, 0.033, 0.03, 1), (0.012, 0.012, 0.012, 1), scale=5.0,
                               facet=0.45, r_lo=0.18, r_hi=0.45, crease=0.2)
    M['foil_aft'] = foil_mat('LX_foil_aft', (0.74, 0.62, 0.38, 1), (0.50, 0.38, 0.18, 1), scale=7.0, facet=0.5)
    M['white'] = paint_mat('LX_paint_white', (0.74, 0.74, 0.72, 1), 0.42)
    M['white_plain'] = paint_mat('LX_paint_white_plain', (0.74, 0.74, 0.72, 1), 0.42, seams=False, rivets=False)
    M['door'] = paint_mat('LX_paint_door', (0.75, 0.75, 0.73, 1), 0.40, seams=False, rivets=False, grime=0.45)
    M['grey'] = paint_mat('LX_paint_grey', (0.19, 0.19, 0.20, 1), 0.5, seams=False, rivets=False, wear=1.0,
                          grime=0.5, dust_h=0.6)
    M['porch'] = paint_mat('LX_porch', (0.26, 0.26, 0.27, 1), 0.6, seams=False, rivets=False, wear=1.0, tread=True)
    M['alu'] = metal_mat('LX_alu', (0.80, 0.80, 0.82, 1), 0.22, dust_h=0.45)
    M['alu_dark'] = metal_mat('LX_alu_dark', (0.30, 0.30, 0.32, 1), 0.35, grime=0.4)
    M['chrome'] = metal_mat('LX_piston', (0.92, 0.92, 0.93, 1), 0.08, grime=0.25, dust_h=0.4)
    M['gold_frame'] = metal_mat('LX_gold_frame', (0.95, 0.66, 0.26, 1), 0.2, grime=0.2, brushed=False)
    M['bell'] = bell_mat('LX_engine_bell')
    M['bell_in'] = simple_mat('LX_engine_bell_inner', (0.03, 0.028, 0.026, 1), 0.6, 0.6)
    M['nozzle'] = metal_mat('LX_nozzle', (0.12, 0.11, 0.105, 1), 0.38, grime=0.2, brushed=False)
    M['dark'] = simple_mat('LX_dark', (0.025, 0.025, 0.028, 1), 0.2, 0.55)
    M['glass'] = glass_mat('LX_glass')
    M['lens'] = simple_mat('LX_lens', (0.01, 0.012, 0.02, 1), 0.3, 0.06)
    M['mesh'] = metal_mat('LX_mesh_gold', (0.92, 0.66, 0.28, 1), 0.3, grime=0.0, brushed=False)
    M['mesh_fine'] = mesh_fine_mat('LX_mesh_fine', (0.92, 0.66, 0.28, 1))
    M['rubber'] = simple_mat('LX_rubber', (0.02, 0.02, 0.02, 1), 0.0, 0.8)
    M['lamp'] = simple_mat('LX_lamp_hatch_ext', (0.25, 0.02, 0.01, 1), 0.0, 0.25, (1.0, 0.05, 0.02, 1), 6.0)
    M['btn'] = simple_mat('LX_btn_hatch_ext', (0.62, 0.62, 0.60, 1), 0.0, 0.35, (0.1, 1.0, 0.25, 1), 0.0)
    M['btn'].node_tree.nodes['Principled BSDF'].inputs['Coat Weight'].default_value = 0.4
    return M


# =============================================================================================== shared parts
def rcs_quad(mb, P, n, M, housing, s=1.0, boom=0.32, brace=True, drop=0.16):
    """4-nozzle RCS cluster on a short boom: housing box + up/down/left/right nozzles."""
    P = V(P)
    n = V(n).normalized()
    t = ZUP.cross(n).normalized()
    C = P + n * boom * s
    mb.cyl(P - n * 0.06, C - n * 0.09 * s, 0.032 * s, M['alu_dark'], 12)
    if brace:
        mb.cyl(P - n * 0.04 - ZUP * drop * s, C - n * 0.07 * s - ZUP * 0.04 * s, 0.017 * s, M['alu_dark'], 10)
    mb.box(C, (0.19 * s, 0.21 * s, 0.23 * s), housing, (n, t, ZUP))
    mb.box(C + n * 0.096 * s, (0.012 * s, 0.15 * s, 0.17 * s), M['alu_dark'], (n, t, ZUP))
    for d in (ZUP, -ZUP, t, -t):
        L0 = 0.105 * s if d in (t, -t) else 0.115 * s
        b0 = C + d * L0
        mb.cyl(b0 - d * 0.01, b0 + d * 0.035 * s, 0.03 * s, M['alu_dark'], 12)
        mb.revolve(b0 + d * 0.035 * s, d, [(0.02 * s, 0.0), (0.034 * s, 0.05 * s), (0.052 * s, 0.13 * s),
                                           (0.047 * s, 0.13 * s), (0.03 * s, 0.05 * s), (0.017 * s, 0.006 * s)],
                   M['nozzle'], 16, cap0=False, cap1=False)


# =============================================================================================== descent stage
APO = 1.90
R8 = APO / math.cos(math.radians(22.5))
FW = 2 * APO * math.tan(math.radians(22.5))
DZ0, DZ1 = 1.30, 2.95


def oct_v(k, R=R8, z=0.0):
    a = math.radians(22.5 + 45 * k)
    return V((R * math.cos(a), R * math.sin(a), z))


def face_frame(j):
    a = math.radians(45 * j)
    return V((math.cos(a), math.sin(a), 0)), V((-math.sin(a), math.cos(a), 0))


def fpt(j, u, z, out=0.0):
    n, t = face_frame(j)
    return n * (APO + out) + t * (u * FW) + ZUP * z


def build_descent(M, base):
    # ---- foil blanket: 8 pillowed, crumpled faces + top deck + black underside
    mb = MB('LX_descent_foil')
    nu, nv = 30, 28
    for j in range(8):
        a = oct_v(j - 1); b = oct_v(j)
        nrm, _ = face_frame(j)
        grid = []
        for iv in range(nv + 1):
            v = iv / nv
            z = DZ0 + (DZ1 - DZ0) * v
            row = []
            for iu in range(nu + 1):
                u = iu / nu
                p = a.lerp(b, u)
                p.z = z
                env = (math.sin(math.pi * u) ** 0.5) * (math.sin(math.pi * v) ** 0.5)
                q = V(p)
                cr = (0.010 * mnoise.noise(q * 2.0) + 0.007 * abs(mnoise.noise(q * 5.5 + V((5, 1, 3)))) +
                      0.003 * mnoise.noise(q * 13.0 + V((2, 7, 1))))
                row.append(mb.bm.verts.new(p + nrm * (0.03 * env + cr * min(1.0, env * 3.0))))
            grid.append(row)
        f0 = mb.nf()
        for iv in range(nv):
            for iu in range(nu):
                mb.bm.faces.new((grid[iv][iu], grid[iv][iu + 1], grid[iv + 1][iu + 1], grid[iv + 1][iu]))
        mb._tag(f0, M['foil'])
    f0 = mb.nf()
    mb.bm.faces.new([mb.bm.verts.new(oct_v(k, R8, DZ1)) for k in range(8)])
    mb._tag(f0, M['foil'])
    f0 = mb.nf()
    mb.bm.faces.new([mb.bm.verts.new(oct_v(k, R8, DZ0)) for k in reversed(range(8))])
    mb._tag(f0, M['foil_black'])
    mb.to_object(base, sharp=60, merge=1e-4)

    # ---- frame: corner posts + top/bottom rims
    mb = MB('LX_descent_frame')
    for k in range(8):
        c = oct_v(k, R8 + 0.005)
        rad = c.normalized()
        mb.box((c.x, c.y, (DZ0 + DZ1) / 2), (0.065, 0.065, DZ1 - DZ0 + 0.07), M['alu_dark'],
               (rad, ZUP.cross(rad), ZUP))
    for j in range(8):
        a = oct_v(j - 1); b = oct_v(j)
        nrm, _ = face_frame(j)
        for z, h in ((DZ1 - 0.005, 0.07), (DZ0 + 0.02, 0.06)):
            mb.beam(a + nrm * 0.012 + ZUP * z, b + nrm * 0.012 + ZUP * z, 0.06, h, M['alu_dark'], ZUP)
        # mid strap (thin tape seam across the blanket)
        mb.beam(a + nrm * 0.03 + ZUP * 2.12, b + nrm * 0.03 + ZUP * 2.12, 0.012, 0.025, M['alu_dark'], ZUP)
    mb.to_object(base, bevel=(0.008, 2))

    # ---- details on the faces: fittings, boxes, RCS crosses, pipes
    mb = MB('LX_descent_details')
    G = M['grey']
    for j in (0, 2, 4, 6):                      # leg attachment fittings
        n, t = face_frame(j)
        mb.box(n * 1.99 + ZUP * 2.74, (0.16, 0.36, 0.30), G, (n, t, ZUP))
        mb.box(n * 2.07 + ZUP * 2.74, (0.04, 0.24, 0.22), M['alu_dark'], (n, t, ZUP))
        for sd in (-1, 1):
            c = n * 1.88 + t * (sd * 0.90) + ZUP * 1.37
            mb.box(c, (0.24, 0.14, 0.14), G, (n, t, ZUP))
    boxes = [  # (face, u, z, depth, width, height, mat)
        (5, -0.22, 1.72, 0.14, 0.46, 0.38, G), (5, 0.20, 1.62, 0.10, 0.22, 0.22, M['alu_dark']),
        (7, 0.22, 1.70, 0.14, 0.44, 0.40, G), (7, -0.18, 1.62, 0.10, 0.20, 0.18, M['alu_dark']),
        (1, 0.0, 1.85, 0.18, 0.62, 0.52, G), (1, -0.25, 2.55, 0.08, 0.30, 0.20, M['alu_dark']),
        (3, -0.05, 1.80, 0.16, 0.58, 0.48, G), (3, 0.25, 2.58, 0.08, 0.28, 0.20, M['alu_dark']),
        (2, -0.30, 1.75, 0.12, 0.34, 0.40, G), (2, 0.30, 1.75, 0.12, 0.34, 0.40, G),
        (0, -0.33, 2.05, 0.10, 0.22, 0.34, G), (0, 0.33, 2.05, 0.10, 0.22, 0.34, G),
        (4, -0.33, 2.05, 0.10, 0.22, 0.34, G), (4, 0.33, 2.05, 0.10, 0.22, 0.34, G),
        (6, -0.36, 1.85, 0.08, 0.26, 0.44, G), (6, 0.36, 1.85, 0.08, 0.26, 0.44, G),
    ]
    for (j, u, z, d, w, h, mt) in boxes:
        n, t = face_frame(j)
        c = fpt(j, u, z, 0.02 + d / 2)
        mb.box(c, (d, w, h), mt, (n, t, ZUP))
        if d > 0.11:   # louvres / small vents on the bigger boxes
            for i in range(4):
                mb.box(c + n * (d / 2 + 0.004) + ZUP * (h * 0.25 - i * 0.05) + t * (w * 0.18),
                       (0.008, w * 0.42, 0.018), M['alu_dark'], (n, t, ZUP))
    for j, u in ((5, 0.18), (7, -0.18), (1, 0.30), (3, -0.30)):   # small RCS crosses
        n, t = face_frame(j)
        rcs_quad(mb, fpt(j, u, 2.48, 0.02), n, M, G, s=0.75, boom=0.22, brace=False)
    for j in (5, 7, 1, 3):                    # pipe runs
        n, t = face_frame(j)
        for k, u in enumerate((-0.42, -0.38)):
            mb.sweep(fillet([fpt(j, u, 1.36, 0.045), fpt(j, u, 2.30, 0.045), fpt(j, u + 0.1, 2.40, 0.045)], 0.06, 4),
                     0.012, M['alu'] if k == 0 else M['dark'], 8)
    # porch supports
    for sx in (-1, 1):
        mb.cyl((sx * 0.50, -2.36, 2.91), (sx * 0.55, -1.93, 2.42), 0.024, M['alu'], 12)
        mb.box((sx * 0.55, -1.95, 2.42), (0.10, 0.06, 0.10), G)
    mb.to_object(base, bevel=(0.006, 2))

    # ---- engine bell + heat shield
    mb = MB('LX_engine')
    prof_in, prof_out = [(0.02, 1.36), (0.24, 1.36), (0.288, 1.31)], []
    for i in range(14):
        s = i / 13
        z = 1.30 - 0.50 * s
        r = 0.30 + 0.32 * (1 - (1 - s) ** 2.2)
        prof_in.append((r - 0.012, z + 0.002))
        prof_out.append((r + 0.004, z))
    prof_in.append((0.612, 0.795))
    lip = [(0.612, 0.795), (0.628, 0.786), (0.64, 0.80)]
    prof_out = lip + list(reversed(prof_out))[1:] + [(0.31, 1.36), (0.31, 1.42)]
    mb.revolve((0, 0, 0), ZUP, prof_in, M['bell_in'], 48, cap0=True, cap1=False)
    mb.revolve((0, 0, 0), ZUP, prof_out, M['bell'], 48, cap0=False, cap1=True)
    for z0, rr in ((1.235, 0.318), (1.08, 0.375)):
        s = (1.30 - z0) / 0.5
        r = 0.30 + 0.32 * (1 - (1 - s) ** 2.2) + 0.004
        mb.revolve((0, 0, 0), ZUP, [(r - 0.002, z0 - 0.012), (r + 0.012, z0 - 0.01), (r + 0.012, z0 + 0.01),
                                    (r - 0.002, z0 + 0.012)], M['nozzle'], 48, cap0=False, cap1=False)
    mb.revolve((0, 0, 0), ZUP, [(0.30, 1.30), (0.36, 1.30), (0.37, 1.34), (0.33, 1.345)], M['alu_dark'], 48,
               cap0=False, cap1=False)
    mb.revolve((0, 0, 0), ZUP, [(0.37, 1.287), (0.95, 1.287), (0.95, 1.296), (0.37, 1.296)], M['foil_black'], 48,
               cap0=False, cap1=False)
    for k in range(4):   # gimbal actuators
        a = math.radians(45 + 90 * k)
        d = V((math.cos(a), math.sin(a), 0))
        mb.cyl(d * 0.75 + ZUP * 1.29, d * 0.36 + ZUP * 1.20, 0.022, M['alu'], 10)
        mb.cyl(d * 0.75 + ZUP * 1.29, d * 0.62 + ZUP * 1.26, 0.034, M['alu_dark'], 10)
    mb.to_object(base, sharp=50, bevel=(0.003, 2))


# =============================================================================================== legs
LEG_AZ = {'front': -90.0, 'right': 0.0, 'back': 90.0, 'left': 180.0}


def leg_geom(az):
    a = math.radians(az)
    d = V((math.cos(a), math.sin(a), 0))
    t = V((-math.sin(a), math.cos(a), 0))
    T = d * 1.95 + ZUP * 2.75
    B = d * 3.70 + ZUP * 0.18
    return d, t, T, B


def build_legs(M, base):
    mb = MB('LX_legs')
    for name, az in LEG_AZ.items():
        d, t, T, B = leg_geom(az)
        ax = (B - T).normalized()
        L = (B - T).length
        Lg = 0.62 * L
        Mid = T + ax * Lg
        # gold-foil primary strut (outer cylinder)
        mb.revolve(T, ax, [(0.06, -0.08), (0.082, -0.03), (0.098, 0.05), (0.098, Lg - 0.08), (0.088, Lg - 0.02),
                           (0.07, Lg)], M['foil_strut'], 20)
        mb.revolve(T, ax, [(0.104, 0.12), (0.104, 0.17)], M['alu_dark'], 20)
        mb.revolve(T, ax, [(0.104, Lg * 0.5), (0.104, Lg * 0.5 + 0.04)], M['alu_dark'], 20)
        mb.sphere(T, 0.085, M['alu_dark'], 16, 10)
        # collar where the deployment truss attaches
        mb.revolve(Mid, ax, [(0.112, -0.06), (0.112, 0.07)], M['alu'], 20)
        side = ax.cross(t).normalized()
        for sd in (-1, 1):
            mb.box(Mid + t * (sd * 0.12), (0.10, 0.06, 0.08), M['alu'], (ax, t, side))
        # silver piston (inner cylinder)
        mb.revolve(Mid, ax, [(0.058, -0.05), (0.058, L - Lg - 0.05)], M['chrome'], 20)
        mb.revolve(Mid, ax, [(0.07, 0.07), (0.07, 0.11)], M['rubber'], 20)
        # secondary struts (A-frame back to the body bottom edge)
        for sd in (-1, 1):
            p0 = Mid + t * (sd * 0.15)
            p1 = d * 1.95 + t * (sd * 0.90) + ZUP * 1.35
            dd = (p1 - p0).normalized()
            mb.cyl(p0, p1, 0.026, M['alu'], 12)
            mb.cyl(p0 - dd * 0.02, p0 + dd * 0.12, 0.036, M['alu_dark'], 12)
            mb.cyl(p1 - dd * 0.12, p1 + dd * 0.02, 0.036, M['alu_dark'], 12)
            # downlock strut detail (thin, parallel)
            mb.cyl(p0 + dd * 0.35 + ZUP * 0.05, p1 - dd * 0.3 + ZUP * 0.05, 0.011, M['alu'], 8)
        # footpad bowl
        C = d * 3.70
        prof = [(0.02, 0.0), (0.22, 0.0), (0.32, 0.014), (0.39, 0.042), (0.43, 0.088), (0.447, 0.15),
                (0.45, 0.18), (0.432, 0.18), (0.428, 0.155), (0.412, 0.10), (0.372, 0.062), (0.30, 0.036),
                (0.20, 0.026), (0.02, 0.026)]
        mb.revolve(C, ZUP, prof, M['foil_pad'], 40)
        mb.revolve(C, ZUP, [(0.13, 0.02), (0.13, 0.07), (0.085, 0.12), (0.075, 0.17)], M['alu_dark'], 24,
                   cap0=False, cap1=True)
        mb.sphere(B, 0.075, M['chrome'], 16, 10)
        # rim stiffener ring
        mb.revolve(C, ZUP, [(0.452, 0.165), (0.462, 0.17), (0.462, 0.18), (0.452, 0.185)], M['alu'], 40,
                   cap0=False, cap1=False)
        # lunar-surface contact probe (back / left / right legs), bent over on the ground
        if name != 'front':
            p0 = C + d * 0.36 + ZUP * 0.05
            pts = [p0, C + d * 0.62 + ZUP * 0.022 + t * 0.03, C + d * 1.05 + t * 0.20 + ZUP * 0.013,
                   C + d * 1.45 + t * 0.55 + ZUP * 0.012]
            mb.sweep(fillet(pts, 0.12, 5), 0.011, M['alu'], 8)
            mb.box(p0 - d * 0.03, (0.07, 0.05, 0.05), M['alu_dark'], (d, t, ZUP))
    mb.to_object(base, sharp=40, bevel=(0.004, 2, 40))


# =============================================================================================== porch + ladder
TAN28 = math.tan(math.radians(28.0))


def ladder_y(z):
    return -2.45 - (2.95 - z) * TAN28


def strut_y(z):   # front main strut centre line (x = 0)
    _, _, T, B = leg_geom(LEG_AZ['front'])
    s = (T.z - z) / (T.z - B.z)
    return T.y + (B.y - T.y) * s


def build_porch(M, base):
    mb = MB('LX_porch')
    mb.box((0, -2.00, 2.95), (1.20, 0.90, 0.06), M['porch'])
    mb.beam((-0.60, -2.43, 2.905), (0.60, -2.43, 2.905), 0.04, 0.03, M['alu_dark'])
    for sx in (-1, 1):
        mb.beam((sx * 0.585, -2.44, 2.905), (sx * 0.585, -1.56, 2.905), 0.03, 0.03, M['alu_dark'])
    # handrails x = +-0.62, y -2.45..-1.60, top 0.90 above the porch
    for sx in (-1, 1):
        x = sx * 0.62
        top = 2.98 + 0.90
        pts = [(x, -2.43, 2.95), (x, -2.43, top), (x, -1.62, top), (x, -1.62, 2.95)]
        mb.sweep(fillet(pts, 0.09, 8), 0.0175, M['alu'], 14)
        mb.sweep([(x, -2.43, 2.98 + 0.45), (x, -1.62, 2.98 + 0.45)], 0.0145, M['alu'], 12)
        for y in (-2.43, -1.62):
            mb.box((sx * 0.605, y, 2.955), (0.05, 0.06, 0.05), M['alu_dark'])
            mb.cyl((x, y, 2.94), (x, y, 3.02), 0.026, M['alu_dark'], 14)
    mb.to_object(base, bevel=(0.005, 2))

    # ---- ladder (contract: rails x=+-0.24 d0.05, rungs d0.035 at SPEC['rungs'], lean 28 deg)
    mb = MB('LX_ladder')
    A = M['alu']
    for sx in (-1, 1):
        x = sx * 0.24
        # 15 Nov lead: above z 3.33 the grab handle swings OUT and FORWARD into the porch handrail's front post
        # (x +-0.62, y -2.43) so the standing area on the porch (|x| < 0.40, y > -2.30) stays clear for the
        # astronaut (the old hook ran back over the porch at x +-0.24 and cut through the legs).
        pts = [(x, ladder_y(0.45), 0.45), (x, ladder_y(3.33), 3.33), (sx * 0.40, -2.30, 3.50),
               (sx * 0.585, -2.415, 3.62)]
        mb.sweep(fillet(pts, 0.11, 8), 0.025, A, 16)
        mb.box((sx * 0.60, -2.43, 3.62), (0.07, 0.06, 0.08), M['alu_dark'])   # clamp onto the handrail post
        mb.revolve((x, ladder_y(0.45), 0.45), (0, -TAN28, 1), [(0.027, -0.02), (0.027, 0.04)], M['rubber'], 16)
        # clamp to the porch front edge
        mb.box((x, -2.445, 2.935), (0.08, 0.04, 0.07), M['alu_dark'])
    for (x, y, z) in CTX['spec']['rungs']:
        mb.cyl((-0.245, y, z), (0.245, y, z), 0.0175, A, 16)
        for sx in (-1, 1):
            mb.cyl((sx * 0.205, y, z), (sx * 0.222, y, z), 0.024, M['alu_dark'], 14)
    # brackets to the front main strut (arms at the rails, cross bar behind the climber's toes)
    for zb in (0.45, 1.45, 2.35):
        yl = ladder_y(zb)
        ys = strut_y(zb) - (0.075 if zb < 0.5 else 0.11)
        for sx in (-1, 1):
            mb.cyl((sx * 0.24, yl, zb), (sx * 0.24, ys, zb), 0.016, A, 10)
        mb.cyl((-0.25, ys, zb), (0.25, ys, zb), 0.016, A, 10)
        sy = strut_y(zb)
        r = 0.068 if zb < 0.5 else 0.108
        _, _, Tf, Bf = leg_geom(LEG_AZ['front'])
        mb.revolve((0, sy, zb), Bf - Tf, [(r, -0.03), (r + 0.012, -0.025), (r + 0.012, 0.025), (r, 0.03)],
                   M['alu_dark'], 20, cap0=False, cap1=False)
        mb.box((0, (ys + sy) / 2 - 0.02, zb), (0.06, abs(sy - ys) + 0.02, 0.05), M['alu_dark'])
    mb.to_object(base, sharp=40, bevel=(0.003, 2, 40))


# =============================================================================================== ascent stage
CAB = [(0.90, -1.55), (1.45, -1.00), (1.45, 0.80), (0.90, 1.35), (-0.90, 1.35), (-1.45, 0.80), (-1.45, -1.00),
       (-0.90, -1.55)]
CZ0, CZW, CZR = 2.95, 5.05, 5.45
I4 = Matrix.Identity(4)
XA, YA = V((1, 0, 0)), V((0, 1, 0))
FRONT = (V((0, -1.55, 0)), XA, ZUP, V((0, -1, 0)))          # O, U, V, N  (u = x, v = z, d = outward)
S2 = math.sqrt(0.5)
CHAMF = {   # front chamfer facets: centre, outward normal, U
    'FR': (V((1.175, -1.275, 0)), V((S2, -S2, 0)), V((S2, S2, 0))),
    'FL': (V((-1.175, -1.275, 0)), V((-S2, -S2, 0)), V((S2, -S2, 0))),
    'BR': (V((1.175, 1.075, 0)), V((S2, S2, 0)), V((-S2, S2, 0))),
    'BL': (V((-1.175, 1.075, 0)), V((-S2, S2, 0)), V((-S2, -S2, 0))),
}
HATCH = rect(-0.45, 3.00, 0.45, 4.40)
WIN = [(-0.19, -0.215), (0.19, -0.215), (0.25, 0.18), (-0.25, 0.18)]   # window opening in facet (u, v-4.80)
WIN_Z = 4.80
CHAMF_DEPTH = 0.177      # outer chamfer facet -> inner (worker B) chamfer facet


def hatch_contour(d=0.0, n=6):
    return round_poly(offset_poly(HATCH, d), 0.12 + d, n)


def win_contour(d=0.0, n=5):
    return round_poly(offset_poly(WIN, d), 0.045 + d, n)


def resample(poly, step):
    pts = [V(p) for p in poly] + [V(poly[0])]
    out = []
    acc = 0.0
    for a, b in zip(pts[:-1], pts[1:]):
        L = (b - a).length
        while acc <= L:
            q = a.lerp(b, acc / L)
            out.append((q.x, q.y))
            acc += step
        acc -= L
    return out


def mark_sharp(me, deg):
    bm = bmesh.new()
    bm.from_mesh(me)
    thr = math.radians(deg)
    for e in bm.edges:
        if len(e.link_faces) == 2:
            try:
                e.smooth = e.calc_face_angle() <= thr
            except ValueError:
                e.smooth = False
        else:
            e.smooth = False
    for f in bm.faces:
        f.smooth = True
    bm.to_mesh(me)
    bm.free()


def apply_modifiers(o):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    old = o.data
    o.modifiers.clear()
    o.data = me
    me.name = o.name
    bpy.data.meshes.remove(old)


def build_cabin(M, body):
    W = M['white']
    # ---------------------------------------------------------------- skin: solid outer form -> 0.04 shell
    mb = MB('LX_cabin_shell')
    roof = offset_poly(CAB, -0.40)
    bot = [mb.bm.verts.new((x, y, CZ0)) for x, y in CAB]
    mid = [mb.bm.verts.new((x, y, CZW)) for x, y in CAB]
    top = [mb.bm.verts.new((x, y, CZR)) for x, y in roof]
    f0 = mb.nf()
    mb.strip([bot, mid, top], True, False, True)
    mb._tag(f0, W)
    shell = mb.to_object(body, sharp=30)
    so = shell.modifiers.new('solid', 'SOLIDIFY')
    so.thickness = 0.04
    so.offset = -1.0
    so.use_even_offset = True
    so.use_rim = True
    so.use_quality_normals = True
    # cutters: hatch + two windows
    cm = MB('LX_tmp_cutter')
    O, U, Vv, N = FRONT
    cm.prism(round_poly(offset_poly(HATCH, 0.008), 0.128), O, U, Vv, N, -0.12, 0.06, W)
    for key in ('FR', 'FL'):
        c, n, u = CHAMF[key]
        cm.prism(win_contour(0.008), c + ZUP * WIN_Z, u, ZUP, n, -0.12, 0.06, W)
    cutter = cm.to_object(body)
    cutter.hide_render = True
    cutter.display_type = 'WIRE'
    bo = shell.modifiers.new('cut', 'BOOLEAN')
    bo.operation = 'DIFFERENCE'
    bo.solver = 'EXACT'
    bo.object = cutter
    apply_modifiers(shell)
    bpy.data.objects.remove(cutter)
    mark_sharp(shell.data, 30)
    b = shell.modifiers.new('bevel', 'BEVEL')
    b.width = 0.016
    b.segments = 3
    b.limit_method = 'ANGLE'
    b.angle_limit = math.radians(30)
    b.use_clamp_overlap = True
    b.harden_normals = True

    # ---------------------------------------------------------------- hatch frame, jamb, panel, sensors
    mb = MB('LX_hatch_frame')
    bez_out = round_poly(rect(-0.52, 2.985, 0.52, 4.47), [0.02, 0.02, 0.19, 0.19], 6)
    mb.ring_prism(bez_out, hatch_contour(), O, U, Vv, N, -0.004, 0.014, M['white_plain'], smooth=True)
    jam_out = round_poly(rect(-0.51, 2.965, 0.51, 4.46), 0.01, 6)
    mb.ring_prism(jam_out, hatch_contour(), O, U, Vv, N, -0.150, -0.003, M['grey'], smooth=True)
    # seal strip just inside the opening
    mb.ring_prism(hatch_contour(0.0), hatch_contour(-0.006), O, U, Vv, N, -0.075, -0.062, M['rubber'], smooth=True)
    for (x, z) in resample(round_poly(offset_poly(HATCH, 0.036), 0.156, 6), 0.11):
        if z < 3.02:
            continue
        mb.cyl((x, -1.564, z), (x, -1.571, z), 0.0075, M['alu_dark'], 8)
    for zc in (3.29, 4.11):     # hinge leaves on the frame
        mb.box((-0.50, -1.567, zc), (0.10, 0.006, 0.12), M['alu_dark'])
    # exterior hatch control panel (left of the door)
    mb.box((-0.715, -1.553, 3.97), (0.20, 0.008, 0.44), M['grey'])
    mb.revolve((-0.72, -1.556, 3.95), (0, -1, 0), [(0.031, 0.0), (0.043, 0.0), (0.043, 0.005), (0.031, 0.005)],
               M['alu_dark'], 24, cap0=False, cap1=False)
    mb.revolve((-0.72, -1.556, 3.95), (0, -1, 0), [(0.031, 0.005), (0.031, -0.0)], M['alu_dark'], 24,
               cap0=False, cap1=False)
    mb.revolve((-0.72, -1.556, 4.09), (0, -1, 0), [(0.026, 0.0), (0.034, 0.0), (0.034, 0.008), (0.026, 0.008)],
               M['alu_dark'], 24, cap0=False, cap1=False)
    for (dx, dz) in ((-0.08, -0.20), (0.08, -0.20), (-0.08, 0.20), (0.08, 0.20)):
        mb.cyl((-0.715 + dx, -1.557, 3.97 + dz), (-0.715 + dx, -1.561, 3.97 + dz), 0.007, M['alu_dark'], 8)
    for i in range(4):
        mb.box((-0.715, -1.5575, 3.83 - i * 0.022), (0.11, 0.003, 0.008), M['dark'])
    # guard hood over the button
    mb.sweep(fillet([(-0.775, -1.556, 3.90), (-0.775, -1.60, 3.90), (-0.775, -1.60, 4.00),
                     (-0.665, -1.60, 4.00), (-0.665, -1.60, 3.90), (-0.665, -1.556, 3.90)], 0.02, 4),
             0.006, M['alu'], 8)
    # sensor strip above the hatch
    mb.box((0, -1.565, 4.56), (0.80, 0.03, 0.07), M['grey'])
    for i in range(6):
        x = -0.30 + i * 0.12
        mb.cyl((x, -1.580, 4.56), (x, -1.586, 4.56), 0.021, M['alu_dark'], 16)
        mb.cyl((x, -1.585, 4.56), (x, -1.592, 4.56), 0.015, M['lens'], 16)
    mb.to_object(body, bevel=(0.004, 2))

    # exterior hatch button: origin = face centre (-0.72, -1.565, 3.95), press = +Y
    mb = MB('btn_hatch_ext')
    c = V((-0.72, -1.565, 3.95))
    mb.revolve(c, (0, 1, 0), [(0.001, 0.0), (0.022, 0.0), (0.027, 0.003), (0.028, 0.008), (0.028, 0.035)],
               M['btn'], 32, cap0=True, cap1=True)
    mb.to_object(body, origin=c, sharp=50)
    # lamp
    mb = MB('lamp_hatch_ext')
    c = V((-0.72, -1.556, 4.09))
    mb.revolve(c, (0, -1, 0), [(0.024, -0.004)] + [(0.024 * math.cos(a), 0.010 + 0.010 * math.sin(a))
                                                   for a in [math.radians(t) for t in (0, 30, 55, 75, 88)]],
               M['lamp'], 24, cap0=True, cap1=True)
    mb.to_object(body, origin=c, sharp=60)

    # ---------------------------------------------------------------- hatch door on hatch_pivot
    hp_mw = Matrix.Translation(V(CTX['spec']['hatch']['pivot']))
    hp = empty('hatch_pivot', body, I4, hp_mw, 0.3)
    mb = MB('hatch_door')
    D = M['door']
    door = round_poly(rect(-0.446, 3.004, 0.446, 4.396), 0.116, 6)
    wr = rect(-0.15, 3.95, 0.15, 4.17)
    wcont = round_poly(wr, 0.05, 6)
    mb.ring_prism(door, wcont, O, U, Vv, N, -0.06, 0.0, D, smooth=True)
    # raised stiffener band on the outer face
    mb.ring_prism(round_poly(offset_poly(rect(-0.446, 3.004, 0.446, 4.396), -0.02), 0.096, 6),
                  round_poly(offset_poly(rect(-0.446, 3.004, 0.446, 4.396), -0.065), 0.051, 6),
                  O, U, Vv, N, -0.002, 0.007, D, smooth=True)
    for (d0, d1) in ((-0.002, 0.012), (-0.072, -0.058)):
        mb.ring_prism(round_poly(offset_poly(wr, 0.032), 0.082, 6), wcont, O, U, Vv, N, d0, d1, M['gold_frame'],
                      smooth=True)
    mb.prism(round_poly(offset_poly(wr, 0.004), 0.054, 6), O, U, Vv, N, -0.040, -0.026, M['glass'])
    # handles (outer + inner) at z 3.75 on the +X side
    for sgn, y0 in ((-1, -1.548), (1, -1.492)):
        y1 = y0 + sgn * 0.055
        mb.sweep(fillet([(0.33, y0, 3.62), (0.33, y1, 3.62), (0.33, y1, 3.88), (0.33, y0, 3.88)], 0.03, 6),
                 0.012, M['alu'], 12)
        for zz in (3.62, 3.88):
            mb.box((0.33, y0 + sgn * 0.004, zz), (0.05, 0.008, 0.05), M['alu_dark'])
        # latch lever
        mb.box((0.20, y0 + sgn * 0.012, 3.75), (0.07, 0.024, 0.10), M['alu_dark'])
        mb.beam((0.20, y0 + sgn * 0.03, 3.75), (0.08, y0 + sgn * 0.03, 3.73), 0.022, 0.016, M['alu'])
    # hinge knuckles on the hinge axis (rotate in place) + door leaves
    for zc in (3.29, 4.11):
        mb.cyl((-0.45, -1.55, zc - 0.07), (-0.45, -1.55, zc + 0.07), 0.024, M['alu_dark'], 16)
        mb.box((-0.39, -1.553, zc), (0.11, 0.006, 0.12), M['alu_dark'])
    door_o = mb.to_object(hp, mw=hp_mw, bevel=(0.003, 2))
    door_o.name = 'hatch_door'

    # ---------------------------------------------------------------- windows (FR, FL)
    mb = MB('LX_windows')
    gl = MB('LX_window_glass')
    for key in ('FR', 'FL'):
        c, n, u = CHAMF[key]
        Oc = c + ZUP * WIN_Z
        mb.ring_prism(win_contour(0.055), win_contour(0.0), Oc, u, ZUP, n, -0.004, 0.016, M['gold_frame'],
                      smooth=True)
        mb.ring_prism(win_contour(0.012), win_contour(0.0), Oc, u, ZUP, n, 0.012, 0.022, M['gold_frame'],
                      smooth=True)
        mb.ring_prism(win_contour(0.06), win_contour(0.0), Oc, u, ZUP, n, -CHAMF_DEPTH, -0.003, M['grey'],
                      smooth=True)
        for (x, y) in resample(win_contour(0.032), 0.085):
            p = Oc + u * x + ZUP * y
            mb.cyl(p + n * 0.016, p + n * 0.022, 0.006, M['alu_dark'], 8)
        gl.prism(win_contour(0.006), Oc, u, ZUP, n, -0.036, -0.022, M['glass'])
    mb.to_object(body, bevel=(0.003, 2))
    g = gl.to_object(body)
    g.visible_shadow = False

    # ---------------------------------------------------------------- roof: tunnel, dish, whips, boxes
    mb = MB('LX_cabin_top')
    tc = V((0, -0.10, 0))
    mb.revolve(tc, ZUP, [(0.42, 5.36), (0.42, 5.69)], W, 48, cap0=False, cap1=False)
    mb.revolve(tc, ZUP, [(0.415, 5.69), (0.448, 5.695), (0.448, 5.75), (0.372, 5.75), (0.372, 5.725)],
               M['alu'], 48, cap0=False, cap1=False)
    mb.revolve(tc, ZUP, [(0.372, 5.725), (0.30, 5.728), (0.06, 5.738), (0.001, 5.738)], M['grey'], 48,
               cap0=False, cap1=False)
    mb.revolve(tc, ZUP, [(0.50, 5.44), (0.50, 5.47), (0.46, 5.50), (0.42, 5.505)], M['foil'], 48,
               cap0=False, cap1=False)
    for k in range(3):
        a = math.radians(90 + 120 * k)
        d = V((math.cos(a), math.sin(a), 0))
        mb.beam(tc + d * 0.40 + ZUP * 5.75, tc + d * 0.30 + ZUP * 5.86, 0.05, 0.012, M['alu'], d.cross(ZUP))
    for k in range(12):
        a = 2 * math.pi * k / 12
        d = V((math.cos(a), math.sin(a), 0))
        mb.cyl(tc + d * 0.41 + ZUP * 5.74, tc + d * 0.41 + ZUP * 5.758, 0.009, M['alu_dark'], 8)
    # small white dish on its 0.4 m mast (roof front-left)
    mp = V((-0.70, -0.85, 5.44))
    mb.cyl(mp - ZUP * 0.03, mp + ZUP * 0.40, 0.03, M['grey'], 14)
    mb.cyl(mp - ZUP * 0.0, mp + ZUP * 0.05, 0.07, M['alu_dark'], 16)
    mb.box(mp + ZUP * 0.42, (0.08, 0.08, 0.07), M['alu_dark'])
    a3 = V((-0.45, -0.75, 0.48)).normalized()
    hub = mp + ZUP * 0.42 + a3 * 0.07
    f3 = 0.25 ** 2 / (4 * 0.075)
    back = [(r, r * r / (4 * f3) - 0.012) for r in (0.03, 0.08, 0.13, 0.18, 0.22, 0.25)]
    front = [(r, r * r / (4 * f3)) for r in (0.25, 0.22, 0.18, 0.13, 0.08, 0.03)]
    mb.revolve(hub, a3, back + [(0.256, 0.25 ** 2 / (4 * f3) - 0.004)] + front, M['white_plain'], 32)
    mb.cyl(hub - a3 * 0.05, hub + a3 * 0.01, 0.04, M['alu_dark'], 14)
    for k in range(3):
        a = 2 * math.pi * k / 3
        e1, e2, _ = frame(a3)
        rp = hub + (e1 * math.cos(a) + e2 * math.sin(a)) * 0.2 + a3 * (0.04 / (4 * f3) * 1.0)
        mb.cyl(rp, hub + a3 * (f3 * 0.9), 0.004, M['alu'], 6)
    mb.revolve(hub + a3 * (f3 * 0.9), a3, [(0.02, -0.02), (0.02, 0.02), (0.012, 0.03)], M['grey'], 12)
    # whip antennas
    for (x, y, L, lean) in ((-0.78, 0.62, 1.40, (-0.10, 0.06)), (0.80, 0.58, 1.20, (0.08, 0.07)),
                            (0.72, -0.86, 1.00, (0.07, -0.05))):
        p = V((x, y, 5.44))
        mb.revolve(p, ZUP, [(0.05, 0.0), (0.05, 0.015), (0.028, 0.03), (0.024, 0.09), (0.012, 0.10)],
                   M['dark'], 14)
        tip = p + V((lean[0], lean[1], L))
        mb.cyl(p + ZUP * 0.09, tip, 0.0065, M['alu'], 8, r1=0.0035)
        mb.sphere(tip, 0.009, M['alu'], 8, 5)
    # roof boxes
    mb.box((0.55, 0.30, 5.48), (0.28, 0.20, 0.07), M['grey'])
    mb.box((-0.50, 0.45, 5.475), (0.22, 0.30, 0.06), M['grey'])
    mb.box((0.40, -0.75, 5.47), (0.18, 0.14, 0.05), M['alu_dark'])
    # RCS quads on the cabin's upper corners (booms out of the roof chamfer, above the windows)
    for key in ('FR', 'FL', 'BR', 'BL'):
        c, n, u = CHAMF[key]
        zc = 5.36
        P = c - n * (zc - CZW) + ZUP * zc
        rcs_quad(mb, P, n, M, M['white_plain'], s=1.0, boom=0.58, drop=0.08)
        if key == 'FR':
            continue      # the arm's deck mount sits in this corner
        # interstage fitting at the bottom of this corner
        mb.box(c + n * 0.04 + ZUP * 3.0, (0.12, 0.22, 0.10), M['grey'], (n, u, ZUP))
        mb.cyl(c + n * 0.10 + ZUP * 3.0 - u * 0.06, c + n * 0.10 + ZUP * 3.0 + u * 0.06, 0.03, M['alu_dark'], 12)
    # aft equipment bay on the deck behind the cabin
    mb.box((0, 1.58, 3.38), (1.50, 0.44, 0.86), M['foil_aft'])
    mb.box((0, 1.58, 3.83), (1.54, 0.48, 0.04), M['white_plain'])
    for sx in (-1, 1):
        mb.cyl((sx * 0.70, 1.80, 3.84), (sx * 0.62, 1.35, 4.30), 0.022, M['alu'], 10)
    # side access panels and vents
    mb.box((1.456, -0.30, 3.62), (0.012, 0.52, 0.56), M['white_plain'])
    mb.box((-1.456, 0.38, 3.62), (0.012, 0.52, 0.56), M['white_plain'])
    mb.box((0, 1.356, 4.42), (0.90, 0.012, 0.46), M['white_plain'])
    for sx in (-1, 1):
        for i in range(5):
            mb.box((sx * 1.458, 0.30 if sx > 0 else -0.55, 3.20 + i * 0.035), (0.01, 0.30, 0.012), M['dark'])
    # EVA handrails on the side and back walls (stand-off tubes)
    rails = [((-1.45, -0.85, 3.98), (-1.45, 0.62, 3.98), V((-1, 0, 0))),
             ((1.45, -0.80, 3.98), (1.45, 0.40, 3.98), V((1, 0, 0))),
             ((-0.70, 1.35, 4.76), (0.70, 1.35, 4.76), V((0, 1, 0)))]
    for a, b, n in rails:
        a = V(a); b = V(b)
        so = 0.065
        mb.sweep(fillet([a, a + n * so, b + n * so, b], 0.04, 6), 0.0145, M['alu'], 12)
        L = (b - a).length
        k = max(1, int(L / 0.55))
        for i in range(1, k):
            q = a.lerp(b, i / k)
            mb.cyl(q, q + n * so, 0.009, M['alu_dark'], 8)
        for q in (a, b):
            mb.cyl(q - n * 0.002, q + n * 0.012, 0.026, M['alu_dark'], 12)
    mb.to_object(body, bevel=(0.005, 2))


# =============================================================================================== antennas
def dish_grid(mb, H, a, R, f, n_around, rings, r0, mat, gore=None):
    """Paraboloid grid (polygonal 'gore' rim when gore=k ribs)."""
    e1, e2, _ = frame(a)

    def P(r, phi):
        return H + a * (r * r / (4 * f)) + (e1 * math.cos(phi) + e2 * math.sin(phi)) * r

    f0 = mb.nf()
    grid = []
    for i in range(rings + 1):
        r = r0 + (R - r0) * (i / rings) ** 0.9
        row = []
        for k in range(n_around):
            if gore:
                per = n_around // gore
                g, s = divmod(k, per)
                p0 = P(r, 2 * math.pi * g / gore); p1 = P(r, 2 * math.pi * (g + 1) / gore)
                row.append(mb.bm.verts.new(p0.lerp(p1, s / per)))
            else:
                row.append(mb.bm.verts.new(P(r, 2 * math.pi * k / n_around)))
        grid.append(row)
    mb.strip(grid, True)
    mb._tag(f0, mat)
    return P


def wire_object(mb, parent, mw, thick, name):
    o = mb.to_object(parent, mw=mw, sharp=80, name=name)
    w = o.modifiers.new('wire', 'WIREFRAME')
    w.thickness = thick
    w.use_replace = True
    w.use_even_offset = True
    w.use_relative_offset = False
    w.use_boundary = True
    return o


def build_antennas(M, body):
    WP = M['white_plain']
    # ---------------------------------------------------------------- big 12-gore mesh antenna (left)
    mb = MB('LX_ant_big_boom')
    mb.box((-1.47, -0.05, 4.20), (0.05, 0.26, 0.26), M['grey'])
    mb.cyl((-1.45, -0.05, 4.20), (-2.22, -0.05, 4.20), 0.045, WP, 16)
    mb.cyl((-1.45, -0.05, 3.82), (-2.02, -0.05, 4.17), 0.022, M['alu'], 10)
    mb.revolve((-2.30, -0.05, 4.20), ZUP, [(0.075, -0.13), (0.075, -0.06), (0.06, -0.05)], M['alu_dark'], 20)
    mb.to_object(body, bevel=(0.004, 2))
    Pv = V((-2.30, -0.05, 4.20))
    pv_mw = Matrix.Translation(Pv)
    piv = empty('antenna_big_pivot', body, I4, pv_mw, 0.35)
    a = V((-0.86, -0.30, 0.40)).normalized()
    H = Pv + a * 0.34
    R, f = 1.10, 1.10 ** 2 / (4 * 0.30)
    e1, e2, _ = frame(a)
    mb = MB('LX_ant_big_struct')
    mb.revolve(Pv, ZUP, [(0.062, -0.05), (0.062, 0.10), (0.05, 0.11)], M['grey'], 20)
    mb.cyl(Pv + ZUP * 0.06, H - a * 0.12, 0.04, M['grey'], 14)
    mb.revolve(H, a, [(0.10, -0.16), (0.15, -0.10), (0.15, 0.03), (0.12, 0.045), (0.05, 0.05)], WP, 32)

    def Pd(r, phi):
        return H + a * (r * r / (4 * f)) + (e1 * math.cos(phi) + e2 * math.sin(phi)) * r

    for k in range(12):
        phi = 2 * math.pi * k / 12
        pts = [Pd(0.12 + (R - 0.12) * i / 10, phi) - a * 0.012 for i in range(11)]
        mb.sweep(pts, 0.011, WP, 8)
        if k % 2 == 0:
            mb.cyl(H - a * 0.14, Pd(0.62, phi) - a * 0.02, 0.008, M['alu'], 6)
    rim = [Pd(R, 2 * math.pi * k / 12) - a * 0.004 for k in range(12)]
    for k in range(12):
        mb.cyl(rim[k], rim[(k + 1) % 12], 0.013, M['gold_frame'], 8)
        mb.sphere(rim[k], 0.018, M['gold_frame'], 8, 5)
    F = H + a * (f * 0.92)
    for k in (0, 4, 8):
        mb.cyl(Pd(0.80, 2 * math.pi * k / 12 + 0.0), F, 0.009, WP, 8)
    mb.revolve(F, -a, [(0.035, -0.04), (0.035, 0.02), (0.075, 0.13), (0.07, 0.13), (0.03, 0.03)], M['grey'], 20,
               cap0=True, cap1=False)
    mb.to_object(piv, mw=pv_mw, sharp=40, bevel=(0.003, 2, 40))
    mb = MB('LX_ant_big_mesh')
    dish_grid(mb, H, a, R, f, 48, 14, 0.14, M['mesh'], gore=12)
    wire_object(mb, piv, pv_mw, 0.0035, 'LX_ant_big_mesh')
    mb = MB('LX_ant_big_fine')
    dish_grid(mb, H - a * 0.002, a, R, f, 48, 14, 0.14, M['mesh_fine'], gore=12)
    mb.to_object(piv, mw=pv_mw, sharp=80)

    # ---------------------------------------------------------------- round umbrella dish (right)
    mb = MB('LX_ant_small_mast')
    mb.box((1.465, 0.60, 4.40), (0.04, 0.20, 0.20), M['grey'])
    mb.cyl((1.45, 0.60, 4.40), (1.56, 0.60, 4.40), 0.045, WP, 16)
    mb.to_object(body, bevel=(0.004, 2))
    Ps = V((1.60, 0.60, 4.40))
    ps_mw = Matrix.Translation(Ps)
    pivs = empty('antenna_small_pivot', body, I4, ps_mw, 0.3)
    a2 = V((0.8, 0.0, 0.6)).normalized()
    H2 = Ps + a2 * 0.40
    R2, f2 = 0.80, 0.80 ** 2 / (4 * 0.22)
    e1, e2, _ = frame(a2)

    def Ps2(r, phi):
        return H2 + a2 * (r * r / (4 * f2)) + (e1 * math.cos(phi) + e2 * math.sin(phi)) * r

    mb = MB('LX_ant_small_struct')
    mb.sphere(Ps, 0.06, M['alu_dark'], 16, 8)
    mb.cyl(Ps, H2 - a2 * 0.08, 0.035, M['grey'], 14)
    mb.revolve(H2, a2, [(0.06, -0.10), (0.10, -0.06), (0.10, 0.02), (0.04, 0.03)], WP, 28)
    for k in range(16):
        phi = 2 * math.pi * k / 16
        mb.sweep([Ps2(0.09 + (R2 - 0.09) * i / 8, phi) - a2 * 0.010 for i in range(9)], 0.008, WP, 6)
    ring = [Ps2(R2, 2 * math.pi * k / 48) - a2 * 0.003 for k in range(49)]
    mb.sweep(ring, 0.012, WP, 8, cap0=False, cap1=False)
    F2 = H2 + a2 * (f2 * 0.85)
    mb.cyl(H2, F2, 0.014, M['alu'], 10)
    mb.revolve(F2, a2, [(0.02, -0.01), (0.07, 0.0), (0.07, 0.012), (0.02, 0.02)], WP, 24)
    mb.to_object(pivs, mw=ps_mw, sharp=40, bevel=(0.003, 2, 40))
    mb = MB('LX_ant_small_mesh')
    dish_grid(mb, H2, a2, R2, f2, 64, 10, 0.10, M['mesh'])
    wire_object(mb, pivs, ps_mw, 0.003, 'LX_ant_small_mesh')
    mb = MB('LX_ant_small_fine')
    dish_grid(mb, H2 - a2 * 0.002, a2, R2, f2, 64, 10, 0.10, M['mesh_fine'])
    mb.to_object(pivs, mw=ps_mw, sharp=80)


# =============================================================================================== robotic arm
ARM = {}


def build_arm(M, body):
    WP, J = M['white_plain'], M['alu_dark']
    yaw = math.radians(-15.0)
    Rz = Matrix.Rotation(yaw, 4, 'Z')
    o = (Rz.to_3x3() @ XA)
    p = (Rz.to_3x3() @ YA)
    Bp = V((1.35, -1.20, 2.95))
    mw_b = Matrix.Translation(Bp) @ Rz
    eb = empty('arm_base', body, I4, mw_b, 0.25)
    # the spec puts the yaw axis only 7 cm off the cabin's front-right chamfer, so the turntable is slim and a
    # rotating outrigger carries the shoulder 0.22 m out from the wall
    S = Bp + o * 0.22 + ZUP * 0.36
    mw_s = Matrix.Translation(S) @ Rz
    es = empty('arm_shoulder', eb, mw_b, mw_s, 0.2)
    du = (o * math.cos(math.radians(70)) + ZUP * math.sin(math.radians(70))).normalized()
    E = S + du * 1.60
    mw_e = Matrix.Translation(E) @ Rz
    ee = empty('arm_elbow', es, mw_s, mw_e, 0.2)
    df = (o * math.sin(math.radians(22)) - ZUP * math.cos(math.radians(22))).normalized()
    Wr = E + df * 1.40
    mw_w = Matrix.Translation(Wr) @ Rz
    ew = empty('arm_wrist', ee, mw_e, mw_w, 0.15)

    # static deck mount (on the body): foot plate out from the chamfer wall + lower bearing ring
    nc = V((S2, -S2, 0))
    tcw = V((S2, S2, 0))
    mb = MB('LX_arm_mount')
    mb.box(Bp + nc * 0.13 + ZUP * 0.02, (0.30, 0.36, 0.04), M['grey'], (nc, tcw, ZUP))
    for du_, dv_ in ((0.10, 0.14), (0.10, -0.14), (0.24, 0.14), (0.24, -0.14)):
        q = Bp + nc * (0.13 + du_ - 0.17) + tcw * dv_ + ZUP * 0.04
        mb.cyl(q, q + ZUP * 0.012, 0.012, J, 6)
    mb.revolve(Bp, ZUP, [(0.062, 0.035), (0.064, 0.04), (0.064, 0.075), (0.058, 0.08)], J, 24)
    mb.to_object(body, bevel=(0.004, 2))
    # rotating part: slim turntable collar + outrigger + yoke
    mb = MB('LX_arm_base_mesh')
    mb.revolve(Bp, ZUP, [(0.056, 0.08), (0.056, 0.22), (0.05, 0.23)], M['grey'], 24)
    mb.beam(Bp + ZUP * 0.17, Bp + o * 0.30 + ZUP * 0.17, 0.11, 0.08, WP, ZUP)
    mb.box(Bp + o * 0.22 + ZUP * 0.17, (0.12, 0.33, 0.07), WP, (o, p, ZUP))
    for sd in (-1, 1):
        c = S + p * (sd * 0.14) - ZUP * 0.06
        mb.box(c, (0.20, 0.03, 0.24), WP, (o, p, ZUP))
        mb.cyl(c + p * (sd * 0.015) + ZUP * 0.06, c + p * (sd * 0.03) + ZUP * 0.06, 0.05, J, 16)
    mb.beam(Bp + ZUP * 0.10, Bp + o * 0.20 + ZUP * 0.13, 0.03, 0.03, M['dark'], ZUP)
    mb.to_object(eb, mw=mw_b, bevel=(0.004, 2))

    side_u = du.cross(p).normalized()
    mb = MB('LX_arm_upper_mesh')
    mb.cyl(S - p * 0.125, S + p * 0.125, 0.10, J, 24)
    mb.cyl(S - p * 0.135, S + p * 0.135, 0.06, M['grey'], 16)
    mb.revolve(S, du, [(0.075, 0.07), (0.075, 0.16), (0.063, 0.18), (0.063, 1.42), (0.075, 1.44), (0.075, 1.52)],
               WP, 24, cap0=True, cap1=True)
    mb.revolve(S, du, [(0.068, 0.72), (0.068, 0.76)], J, 24)
    mb.box(S + du * 0.42 + side_u * 0.075, (0.34, 0.06, 0.05), M['grey'], (du, p, side_u))
    mb.sweep([S + du * 0.12 + p * 0.072, S + du * 0.75 + p * 0.072 + side_u * 0.01, E - du * 0.12 + p * 0.072],
             0.009, M['dark'], 8)
    mb.to_object(es, mw=mw_s, bevel=(0.004, 2))

    side_f = df.cross(p).normalized()
    mb = MB('LX_arm_fore_mesh')
    mb.cyl(E - p * 0.11, E + p * 0.11, 0.088, J, 24)
    mb.cyl(E - p * 0.12, E + p * 0.12, 0.05, M['grey'], 16)
    mb.revolve(E, df, [(0.065, 0.06), (0.065, 0.14), (0.054, 0.16), (0.054, 1.27), (0.064, 1.29), (0.064, 1.35)],
               WP, 24)
    mb.revolve(E, df, [(0.059, 0.66), (0.059, 0.70)], J, 24)
    mb.sweep([E + df * 0.12 + p * 0.062, E + df * 0.7 + p * 0.062, Wr - df * 0.1 + p * 0.062], 0.008, M['dark'], 8)
    mb.to_object(ee, mw=mw_e, bevel=(0.004, 2))

    g = df
    ge1, ge2, _ = frame(g)
    mb = MB('LX_arm_wrist_mesh')
    mb.cyl(Wr - p * 0.08, Wr + p * 0.08, 0.066, J, 20)
    mb.revolve(Wr, g, [(0.058, 0.02), (0.058, 0.12), (0.07, 0.13), (0.07, 0.165)], M['grey'], 24)
    mb.revolve(Wr, g, [(0.09, 0.165), (0.09, 0.19), (0.075, 0.205), (0.04, 0.21)], WP, 24)
    cam = Wr + g * 0.10 + side_f * 0.085
    mb.box(cam, (0.06, 0.05, 0.05), M['grey'], (g, p, side_f))
    mb.cyl(cam + g * 0.03, cam + g * 0.05, 0.014, M['lens'], 12)
    mb.to_object(ew, mw=mw_w, bevel=(0.003, 2))

    fingers = []
    for k in range(3):
        ang = 2 * math.pi * k / 3
        rk = (ge1 * math.cos(ang) + ge2 * math.sin(ang)).normalized()
        Fk = Wr + g * 0.20 + rk * 0.062
        yk = g.cross(rk).normalized()
        mw_f = mframe(Fk, rk, yk, g)
        ef = empty('arm_finger_%d' % (k + 1), ew, mw_w, mw_f, 0.06, rot_mode='YXZ')
        fingers.append(ef)
        mb = MB('LX_arm_finger_%d_mesh' % (k + 1))
        mb.cyl(Fk - yk * 0.025, Fk + yk * 0.025, 0.018, J, 12)
        k1 = Fk + g * 0.11 + rk * 0.03
        mb.beam(Fk, k1, 0.034, 0.03, M['grey'], rk)
        mb.cyl(k1 - yk * 0.02, k1 + yk * 0.02, 0.016, J, 12)
        tip = Fk + g * 0.22 - rk * 0.02
        mb.beam(k1, tip, 0.028, 0.024, WP, rk)
        mb.revolve(tip, (tip - k1), [(0.014, -0.005), (0.004, 0.035)], M['dark'], 10)
        mb.to_object(ef, mw=mw_f, bevel=(0.002, 2))
    ARM.update(base=eb, shoulder=es, elbow=ee, wrist=ew, fingers=fingers)


# =============================================================================================== actions
def channelbag_fcurves(act, slot):
    for layer in act.layers:
        for st in layer.strips:
            cb = st.channelbag(slot)
            if cb:
                return list(cb.fcurves)
    return []


def make_action(name, tracks, cyclic=False, frames=(1, 61), keep=True):
    """tracks: list of (object, data_path, index, [(frame, value), ...])."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rest = {}
    for ob, path, idx, keys in tracks:
        rest.setdefault((ob.name, path, idx), getattr(ob, path)[idx])
        ad = ob.animation_data_create()
        if ad.action is not act:
            ad.action = act
        for fr, val in keys:
            getattr(ob, path)[idx] = val
            ob.keyframe_insert(path, index=idx, frame=fr)
    act.use_frame_range = True
    act.frame_start, act.frame_end = frames
    for ob in {t[0] for t in tracks}:
        ad = ob.animation_data
        for fc in channelbag_fcurves(act, ad.action_slot):
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
                kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
            if cyclic:
                fc.modifiers.new('CYCLES')
            fc.update()
        if not keep:
            ad.action = None
    for ob, path, idx, keys in tracks:
        getattr(ob, path)[idx] = rest[(ob.name, path, idx)]
    return act


def make_actions():
    hp = bpy.data.objects['hatch_pivot']
    op = math.radians(CTX['spec']['hatch']['open_deg'])
    make_action('HatchOpen', [(hp, 'rotation_euler', 2, [(1, 0.0), (61, op)])], frames=(1, 61), keep=False)
    make_action('HatchClose', [(hp, 'rotation_euler', 2, [(1, op), (61, 0.0)])], frames=(1, 61), keep=False)
    hp.rotation_euler.z = 0.0

    def wave(rest, amp, fn, period=180, step=10):
        # every channel starts at its rest value on frame 1 and loops seamlessly
        return [(1 + i, rest + amp * fn(2 * math.pi * i / period)) for i in range(0, period + 1, step)]

    tr = []
    b = ARM['base']
    tr.append((b, 'rotation_euler', 2, wave(b.rotation_euler.z, math.radians(8.0), math.sin)))
    tr.append((ARM['shoulder'], 'rotation_euler', 1,
               wave(0.0, math.radians(5.0), lambda t: 0.5 * (1 - math.cos(t)))))
    tr.append((ARM['elbow'], 'rotation_euler', 1, wave(0.0, math.radians(-7.0), lambda t: 0.5 * (1 - math.cos(t)))))
    tr.append((ARM['wrist'], 'rotation_euler', 1, wave(0.0, math.radians(12.0), lambda t: math.sin(2 * t) * 0.6)))
    for f in ARM['fingers']:
        tr.append((f, 'rotation_euler', 1, wave(f.rotation_euler.y, math.radians(14.0),
                                                 lambda t: 0.5 * (1 - math.cos(2 * t)))))
    make_action('ArmIdle', tr, cyclic=True, frames=(1, 181), keep=True)
    ab = bpy.data.objects['antenna_big_pivot']
    s15 = math.radians(15.0)
    make_action('AntennaScan', [(ab, 'rotation_euler', 2, [(1, 0.0), (61, s15), (121, 0.0), (181, -s15),
                                                           (241, 0.0)])], cyclic=True, frames=(1, 241), keep=True)


# =============================================================================================== entry
def build(ctx):
    CTX.update(ctx)
    M = make_materials()
    base, body = ctx['base'], ctx['body']
    build_descent(M, base)
    build_legs(M, base)
    build_porch(M, base)
    build_cabin(M, body)
    build_antennas(M, body)
    build_arm(M, body)
    make_actions()
    for o in ctx['col_ext'].objects:
        for c in list(o.users_collection):
            if c is not ctx['col_ext']:
                c.objects.unlink(o)
    dg = bpy.context.evaluated_depsgraph_get()
    tris = 0
    for o in ctx['col_ext'].objects:
        if o.type == 'MESH':
            me = o.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            tris += len(me.loop_triangles)
            o.evaluated_get(dg).to_mesh_clear()
    log('objects', len(ctx['col_ext'].objects), 'triangles', tris)
