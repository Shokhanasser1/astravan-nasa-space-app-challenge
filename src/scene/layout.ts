/**
 * Base layout in metres (docs/layout.md, developer guide §03). Y is up. Scene-only constants: positions and sizes
 * of the grey shapes, never game numbers.
 */
export type XZ = readonly [number, number];

export const LAYOUT = {
  habitat: [0.2, 0.8],
  garden: [-5.6, -2.4],
  workshop: [6.0, 4.2],
  lander: [5.6, -8.6],
  wing: [-7.4, -7.2],
  hub: [-3.6, 4.6],
  scout: [-3.4, 10.6],
  dish: [10.5, -2.5],
} as const satisfies Record<string, XZ>;

/** Battery bank (ASTRA model, src/scene/AstraProps.tsx) beside the power hub, to the left of the hub point's view (the habitat stays in sight). */
export const BATTERY_BANK = [-5.0, 3.2] as const;

/** The crew rover (NASA SEV, decor, src/scene/Decor.tsx) parked on the flat pad, nose to the base; r = its hitbox. */
export const PARKED_ROVER = { x: 10.5, z: 8.2, yaw: -2.3, r: 2.4 } as const;

/** Footprint radius of each tappable building (cable ends, target rings). */
export const RADIUS = { habitat: 1.7, garden: 1.3, workshop: 1.55, scout: 0.9, lander: 1.6, hub: 0.6 } as const;

/** The habitat door and the open side of the interior face the power hub (south-west). */
export const DOOR_AZ = Math.atan2(LAYOUT.hub[0] - LAYOUT.habitat[0], LAYOUT.hub[1] - LAYOUT.habitat[1]);

/** Point at distance r from the habitat centre in the door direction. */
export function fromDoor(r: number): [number, number] {
  return [LAYOUT.habitat[0] + Math.sin(DOOR_AZ) * r, LAYOUT.habitat[1] + Math.cos(DOOR_AZ) * r];
}
