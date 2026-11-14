---
paths:
  - 'src/scene/**'
  - 'public/models/**'
---

# 3D scene (three.js 0.187 + React Three Fiber 9)

Distilled from the ui-ux-pro-max three.js guidelines (MIT) and concept 3.0's light recipe, adapted to R3F.

- **One `<Canvas>` for the whole game** (`src/scene/Stage.tsx`), never remounted. Swap scene content inside it.
- **Never allocate in `useFrame`**: no `new Vector3`, arrays or objects per frame; create once (`useMemo`, refs) and
  mutate. Read game values with `useGame.getState()` inside `useFrame`, not with a hook (no React re-render per frame).
- **Shadows**: only the Sun casts; only important meshes cast/receive. Shadow map is recomputed once per day
  (`gl.shadowMap.needsUpdate = true`), never every frame.
- **Light**: one directional Sun at 1.5°, `HemisphereLight` ≤ 0.06, ACES tone mapping, sRGB output. Greyscale test:
  three tones only. Bloom only above threshold 0.9, half resolution.
- **Share** geometry and materials between meshes; use `InstancedMesh` (drei `<Instances>`) for 50+ repeats (rocks).
- **Particles**: `Points` + `BufferGeometry`, mutate the position array in place, set `needsUpdate = true`;
  start ≤ 3,000 (quality tier decides), profile on a phone before raising.
- **Dispose**: R3F disposes what it created; dispose textures/materials you create by hand when a scene unmounts.
- **Models**: GLB only, optimized with `npm run glb` (meshopt + WebP/KTX2), loaded with drei `useGLTF`, preloaded.
  Budget: ≤ 100k triangles in view on a phone, ≤ 100 draw calls. Textures ≤ 2048 px (≤ 4096 absolute max).
- **DPR**: capped by the quality tier (≤ 1.5); `PerformanceMonitor` steps quality down, never up during a scene.
- **Materials**: `meshBasicMaterial` for things that do not need light (UI in 3D, sky dome); standard for regolith/base.
- **Pause** heavy work when the tab is hidden; respect `prefers-reduced-motion` (no camera shake, slower dust).
- **No GSAP** (licence). Animate with `useFrame` + damping (`THREE.MathUtils.damp`) or drei helpers.
- The scene never computes game numbers: it draws the store (engine state + today's real record).
