// The Sun's shadow camera covers ~±35 m: near the base it stays on the base, far out it follows the astronaut in
// steps (the astronaut at the crash site cast no shadow, 15 Nov).
import { describe, expect, it } from 'vitest';
import { shadowCentre } from './Light';
import { CRASH } from './crash';

describe('shadowCentre', () => {
  it('stays on the base centre near the base', () => {
    expect(shadowCentre(0, 0)).toEqual([0, 0]);
    expect(shadowCentre(12, -15)).toEqual([0, 0]);
  });
  it('follows the astronaut far out (the crash site), in 6 m steps', () => {
    const [cx, cz] = shadowCentre(CRASH[0], CRASH[1]);
    expect(Math.hypot(cx - CRASH[0], cz - CRASH[1])).toBeLessThanOrEqual(3 * Math.SQRT2);
    expect(shadowCentre(CRASH[0] + 0.5, CRASH[1] + 0.5)).toEqual([cx, cz]); // a small step: no redraw
    expect(Math.abs(cx % 6) + Math.abs(cz % 6)).toBe(0);
  });
});
