/**
 * Quality tiers (developer guide §05). Chosen automatically; the child never sets anything.
 * When FPS drops: first DPR → 1, then Bloom off, then shadow map 1024; below 20 fps: no effects, no shadows,
 * half the storm lines. L2 extras (N8AO, soil texture) only on the "pc" tier.
 */
export type Tier = 'pc' | 'phone' | 'phoneLow' | 'min';

export interface TierSpec {
  dpr: [number, number];
  shadow: number; // 0 = shadows off
  bloom: boolean;
  vignette: boolean;
  ao: boolean; // N8AO, L2, pc only
  stormScale: number; // multiplier for storm line count
}

export const TIERS: Record<Tier, TierSpec> = {
  pc: { dpr: [1, 2], shadow: 2048, bloom: true, vignette: true, ao: false, stormScale: 1 },
  phone: { dpr: [1, 1.5], shadow: 1024, bloom: true, vignette: false, ao: false, stormScale: 1 },
  phoneLow: { dpr: [1, 1], shadow: 1024, bloom: false, vignette: false, ao: false, stormScale: 1 },
  min: { dpr: [1, 1], shadow: 0, bloom: false, vignette: false, ao: false, stormScale: 0.5 },
};

export const LOWER: Record<Tier, Tier> = { pc: 'phone', phone: 'phoneLow', phoneLow: 'min', min: 'min' };

/** Phone budget: < 100k triangles, ~50 draw calls, models < 5 MB. PC: < 500k, ~100, < 20 MB. */
export function initialTier(): Tier {
  if (typeof window === 'undefined') return 'phone';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  return coarse || Math.min(window.innerWidth, window.innerHeight) < 600 ? 'phone' : 'pc';
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}
