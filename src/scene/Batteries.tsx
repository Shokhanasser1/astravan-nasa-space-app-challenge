import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import type { Machine, View } from '../state/game';
import { LAYOUT, PLAN } from './layout';
import { RACK, rackSpot } from './hduParts';
import { MAT, glowColor } from './parts/materials';
import { groundHeight } from './ground';
import { audio } from '../audio/audio';

/**
 * Battery sockets in 3D (15 Nov, "make it a game": batteries are carried, not tapped from afar). Every machine has a
 * small rack at the end of its cable, on the side that faces the power hub; its cells light up for the batteries
 * the machine holds (view.alloc, from the engine). The hub shows the free batteries (left − hands) on its top.
 * A cell that changes pops for a moment. Never computes a game number: counts come from the View.
 *
 * Cost: two draw calls in all — the racks (one instanced box) and every cell of every rack and of the hub (one
 * instanced box, lit or dark by instance colour).
 */

/** Slots per machine = the engine's most batteries per machine (P.max in src/engine/rules.ts); drawn only. */
const SLOTS: Record<Machine, number> = { ls: 3, gh: 2, ws: 2, sc: 3, launch: 4 };
const HUB_SLOTS = { min: 6, max: 10 };

const MACHINES: Machine[] = ['ls', 'gh', 'ws', 'sc', 'launch'];

/** Rack size, metres: a knee-high box a child's astronaut stands at (hduParts.ts RACK). */
const PITCH = RACK.pitch;
const RACK_H = RACK.h;
const RACK_D = RACK.d;
const CELL_Y = 0.48;

/**
 * Where a machine's rack stands (hduParts.ts rackSpot): ASTRA — on the line to the hub, just outside the footprint,
 * turned to face the hub (the same line the ground cable runs along, src/scene/parts/Hub.tsx); HDU (D8) — the
 * module's fixed spot, facing out of the door side, the cable running hub → rack. Also used by the objective beacon.
 */
export function socketSpot(k: Machine, out = 0.35): { x: number; z: number; yaw: number } {
  return rackSpot(PLAN, k, out);
}

const LIT = glowColor('#f0b43c', 2.2); // the same orange as a powered cable
const DARK = new THREE.Color('#3a3f55');
const FLASH_S = 0.45;

type Slot = { id: string; owner: Machine | 'hub'; i: number };

export function Batteries({ view }: { view: View }) {
  const invalidate = useThree((s) => s.invalidate);
  const racks = useMemo(
    () =>
      MACHINES.map((k) => {
        const s = socketSpot(k);
        return { k, ...s, y: groundHeight(s.x, s.z), n: SLOTS[k] };
      }),
    [],
  );

  const total = Math.max(HUB_SLOTS.min, Math.min(HUB_SLOTS.max, view.batteries?.total ?? HUB_SLOTS.min));
  const left = view.batteries?.left ?? 0;
  const free = Math.max(0, Math.min(total, left - (view.hands ?? 0)));
  const lit = (owner: Machine | 'hub') => (owner === 'hub' ? free : Math.min(SLOTS[owner], view.alloc[owner]));

  // A cell that changes pops (scale) for a moment; refs to the instances, timers per cell.
  const cells = useRef(new Map<string, THREE.Object3D>()).current;
  const flash = useRef(new Map<string, number>()).current;
  const before = useRef<{ phase: string; n: Record<string, number> } | null>(null);
  useEffect(() => {
    const now: Record<string, number> = { hub: free };
    for (const k of MACHINES) now[k] = lit(k);
    const last = before.current;
    before.current = { phase: view.phase, n: now };
    if (!last) return;
    const prev = last.n;
    let changed = false;
    let took = false;
    let put = false;
    for (const owner of Object.keys(now)) {
      const a = prev[owner];
      const b = now[owner];
      if (a === b) continue;
      changed = true;
      for (let i = Math.min(a, b); i < Math.max(a, b); i++) flash.set(`${owner}:${i}`, FLASH_S);
      if (owner === 'hub' && b < a) took = true;
      if (owner !== 'hub' && b > a) put = true;
    }
    if (changed) invalidate();
    // a sound only for the hands' work while planning (not when a new day fills or empties the hub)
    if (view.phase !== 'plan' || last.phase !== 'plan') return;
    if (put) audio.click('put');
    else if (took) audio.click('take');
    // (lit() reads only `free` and view.alloc)
  }, [free, view.alloc, view.phase, invalidate]);

  useFrame((_, delta) => {
    if (flash.size === 0) return;
    const dt = Math.min(delta, 0.05);
    for (const [id, t] of flash) {
      const o = cells.get(id);
      const next = t - dt;
      if (next <= 0) {
        flash.delete(id);
        o?.scale.setScalar(1);
      } else {
        o?.scale.setScalar(1 + 0.9 * (next / FLASH_S));
      }
    }
    invalidate();
  });

  const cell = (s: Slot, position: [number, number, number]) => (
    <Instance
      key={s.id}
      ref={(o: THREE.Object3D | null) => {
        if (o) cells.set(s.id, o);
        else cells.delete(s.id);
      }}
      position={position}
      color={s.i < lit(s.owner) ? LIT : DARK}
    />
  );

  const [hx, hz] = LAYOUT.hub;
  return (
    <group>
      {/* the racks: knee-high boxes at the cable ends */}
      <Instances limit={MACHINES.length} material={MAT.panel} frustumCulled={false}>
        <boxGeometry args={[1, RACK_H, RACK_D]} />
        {racks.map((r) => (
          <Instance key={r.k} position={[r.x, r.y + RACK_H / 2, r.z]} rotation={[0, r.yaw, 0]} scale={[r.n * PITCH + 0.12, 1, 1]} />
        ))}
      </Instances>
      {/* every cell: on the racks' hub side, and standing on the hub's top (lit = a battery is there) */}
      <Instances limit={MACHINES.reduce((n, k) => n + SLOTS[k], 0) + HUB_SLOTS.max} frustumCulled={false}>
        <boxGeometry args={[0.12, 0.2, 0.06]} />
        <meshBasicMaterial toneMapped={false} />
        {racks.map((r) => (
          <group key={r.k} position={[r.x, r.y, r.z]} rotation-y={r.yaw}>
            {Array.from({ length: r.n }, (_, i) =>
              cell({ id: `${r.k}:${i}`, owner: r.k, i }, [(i - (r.n - 1) / 2) * PITCH, CELL_Y, RACK_D / 2 + 0.03]),
            )}
          </group>
        ))}
        {/* (same frame as the hub cabinet in parts/Hub.tsx: on the base's flat ground, turned −45°) */}
        <group position={[hx, 0, hz]} rotation-y={-Math.PI / 4}>
          {Array.from({ length: total }, (_, i) => {
            const row = i < 5 ? 0 : 1;
            const col = row === 0 ? i : i - 5;
            return cell({ id: `hub:${i}`, owner: 'hub', i }, [-0.36 + col * 0.18, 0.9, -0.15 + row * 0.3]);
          })}
        </group>
      </Instances>
    </group>
  );
}
