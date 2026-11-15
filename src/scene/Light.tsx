import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { View } from '../state/game';

/**
 * Moon light, "cinematic realism" (15 Nov): one hard Sun is the key light and the sky is black, so shadows go dark.
 * Was ASTRA's studio recipe (Sun × 3, sky hemisphere × 0.4, fill × 0.25, environment × 0.42, ACES 1.32): everything
 * evenly lit, shadows lost, a plastic toy in a photo studio. Now the Sun × SUN_I, a faint hemisphere (light bounced
 * off the ground), a weak blue earthshine and a low environment only so metal and white panels keep a glint; Neutral
 * tone mapping and the exposure in Stage.tsx. The Sun stands 12° up (the developer guide's skeleton value; ASTRA's
 * Moon goes to 25°), a game rule: at the real pole it hugs the horizon (sky.json sun_el_true_deg, −2° to +1.7°).
 * `?sunel=1.5` shows the real pole light (concept 3.0: black shadows ~38× long). Shadows are recomputed once per day.
 */
const elParam = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('sunel')) : NaN;

/**
 * The one key light. Kept low on purpose (a white panel facing it stays below 1.0 in the scene's linear values) so
 * Bloom (threshold 1) catches only the glowing parts, not every sunlit wall; the exposure (Stage.tsx) brightens the
 * picture after Bloom. The other lights below are scaled to it: change all of them together.
 */
const SUN_I = 4;

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
      <directionalLight ref={sun} color="#fff4e2" intensity={SUN_I} position={position} castShadow={shadowSize > 0} />
      {/* No air, no blue sky: only light bounced off the grey ground (warm from below, near-black above) keeps the
          shadow side of things from turning into a void. */}
      <hemisphereLight args={['#8a93a8', '#5c534a', 0.1]} />
      {/* Earthshine: a weak blue light from the side away from the Sun. */}
      <directionalLight color="#8fb2ff" intensity={0.055} position={[-position.x, position.y + 80, -position.z]} />
      <SoftEnvironment intensity={0.045} />
    </>
  );
}
