import { useMemo } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import type { Machine, View } from '../state/game';
import { LAYOUT, RADIUS } from './layout';
import { Terrain } from './Terrain';
import { Decor } from './Decor';
import { sunAzimuth } from './Light';
import { Habitat } from './parts/Habitat';
import { Garden } from './parts/Garden';
import { Workshop } from './parts/Workshop';
import { Scout } from './parts/Scout';
import { Lander } from './parts/Lander';
import { BatteryBank, IceDrill, SolarArrays } from './AstraProps';
import { SolarWing } from './parts/SolarWing';
import { rich } from './rich';
import { Cables, Hub } from './parts/Hub';
import { Dish } from './parts/Dish';
import { tapOnly } from './parts/tap';
import { glowColor } from './parts/materials';
import { features } from '../config/features';
import { useAim } from '../controls/bus';
import { AstraPads, astraLook, faceCentre } from './AstraBase';

/** ASTRA's hexagonal pads under the outer buildings (width in metres, about the building's footprint). */
const PADS = (
  [
    [LAYOUT.garden, 3.8],
    [LAYOUT.workshop, 4.0],
    [LAYOUT.lander, 4.8],
    [LAYOUT.scout, 3.4],
  ] as const
).map(([[x, z], size]) => ({ x, z, size, turn: faceCentre(x, z) }));

/**
 * Lane C (Shoxjahon aka). The 3D base: renders a View, reports taps. NEVER computes game numbers.
 * Grey code shapes until G3 decides on models (all six or none). Positions: docs/layout.md.
 * Only big bodies cast shadows; repeats use <Instances>.
 */
export function BaseScene({ view, onTap, onUndo }: { view: View; onTap: (k: Machine) => void; onUndo?: (k: Machine) => void }) {
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
  // Right mouse button on a building takes a battery back (controls guide; same as Q or the ↩ button).
  const undo = useMemo(() => {
    const one = (k: Machine) => (e: ThreeEvent<MouseEvent>) => {
      e.nativeEvent.preventDefault();
      e.stopPropagation();
      onUndo?.(k);
    };
    return { ls: one('ls'), gh: one('gh'), ws: one('ws'), sc: one('sc'), launch: one('launch') };
  }, [onUndo]);
  const a = view.alloc;
  return (
    <group>
      <Terrain sunAzDeg={sunAzimuth(view)} />
      <Decor />
      {astraLook && <AstraPads pads={PADS} />}
      <group onContextMenu={undo.ls}>
        <Habitat on={a.ls > 0} wall={view.wall} tap={tap.ls} />
      </group>
      <group onContextMenu={undo.gh}>
        <Garden on={a.gh > 0} plant={view.plant} tap={tap.gh} />
      </group>
      <group onContextMenu={undo.ws}>
        <Workshop on={a.ws > 0} tap={tap.ws} />
      </group>
      <group onContextMenu={undo.sc}>
        <Scout on={a.sc > 0} tap={tap.sc} />
      </group>
      <group onContextMenu={undo.launch}>
        <Lander on={a.launch > 0} phase={view.phase} tap={tap.launch} />
      </group>
      {rich ? <SolarArrays view={view} /> : <SolarWing />}
      {rich && <BatteryBank view={view} />}
      {rich && <IceDrill />}
      <Hub batteries={view.batteries} />
      <Cables alloc={a} />
      <Dish />
      <TargetRings strong={view.phase === 'plan'} />
      {features.controls && view.phase === 'plan' && <AimRing />}
    </group>
  );
}

const TARGETS = [
  { k: 'ls', at: LAYOUT.habitat, r: RADIUS.habitat + 1.1 },
  { k: 'gh', at: LAYOUT.garden, r: RADIUS.garden + 0.5 },
  { k: 'ws', at: LAYOUT.workshop, r: RADIUS.workshop + 0.6 },
  { k: 'sc', at: LAYOUT.scout, r: RADIUS.scout + 0.5 },
  { k: 'launch', at: LAYOUT.lander, r: RADIUS.lander + 0.7 },
] as const satisfies readonly { k: Machine; at: readonly [number, number]; r: number }[];
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

const AIMED = glowColor('#ffd98a', 1.6);

/** The building E or the ✋ button would act on gets a second, warm ring (no crosshair: the ring is the offer). */
function AimRing() {
  const k = useAim();
  const t = TARGETS.find((x) => x.k === k);
  if (!t) return null;
  return (
    <mesh position={[t.at[0], 0.05, t.at[1]]} rotation={[-Math.PI / 2, 0, 0]} scale={t.r + 0.18}>
      <ringGeometry args={[0.95, 1, 64]} />
      <meshBasicMaterial color={AIMED} toneMapped={false} />
    </mesh>
  );
}
