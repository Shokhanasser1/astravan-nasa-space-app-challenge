import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DOOR_AZ } from '../layout';

/**
 * The radiation wall as it is really planned on the Moon: bags of regolith stacked around the habitat (Artemis
 * base-camp studies; visual idea after the ASTRA trainer's sandbag shield, our own code). Each wall level of the
 * week (`view.wall`, engine) adds two courses; a new course drops into place. Bricklayer pattern, a gap for the door.
 * One instanced mesh: ~130 bags of 40 triangles at most (5k), one draw call.
 */
const BAG = { w: 0.56, h: 0.2, d: 0.34 };
const COURSES_PER_LEVEL = 2;
const MAX_LEVEL = 3;
const DOOR_GAP = THREE.MathUtils.degToRad(46); // the door and its frame stay open

/** A pillow-shaped bag in 40 triangles: a box whose top and bottom edges are pulled in and rounded by normals. */
function bagGeometry(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(BAG.w, BAG.h, BAG.d, 2, 1, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const edge = Math.abs(x) > BAG.w * 0.49 || Math.abs(z) > BAG.d * 0.49;
    const k = edge ? 0.82 : 1.0; // the rim of the bag is thinner than its middle
    const bulge = !edge && y > 0 ? 0.03 : 0; // and its middle sags up a little
    p.setXYZ(i, x * (edge ? 1 : 1), y * k + bulge, z);
  }
  g.computeVertexNormals();
  return g;
}

interface Slot {
  a: number;
  course: number;
}

function layout(radius: number): Slot[] {
  const per = Math.floor((2 * Math.PI * radius) / (BAG.w + 0.02));
  const slots: Slot[] = [];
  for (let course = 0; course < MAX_LEVEL * COURSES_PER_LEVEL; course++) {
    const shift = course % 2 ? 0.5 : 0; // bricklayer: every other course half a bag along
    for (let i = 0; i < per; i++) {
      const a = ((i + shift) / per) * Math.PI * 2;
      const off = Math.atan2(Math.sin(a - DOOR_AZ), Math.cos(a - DOOR_AZ));
      if (Math.abs(off) < DOOR_GAP / 2) continue;
      slots.push({ a, course });
    }
  }
  return slots;
}

export function Sandbags({ wall, radius }: { wall: number; radius: number }) {
  const invalidate = useThree((s) => s.invalidate);
  const slots = useMemo(() => layout(radius + BAG.d / 2 + 0.08), [radius]);
  const mesh = useMemo(() => {
    const geo = bagGeometry();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 });
    const m = new THREE.InstancedMesh(geo, mat, slots.length);
    m.castShadow = true;
    m.receiveShadow = true;
    m.count = 0;
    // regolith bags: grey-beige, every one a little different
    const c = new THREE.Color();
    slots.forEach((_, i) => {
      const k = 0.85 + ((i * 7919) % 100) / 100 * 0.2;
      c.setRGB(0.34 * k, 0.33 * k, 0.31 * k); // the ground's own grey (ground.ts colour), a touch warmer
      m.setColorAt(i, c);
    });
    return m;
  }, [slots]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    },
    [mesh],
  );

  const level = Math.max(0, Math.min(MAX_LEVEL, Math.round(wall)));
  const shown = slots.filter((s) => s.course < level * COURSES_PER_LEVEL).length;
  const anim = useRef({ from: 0, start: -1, shown: 0, done: false }).current;
  if (anim.shown !== shown) {
    anim.from = Math.min(anim.shown, shown);
    anim.shown = shown;
    anim.start = -1;
    anim.done = false;
  }

  // (The scene draws on demand: a new course must ask for frames itself.)
  useEffect(() => invalidate(), [shown, invalidate]);

  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const p = useMemo(() => new THREE.Vector3(), []);
  const s = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const r = radius + BAG.d / 2 + 0.08;

  useFrame((state) => {
    if (anim.done) return; // laid: nothing to do until the wall grows again
    if (anim.start < 0) anim.start = state.clock.elapsedTime;
    const t = Math.min(1, (state.clock.elapsedTime - anim.start) / 0.7);
    for (let i = 0; i < shown; i++) {
      const slot = slots[i];
      const fresh = i >= anim.from;
      const drop = fresh ? 0.6 * (1 - t) * (1 - t) : 0; // new bags drop the last 60 cm onto the wall
      const tilt = (((i * 104729) % 100) / 100 - 0.5) * 0.12;
      p.set(Math.sin(slot.a) * r, BAG.h / 2 + slot.course * (BAG.h - 0.015) + drop, Math.cos(slot.a) * r);
      q.setFromAxisAngle(up, slot.a + tilt);
      m4.compose(p, q, s);
      mesh.setMatrixAt(i, m4);
    }
    mesh.count = shown;
    mesh.instanceMatrix.needsUpdate = true;
    state.gl.shadowMap.needsUpdate = true;
    if (t < 1) invalidate();
    else anim.done = true;
  });

  return <primitive object={mesh} />;
}
