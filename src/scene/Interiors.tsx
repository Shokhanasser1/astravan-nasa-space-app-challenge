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

/**
 * The habitat's outer hatch (its `DoorOpenOuter` clip, scrubbed): `want` 1 opens it, 0 closes it; `open` follows in
 * DOOR_S seconds. The Rig opens it when the astronaut goes in or out (E at the door, or at the airlock inside).
 */
export const habitatDoor = { open: 0, want: 0 };
const DOOR_S = 0.8;
const ease = (t: number) => t * t * (3 - 2 * t);

function Model({ id }: { id: InteriorId }) {
  const { scene, animations } = useGLTF(`${base}${id}.glb`, false, true);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
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
  // the habitat: its outer hatch shows from outside too (on the shell's door, 1–2 cm proud), and opens
  const door = useMemo(() => {
    if (id !== 'habitat') return null;
    const clip = animations.find((c) => c.name === 'DoorOpenOuter') ?? animations.find((c) => c.name === 'DoorOpen');
    const root = obj.children[0] ?? obj;
    const leaf = obj.getObjectByName('habitat_door');
    if (!clip || !leaf) return null;
    const mixer = new THREE.AnimationMixer(obj);
    const action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
    return { mixer, action, clip, root, leaf };
  }, [id, obj, animations]);
  useFrame((_, delta) => {
    if (id === 'habitat') {
      const d = habitatDoor;
      const was = d.open;
      d.open += Math.sign(d.want - d.open) * Math.min(Math.abs(d.want - d.open), Math.min(delta, 0.05) / DOOR_S);
      if (door) {
        door.action.time = ease(d.open) * door.clip.duration;
        door.mixer.update(0);
        if (d.open !== was) invalidate();
        // inside: the whole room; outside, near: only the hatch on the shell
        obj.getWorldPosition(at);
        const near = at.distanceTo(camera.position) < 20;
        obj.visible = camState.inside || near;
        for (const c of door.root.children) c.visible = camState.inside || c === door.leaf;
      } else {
        obj.visible = camState.inside;
      }
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
