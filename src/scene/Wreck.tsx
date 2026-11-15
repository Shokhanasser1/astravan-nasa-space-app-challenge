import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { box, cyl, finalize, metal, paint, rbox, rubber } from '../vendor/astra/scene/kit';
import { addDetail, DETAIL } from '../vendor/astra/scene/surface';
import { buildLander } from '../vendor/astra/scene/models/site';
import { bake } from './astra/bake';
import { ASTRA_SCALE } from './layout';
import { groundHeight } from './ground';
import { WRECK, WRECK_LIGHT, WRECK_ROVER } from './crash';

/**
 * The crash site of Day 1 (home story T2, src/scene/crash.ts): a copy of the base's lander tipped ~35° on its side,
 * scorched and dusty, a red light pulsing on it, and a scout rover upside down beside it, wheels to the sky.
 *
 * Cheap on a phone: no new model and no draw call of its own but the red light. The lander is ASTRA's own builder
 * (the base's lander), the rover a few of ASTRA's shapes in its scout's paints (its real scout is ~74k triangles);
 * their paints are made plain (a wreck needs no lettering, foil or glass) and baked like ASTRA's buildings
 * (src/scene/astra/bake.ts). The root is named `astra_wreck`, so AstraMerge folds it into the base's merged paints.
 * Hitboxes: src/walk/world.ts (crash.ts wreckSolids).
 */
const SCORCH = 0.72; // the paints a little darker: soot and dust
const GLASS = new THREE.Color('#262a31'); // broken windows
const RED = new THREE.Color('#ff3b3b').multiplyScalar(3); // past the bloom threshold
const RED_LOW = new THREE.Color('#5a1010');

/** Every material of a copy → a new plain paint of its colour (never the shared ASTRA materials themselves). */
function plainify(root: THREE.Object3D, beacon?: THREE.Material): void {
  const made = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const drop: THREE.Object3D[] = [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const src = mesh.material as THREE.MeshStandardMaterial;
    // the soft contact patch would stand tipped in the air; the tiny beacon ball gives way to the red light
    if (src.userData?.blob || src === beacon) {
      drop.push(mesh);
      return;
    }
    let m = made.get(src);
    if (!m) {
      const color = src.transparent ? GLASS.clone() : (src.color?.clone() ?? new THREE.Color('#9aa0a8')).multiplyScalar(src.map ? 0.6 : SCORCH);
      // One dusty matte finish for every part (ASTRA's paint detail, front faces): the baked wreck is then a single
      // finish that AstraMerge joins with the base's own matte paint (same finish = same draw call). Metal and foil
      // shine would each have been a finish, and a draw call, of their own.
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05 });
      addDetail(m, DETAIL.paint);
      made.set(src, m);
    }
    mesh.material = m;
  });
  for (const o of drop) o.removeFromParent();
}

/** A scout rover in ASTRA's shapes and its scout's paints: the electronics box, the belly pan, six wheels, the mast. */
function buildRover(): THREE.Group {
  const g = new THREE.Group();
  const white = paint('#eceef1', 0.48, 0.08);
  const dark = paint('#2a2e35', 0.55, 0.35);
  const alu = metal('#c6cbd2', 0.3);
  const tyre = rubber();
  rbox(g, 1.3, 0.5, 1.82, 0.05, white, 0, 0.98, 0);
  box(g, 1.22, 0.06, 1.7, dark, 0, 0.7, 0);
  for (const s of [-1, 1]) {
    box(g, 0.07, 0.09, 1.9, alu, s * 0.8, 0.62, 0); // the rocker
    for (const z of [-0.72, 0, 0.72]) cyl(g, 0.3, 0.3, 0.2, tyre, s * 0.92, 0.32, z, 14).rotation.z = Math.PI / 2;
  }
  // the camera mast, bent over in the crash
  const mast = cyl(g, 0.03, 0.03, 0.85, alu, 0.38, 1.5, -0.75, 8);
  mast.rotation.x = -0.9;
  rbox(g, 0.32, 0.16, 0.14, 0.03, white, 0.38, 1.72, -1.1);
  finalize(g);
  plainify(g);
  bake(g, { keep: [], live: [] });
  return g;
}

function buildWreck(): { root: THREE.Group; light: THREE.Mesh } {
  const lander = buildLander('moon');
  finalize(lander);
  plainify(lander, lander.userData.beacon as THREE.Material | undefined);
  bake(lander, { keep: [], live: [] });
  lander.scale.setScalar(ASTRA_SCALE.lander);

  // the red light, on the lander's mast in its own frame (so it tips with it)
  const light = new THREE.Mesh(new THREE.SphereGeometry(0.16 / ASTRA_SCALE.lander, 12, 8), new THREE.MeshBasicMaterial({ color: RED, toneMapped: false }));
  light.position.set(...WRECK_LIGHT);
  light.name = 'wreck_light';
  lander.add(light);

  // tipped toward its lean (+z of the turned frame), base sunk into the ground
  const tilt = new THREE.Group();
  tilt.rotation.x = WRECK.tilt;
  tilt.add(lander);
  const ship = new THREE.Group();
  ship.position.set(WRECK.x, groundHeight(WRECK.x, WRECK.z) - WRECK.sink, WRECK.z);
  ship.rotation.y = WRECK.yaw;
  ship.add(tilt);

  // the rover upside down and a little on its side, its roof in the dust
  const rover = buildRover();
  const flip = new THREE.Group();
  flip.rotation.z = Math.PI - 0.22;
  flip.add(rover);
  const car = new THREE.Group();
  car.position.set(WRECK_ROVER.x, groundHeight(WRECK_ROVER.x, WRECK_ROVER.z) + 1.12, WRECK_ROVER.z);
  car.rotation.y = WRECK_ROVER.yaw;
  car.add(flip);

  const root = new THREE.Group();
  root.name = 'astra_wreck'; // (AstraMerge: merged with the base's paints)
  root.add(ship, car);
  return { root, light };
}

export function Wreck() {
  const { root, light } = useMemo(buildWreck, []);
  useEffect(
    () => () => {
      light.geometry.dispose();
      (light.material as THREE.Material).dispose();
    },
    [light],
  );
  // a slow distress pulse (one every 1.6 s, soft, never a hard flash); only while frames are drawn, like the base
  // lander's beacon
  useFrame(({ clock }) => {
    const k = Math.max(0, Math.sin((clock.elapsedTime / 1.6) * Math.PI * 2)) ** 2;
    (light.material as THREE.MeshBasicMaterial).color.copy(RED_LOW).lerp(RED, k);
  });
  return <primitive object={root} />;
}
