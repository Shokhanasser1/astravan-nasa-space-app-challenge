import type { Machine } from '../state/game';

/**
 * Which building the astronaut is facing, so E (or the ✋ button) knows where the battery goes. Pure: the rig calls
 * it with the camera's place and heading. Only the heading counts (looking up or down still aims at the building in
 * front), and a building counts while it is inside a cone a little wider than the building itself.
 */
export interface AimTarget {
  k: Machine;
  x: number;
  z: number;
  /** Footprint radius, metres. */
  r: number;
}

/** Extra angle around a building's edge that still counts as "looking at it". */
export const AIM_SLACK = (14 * Math.PI) / 180;
/** Further than this you are not "at" a building. */
export const AIM_REACH = 30;

/** Forward on the ground for a camera yaw: (−sin yaw, −cos yaw), the same as the rig and the walker. */
export function pickAim(x: number, z: number, yaw: number, targets: readonly AimTarget[], reach = AIM_REACH): Machine | null {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  let best: Machine | null = null;
  let bestScore = Infinity;
  for (const t of targets) {
    const dx = t.x - x;
    const dz = t.z - z;
    const d = Math.hypot(dx, dz);
    if (d <= t.r) return t.k; // standing inside it (the habitat)
    if (d > reach) continue;
    const cos = Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d));
    const off = Math.acos(cos);
    const allowed = Math.atan(t.r / d) + AIM_SLACK;
    if (off > allowed) continue;
    // Nearest to the centre of the view wins; between equal angles the nearer building.
    const score = off / allowed + d / (reach * 10);
    if (score < bestScore) {
      bestScore = score;
      best = t.k;
    }
  }
  return best;
}
