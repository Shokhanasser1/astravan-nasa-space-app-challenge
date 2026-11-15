import { describe, expect, it } from 'vitest';
import { LOWER, MAX_CANVAS_PX, TIERS, canvasDpr, type Tier } from './quality';

const px = (w: number, h: number, dpr: number) => Math.round(w * dpr) * Math.round(h * dpr);

describe('canvasDpr: the 3D canvas draws at most ~Full HD', () => {
  it('a 2560×1600 laptop at 150 % (Acer Predator, 15 Nov) drops from 3.6 to ≤ 2.1 Mpx', () => {
    const dpr = canvasDpr([1, 1.5], 1.5, 1707, 950);
    expect(dpr).toBeLessThan(1.5);
    expect(px(1707, 950, dpr)).toBeLessThanOrEqual(MAX_CANVAS_PX);
    expect(px(1707, 950, dpr)).toBeGreaterThan(0.9 * MAX_CANVAS_PX); // as sharp as the budget allows
  });

  it('a Full HD laptop at 125 % keeps its DPR (already under the budget)', () => {
    expect(canvasDpr([1, 1.5], 1.25, 1536, 730)).toBe(1.25);
  });

  it('a phone keeps the tier range', () => {
    expect(canvasDpr([1, 1.5], 3, 390, 844)).toBe(1.5);
    expect(canvasDpr([1, 1], 3, 390, 844)).toBe(1);
  });

  it('a 4K screen at 100 % goes below DPR 1, never below 0.5', () => {
    const dpr = canvasDpr([1, 1.5], 1, 3840, 2160);
    expect(dpr).toBe(0.5);
  });
});

describe('tiers', () => {
  it('a lower tier never has more anti-aliasing samples than the tier it steps down from', () => {
    for (const t of Object.keys(TIERS) as Tier[]) {
      expect(TIERS[LOWER[t]].msaa, `${t} → ${LOWER[t]}`).toBeLessThanOrEqual(TIERS[t].msaa);
    }
  });
});
