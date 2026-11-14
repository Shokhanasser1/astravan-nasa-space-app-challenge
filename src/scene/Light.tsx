import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Light recipe from concept 3.0, section 03 (newer than the skeleton values in the developer guide §04).
 * One Sun hugging the horizon (1.5°, a game rule), almost no ambient light (no air), long black shadows.
 * Shadows are recomputed once per day, not every frame.
 * Check: a greyscale screenshot shows three tones only — black sky/shadows, grey ground, white Sun and edges.
 * Skeleton values for comparison: Sun ~11°, intensity 4.2 #FFF4E0, ambient 0.035, ground bounce 0.09, Earth fill 0.32.
 */
const SUN_EL_DEG = 1.5;

export function Light({ sunAzDeg = 268, shadowSize }: { sunAzDeg?: number; shadowSize: number }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const gl = useThree((s) => s.gl);

  const position = useMemo(() => {
    const az = THREE.MathUtils.degToRad(sunAzDeg);
    const el = THREE.MathUtils.degToRad(SUN_EL_DEG);
    return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(400);
  }, [sunAzDeg]);

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
    // Shadows are ~38× longer than objects at 1.5°: the shadow camera must be wide (±150 m).
    Object.assign(light.shadow.camera, { left: -150, right: 150, top: 40, bottom: -40, near: 1, far: 900 });
    light.shadow.camera.updateProjectionMatrix();
    gl.shadowMap.needsUpdate = true;
  }, [position, shadowSize, gl]);

  return (
    <>
      <color attach="background" args={['#020308']} />
      <directionalLight ref={sun} color="#fff1dc" intensity={6} position={position} castShadow={shadowSize > 0} />
      {/* Earthshine: very faint blue. Do not raise above 0.06 or shadows turn grey. */}
      <hemisphereLight args={['#2a3f66', '#000000', 0.06]} />
    </>
  );
}
