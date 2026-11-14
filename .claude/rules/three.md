---
paths:
  - 'src/scene/**'
  - 'public/models/**'
---

# 3D scene (three.js 0.187 + React Three Fiber 9)

Distilled from the ui-ux-pro-max three.js guidelines (MIT) and concept 3.0's light recipe, adapted to R3F.

- **One `<Canvas>` for the whole game** (`src/scene/Stage.tsx`), never remounted. The scene receives `view` and
  `onTap` only (`BaseScene`); it never imports the engine or computes numbers.
- **Never allocate in `useFrame`**: no `new Vector3`, arrays or objects per frame; create once (`useMemo`, refs) and
  mutate. Keep per-frame animation state in refs, not React state.
- **Shadows**: only the Sun casts; only important meshes cast/receive. Shadow map is recomputed once per day
  (`gl.shadowMap.needsUpdate = true`), never every frame.
- **Light**: one directional Sun at 1.5°, `HemisphereLight` ≤ 0.06, ACES tone mapping, sRGB output. Greyscale test:
  three tones only. Glowing parts are separate meshes with `emissiveIntensity` ~3.2 and `toneMapped={false}`;
  only they pass Bloom (threshold 1, mipmapBlur). Effects: Bloom + Vignette, nothing else (N8AO only on the pc tier, L2).
- **Share** geometry and materials between meshes; use `InstancedMesh` (drei `<Instances>`) for 50+ repeats (rocks).
- **Particles**: `Points` + `BufferGeometry`, mutate the position array in place, set `needsUpdate = true`;
  start ≤ 3,000 (quality tier decides), profile on a phone before raising.
- **Dispose**: R3F disposes what it created; dispose textures/materials you create by hand when a scene unmounts.
- **Models**: GLB, `npm run glb` (meshopt + WebP 1024) or `gltfjsx --transform` (Draco: decoder from `/draco/`, never
  a CDN). Wrap in `<Suspense fallback={<Proxy/>}>` so the grey shape stays if the model is late; scale with `fit()`.
  All six buildings are models or all six are grey shapes: never mix styles.
  Budget: phone < 100k triangles, ~50 draw calls, models < 5 MB total; pc < 500k, ~100, < 20 MB. Textures ≤ 2048 px (≤ 4096 absolute max).
- **DPR**: capped by the quality tier (≤ 1.5); `PerformanceMonitor` steps quality down, never up during a scene.
- **Materials**: `meshBasicMaterial` for things that do not need light (UI in 3D, sky dome); standard for regolith/base.
- **Pause** heavy work when the tab is hidden; respect `prefers-reduced-motion` (no camera shake, slower dust).
- **No GSAP** (licence). Animate with `useFrame` + damping (`THREE.MathUtils.damp`) or drei helpers.
- Calm scene: `frameloop="demand"` (set in Stage). Labels are DOM elements positioned by camera projection, not drei `<Html>`.
- Camera is not in the child's hands: no free orbit; it floats and looks where the event is (`view.focus`).
- The storm (concept 3.0 replaces the falling lines): do not draw radiation — it is invisible. Show it as the dosimeter
  (sound), scout-camera "snow" and sparks in the eyes inside the shelter, all driven by `view.ratio`. Cut fallback:
  dosimeter only. If lines are kept anywhere, all of them in ONE `lineSegments`.
