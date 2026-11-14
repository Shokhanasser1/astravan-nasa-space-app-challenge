import { Suspense, lazy } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, PerformanceMonitor, Preload, Stars } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useGame } from '../state/store';
import { features } from '../config/features';
import { LOWER, QUALITY } from './quality';
import { SunLight } from './SunLight';
import { PlaceholderBase } from './PlaceholderBase';

const Perf = lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf })));
const showPerf = import.meta.env.DEV && new URLSearchParams(location.search).has('perf');

/**
 * The single 3D canvas for the whole game (one renderer per page; scenes swap content inside it).
 * L1 base view: draws engine numbers, never computes them.
 */
export function Stage() {
  const quality = useGame((s) => s.settings.quality);
  const setSettings = useGame((s) => s.setSettings);
  const q = QUALITY[quality];

  return (
    <Canvas
      className="!fixed inset-0"
      dpr={q.dpr}
      shadows
      camera={{ fov: 55, near: 0.1, far: 2000, position: [0, 1.7, 6] }}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      aria-label="Moon base"
      role="img"
    >
      <PerformanceMonitor onDecline={() => setSettings({ quality: LOWER[quality] })} flipflops={2} />
      <AdaptiveDpr pixelated={false} />
      <color attach="background" args={['#000000']} />
      {/* Stars do not twinkle: there is no air. Replace with the Yale Bright Star catalogue when ready. */}
      <Stars radius={900} depth={50} count={2500} factor={4} fade={false} speed={0} />
      {features.light ? <SunLight /> : <ambientLight intensity={0.6} />}
      <Suspense fallback={null}>
        <PlaceholderBase />
        <Preload all />
      </Suspense>
      {q.bloom && (
        <EffectComposer resolutionScale={0.5} multisampling={0}>
          <Bloom luminanceThreshold={0.9} mipmapBlur intensity={0.8} />
        </EffectComposer>
      )}
      {showPerf && (
        <Suspense fallback={null}>
          <Perf position="top-left" />
        </Suspense>
      )}
    </Canvas>
  );
}
