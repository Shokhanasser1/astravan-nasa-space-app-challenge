import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { camState } from './anim';
import { buildingOf, roomState } from '../walk/rooms';
import { inHabitatRoom, inHduModule } from './astra/shellFit';
import { ASTRA_SCALE, HDU_HABITAT } from './layout';

/**
 * Building interiors (local preview, 15 Nov): furnished insides made in Blender from NASA references
 * (blender/interiors/<b>/: build script, SOURCES.md, HANDOFF.md). Each GLB is in ASTRA's model
 * frame at native metres, so it sits in the same group transform as its ASTRA shell (AstraBase.tsx: rotation-y and
 * ASTRA_SCALE) and fits inside it. Drawn only when it can be seen, to keep phones in budget: the habitat's from its
 * inside point, the others while the camera is near (through glass and windows).
 *
 * The HDU complex (`?hdu`, layout.ts HDU_HABITAT): the habitat, greenhouse and lab are its three modules, each with its
 * own walk-in interior (public/models/interiors/hdu_<id>.glb, module frame, game metres; src/scene/HduComplex.tsx puts
 * it at its module's centre). Each is drawn like ASTRA's habitat: whole while the camera is in that module, otherwise
 * only its outer door leaf within 20 m.
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
 * Each building's door (its `DoorOpen` clip, the habitat's `DoorOpenOuter`, scrubbed): `want` 1 opens it, 0 closes
 * it; `open` follows in DOOR_S seconds. The Rig opens one when the astronaut goes in or out (E at it).
 * The HDU modules play `DoorOpen`: their outer door (swings out) and inner door (swings in) stand 9 cm apart in one
 * wall with no airlock between, so both open together (`DoorOpenOuter` alone would leave the inner door shut in the
 * way of the walk-in, `DoorOpenInner` alone the outer one).
 */
/**
 * Is a building's whole interior drawn, not only its door? Inside it (`inside`: its room, the camera within it, the
 * ASTRA first-person habitat), and with the HDU complex (#10) also while its door is open at all or opening: the
 * door shows the room behind it, never an empty shell. Pure.
 */
export function interiorFull(hdu: boolean, door: { readonly open: number; readonly want: number }, inside: boolean): boolean {
  return inside || (hdu && (door.open > 0 || door.want > 0));
}

export const interiorDoors: Record<InteriorId, { open: number; want: number }> = {
  habitat: { open: 0, want: 0 },
  greenhouse: { open: 0, want: 0 },
  lab: { open: 0, want: 0 },
  lander: { open: 0, want: 0 },
};
export const habitatDoor = interiorDoors.habitat;
const DOOR_S = 0.8;
const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * Parts of the interior GLBs the game does not draw. The habitat's storm-shelter ring (water bags and cargo bags round
 * the ladder, blender/interiors/habitat) read as the outside sandbag shield poking into the room and hid the galley
 * (Samandar, 15 Nov ~09:00: take it out). Its hitbox never existed (src/walk/rooms.ts), so nothing else changes.
 */
export const HIDDEN_PARTS: readonly string[] = ['habitat_ground_int_bag', 'habitat_ground_int_water'];

/** The HDU complex's modules (`?hdu`): the habitat, the greenhouse and the lab have their own interiors there. */
const isHdu = (id: InteriorId) => HDU_HABITAT && id !== 'lander';

function Model({ id, plant }: { id: InteriorId; plant?: number }) {
  const hdu = isHdu(id);
  const { scene, animations } = useGLTF(`${base}${hdu ? `hdu_${id}` : id}.glb`, false, true);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    for (const name of HIDDEN_PARTS) o.getObjectByName(name)?.removeFromParent();
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) {
        m.castShadow = false; // inside a shell: the shell casts the shadow
        m.receiveShadow = false;
      }
    });
    o.visible = false;
    return o;
  }, [scene]);
  // its door: the clip on the door pivot, and the pivot itself (the habitat's hatch also shows from outside)
  const door = useMemo(() => {
    const clip = (!hdu && id === 'habitat' && animations.find((c) => c.name === 'DoorOpenOuter')) || animations.find((c) => c.name === 'DoorOpen');
    const root = obj.children[0] ?? obj;
    const leaf = obj.getObjectByName(`${id}_door`);
    if (!clip || !leaf) return null;
    const mixer = new THREE.AnimationMixer(obj);
    const action = mixer.clipAction(clip);
    action.play();
    action.paused = true;
    return { mixer, action, clip, root, leaf };
  }, [id, hdu, obj, animations]);
  // the HDU greenhouse's lettuce shows the garden level (view.plant 0–4): greenhouse_plants_1…k, like Crops.tsx
  const plants = useMemo(() => {
    const out: [number, THREE.Object3D][] = [];
    obj.traverse((o) => {
      const m = /_plants_(\d+)$/.exec(o.name);
      if (m) out.push([Number(m[1]), o]);
    });
    return out;
  }, [obj]);
  useEffect(() => {
    if (plant === undefined) return;
    for (const [k, o] of plants) o.visible = k <= plant;
    invalidate();
  }, [plants, plant, invalidate]);
  useFrame((_, delta) => {
    const d = interiorDoors[id];
    const was = d.open;
    d.open += Math.sign(d.want - d.open) * Math.min(Math.abs(d.want - d.open), Math.min(delta, 0.05) / DOOR_S);
    if (door) {
      door.action.time = ease(d.open) * door.clip.duration;
      door.mixer.update(0);
      if (d.open !== was) invalidate();
    }
    const inRoom = roomState.id !== null && buildingOf(roomState.id) === id;
    obj.getWorldPosition(at);
    const dist = at.distanceTo(camera.position);
    if (id === 'habitat' || hdu) {
      // inside (the first-person point and anywhere it walks in the room, both decks, or walking in its room with
      // the astronaut): the whole room; outside, near: only the hatch. (camState.inside alone is the old 0.34-scale
      // 1.6 m circle below 3 m: at 0.6 the first-person walk left it by the galley and on the upper deck, and the
      // room vanished round the camera, showing ASTRA's shell and shield from inside.) HDU: the same for each module,
      // with the camera inside that module's lining and below its dome.
      const p = camera.position;
      const full = interiorFull(
        hdu,
        d,
        (id === 'habitat' && camState.inside) ||
          inRoom ||
          (hdu ? inHduModule(p.x, p.y, p.z) === id : inHabitatRoom(p.x - at.x, p.y - at.y, p.z - at.z, ASTRA_SCALE.habitat)),
      );
      obj.visible = full || dist < 20;
      if (door) for (const c of door.root.children) c.visible = full || c === door.leaf;
      return;
    }
    obj.visible = inRoom || dist < NEAR[id];
  });
  return <primitive object={obj} />;
}

/**
 * The interior of one building; put it in the same transform as the ASTRA shell (HDU: at its module's centre, turned
 * with the complex). `plant` (0–4, the HDU greenhouse): how many of its lettuce sets grow. Missing or failing: not shown.
 */
export function Interior({ id, plant }: { id: InteriorId; plant?: number }) {
  return (
    <Quiet>
      <Suspense fallback={null}>
        <Model id={id} plant={plant} />
      </Suspense>
    </Quiet>
  );
}
