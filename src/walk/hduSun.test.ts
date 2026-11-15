/**
 * The HDU plan's turn (PROMPT_B D1, finding #28): the doors face azimuth 285° so the first week's low Sun
 * (src/engine/sky.json, FIRST_WEEK 2021-10-25) is in front of every door every day. Azimuth as sunDirection
 * (src/scene/Light.tsx): from +z through +x, so a door facing (sin a, cos a) faces azimuth a.
 */
import { describe, expect, it } from 'vitest';
import sky from '../engine/sky.json';
import { FIRST_WEEK } from '../state/game';
import { ASTRA_PLAN, HDU_COMPLEX, HDU_MODULES, HDU_PLAN, HDU_TURN, moduleToGame } from '../scene/layout';

const deg = (r: number) => (r * 180) / Math.PI;

describe('the HDU doors and the first week\'s Sun', () => {
  const days = (sky.weeks as Record<string, { day: number; sun_az_deg: number }[]>)[FIRST_WEEK];

  it('has the first week in sky.json, all seven days', () => {
    expect(days?.length).toBe(7);
  });

  it('turns the doors to azimuth 285°', () => {
    expect(deg(HDU_TURN)).toBeCloseTo(285, 9);
    expect(HDU_COMPLEX.turn).toBe(HDU_TURN);
    expect(HDU_PLAN.DOOR_AZ).toBe(HDU_TURN);
    for (const m of HDU_MODULES) {
      // each module's door direction in the game (module +z) is the plan's door azimuth
      const [cx, cz] = moduleToGame(m, 0, 0);
      const [dx, dz] = moduleToGame(m, 0, 1);
      expect(Math.cos(Math.atan2(dx - cx, dz - cz) - HDU_TURN), m).toBeCloseTo(1, 9);
    }
  });

  it('has the Sun in front of every door every day of the first week (cos > 0.3)', () => {
    for (const d of days) {
      const c = Math.cos((d.sun_az_deg * Math.PI) / 180 - HDU_PLAN.DOOR_AZ);
      expect(c, `day ${d.day}, Sun at ${d.sun_az_deg}°`).toBeGreaterThan(0.3);
    }
  });

  it('turns the whole plan rigidly: distances between every pair of places are those of the base frame', () => {
    // (rotation about (0, 0) keeps every distance from the pad centre)
    const L = HDU_PLAN.LAYOUT;
    const r = (p: readonly [number, number]) => Math.hypot(p[0], p[1]);
    expect(r(L.hub)).toBeCloseTo(Math.hypot(-1.5, 4.5), 9);
    expect(r(L.lander)).toBeCloseTo(Math.hypot(9.5, 11.5), 9);
    expect(r(HDU_PLAN.BATTERY_BANK)).toBeCloseTo(Math.hypot(-18.5, 3.5), 9);
    expect(Math.hypot(HDU_PLAN.PARKED_ROVER.x, HDU_PLAN.PARKED_ROVER.z)).toBeCloseTo(Math.hypot(3.5, 16), 9);
    expect(Math.hypot(HDU_COMPLEX.x, HDU_COMPLEX.z)).toBeCloseTo(Math.hypot(0.75, -4), 9);
    // the rover still parks nose to the base
    const R = HDU_PLAN.PARKED_ROVER;
    expect(Math.cos(R.yaw - Math.atan2(-R.x, -R.z))).toBeCloseTo(1, 9);
  });

  it('leaves the ASTRA plan as it was', () => {
    expect(ASTRA_PLAN.LAYOUT.hub).toEqual([-5.5, 6.5]);
    expect(ASTRA_PLAN.BATTERY_BANK).toEqual([-15.5, -5.5]);
    expect(ASTRA_PLAN.PARKED_ROVER).toEqual({ x: 14.5, z: 12.0, yaw: -2.3, r: 2.4 });
  });
});

describe('the view from the hill (the launch is watched from there)', () => {
  it('sees the lander and all three modules, none hiding another', async () => {
    const { makePoints } = await import('../scene/points');
    const { HDU } = await import('../scene/layout');
    const [hx, hy, hz] = makePoints(true).POINTS.hill.pos;
    const [lx, lz] = HDU_PLAN.LAYOUT.lander;
    const targets: [string, number, number, number][] = [
      ['lander top', lx, 4.0, lz],
      ...HDU_MODULES.map((m) => {
        const [x, z] = moduleToGame(m, 0, 0);
        return [m, x, 5.0, z] as [string, number, number, number];
      }),
    ];
    for (const [name, tx, ty, tz] of targets) {
      for (let i = 1; i < 400; i++) {
        const t = i / 400;
        const x = hx + (tx - hx) * t, y = hy + (ty - hy) * t, z = hz + (tz - hz) * t;
        for (const m of HDU_MODULES) {
          const [mx, mz] = moduleToGame(m, 0, 0);
          if (Math.hypot(tx - mx, tz - mz) < 0.5) continue; // (the target's own module)
          expect(Math.hypot(x - mx, z - mz) < HDU.shell && y < HDU.top, `${name} hidden by ${m}`).toBe(false);
        }
      }
    }
  });
});
