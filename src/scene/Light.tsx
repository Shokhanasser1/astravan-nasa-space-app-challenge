import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { View } from '../state/game';

/**
 * Light in ASTRA's look (15 Nov, Shoxjahon aka: "the whole game with the graphics of that repo"; ASTRA World.tsx,
 * Moon: Sun #fff4e2 × 3, sky hemisphere #b9c6ff/#2a2a30 × 0.4, cool fill × 0.25, ACES exposure 1.32, a soft
 * environment × 0.42). The Sun stands 12° up (the developer guide's skeleton value; ASTRA's Moon goes to 25°), a game
 * rule: at the real pole it hugs the horizon (sky.json sun_el_true_deg, −2° to +1.7°). `?sunel=1.5` shows the real
 * pole light (concept 3.0: black shadows ~38× long). Shadows are recomputed once per day, not every frame.
 */
const elParam = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('sunel')) : NaN;
export const SUN_EL_DEG = Number.isFinite(elParam) && elParam > 0 && elParam < 60 ? elParam : 12;

/** Sun azimuth of the day: sky.json, or ~12° a day when the week has no entry (developer guide §03). */
export const sunAzimuth = (view: View): number => view.sunAzDeg ?? 268 + 12 * (view.day - 1);

/** Unit vector toward the Sun: azimuth from +Z (lunar longitude 0, toward Earth) through +X, elevation 1.5°. */
export function sunDirection(azDeg: number, out: THREE.Vector3): THREE.Vector3 {
  const az = THREE.MathUtils.degToRad(azDeg);
  const el = THREE.MathUtils.degToRad(SUN_EL_DEG);
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

/** A soft studio environment made in code (three's RoomEnvironment through PMREM): reflections and fill, no file. */
function SoftEnvironment({ intensity }: { intensity: number }) {
  const { gl, scene } = useThree((s) => ({ gl: s.gl, scene: s.scene }));
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    room.dispose();
    pmrem.dispose();
    return () => {
      if (scene.environment === env) scene.environment = null;
      env.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
}

export function Light({ sunAzDeg = 268, shadowSize }: { sunAzDeg?: number; shadowSize: number }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const gl = useThree((s) => s.gl);

  const position = useMemo(() => sunDirection(sunAzDeg, new THREE.Vector3()).multiplyScalar(400), [sunAzDeg]);

  useEffect(() => {
    gl.shadowMap.enabled = shadowSize > 0;
    gl.shadowMap.autoUpdate = false;
  }, [gl, shadowSize]);

  // New day (Sun moved) or new tier → recompute the shadow map once.
  useEffect(() => {
    const light = sun.current;
    if (!light || shadowSize === 0) return;
    light.shadow.mapSize.set(shadowSize, shadowSize);
    light.shadow.map?.dispose();
    light.shadow.map = null;
    light.shadow.bias = -0.0005;
    light.shadow.normalBias = 0.04;
    // Shadow length = height / tan(elevation): ~38× at 1.5°, ~5× at 12°. The camera covers the base and its shadows.
    const long = Math.min(150, 12 + 40 / Math.tan(THREE.MathUtils.degToRad(SUN_EL_DEG)) / 8);
    Object.assign(light.shadow.camera, { left: -long, right: long, top: 40, bottom: -40, near: 1, far: 900 });
    light.shadow.camera.updateProjectionMatrix();
    gl.shadowMap.needsUpdate = true;
  }, [position, shadowSize, gl]);

  return (
    <>
      <color attach="background" args={['#020308']} />
      <directionalLight ref={sun} color="#fff4e2" intensity={3} position={position} castShadow={shadowSize > 0} />
      {/* ASTRA's Moon: a cool sky hemisphere and a faint fill from the side away from the Sun. */}
      <hemisphereLight args={['#b9c6ff', '#2a2a30', 0.4]} />
      <directionalLight color="#8fb2ff" intensity={0.25} position={[-position.x, position.y + 80, -position.z]} />
      <SoftEnvironment intensity={0.42} />
    </>
  );
}
