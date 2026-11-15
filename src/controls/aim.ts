import type { AimId } from './bus';

/**
 * Which building (or the power hub) the astronaut is facing, so E (or the ✋ button, or a tap on it) knows where the
 * battery goes or comes from. Pure: the rig calls it with the astronaut's place and heading. Only the heading counts
 * (looking up or down still aims at the thing in front), and a target counts while it is inside a cone a little
 * wider than itself — and only when the astronaut stands next to it (15 Nov: no acting from across the base).
 */
export interface AimTarget {
  k: AimId;
  x: number;
  z: number;
  /** Footprint radius, metres. */
  r: number;
  /**
   * Optional: within this many metres of its edge it counts whichever way the astronaut faces (a proximity prompt,
   * as in most kids' games) — used for the small power hub; a building in front still wins.
   */
  near?: number;
}

/** Extra angle around a building's edge that still counts as "looking at it". */
export const AIM_SLACK = (14 * Math.PI) / 180;
/** "Next to it": at most this many metres from the building's edge (its footprint radius). */
export const AIM_REACH = 2.5;

/** Forward on the ground for a camera yaw: (−sin yaw, −cos yaw), the same as the rig and the walker. */
export function pickAim(x: number, z: number, yaw: number, targets: readonly AimTarget[], reach = AIM_REACH): AimId | null {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  let best: AimId | null = null;
  let bestScore = Infinity;
  let beside: AimId | null = null;
  let besideGap = Infinity;
  for (const t of targets) {
    const dx = t.x - x;
    const dz = t.z - z;
    const d = Math.hypot(dx, dz);
    if (d <= t.r) return t.k; // standing inside it (the habitat)
    const gap = d - t.r;
    if (t.near !== undefined && gap <= t.near && gap < besideGap) {
      beside = t.k;
      besideGap = gap;
    }
    if (gap > reach) continue;
    const cos = Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d));
    const off = Math.acos(cos);
    const allowed = Math.atan(t.r / d) + AIM_SLACK;
    if (off > allowed) continue;
    // Nearest to the centre of the view wins; between equal angles the nearer edge.
    const score = off / allowed + gap / (reach * 10);
    if (score < bestScore) {
      bestScore = score;
      best = t.k;
    }
  }
  return best ?? beside;
}
