// Marks on the ground (src/look/fx.js MarkRing): capped, the oldest fade out near the cap, stored compactly.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MarkRing } from './fx.js';

const m = new THREE.Matrix4();
const fill = (r: MarkRing, k: number) => {
  for (let i = 0; i < k; i++) r.push(m, i * 0.3, -i * 0.1, 0.5);
};

describe('MarkRing', () => {
  it('nothing fades until the ring is 85 % full', () => {
    const r = new MarkRing(100);
    fill(r, 85);
    r.applyFade();
    expect(Math.min(...r.fade)).toBe(1);
  });

  it('full: the oldest is invisible, fading in over 15 %, the newest stay whole', () => {
    const r = new MarkRing(100);
    fill(r, 130); // wrapped: the oldest live mark sits at r.next
    r.applyFade();
    expect(r.count).toBe(100);
    expect(r.fade[r.next]).toBe(0);
    expect(r.fade[(r.next + 7) % 100]).toBeCloseTo(7 / 15, 5);
    expect(r.fade[(r.next + 15) % 100]).toBe(1);
    expect(r.fade[(r.next + 99) % 100]).toBe(1);
  });

  it('half way into the fade zone the oldest is half faded', () => {
    const r = new MarkRing(100);
    fill(r, 92); // 85 + half of 15 (rounded)
    r.applyFade();
    expect(r.fade[0]).toBeGreaterThan(0.4);
    expect(r.fade[0]).toBeLessThan(0.6);
  });

  it('stores x, z (2 cm) and heading, oldest first, and reads them back', () => {
    const r = new MarkRing(10);
    fill(r, 13);
    const back = MarkRing.parse(r.serialize());
    expect(back).toHaveLength(10);
    expect(back[0][0]).toBeCloseTo(3 * 0.3, 1);
    expect(back[9][1]).toBeCloseTo(-12 * 0.1, 1);
    expect(back[0][2]).toBeCloseTo(0.5, 3);
    expect(MarkRing.parse('not base64!')).toEqual([]);
    expect(MarkRing.parse('')).toEqual([]);
  });
});
