// HB7: only what ASTRA's habitat model (scene/models/habitat.ts) reads from their src/sim/home.ts, copied as it is
// (their floor plan, walking and rooms are not used).
export const HOME = {
  /** Outer face of the inflatable shell. */
  shell: 5.2,
  /** Inner face of the padded wall: the edge of the rooms. */
  lining: 4.95,
  /** Outer face of the central core. */
  core: 1.9,
  /** Inner face of the storm shelter's water walls (ground floor core). */
  shelter: 1.5,
  /** Inner face of the command room's wall (upper floor core). */
  command: 1.75,
  /** Outer edge of the ring hall around the core (the middle of its wall); rooms start here. */
  hall: 2.95,
  floor: [0.5, 3.35] as const,
  ceiling: [3.1, 5.95] as const,
  /** Partition thickness. */
  wall: 0.12,
  /** Eye height above the floor. */
  eye: 1.65,
  /** The walker's body radius (shoulders and elbows, about 0.6 m across). */
  body: 0.3,
};
export type Level = 0 | 1;

export const rad = (deg: number) => (deg * Math.PI) / 180;
/** A habitat-local point at a compass bearing (degrees) and distance from the centre. */
export const polar = (bearing: number, r: number) => ({ x: Math.sin(rad(bearing)) * r, z: -Math.cos(rad(bearing)) * r });
/** The compass bearing (0 – 360) of a habitat-local point. */
export const bearingOf = (x: number, z: number) => ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360;

/** Windows through the shell: the same list places the frames outside and the openings inside. */
export interface Window {
  level: Level;
  bearing: number;
  /** Width and height of the glass (metres). */
  w: number;
  h: number;
}
export const WINDOWS: Window[] = [
  { level: 0, bearing: 228, w: 0.95, h: 0.62 },
  { level: 0, bearing: 268, w: 0.95, h: 0.62 },
  { level: 0, bearing: 46, w: 0.95, h: 0.62 },
  { level: 0, bearing: 80, w: 0.7, h: 0.5 },
  { level: 1, bearing: 227.5, w: 0.8, h: 0.55 },
  { level: 1, bearing: 272.5, w: 0.8, h: 0.55 },
  { level: 1, bearing: 317.5, w: 0.8, h: 0.55 },
  { level: 1, bearing: 2.5, w: 0.8, h: 0.55 },
  { level: 1, bearing: 45, w: 0.95, h: 0.62 },
  { level: 1, bearing: 78, w: 0.95, h: 0.62 },
];
/** Height of a window's centre above the ground. */
export const windowY = (w: Window) => HOME.floor[w.level] + 1.4;
