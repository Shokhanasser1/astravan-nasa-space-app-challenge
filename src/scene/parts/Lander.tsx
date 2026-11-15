import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Instance, Instances } from '@react-three/drei';
import * as THREE from 'three';
import { ASTRA_SCALE, LAYOUT, RADIUS } from '../layout';
import { launchState } from '../anim';
import { GLOW, MAT } from './materials';
import type { TapHandler } from './tap';
import { Shell, type NodeRef } from '../models/Shell';
import { lift } from '../models/kit';
import { AstraLander, astraLook, faceCentre } from '../AstraBase';
import { LIFTOFF_DELAY_S } from '../boarding';
import { features } from '../../config/features';
import { FX_HOLD, liftHeight } from '../launchFx';
import { LaunchFx, type LaunchFxApi } from './LaunchFx';

const LEGS = [0, 1, 2, 3].map((i) => (i * Math.PI) / 2 + Math.PI / 4);
const DUST_S = 2.5;
/** Plume, ground glow and regolith blast (LaunchFx.tsx); off → the old grey dust ring. */
const launchFx = features.launchFx;
/** Where the flame starts: just inside ASTRA's engine bell (its exit at 0.55 m model), or the grey shapes' lamp. */
const NOZZLE_Y = astraLook ? 0.6 * ASTRA_SCALE.lander : 0.5;

/**
 * Lander → Launch (Day 7). Engine glows when it has batteries; in the launch phase it lifts off with a plume and a
 * regolith blast (features.launchFx, LaunchFx.tsx; off → a dust ring) —
 * home story: once the astronaut is on board (LIFTOFF_DELAY_S, src/scene/boarding.ts). `grounded`: it did not fly
 * (home story, Late Ride Home), so the truth screen keeps it on the ground.
 */
export function Lander({ on, phase, tap, grounded = false }: { on: boolean; phase: string; tap: TapHandler; grounded?: boolean }) {
  const [x, z] = LAYOUT.lander;
  const body = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Mesh>(null);
  const t0 = useRef(-1);
  const top = useRef<THREE.Object3D | null>(null); // NASA model: the ascent stage (lander_body); null = grey shapes
  const nodes = useRef<Record<string, NodeRef>>({ lander_body: top }).current;
  const flying = (phase === 'launch' || phase === 'truth') && !grounded;
  const fx = useRef<LaunchFxApi>(null);

  useFrame((state) => {
    const g = body.current;
    const d = dust.current;
    if (!g || (!d && !launchFx)) return;
    let h = 0;
    let t = 0;
    if (flying) {
      if (t0.current < 0) t0.current = state.clock.elapsedTime;
      t = phase === 'truth' ? 99 : FX_HOLD ?? state.clock.elapsedTime - t0.current - LIFTOFF_DELAY_S;
      h = liftHeight(t);
    } else {
      t0.current = -1;
    }
    const lm = top.current;
    if (lm) {
      // Model: only the ascent stage lifts off; the descent stage (lander_base) and the engine lamp stay.
      lift(lm, h);
      lm.visible = h < 400;
      g.position.y = 0;
      g.visible = true;
    } else {
      g.position.y = h;
      g.visible = h < 400;
    }
    launchState.h = h;
    if (d) {
      const k = Math.min(1, Math.max(0, t) / DUST_S);
      d.visible = flying && t >= 0 && k < 1;
      d.scale.setScalar(1 + 7 * k);
      (d.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - k);
    }
    const fxOn = fx.current?.update(t, h, flying) ?? false;
    if (flying && h < 120) state.gl.shadowMap.needsUpdate = true; // the lander's shadow follows it while it is low
    if ((flying && h < 120) || fxOn) state.invalidate();
  });

  return (
    <group position={[x, 0, z]}>
      <group ref={body} onClick={tap}>
        {astraLook ? (
          <AstraLander turn={faceCentre(x, z)} />
        ) : (
        <group scale={RADIUS.lander / 1.6}>
        <Shell
          name="lander"
          nodes={nodes}
          grey={
            <>
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
            </>
          }
        />
        </group>
        )}
        <mesh position={[0, 0.55, 0]} material={on || flying ? GLOW.cableOn : GLOW.dark}>
          <cylinderGeometry args={[0.45, 0.6, 0.12, 16]} />
        </mesh>
      </group>
      {launchFx ? (
        <LaunchFx ref={fx} nozzleY={NOZZLE_Y} top={top} />
      ) : (
        <mesh ref={dust} position={[0, 0.05, 0]} rotation-x={-Math.PI / 2} visible={false}>
          <ringGeometry args={[0.8, 1.6, 48]} />
          <meshBasicMaterial color="#cfd2da" transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
