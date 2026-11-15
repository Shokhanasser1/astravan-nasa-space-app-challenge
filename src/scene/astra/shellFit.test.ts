// ASTRA's shells and our furnished interiors (src/scene/astra/shellFit.ts, src/scene/Interiors.tsx) match: nothing
// of the habitat's outside lies in its room, every real door of ours opens onto the room (ASTRA's decorative door is
// cut away under it, on the phone build and the computer build alike), and the habitat's room is drawn wherever the
// camera stands in it at ASTRA_SCALE.
import { afterAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { finalize, light, setLod } from '../../vendor/astra/scene/kit';
import type { ModuleView } from '../../vendor/astra/scene/models/common';
import { buildHabitat } from '../../vendor/astra/scene/models/habitat';
import { buildLander } from '../../vendor/astra/scene/models/site';
import { buildLab } from '../../vendor/astra/scene/models/works';
import { ASTRA_SCALE } from '../layout';
import { bake } from './bake';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { HAB_CEILING, HAB_LINING, cutHabitatDoor, cutLabHatch, cutLanderHatch, habitatInside, inHabitatRoom, tenSidedCabin } from './shellFit';

// ASTRA draws its small labels on a 2D canvas; tests run in node, so a do-nothing canvas stands in.
if (typeof document === 'undefined') {
  const ctx = new Proxy({}, { get: () => () => ({ width: 10, addColorStop: () => {}, data: new Uint8ClampedArray(4) }) });
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }),
  };
}

const view = (): ModuleView => ({ group: new THREE.Group(), status: light('#3ee39a'), glow: [], spin: [], blink: [], top: 2.5 });

/** Rays (model frame) from `from` along `dir` for `len` m: how many hit any mesh of `g` (both faces). */
function hits(g: THREE.Object3D, rays: [THREE.Vector3, THREE.Vector3][], len: number): number {
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && !Array.isArray(m)) m.side = THREE.DoubleSide;
  });
  const rc = new THREE.Raycaster();
  rc.far = len;
  let n = 0;
  for (const [from, dir] of rays) {
    rc.set(from, dir);
    if (rc.intersectObject(g, true).some((h) => h.object.visible)) n++;
  }
  return n;
}
const grid = (xs: number[], ys: number[], at: (a: number, b: number) => THREE.Vector3, dir: THREE.Vector3) =>
  xs.flatMap((a) => ys.map((b) => [at(a, b), dir] as [THREE.Vector3, THREE.Vector3]));

afterAll(() => setLod(1));

describe.each([0.5, 1])('ASTRA shells at detail %s', (lod) => {
  it('the habitat has nothing of its outside inside our lining (both decks)', () => {
    setLod(lod);
    const v = view();
    buildHabitat(v, 'moon');
    v.shieldProgress?.(1); // the whole regolith shield
    finalize(v.group);
    habitatInside(v.group); // (as AstraBase.tsx builds it)
    v.group.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    const m4 = new THREE.Matrix4();
    let inside = 0;
    v.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      const inst = o as THREE.InstancedMesh;
      const pos = m.geometry.getAttribute('position');
      for (let k = 0; k < (inst.isInstancedMesh ? inst.count : 1); k++) {
        if (inst.isInstancedMesh) inst.getMatrixAt(k, m4).premultiply(m.matrixWorld);
        else m4.copy(m.matrixWorld);
        for (let i = 0; i < pos.count; i++) {
          p.fromBufferAttribute(pos, i).applyMatrix4(m4);
          if (Math.hypot(p.x, p.z) < HAB_LINING - 0.02 && p.y > 0.52 && p.y < HAB_CEILING - 0.02) inside++;
        }
      }
    });
    expect(inside).toBe(0);
  });

  it("the habitat's outer hatch opens onto the airlock, not onto ASTRA's shell", () => {
    setLod(lod);
    const v = view();
    buildHabitat(v, 'moon');
    finalize(v.group);
    // through the 1.016 × 1.524 m hatch (sill 0.906 m), from the porch in towards the airlock
    const rays = grid([-0.4, 0, 0.4], [1.0, 1.6, 2.3], (x, y) => new THREE.Vector3(x, y, 6.6), new THREE.Vector3(0, 0, -1));
    expect(hits(v.group, rays, 3.4)).toBe(rays.length); // ASTRA's shell is solid there
    expect(cutHabitatDoor(v.group)).toBeGreaterThan(0);
    bake(v.group, { keep: [], live: [] });
    expect(hits(v.group, rays, 3.4)).toBe(0);
  });

  it("the lab's hatch opens onto the room, not onto ASTRA's hatch disc", () => {
    setLod(lod);
    const v = view();
    buildLab(v);
    finalize(v.group);
    // through the Ø 0.72 m bore on the west dome (axis y 1.363, z 0)
    const rays = grid([-0.2, 0, 0.2], [-0.2, 0, 0.2], (z, dy) => new THREE.Vector3(-2.6, 1.363 + dy, z), new THREE.Vector3(1, 0, 0));
    expect(hits(v.group, rays, 1.4)).toBe(rays.length);
    expect(cutLabHatch(v.group)).toBeGreaterThan(0);
    bake(v.group, { keep: [], live: [] });
    expect(hits(v.group, rays, 1.4)).toBe(0);
  });

  it("the lander's forward hatch opens onto the cabin, not onto ASTRA's hatch panel", () => {
    setLod(lod);
    const l = buildLander('moon');
    tenSidedCabin(l);
    finalize(l);
    // through the 0.81 × 0.90 m hatch (sill y 3.00) from the porch into the cabin
    const rays = grid([-0.3, 0, 0.3], [3.15, 3.45, 3.8], (x, y) => new THREE.Vector3(x, y, 1.6), new THREE.Vector3(0, 0, -1));
    expect(hits(l, rays, 1.0)).toBe(rays.length);
    expect(cutLanderHatch(l)).toBeGreaterThan(0);
    bake(l, { keep: [], live: [] });
    expect(hits(l, rays, 1.0)).toBe(0);
  });
});

describe("our lander cabin fits ASTRA's", () => {
  it('ASTRA builds its 10-sided cabin with 10 sides on phones too', () => {
    setLod(0.5);
    const l = buildLander('moon');
    expect(tenSidedCabin(l)).toBe(true);
    let sides = 0;
    l.traverse((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.LatheGeometry | undefined;
      if (g?.type === 'LatheGeometry' && g.parameters.points.length === 7 && g.parameters.points[3].y === 4.2) sides = g.parameters.segments;
    });
    expect(sides).toBe(10);
  });

  it("no part of our cabin pokes out through ASTRA's 10-sided wall (y 3.0–4.2)", async () => {
    await MeshoptDecoder.ready;
    const buf = readFileSync('public/models/interiors/lander.glb');
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '');
    gltf.scene.updateMatrixWorld(true);
    const apothem = 1.35 * Math.cos(Math.PI / 10);
    const seg = (2 * Math.PI) / 10;
    const p = new THREE.Vector3();
    let out = 0;
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute('position');
      for (let i = 0; i < pos.count; i++) {
        p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        // (the hatch, its porch and the walkway to ASTRA's ladder are outside on purpose: z > 1.25, x < −1.3)
        if (p.y < 3.02 || p.y > 4.18 || p.z > 1.25 || p.x < -1.3) continue;
        const a = Math.atan2(p.x, p.z) - Math.PI / 10;
        const d = (((a % seg) + seg) % seg) - seg / 2;
        if (Math.hypot(p.x, p.z) * Math.cos(d) > apothem) out++;
      }
    });
    expect(out).toBe(0);
  });
});

describe('the habitat room is drawn wherever the camera is in it', () => {
  const k = ASTRA_SCALE.habitat;
  const eye = 1.7;
  it.each([
    ['the first-person inside point', 0.3 * k, 2.1 * k, 2.45 * k, true],
    ['by the galley (model r 3.5)', -3.5 * k, (0.5 + eye) * k, 0, true],
    ['by the stowage shelves (model r 4.5)', 0, (0.5 + eye) * k, 4.5 * k, true],
    ['on the upper deck', 1.15 * k, (3.35 + eye) * k, 0.45 * k, true],
    ['outside, at the shell', 5.3 * k, eye, 0, false],
    ['over the dome', 0, 7.0 * k, 0, false],
  ])('%s', (_name, dx, dy, dz, want) => {
    expect(inHabitatRoom(dx as number, dy as number, dz as number, k)).toBe(want);
  });
});
