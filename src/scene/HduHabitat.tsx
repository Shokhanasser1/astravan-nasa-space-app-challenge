import { Component, Suspense, useMemo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import type * as THREE from 'three';
import { RADIUS } from './layout';
import { Interior } from './Interiors';
import { Sandbags } from './parts/Sandbags';

/**
 * Habitat → Life Support as NASA's Habitat Demonstration Unit at 1.5x (`?hdu`, layout.ts HDU_HABITAT; 15 Nov,
 * Samandar): the HDU's cylinder and loft dome from NASA 3D Resources (logos painted out, the side module and airlock
 * bulb left off so it keeps the ASTRA habitat's 3.15 m footprint, a door cut at its front), the furnished walk-in
 * interior in game metres (public/models/interiors/hdu_habitat.glb: eight sections, crew loft, ladder; scale 1), and
 * our sandbag rings for the wall level (ASTRA's own regolith shield belonged to its model).
 * Built by oy-karvonsaroyi-3d/hb7/hdu_base/build_game_habitat.py.
 */
const file = `${import.meta.env.BASE_URL}models/nasa-outpost/hdu_habitat.glb`;

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function Shell({ turn }: { turn: number }) {
  const { scene } = useGLTF(file, false, true);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return o;
  }, [scene]);
  return <primitive object={obj} rotation-y={turn} />;
}

export function HduHabitat({ wall, turn }: { wall: number; turn: number }) {
  return (
    <>
      <Quiet>
        <Suspense fallback={null}>
          <Shell turn={turn} />
        </Suspense>
      </Quiet>
      <group rotation-y={turn}>
        <Interior id="habitat" />
      </group>
      <Sandbags wall={wall} radius={RADIUS.habitat} />
    </>
  );
}
