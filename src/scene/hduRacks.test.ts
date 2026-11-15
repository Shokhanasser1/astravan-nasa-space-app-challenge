// D8 (15 Nov): in the HDU complex (`?hdu`) every module's battery rack (and its cable end and beacon) stands at one
// fixed spot in the MODULE frame (hduParts.ts RACK_AT). Checked against the walk solids (makeOutside(true)) and the
// real exterior model's triangles, and the astronaut can stand next to it and aim at its machine.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { HDU_COMPLEX, HDU_MODULE_X, HDU_PLAN, moduleToGame, type HduModule } from './layout';
import { RACK, RACK_AT, RACK_MODULE, rackSpot } from './hduParts';
import { makeOutside } from '../walk/world';
import { BODY, clearance, fits } from '../walk/collide';
import { pickAim, type AimTarget } from '../controls/aim';
import type { Machine } from '../state/game';

const EXTERIOR = 'public/models/nasa-outpost/hdu_complex.glb';
const RACKS = Object.entries(RACK_MODULE) as [Machine, HduModule][];
/** The widest rack (3 slots), module frame: half-width along x, half-depth along z. */
const HW = (3 * RACK.pitch + 0.12) / 2;
const HD = RACK.d / 2;
/** Distance (m) from a point (module frame) to the rack's footprint. */
const toRack = (mx: number, mz: number) =>
  Math.hypot(Math.max(0, Math.abs(mx - RACK_AT.x) - HW), Math.max(0, Math.abs(mz - RACK_AT.z) - HD));
/** Points round the rack's footprint (module frame), every 5 cm. */
function rim(): [number, number][] {
  const out: [number, number][] = [];
  for (let t = -HW; t <= HW + 1e-9; t += 0.05) out.push([RACK_AT.x + t, RACK_AT.z - HD], [RACK_AT.x + t, RACK_AT.z + HD]);
  for (let t = -HD; t <= HD + 1e-9; t += 0.05) out.push([RACK_AT.x - HW, RACK_AT.z + t], [RACK_AT.x + HW, RACK_AT.z + t]);
  return out;
}

/** The game's aim targets (src/scene/Rig.tsx AIM) on the HDU plan. */
const L = HDU_PLAN.LAYOUT, R = HDU_PLAN.RADIUS;
const AIM: AimTarget[] = [
  { k: 'hub', x: L.hub[0], z: L.hub[1], r: R.hub, near: 1.6 },
  { k: 'ls', x: L.habitat[0], z: L.habitat[1], r: R.habitat },
  { k: 'gh', x: L.garden[0], z: L.garden[1], r: R.garden },
  { k: 'ws', x: L.workshop[0], z: L.workshop[1], r: R.workshop },
  { k: 'sc', x: L.scout[0], z: L.scout[1], r: R.scout },
  { k: 'launch', x: L.lander[0], z: L.lander[1], r: R.lander },
];

let scene: THREE.Group;
beforeAll(async () => {
  await MeshoptDecoder.ready;
  const buf = readFileSync(EXTERIOR);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(() => ({ name: 'EXT_texture_webp', loadTexture: () => Promise.resolve(null) }) as never);
  const gltf = await loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '');
  scene = gltf.scene;
  scene.updateMatrixWorld(true);
});

describe('HDU battery racks (D8)', () => {
  it('stand at the fixed module spot, facing out of the door side', () => {
    for (const [k, mod] of RACKS) {
      const s = rackSpot(HDU_PLAN, k);
      const [x, z] = moduleToGame(mod, RACK_AT.x, RACK_AT.z);
      expect(s.x).toBeCloseTo(x, 9);
      expect(s.z).toBeCloseTo(z, 9);
      expect(s.yaw).toBeCloseTo(HDU_COMPLEX.turn, 9);
    }
  });

  it('are ≥ 0.3 m clear of every walk solid', () => {
    const { solids } = makeOutside(true);
    for (const [k, mod] of RACKS)
      for (const [mx, mz] of rim()) {
        const [x, z] = moduleToGame(mod, mx, mz);
        for (const s of solids) expect(clearance(s, x, z, 0), `${k} rack vs ${s.name}`).toBeGreaterThanOrEqual(0.3);
      }
  });

  it('are ≥ 0.3 m clear of the drawn exterior between 0.1 and 1 m up', () => {
    const p = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const hits: string[] = [];
    let sampled = 0;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute('position');
      const idx = m.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let t = 0; t < n; t += 3) {
        a.fromBufferAttribute(pos, idx ? idx.getX(t) : t).applyMatrix4(m.matrixWorld);
        b.fromBufferAttribute(pos, idx ? idx.getX(t + 1) : t + 1).applyMatrix4(m.matrixWorld);
        c.fromBufferAttribute(pos, idx ? idx.getX(t + 2) : t + 2).applyMatrix4(m.matrixWorld);
        if (Math.max(a.y, b.y, c.y) < 0.1 || Math.min(a.y, b.y, c.y) > 1) continue;
        const N = Math.min(120, Math.ceil(Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) / 0.04)); // every 4 cm
        for (let i = 0; i <= N; i++)
          for (let j = 0; i + j <= N; j++) {
            p.copy(a).multiplyScalar(1 - (i + j) / N).addScaledVector(b, i / N).addScaledVector(c, j / N);
            if (p.y < 0.1 || p.y > 1) continue;
            sampled++;
            for (const [k, mod] of RACKS) {
              const d = toRack(p.x - HDU_MODULE_X[mod], p.z);
              if (d < 0.3) hits.push(`${k}: ${m.name} at ${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)} (${d.toFixed(2)} m)`);
            }
          }
      }
    });
    expect(hits.slice(0, 5)).toEqual([]);
    expect(sampled).toBeGreaterThan(10000);
  }, 30000);

  it.each(RACKS)('%s: a standable spot within 0.9 m, from which E aims at that machine', (k, mod) => {
    const area = makeOutside(true);
    let found: string | null = null;
    for (let dz = 0.4; dz <= 1.0 && !found; dz += 0.05)
      for (let dx = -0.6; dx <= 0.6 && !found; dx += 0.05) {
        const mx = RACK_AT.x + dx, mz = RACK_AT.z + dz;
        const d = toRack(mx, mz);
        if (d < BODY || d > 0.9) continue;
        const [x, z] = moduleToGame(mod, mx, mz);
        if (!fits(x, z, area)) continue;
        const [rx, rz] = moduleToGame(mod, RACK_AT.x, RACK_AT.z);
        const yaw = Math.atan2(-(rx - x), -(rz - z)); // forward = (−sin yaw, −cos yaw): facing the rack
        if (pickAim(x, z, yaw, AIM) === k) found = `${mx.toFixed(2)} ${mz.toFixed(2)}`;
      }
    expect(found, `${k}: no spot`).not.toBeNull();
  });
});
