import { describe, expect, it } from 'vitest';
import { clearance, fits } from '../walk/collide';
import { makeRooms, ROOM_BODY } from '../walk/rooms';
import { makeOutside } from '../walk/world';
import { astronautShown, HIDE_NEAR, isHduRoom, roomCamDist } from './Rig';
import { groundHeight } from './ground';
import { complexToGame, HDU, HDU_COMPLEX, HDU_MODULES, moduleToGame } from './layout';
import { HDU_TITLE, titleAngles, titlePose } from './title';

/** Horizontal distance from (x, z) to the segment a–b. */
function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax, vz = bz - az;
  const l2 = vx * vx + vz * vz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2)) : 0;
  return Math.hypot(x - (ax + vx * t), z - (az + vz * t));
}

describe('HDU title camera (#26)', () => {
  const outside = makeOutside(true);
  const props = outside.solids.filter((s) => !/^(habitat|garden|workshop|tunnel)/.test(s.name ?? ''));
  const centres = HDU_MODULES.map((id) => moduleToGame(id, 0, 0));
  const tunnels = [
    [centres[0], centres[1]],
    [centres[1], centres[2]],
  ];
  const [cx, cz] = complexToGame(0, 0);
  const doorX = Math.sin(HDU_COMPLEX.turn), doorZ = Math.cos(HDU_COMPLEX.turn);
  const poses: { x: number; y: number; z: number }[] = [];
  for (let t = 0; t <= HDU_TITLE.period; t += 0.5) poses.push(titlePose(t, false, { x: 0, y: 0, z: 0 }, HDU_TITLE));
  poses.push(titlePose(0, true, { x: 0, y: 0, z: 0 }, HDU_TITLE));

  it('keeps ≥ 4 m from every module axis and tunnel, over the whole swing and the still', () => {
    for (const p of poses) {
      for (const [mx, mz] of centres) expect(Math.hypot(p.x - mx, p.z - mz)).toBeGreaterThanOrEqual(4);
      for (const [a, b] of tunnels) expect(segDist(p.x, p.z, a[0], a[1], b[0], b[1])).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps ≥ 1 m from every prop hitbox and stays above the ground', () => {
    expect(props.length).toBeGreaterThan(5);
    for (const p of poses) {
      for (const s of props) expect(clearance(s, p.x, p.z, 0), s.name).toBeGreaterThanOrEqual(1);
      expect(p.y - groundHeight(p.x, p.z)).toBeGreaterThan(2);
    }
  });

  it('stands on the door side and holds all three modules inside a 60° horizontal field', () => {
    for (const p of poses) {
      expect((p.x - cx) * doorX + (p.z - cz) * doorZ).toBeGreaterThan(10);
      // (a tall screen: no pan, the look is straight at the target)
      const { yaw } = titleAngles(p, 9 / 16, HDU_TITLE);
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      for (const [mx, mz] of centres) {
        const dx = mx - p.x, dz = mz - p.z;
        const cos = (dx * fx + dz * fz) / Math.hypot(dx, dz);
        expect((Math.acos(Math.min(1, cos)) * 180) / Math.PI).toBeLessThan(30);
      }
    }
  });
});

describe('HDU room camera (#27, #34, D3)', () => {
  const rooms = Object.values(makeRooms(true)).filter((r) => isHduRoom(r, true));
  const HEAD = 1.55;

  it('has the six HDU rooms (the lander is ASTRA\'s)', () => {
    expect(rooms.map((r) => r.id).sort()).toEqual(['greenhouse', 'greenhouse_up', 'habitat', 'habitat_up', 'lab', 'lab_up']);
  });

  it('is the astronaut\'s own eyes everywhere you can stand (Samandar: "inside the base, only through the eyes")', () => {
    let n = 0;
    for (const R of rooms) {
      const { x: cx, z: cz } = R.area.bounds;
      for (let x = cx - 2; x <= cx + 2; x += 0.1)
        for (let z = cz - 2; z <= cz + 2; z += 0.1) {
          if (!fits(x, z, R.area, ROOM_BODY * R.s)) continue;
          for (let a = 0; a < 360; a += 30) {
            const yaw = (a * Math.PI) / 180;
            const d = roomCamDist(R, x, z, -Math.sin(yaw), -Math.cos(yaw), false, true);
            expect(d).toBe(0); // the camera is at the head: inside the lining, the astronaut not drawn
            expect(astronautShown(d)).toBe(false);
            expect(Math.hypot(x - cx, z - cz)).toBeLessThan(HDU.lining);
            expect(R.floorY + HEAD * R.s).toBeLessThan(R.ceilY - 0.1 * R.s); // (the eyes under the ceiling)
            n++;
          }
        }
    }
    expect(n).toBeGreaterThan(1000);
    expect(HIDE_NEAR).toBeGreaterThan(0);
  });

  it('ASTRA rooms keep their 1.7 m', () => {
    const astra = makeRooms(false).habitat;
    expect(isHduRoom(astra, false)).toBe(false);
    const { x, z } = astra.spawn;
    const d = roomCamDist(astra, x, z, 0, 0, false, false); // (no look direction: the camera sits on the head, never blocked)
    expect(d).toBeCloseTo(1.7 * astra.s, 6);
  });
});

describe('HDU interior while its door is open (#10)', () => {
  it('draws the whole interior from the first moment the door is wanted open until it is shut', async () => {
    const { interiorFull } = await import('./Interiors');
    expect(interiorFull(true, { open: 0, want: 0 }, false)).toBe(false);
    expect(interiorFull(true, { open: 0, want: 1 }, false)).toBe(true);
    expect(interiorFull(true, { open: 0.3, want: 1 }, false)).toBe(true);
    expect(interiorFull(true, { open: 0.3, want: 0 }, false)).toBe(true); // (closing: still open)
    expect(interiorFull(true, { open: 0, want: 0 }, true)).toBe(true);
    // ASTRA keeps its rule: only from inside
    expect(interiorFull(false, { open: 0.5, want: 1 }, false)).toBe(false);
    expect(interiorFull(false, { open: 0, want: 0 }, true)).toBe(true);
  });
});

describe('HDU inside ambience (D2, #32)', () => {
  it('in an HDU room the plan and the run sound inside; without one, the suit as before', async () => {
    const { ambienceFor } = await import('../audio/ambience');
    expect(ambienceFor('game', 'run', true)).toBe('inside');
    expect(ambienceFor('game', 'plan', true)).toBe('inside');
    expect(ambienceFor('game', 'run')).toBe('suit');
    expect(ambienceFor('start', 'run', true)).toBe('off');
  });
});

describe('hop out of the rover (#18)', () => {
  it('left when it lands clear (as before), right when only it does, nobody out when neither does', async () => {
    const { hopSide } = await import('./Rig');
    expect(hopSide(true, true)).toBe(1);
    expect(hopSide(true, false)).toBe(1);
    expect(hopSide(false, true)).toBe(-1);
    expect(hopSide(false, false)).toBe(0);
  });
});
