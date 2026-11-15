/**
 * Flat collision for someone on foot (handoff "first-person walk", section 6): everything happens on the ground
 * plane (x, z), with no physics engine. The walker is a disc; solid things are discs or bars (a bar is a line with a
 * thickness: a wall, a solar wing). A step is cut into pieces shorter than half the body, and after each piece the
 * walker is pushed straight out of anything it overlaps, which is what makes it slide along a wall instead of
 * sticking, and never pass through one however long a frame was.
 *
 * Pure: no three.js, no DOM, same input → same output. Scene-only numbers (positions, sizes), never game numbers.
 */
export interface XZ {
  x: number;
  z: number;
}
/** A round solid, or a bar from (x, z) to (bx, bz); `r` is the radius (half the bar's thickness). */
export interface Solid extends XZ {
  r: number;
  bx?: number;
  bz?: number;
  /** What it is, for the debug view. */
  name?: string;
}
export interface Area {
  solids: readonly Solid[];
  /** The walker stays inside this disc: the edge of the playable ground, or the wall of a room. */
  bounds: Solid;
}

/** Body radius of the walker (0.35 m: a suited child-sized astronaut, shoulders and backpack). */
export const BODY = 0.35;

const near: XZ = { x: 0, z: 0 };

/** The point of a solid's middle line nearest to (x, z): its centre, or somewhere along the bar (read it at once). */
function nearest(s: Solid, x: number, z: number): XZ {
  if (s.bx === undefined || s.bz === undefined) return s;
  const vx = s.bx - s.x;
  const vz = s.bz - s.z;
  const len2 = vx * vx + vz * vz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - s.x) * vx + (z - s.z) * vz) / len2)) : 0;
  near.x = s.x + vx * t;
  near.z = s.z + vz * t;
  return near;
}

/** How far (x, z) is from the surface of a solid (negative inside it), for a body of radius `body`. */
export function clearance(s: Solid, x: number, z: number, body = BODY): number {
  const n = nearest(s, x, z);
  return Math.hypot(x - n.x, z - n.z) - s.r - body;
}

/** Push p out of every solid it overlaps and back inside the bounds. (dirX, dirZ) breaks the tie when p is dead centre. */
function settle(p: XZ, area: Area, body: number, dirX: number, dirZ: number): void {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const s of area.solids) {
      // Nearest point of the solid's middle line (its centre, or somewhere along the bar).
      let nx = s.x;
      let nz = s.z;
      if (s.bx !== undefined && s.bz !== undefined) {
        const vx = s.bx - s.x;
        const vz = s.bz - s.z;
        const len2 = vx * vx + vz * vz;
        const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - s.x) * vx + (p.z - s.z) * vz) / len2)) : 0;
        nx = s.x + vx * t;
        nz = s.z + vz * t;
      }
      const dx = p.x - nx;
      const dz = p.z - nz;
      const d = Math.hypot(dx, dz);
      const min = s.r + body;
      if (d >= min) continue;
      if (d > 1e-9) {
        p.x = nx + (dx / d) * min;
        p.z = nz + (dz / d) * min;
      } else {
        // Exactly on its middle: back out the way we came (or west, standing still).
        const l = Math.hypot(dirX, dirZ);
        p.x = nx - (l > 0 ? dirX / l : 1) * min;
        p.z = nz - (l > 0 ? dirZ / l : 0) * min;
      }
      moved = true;
    }
    const b = area.bounds;
    const dx = p.x - b.x;
    const dz = p.z - b.z;
    const d = Math.hypot(dx, dz);
    const max = Math.max(0, b.r - body);
    if (d > max) {
      p.x = b.x + (d > 0 ? dx / d : 0) * max;
      p.z = b.z + (d > 0 ? dz / d : 0) * max;
      moved = true;
    }
    if (!moved) break;
  }
}

/**
 * Walk from `from` by (dx, dz) metres. Returns where the walker ends up (in `out`, so a frame loop allocates
 * nothing): stopped by solids and the bounds, sliding along them when the step is at an angle.
 */
export function walkStep(from: XZ, dx: number, dz: number, area: Area, body = BODY, out: XZ = { x: 0, z: 0 }): XZ {
  // pieces of at most half the body, so nothing thinner than the body can be skipped over
  const pieces = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (body / 2)));
  out.x = from.x;
  out.z = from.z;
  for (let i = 0; i < pieces; i++) {
    out.x += dx / pieces;
    out.z += dz / pieces;
    settle(out, area, body, dx, dz);
  }
  return out;
}

/** True when a body fits at (x, z): clear of every solid and inside the bounds. */
export function fits(x: number, z: number, area: Area, body = BODY): boolean {
  if (Math.hypot(x - area.bounds.x, z - area.bounds.z) > area.bounds.r - body + 1e-9) return false;
  return area.solids.every((s) => clearance(s, x, z, body) >= -1e-9);
}
