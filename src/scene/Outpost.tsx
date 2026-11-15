import { Component, Suspense, useMemo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import type * as THREE from 'three';
import { MODULES, OUTPOST, TUNNELS, moduleY, type ModuleName } from './outpostSite';

/**
 * The HDU outpost (`?outpost`, src/scene/outpostSite.ts): one GLB with three NASA HDU modules and two tunnels, exterior
 * only, 20k triangles. Each module sits on the ground under its own centre, each tunnel halfway between the two
 * modules it joins (the GLB keeps one node per part: gltf-transform with --join false --flatten false). Loads on its
 * own after the base; if it fails it is simply not shown.
 */
const file = `${import.meta.env.BASE_URL}models/nasa-outpost/outpost.glb`;

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const NAMES = Object.keys(MODULES) as ModuleName[];

function Model() {
  const { scene } = useGLTF(file, false, true);
  const base = moduleY('A_habitat');
  const obj = useMemo(() => {
    const o = scene.clone(true);
    for (const n of o.children) {
      const mod = NAMES.find((m) => n.name.startsWith(m));
      const tun = TUNNELS[n.name];
      if (mod) n.position.y += moduleY(mod) - base;
      else if (tun) n.position.y += (moduleY(tun[0]) + moduleY(tun[1])) / 2 - base;
      n.traverse((m) => {
        if ((m as THREE.Mesh).isMesh) {
          m.castShadow = n.name.includes('shell'); // only the big bodies cast
          m.receiveShadow = true;
        }
      });
    }
    return o;
  }, [scene, base]);
  return <primitive object={obj} position={[OUTPOST.x, base, OUTPOST.z]} rotation-y={OUTPOST.yaw} />;
}

export function Outpost() {
  return (
    <Quiet>
      <Suspense fallback={null}>
        <Model />
      </Suspense>
    </Quiet>
  );
}
