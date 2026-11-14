# blender/ — NASA 3D modellari, Blender sahnalari va o'yin uchun 3D assetlar

**Kim:** Samandar (Claude agentlari, Codex va Blender 5.3 yordamida). **Qachon:** 14.11.2026.
**Manba:** jamoaning "Oy karvonsaroyi Model Studio" artifaktidagi 35 ta NASA 3D modeli (NASA 3D Resources / NASA Science).

> EN: Samandar's 3D work, lean copy. Game-ready GLBs (35 NASA models, 8.9 MB total, Draco + WebP, metres, Y-up, `COL_*` colliders), a rigged astronaut, 360° skies, station backgrounds and sprites as WebP, NASA size comparisons and fact cards. Nothing here is shipped yet: it is outside `public/`. **Sarvar** (models lane) decides what goes into `public/models/` through `npm run glb` and `CREDITS.md`. The heavy `.blend` files and the original NASA GLBs stay on Samandar's Mac and can be rebuilt from the scripts.

## Nima bor

| Papka | Ichida |
|---|---|
| `game3d/assets/` | **35 ta o'yinga tayyor GLB** (jami 8.9 MB): metr, Y yuqoriga, origin pastki markazda, old tomoni +Z, Draco + WebP ≤1024, har birida `COL_<id>` collider. `_build/` — qayta yasash skriptlari |
| `game3d/manifest.json`, `game3d/ASSETS_README.md` | Har model: fayl, poligon, o'lcham (m), massa (kg, NASA manbasi bilan), gravitatsiya (Yer 9.81 / Oy 1.62 / Mars 3.71), Three.js'da yuklash |
| `game3d/characters/` | Skeletli astronavt (`astronaut.glb`) + qurish/tekshirish skriptlari |
| `game3d/demo/` | Three.js sinov demosi (yurish, sakrash, Oy gravitatsiyasi) — ish davom etmoqda |
| `game3d/sky/` | 6 ta 360° osmon (WebP 2048×1024): `yer_dusk`, `xks_orbit`, `oy_sky`, `mars_day`, `mars_sunset`, `koinot_space` + `sky.json` (quyosh yo'nalishi) |
| `renders/final_gpu/<bekat>/` | 19 ta fon, 1920×1080 WebP (GPU, 256 sample): yer 3, xks 2, oy 4, mars 4, koinot 6 |
| `renders/<bekat>/sprites/` | 37 ta shaffof sprite (WebP ≤512) |
| `sprites_8dir/` | 35 model × 8 tomon varaqlari, `single/` 3/4 ko'rinish, `KATALOG.webp` |
| `docs/<bekat>_nasa_taqqoslash.md` | Har model: haqiqiy NASA o'lchami ↔ model, farqlar, nima tuzatilgan; `docs/ref/` — NASA suratlari |
| `facts/` | 35 ta fakt kartochka (uz + en, manbali) va `TEKSHIRUV.md` (mustaqil fakt-tekshiruv) |
| `scenes/<bekat>/*.py` | Blender sahnalarini noldan quradigan skriptlar (`.blend` shulardan chiqadi) |
| `source/INVENTORY.md`, `SOURCES.md` | 35 asl modelning o'lchami, poligoni, topilgan logolar, NASA manbalari |
| `tools/` | GPU bilan yakuniy render skripti |

## Muhim

- **NASA brend qoidasi:** hamma teksturadagi NASA logolari, bayroqlar, yamoqlar, "Canada" yozuvi va shtrix-kodlar bo'yab yopilgan.
- **Kredit:** "3D models: NASA 3D Resources / NASA Science (NASA/JPL-Caltech). Not endorsed by NASA." Yer: NASA Blue Marble Next Generation. Oy: NASA SVS CGI Moon Kit (LRO). Mars: NASA/JPL-Caltech/USGS Viking.
- **`public/` ga o'tkazish:** jamoa qoidasiga ko'ra (`.claude/skills/add-asset`) modellarni Sarvar `npm run glb` orqali o'tkazadi (≤1 MB/model, jami <5 MB) va `CREDITS.md` ga qator qo'shadi.
- **Faktlar:** Hadley tog'i ~4.5 km (studiyadagi "1.5 km" xato). Gateway: NASA 24.03.2026 da to'xtatgan — o'yinda "rejalashtirilgan edi". SEV kabinasi quyosh bo'ronida ekipajni 72 soatgacha himoya qiladi, eshigi atrofida 2.5 sm muz qatlami bor (NASA SEV fact sheet) — bu suv devori g'oyasining NASA asosi.
- **Oy maydoni (level)** hali yo'q — jamoa spec'idan keyin quriladi.
- **Repo'da yo'q (og'ir):** `.blend` sahnalar (~200 MB), asl NASA GLB (60 MB), PNG asl renderlar — Samandarning kompyuterida (`~/dev/oy-karvonsaroyi-3d`), skriptlardan qayta quriladi.
