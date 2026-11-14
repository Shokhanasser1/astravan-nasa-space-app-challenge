---
name: add-asset
description: Use when adding any file the game ships that the team did not write as code - 3D models, textures, art, images, sounds, voices, fonts, icons, NASA imagery, AI-made images or models, or an npm library. Checks the licence, places the files with their licence or credit file, and adds the CREDITS.md row Space Apps requires.
---

# Add an asset or library

Space Apps: "all resources, even open source resources, must be cited", or NASA may withdraw the award.
You may add files only to **your lane's** folders (`CLAUDE.md`): models/textures → Sarvar, `public/art` → Asilbek,
voices → Aminjon, `public/data` → Data. In `CREDITS.md` add rows only for your own files.

## 1. Licence gate

| Allowed | Not allowed |
|---|---|
| CC0, MIT, ISC, Apache-2.0, BSD, Zlib, OFL-1.1, Unlicense | CC BY, CC BY-SA (e.g. Twemoji, OpenMoji), GSAP licence, unDraw, Pixabay licence, Remix Icon |
| NASA imagery and data with credit and no endorsement implied | NASA logos, Meatball/Worm, seals, mission patches, crew insignia |
| NASA 3D Resources, Astromaterials 3D (keep the NASA ID + credit) | Sketchfab or other store models unless the page says CC0 |
| Shapes we draw in code | Models/textures from three.js or drei examples unless their own licence is in the left column |
| Files the team made by hand (credit the team member) | Competitors' code or art; anything without a stated licence |
| AI-made images, video and 3D models **made by the team**, when the tool's terms allow use in a public project, the tool is listed in `docs/AI-USE.md`, and it is marked: images and video carry a small "AI" watermark in a corner (the one allowed text); 3D models are marked "AI" in `CREDITS.md` and on the Data page | AI-made voices or audio (voices are recorded by adults or use `speechSynthesis`); AI images with text inside, NASA insignia, or a real person's face |

If the licence is unclear, stop and tell the teammate; do not add the file. CC BY is excluded by team choice, not
by law; to add a CC BY file, ask Shoxjahon aka first.

## 2. Place the files

- One folder per pack: `public/models/<pack>/`, `public/textures/<pack>/`, `public/audio/<pack>/`,
  `public/art/<pack>/`. Lowercase names with hyphens (GitHub Pages is case-sensitive). No loose files directly in
  those folders — `npm run check` rejects them.
- Put the licence file (`LICENSE`, `License.txt`, `OFL.txt`) in the folder. For team-made or AI-made files, put a
  `credit.txt` instead: who made it, with which tool, the date, and "AI-made" when it is.
- Images: ≤ 2048 px per side, WebP; keep each file small (school Wi-Fi). No text inside images except the "AI"
  watermark on AI-made ones.
- 3D models: GLB only, optimized: `npm run glb -- in.glb public/models/<pack>/<name>.glb` (meshopt + WebP 1024).
  Each model ≤ 1 MB (`npm run check` rejects bigger), all models < 5 MB, triangles per `docs/PERFORMANCE.md`.
  Then `npm run gltfjsx -- public/models/<pack>/<name>.glb --types` for the component (lane C wires it in).
- Voices: `public/audio/voice-uz/<key in lower case>.ogg` + `.m4a` (see `.claude/rules/hud-text.md`).
- NASA images: keep the NASA ID and credit line; never a NASA logo or mission patch.
- Kenney packs: download by hand in the browser (scripts get 403), unzip, copy only what is used.
- npm library: **do not install it yourself.** Ask Shoxjahon aka (owner of `package.json`) with the package, exact
  version, licence and why; he runs `npm install --save-exact <pkg>@<version>`. If its licence text ships to players
  (fonts, bundled code), its licence goes into `public/licenses/<name>-<licence>.txt` and a row under "Code shipped".

## 3. Credit it

Add a row to the right table in `CREDITS.md`. The row must contain the folder path:

```
| public/models/hb7-buildings | Six base buildings | Sarvar (team), Tripo via Higgsfield, AI-made | Team-made; tool terms allow use | https://... |
| public/textures/kenney-ui-pack | Buttons and panels | Kenney (kenney.nl) | CC0 | https://kenney.nl/assets/ui-pack |
```

For an AI tool, also add one line to `docs/AI-USE.md` (send it to Aminjon if it is not your file).
SDO images: credit line exactly "Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams."

## 4. Verify

`npm run check` must pass: it fails on upper-case file names, loose files, a pack folder without a licence or
credit file, a pack folder with no `CREDITS.md` row, and a model over 1 MB. Then load the asset where it is used
(for models: `useGLTF` in the generated component, inside `<Suspense>`) and prove it with `./shot.sh`.
