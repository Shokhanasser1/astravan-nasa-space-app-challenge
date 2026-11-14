/**
 * Ground height by formula (developer guide §04): flat for 11 m around the base, craters beyond, a hill with a view
 * over the base (standing point 5), a ridge on the horizon at 130–240 m away from the Sun's side.
 * Pure function: the rig uses it to put the eye 1.7 m above the ground.
 */
const FLAT_R = 11;

const CRATERS = [
  { x: 42, z: -34, r: 14, d: 2.4 },
  { x: -48, z: 38, r: 18, d: 2.8 },
  { x: 72, z: 58, r: 10, d: 1.6 },
  { x: -34, z: -84, r: 26, d: 5 }, // the dark crater of the Ice card
  { x: 112, z: -16, r: 18, d: 3 },
  { x: -116, z: -58, r: 30, d: 4.5 },
  { x: 26, z: 96, r: 12, d: 2 },
  { x: -84, z: 112, r: 16, d: 2.4 },
  { x: 150, z: 90, r: 24, d: 3.5 },
] as const;

export const ICE_CRATER = { x: -34, z: -84 } as const;
export const HILL = { x: 17, z: 21, r: 8, h: 3.2 } as const;

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function groundHeight(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const k = smooth(FLAT_R, FLAT_R + 12, r);
  if (k === 0) return 0;
  let h = 0.35 * Math.sin(x * 0.061 + 1.3) * Math.cos(z * 0.047 - 0.4) + 0.2 * Math.sin((x + z) * 0.13);
  for (const c of CRATERS) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d < 1) h -= c.d * (1 - d * d);
    h += 0.3 * c.d * Math.exp(-(((d - 1) / 0.3) ** 2));
  }
  h += HILL.h * Math.exp(-((x - HILL.x) ** 2 + (z - HILL.z) ** 2) / (HILL.r * HILL.r));
  // Ridge: east to north (azimuth 70°–250°), away from the low Sun of the first week (268°–340°).
  const az = ((Math.atan2(x, z) * 180) / Math.PI + 360) % 360;
  const side = smooth(70, 110, az) * (1 - smooth(215, 250, az));
  h += side * (22 + 6 * Math.sin(az * 0.11)) * Math.exp(-(((r - 185) / 38) ** 2));
  return h * k;
}
