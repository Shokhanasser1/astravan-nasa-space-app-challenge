# AI graphics pack (`public/hf/`, features `hfSky` `hfGround` `hfRocks` `hfPost` `hfArt`)

Made 15 Nov 2026 on Higgsfield (the team's Plus plan) for branch `aminjon/hf-graphics`. Every part loads after the
first frame and falls back to the old look if its file is missing; each has its own switch in `src/config/features.ts`.

| File | What | Model (Higgsfield job) | Processing |
|---|---|---|---|
| `sky/milkyway-{4k,2k}.webp` | All-sky Milky Way, 4k on computers, 2k on phones (`src/scene/HfSky.tsx`) | FLUX 3 Image 4k 2:1 (`e208797e`) | `sky.py`: seamless wrap, star reduction, poles |
| `ground/regolith-{albedo,slope}-{1k,512}.webp` | Regolith close-up, one tile ≈ 2.7 m (`src/scene/hfAssets.ts`, `Terrain.tsx`) | GPT Image 2.6 high 4k (`e8e40322`) | `ground.py … regolith`: seamless, mean 0.5, slope from relief |
| `ground/macro-{albedo,slope}-{1k,512}.webp` | The coarse regolith layer, one tile ≈ 14 m: craterlets with brighter ejecta, stones (`uMacro` in `src/look/terrain.js`) | Nano Banana Pro 4k (`e32ca3a5`) | `ground.py … macro` |
| `rocks/boulder-a.glb` (1,232 tris, 1024 px) | The 40–60 big blocks, computers only | Nano Banana Pro photo (`78ec566f`) → Tripo H3.1 image-to-3D PBR (`bf7a2dfd`) | `gltf-transform optimize --compress meshopt --texture-compress webp --texture-size 1024 --simplify-ratio 0.42` |
| `rocks/boulder-b.glb` (310 tris, 512 px) | The ~200 boulders on crater rims, computers only | Nano Banana Pro photo (`26e0a011`) → Tripo H3.1 (`a3c097a6`) | same, `--texture-size 512 --simplify-ratio 0.11` |
| `art/splash-wide.webp`, `art/splash-tall.webp` | Loading splash in `index.html` (visible "AI" mark) | Cinema Studio 2.5 4k (`7a7c0c74`, `dc33e73a`) | resized, WebP |
| `art/launch.webp` | Finale banner on the truth screen, every ending that flies home (visible "AI" mark) | Cinema Studio 2.5 4k (`923f104d`) | resized, WebP |
| `art/base.webp` | Still picture when the device has no WebGL (visible "AI" mark) | Cinema Studio 2.5 4k (`2085f5b1`) | resized, WebP |
| `art/crash.webp` | Crash scene, not used in the game yet (for the pitch, a story card later) | Cinema Studio 2.5 4k (`1a27a77f`) | resized, WebP |

Sky orientation (`skyOrientation()` in `HfSky.tsx`, test `HfSky.test.ts`): worked out at load from the title camera
(`src/scene/title.ts`, middle of its arc), so the galactic core (u 0.38, v 0.55 of the picture) sits 28° right of the
reception view at the skyline and the band climbs 24° to the left; a new title shot keeps the Milky Way in frame.

Rules kept: no NASA logo, flag or lettering in any picture (the first crash picture had one and was regenerated); no
people in the pictures; every full-screen picture carries a visible "AI" mark; textures inside the 3D scene are
disclosed in `CREDITS.md` and `docs/AI-USE.md`.
