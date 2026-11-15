/**
 * Day 7 liftoff effects (features.launchFx, src/scene/parts/LaunchFx.tsx): the pure part — the lift curve, the
 * engine's brightness over time, how hard the blast hits the ground, the regolith ballistics and the particle table
 * the GPU shader reads. Game seconds and metres; `t` = seconds since the lander starts to move (negative before).
 *
 * On the Moon there is no air: the plume is short and fans out wide, and the blast throws regolith radially outward
 * in flat sheets and ballistic arcs (g = 1.62 m/s², no drag) that land where they fall — no billowing smoke.
 * The look (counts, sizes, speeds) is a game look, not a measurement.
 */
import { GRAVITY } from '../character/physics.js';

export const MOON_G: number = GRAVITY.moon;

/** The engine lights this long before the lander moves (the effect's own clock; gameplay timing is unchanged). */
export const IGNITION_S = 0.4;

/** Lift-off: RISE_S seconds of speeding up to 30 m, then a steady 20 m/s climb out of view. */
export const RISE_S = 3;

/** Height of the lander (m) `t` s after it starts to move. */
export function liftHeight(t: number): number {
  return t <= 0 ? 0 : t < RISE_S ? 30 * (t / RISE_S) ** 2 : 30 + 20 * (t - RISE_S);
}

/**
 * Engine brightness (0 = off, 1 = steady thrust): a short ignition ramp before the lander moves, a start transient
 * (1.25) at the moment it lifts, settling to steady thrust (0.9) within about a second.
 */
export function plumeLevel(t: number): number {
  const tau = t + IGNITION_S;
  if (tau <= 0) return 0;
  if (tau < IGNITION_S) {
    const u = tau / IGNITION_S;
    return 1.25 * u * u * (3 - 2 * u);
  }
  return 0.9 + 0.35 * Math.exp(-(tau - IGNITION_S) / 0.6);
}

/** Lander height (m) at which the blast on the ground has fallen to half: the plume spreads ~ 1/h². */
export const BLAST_H = 5;

/** How hard the plume hits the ground with the lander `h` m up (1 on the pad, ~0.07 at 15 m). */
export function blastLevel(h: number): number {
  const k = Math.max(0, h) / BLAST_H;
  return 1 / (1 + k * k);
}

/**
 * Dev and `?shot` only: `?fxt=1.2` holds the launch 1.2 s after liftoff (negative = during ignition), so the plume and
 * the blast can be looked at frame by frame: `SHOT_PARAMS=fxt=1.2 ./shot.sh '{"phase":"launch"}'`. Null otherwise.
 */
export const FX_HOLD: number | null = (() => {
  if (typeof location === 'undefined') return null;
  const q = new URLSearchParams(location.search);
  const v = Number(q.get('fxt'));
  return (import.meta.env.DEV || q.has('shot')) && q.has('fxt') && Number.isFinite(v) ? v : null;
})();

/**
 * The blast (grains, ground glow) is over this long after the engine lights: the last arcs have landed and faded.
 * The plume stays on while the lander is in the sky.
 */
export const FX_S = 14;

/** Flicker of the plume: small (low contrast), and smaller still with `prefers-reduced-motion`. */
export function flickerAmp(reduced: boolean): number {
  return reduced ? 0.03 : 0.12;
}

export interface V3 {
  x: number;
  y: number;
  z: number;
}

/** Ballistic flight in a vacuum: p = p0 + v·t + ½·g·t² (writes `out`, no allocation). */
export function ballistic(p0: V3, v: V3, t: number, out: V3): V3 {
  out.x = p0.x + v.x * t;
  out.y = p0.y + v.y * t - 0.5 * MOON_G * t * t;
  out.z = p0.z + v.z * t;
  return out;
}

/** When a grain thrown up at `vy` m/s from `y0` m comes back to the ground (y = 0). */
export function landingTime(y0: number, vy: number): number {
  return (vy + Math.sqrt(vy * vy + 2 * MOON_G * Math.max(0, y0))) / MOON_G;
}

/** Particle kinds (the shader's `kind`). */
export const KIND = { sheet: 0, arc: 1, haze: 2, fleck: 3 } as const;

/** Grains are thrown while the engine is near the ground: from ignition to this many seconds after lift-off. */
export const EMIT_S = 2.6;

/**
 * Each kind: share of the particles, start speed (m/s), elevation (degrees), size (m), start height (m).
 * Sheets: fast and nearly flat (the regolith blast). Arcs: slower, thrown up and falling back over seconds.
 * Haze: big faint puffs low down. Flecks: a few bright shreds of thermal blanket, tumbling.
 */
export const KINDS = [
  { kind: KIND.sheet, share: 0.6, speed: [9, 24], elev: [0.5, 5], size: [0.14, 0.34], y0: [0.08, 0.45] },
  { kind: KIND.arc, share: 0.27, speed: [2.5, 8.5], elev: [14, 52], size: [0.1, 0.26], y0: [0.05, 0.3] },
  { kind: KIND.haze, share: 0.1, speed: [1.5, 5], elev: [3, 14], size: [1.2, 2.4], y0: [0.2, 0.8] },
  { kind: KIND.fleck, share: 0.03, speed: [3, 7.5], elev: [25, 60], size: [0.07, 0.13], y0: [0.4, 1.2] },
] as const;

/** Rays of the flat blast (sheet grains bunch along these directions). */
export const JETS = 40;

/** A small seeded random generator (mulberry32): the same table on every device and in the tests. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The particle table, two vec4 per particle:
 *   a = (birth t, azimuth rad, speed m/s, elevation rad)
 *   b = (size m, kind, start height m, random 0…1)
 * Births are spread from ignition to EMIT_S, most of them early (the blast is hardest on the pad).
 */
export function makeBlast(n: number, seed = 7): { a: Float32Array; b: Float32Array } {
  const r = rng(seed);
  // the sheets leave in rays, as in landing films: grains bunch along JETS directions round the pad
  const jets = Array.from({ length: JETS }, (_, i) => ((i + 0.5 * r()) / JETS) * Math.PI * 2);
  const a = new Float32Array(n * 4);
  const b = new Float32Array(n * 4);
  const lerp = (range: readonly [number, number], u: number) => range[0] + (range[1] - range[0]) * u;
  for (let i = 0; i < n; i++) {
    let pick = r();
    let k: (typeof KINDS)[number] = KINDS[KINDS.length - 1];
    for (const kk of KINDS) {
      if (pick < kk.share) {
        k = kk;
        break;
      }
      pick -= kk.share;
    }
    a[i * 4] = -IGNITION_S + (EMIT_S + IGNITION_S) * r() ** 1.7;
    const az = k.kind === KIND.sheet ? jets[Math.floor(r() * JETS)] + (r() - 0.5) * 0.07 : r() * Math.PI * 2;
    a[i * 4 + 1] = (az + Math.PI * 2) % (Math.PI * 2);
    a[i * 4 + 2] = lerp(k.speed, r());
    a[i * 4 + 3] = (lerp(k.elev, r() ** 1.5) * Math.PI) / 180;
    b[i * 4] = lerp(k.size, r());
    b[i * 4 + 1] = k.kind;
    b[i * 4 + 2] = lerp(k.y0, r());
    b[i * 4 + 3] = r();
  }
  return { a, b };
}

/** Particle count by device: computers get the full blast, phones less (fill rate), the weakest tier less again. */
export function blastCount(tier: 'pc' | 'pcLow' | 'phone' | 'phoneLow' | 'min'): number {
  return tier === 'pc' || tier === 'pcLow' ? 8000 : tier === 'phone' ? 3500 : 1600;
}

/** GLSL twins of liftHeight and blastLevel (the particle shader computes each grain's start from its birth time). */
export const GLSL_LIFT = /* glsl */ `
float liftHeight(float t) {
  float u = max(t, 0.0) / ${RISE_S.toFixed(1)};
  return t < ${RISE_S.toFixed(1)} ? 30.0 * u * u : 30.0 + 20.0 * (t - ${RISE_S.toFixed(1)});
}
float blastLevel(float h) {
  float k = max(0.0, h) / ${BLAST_H.toFixed(1)};
  return 1.0 / (1.0 + k * k);
}
`;
