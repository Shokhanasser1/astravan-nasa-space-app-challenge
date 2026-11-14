# Credits and licences

Space Apps rules: "all resources, even open source resources, must be cited". Every third-party file has a row
here (use the `add-asset` skill). This project is not an official NASA product and is not endorsed by NASA.

## NASA and agency data (`public/data/`)

| Dataset | Dates | What it drives in the game | Link |
|---|---|---|---|
| NASA LRO CRaTER via RadLab (OSDR) | 2009-06-26 → 2024-06-18, hourly | Dose level each day, dosimeter clicks, truth curve | https://visualization.osdr.nasa.gov/radlab/ |
| NASA DONKI (FLR notifications, SEP) | per week | Flare alerts and particle arrival times | https://ccmc.gsfc.nasa.gov/tools/DONKI/ |
| NASA SDO (AIA 131 Å browse) | per storm week | The real Sun photo on the tablet and in the truth sequence | https://sdo.gsfc.nasa.gov/ |
| NASA EOSDIS GIBS (MODIS/VIIRS true colour) | per day | The Earth of that day on the globe | https://nasa-gibs.github.io/gibs-api-docs/ |
| JPL Horizons (check) | per week | Sun direction, Earth position and phase (computed) | https://ssd.jpl.nasa.gov/horizons/ |
| NASA LRO LOLA heights, NASA GSFC Planetary Geodesy Data Archive: Site01 "Connecting ridge" 5 m/px (Barker et al. 2021) and 80–90°S 20 m/px (Barker et al. 2023) | static | The real ground and skyline around the base in the 3D demo (`public/data/terrain/site.json`, `scripts/data/moon_terrain.py`) | https://pgda.gsfc.nasa.gov/products/78 · https://pgda.gsfc.nasa.gov/products/90 |

Solar images: "Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams."

## Code shipped in the game

| What | Licence | Link |
|---|---|---|
| React 19.3.1, React DOM | MIT | https://github.com/facebook/react |
| three.js 0.187.0 | MIT | https://github.com/mrdoob/three.js |
| React Three Fiber 9.8.2, drei 10.7.9, @react-three/postprocessing 3.2.2 | MIT | https://github.com/pmndrs |
| postprocessing 6.39.6 | Zlib | https://github.com/pmndrs/postprocessing |
| Tailwind CSS 4.3.5 (generated CSS) | MIT | https://github.com/tailwindlabs/tailwindcss |
| Workbox via vite-plugin-pwa 2.0.0 (service worker) | MIT | https://github.com/vite-pwa/vite-plugin-pwa |
| MediaPipe Tasks Vision 1.2.0 (hand tracking, `?hands` only; WASM served from our host) and the Hand Landmarker model (float16, downloaded from Google's model store on first use) | Apache-2.0 | https://github.com/google-ai-edge/mediapipe |

## Models, textures, sounds, fonts (`public/models`, `public/textures`, `public/audio`)

| Folder | What | Author | Licence | Link |
|---|---|---|---|---|
| public/models/nasa-base | Six base buildings: hab (after the Habitat Demonstration Unit), lander (Apollo Lunar Module), scout (Space Exploration Vehicle), dish (Deep Space Network 34-meter); garden and workshop team-made after the NASA HDU | NASA 3D Resources; modified by Samandar (team) in Blender, recoloured to the team palette, logos removed (`credit.txt`) | NASA media guidelines; not endorsed by NASA | https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models |
| public/models/nasa-lro | Lunar Reconnaissance Orbiter for the truth screen | NASA 3D Resources; modified by Samandar (team) in Blender, logos removed (`credit.txt`) | NASA media guidelines; not endorsed by NASA | https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models |
| public/models/nasa-decor | Decor: the crew rover (Space Exploration Vehicle), RASSOR at the ice crater, crew lock bags | NASA 3D Resources; prepared by Samandar (team) in Blender for the catalog (logos removed), web-converted (`credit.txt`) | NASA media guidelines; not endorsed by NASA | https://github.com/nasa/NASA-3D-Resources/tree/master/3D%20Models |
| public/models/astronaut | Astronaut, rigged, clips Idle/Walk/Run/Carry/Pour/Jump/JumpStart/JumpAir/JumpLand (the playable character) | NASA 3D Resources "Astronaut"; flags and insignia removed, rigged (23 bones) and animated by Samandar (team) in Blender (`credit.txt`) | NASA media guidelines; not endorsed by NASA | https://science.nasa.gov/3d-resources/astronaut/ |

## SI (AI) use

| What | Tool | Note |
|---|---|---|
| Code, tests, build and data scripts (parts) | Claude Code (Anthropic) | Reviewed by the team; log in `docs/AI-USE.md` |
| English and Russian narration | Device text-to-speech (`speechSynthesis`) | Synthetic voice, acknowledged here and on the Data page |
| SI images and video (if used) | listed per file in the tables above | Visible "AI" mark; no NASA logos, flags, mission identifiers; no likeness of minors |

## Development and server tools (not shipped)

| What | Licence | Link |
|---|---|---|
| Vite 8, Vitest 5, TypeScript 7, Playwright 1.65, gltf-transform 4.5, gltfjsx 6.5, r3f-perf, leva | MIT / Apache-2.0 | npm |
| Draco decoder (copied from three.js into /draco/) | Apache-2.0 (Google) | https://github.com/google/draco |
| PocketBase 0.40.6 | MIT | https://github.com/pocketbase/pocketbase |
| Caddy 2 | Apache-2.0 | https://github.com/caddyserver/caddy |
| Claude Code skills `systematic-debugging`, `verification-before-completion` | MIT (Jesse Vincent, superpowers) | https://github.com/obra/superpowers |
| Claude Code skill `webapp-testing` | Apache-2.0 (Anthropic) | https://github.com/anthropics/skills |
| Claude Code skills `react-performance`, `vite-patterns`, `e2e-testing`, `ui-demo`, `i18n-sync` | MIT (Affaan Mustafa, ECC) | `.claude/skills/*/LICENSE` |
| three.js guidelines in `.claude/rules/three.md` (adapted) | MIT (ui-ux-pro-max) | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill |
