// Walking in the habitat's furnished ground floor (ASTRA look): the inside point stands clear, the walker can walk
// round the ring hall, and the lining and the furniture stop it — all at the room's scale (ROOM_K).
import { describe, expect, it, vi } from 'vitest';

// The ASTRA base's expectations (the HDU complex is tested with the flag passed in, makeOutside(true) etc.): run with
// features.hduHabitat off, as they were written — it is on by default since 15 Nov ~15:40 (`?nohdu` shows ASTRA).
vi.mock('../config/features', async (load) => {
  const real = await load<typeof import('../config/features')>();
  return { ...real, features: { ...real.features, hduHabitat: false } };
});
import { BODY, fits, walkStep } from './collide';
import { HAB_ROOM, ROOM_K } from './habitatRoom';
import { POINTS } from '../scene/points';
import { LAYOUT } from '../scene/layout';

const body = BODY * ROOM_K;
const [hx, hz] = LAYOUT.habitat;

/** Walk in small steps towards (tx, tz); returns where it ends. */
function walkTo(from: { x: number; z: number }, tx: number, tz: number, steps = 600) {
  const at = { ...from };
  const out = { x: 0, z: 0 };
  for (let i = 0; i < steps; i++) {
    const dx = tx - at.x, dz = tz - at.z, d = Math.hypot(dx, dz);
    if (d < 1e-3) break;
    const k = Math.min(1, 0.01 / d);
    walkStep(at, dx * k, dz * k, HAB_ROOM, body, out);
    at.x = out.x;
    at.z = out.z;
  }
  return at;
}

describe('habitat room walk', () => {
  const start = { x: POINTS.inside.pos[0], z: POINTS.inside.pos[2] };

  it('has the ground floor hitboxes and the inside point stands clear', () => {
    // (43 since the storm-shelter ring of bags left the game, src/walk/rooms.ts HIDDEN_BOX; its bench stays)
    expect(HAB_ROOM.solids.length).toBeGreaterThan(40);
    expect(fits(start.x, start.z, HAB_ROOM, body)).toBe(true);
  });

  it('walks to the wardroom table and is stopped by it, never through the lining', () => {
    const [tx, tz] = [POINTS.inside.look[0], POINTS.inside.look[2]];
    const end = walkTo(start, tx, tz);
    expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThan(0.4); // ~1.2 m in the room
    expect(fits(end.x, end.z, HAB_ROOM, body)).toBe(true);
    // straight out through the wall: it stays inside the lining
    const out = walkTo(start, hx + (start.x - hx) * 10, hz + (start.z - hz) * 10);
    expect(Math.hypot(out.x - hx, out.z - hz)).toBeLessThanOrEqual(HAB_ROOM.bounds.r - body + 1e-6);
  });
});
