// The real Moon ground (src/look/terrain.js through src/scene/ground.ts): the base stands flat, the team's hill and
// Ice crater are where the standing points expect them, and every surface faces up (a winding mistake once hid the
// whole 60 km skyline).
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GROUND, HILL, ICE_CRATER, groundHeight } from '../scene/ground';
import { LAYOUT, RADIUS } from '../scene/layout';
import { Heights, NEAR_R, buildFar, buildNear, sunVisibility } from './terrain.js';

const site = JSON.parse(readFileSync(new URL('../../public/data/terrain/site.json', import.meta.url), 'utf8'));
const sun = new THREE.Vector3(Math.sin(5.3), Math.tan((1.5 * Math.PI) / 180), Math.cos(5.3)).normalize();

function facingUp(g: THREE.BufferGeometry): number {
  const idx = g.index!.array;
  const p = g.attributes.position;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  let up = 0;
  for (let i = 0; i < idx.length; i += 3) {
    a.fromBufferAttribute(p, idx[i]);
    b.fromBufferAttribute(p, idx[i + 1]);
    c.fromBufferAttribute(p, idx[i + 2]);
    n.subVectors(b, a).cross(c.sub(a));
    if (n.y > 0) up++;
  }
  return up / (idx.length / 3);
}

describe('real Moon ground', () => {
  it('every building of the base stands at y = 0 on the flat pad (exactly)', () => {
    for (const [name, at] of Object.entries(LAYOUT)) {
      const r = (RADIUS as Record<string, number>)[name] ?? 1.5;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        expect(Math.abs(groundHeight(at[0] + r * Math.cos(a), at[1] + r * Math.sin(a)))).toBeLessThan(1e-9);
      }
    }
  });

  it("the team's hill rises and the Ice crater sinks on top of the real ground", () => {
    expect(groundHeight(HILL.x, HILL.z) - GROUND.dem(HILL.x, HILL.z)).toBeGreaterThan(2.5);
    expect(groundHeight(ICE_CRATER.x, ICE_CRATER.z) - GROUND.dem(ICE_CRATER.x, ICE_CRATER.z)).toBeLessThan(-3);
  });

  it('the data file is the LOLA site: zero at the base, a real ridge around it', () => {
    expect(site.source.near).toContain('pgda.gsfc.nasa.gov');
    const H = new Heights(site);
    expect(Math.abs(H.dem(0, 0))).toBeLessThan(0.5);
    let lo = Infinity, hi = -Infinity;
    for (let x = -NEAR_R; x <= NEAR_R; x += 10)
      for (let z = -NEAR_R; z <= NEAR_R; z += 10) {
        const h = groundHeight(x, z);
        expect(Number.isFinite(h)).toBe(true);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
    expect(hi - lo).toBeGreaterThan(2);
    expect(hi - lo).toBeLessThan(40);
  });

  it('near ground and the skyline rings face up, also when the skyline is pulled in', () => {
    expect(facingUp(buildNear(GROUND, { step: 6, radius: NEAR_R, sun }))).toBeGreaterThan(0.999);
    expect(facingUp(buildFar(GROUND, { azStep: 4, sun }))).toBeGreaterThan(0.999);
    const pulled = buildFar(GROUND, { azStep: 8, sun, compress: { from: 1500, to: 1950 } });
    pulled.computeBoundingSphere();
    expect(pulled.boundingSphere!.radius).toBeLessThan(2000);
  });

  it('sunlight: open flat ground is lit, a point behind a high wall is not', () => {
    const flat = { height: () => 0, dem: () => 0 };
    expect(sunVisibility(flat, 0, 0, 0, sun, 500, true)).toBe(1);
    const behind = (x: number, z: number) => (x * sun.x + z * sun.z > 20 ? 50 : 0);
    expect(sunVisibility({ height: behind, dem: behind }, 0, 0, 0, sun, 500, true)).toBe(0);
  });
});
