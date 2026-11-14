import { Component, Suspense, lazy, useState, type ReactNode } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PerformanceMonitor, Preload, Stars, useGLTF } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Machine, View } from '../state/game';
import { features } from '../config/features';
import { LOWER, TIERS, hasWebGL, initialTier, type Tier } from './quality';
import { Light, sunAzimuth } from './Light';
import { Earth } from './Earth';
import { BaseScene } from './BaseScene';
import { Rig } from './Rig';
import { WalkDebug } from './WalkDebug';
import { freeWalk } from '../walk/enabled';

// Draco decoder from our own server (copied by scripts/copy-decoders.mjs), never from Google's CDN:
// the venue Wi-Fi may be down (developer guide §06). Meshopt-compressed models need no decoder file.
useGLTF.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);

const Perf = lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf })));
const params = new URLSearchParams(location.search);
const showPerf = params.has('perf');
// Fallback camera (developer guide view from outside): ?cam=overview. Default is first person (Rig).
const overview = params.get('cam') === 'overview';

/** Dev/shot only: exposes renderer.info (calls, triangles) for scripts/shot.mjs and agents. */
function Probe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  // Post effects render several passes per frame; count the whole frame, not only the last pass.
  gl.info.autoReset = false;
  useFrame(() => {
    // (scene: for cost checks per object by agents, dev and ?shot only)
    (window as unknown as { __hb7?: object }).__hb7 = { calls: gl.info.render.calls, triangles: gl.info.render.triangles, scene };
    gl.info.reset();
  });
  return null;
}

/** If WebGL fails at run time, the game stays playable: buttons and text are in the DOM layer. */
class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Fallback() {
  // Asilbek: one still picture of the base (public/fallback/base.webp). Until then a plain dark background.
  return <div className="fixed inset-0 bg-[#020308] bg-cover bg-center" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}fallback/base.webp)` }} />;
}

/** One <Canvas> for the whole game. Lane C. */
export function Stage({ view, onTap, onUndo }: { view: View; onTap: (k: Machine) => void; onUndo?: (k: Machine) => void }) {
  const [tier, setTier] = useState<Tier>(initialTier);
  const [webgl] = useState(hasWebGL);
  const q = TIERS[tier];
  // A calm scene is not redrawn (saves battery); storms, the day passing and launch animate.
  const animating = view.phase === 'run' || view.phase === 'launch' || view.level > 0 || view.alert;

  if (!webgl) return <Fallback />;

  return (
    <SceneBoundary fallback={<Fallback />}>
      <Canvas
        className="!fixed inset-0"
        dpr={q.dpr}
        // 'percentage' = PCFShadowMap; `true` would ask for PCFSoftShadowMap, removed in three 0.187.
        shadows={q.shadow > 0 ? 'percentage' : false}
        frameloop={animating ? 'always' : 'demand'}
        // far 3000: the real skyline is drawn at 1.5–1.95 km (Terrain.tsx), the stars behind it at 2.4 km
        camera={{ fov: 50, near: 0.1, far: 3000, position: [8, 5, 14] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        onCreated={({ gl, camera }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          if (overview) camera.lookAt(0, 1, 0);
        }}
        // (Right click on a building takes a battery back; the browser menu would cover the game.)
        onContextMenu={(e) => e.preventDefault()}
        role="img"
        aria-label="Moon base"
      >
        <PerformanceMonitor onDecline={() => setTier((t) => LOWER[t])} flipflops={2} />
        {/* Stars do not twinkle: no air. Replace with the Yale Bright Star catalogue when ready. */}
        <Stars radius={2400} depth={50} count={2500} factor={4} fade={false} speed={0} />
        <Earth view={view} />
        {features.light ? <Light sunAzDeg={sunAzimuth(view)} shadowSize={q.shadow} /> : <ambientLight intensity={0.6} />}
        <Suspense fallback={null}>
          <BaseScene view={view} onTap={onTap} onUndo={onUndo} />
          {!overview && <Rig view={view} />}
          {!overview && freeWalk && <WalkDebug />}
          <Preload all />
        </Suspense>
        {(q.bloom || q.vignette) && (
          <EffectComposer multisampling={tier === 'pc' ? 4 : 0} resolutionScale={tier === 'pc' ? 1 : 0.5}>
            {q.bloom ? <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} /> : <></>}
            {q.vignette ? <Vignette eskil={false} offset={0.2} darkness={0.75} /> : <></>}
          </EffectComposer>
        )}
        {(import.meta.env.DEV || params.has('shot')) && <Probe />}
        {showPerf && (
          <Suspense fallback={null}>
            <Perf position="bottom-left" />
          </Suspense>
        )}
      </Canvas>
    </SceneBoundary>
  );
}
