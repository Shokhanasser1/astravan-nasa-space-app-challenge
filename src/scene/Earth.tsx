import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { View } from '../state/game';

/**
 * Earth over the ridge (concept 3.0 §03): 1.9° across, where JPL Horizons puts it for this day (view.earthElDeg,
 * src/engine/sky.json; toward lunar longitude 0 = +z), wrapped in the NASA GIBS true-colour picture of that very day
 * (public/data/media/<week>/earth-<date>.webp), lit by the same Sun, so its phase comes out right by itself.
 * Not drawn when the day has no sky data. The terrain hides it when it is below the real skyline.
 */
const DIST = 2300; // m: behind the real skyline (pulled in to ≤ 1.95 km), in front of the stars (2.4 km)
const RADIUS = DIST * Math.tan(THREE.MathUtils.degToRad(1.9 / 2));

export function Earth({ view }: { view: View }) {
  const invalidate = useThree((s) => s.invalidate);
  const [map, setMap] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!view.weekId || !view.mediaDate) return;
    let alive = true;
    const url = `${import.meta.env.BASE_URL}data/media/${view.weekId}/earth-${view.mediaDate}.webp`;
    new THREE.TextureLoader().load(
      url,
      (t) => {
        if (!alive) {
          t.dispose();
          return;
        }
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        setMap(t);
        invalidate();
      },
      undefined,
      () => {
        // no picture for this week: the plain Earth below
      },
    );
    return () => {
      alive = false;
    };
  }, [view.weekId, view.mediaDate, invalidate]);
  useEffect(() => () => map?.dispose(), [map]);

  if (view.earthElDeg === undefined) return null;
  const el = THREE.MathUtils.degToRad(view.earthElDeg);
  return (
    <mesh position={[0, Math.sin(el) * DIST, Math.cos(el) * DIST]} rotation-y={Math.PI}>
      <sphereGeometry args={[RADIUS, 48, 24]} />
      <meshStandardMaterial key={map ? 'map' : 'plain'} map={map} color={map ? '#ffffff' : '#3d6fb8'} roughness={0.85} metalness={0} />
    </mesh>
  );
}
