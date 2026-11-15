# blender/interiors — bino interyerlari (Blender, NASA manbalari bilan)

**Kim:** Samandar (Claude Code agentlari + Blender 5.3). **Qachon:** 15.11.2026.

> EN: The furnished interiors of the four base buildings — habitat (two decks, airlock), greenhouse, workshop/lab,
> lander cabin — each with its door and a `DoorOpen` clip, built entirely by script in Blender at ASTRA's native
> metres so it fits inside ASTRA's shell. The game loads the optimised GLBs from `public/models/interiors/`
> (`src/scene/Interiors.tsx`; walking inside: `src/walk/rooms.ts`, footprints from each `walk.json`).
> Every real-world fact (what is inside, sizes, colours, the door type) comes from a NASA API response (NTRS reports,
> NASA Image and Video Library) listed with its request and document id in `<b>/SOURCES.md`. AI-made models,
> disclosed in `CREDITS.md`. The `.blend` files, raw GLBs and downloaded NASA PDFs/photos are not in git.

| Papka | Ichida |
|---|---|
| `SPEC.md` | Topshiriq: qoidalar, masshtab, tugun nomlari, cheklovlar (uchburchak, material, KB) |
| `<b>/build_<b>.py` | Hammasini noldan quradi: `Blender -b --factory-startup -P build_<b>.py` (lab/habitat: `render_<b>.py` — renderlar) |
| `<b>/HANDOFF.md` | Ichida nima bor, tugunlar, `DoorOpen` klipi, raqamlar, fit check, o'yin ASTRA qobig'idan nimani kesishi kerak, ochiq masalalar |
| `<b>/SOURCES.md` | Har bir fakt: ishlatilgan qiymat · NASA qiymati · manba (API so'rovi + NTRS id/sahifa yoki nasa_id) |
| `<b>/walk.json`, `fit_check.json`, `stats.json` | Yurish hitboxlari (three koordinatalari, asl metr), qobiqqa sig'ish tekshiruvi, raqamlar |
| `<b>/renders/*.webp` | Cycles renderlari (960×540) |
| `tools/` | ASTRA qobig'ini Blender'ga chiqarish: `dump_astra.ts` → `import_ref.py` (`ref/*_shell.blend`, gitda yo'q) |

Optimallash (materiallar saqlanishi uchun `--palette false` shart):
`gltf-transform optimize <b>_interior.glb <b>.glb --compress meshopt --texture-compress webp --texture-size 1024 --flatten false --palette false`
