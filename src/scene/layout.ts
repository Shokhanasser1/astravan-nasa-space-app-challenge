/**
 * Base layout in metres (docs/layout.md, developer guide §03). Y is up. Scene-only constants: positions and sizes
 * of the buildings, never game numbers.
 *
 * 15 Nov ~05:00 (Shoxjahon aka: "the base models are small"): ASTRA's buildings now stand at about their real size
 * next to the 1.85 m astronaut (src/scene/AstraBase.tsx ASTRA_SCALE), so the base is spread ~1.5× from the
 * developer guide's plan, same arrangement around the habitat, with ≥ 2 m of walkway between hitboxes
 * (src/walk/world.ts, its tests).
 */
export type XZ = readonly [number, number];

export const LAYOUT = {
  habitat: [0.2, 0.8],
  garden: [-9.0, -3.2],
  workshop: [8.9, 5.9],
  lander: [7.6, -12.4],
  wing: [-11.5, -12.0],
  hub: [-5.5, 6.5],
  scout: [-5.2, 15.5],
  dish: [15.7, -4.2],
} as const satisfies Record<string, XZ>;

/** Battery bank (ASTRA model, src/scene/AstraProps.tsx) in the power yard by the solar arrays: out of the walk between the
 * hub and the habitat (walk tests) and out of the way of the camera behind the astronaut at the hub. r = its hitbox. */
export const BATTERY_BANK = [-15.5, -5.5] as const;
export const BATTERY_R = 1.7;

/** The crew rover (NASA SEV, decor, src/scene/Decor.tsx) parked on the flat pad, nose to the base; r = its hitbox. */
export const PARKED_ROVER = { x: 14.5, z: 12.0, yaw: -2.3, r: 2.4 } as const;

/**
 * Footprint radius of each tappable building (cable ends, target rings, hitboxes), from the ASTRA models at
 * ASTRA_SCALE: habitat shell 5.23 m × 0.6; greenhouse 4.9 × 3.3 m deck × 0.9; lab 3.6 × 2.4 m skid × 0.85 (+ its
 * side racks); lander descent stage (its thin legs reach ~4 m and can be walked between); scout rover.
 */
export const RADIUS = { habitat: 3.2, garden: 2.6, workshop: 2.2, scout: 1.2, lander: 1.9, hub: 0.6 } as const;

/** ASTRA's hexagonal pad under each outer building: width in metres (src/scene/AstraBase.tsx AstraPads). */
export const PAD = { garden: 5.6, workshop: 4.8, lander: 8.6, scout: 3.8 } as const;

/** The habitat door and the open side of the interior face the power hub (south-west). */
export const DOOR_AZ = Math.atan2(LAYOUT.hub[0] - LAYOUT.habitat[0], LAYOUT.hub[1] - LAYOUT.habitat[1]);

/** Distance of the habitat's door (its outer face) from the habitat centre: where the door marker belongs. */
export const DOOR_R = RADIUS.habitat + 0.05;

/** Point at distance r from the habitat centre in the door direction. */
export function fromDoor(r: number): [number, number] {
  return [LAYOUT.habitat[0] + Math.sin(DOOR_AZ) * r, LAYOUT.habitat[1] + Math.cos(DOOR_AZ) * r];
}

/** Point at distance r from (x, z), towards the middle of the base (the habitat). */
export function towardBase(at: XZ, r: number): [number, number] {
  const dx = LAYOUT.habitat[0] - at[0];
  const dz = LAYOUT.habitat[1] - at[1];
  const d = Math.hypot(dx, dz) || 1;
  return [at[0] + (dx / d) * r, at[1] + (dz / d) * r];
}
