// The HDU complex (`?hdu`, src/scene/HduComplex.tsx): its models keep the contract the game draws them by, and what
// the game adds round them (portholes, the sandbag shield) fits the real exterior model — checked against the
// model's own triangles, since the scene cannot be looked at in a test.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { DOOR_AZ, HDU, HDU_MODULE_X, HDU_MODULES, moduleToGame } from './layout';
import { BAG, sandbagSlots, type Slot } from './parts/Sandbags';
import { DOOR_FRAME, DOOR_LAMP, GAUGE, HITBOX, PORCH, PORTS, PORT_R, SHIELD, bagCorners, buildExterior, moduleAt, shieldKeep, type GlowPiece } from './hduParts';
import { inHduModule } from './astra/shellFit';

const EXTERIOR = 'public/models/nasa-outpost/hdu_complex.glb';
const INTERIOR = (id: string) => `public/models/interiors/hdu_${id}.glb`;
const MB = 1024 * 1024;

/** The JSON chunk of a GLB: node names, root nodes, clip names, material names. */
function json(f: string) {
  const b = readFileSync(f);
  const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
  const names: string[] = j.nodes.map((n: { name?: string }) => n.name);
  return {
    names: new Set(names),
    roots: (j.scenes[j.scene ?? 0].nodes as number[]).map((i) => names[i]),
    anims: (j.animations ?? []).map((a: { name: string }) => a.name) as string[],
    mats: (j.materials ?? []).map((m: { name: string }) => m.name) as string[],
  };
}

describe('HDU complex models', () => {
  it('exterior: the three modules (shell + frame each) and the two tunnels as root nodes', () => {
    expect(new Set(json(EXTERIOR).roots)).toEqual(
      new Set(['A_habitat_shell', 'A_habitat_frame', 'B_lab_shell', 'B_lab_frame', 'C_greenhouse_shell', 'C_greenhouse_frame', 'tunnel_A_B', 'tunnel_C_A']),
    );
  });

  it.each(['habitat', 'lab', 'greenhouse'])('%s interior: the contract nodes, the three door clips, ≤ 14 int_/glow_ materials', (id) => {
    const g = json(INTERIOR(id));
    expect(g.roots).toEqual([`${id}_interior`]);
    for (const n of ['door', 'door_inner', 'furniture', 'glow']) expect(g.names.has(`${id}_${n}`), `${id}_${n}`).toBe(true);
    expect(g.anims).toEqual(expect.arrayContaining(['DoorOpen', 'DoorOpenOuter', 'DoorOpenInner']));
    expect(g.mats.length).toBeLessThanOrEqual(14);
    for (const m of g.mats) expect(m).toMatch(/^(int|glow)_/);
  });

  it('greenhouse: its lettuce in four sets by garden level', () => {
    const g = json(INTERIOR('greenhouse'));
    for (let k = 1; k <= 4; k++) expect(g.names.has(`greenhouse_plants_${k}`), `greenhouse_plants_${k}`).toBe(true);
  });

  it('every file is within the phone budget (≤ 1 MB each)', () => {
    for (const f of [EXTERIOR, ...['habitat', 'lab', 'greenhouse'].map(INTERIOR)]) expect(statSync(f).size, f).toBeLessThanOrEqual(MB);
  });

  it('the old single module at 1.5x is gone', () => {
    expect(existsSync('public/models/nasa-outpost/hdu_habitat.glb')).toBe(false);
  });
});

let scene: THREE.Group;
beforeAll(async () => {
  await MeshoptDecoder.ready;
  const buf = readFileSync(EXTERIOR);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  // (no images in node: the WebP textures load as none; geometry, nodes and paints are what is checked)
  loader.register(() => ({ name: 'EXT_texture_webp', loadTexture: () => Promise.resolve(null) }) as never);
  const gltf = await loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '');
  scene = gltf.scene;
  scene.updateMatrixWorld(true);
});

const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

describe('the exterior as the game draws it (hduParts.ts buildExterior)', () => {
  it('is 6 draw calls: one instanced mesh per part and paint, only the shells cast shadows', () => {
    const { group, dispose } = buildExterior(scene);
    const parts = group.children as THREE.InstancedMesh[];
    expect(parts.length).toBe(6);
    const count = Object.fromEntries(parts.map((m) => [m.name, m.count]));
    expect(count).toEqual({
      hdu_shell_lambert2SG: 3,
      hdu_frame_lambert3SG: 3,
      hdu_tunnel_panel: 2,
      hdu_tunnel_gold: 2,
      hdu_tunnel_int_wall: 2,
      hdu_tunnel_int_floor: 2,
    });
    for (const m of parts) expect(m.castShadow, m.name).toBe(m.name.startsWith('hdu_shell'));
    // no "glass" paint left (KHR_materials_transmission would add a transmission pass to every frame)
    for (const m of parts) expect((m.material as THREE.MeshPhysicalMaterial).transmission ?? 0, m.name).toBe(0);
    const triangles = parts.reduce((n, m) => n + tris(m.geometry) * m.count, 0);
    expect(triangles).toBeLessThan(21000); // 19.6k
    dispose();
  });

  it('puts each shell at its module centre (complex frame)', () => {
    const { group } = buildExterior(scene);
    const shell = group.children.find((m) => m.name.startsWith('hdu_shell')) as THREE.InstancedMesh;
    const xs: number[] = [];
    const m4 = new THREE.Matrix4();
    const box = new THREE.Box3();
    shell.geometry.computeBoundingBox();
    for (let i = 0; i < shell.count; i++) {
      shell.getMatrixAt(i, m4);
      box.copy(shell.geometry.boundingBox!).applyMatrix4(m4);
      // the shell's cylinder is centred on the module (its side module only reaches back, −z)
      xs.push((box.min.x + box.max.x) / 2);
    }
    expect(xs.sort((a, b) => a - b).map((x) => Math.round(x) + 0)).toEqual([HDU_MODULE_X.greenhouse, HDU_MODULE_X.habitat, HDU_MODULE_X.lab]);
  });
});

/** All of the exterior's meshes, for rays and samples. */
const meshes = () => {
  const out: THREE.Mesh[] = [];
  scene.traverse((o) => (o as THREE.Mesh).isMesh && out.push(o as THREE.Mesh));
  return out;
};
/** The root node a mesh belongs to (A_habitat_shell, tunnel_A_B, …). */
const rootOf = (o: THREE.Object3D) => {
  while (o.parent && o.parent !== scene) o = o.parent;
  return o.name;
};

describe('portholes', () => {
  it.each(HDU_MODULES)('%s: each one sits just proud of its own shell, with no fin or frame over it', (id) => {
    const cx = HDU_MODULE_X[id];
    const ray = new THREE.Raycaster();
    const all = meshes();
    const shellName = { habitat: 'A_habitat_shell', lab: 'B_lab_shell', greenhouse: 'C_greenhouse_shell' }[id];
    for (const [a, y, r] of PORTS) {
      const out = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const along = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
      // the port's middle and four points of its rim
      for (const [s, t] of [[0, 0], [PORT_R, 0], [-PORT_R, 0], [0, PORT_R], [0, -PORT_R]]) {
        const p = new THREE.Vector3(cx, y + t, 0).addScaledVector(out, r).addScaledVector(along, s);
        ray.set(p.clone().addScaledVector(out, 4), out.clone().negate());
        const hit = ray.intersectObjects(all, false)[0];
        expect(hit, `${id} port ${a.toFixed(2)} ${s} ${t}`).toBeDefined();
        expect(rootOf(hit.object), `${id} port ${a.toFixed(2)} ${s} ${t}: first hit at ${hit.point.toArray().map((v) => v.toFixed(2))}`).toBe(shellName);
        const depth = hit.point.clone().sub(p).dot(out); // < 0: the shell lies behind the port
        expect(depth, `${id} port ${a.toFixed(2)} ${s} ${t}`).toBeLessThan(-0.005);
        if (s === 0 && t === 0) expect(depth, `${id} port ${a.toFixed(2)}: on the shell`).toBeGreaterThan(-0.06);
      }
    }
  });
});

describe('door lights and the growth gauge (D2, D5)', () => {
  const sets: [string, readonly GlowPiece[], readonly string[]][] = [
    ['frame', DOOR_FRAME, HDU_MODULES],
    ['lamp', DOOR_LAMP, HDU_MODULES],
    ['gauge', GAUGE, ['greenhouse']],
  ];
  it.each(sets)('%s: every piece sits just in front of its own shell, nothing of the model in or before it', (name, pieces, ids) => {
    const ray = new THREE.Raycaster();
    const all = meshes();
    for (const id of ids) {
      const cx = HDU_MODULE_X[id as keyof typeof HDU_MODULE_X];
      pieces.forEach((g, n) => {
        const out = new THREE.Vector3(Math.sin(g.a), 0, Math.cos(g.a));
        const along = new THREE.Vector3(Math.cos(g.a), 0, -Math.sin(g.a));
        for (const [s, t] of [[0, 0], [g.w / 2, g.h / 2], [-g.w / 2, g.h / 2], [g.w / 2, -g.h / 2], [-g.w / 2, -g.h / 2]]) {
          const back = new THREE.Vector3(cx, g.y + t, 0).addScaledVector(out, g.r - g.d / 2).addScaledVector(along, s);
          ray.set(back.clone().addScaledVector(out, 4), out.clone().negate());
          const hit = ray.intersectObjects(all, false)[0];
          const where = `${id} ${name} #${n} (${s.toFixed(2)}, ${t.toFixed(2)})`;
          expect(hit, where).toBeDefined();
          const depth = hit.point.clone().sub(back).dot(out); // < 0: the model lies behind the piece's back
          expect(depth, `${where}: first hit at ${hit.point.toArray().map((v) => v.toFixed(2))}`).toBeLessThan(-0.003);
          expect(depth, `${where}: on the shell`).toBeGreaterThan(-0.1);
        }
      });
    }
  });

  it('clear of the door hole and the outer leaf (x ±0.5, up to 2.45 m) and of the ramp in front (z ≥ 2.26)', () => {
    for (const g of [...DOOR_FRAME, ...DOOR_LAMP, ...GAUGE]) {
      const x = Math.sin(g.a) * g.r, z = Math.cos(g.a) * g.r;
      const halfX = (Math.abs(Math.cos(g.a)) * g.w) / 2 + (Math.abs(Math.sin(g.a)) * g.d) / 2;
      const beside = Math.abs(x) - halfX >= HDU.door.w / 2 + 0.08;
      const above = g.y - g.h / 2 >= HDU.floor + HDU.door.h + 0.1;
      expect(beside || above, `piece at a ${g.a.toFixed(2)}, y ${g.y.toFixed(2)}`).toBe(true);
      expect(z + g.d, 'in front of the ramp').toBeLessThan(HDU.front);
    }
  });
});

/** Does a bag (slot) hold the point (module frame)? Its box, a hair bigger, up to the top of its course. */
function inBag(s: Slot, x: number, y: number, z: number, pad = 0.02): boolean {
  const dx = x - Math.sin(s.a) * s.r, dz = z - Math.cos(s.a) * s.r;
  const along = dx * Math.cos(s.a) - dz * Math.sin(s.a);
  const out = dx * Math.sin(s.a) + dz * Math.cos(s.a);
  const y0 = s.course * (BAG.h - 0.015);
  return Math.abs(along) <= BAG.w / 2 + pad && Math.abs(out) <= BAG.d / 2 + pad && y >= y0 - pad && y <= y0 + BAG.h + pad;
}

describe('sandbags', () => {
  it('keep their old ring round ASTRA / ?lite habitats by default', () => {
    // the ring before the HDU options (one row, a 46° gap at the door), rebuilt here as it was
    for (const radius of [3.2, 3.5]) {
      const R = radius + BAG.d / 2 + 0.08;
      const per = Math.floor((2 * Math.PI * R) / (BAG.w + 0.02));
      const old: Slot[] = [];
      for (let course = 0; course < 6; course++) {
        for (let i = 0; i < per; i++) {
          const a = ((i + (course % 2 ? 0.5 : 0)) / per) * Math.PI * 2;
          const off = Math.atan2(Math.sin(a - DOOR_AZ), Math.cos(a - DOOR_AZ));
          if (Math.abs(off) < THREE.MathUtils.degToRad(46) / 2) continue;
          old.push({ a, r: R, course });
        }
      }
      expect(sandbagSlots(radius)).toEqual(old);
    }
  });

  const slots = sandbagSlots(SHIELD.radius, SHIELD.rows, shieldKeep(BAG.w, BAG.d));

  it('the HDU habitat module gets a real shield: both bays by the door, every level', () => {
    expect(slots.length).toBeGreaterThanOrEqual(30);
    for (const side of [1, -1]) expect(slots.filter((s) => Math.sign(Math.sin(s.a)) === side && s.course === 5).length, `side ${side}`).toBeGreaterThan(0);
  });

  it('lies inside the module hitbox, in front, off the porch, the door and the out spot', () => {
    for (const s of slots) {
      const cs = bagCorners(s.a, s.r, BAG.w, BAG.d);
      const where = `bag at ${THREE.MathUtils.radToDeg(s.a).toFixed(1)}° r ${s.r.toFixed(2)}`;
      for (const [x, z] of cs) {
        expect(Math.hypot(x - HITBOX.x, z - HITBOX.z), where).toBeLessThanOrEqual(HITBOX.r);
        expect(z, where).toBeGreaterThan(-1);
        expect(Math.abs(x), where).toBeGreaterThan(HDU.door.w / 2 + 0.2);
        expect(Math.hypot(x, z - 4.0), where).toBeGreaterThan(0.6); // the out spot (src/walk/rooms.ts HDU_OUT)
      }
      // the porch rectangle and the bag (a turned box) do not overlap: a separating axis among the four sides' normals
      const axes = [[1, 0], [0, 1], [Math.sin(s.a), Math.cos(s.a)], [Math.cos(s.a), -Math.sin(s.a)]];
      const rect = [[PORCH.x0, PORCH.z0], [PORCH.x0, PORCH.z1], [PORCH.x1, PORCH.z0], [PORCH.x1, PORCH.z1]];
      const apart = axes.some(([ax, az]) => {
        const p1 = cs.map(([x, z]) => x * ax + z * az), p2 = rect.map(([x, z]) => x * ax + z * az);
        return Math.max(...p1) < Math.min(...p2) || Math.max(...p2) < Math.min(...p1);
      });
      expect(apart, `${where}: the porch`).toBe(true);
    }
  });

  it('touches nothing of the real model: shell, fins, legs, porch, tunnels', () => {
    const p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let sampled = 0;
    const hits: string[] = [];
    for (const m of meshes()) {
      const pos = m.geometry.getAttribute('position');
      const idx = m.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let t = 0; t < n; t += 3) {
        a.fromBufferAttribute(pos, idx ? idx.getX(t) : t).applyMatrix4(m.matrixWorld);
        b.fromBufferAttribute(pos, idx ? idx.getX(t + 1) : t + 1).applyMatrix4(m.matrixWorld);
        c.fromBufferAttribute(pos, idx ? idx.getX(t + 2) : t + 2).applyMatrix4(m.matrixWorld);
        if (Math.min(a.y, b.y, c.y) > 1.25 || Math.min(Math.hypot(a.x, a.z), Math.hypot(b.x, b.z), Math.hypot(c.x, c.z)) > 4) continue;
        const N = Math.min(120, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / 0.04)); // every 4 cm
        for (let i = 0; i <= N; i++) {
          for (let j = 0; i + j <= N; j++) {
            p.copy(a).multiplyScalar(1 - (i + j) / N).addScaledVector(b, i / N).addScaledVector(c, j / N);
            sampled++;
            for (const s of slots) if (inBag(s, p.x, p.y, p.z)) hits.push(`${m.name} at ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)}`);
          }
        }
      }
    }
    expect(hits.slice(0, 5)).toEqual([]);
    expect(sampled).toBeGreaterThan(10000);
  }, 30000);
});

describe('where the camera is (inHduModule) and what a tap hits (moduleAt)', () => {
  it('knows each module from inside, both floors', () => {
    for (const id of HDU_MODULES) {
      const [x, z] = moduleToGame(id, 0.8, -0.6);
      expect(inHduModule(x, HDU.floor + 1.7, z)).toBe(id);
      expect(inHduModule(x, HDU.deck + 1.7, z)).toBe(id);
      expect(moduleAt(x, z)).toBe(id);
    }
  });

  it('is outside at the door spot, over the dome and in a tunnel', () => {
    const [ox, oz] = moduleToGame('habitat', 0, 4.0);
    expect(inHduModule(ox, 1.7, oz)).toBeNull();
    const [cx, cz] = moduleToGame('lab', 0, 0);
    expect(inHduModule(cx, HDU.top + 0.5, cz)).toBeNull();
    const [tx, tz] = moduleToGame('habitat', 6.5, 0);
    expect(inHduModule(tx, 1.5, tz)).toBeNull();
    // a tap on a tunnel goes to its nearer module
    expect(moduleAt(...moduleToGame('habitat', 5, 0))).toBe('habitat');
    expect(moduleAt(...moduleToGame('habitat', 8, 0))).toBe('lab');
    expect(moduleAt(...moduleToGame('habitat', -8, 0))).toBe('greenhouse');
  });
});
