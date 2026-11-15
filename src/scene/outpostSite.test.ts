import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MODULES, OUTPOST, TUNNELS, outpostSolids, toWorld, type ModuleName } from './outpostSite';
import { groundHeight } from './ground';
import { EDGE, OUTSIDE } from '../walk/world';
import { STEP_FOOT, rockSolids } from '../walk/rocks';
import type { Solid } from '../walk/collide';

/** Closest distance between two hitboxes' cores (disc or capsule), minus both radii: < 0 means they overlap. */
function gap(a: Solid, b: Solid): number {
  const seg = (s: Solid): [number, number, number, number] => [s.x, s.z, s.bx ?? s.x, s.bz ?? s.z];
  const [ax, az, abx, abz] = seg(a);
  const [bx, bz, bbx, bbz] = seg(b);
  let best = Infinity;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const px = ax + (abx - ax) * t, pz = az + (abz - az) * t;
    for (let j = 0; j <= 20; j++) {
      const u = j / 20;
      best = Math.min(best, Math.hypot(px - (bx + (bbx - bx) * u), pz - (bz + (bbz - bz) * u)));
    }
  }
  return best - a.r - b.r;
}

describe('HDU outpost', () => {
  const mine = outpostSolids();

  it('stands inside the playable ground, with room to walk round it', () => {
    for (const s of mine) {
      for (const [x, z] of [[s.x, s.z], [s.bx ?? s.x, s.bz ?? s.z]]) expect(Math.hypot(x, z) + s.r).toBeLessThan(EDGE - 5);
    }
  });

  it('is clear of everything else at the base (2 m of walkway at least)', () => {
    const others = OUTSIDE.solids.filter((s) => !(s.name ?? '').startsWith('outpost') && s.name !== 'rock');
    for (const s of mine) for (const o of others) expect(gap(s, o), `${s.name} vs ${o.name}`).toBeGreaterThan(2);
  });

  it('puts each module on nearly level ground (its own height; under 0.35 m of slope across it)', () => {
    for (const name of Object.keys(MODULES) as ModuleName[]) {
      const hs: number[] = [];
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const [x, z] = toWorld(Math.cos(a) * 3.3, MODULES[name] + Math.sin(a) * 3.3);
        hs.push(groundHeight(x, z));
      }
      expect(Math.max(...hs) - Math.min(...hs), name).toBeLessThan(0.35);
    }
  });

  it('has no tall rock inside a module or a tunnel', () => {
    const rocks = rockSolids(STEP_FOOT, EDGE);
    for (const s of mine) for (const r of rocks) expect(gap(s, r), `${s.name} vs rock at ${r.x}, ${r.z}`).toBeGreaterThan(-0.5);
  });

  it('has one GLB node per module part and tunnel (each is set on its own ground)', () => {
    const b = readFileSync('public/models/nasa-outpost/outpost.glb');
    const json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString('utf8'));
    const names: string[] = json.scenes[json.scene ?? 0].nodes.map((i: number) => json.nodes[i].name);
    for (const m of Object.keys(MODULES)) expect(names.filter((n) => n.startsWith(m)).length, m).toBeGreaterThanOrEqual(2);
    for (const t of Object.keys(TUNNELS)) expect(names).toContain(t);
  });

  it('is 50 m out, north of the base', () => {
    expect(Math.hypot(OUTPOST.x, OUTPOST.z)).toBeCloseTo(50, 0);
    expect(mine.filter((s) => s.name === 'outpost tunnel')).toHaveLength(2);
  });
});
