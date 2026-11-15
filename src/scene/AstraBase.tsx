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
import { mergePlants, type Plants } from './astra/plants';
import { cutLabHatch, cutLanderHatch, habitatInside, hideParts, tenSidedCabin } from './astra/shellFit';
import { Interior } from './Interiors';
import { ASTRA_SCALE, HDU_HABITAT, LAYOUT, PAD } from './layout';

/**
 * The base in ASTRA's look (15 Nov, Shoxjahon aka: the best of ASTRA + the best of ours). ASTRA's procedural models
 * (src/vendor/astra, MIT, credited) replace our buildings' shells at the same footprint, so hitboxes, standing
 * points, taps and the habitat's interior stay ours. Each model is baked once (src/scene/astra/bake.ts): hundreds of
 * small meshes become a few, so phones keep their budget. Power changes only materials (ASTRA's own rule).
 */

/** Real-ish size of each ASTRA model next to the astronaut: in src/scene/layout.ts (the walk uses them too). */
export { ASTRA_SCALE };

// Phones build every curved part with half the segments (src/vendor/astra/scene/kit.ts sg): the base stays inside
// the phone budget (< 100k triangles). Computers keep ASTRA's own detail.
// A computer that draws in software (no GPU: SwiftShader, llvmpipe — also the e2e and shot.sh browsers) builds like a
// phone too, or a whole week of play crawls.
setLod(initialTier() === 'pc' && !softwareGl() ? 1 : 0.5);

/** `?lite` keeps the old shapes (comparison, or a very weak phone). With the HDU complex (`?hdu`) the base is always
 * drawn in the ASTRA look: the NASA modules never stand among grey shapes, and their doors work (Rig.tsx). */
export const astraLook =
  typeof location === 'undefined' || !new URLSearchParams(location.search).has('lite') || HDU_HABITAT;

export function astraModule(build: (v: ModuleView) => void, prep?: (g: THREE.Group, v: ModuleView) => void): ModuleView {
  const g = new THREE.Group();
  const view: ModuleView = { group: g, status: light('#3ee39a'), glow: [], spin: [], blink: [], top: 2.5 };
  build(view);
  finalize(g);
  prep?.(g, view);
  tameWhites(g);
  // The habitat's lit window panes are not kept apart (our inside view is its own room, Habitat.tsx Interior): they
  // bake into one mesh with their shared live material, one draw call for all eleven windows instead of eleven.
  const keep: THREE.Object3D[] = [...view.spin];
  if (view.yaw) keep.push(view.yaw);
  if (view.tilt) keep.push(view.tilt);
  if (view.shield) keep.push(view.shield);
  if (view.plants) keep.push(view.plants);
  const live: THREE.Material[] = [view.status, ...view.glow, ...view.blink, ...(view.bars ?? [])];
  if (view.windows) live.push(view.windows);
  bake(g, { keep, live });
  // What moves stays its own part, but its own pieces merge too (a solar wing, a fan); the shield is revealed
  // bag by bag, so it is left as it is; the plants merge their own way (one mesh that follows the garden level).
  for (const k of keep) if (k !== view.shield && k !== view.plants) bake(k, { keep: keep.filter((o) => o !== k), live });
  for (const k of keep) k.userData.moves = true; // AstraMerge leaves these alone
  if (view.plants) view.plants.userData.merged = mergePlants(view.plants);
  return view;
}

/**
 * ASTRA's white paints burned out under the old light (ACES 1.32, before the Moon light): up close the habitat was a
 * flat white wall (15 Nov). Each bright opaque paint gets a little greyer and more matte, once (materials are shared
 * between buildings), so the panels, seams and windows read again. Glass, glow and lamps are left alone.
 */
function tameWhites(g: THREE.Object3D): void {
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m || Array.isArray(m) || !m.isMeshStandardMaterial || m.transparent || m.userData.tamed) return;
    m.userData.tamed = true;
    const c = m.color;
    if (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 0.55) return; // (linear: about sRGB #c4c4c4 and brighter)
    c.multiplyScalar(0.86); // (0.72 under the old ACES 1.32 light; the Moon light and Neutral curve clip less)
    m.roughness = Math.max(m.roughness, 0.7);
    m.envMapIntensity = Math.min(m.envMapIntensity ?? 1, 0.6);
  });
}

/**
 * The habitat's windows: "cold Moon, warm home". With batteries the rooms shine amber past the bloom threshold, so
 * they halo softly; without, a dim ember below it (someone lives there, on low power) instead of ASTRA's near-black,
 * so the home still reads warm while "powered" stays plainly brighter (the gameplay signal).
 */
export const WINDOW_GLOW = { on: 4, off: 0.12 } as const;

/**
 * ASTRA's power look (World.tsx), made plainer to read from across the base (15 Nov): a powered building's lights
 * glow past the bloom threshold (0.08 + 2.6 × power, ASTRA had 1.9) and its windows shine warm (WINDOW_GLOW,
 * ASTRA 1.6); without power the lights go nearly dark (0.03), the windows dim to an ember and the status lamp turns
 * amber. Materials only: no draw calls.
 */
export function setPower(v: ModuleView, on: boolean): void {
  for (const m of v.glow) m.emissiveIntensity = on ? 0.08 + 2.6 * ((m.userData.glow as number | undefined) ?? 1) : 0.03;
  const lamp = on ? '#3ee39a' : '#ffb340';
  v.status.color.set(lamp);
  v.status.emissive.set(lamp);
  v.status.emissiveIntensity = on ? 1.4 : 0.4;
  if (v.windows) v.windows.emissiveIntensity = on ? WINDOW_GLOW.on : WINDOW_GLOW.off;
  const glazing = v.group.userData.glazing as THREE.MeshPhysicalMaterial[] | undefined;
  for (const m of glazing ?? []) m.emissiveIntensity = on ? 0.9 : 0;
}

/** The greenhouse's glazing gets its own copy of ASTRA's shared glass, lit pink by the grow lights when powered. */
function ownGlazing(g: THREE.Object3D): void {
  const copies = new Map<THREE.Material, THREE.MeshPhysicalMaterial>();
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    const mat = m.material as THREE.MeshPhysicalMaterial | undefined;
    if (!m.isMesh || !mat || Array.isArray(mat) || !mat.isMeshPhysicalMaterial || !mat.transparent) return;
    let c = copies.get(mat);
    if (!c) {
      c = mat.clone();
      c.emissive.set('#ff9fe0');
      c.emissiveIntensity = 0;
      copies.set(mat, c);
    }
    m.material = c;
  });
  g.userData.glazing = [...copies.values()];
}

/** Spinning parts turn while the building works (only while frames are drawn: a calm scene is not redrawn for it). */
function useSpin(v: ModuleView, on: boolean, rate: number) {
  useFrame((_, dt) => {
    if (!on) return;
    for (const s of v.spin) s.rotation.y += Math.min(dt, 0.05) * rate;
  });
}

const mid = new THREE.Vector3();

/**
 * Greenhouse (interiors/greenhouse/HANDOFF.md): its troughs, LED bars and door panel; not its glass or ribs, and not
 * its plants (they show the garden level, view.plant).
 */
function greenhouseInside(g: THREE.Group, v: ModuleView) {
  const plants = v.plants;
  const isPlant = (o: THREE.Object3D | null): boolean => (o === null ? false : o === plants || isPlant(o.parent));
  hideParts(g, (b, c, m) => {
    if (plants && isPlant(m)) return false;
    if (c === 'dff3ff' || (m.material as THREE.Material).transparent) {
      // the east cap glass: the new doorway goes through it (16 % opaque, barely missed)
      return b.max.x - b.min.x < 0.02 && b.getCenter(mid).x > 2.1;
    }
    if (c === 'd5dae2') return false; // ribs, stringers, cap frames
    b.getCenter(mid);
    const inA = mid.x > -2.2 && mid.x < 2.05 && mid.y > 0.24 && mid.y < 1.7 && Math.abs(mid.z) < 0.95;
    const inB = mid.x > 2.17 && mid.x < 2.4 && mid.y > 0.21 && mid.y < 1.54 && Math.abs(mid.z) < 0.46;
    return inA || inB;
  });
}

/** Turn a model so that its front (+z) faces the middle of the base. */
export const faceCentre = (x: number, z: number) => Math.atan2(-x, -z);

/** Habitat → Life Support: ASTRA's inflatable habitat; its regolith shield grows with the wall level (0–3). */
export function AstraHabitat({ on, wall, turn }: { on: boolean; wall: number; turn: number }) {
  const v = useMemo(() => astraModule((m) => buildHabitat(m, 'moon'), habitatInside), []);
  v.group.name = 'astra_hab';
  setPower(v, on);
  v.shieldProgress?.(Math.max(0, Math.min(1, wall / 3)));
  return (
    <>
      <primitive object={v.group} rotation-y={turn} scale={ASTRA_SCALE.habitat} />
      <group rotation-y={turn} scale={ASTRA_SCALE.habitat}>
        <Interior id="habitat" />
      </group>
    </>
  );
}

/**
 * Garden: ASTRA's greenhouse, grow lights on with batteries; its plants show the garden level (view.plant 0–4).
 * Samandar's furnished interior replaces ASTRA's troughs and LED bars inside; ASTRA's plants stay, they are the level.
 */
export function AstraGreenhouse({ on, turn, plant }: { on: boolean; turn: number; plant: number }) {
  const v = useMemo(() => {
    const m = astraModule(buildGreenhouse, greenhouseInside);
    ownGlazing(m.group);
    return m;
  }, []);
  v.group.name = 'astra_greenhouse';
  setPower(v, on);
  (v.plants?.userData.merged as Plants | undefined)?.setLevel(plant);
  useSpin(v, on, 3);
  return (
    <>
      <primitive object={v.group} rotation-y={turn} scale={ASTRA_SCALE.greenhouse} />
      <group rotation-y={turn} scale={ASTRA_SCALE.greenhouse}>
        <Interior id="greenhouse" />
      </group>
    </>
  );
}

/** Workshop: ASTRA's lab module (its decorative west hatch cut away: our interior's real hatch opens there). */
export function AstraLab({ on, turn }: { on: boolean; turn: number }) {
  const v = useMemo(() => astraModule(buildLab, (g) => void cutLabHatch(g)), []);
  v.group.name = 'astra_lab';
  setPower(v, on);
  useSpin(v, on, 0.4);
  return (
    <>
      <primitive object={v.group} rotation-y={turn} scale={ASTRA_SCALE.lab} />
      <group rotation-y={turn} scale={ASTRA_SCALE.lab}>
        <Interior id="lab" />
      </group>
    </>
  );
}

/** Lander: ASTRA's lander (the whole craft lifts off on day 7: Lander.tsx moves its group). */
export function AstraLander({ turn }: { turn: number }) {
  const g = useMemo(() => {
    const l = buildLander('moon');
    l.name = 'astra_lander';
    tenSidedCabin(l); // phones too: our cabin fits ASTRA's 10-sided one, not the 6-sided phone build (shellFit.ts)
    finalize(l);
    cutLanderHatch(l); // ASTRA's decorative hatch off the cabin: our interior's real hatch opens there
    bake(l, { keep: [], live: l.userData.beacon ? [l.userData.beacon as THREE.Material] : [] });
    return l;
  }, []);
  useFrame(() => {
    const b = g.userData.beacon as THREE.MeshStandardMaterial | undefined;
    if (b) b.emissiveIntensity = (performance.now() / 1667) % 1 < 0.1 ? 5 : 0.15;
  });
  return (
    <>
      <primitive object={g} rotation-y={turn} scale={ASTRA_SCALE.lander} />
      <group rotation-y={turn} scale={ASTRA_SCALE.lander}>
        <Interior id="lander" />
      </group>
    </>
  );
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
