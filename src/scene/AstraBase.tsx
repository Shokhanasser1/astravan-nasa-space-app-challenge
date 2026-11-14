import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { finalize, light, setLod } from '../vendor/astra/scene/kit';
import { initialTier } from './quality';
import { softwareGl } from './rich';
import type { ModuleView } from '../vendor/astra/scene/models/common';
import { buildHabitat } from '../vendor/astra/scene/models/habitat';
import { buildGreenhouse } from '../vendor/astra/scene/models/life';
import { buildLander, buildPad } from '../vendor/astra/scene/models/site';
import { buildLab } from '../vendor/astra/scene/models/works';
import { bake, mergeWorld } from './astra/bake';
import { LAYOUT, PAD } from './layout';

/**
 * The base in ASTRA's look (15 Nov, Shoxjahon aka: the best of ASTRA + the best of ours). ASTRA's procedural models
 * (src/vendor/astra, MIT, credited) replace our buildings' shells at the same footprint, so hitboxes, standing
 * points, taps and the habitat's interior stay ours. Each model is baked once (src/scene/astra/bake.ts): hundreds of
 * small meshes become a few, so phones keep their budget. Power changes only materials (ASTRA's own rule).
 */

/**
 * Real-ish size next to the 1.85 m astronaut (15 Nov ~05:00, Shoxjahon aka: "the base models are small"; it was
 * 0.34 / 0.45 / 0.6 / 0.45 to fit the old small plan): habitat 5.8 m tall, 6.3 m across; greenhouse 4.4 m long,
 * 1.6 m high; lab 3.4 m tall; lander 4.3 m tall. The plan grew with them (src/scene/layout.ts LAYOUT, RADIUS, PAD).
 */
export const ASTRA_SCALE = { habitat: 0.6, greenhouse: 0.9, lab: 0.85, lander: 0.7, scout: 0.9, battery: 1.0 } as const;

// Phones build every curved part with half the segments (src/vendor/astra/scene/kit.ts sg): the base stays inside
// the phone budget (< 100k triangles). Computers keep ASTRA's own detail.
// A computer that draws in software (no GPU: SwiftShader, llvmpipe — also the e2e and shot.sh browsers) builds like a
// phone too, or a whole week of play crawls.
setLod(initialTier() === 'pc' && !softwareGl() ? 1 : 0.5);

/** `?lite` keeps the old shapes (comparison, or a very weak phone). */
export const astraLook = typeof location === 'undefined' || !new URLSearchParams(location.search).has('lite');

export function astraModule(build: (v: ModuleView) => void): ModuleView {
  const g = new THREE.Group();
  const view: ModuleView = { group: g, status: light('#3ee39a'), glow: [], spin: [], blink: [], top: 2.5 };
  build(view);
  finalize(g);
  const keep: THREE.Object3D[] = [...view.spin, ...(view.windowGlow ?? [])];
  if (view.yaw) keep.push(view.yaw);
  if (view.tilt) keep.push(view.tilt);
  if (view.shield) keep.push(view.shield);
  const live: THREE.Material[] = [view.status, ...view.glow, ...view.blink, ...(view.bars ?? [])];
  if (view.windows) live.push(view.windows);
  bake(g, { keep, live });
  // What moves stays its own part, but its own pieces merge too (a solar wing, a fan); the shield is revealed
  // bag by bag, so it is left as it is.
  for (const k of keep) if (k !== view.shield) bake(k, { keep: keep.filter((o) => o !== k), live });
  for (const k of keep) k.userData.moves = true; // AstraMerge leaves these alone
  return view;
}

/** ASTRA's power look (World.tsx): glow 0.08 + 1.9 × power, green or amber status lamp, warm windows. */
export function setPower(v: ModuleView, on: boolean): void {
  for (const m of v.glow) m.emissiveIntensity = 0.08 + (on ? 1.9 : 0) * ((m.userData.glow as number | undefined) ?? 1);
  const lamp = on ? '#3ee39a' : '#ffb340';
  v.status.color.set(lamp);
  v.status.emissive.set(lamp);
  v.status.emissiveIntensity = on ? 0.9 : 0.4;
  if (v.windows) v.windows.emissiveIntensity = on ? 1.6 : 0.12;
}

/** Spinning parts turn while the building works (only while frames are drawn: a calm scene is not redrawn for it). */
function useSpin(v: ModuleView, on: boolean, rate: number) {
  useFrame((_, dt) => {
    if (!on) return;
    for (const s of v.spin) s.rotation.y += Math.min(dt, 0.05) * rate;
  });
}

/** Turn a model so that its front (+z) faces the middle of the base. */
export const faceCentre = (x: number, z: number) => Math.atan2(-x, -z);

/** Habitat → Life Support: ASTRA's inflatable habitat; its regolith shield grows with the wall level (0–3). */
export function AstraHabitat({ on, wall, turn }: { on: boolean; wall: number; turn: number }) {
  const v = useMemo(() => astraModule((m) => buildHabitat(m, 'moon')), []);
  v.group.name = 'astra_hab';
  setPower(v, on);
  v.shieldProgress?.(Math.max(0, Math.min(1, wall / 3)));
  return <primitive object={v.group} rotation-y={turn} scale={ASTRA_SCALE.habitat} />;
}

/** Garden: ASTRA's greenhouse, grow lights on with batteries. */
export function AstraGreenhouse({ on, turn }: { on: boolean; turn: number }) {
  const v = useMemo(() => astraModule(buildGreenhouse), []);
  v.group.name = 'astra_greenhouse';
  setPower(v, on);
  useSpin(v, on, 3);
  return <primitive object={v.group} rotation-y={turn} scale={ASTRA_SCALE.greenhouse} />;
}

/** Workshop: ASTRA's lab module. */
export function AstraLab({ on, turn }: { on: boolean; turn: number }) {
  const v = useMemo(() => astraModule(buildLab), []);
  v.group.name = 'astra_lab';
  setPower(v, on);
  useSpin(v, on, 0.4);
  return <primitive object={v.group} rotation-y={turn} scale={ASTRA_SCALE.lab} />;
}

/** Lander: ASTRA's lander (the whole craft lifts off on day 7: Lander.tsx moves its group). */
export function AstraLander({ turn }: { turn: number }) {
  const g = useMemo(() => {
    const l = buildLander('moon');
    l.name = 'astra_lander';
    finalize(l);
    bake(l, { keep: [], live: l.userData.beacon ? [l.userData.beacon as THREE.Material] : [] });
    return l;
  }, []);
  useFrame(() => {
    const b = g.userData.beacon as THREE.MeshStandardMaterial | undefined;
    if (b) b.emissiveIntensity = (performance.now() / 1667) % 1 < 0.1 ? 5 : 0.15;
  });
  return <primitive object={g} rotation-y={turn} scale={ASTRA_SCALE.lander} />;
}

/** ASTRA's hexagonal landing/build pads under the buildings (`size` = width in metres). */
export function AstraPads({ pads }: { pads: { x: number; z: number; size: number; turn?: number }[] }) {
  // all pads in one group, baked together: a handful of draw calls for every pad on the base
  const all = useMemo(() => {
    const root = new THREE.Group();
    for (const d of pads) {
      const size = padSize(d.x, d.z) ?? d.size;
      const p = buildPad('moon', 'base');
      finalize(p);
      p.position.set(d.x, 0.005, d.z);
      p.rotation.y = d.turn ?? 0;
      p.scale.setScalar(size / 5.7);
      root.add(p);
    }
    bake(root, { keep: [], live: [] });
    root.name = 'astra_pads';
    return root;
  }, [pads]);
  return <primitive object={all} />;
}

/** A pad under a building of the layout takes that building's size (layout.ts PAD: it grew with the buildings). */
function padSize(x: number, z: number): number | undefined {
  for (const k of Object.keys(PAD) as (keyof typeof PAD)[]) {
    const [bx, bz] = LAYOUT[k];
    if (Math.abs(bx - x) < 0.01 && Math.abs(bz - z) < 0.01) return PAD[k];
  }
  return undefined;
}

/**
 * One step further for phones: after the base is on screen, the plain paints of every ASTRA building (already
 * baked per building) merge across buildings into one mesh per finish. The originals stay in their buildings,
 * hidden: taps still hit them (three's raycaster does not skip hidden meshes), so each building keeps its own
 * tap. Left alone: what moves (lander, scout, solar wings, fans, the habitat's shield) and live materials.
 */
export function AstraMerge() {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const roots: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (o.name.startsWith('astra_') && o.name !== 'astra_lander' && o.name !== 'astra_scout' && o.name !== 'astra_merged') roots.push(o);
    });
    const merged = mergeWorld(roots);
    merged.name = 'astra_merged';
    scene.add(merged);
    invalidate();
    return () => {
      merged.removeFromParent();
      merged.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      for (const r of roots) r.traverse((o) => o.userData.mergedAway && ((o.visible = true), (o.userData.mergedAway = false)));
    };
  }, [scene, invalidate]);
  return null;
}
