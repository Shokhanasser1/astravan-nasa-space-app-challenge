import { describe, expect, it } from 'vitest';
import { pickAim } from '../controls/aim';
import { AIM } from './Rig';
import { PLAN } from './layout';
import { RACK_REACH, rackSpot } from './hduParts';
import { POINTS } from './points';

/**
 * 15 Nov playtest: E must work where the game sends the child — under a machine's beacon (its battery rack) and at
 * the map's "Airlock" point — whichever way the astronaut happens to face after a hop or a slide along a wall.
 */
describe('E at a machine (the real plan the game is played on)', () => {
  const facings = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

  it('the map\'s Airlock point aims at the Air Maker in every facing', () => {
    const [x, , z] = POINTS.airlock.pos;
    for (const yaw of facings) expect(pickAim(x, z, yaw, AIM), `yaw ${yaw.toFixed(2)}`).toBe('ls');
  });

  it('near each machine\'s battery rack (its beacon) E aims at that machine in every facing', () => {
    for (const k of ['ls', 'gh', 'ws', 'sc', 'launch'] as const) {
      const at = rackSpot(PLAN, k);
      for (const a of facings) {
        // a step from the rack on every side, never closer to another machine's rack than to this one
        const x = at.x + Math.sin(a) * (RACK_REACH - 0.3);
        const z = at.z + Math.cos(a) * (RACK_REACH - 0.3);
        for (const yaw of facings) {
          const got = pickAim(x, z, yaw, AIM);
          // a building straight ahead within reach may win (the rule "the one in front wins"); never nothing
          expect(got, `${k} at ${a.toFixed(2)} facing ${yaw.toFixed(2)}`).not.toBeNull();
        }
        expect(pickAim(x, z, a, AIM), `${k} at ${a.toFixed(2)} facing the rack`).toBe(k);
      }
    }
  });
});
