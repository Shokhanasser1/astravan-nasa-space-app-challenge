import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { PerformanceMonitor, Preload, Stars, useGLTF } from '@react-three/drei';
import { Bloom, BrightnessContrast, ChromaticAberration, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import type { Machine, View } from '../state/game';
import { features } from '../config/features';
import { LOWER, MAX_FPS, TIERS, canvasDpr, hasWebGL, pcFpsBounds, startTier, type Tier } from './quality';
import { capFrameRate } from './frameCap';
import { walkInput } from '../walk/input';
import { Light, sunAzimuth } from './Light';
import { Earth } from './Earth';
import { BaseScene } from './BaseScene';
import { Tanks } from './parts/Tanks';
import { Storm } from './Storm';
import { Rig } from './Rig';
import { WalkDebug } from './WalkDebug';
import { RobotArm } from './RobotArm';
import { HfSky, HfSun } from './HfSky';
import { freeWalk } from '../walk/enabled';
import { SMALL_CASTER_M, trimCasters } from './shadowDiet';

// Draco decoder from our own server (copied by scripts/copy-decoders.mjs), never from Google's CDN:
// the venue Wi-Fi may be down (developer guide §06). Meshopt-compressed models need no decoder file.
useGLTF.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);

const Perf = lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf })));
const params = new URLSearchParams(location.search);
const showPerf = params.has('perf');
// Fallback camera (developer guide view from outside): ?cam=overview. Default is first person (Rig).
const overview = params.get('cam') === 'overview';

/**
 * Tone mapping: Neutral (Khronos PBR Neutral), not ACES or AgX. It is linear up to ~0.8 and rolls highlights off
 * gently, so a white habitat in full Sun keeps its shading instead of clipping flat, and it keeps colours true (gold
 * foil, blue markers, warm windows); AgX looked greyer and washed the colours out. Exposure 3.3 because the Sun is
 * kept low for Bloom (Light.tsx); it is applied after Bloom, so glowing parts look ~3× brighter than their values.
 * (Before 15 Nov the composer silently switched the renderer's ACES off on the pc and phone tiers.)
 */
const TONE = { three: THREE.NeutralToneMapping, post: ToneMappingMode.NEUTRAL };
const EXPOSURE = 3.3;

/** Dev/shot only: exposes renderer.info (calls, triangles) for scripts/shot.mjs and agents. */
function Probe() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  // Post effects render several passes per frame; count the whole frame, not only the last pass.
  gl.info.autoReset = false;
  useFrame(() => {
    // (scene: for cost checks per object by agents; gl and camera: for an agent's still from another view; dev and
    // ?shot only)
    (window as unknown as { __hb7?: object }).__hb7 = { calls: gl.info.render.calls, triangles: gl.info.render.triangles, scene, gl, camera };
    gl.info.reset();
  });
  return null;
}

/** Phones: small parts stop casting shadows as models arrive (shadowDiet.ts); looked at once a second while drawing. */
function ShadowDiet() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const wait = useRef(0);
  useFrame((_, dt) => {
    wait.current -= dt;
    if (wait.current > 0) return;
    wait.current = 1;
    if (trimCasters(scene, SMALL_CASTER_M) > 0) gl.shadowMap.needsUpdate = true;
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
  // No WebGL: one still picture of the base (AI key art, public/hf/art/base.webp; was the planned fallback/base.webp).
  useEffect(() => void window.dispatchEvent(new Event('hb7:ready')), []);
  if (!features.hfArt) return <div className="fixed inset-0 bg-[#020308]" />;
  return (
    <div className="fixed inset-0 bg-[#020308] bg-cover bg-center" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}hf/art/base.webp)` }}>
      <span className="absolute right-3 bottom-2 rounded border border-white/35 px-1 text-[10px] font-semibold tracking-widest text-white/60">AI</span>
    </div>
  );
}

/** One <Canvas> for the whole game. Lane C. */
export function Stage({
  view,
  onTap,
  onUndo,
  paused = false,
}: {
  view: View;
  onTap: (k: Machine) => void;
  onUndo?: (k: Machine) => void;
  /** Nothing is drawn while true (the intro film covers the screen); models keep loading behind it. */
  paused?: boolean;
}) {
  const [tier, setTier] = useState<Tier>(startTier);
  // (fixed at the first render: a computer stays a computer after its tier steps down)
  const [computer] = useState(() => tier === 'pc' || tier === 'pcLow');
  const [webgl] = useState(hasWebGL);
  const q = TIERS[tier];
  // The canvas covers the window; canvasDpr keeps it within ~Full HD on bigger screens (quality.ts, 15 Nov perf audit).
  const [box, setBox] = useState(() => ({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 }));
  useEffect(() => {
    const onResize = () =>
      setBox((b) =>
        b.w === window.innerWidth && b.h === window.innerHeight && b.dpr === window.devicePixelRatio
          ? b
          : { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 },
      );
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const dpr = canvasDpr(q.dpr, box.dpr, box.w, box.h);
  // ~60 fps at most on 120/144/240 Hz screens (frameCap.ts)
  useEffect(() => (MAX_FPS > 0 ? capFrameRate(window, MAX_FPS) : undefined), []);
  // A calm scene is not redrawn (saves battery); storms, the day passing and launch animate.
  const animating = view.phase === 'run' || view.phase === 'launch' || view.level > 0 || view.alert;
  // A computer is also measured while the astronaut walks (frames come back to back then): a slow laptop that only
  // ever walks on quiet days now steps down too (15 Nov perf audit).
  const [walking, setWalking] = useState(false);
  useEffect(() => {
    const check = () => queueMicrotask(() => setWalking(walkInput.keys.size > 0));
    window.addEventListener('keydown', check);
    window.addEventListener('keyup', check);
    window.addEventListener('blur', check);
    return () => {
      window.removeEventListener('keydown', check);
      window.removeEventListener('keyup', check);
      window.removeEventListener('blur', check);
    };
  }, []);

  // The AI sky replaces the point stars once its picture is in (HfSky); until then, or if it fails, the stars stay.
  const [skyIn, setSkyIn] = useState(false);
  // AI graphics post effects (features.hfPost): computer tier only, dropped with the tier when FPS falls.
  const hfPost = features.hfPost && tier === 'pc';
  const fringe = useState(() => new THREE.Vector2(0.0006, 0.0004))[0];

  if (!webgl) return <Fallback />;

  return (
    <SceneBoundary fallback={<Fallback />}>
      <Canvas
        className="!fixed inset-0"
        dpr={dpr}
        // 'percentage' = PCFShadowMap; `true` would ask for PCFSoftShadowMap, removed in three 0.187.
        shadows={q.shadow > 0 ? 'percentage' : false}
        // 'never' under the intro film: the hidden base was drawn ~60×/s behind it and the film stuttered (15 Nov).
        // Back to 'demand'/'always' → R3F's store change invalidates, so the first frame comes by itself.
        frameloop={paused ? 'never' : animating ? 'always' : 'demand'}
        // far 3000: the real skyline is drawn at 1.5–1.95 km (Terrain.tsx), the stars behind it at 2.4 km
        camera={{ fov: 50, near: 0.1, far: 3000, position: [8, 5, 14] }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        onCreated={({ gl, camera }) => {
          // Tiers without post effects: the renderer tone-maps. With them, EffectComposer forces NoToneMapping and
          // the <ToneMapping> effect below does the same curve; the exposure is read from here in both cases.
          gl.toneMapping = TONE.three;
          gl.toneMappingExposure = EXPOSURE;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          if (overview) camera.lookAt(0, 1, 0);
          // the loading splash (index.html) fades once the first frames are drawn
          requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new Event('hb7:ready'))));
        }}
        // (Right click on a building takes a battery back; the browser menu would cover the game.)
        onContextMenu={(e) => e.preventDefault()}
        role="img"
        aria-label="Moon base"
      >
        {/* FPS is only real while frames are drawn back to back. In demand mode (calm scenes) the gaps between redraws
            read as 1–10 fps and stepped a fast laptop down to DPR 1 with no anti-aliasing ("144p"), so a computer is
            measured only while the scene animates, with computer bounds (pcFpsBounds). Phones: as before. */}
        {(!computer || animating || walking) && (
          <PerformanceMonitor onDecline={() => setTier((t) => LOWER[t])} flipflops={2} bounds={computer ? pcFpsBounds(tier) : undefined} />
        )}
        {/* Stars do not twinkle: no air. Replace with the Yale Bright Star catalogue when ready. */}
        {!skyIn && <Stars radius={2400} depth={50} count={2500} factor={4} fade={false} speed={0} />}
        {features.hfSky && <HfSky big={computer} onReady={setSkyIn} />}
        {features.hfSky && features.light && <HfSun azDeg={sunAzimuth(view)} />}
        <Earth view={view} />
        <Storm level={view.level} />
        {features.light ? <Light sunAzDeg={sunAzimuth(view)} shadowSize={q.shadow} /> : <ambientLight intensity={0.6} />}
        {!computer && q.shadow > 0 && <ShadowDiet />}
        <Suspense fallback={null}>
          <BaseScene view={view} onTap={onTap} onUndo={onUndo} />
          {/* (here, not in parts/Habitat.tsx: Habitat is not given view.res) */}
          <Tanks res={view.res} />
          {features.robotArm && features.character && <RobotArm />}
          {!overview && <Rig view={view} />}
          {!overview && freeWalk && <WalkDebug />}
          <Preload all />
        </Suspense>
        {(q.bloom || q.vignette) && (
          <EffectComposer multisampling={q.msaa} resolutionScale={tier === 'pc' ? 1 : 0.5}>
            {q.bloom ? <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} /> : <></>}
            {/* After Bloom (which reads the scene's HDR values), merged into the same pass: no extra draw call. */}
            <ToneMapping mode={TONE.post} />
            {q.vignette ? <Vignette eskil={false} offset={0.2} darkness={0.75} /> : <></>}
            {/* A camera's look: a touch more contrast (deeper shadows, brighter sunlit dust), the faintest colour fringe
                at the edges and fine sensor grain over the black sky. */}
            {hfPost ? <BrightnessContrast brightness={-0.02} contrast={0.12} /> : <></>}
            {hfPost ? <ChromaticAberration offset={fringe} radialModulation modulationOffset={0.35} /> : <></>}
            {hfPost ? <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.045} /> : <></>}
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
