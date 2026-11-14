// The real Moon ground (src/look/terrain.js): the base stands on its pad, the data file matches the builder,
// and every surface faces up (a winding mistake once hid the whole 60 km skyline).
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Heights, NEAR_R, PAD, PLAY, buildCollider, buildFar, buildNear, sunVisibility } from './terrain.js';

const site = JSON.parse(readFileSync(new URL('../../public/data/terrain/site.json', import.meta.url), 'utf8'));
const sun = new THREE.Vector3(Math.cos(2.06), Math.tan((10.5 * Math.PI) / 180), Math.sin(2.06)).normalize();

/** Where the demo puts things on the ground (src/oy/demo.js SCENERY, src/oy/world.js fallback level). */
const ON_PAD: [string, number, number, number][] = [
  ['HDU habitat', 0, -14, 3.5],
  ['SEV rover', 9, -2, 3],
  ['RASSOR', -5, -1, 1.5],
  ['bags', 3, 2, 1],
  ['bags 2', -2.9, 1.2, 0.6],
  ['spawn', 0, 4, 0.5],
];

describe('real Moon ground', () => {
  for (const data of [site, null]) {
    const H = new Heights(data);
    it(`everything the demo places stands at y = 0 on the graded pad (${data ? 'LOLA' : 'no data file'})`, () => {
      for (const [, x, z, r] of ON_PAD)
        for (let a = 0; a < 8; a++) {
          const px = x + r * Math.cos((a * Math.PI) / 4), pz = z + r * Math.sin((a * Math.PI) / 4);
          expect(Math.abs(H.height(px, pz))).toBeLessThan(1e-9);
        }
    });
  }

  it('the data file is the LOLA site, zero at the base, with plausible relief', () => {
    expect(site.source.near).toContain('pgda.gsfc.nasa.gov');
    const H = new Heights(site);
    expect(Math.abs(H.dem(0, 0))).toBeLessThan(0.5);
    let lo = Infinity, hi = -Infinity;
    for (let x = -NEAR_R; x <= NEAR_R; x += 10)
      for (let z = -NEAR_R; z <= NEAR_R; z += 10) {
        const h = H.height(x, z);
        expect(Number.isFinite(h)).toBe(true);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
    expect(hi - lo).toBeGreaterThan(2); // a real ridge, not a plane
    expect(hi - lo).toBeLessThan(40);
  });

  it('near ground, collider and far rings all face up', () => {
    const H = new Heights(site);
    const near = buildNear(H, { step: 6, radius: NEAR_R, sun });
    const far = buildFar(H, { azStep: 4, sun });
    for (const g of [near, far]) {
      const n = new THREE.Vector3();
      const idx = g.index!.array;
      const p = g.attributes.position;
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      let up = 0;
      for (let i = 0; i < idx.length; i += 3) {
        a.fromBufferAttribute(p, idx[i]);
        b.fromBufferAttribute(p, idx[i + 1]);
        c.fromBufferAttribute(p, idx[i + 2]);
        n.subVectors(b, a).cross(c.clone().sub(a));
        if (n.y > 0) up++;
      }
      expect(up / (idx.length / 3)).toBeGreaterThan(0.999);
    }
  });

  it('the walking surface covers the demo walking area', () => {
    const H = new Heights(site);
    const g = buildCollider(H, { step: 4, half: PLAY });
    g.computeBoundingBox();
    expect(g.boundingBox!.min.x).toBeCloseTo(-PLAY, 5);
    expect(g.boundingBox!.max.z).toBeCloseTo(PLAY, 5);
  });

  it('sunlight: open flat ground is lit, a point behind a high wall is not', () => {
    const flat = { height: () => 0, dem: () => 0 };
    expect(sunVisibility(flat, 0, 0, 0, sun, 500, true)).toBe(1);
    const behind = (x: number, z: number) => (x * sun.x + z * sun.z > 20 ? 50 : 0);
    const wall = { height: behind, dem: behind };
    expect(sunVisibility(wall, 0, 0, 0, sun, 500, true)).toBe(0);
  });

  it('the pad is where the demo base is', () => {
    expect(PAD.x).toBe(1);
    expect(new Heights(null).padWeight(0, -14)).toBe(1);
  });
});
