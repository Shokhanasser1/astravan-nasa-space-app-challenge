import { Component, Suspense, useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type * as THREE from 'three';
import { nasaModels } from './enabled';
import { BUILDINGS, kitProblems, modelPath, prepareBuilding, type Building } from './kit';

/**
 * The static shell of a building: the grey code shapes, or with `nasaModels` its NASA-based GLB.
 * - Flag off: renders `grey` as it is (nothing is requested, nothing changes).
 * - Flag on: the grey shapes are the Suspense fallback while the kit loads, and stay if any of the six files fails
 *   to load or lacks its named parts: one load for all six (one cache entry), so it is all six models or none.
 * Meshopt decoding is built into drei's loader (bundled, works offline); Draco is off: our GLBs never use it.
 * Everything dynamic (glow rings, plants, lamps, wall rings, interior, taps) stays in the part, next to the shell;
 * the model's own glow meshes are hidden, so the code lamps are the glow in both looks.
 */
const URLS = BUILDINGS.map((b) => `${import.meta.env.BASE_URL}${modelPath(b)}`);

/** A node of the model the part animates (filled when the model is shown, null with the grey shapes). */
export type NodeRef = { current: THREE.Object3D | null };

type ShellProps = {
  name: Building;
  grey: ReactNode;
  /** Turn about Y so the model's front (+Z) faces where the grey shape's front does (radians). */
  turn?: number;
  /** Named nodes the part animates: { lander_body: ref } (each must be listed in kit.ts ANIMATED). */
  nodes?: Record<string, NodeRef>;
};

export function Shell(props: ShellProps) {
  if (!nasaModels) return <>{props.grey}</>;
  return (
    <GreyOnError fallback={props.grey}>
      <Suspense fallback={props.grey}>
        <Model {...props} />
      </Suspense>
    </GreyOnError>
  );
}

function Model({ name, turn = 0, nodes }: ShellProps) {
  const gltfs = useGLTF(URLS, false, true);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const prepared = useMemo(() => {
    const scenes = Object.fromEntries(BUILDINGS.map((b, i) => [b, gltfs[i]?.scene]));
    const problems = kitProblems(scenes);
    if (problems.length) throw new Error(`nasa-base models not used: ${problems.join('; ')}`);
    const p = prepareBuilding(name, scenes[name]!);
    if (import.meta.env.DEV && p.unknown.length) console.warn(`[models] ${name}: materials not in the palette`, p.unknown);
    return p;
  }, [gltfs, name]);

  useLayoutEffect(() => {
    if (!nodes) return;
    for (const [k, ref] of Object.entries(nodes)) ref.current = prepared.nodes.get(k) ?? null;
    return () => {
      for (const ref of Object.values(nodes)) ref.current = null;
    };
  }, [prepared, nodes]);

  // The shadow map is recomputed once per day (Light.tsx); a model that arrives later asks for one more update.
  // Geometry merged by prepare() was made here, so it is disposed here (the loaded GLB stays cached by useGLTF).
  useEffect(() => {
    gl.shadowMap.needsUpdate = true;
    invalidate();
    return () => {
      for (const g of prepared.owned) g.dispose();
      gl.shadowMap.needsUpdate = true;
      invalidate();
    };
  }, [prepared, gl, invalidate]);

  return (
    <group rotation-y={turn}>
      <primitive object={prepared.root} />
    </group>
  );
}

/** Any load or kit error → the grey shapes stay (the game never waits for or breaks on a model). */
class GreyOnError extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    if (import.meta.env.DEV) console.warn('[models] grey shapes stay:', error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
