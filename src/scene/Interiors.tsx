import { Component, Suspense, useMemo, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { camState } from './anim';

/**
 * Building interiors (local preview, 15 Nov): furnished insides made in Blender from NASA references
 * (~/dev/oy-karvonsaroyi-3d/hb7/interiors/<b>/: build script, SOURCES.md, HANDOFF.md). Each GLB is in ASTRA's model
 * frame at native metres, so it sits in the same group transform as its ASTRA shell (AstraBase.tsx: rotation-y and
 * ASTRA_SCALE) and fits inside it. Drawn only when it can be seen, to keep phones in budget: the habitat's from its
 * inside point, the others while the camera is near (through glass and windows).
 */
export type InteriorId = 'habitat' | 'greenhouse' | 'lab' | 'lander';

const base = `${import.meta.env.BASE_URL}models/interiors/`;
/** Drawn while the camera is this close to the building (metres in the game); the habitat only from inside. */
const NEAR: Record<InteriorId, number> = { habitat: 0, greenhouse: 16, lab: 10, lander: 10 };

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const at = new THREE.Vector3();

function Model({ id }: { id: InteriorId }) {
  const { scene } = useGLTF(`${base}${id}.glb`, false, true);
  const camera = useThree((s) => s.camera);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        m.castShadow = false; // inside a shell: the shell casts the shadow
        m.receiveShadow = false;
      }
    });
    o.visible = false;
    return o;
  }, [scene]);
  useFrame(() => {
    if (id === 'habitat') {
      obj.visible = camState.inside;
      return;
    }
    obj.getWorldPosition(at);
    obj.visible = at.distanceTo(camera.position) < NEAR[id];
  });
  return <primitive object={obj} />;
}

/** The interior of one building; put it in the same transform as the ASTRA shell. Missing or failing: not shown. */
export function Interior({ id }: { id: InteriorId }) {
  return (
    <Quiet>
      <Suspense fallback={null}>
        <Model id={id} />
      </Suspense>
    </Quiet>
  );
}
