import { useMemo } from 'react';
import { Instance, Instances } from '@react-three/drei';
import type { Machine, View } from '../state/game';
import { LAYOUT, RADIUS } from './layout';
import { Terrain } from './Terrain';
import { Habitat } from './parts/Habitat';
import { Garden } from './parts/Garden';
import { Workshop } from './parts/Workshop';
import { Scout } from './parts/Scout';
import { Lander } from './parts/Lander';
import { SolarWing } from './parts/SolarWing';
import { Cables, Hub } from './parts/Hub';
import { Dish } from './parts/Dish';
import { tapOnly } from './parts/tap';
import { glowColor } from './parts/materials';

/**
 * Lane C (Shoxjahon aka). The 3D base: renders a View, reports taps. NEVER computes game numbers.
 * Grey code shapes until G3 decides on models (all six or none). Positions: docs/layout.md.
 * Only big bodies cast shadows; repeats use <Instances>.
 */
export function BaseScene({ view, onTap }: { view: View; onTap: (k: Machine) => void }) {
  const tap = useMemo(
    () => ({
      ls: tapOnly(() => onTap('ls')),
      gh: tapOnly(() => onTap('gh')),
      ws: tapOnly(() => onTap('ws')),
      sc: tapOnly(() => onTap('sc')),
      launch: tapOnly(() => onTap('launch')),
    }),
    [onTap],
  );
  const a = view.alloc;
  return (
    <group>
      <Terrain />
      <Habitat on={a.ls > 0} wall={view.wall} tap={tap.ls} />
      <Garden on={a.gh > 0} plant={view.plant} tap={tap.gh} />
      <Workshop on={a.ws > 0} tap={tap.ws} />
      <Scout on={a.sc > 0} tap={tap.sc} />
      <Lander on={a.launch > 0} phase={view.phase} tap={tap.launch} />
      <SolarWing />
      <Hub batteries={view.batteries} />
      <Cables alloc={a} />
      <Dish />
      <TargetRings strong={view.phase === 'plan'} />
    </group>
  );
}

const TARGETS = [
  { at: LAYOUT.habitat, r: RADIUS.habitat + 1.1 },
  { at: LAYOUT.garden, r: RADIUS.garden + 0.5 },
  { at: LAYOUT.workshop, r: RADIUS.workshop + 0.6 },
  { at: LAYOUT.scout, r: RADIUS.scout + 0.5 },
  { at: LAYOUT.lander, r: RADIUS.lander + 0.7 },
];
const SOFT = glowColor('#9fd3ff', 0.35);
const STRONG = glowColor('#9fd3ff', 0.9);

/** Faint ground ring around every tappable building; a little brighter while batteries are being placed. */
function TargetRings({ strong }: { strong: boolean }) {
  return (
    <Instances limit={TARGETS.length} frustumCulled={false}>
      <ringGeometry args={[0.96, 1, 64]} />
      <meshBasicMaterial color={strong ? STRONG : SOFT} toneMapped={false} />
      {TARGETS.map((t) => (
        <Instance key={`${t.at[0]}`} position={[t.at[0], 0.03, t.at[1]]} rotation={[-Math.PI / 2, 0, 0]} scale={t.r} />
      ))}
    </Instances>
  );
}
