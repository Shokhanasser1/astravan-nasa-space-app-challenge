import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../state/store';
import { QUALITY } from './quality';

/**
 * Light recipe (concept 3.0, section 03): one Sun just above the horizon, almost no ambient light
 * (no air to scatter it), long black shadows. Shadows are recomputed once per day, not every frame.
 * Check: a greyscale screenshot should show three tones — black sky/shadows, grey ground, white Sun and edges.
 */
const SUN_EL_DEG = 1.5; // game rule (real elevation that week was ~0.7° on the geometric horizon)

export function SunLight() {
  const sun = useRef<THREE.DirectionalLight>(null);
  const gl = useThree((s) => s.gl);
  const day = useGame((s) => s.game?.day ?? 1);
  const week = useGame((s) => s.week?.id);
  const skyDays = useGame((s) => (week && s.sky ? s.sky.weeks[week] : undefined));
  const quality = useGame((s) => s.settings.quality);

  const azDeg = skyDays?.find((d) => d.day === Math.min(day, 7))?.sun_az_deg ?? 268;
  const position = useMemo(() => {
    const az = THREE.MathUtils.degToRad(azDeg);
    const el = THREE.MathUtils.degToRad(SUN_EL_DEG);
    return new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(400);
  }, [azDeg]);

  useEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.shadowMap.autoUpdate = false;
  }, [gl]);

  // New day or new quality tier → recompute the shadow map once.
  useEffect(() => {
    const light = sun.current;
    if (!light) return;
    const size = QUALITY[quality].shadow;
    light.shadow.mapSize.set(size, size);
    light.shadow.map?.dispose();
    light.shadow.map = null;
    Object.assign(light.shadow.camera, { left: -150, right: 150, top: 40, bottom: -40, far: 900 });
    light.shadow.camera.updateProjectionMatrix();
    gl.shadowMap.needsUpdate = true;
  }, [position, quality, gl]);

  return (
    <>
      <directionalLight ref={sun} color={0xfff1dc} intensity={6} position={position} castShadow />
      {/* Earthshine: very faint blue. Do not raise above 0.06 or the shadows turn grey. */}
      <hemisphereLight args={[0x2a3f66, 0x000000, 0.06]} />
    </>
  );
}
