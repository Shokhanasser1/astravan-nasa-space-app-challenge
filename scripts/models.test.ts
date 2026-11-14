// Every shipped GLB loads in three.js with the meshopt decoder and keeps the phone budget (docs/PERFORMANCE.md,
// docs/specs/2026-11-14-nasa-models.md): required node names, ≤ 1 MB each, < 5 MB together, no Draco, triangles.
// Runs in `npm test` (node, no browser). A building that is not there yet is reported, not failed: the scene keeps
// all six grey shapes until all six load (src/scene/models/Shell.tsx).
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { BUILDINGS, FOOTPRINT, HEIGHT, REQUIRED_NODES, modelPath, prepareBuilding } from '../src/scene/models/kit';

const root = fileURLToPath(new URL('..', import.meta.url));
const pub = join(root, 'public');
const MB = 1024 * 1024;

/** Triangle budgets. Phone scene < 100k: terrain ~33k + small parts ~4k leave ~60k for the six buildings. */
const BUDGET = { building: 15_000, buildingsTotal: 60_000, extra: 20_000, buildingCalls: 26 };

/** Moving parts must survive `npm run glb -- in out --flatten false` as EMPTY pivot nodes with the mesh as a child. */
const PIVOTS = ['arm', 'dish_head', 'scout_wheel_fl', 'scout_wheel_fr', 'scout_wheel_rl', 'scout_wheel_rr', 'lander_body'];

type Extra = { path: string; nodes: string[]; skinned?: boolean; clips?: string[] };
const EXTRAS: Record<string, Extra> = {
  lro: { path: 'models/nasa-lro/lro.glb', nodes: [] },
  astronaut: {
    path: 'models/astronaut/astronaut.glb',
    nodes: [],
    skinned: true,
    clips: ['Idle', 'Walk', 'Run', 'Jump', 'Carry', 'Pour'],
  },
};

/** The JSON chunk of a GLB (extensions are declared there). */
function glbJson(buf: Buffer): { extensionsUsed?: string[]; extensionsRequired?: string[]; images?: unknown[] } {
  expect(buf.readUInt32LE(0)).toBe(0x46546c67); // 'glTF'
  const len = buf.readUInt32LE(12);
  expect(buf.readUInt32LE(16)).toBe(0x4e4f534a); // 'JSON'
  return JSON.parse(buf.subarray(20, 20 + len).toString('utf8'));
}

async function load(file: string): Promise<GLTF> {
  const buf = readFileSync(file);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  // No browser images in node: textures become empty placeholders; geometry, nodes, skins and clips load for real.
  loader.register((parser) => {
    parser.loadImageSource = () => Promise.resolve(new THREE.Texture());
    return { name: 'node_no_images' };
  });
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return loader.parseAsync(ab, '');
}

/** Draw calls of a building as the game shows it: prepare() merges static meshes per material, hides model glow. */
function gameCalls(b: (typeof BUILDINGS)[number]): number {
  let n = 0;
  prepareBuilding(b, loaded.get(b)!.scene).root.traverse((o) => void ((o as THREE.Mesh).isMesh && o.visible && n++));
  return n;
}

/**
 * Share of BACK faces among the first hits of rays shot at the model from 8 directions around it. The game draws the
 * buildings single-sided (shared FrontSide materials), so a back face there is a hole you can see through.
 */
function backFaceShare(scene: THREE.Object3D): number {
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && !/glow/.test((m.material as THREE.Material).name)) meshes.push(m);
  });
  const sided = meshes.map((m) => [m, m.material as THREE.Material] as const);
  for (const [m, mat] of sided) m.material = Object.assign(mat.clone(), { side: THREE.DoubleSide });
  scene.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(scene, true);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z) * 0.6;
  const rc = new THREE.Raycaster();
  const n = new THREE.Vector3();
  let hits = 0;
  let back = 0;
  for (let k = 0; k < 8; k++) {
    const az = (k * Math.PI) / 4;
    const dir = new THREE.Vector3(Math.sin(az) * 0.97, 0.25, Math.cos(az) * 0.97).normalize();
    const eye = c.clone().addScaledVector(dir, size.length() * 2);
    const fwd = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd);
    for (let i = -6; i <= 6; i++) {
      for (let j = -6; j <= 6; j++) {
        const target = c.clone().addScaledVector(right, (i / 6) * span).addScaledVector(up, (j / 6) * span);
        rc.set(eye, target.sub(eye).normalize());
        const h = rc.intersectObjects(meshes, false)[0];
        if (!h?.face) continue;
        hits++;
        if (n.copy(h.face.normal).transformDirection(h.object.matrixWorld).dot(rc.ray.direction) > 0) back++;
      }
    }
  }
  for (const [m, mat] of sided) m.material = mat;
  return hits ? back / hits : 0;
}

function triangles(o: THREE.Object3D): number {
  let n = 0;
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry;
    n += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return Math.round(n);
}

const present = BUILDINGS.filter((b) => existsSync(join(pub, modelPath(b))));
const missing = BUILDINGS.filter((b) => !present.includes(b));
const extras = Object.entries(EXTRAS).filter(([, e]) => existsSync(join(pub, e.path)));
const loaded = new Map<string, GLTF>();

beforeAll(async () => {
  await MeshoptDecoder.ready;
  for (const b of present) loaded.set(b, await load(join(pub, modelPath(b))));
  for (const [k, e] of extras) loaded.set(k, await load(join(pub, e.path)));
  const tri = (k: string) => triangles(loaded.get(k)!.scene);
  const meshes = (k: string) => {
    let n = 0;
    loaded.get(k)!.scene.traverse((o) => void ((o as THREE.Mesh).isMesh && n++));
    return n;
  };
  const rows = [...present, ...extras.map(([k]) => k)].map((k) => `${k} ${tri(k)} (${meshes(k)} meshes)`);
  if (rows.length) console.log(`models, triangles (meshes in the file): ${rows.join(', ')}`);
  if (present.length) console.log(`buildings, draw calls in the game (merged, glow hidden): ${present.map((b) => `${b} ${gameCalls(b)}`).join(', ')}`);
  if (missing.length) console.warn(`models: not there yet → all six stay grey: ${missing.join(', ')}`);
});

describe('public/models: size and format', () => {
  const all = (function walk(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
  })(join(pub, 'models')).filter((f) => f.endsWith('.glb'));

  it('each GLB ≤ 1 MB and all together < 5 MB', () => {
    let total = 0;
    for (const f of all) {
      const size = statSync(f).size;
      total += size;
      expect(size, f).toBeLessThanOrEqual(MB);
    }
    expect(total).toBeLessThan(5 * MB);
  });

  it('no Draco anywhere; meshopt-compressed (npm run glb)', () => {
    for (const f of all) {
      const json = glbJson(readFileSync(f));
      const used = [...(json.extensionsUsed ?? []), ...(json.extensionsRequired ?? [])];
      expect(used, f).not.toContain('KHR_draco_mesh_compression');
      expect(used, f).toContain('EXT_meshopt_compression');
    }
  });
});

describe('public/models/nasa-base: the six buildings', () => {
  it('all six building files are shipped (a missing one would turn the whole base grey)', () => {
    expect(missing).toEqual([]);
  });

  it.each(present.length ? present : ['(none yet)'])('%s loads with GLTFLoader + MeshoptDecoder, named parts, budget', (b) => {
    if (!loaded.has(b)) return; // nothing there yet: the scene keeps the grey shapes
    const scene = loaded.get(b)!.scene;
    for (const n of REQUIRED_NODES[b as (typeof BUILDINGS)[number]]) expect(scene.getObjectByName(n), `${b}: node ${n}`).toBeTruthy();
    scene.updateWorldMatrix(true, true);
    for (const n of REQUIRED_NODES[b as (typeof BUILDINGS)[number]].filter((x) => PIVOTS.includes(x))) {
      const pivot = scene.getObjectByName(n)!;
      let meshes = 0;
      pivot.traverse((o) => void ((o as THREE.Mesh).isMesh && meshes++));
      expect((pivot as THREE.Mesh).isMesh, `${b}: ${n} is an empty pivot node, not a mesh`).toBeFalsy();
      expect(meshes, `${b}: ${n} carries its mesh`).toBeGreaterThan(0);
      const at = pivot.getWorldPosition(new THREE.Vector3());
      if (n.startsWith('scout_wheel_')) {
        const centre = new THREE.Box3().setFromObject(pivot, true).getCenter(new THREE.Vector3());
        expect(at.distanceTo(centre), `${b}: ${n} pivot at the axle centre`).toBeLessThan(0.02);
      }
      if (n === 'dish_head') expect(Math.hypot(at.x, at.z), `${b}: dish_head yaw axis through the base centre`).toBeLessThan(0.02);
    }
    // Faces point outwards: drawn single-sided, at most a few small inside-out fragments may show as holes.
    expect(backFaceShare(scene), `${b}: share of back faces seen from outside`).toBeLessThan(0.05);
    const tri = triangles(scene);
    expect(tri, `${b} triangles`).toBeGreaterThan(0);
    expect(tri, `${b} triangles`).toBeLessThanOrEqual(BUDGET.building);
    // Built in metres to the grey shape: base on the ground, height as in HEIGHT (fit() is then ~1), footprint kept.
    const key = b as (typeof BUILDINGS)[number];
    scene.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(scene, true);
    expect(Math.abs(box.min.y), `${b} base on the ground`).toBeLessThan(0.02);
    expect(box.max.y / HEIGHT[key], `${b} height ${box.max.y.toFixed(2)} m vs HEIGHT`).toBeGreaterThan(0.97);
    expect(box.max.y / HEIGHT[key], `${b} height ${box.max.y.toFixed(2)} m vs HEIGHT`).toBeLessThan(1.03);
    const r = FOOTPRINT[key];
    if (r) {
      const half = Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z);
      expect(half, `${b} footprint ${half.toFixed(2)} m`).toBeLessThanOrEqual(r + 0.1);
    }
  });

  it('six buildings together stay in the phone budget', () => {
    const total = present.reduce((n, b) => n + triangles(loaded.get(b)!.scene), 0);
    expect(total).toBeLessThanOrEqual(BUDGET.buildingsTotal);
    // The grey shells take 19 draw calls; the models may add a few, not double them (~50 per frame on a phone).
    expect(present.reduce((n, b) => n + gameCalls(b), 0)).toBeLessThanOrEqual(BUDGET.buildingCalls);
  });
});

describe('extra packs: LRO and the astronaut', () => {
  it.each(extras.length ? extras.map(([k]) => k) : ['(none yet)'])('%s loads, budget, skin and clips', (k) => {
    if (!loaded.has(k)) return;
    const e = EXTRAS[k];
    const gltf = loaded.get(k)!;
    for (const n of e.nodes) expect(gltf.scene.getObjectByName(n), `${k}: node ${n}`).toBeTruthy();
    expect(triangles(gltf.scene)).toBeLessThanOrEqual(BUDGET.extra);
    if (e.skinned) {
      let skinned = 0;
      gltf.scene.traverse((o) => {
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned++;
      });
      expect(skinned, `${k}: skinned meshes`).toBeGreaterThan(0);
    }
    const clips = gltf.animations.map((a) => a.name);
    for (const c of e.clips ?? []) expect(clips, `${k}: clip ${c}`).toContain(c);
  });
});
