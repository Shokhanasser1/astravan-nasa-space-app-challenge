import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { LAYOUT } from '../layout';
import { launchState } from '../anim';
import { GLOW, MAT } from './materials';
import type { TapHandler } from './tap';

const LEGS = [0, 1, 2, 3].map((i) => (i * Math.PI) / 2 + Math.PI / 4);
const RISE_S = 3; // launch: ~3 s of lift-off, then it keeps climbing out of view
const DUST_S = 2.5;

/** Lander → Launch (Day 7). Engine glows when it has batteries; in the launch phase it lifts off with a dust ring. */
export function Lander({ on, phase, tap }: { on: boolean; phase: string; tap: TapHandler }) {
  const [x, z] = LAYOUT.lander;
  const body = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Mesh>(null);
  const t0 = useRef(-1);
  const flying = phase === 'launch' || phase === 'truth';

  useFrame((state) => {
    const g = body.current;
    const d = dust.current;
    if (!g || !d) return;
    let h = 0;
    let t = 0;
    if (flying) {
      if (t0.current < 0) t0.current = state.clock.elapsedTime;
      t = phase === 'truth' ? 99 : state.clock.elapsedTime - t0.current;
      h = t < RISE_S ? 30 * (t / RISE_S) ** 2 : 30 + 20 * (t - RISE_S);
    } else {
      t0.current = -1;
    }
    g.position.y = h;
    g.visible = h < 400;
    launchState.h = h;
    const k = Math.min(1, t / DUST_S);
    d.visible = flying && k < 1;
    d.scale.setScalar(1 + 7 * k);
    (d.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    if (flying && h < 120) {
      state.gl.shadowMap.needsUpdate = true; // the lander's shadow follows it while it is close to the ground
      state.invalidate();
    }
  });

  return (
    <group position={[x, 0, z]}>
      <group ref={body} onClick={tap}>
        <Instances limit={4} material={MAT.panel} frustumCulled={false}>
          <cylinderGeometry args={[0.06, 0.06, 1.6, 6]} />
          {LEGS.map((a) => (
            <Instance key={a} position={[Math.sin(a) * 1.55, 0.7, Math.cos(a) * 1.55]} rotation={[-Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45]} />
          ))}
        </Instances>
        <mesh position={[0, 1.5, 0]} material={MAT.gold} castShadow receiveShadow>
          <cylinderGeometry args={[1.2, 1.5, 1.6, 20]} />
        </mesh>
        <mesh position={[0, 2.9, 0]} material={MAT.panel} castShadow>
          <cylinderGeometry args={[0.9, 1.15, 1.2, 20]} />
        </mesh>
        <mesh position={[0, 3.8, 0]} material={MAT.panel} castShadow>
          <coneGeometry args={[0.9, 0.6, 20]} />
        </mesh>
        <mesh position={[0, 3.0, 1.06]} material={MAT.glass}>
          <planeGeometry args={[0.6, 0.4]} />
        </mesh>
        <mesh position={[0, 1.1, 1.52]} material={MAT.glass}>
          <boxGeometry args={[0.4, 1.8, 0.05]} />
        </mesh>
        <mesh position={[0, 0.55, 0]} material={on || flying ? GLOW.cableOn : GLOW.dark}>
          <cylinderGeometry args={[0.45, 0.6, 0.12, 16]} />
        </mesh>
      </group>
      <mesh ref={dust} position={[0, 0.05, 0]} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.8, 1.6, 48]} />
        <meshBasicMaterial color="#cfd2da" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
