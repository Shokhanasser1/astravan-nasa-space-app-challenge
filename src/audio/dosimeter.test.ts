import { describe, expect, it } from 'vitest';
import { clickRate, nextGap } from './dosimeter';

describe('dosimeter click rate (concept 3.0 recipe)', () => {
  it('matches the documented points', () => {
    expect(clickRate(1)).toBeCloseTo(0.5, 2);
    expect(clickRate(42)).toBeCloseTo(4.7, 1);
    // the concept rounds 31.5 down to "31/s"
    expect(clickRate(1000)).toBeGreaterThan(31);
    expect(clickRate(1000)).toBeLessThan(32);
  });

  it('is capped at 40 clicks per second', () => {
    expect(clickRate(1e6)).toBe(40);
  });

  it('has a mean gap of 1/rate', () => {
    let sum = 0;
    const n = 20000;
    for (let i = 1; i <= n; i++) sum += nextGap(4, i / (n + 1));
    expect(sum / n).toBeCloseTo(0.25, 1);
  });
});
