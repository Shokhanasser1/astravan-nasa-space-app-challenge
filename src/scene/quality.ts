/**
 * Quality tiers (developer guide §05). Chosen automatically; the child never sets anything.
 * When FPS drops: first DPR → 1, then Bloom off, then shadow map 1024; below 20 fps: no effects, no shadows,
 * half the storm lines. L2 extras (N8AO, soil texture) only on the "pc" tier.
 * A computer steps pc → pcLow (Retina stays at DPR 1.5 with MSAA) and only then, if FPS is still truly bad, to the
 * phone's DPR 1 tiers; a phone steps phone → phoneLow → min as before.
 */
export type Tier = 'pc' | 'pcLow' | 'phone' | 'phoneLow' | 'min';

export interface TierSpec {
  dpr: [number, number];
  msaa: number; // MSAA samples of the post-effect composer (the canvas itself has antialias off); 0 = none
  shadow: number; // 0 = shadows off
  bloom: boolean;
  vignette: boolean;
  ao: boolean; // N8AO, L2, pc only
  stormScale: number; // multiplier for storm line count
}

export const TIERS: Record<Tier, TierSpec> = {
  // (15 Nov perf audit: DPR 2 with MSAA 4 through the post stack was the biggest cost on an iGPU / Retina laptop;
  // 1.5 and 2 keep the picture sharp and smooth at about half the pixels)
  pc: { dpr: [1, 1.5], msaa: 2, shadow: 2048, bloom: true, vignette: true, ao: false, stormScale: 1 },
  // A slow computer: the phone's effects, but the picture stays sharp (DPR 1.5 on a Retina screen) and smooth (MSAA).
  pcLow: { dpr: [1, 1.5], msaa: 4, shadow: 1024, bloom: true, vignette: false, ao: false, stormScale: 1 },
  phone: { dpr: [1, 1.5], msaa: 0, shadow: 1024, bloom: true, vignette: false, ao: false, stormScale: 1 },
  phoneLow: { dpr: [1, 1], msaa: 0, shadow: 1024, bloom: false, vignette: false, ao: false, stormScale: 1 },
  min: { dpr: [1, 1], msaa: 0, shadow: 0, bloom: false, vignette: false, ao: false, stormScale: 0.5 },
};

export const LOWER: Record<Tier, Tier> = { pc: 'pcLow', pcLow: 'phoneLow', phone: 'phoneLow', phoneLow: 'min', min: 'min' };

/**
 * FPS bounds for drei's PerformanceMonitor on a computer: under 40 fps steps pc → pcLow (still sharp); leaving DPR 1.5
 * needs under 30 fps. drei's default lower bound is 60 on a 120 Hz screen (a MacBook Pro), so a laptop at a smooth
 * 55 fps was stepped down. Upper bound = drei's.
 */
export function pcFpsBounds(tier: Tier) {
  const lower = tier === 'pc' ? 40 : 30;
  return (refreshrate: number): [number, number] => [lower, refreshrate > 100 ? 100 : 60];
}

/** Phone budget: < 100k triangles, ~50 draw calls, models < 5 MB. PC: < 500k, ~100, < 20 MB. */
export function initialTier(): Tier {
  if (typeof window === 'undefined') return 'phone';
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  return coarse || Math.min(window.innerWidth, window.innerHeight) < 600 ? 'phone' : 'pc';
}

/**
 * The tier the 3D view starts at: initialTier(), except that a computer (mouse or trackpad) in a small window starts
 * at 'pcLow', not 'phone' — its screen is still a laptop screen. (Content keeps using initialTier().)
 */
export function startTier(): Tier {
  const t = initialTier();
  return t === 'phone' && typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches ? 'pcLow' : t;
}

export function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}
