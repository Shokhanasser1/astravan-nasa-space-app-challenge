import { Instance, Instances } from '@react-three/drei';
import type { Machine, View } from '../state/game';
import { HDU_HABITAT, LAYOUT, RADIUS } from './layout';
import { Terrain } from './Terrain';
import { Decor } from './Decor';
import { Outpost } from './Outpost';
import { OUTPOST_ON } from './outpostSite';
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
import { getAim, useAim, type AimId } from '../controls/bus';
import { Batteries } from './Batteries';
import { Beacon } from './Beacon';
import { AstraMerge, AstraPads, astraLook, faceCentre } from './AstraBase';
import { HduComplex } from './HduComplex';
import { ShipParts } from './ShipParts';

/**
 * ASTRA's hexagonal pads under the outer buildings (width in metres, about the building's footprint). The HDU complex
 * (`?hdu`) stands on its own skids: no pads under its greenhouse and lab modules.
 */
const PADS = (
  [
    ...(HDU_HABITAT
      ? []
      : ([
          [LAYOUT.garden, 3.8],
          [LAYOUT.workshop, 4.0],
        ] as const)),
    [LAYOUT.lander, 4.8],
    [LAYOUT.scout, 3.4],
  ] as const
).map(([[x, z], size]) => ({ x, z, size, turn: faceCentre(x, z) }));

/**
 * A tap on the thing the astronaut faces = E: the very same key path (src/ui/play/Controls.tsx useGameKeys →
 * src/controls/act.ts resolve → TAKE at the hub / PUT at a machine), so a tap can never do more than the key.
 * A tap on anything else does nothing (15 Nov: no acting from across the base; walk there first).
 */
function pressUse() {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e' }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e' }));
}
const tapAimed = (k: AimId) =>
  tapOnly(() => {
    if (getAim() === k) pressUse();
  });
const TAP = { hub: tapAimed('hub'), ls: tapAimed('ls'), gh: tapAimed('gh'), ws: tapAimed('ws'), sc: tapAimed('sc'), launch: tapAimed('launch') };
/** The HDU complex's modules (`?hdu`) are Life Support, the garden and the workshop. */
const HDU_TAP = { habitat: TAP.ls, greenhouse: TAP.gh, lab: TAP.ws };

/**
 * Lane C (Shoxjahon aka). The 3D base: renders a View, reports taps. NEVER computes game numbers.
 * Grey code shapes until G3 decides on models (all six or none). Positions: docs/layout.md.
 * Only big bodies cast shadows; repeats use <Instances>.
 * (`onTap` / `onUndo` are no longer used: a building is worked only from next to it, through E or a tap = E.)
 */
/**
 * `?hdu&lite`: the HDU complex is NASA's model, so the rest of the base keeps ASTRA's look with it (no mixing models
 * with grey shapes; three.md "all models or all grey shapes"). Plain `?lite` (ASTRA plan) keeps the old shapes.
 */
const look = astraLook || HDU_HABITAT;

export function BaseScene({ view }: { view: View; onTap?: (k: Machine) => void; onUndo?: (k: Machine) => void }) {
  const a = view.alloc;
  return (
    <group>
      <Terrain sunAzDeg={sunAzimuth(view)} />
      <Decor />
      {OUTPOST_ON && <Outpost />}
      {look && <AstraPads pads={PADS} />}
      {look && <AstraMerge />}
      {/* the HDU complex (`?hdu`) is the habitat, the garden and the workshop in one */}
      {HDU_HABITAT && (
        <HduComplex on={{ habitat: a.ls > 0, greenhouse: a.gh > 0, lab: a.ws > 0 }} wall={view.wall} plant={view.plant} taps={HDU_TAP} />
      )}
      {!HDU_HABITAT && <Habitat on={a.ls > 0} wall={view.wall} tap={TAP.ls} />}
      {!HDU_HABITAT && <Garden on={a.gh > 0} plant={view.plant} tap={TAP.gh} />}
      {!HDU_HABITAT && <Workshop on={a.ws > 0} tap={TAP.ws} />}
      <Scout on={a.sc > 0} tap={TAP.sc} />
      <Lander on={a.launch > 0} phase={view.phase} tap={TAP.launch} grounded={features.homeStory && view.phase === 'truth' && view.launched === false} />
      {/* home story: the parts brought for the ship pile up beside it, one bag per sixth of Ship % */}
      {features.homeStory && <ShipParts ship={view.res?.ship ?? 0} />}
      {rich ? <SolarArrays view={view} /> : <SolarWing />}
      {rich && <BatteryBank view={view} />}
      {rich && <IceDrill />}
      <Hub tap={TAP.hub} />
      <Batteries view={view} />
      <Cables alloc={a} />
      <Dish />
      <TargetRings strong={view.phase === 'plan'} />
      {features.controls && view.phase === 'plan' && <AimRing />}
      <Beacon />
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

const AIMED = glowColor('#9fe8ff', 1.6);

const HUB_RING = { k: 'hub', at: LAYOUT.hub, r: RADIUS.hub + 0.7 } as const;

/** The building (or the hub) E or the ✋ button would act on gets a warm ring (no crosshair: the ring is the offer). */
function AimRing() {
  const k = useAim();
  const t = k === 'hub' ? HUB_RING : TARGETS.find((x) => x.k === k);
  if (!t) return null;
  return (
    <mesh position={[t.at[0], 0.05, t.at[1]]} rotation={[-Math.PI / 2, 0, 0]} scale={t.r + 0.18}>
      <ringGeometry args={[0.95, 1, 64]} />
      <meshBasicMaterial color={AIMED} toneMapped={false} />
    </mesh>
  );
}
