import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { invalidate, useThree } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ArmRig } from '../arm/rig';
import { CARGO_SIZE, cargoSpots, makeCargo, stepCargo, type CargoKind, type Grip } from '../arm/cargo';
import { groundHeight } from './ground';
import { PARKED_ROVER } from './layout';

/** One frame of the cargo (RobotArm.tsx calls it after it has moved the arm): true while something moved. */
export type CargoStep = (dt: number, jawsOpen: number) => boolean;

const ROCK_GREYS = [0x8e8c87, 0x66655f];
const BOX = { w: 0.32, d: 0.26, band: 0.06, white: 0xeeeeea, orange: 0xe8701a };

/** A rough low-poly stone (~0.27 × 0.18 m), its bottom at −CARGO_SIZE.rock.half. */
function rockGeometry(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.13, 1);
  const p = g.attributes.position;
  // (non-indexed: a corner shared by several faces is moved the same way in each, by a hash of where it is)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = Math.sin(Math.round(x * 1e4) * 12.9898 + Math.round(y * 1e4) * 78.233 + Math.round(z * 1e4) * 37.719) * 43758.5453;
    const k = 0.8 + 0.32 * (h - Math.floor(h));
    p.setXYZ(i, x * k * 1.05, y * k * 0.7, z * k * 0.9);
  }
  g.computeBoundingBox();
  g.translate(0, -CARGO_SIZE.rock.half - g.boundingBox!.min.y, 0);
  g.computeVertexNormals();
  return g;
}

function painted(g: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < a.length; i += 3) [a[i], a[i + 1], a[i + 2]] = [c.r, c.g, c.b];
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

/** A small white sample box with an orange band round its middle, its bottom at −CARGO_SIZE.box.half. */
function boxGeometry(): THREE.BufferGeometry {
  const body = painted(new THREE.BoxGeometry(BOX.w, CARGO_SIZE.box.half * 2, BOX.d), BOX.white);
  const band = painted(new THREE.BoxGeometry(BOX.w + 0.01, BOX.band, BOX.d + 0.01), BOX.orange);
  const g = mergeGeometries([body, band])!;
  body.dispose();
  band.dispose();
  return g;
}

/**
 * The arm's cargo (src/arm/cargo.ts): three rock samples and two sample boxes on the ground in front of the parked
 * crew rover. One instanced mesh per kind (2 draw calls); all receive shadows, a kind casts only while one of it is
 * held or falling (the Sun's shadow map is redrawn then). RobotArm.tsx calls the step each frame after moving the
 * arm, with the claws' centre from the rig (no allocations).
 */
export function ArmCargo({ rig, stepRef }: { rig: ArmRig; stepRef: MutableRefObject<CargoStep | null> }) {
  const gl = useThree((s) => s.gl);
  const rocks = useRef<THREE.InstancedMesh>(null);
  const boxes = useRef<THREE.InstancedMesh>(null);
  const cargo = useMemo(() => {
    const st = makeCargo(cargoSpots(PARKED_ROVER), groundHeight);
    const count = { rock: 0, box: 0 };
    const slot = st.items.map((it) => count[it.kind]++);
    return { st, slot, count };
  }, []);
  const res = useMemo(
    () => ({
      rockGeo: rockGeometry(),
      boxGeo: boxGeometry(),
      rockMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0, flatShading: true }),
      boxMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 }),
    }),
    [],
  );
  useEffect(
    () => () => {
      res.rockGeo.dispose();
      res.boxGeo.dispose();
      res.rockMat.dispose();
      res.boxMat.dispose();
    },
    [res],
  );

  useLayoutEffect(() => {
    const mesh: Record<CargoKind, THREE.InstancedMesh> = { rock: rocks.current!, box: boxes.current! };
    const { st, slot } = cargo;
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    const grip: Grip = { x: 0, y: 0, z: 0, q: [0, 0, 0, 1] };
    const col = new THREE.Color();
    for (let i = 0; i < st.items.length; i++) {
      const it = st.items[i];
      if (it.kind === 'rock') mesh.rock.setColorAt(slot[i], col.setHex(ROCK_GREYS[it.shade % ROCK_GREYS.length]));
    }
    if (mesh.rock.instanceColor) mesh.rock.instanceColor.needsUpdate = true;
    const write = () => {
      for (let i = 0; i < st.items.length; i++) {
        const it = st.items[i];
        pos.set(it.x, it.y, it.z);
        q.set(it.q[0], it.q[1], it.q[2], it.q[3]);
        sc.setScalar(it.s);
        mesh[it.kind].setMatrixAt(slot[i], m.compose(pos, q, sc));
      }
      mesh.rock.instanceMatrix.needsUpdate = true;
      mesh.box.instanceMatrix.needsUpdate = true;
    };
    write();
    invalidate();
    stepRef.current = (dt, jawsOpen) => {
      rig.gripWorld(pos, q);
      grip.x = pos.x;
      grip.y = pos.y;
      grip.z = pos.z;
      grip.q[0] = q.x;
      grip.q[1] = q.y;
      grip.q[2] = q.z;
      grip.q[3] = q.w;
      const moved = stepCargo(st, dt, grip, jawsOpen);
      if (moved) write();
      // only the held or falling one casts (its whole kind: one mesh per kind)
      let castRock = false, castBox = false;
      for (let i = 0; i < st.items.length; i++) {
        const it = st.items[i];
        if (it.mode !== 'rest') {
          if (it.kind === 'rock') castRock = true;
          else castBox = true;
        }
      }
      if (mesh.rock.castShadow !== castRock || mesh.box.castShadow !== castBox) {
        mesh.rock.castShadow = castRock;
        mesh.box.castShadow = castBox;
        gl.shadowMap.needsUpdate = true;
        return true;
      }
      return moved;
    };
    return () => {
      stepRef.current = null;
    };
  }, [cargo, rig, stepRef, gl]);

  return (
    <>
      <instancedMesh ref={rocks} args={[res.rockGeo, res.rockMat, cargo.count.rock]} receiveShadow frustumCulled={false} />
      <instancedMesh ref={boxes} args={[res.boxGeo, res.boxMat, cargo.count.box]} receiveShadow frustumCulled={false} />
    </>
  );
}
