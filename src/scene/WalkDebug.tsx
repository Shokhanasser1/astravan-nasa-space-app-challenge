import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { BODY, type Solid } from '../walk/collide';
import { walkDebug } from '../walk/walker';
import { INSIDE, OUTSIDE } from '../walk/world';
import { groundHeight } from './ground';

/**
 * Debug view for the free walk (handoff "first-person walk", section 6): F3, or ?debug in the address, draws every
 * hitbox as a wireframe on the ground (solids magenta, the edge of the playable ground and the habitat's floor
 * cyan, the walker's body yellow) and shows the walker's position, speed and the frame rate. Development aid only:
 * it reads, it never changes anything, and it draws nothing until it is switched on.
 */
const SEGMENTS = 48;

/** The outline of a solid on the ground: a circle, or a bar with rounded ends. */
function outline(s: Solid, grow: number, y: (x: number, z: number) => number): THREE.BufferGeometry {
  const r = s.r + grow;
  const pts: number[] = [];
  const push = (x: number, z: number) => pts.push(x, y(x, z) + 0.06, z);
  if (s.bx === undefined || s.bz === undefined) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2;
      push(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r);
    }
  } else {
    const along = Math.atan2(s.bz - s.z, s.bx - s.x);
    for (let i = 0; i <= SEGMENTS / 2; i++) {
      const a = along - Math.PI / 2 + (i / (SEGMENTS / 2)) * Math.PI;
      push(s.bx + Math.cos(a) * r, s.bz + Math.sin(a) * r);
    }
    for (let i = 0; i <= SEGMENTS / 2; i++) {
      const a = along + Math.PI / 2 + (i / (SEGMENTS / 2)) * Math.PI;
      push(s.x + Math.cos(a) * r, s.z + Math.sin(a) * r);
    }
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}

function Hitboxes() {
  const camera = useThree((s) => s.camera);
  const body = useRef<THREE.LineLoop>(null);
  const built = useMemo(() => {
    const group = new THREE.Group();
    const mat = (color: string) => new THREE.LineBasicMaterial({ color, toneMapped: false, depthTest: false, transparent: true });
    const solid = mat('#ff5ad1');
    const edge = mat('#40e0ff');
    const add = (g: THREE.BufferGeometry, m: THREE.LineBasicMaterial) => {
      const l = new THREE.LineLoop(g, m);
      l.renderOrder = 999;
      l.frustumCulled = false;
      group.add(l);
    };
    for (const s of OUTSIDE.solids) add(outline(s, 0, groundHeight), solid);
    add(outline(OUTSIDE.bounds, 0, groundHeight), edge);
    add(outline(INSIDE.bounds, 0, () => 0.2), edge);
    const ring = outline({ x: 0, z: 0, r: BODY }, 0, () => 0);
    return { group, ring, mats: [solid, edge], bodyMat: mat('#ffe066') };
  }, []);

  // A small readout: where the walker is, how fast, and the frame rate while frames are being drawn.
  const readout = useMemo(() => {
    const el = document.createElement('pre');
    el.style.cssText =
      'position:fixed;left:10px;top:50%;z-index:9999;margin:0;padding:6px 9px;font:12px/1.35 ui-monospace,Menlo,monospace;color:#d9ffe9;background:rgba(2,3,8,.82);border:1px solid #2f8f63;border-radius:6px;pointer-events:none;white-space:pre';
    return el;
  }, []);
  useEffect(() => {
    document.body.appendChild(readout);
    return () => {
      readout.remove();
      built.group.traverse((o) => (o as THREE.LineLoop).geometry?.dispose());
      built.ring.dispose();
      for (const m of [...built.mats, built.bodyMat]) m.dispose();
    };
  }, [built, readout]);

  const fps = useRef({ frames: 0, at: 0, value: 0 }).current;
  useFrame(() => {
    const feet = walkDebug.inside ? 0.2 : groundHeight(camera.position.x, camera.position.z);
    body.current?.position.set(camera.position.x, feet, camera.position.z);
    fps.frames++;
    const now = performance.now();
    if (now - fps.at >= 500) {
      fps.value = (fps.frames * 1000) / (now - fps.at);
      fps.frames = 0;
      fps.at = now;
    }
    // (Every drawn frame: the scene draws on demand, so the last frame before it rests must show the final numbers.)
    readout.textContent =
      `hitboxes on (F3)\n` +
      `pos   x ${camera.position.x.toFixed(2)}  z ${camera.position.z.toFixed(2)}  ${walkDebug.inside ? 'inside' : 'outside'}\n` +
      `speed ${walkDebug.speed.toFixed(2)} m/s\n` +
      `fps   ${fps.value.toFixed(0)} (while drawing)   solids ${OUTSIDE.solids.length}`;
  });

  return (
    <>
      <primitive object={built.group} />
      <lineLoop ref={body} geometry={built.ring} material={built.bodyMat} renderOrder={999} frustumCulled={false} />
    </>
  );
}

export function WalkDebug() {
  const invalidate = useThree((s) => s.invalidate);
  const [on, setOn] = useState(() => new URLSearchParams(location.search).has('debug'));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code !== 'F3') return;
      // (F3 is the browser's "find next" on some systems.)
      e.preventDefault();
      setOn((v) => !v);
      invalidate();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [invalidate]);
  return on ? <Hitboxes /> : null;
}
