import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { levelOf, useRunHour } from './runClock';

/**
 * The storm in the air (docs/layout.md "Invisible storm"; 15 Nov): at radiation level ≥ 2 (View.level, from the
 * measured week) a few hundred fast specks cross the view near the camera — straight lines, no air to slow them
 * (ballistic) — and the view takes a faint blue-violet tint. Nothing at level 0–1. No camera shake, no flashes;
 * with `prefers-reduced-motion` the specks stay away and only a soft static glow remains. Densities are game
 * looks, not measurements. Cost while it runs: 2 draw calls (the specks, the tint); none when calm.
 */
const MAX = 420;
const COUNT = [0, 0, 140, 280, 420];
const TINT = [0, 0, 0.035, 0.05, 0.07];
const HALF = 5; // m: the box of air round the camera the specks live in
const reduced = typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (g) {
    const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 32, 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Storm({ level }: { level: number }) {
  // While the day runs, the storm follows the measured hour being played (src/scene/runClock.ts): it comes in at the
  // real particle arrival, not before.
  const run = useRunHour();
  const l = Math.max(0, Math.min(4, Math.round(run ? levelOf(run.ratio) : level)));
  const on = l >= 2;
  const parts = useMemo(() => {
    const pos = new Float32Array(MAX * 3);
    const vel = new Float32Array(MAX * 3);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < MAX; i++) {
      pos.set([(rnd() * 2 - 1) * HALF, (rnd() * 2 - 1) * HALF, (rnd() * 2 - 1) * HALF], i * 3);
      // mostly from above and from one side (the Sun's), 4–9 m/s, each its own straight line
      const speed = 4 + rnd() * 5;
      const d = new THREE.Vector3(0.6 + rnd() * 0.5, -0.7 - rnd() * 0.6, (rnd() - 0.5) * 0.8).normalize();
      vel.set([d.x * speed, d.y * speed, d.z * speed], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    const map = dotTexture();
    const mat = new THREE.PointsMaterial({
      color: '#d4dcff',
      size: 0.06,
      map,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 9;
    const tintMat = new THREE.MeshBasicMaterial({
      color: '#7a6cff',
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    const tint = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), tintMat);
    tint.frustumCulled = false;
    tint.renderOrder = 10;
    return { pos, vel, geo, map, mat, points, tint, tintMat };
  }, []);
  useEffect(
    () => () => {
      parts.geo.dispose();
      parts.mat.dispose();
      parts.map.dispose();
      parts.tint.geometry.dispose();
      parts.tintMat.dispose();
    },
    [parts],
  );

  parts.geo.setDrawRange(0, reduced ? 0 : COUNT[l]);
  parts.points.visible = on && !reduced;
  parts.tint.visible = on;
  parts.tintMat.opacity = TINT[l] + (reduced ? 0.03 : 0);

  useFrame((state, dt) => {
    if (!on) return;
    const cam = state.camera.position;
    parts.tint.position.copy(cam);
    if (reduced) return; // a static glow: nothing moves, nothing asks for frames
    parts.points.position.copy(cam);
    const step = Math.min(dt, 0.05);
    const p = parts.pos;
    const v = parts.vel;
    const n = COUNT[l] * 3;
    for (let i = 0; i < n; i++) {
      let x = p[i] + v[i] * step;
      if (x > HALF) x -= 2 * HALF;
      else if (x < -HALF) x += 2 * HALF;
      p[i] = x;
    }
    (parts.geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    state.invalidate(); // (demand frame loop: keep drawing while the storm runs)
  });

  return (
    <>
      <primitive object={parts.points} />
      <primitive object={parts.tint} />
    </>
  );
}
