// #34: outside by the HDU complex (`?hdu`) the follow camera booms up (looks down more from higher) instead of
// pinning 0.8 m behind the helmet when a module, a tunnel or a prop is just behind; ASTRA keeps today's rule.
import { describe, expect, it } from 'vitest';
import { clearance, fits, type Solid } from '../walk/collide';
import { inHduComplex, makeRooms } from '../walk/rooms';
import { makeOutside } from '../walk/world';
import { footGround } from '../walk/rocks';
import { hduFollowCam, type FollowCam } from './Rig';
import { HDU, HDU_MODULES, HDU_PLAN, moduleToGame } from './layout';

const HEAD = 1.55;
const PITCH = -0.22; // the follow camera's own look-down (CAM_TILT), the player's look level
const ground = footGround;
const out: FollowCam = { dist: 0, extra: 0, x: 0, y: 0, z: 0 };

/** Horizontal distance from (x, z) to the segment a–b. */
function segDist(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax, vz = bz - az;
  const l2 = vx * vx + vz * vz;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2)) : 0;
  return Math.hypot(x - (ax + vx * t), z - (az + vz * t));
}

/** Today's (pre-#34) outside follow camera on foot, verbatim: the reference for ASTRA. */
function today(hx: number, hy: number, hz: number, yaw: number, pitch: number, solids: readonly Solid[]): [number, number, number] {
  const fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
  let dist = 4.6;
  for (let d = 0.6; d <= 4.6; d += 0.2) {
    const px = hx - fx * d, py = hy - fy * d, pz = hz - fz * d;
    if (py < 3.2 && solids.some((o) => clearance(o, px, pz, 0.2) < 0)) {
      dist = Math.max(0.8, d - 0.3);
      break;
    }
  }
  const x = hx - fx * dist, z = hz - fz * dist;
  return [x, Math.max(hy - fy * dist, ground(x, z) + 0.3), z];
}

describe('HDU follow camera boom (#34)', () => {
  const outside = makeOutside(true);
  const rooms = makeRooms(true);
  const centres = [...HDU_MODULES].map((m) => moduleToGame(m, 0, 0)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const toComplex = (x: number, z: number) => {
    let best = Infinity;
    for (const [cx, cz] of centres) best = Math.min(best, Math.hypot(x - cx, z - cz) - HDU.shell);
    for (let i = 1; i < centres.length; i++) {
      const [a, b] = [centres[i - 1], centres[i]];
      best = Math.min(best, segDist(x, z, a[0], a[1], b[0], b[1]) - HDU.tunnelR);
    }
    return best;
  };

  // every module's door `out` spot, and a 0.5 m grid of standable spots within 4 m of the complex
  const doors = Object.values(rooms).filter((r) => r.id !== 'lander' && !r.noDoor);
  const spots: { x: number; z: number }[] = doors.map((r) => ({ x: r.out.x, z: r.out.z }));
  const xs = centres.map((c) => c[0]), zs = centres.map((c) => c[1]);
  for (let x = Math.min(...xs) - 7; x <= Math.max(...xs) + 7; x += 0.5) {
    for (let z = Math.min(...zs) - 7; z <= Math.max(...zs) + 7; z += 0.5) {
      if (toComplex(x, z) <= 4 && fits(x, z, outside) && !inHduComplex(x, 1, z)) spots.push({ x, z });
    }
  }

  it('booms up: ≥ 1.4 m from the head in ≥ 95 % of poses, never in the complex, a hitbox or the ground', () => {
    expect(doors.length).toBeGreaterThanOrEqual(3);
    expect(spots.length).toBeGreaterThan(200);
    let ok = 0, n = 0;
    const near: string[] = [];
    for (const p of spots) {
      const hy = ground(p.x, p.z) + HEAD;
      for (let a = 0; a < 12; a++) {
        const yaw = (a * Math.PI) / 6;
        hduFollowCam(out, p.x, hy, p.z, yaw, PITCH, outside.solids, ground, true);
        const d = Math.hypot(out.x - p.x, out.y - hy, out.z - p.z);
        n++;
        if (d >= 1.4) ok++;
        else near.push(`${p.x.toFixed(1)},${p.z.toFixed(1)} yaw ${a * 30}: ${d.toFixed(2)}`);
        const where = `${p.x.toFixed(2)},${p.z.toFixed(2)} yaw ${a * 30}`;
        expect(inHduComplex(out.x, out.y, out.z), where).toBe(false);
        if (out.y < 3.2) for (const s of outside.solids) expect(clearance(s, out.x, out.z, 0), `${where} ${s.name}`).toBeGreaterThanOrEqual(0);
        expect(out.y, where).toBeGreaterThanOrEqual(ground(out.x, out.z) + 0.3 - 1e-9);
        expect(out.extra).toBeGreaterThanOrEqual(0);
      }
    }
    console.log(`#34 boom: ${ok}/${n} poses ≥ 1.4 m (${((100 * ok) / n).toFixed(1)} %), ${spots.length} spots`);
    expect(ok / n, near.slice(0, 10).join('; ')).toBeGreaterThanOrEqual(0.95);
  });

  it('at every door `out` spot, facing away from the module, the camera is ≥ 1.6 m from the head', () => {
    for (const r of doors) {
      const hy = ground(r.out.x, r.out.z) + HEAD;
      // (camera yaw: the camera looks along (−sin yaw, −cos yaw); facing away = looking out of the door)
      const [cx, cz] = centres.reduce((b, c) => (Math.hypot(c[0] - r.out.x, c[1] - r.out.z) < Math.hypot(b[0] - r.out.x, b[1] - r.out.z) ? c : b));
      const yaw = Math.atan2(-(r.out.x - cx), -(r.out.z - cz));
      hduFollowCam(out, r.out.x, hy, r.out.z, yaw, PITCH, outside.solids, ground, true);
      expect(Math.hypot(out.x - r.out.x, out.y - hy, out.z - r.out.z), r.id).toBeGreaterThanOrEqual(1.6);
    }
  });

  it('ASTRA (no `?hdu`): exactly today’s camera, no boom', () => {
    const astra = makeOutside(false);
    const L = HDU_PLAN.LAYOUT; // (any points: the base core, by the buildings and out in the open)
    const pts = [[0, 0], [3, 2], [-4, 6], [L.habitat[0] + 6, L.habitat[1]], [12, -9], [-20, 15]];
    let pinned = 0;
    for (const [x, z] of pts) {
      if (!fits(x, z, astra)) continue;
      const hy = ground(x, z) + HEAD;
      for (let a = 0; a < 12; a++) {
        const yaw = (a * Math.PI) / 6;
        for (const pitch of [PITCH, -0.6, 0.1]) {
          const [tx, ty, tz] = today(x, hy, z, yaw, pitch, astra.solids);
          hduFollowCam(out, x, hy, z, yaw, pitch, astra.solids, ground, false);
          expect(out.extra).toBe(0);
          expect(out.x).toBeCloseTo(tx, 9);
          expect(out.y).toBeCloseTo(ty, 9);
          expect(out.z).toBeCloseTo(tz, 9);
          if (out.dist < 4.6) pinned++;
        }
      }
    }
    expect(pinned).toBeGreaterThan(0); // (some of these are blocked: the old pull-in is compared too)
  });
});
