import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { View } from '../state/game';
import { BATTERY_BANK, LAYOUT } from './layout';
import { GLOW } from './parts/materials';
import { ICE_CRATER, groundHeight } from './ground';
import { sunAzimuth, sunDirection } from './Light';
import { finalize, light } from '../vendor/astra/scene/kit';
import type { ModuleView } from '../vendor/astra/scene/models/common';
import { buildBattery, buildSolar } from '../vendor/astra/scene/models/power';
import { buildIceDrill } from '../vendor/astra/scene/models/works';
import { buildScout, type ScoutView } from '../vendor/astra/scene/models/scout';

/**
 * Procedural models from the ASTRA trainer (src/vendor/astra, MIT, credited), placed on our base at Shoxjahon aka's
 * request: the tall sun-tracking solar arrays of the lunar pole (VSAT), the battery bank by the power hub, the
 * science scout on its rocker-bogie, and the ice drill at the rim of the ice crater. Built once; per frame only what
 * moves (arrays turn to the Sun, the drill's auger, the scout's mast, the battery's charge bars, the lamps).
 */

function module(build: (v: ModuleView) => void): ModuleView {
  const g = new THREE.Group();
  const view: ModuleView = { group: g, status: light('#3ee39a'), glow: [], spin: [], blink: [], top: 2.5 };
  build(view);
  finalize(g);
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.receiveShadow = true;
  });
  return view;
}

const sun = new THREE.Vector3();

/** The two arrays stand at the ends of the old solar wing (its hitbox in walk/world.ts); one leans since the landing. */
const WING_TURN = 0.5;
const ARRAYS: [number, number][] = [-1, 1].map((k) => [
  LAYOUT.wing[0] + k * Math.sin(WING_TURN) * 2.65,
  LAYOUT.wing[1] + k * Math.cos(WING_TURN) * 2.65,
]);

export function SolarArrays({ view }: { view: View }) {
  const views = useMemo(() => ARRAYS.map(() => module((v) => buildSolar(v, 'moon'))), []);
  views.forEach((v) => (v.group.name = 'astra_solar'));
  const az = sunAzimuth(view);
  useFrame(() => {
    sunDirection(az, sun);
    views.forEach((v, i) => {
      if (!v.yaw || !v.tilt) return;
      // face the Sun (ASTRA's own rule: yaw to the Sun's bearing, tilt to its height; the pole's Sun is 1.5° up)
      const want = Math.atan2(sun.x, sun.z) + Math.PI;
      v.yaw.rotation.y = want;
      v.tilt.rotation.x = Math.asin(sun.y);
      if (i === 1) v.tilt.rotation.z = 0.12; // bent at landing (the wing card's story)
    });
  });
  return (
    <>
      {views.map((v, i) => (
        <primitive key={i} object={v.group} position={[ARRAYS[i][0], groundHeight(ARRAYS[i][0], ARRAYS[i][1]), ARRAYS[i][1]]} />
      ))}
    </>
  );
}

/** Battery bank beside the power hub: its five charge bars show today's batteries still to place. */
export function BatteryBank({ view }: { view: View }) {
  const v = useMemo(() => module(buildBattery), []);
  v.group.name = 'astra_battery';
  const b = view.batteries;
  const share = b && b.total > 0 ? b.left / b.total : 1;
  v.bars?.forEach((m, i) => (m.emissiveIntensity = share > i / 5 + 0.02 ? 1.8 : 0.08));
  return <primitive object={v.group} position={[BATTERY_BANK[0], 0, BATTERY_BANK[1]]} rotation-y={0.8} scale={0.8} />;
}

/** Ice drill on the rim of the ice crater (the Ice card's place), its auger turning. */
const toCrater = Math.atan2(ICE_CRATER.x, ICE_CRATER.z);
const DRILL: [number, number] = [ICE_CRATER.x - Math.sin(toCrater) * 24 + 4, ICE_CRATER.z - Math.cos(toCrater) * 24];
export function IceDrill() {
  const v = useMemo(() => module((m) => buildIceDrill(m, 'moon')), []);
  v.group.name = 'astra_drill';
  // (Only while frames are drawn anyway: a calm scene is not redrawn for the auger.)
  useFrame((_, dt) => {
    for (const s of v.spin) s.rotation.y += Math.min(dt, 0.05) * 6;
    for (const b of v.blink) b.emissiveIntensity = (performance.now() / 1250) % 1 < 0.12 ? 5 : 0.15;
  });
  return <primitive object={v.group} position={[DRILL[0], groundHeight(DRILL[0], DRILL[1]), DRILL[1]]} rotation-y={toCrater} />;
}

/** The science scout (rocker-bogie, mast camera, arm): its mast looks about while it has batteries. */
export function ScoutRover({ on, scale }: { on: boolean; scale: number }) {
  const v = useMemo<ScoutView>(() => buildScout(), []);
  v.group.name = 'astra_scout';
  // our glowing eye (lit when Explore has batteries) rides on the mast camera, so it turns with it
  const eye = useMemo(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.06), GLOW.dark);
    m.position.copy(v.eye).add(new THREE.Vector3(0, 0, -0.12));
    v.tilt.add(m);
    return m;
  }, [v]);
  eye.material = on ? GLOW.eye : GLOW.dark;
  useFrame((state) => {
    if (!on) return;
    const t = state.clock.elapsedTime;
    v.pan.rotation.y = Math.sin(t * 0.4) * 0.9;
    v.tilt.rotation.x = -0.15 + Math.sin(t * 0.27) * 0.1;
  });
  return <primitive object={v.group} scale={scale} />;
}
