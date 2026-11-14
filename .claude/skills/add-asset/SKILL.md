---
name: add-asset
description: Use when adding any third-party file or package to the game - art, sprites, sounds, music, icons, emoji, fonts, images, NASA imagery, or an npm library. Checks the licence is allowed, places files with their licence, and adds the CREDITS.md row Space Apps requires.
---

# Add an asset or library

Space Apps: "all resources, even open source resources, must be cited", or NASA may withdraw the award.

## 1. Licence gate

| Allowed | Not allowed |
|---|---|
| CC0, MIT, ISC, Apache-2.0, BSD, OFL-1.1, Unlicense | CC BY, CC BY-SA (Twemoji, OpenMoji), GSAP licence, unDraw, Pixabay, Remix Icon |
| NASA imagery with credit and no endorsement implied | NASA logos, Meatball/Worm, seals, mission patches, crew insignia |
| Shapes we draw in code | Models/textures from three.js or drei examples unless their own licence allows it |
| NASA 3D Resources, Astromaterials 3D (keep NASA ID + credit) | Sketchfab models without CC0/CC BY-compatible terms checked |
| | Competitors' code or art; anything without a stated licence; AI-generated images, audio, video |

No asset made with tools of Chinese-owned companies (Tripo/VAST, Hunyuan3D/Tencent): the Space Apps 2026 guide
reviews activity with Chinese-owned entities. No AI image or video showing anyone under 18, no flags, NASA logos or
mission identifiers; every AI image or video carries a visible "AI" mark (Project Submission Guide 2026).

If the licence is unclear, stop and tell the teammate; do not add the file.

## 2. Place the files

- One folder per pack: `public/models/<pack-name>/ (or public/textures/, public/audio/)`, lowercase names with hyphens (GitHub Pages is case-sensitive).
- Copy only the files the game uses, plus the pack's licence file (`License.txt`, `LICENSE`, `OFL.txt`) into the same folder.
- Images: ≤ 4096 px per side; prefer sprite sheets/atlases; keep each file small (school Wi-Fi).
- 3D models: GLB only. Optimize before committing: `npm run glb -- in.glb public/models/<pack>/name.glb --texture-compress webp`.
  Check the triangle count against docs/PERFORMANCE.md (≤ 100k in view on a phone).
- NASA images: keep the NASA ID and credit line; never a NASA logo or mission patch.
- Kenney packs: download by hand in the browser (scripts get 403), unzip, copy what is needed.
- npm library: `npm install --save-exact <pkg>@<version>`; if its licence text ships to players (fonts, bundled code),
  copy the licence into `public/licenses/<name>-<licence>.txt`.

## 3. Credit it

Add a row to the right table in `CREDITS.md`. The row must contain the folder path (`public/models/<pack-name>`):

```
| public/textures/kenney-ui-pack | Buttons and panels | Kenney (kenney.nl) | CC0 | https://kenney.nl/assets/ui-pack |
```

SDO images: credit line exactly "Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams."

## 4. Verify

`npm run check` must pass (it fails on a pack folder without a licence file or without a CREDITS.md row, and on
upper-case file names). Then load the asset in the scene's preload with a lowercase key equal to the file name.
