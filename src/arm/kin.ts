/**
 * Keep the robot arm out of the ground. The arm moves in one vertical plane: r = metres along its reach from the
 * pedestal's axis, y = metres above the ground at the pedestal. Angles in degrees: lift = upper arm above level,
 * bend = forearm from the upper arm's line (+ up), wrist = turret from the forearm's line (+ up). Pure, so it is
 * tested without three.js.
 */

const RAD = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a)); // to (-pi, pi]

/** Joint ranges relative to the parent segment, degrees. */
export const JOINT = { bend: [-90, 150], wrist: [-100, 100] } as const;

export interface Pose {
  lift: number;
  bend: number;
  wrist: number;
}
export interface ArmShape {
  /** Shoulder height, upper arm, forearm, wrist -> turret's middle, wrist -> jaw tips (m). */
  H: number;
  L1: number;
  L2: number;
  T: number;
  L3: number;
  /** How far each part keeps above the ground (m). */
  clear: { elbow: number; wrist: number; turret: number; tip: number };
  /** Ground height relative to the pedestal's foot, r metres along the reach (the pedestal itself near r = 0). */
  groundAt: (r: number) => number;
}
type Check = readonly [distance: number, clear: number];

/**
 * Turns the direction `a` (radians, from level) of a segment starting at (r0, y0) so every check point on it stays
 * that far above the ground. For a point that is too low it takes, of the two directions that just clear it, the one
 * its joint can reach (relative to the parent's direction `base`, within `range` degrees) and nearer. `a` itself when
 * it already clears; straight up as the last resort.
 */
function clearDir(
  a: number,
  r0: number,
  y0: number,
  checks: readonly Check[],
  groundAt: (r: number) => number,
  base = 0,
  range: readonly [number, number] = [-180, 180],
): number {
  const fits = (d: number) => {
    const rel = wrap(d - base) / RAD;
    return rel >= range[0] - 1e-6 && rel <= range[1] + 1e-6;
  };
  const low = (d: number): [number, number] | null => {
    for (const [L, clear] of checks) {
      const min = groundAt(r0 + L * Math.cos(d)) + clear;
      if (y0 + L * Math.sin(d) < min - 1e-6) return [L, min];
    }
    return null;
  };
  for (let pass = 0; pass < 8; pass++) {
    // the ground under a point moves with the direction
    const bad = low(a);
    if (!bad) return a;
    const [L, min] = bad;
    const lo = Math.asin(clamp((min - y0) / L, -1, 1));
    const hi = wrap(Math.PI - lo);
    const near = (d: number) => Math.abs(wrap(a - d));
    const ok = [lo, hi].filter(fits);
    a = (ok.length ? ok : [lo, hi]).reduce((p, q) => (near(p) <= near(q) ? p : q));
  }
  return low(a) ? Math.PI / 2 : a;
}

/**
 * The pose the arm may show for the wanted one: each joint from the shoulder out is turned only as far as it must
 * so the elbow, the wrist, the turret's bulk and the jaw tips stay above the ground and the pedestal.
 */
export function clearPose(want: Pose, arm: ArmShape): Pose & { points: Record<'elbow' | 'wrist' | 'turret' | 'tip', [number, number]> } {
  const { H, L1, L2, L3, T, clear, groundAt } = arm;
  const a1 = clearDir(want.lift * RAD, 0, H, [[L1, clear.elbow]], groundAt);
  const er = L1 * Math.cos(a1);
  const ey = H + L1 * Math.sin(a1);
  const a2 = clearDir(a1 + want.bend * RAD, er, ey, [[L2, clear.wrist]], groundAt, a1, JOINT.bend);
  const wr = er + L2 * Math.cos(a2);
  const wy = ey + L2 * Math.sin(a2);
  const a3 = clearDir(a2 + (want.wrist || 0) * RAD, wr, wy, [[T, clear.turret], [L3, clear.tip]], groundAt, a2, JOINT.wrist);
  const at = (L: number): [number, number] => [wr + L * Math.cos(a3), wy + L * Math.sin(a3)];
  return {
    lift: a1 / RAD,
    bend: wrap(a2 - a1) / RAD,
    wrist: wrap(a3 - a2) / RAD,
    points: { elbow: [er, ey], wrist: [wr, wy], turret: at(T), tip: at(L3) },
  };
}
