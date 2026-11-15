import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useObjective, type ObjectiveTarget } from '../state/objective';
import { LAYOUT, RADIUS, fromDoor } from './layout';
import { groundHeight } from './ground';
import { socketSpot } from './Batteries';

/**
 * The objective beacon (15 Nov): a soft vertical beam and a bobbing arrow over the place the current task points at
 * (src/state/objective.ts, written by the HUD). A machine's beacon stands at its battery rack — where the astronaut
 * has to stand — the hub's at the hub, 'door' at the habitat door, 'ladder' at the lander's rack. It pulses faster
 * when the player has been idle. Two meshes (two draw calls) only while there is a target; nothing otherwise.
 */
const BEAM_H = 7;
const ARROW_Y = 2.3;

function spot(t: ObjectiveTarget): [number, number] | null {
  switch (t) {
    case null:
      return null;
    case 'hub':
      return [LAYOUT.hub[0], LAYOUT.hub[1]];
    case 'door':
      return fromDoor(RADIUS.habitat + 0.5);
    case 'ladder': {
      const s = socketSpot('launch', 0.6);
      return [s.x, s.z];
    }
    default: {
      const s = socketSpot(t);
      return [s.x, s.z];
    }
  }
}

/** An open cylinder whose vertex alpha fades from the ground up (RGBA vertex colours). */
function beamGeometry() {
  const g = new THREE.CylinderGeometry(0.28, 0.45, BEAM_H, 20, 6, true);
  g.translate(0, BEAM_H / 2, 0);
  const pos = g.attributes.position;
  const rgba = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getY(i) / BEAM_H;
    rgba.set([1, 1, 1, (1 - u) ** 1.6], i * 4);
  }
  g.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
  return g;
}

export function Beacon() {
  const { target, idle } = useObjective();
  const invalidate = useThree((s) => s.invalidate);
  const beam = useRef<THREE.Mesh>(null);
  const arrow = useRef<THREE.Mesh>(null);
  const parts = useMemo(
    () => ({
      beam: beamGeometry(),
      // normal blending, not additive: on the bright regolith an additive beam burns out to a white pillar
      beamMat: new THREE.MeshBasicMaterial({
        color: '#62cfff',
        vertexColors: true,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
      arrow: new THREE.ConeGeometry(0.26, 0.5, 4).rotateX(Math.PI),
      arrowMat: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffab2e').multiplyScalar(1.3), toneMapped: false }),
    }),
    [],
  );
  useEffect(
    () => () => {
      parts.beam.dispose();
      parts.beamMat.dispose();
      parts.arrow.dispose();
      parts.arrowMat.dispose();
    },
    [parts],
  );
  const at = spot(target);

  useFrame(({ clock }) => {
    if (!at) return;
    const t = clock.elapsedTime;
    const hz = idle ? 2.2 : 0.8;
    const wave = 0.5 + 0.5 * Math.sin(t * hz * Math.PI * 2);
    parts.beamMat.opacity = idle ? 0.25 + 0.35 * wave : 0.25 + 0.12 * wave;
    if (arrow.current) {
      arrow.current.position.y = ARROW_Y + (idle ? 0.3 : 0.16) * wave;
      arrow.current.rotation.y = t * 1.2;
    }
    if (beam.current) beam.current.scale.setScalar(idle ? 1 + 0.15 * wave : 1);
    invalidate();
  });

  if (!at) return null;
  const y = groundHeight(at[0], at[1]);
  return (
    <group position={[at[0], y, at[1]]}>
      <mesh ref={beam} geometry={parts.beam} material={parts.beamMat} frustumCulled={false} renderOrder={2} />
      <mesh ref={arrow} geometry={parts.arrow} material={parts.arrowMat} position-y={ARROW_Y} />
    </group>
  );
}
