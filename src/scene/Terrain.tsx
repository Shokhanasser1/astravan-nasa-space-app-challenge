import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GROUND } from './ground';
import { initialTier } from './quality';
import { sunDirection } from './Light';
import { NEAR_R, bakeSunVis, buildFar, buildNear, regolithMaterial, updateRegolith } from '../look/terrain.js';
import { buildRocks } from '../look/rocks.js';
import { rockOptions } from '../walk/rocks';
import { regolithTextures } from '../look/textures.js';
import { features } from '../config/features';
import { loadHfRegolith, loadHfRock } from './hfAssets';

/** The real skyline (out to 60 km) is pulled in to 1.5–1.95 km along the line of sight: same angles, one camera. */
const SKY = { from: 1500, to: 1950 };

/**
 * The real ground of the Shackleton–de Gerlache ridge (NASA LRO LOLA, src/scene/ground.ts): a 150 m disc with fine
 * regolith detail and rocks, rings out to the real skyline. Shadows of hills and mountains are baked per vertex for
 * the day's Sun and baked again (in slices) when the Sun moves on the next day. Receives shadows, never casts them.
 * Shared builders: src/look/ (also used by the 3D demo).
 */
export function Terrain({ sunAzDeg }: { sunAzDeg: number }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const firstAz = useRef(sunAzDeg);

  const parts = useMemo(() => {
    const pc = initialTier() === 'pc';
    const sun = sunDirection(firstAz.current, new THREE.Vector3());
    const tex = regolithTextures(gl, pc ? 512 : 256);
    const nearMat = regolithMaterial({ detail: tex.albedo, detailNormal: tex.slope, surge: 0.35 });
    const farMat = regolithMaterial({ surge: 0.25 });
    const near = new THREE.Mesh(buildNear(GROUND, { step: pc ? 3 : 4, radius: NEAR_R, sun }), nearMat);
    near.receiveShadow = true;
    const far = new THREE.Mesh(buildFar(GROUND, { azStep: pc ? 1 : 2, sun, compress: SKY }), farMat);
    // rocks stay out of the base and the walking paths: the big blocks start 30 m out
    // (the same rocks the walk and the rover feel: src/walk/rocks.ts)
    const rocks = buildRocks(GROUND, { ...rockOptions(pc), play: 0 });
    return { near, far, rocks, tex, nearMat, farMat, sun, bakedAz: firstAz.current };
  }, [gl]);

  // the new rocks and ground must be in the once-a-day shadow map (Light.tsx)
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate, parts]);

  // next day: bake the mountain shadows for the new Sun, a slice at a time
  useEffect(() => {
    if (parts.bakedAz === sunAzDeg) return;
    let stop = false;
    const sun = sunDirection(sunAzDeg, new THREE.Vector3());
    const cancelled = () => stop;
    void (async () => {
      const ok =
        (await bakeSunVis(parts.near.geometry, GROUND, sun, { maxDist: 3000, useDetail: true, cancelled })) &&
        (await bakeSunVis(parts.far.geometry, GROUND, sun, { maxDist: 25000, useDetail: false, cancelled }));
      if (!ok) return;
      parts.bakedAz = sunAzDeg;
      parts.sun.copy(sun);
      gl.shadowMap.needsUpdate = true;
      invalidate();
    })();
    return () => {
      stop = true;
    };
  }, [sunAzDeg, parts, gl, invalidate]);

  useEffect(
    () => () => {
      for (const m of [parts.near, parts.far, parts.rocks.big, parts.rocks.boulders, parts.rocks.pebbles]) m.geometry.dispose();
      parts.nearMat.dispose();
      parts.farMat.dispose();
      parts.rocks.big.material.dispose();
      parts.tex.albedo.dispose();
      parts.tex.slope.dispose();
    },
    [parts],
  );

  // AI graphics pack: the photo-real regolith (all tiers) and the AI boulders (computers only, triangles), swapped in
  // once loaded; the code-made look stays if a file is missing.
  useEffect(() => {
    if (!features.hfGround) return;
    let alive = true;
    let swapped: THREE.Texture[] = [];
    void loadHfRegolith(gl, initialTier() === 'pc').then((t) => {
      if (!t) return;
      const all = [t.albedo, t.slope, t.macro, t.macroSlope];
      if (!alive) return all.forEach((x) => x.dispose());
      swapped = all;
      const u = parts.nearMat.userData.uniforms;
      u.uDetail.value = t.albedo;
      u.uDetailN.value = t.slope;
      u.uMacro.value = t.macro;
      u.uMacroN.value = t.macroSlope;
      invalidate();
    });
    return () => {
      alive = false;
      if (swapped.length) {
        const u = parts.nearMat.userData.uniforms;
        u.uDetail.value = u.uMacro.value = parts.tex.albedo;
        u.uDetailN.value = u.uMacroN.value = parts.tex.slope;
        swapped.forEach((x) => x.dispose());
      }
    };
  }, [parts, gl, invalidate]);

  useEffect(() => {
    if (!features.hfRocks || initialTier() !== 'pc') return;
    let alive = true;
    const olds: Array<[THREE.InstancedMesh, THREE.BufferGeometry, THREE.Material | THREE.Material[]]> = [];
    void Promise.all([loadHfRock('boulder-a'), loadHfRock('boulder-b')]).then(([a, b]) => {
      if (!alive) return;
      for (const [mesh, rock] of [
        [parts.rocks.big as unknown as THREE.InstancedMesh, a],
        [parts.rocks.boulders as unknown as THREE.InstancedMesh, b ?? a],
      ] as const) {
        if (!rock) continue;
        olds.push([mesh, mesh.geometry, mesh.material]);
        mesh.geometry = rock.geometry;
        mesh.material = rock.material;
        mesh.computeBoundingSphere();
      }
      gl.shadowMap.needsUpdate = true;
      invalidate();
    });
    return () => {
      alive = false;
      for (const [mesh, g, m] of olds) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        mesh.geometry = g;
        mesh.material = m;
      }
    };
  }, [parts, gl, invalidate]);

  // the bright patch around your own shadow (opposition surge) follows the view
  useFrame(({ camera }) => {
    updateRegolith(parts.nearMat, parts.sun, camera);
    updateRegolith(parts.farMat, parts.sun, camera);
  });

  return (
    <>
      <primitive object={parts.near} />
      <primitive object={parts.far} />
      <primitive object={parts.rocks.big} />
      <primitive object={parts.rocks.boulders} />
      <primitive object={parts.rocks.pebbles} />
    </>
  );
}
