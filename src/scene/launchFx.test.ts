import { describe, expect, it } from 'vitest';
import {
  BLAST_H,
  EMIT_S,
  FX_S,
  IGNITION_S,
  KIND,
  MOON_G,
  RISE_S,
  ballistic,
  blastCount,
  blastLevel,
  flickerAmp,
  landingTime,
  liftHeight,
  makeBlast,
  plumeLevel,
} from './launchFx';

describe('Day 7 liftoff effects (features.launchFx)', () => {
  it('the lift curve is the old one: still on the pad before t = 0, 30 m at the end of the rise, then 20 m/s', () => {
    expect(liftHeight(-1)).toBe(0);
    expect(liftHeight(0)).toBe(0);
    expect(liftHeight(RISE_S / 2)).toBeCloseTo(7.5, 6);
    expect(liftHeight(RISE_S)).toBeCloseTo(30, 6);
    expect(liftHeight(RISE_S + 1)).toBeCloseTo(50, 6);
    // continuous across the end of the rise
    expect(Math.abs(liftHeight(RISE_S - 1e-6) - liftHeight(RISE_S + 1e-6))).toBeLessThan(1e-3);
  });

  it('the engine lights IGNITION_S before the lander moves, peaks as it lifts, then settles without a jump', () => {
    expect(plumeLevel(-IGNITION_S - 0.01)).toBe(0);
    expect(plumeLevel(-IGNITION_S / 2)).toBeGreaterThan(0);
    expect(plumeLevel(-IGNITION_S / 2)).toBeLessThan(plumeLevel(0));
    expect(plumeLevel(0)).toBeCloseTo(1.25, 6);
    expect(Math.abs(plumeLevel(-1e-6) - plumeLevel(1e-6))).toBeLessThan(1e-3);
    expect(plumeLevel(3)).toBeGreaterThan(0.85);
    expect(plumeLevel(3)).toBeLessThan(1);
    // never a flash: one smooth rise over ≥ 0.3 s, then it only eases down (no second peak)
    expect(IGNITION_S).toBeGreaterThanOrEqual(0.3);
    for (let t = -IGNITION_S; t + 1 / 60 <= 0; t += 1 / 60) expect(plumeLevel(t + 1 / 60)).toBeGreaterThanOrEqual(plumeLevel(t) - 1e-9);
    for (let t = 0; t < 8; t += 1 / 60) expect(plumeLevel(t + 1 / 60)).toBeLessThanOrEqual(plumeLevel(t) + 1e-9);
  });

  it('the blast on the ground is full on the pad and fades as the lander climbs (weak by 15 m)', () => {
    expect(blastLevel(0)).toBe(1);
    expect(blastLevel(BLAST_H)).toBeCloseTo(0.5, 6);
    expect(blastLevel(15)).toBeLessThanOrEqual(0.1 + 1e-9);
    for (let h = 0; h < 40; h += 0.5) expect(blastLevel(h + 0.5)).toBeLessThan(blastLevel(h));
  });

  it('grains fly ballistically at Moon gravity and come back to the ground at the landing time', () => {
    const out = { x: 0, y: 0, z: 0 };
    const p0 = { x: 1, y: 0.3, z: -2 };
    const v = { x: 4, y: 3, z: 0 };
    const tl = landingTime(p0.y, v.y);
    expect(ballistic(p0, v, tl, out).y).toBeCloseTo(0, 6);
    expect(out.x).toBeCloseTo(1 + 4 * tl, 6);
    expect(out.z).toBe(-2);
    // apex = y0 + vy² / 2g
    expect(ballistic(p0, v, v.y / MOON_G, out).y).toBeCloseTo(0.3 + (3 * 3) / (2 * MOON_G), 6);
    expect(MOON_G).toBe(1.62);
  });

  it('the particle table: births from ignition to EMIT_S (most early), sane speeds, and no grain thrown absurdly high', () => {
    const n = 4000;
    const { a, b } = makeBlast(n);
    expect(a.length).toBe(n * 4);
    let early = 0;
    const kinds = new Set<number>();
    for (let i = 0; i < n; i++) {
      const [tb, az, speed, elev] = [a[i * 4], a[i * 4 + 1], a[i * 4 + 2], a[i * 4 + 3]];
      const [size, kind, y0] = [b[i * 4], b[i * 4 + 1], b[i * 4 + 2]];
      expect(tb).toBeGreaterThanOrEqual(-IGNITION_S - 1e-6);
      expect(tb).toBeLessThanOrEqual(EMIT_S + 1e-6);
      if (tb < 1) early++;
      expect(az).toBeGreaterThanOrEqual(0);
      expect(az).toBeLessThan(Math.PI * 2);
      expect(speed).toBeGreaterThan(0);
      expect(size).toBeGreaterThan(0);
      kinds.add(kind);
      const vy = speed * Math.sin(elev);
      expect(y0 + (vy * vy) / (2 * MOON_G)).toBeLessThan(20); // apex
      if (kind === KIND.sheet) expect(elev).toBeLessThan((6 * Math.PI) / 180); // the sheets stay flat
      // every grain has landed and faded (≤ 3 s on the ground) before the blast is switched off
      expect(tb + landingTime(y0, vy) + 3).toBeLessThan(FX_S - IGNITION_S);
    }
    expect(early / n).toBeGreaterThan(0.5);
    expect([...kinds].sort()).toEqual([0, 1, 2, 3]);
    // deterministic: the same table on every device
    expect(makeBlast(10).a).toEqual(makeBlast(10).a);
  });

  it('phones get fewer grains, and reduced motion a calmer shimmer', () => {
    expect(blastCount('phone')).toBeLessThan(blastCount('pc'));
    expect(blastCount('min')).toBeLessThan(blastCount('phone'));
    expect(flickerAmp(true)).toBeLessThan(flickerAmp(false));
    expect(flickerAmp(false)).toBeLessThanOrEqual(0.15); // low contrast: never a strobe
  });
});
