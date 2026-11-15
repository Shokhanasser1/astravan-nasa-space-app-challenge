# HOME BY SEVEN — Space Apps 2026 project page, draft to paste

**Fields from the 2025 guide — check against 2026.** The 2026 Project Submission Guide (out 13 Nov) could not be
opened from this laptop (https://www.spaceappschallenge.org/resources/project-submission-guide/ gave a TLS error; web
search found only the 2025 edition). Field names below follow the 2025 guide
(https://web.archive.org/web/20251004151100/https://www.spaceappschallenge.org/resources/project-submission-guide/)
and `.claude/skills/submission-check/SKILL.md`. Character limits are unknown: **[TODO human: read the limit under
each box in the form and cut to fit.]**

Draft by Claude Code, 15 Nov 2026, for Aminjon to edit. Every fact comes from the repo (`docs/STATUS.md`,
`docs/DATA.md`, `docs/rules.md`, `CREDITS.md`, `docs/AI-USE.md`, `README.md`, `src/engine/weeks.json`).
`[TODO human]` = a person fills it in or confirms it; delete the marker before pasting.

Wording rules for the page (judges and `npm run check`): English only. Never "live data", "real-time", "according to
NASA", "NASA says", "NASA confirmed", "everything is real", "Gateway", "NRHO", "6.5-day orbit". Name the instrument
and the date instead.

---

## 1. Project Name

HOME BY SEVEN

## 2. Team and challenge

- Team: Team Astrakarvan, Tashkent (local event: Tashkent)
- Challenge: Build a Junior Astronaut Mission Trainer
- [TODO human: team page — add every member (at most 6) and their roles; tick "global judging"; tick "I have read
  the Project Submission Guide".]

## 3. High-Level Project Summary

HOME BY SEVEN is a browser 3D game that trains a junior astronaut (ages 7–14, mainly 7–12) through one week at a
Moon base near the south pole. Each day the child carries batteries to the base's machines — air and water, the Moon
garden, the workshop, moonwalks for science — and decides when the crew shelters from a solar storm. The storm is one
real week from the archive: hourly radiation measured by the CRaTER instrument on NASA's Lunar Reconnaissance
Orbiter, with flare and particle records from NASA's DONKI. On the way home the game reveals the date. In the first
mission it is 25–31 October 2021, with the X1.0 flare of 28 October. Every number is labelled measured, computed,
game rule or story. The game opens in any browser, with no install and no login, in English, Uzbek and Russian.
Nothing about the child leaves the device.

## 4. Project Demo (link)

[TODO human: link to the 30-second video. It must be 30 s or less, open without login, have English subtitles burned
in, and every AI-made shot (for example the lander renders) must carry a visible "AI" mark.]

## 5. Final Project (link)

- Play: https://shokhanasser1.github.io/astravan-nasa-space-app-challenge/
- Code: https://github.com/Shokhanasser1/astravan-nasa-space-app-challenge
- [TODO human: Cloudflare mirror URL, if the team uploads one.]

## 6. Project Details

### What it does

You are a junior astronaut on a Moon base near the south pole, on the real ground of the Shackleton–de Gerlache
ridge. You have seven days. On Day 7 the lander must take the crew home: home by seven.

- **Check in.** CAPCOM (mission control) briefs you. You pick a cadet badge — a call sign from a list and a patch
  colour — or a guest pass. No name is asked.
- **Walk the base.** Your suited astronaut walks, lopes and jumps at Moon gravity (1.62 m/s²). After a jump a
  hologram shows the physics (h = v²/2g). You can walk into the habitat, the greenhouse, the workshop and the lander.
  Day 1 teaches you step by step.
- **Hear the radiation.** A dosimeter clicks at the day's measured dose rate: slow on a quiet day, a rattle on the
  storm day.
- **Plan the day.** Each morning brings the day's radiation level from the real week. A day card brings one event
  with two choices, and each button shows its price (dust on the solar wing, a clogged water filter, ice in a dark
  crater). Then you take batteries from the hub — six a day, a game rule — and carry them to the machines: Life
  Support (air and water), Moon Garden, Workshop (builds a regolith sandbag wall), Explore (moonwalks for science)
  and, on Day 7, Launch. Every machine shows its result before you confirm.
- **Shelter from the storm.** On a flare alert you choose: everyone inside, half a day inside, keep working, or ask
  Houston. The wall and time inside cut the storm dose; moonwalks add to it.
- **Night log.** Up to three "cause → effect" lines tell you what your choices did.
- **The robot arm.** Next to the base stands a robot arm made from NASA's Curiosity rover model. Switch on the scanner
  and move your own forearm and hand in front of the camera: the arm follows you.
- **That week's sky.** The Sun's direction is computed with JPL Horizons. The Earth hangs at its real height, wearing
  the NASA GIBS picture of that very day.
- **Go home.** On Day 7 the lander takes off. You get a crew score, a science score and a title: Balance Master, Bold
  Explorer, Careful Commander, Cadet in Training or Late Ride Home. The game never says "you lost".
- **The reveal.** On the way home you learn that the storm really happened. The screen shows the real dates, the
  radiation measured by LRO CRaTER, the SDO picture of the flare before and at its peak, the whole Earth that day
  (DSCOVR EPIC) and the Moon as Earth saw it at that hour.

The first mission is always 25–31 October 2021. On 28 October an X1.0 flare peaked at 15:35 UTC and the first
particle event was logged at 16:16 UTC (both DONKI). On 29 October CRaTER measured a day mean of 520.7 µGy/h near the
Moon, about 42 times its calm value of 12.4 µGy/h. Later missions use the other 13 archived weeks from 2012 to 2024:
quiet weeks, false alarms, storms and severe storms. A teacher can give a whole class the same week with a class code
in the link (for example `?week=2021-10-25`).

### How it works

- **Bundled data, not fetched.** Build-time scripts download each source once, trim it, record the exact request URL
  and download date, and ship it with the game. The game makes no call to a NASA server while you play. It is an
  archive: 14 weeks from 2012 to 2024 (the CRaTER record in RadLab ends in June 2024).
- **From measurement to game.** For each day the game divides CRaTER's mean dose rate by the calm value (the 25th
  percentile of the 27 days before the week). That ratio is measured. A game rule turns it into a level from 0 to 4,
  with steps at 2, 10, 100 and 1,000 times normal. DONKI flare and particle records time the alerts.
- **Honest labels.** Every number on screen carries one of four labels: measured, computed, game rule or story. Tap a
  gauge to see what it means. CRaTER measures in lunar orbit behind thin shielding, so the game shows "times normal",
  never a dose "at the base". A day with fewer than 18 measured hours is marked "partly measured".
- **Engine.** The rules (batteries, storm dose, scores) are pure TypeScript, tested against golden plans for the week
  of 25 October 2021. One reducer turns the game state into the view that the 3D scene and the interface read.
- **3D.** three.js with React Three Fiber in one canvas: the real LOLA heights and a skyline out to 60 km with
  mountain shadows, models from NASA 3D Resources, and procedural base buildings adapted from ASTRA (MIT). Quality
  steps down on slower phones.
- **Checked.** 239 unit tests, plus Playwright end-to-end tests that play the whole week to the reveal on phone and
  laptop screens. Every green push deploys to GitHub Pages.

### Privacy and safety

- No account and no login. A cadet badge is a call sign picked from a list plus a patch colour. No name, age, e-mail,
  face or voice is asked for or stored.
- Progress stays in this browser on this device. Nothing about the child is sent anywhere; the switch that would send
  results to a server is off.
- The camera is used only by the optional robot-arm scanner (and a hand-control experiment). Tracking runs on the
  device (MediaPipe). The picture is not stored and not sent, and the scanner window blurs everything except the hand
  and forearm, so no face is shown. The tracking model files download from Google's model store the first time the
  scanner is switched on.
- Voices are adults or the device's text-to-speech.

HOME BY SEVEN is not an official NASA product and is not endorsed by NASA.

### Works anywhere

Open the link in a browser; there is nothing to install. On a laptop or desktop it plays with keyboard and mouse;
phones and tablets get a touch stick and one big action button. English, Uzbek and Russian are one button away, and
every line of the game exists in all three. [TODO human: Aminjon checks the Uzbek and Russian lines Claude drafted.]

### Benefits

- Children feel why space weather matters to astronauts. The storm is invisible, so they learn to read the
  measurement and act early.
- They practise trade-offs: a fixed number of batteries, a price on every choice, the result shown before they commit.
- They learn to read data: what is measured, what is computed, and what is a game rule.
- They see that shielding and time indoors protect people.
- Teachers get a free tool for any browser, in Uzbek too, with a class code so a whole class plays the same real week.
- Safe by design: no account, and nothing about the child leaves the device.

### What we hope to achieve

- A child closes the game knowing that a solar storm really reached the Moon on 28–29 October 2021, and what a crew
  can do about it.
- [TODO human: results of the Sunday playtest with children — three questions before and after — if the team wants
  to show them.]
- Next: "Your week" (any date in the CRaTER record), and the same storms seen from Mars and the ISS, using RadLab's
  MSL-RAD and ISS dosimeter records for the same dates.

### Tools, languages, hardware and software

- Languages: TypeScript, JavaScript, Python, CSS.
- Game: React 19, three.js 0.187, React Three Fiber 9, drei, postprocessing, Tailwind CSS 4, Lexend font, Lucide
  icons, MediaPipe Tasks Vision (hand and pose tracking on the device), Workbox via vite-plugin-pwa.
- Build and test: Vite 8, Vitest, Playwright, gltf-transform (model compression), GitHub Actions, GitHub Pages.
- 3D: Blender (models, rigging, animation; Python scripts).
- Data: Node.js and Python scripts (`scripts/data/`) for RadLab, DONKI, SDO, Helioviewer, GIBS, EPIC, SVS, JPL
  Horizons and LOLA.
- AI tools: see "Use of AI" below.
- Hardware: any phone, tablet or laptop with a web browser; a camera only for the optional scanner.

## 7. NASA Data

Most important first. Weeks used (start dates): 2012-01-20, 2012-03-04, 2012-05-14, 2013-05-19, 2014-01-04,
2014-10-20, 2017-09-06, 2018-08-06, 2020-06-01, 2021-10-25, 2023-12-12, 2024-02-20, 2024-03-20, 2024-05-08.

| Dataset | Dates used | What it does in the game | Link |
|---|---|---|---|
| NASA LRO CRaTER hourly absorbed dose rate, via NASA OSDR RadLab | the 14 weeks and the 27 days before each (record: 2009-06-26 to 2024-06-18) | The radiation level of each day, the measured curve on the reveal screen | https://visualization.osdr.nasa.gov/radlab/ |
| NASA DONKI: flares (FLR) and solar energetic particles (SEP), CCMC | each of the 14 weeks | Flare alerts and particle arrival times | https://ccmc.gsfc.nasa.gov/tools/DONKI/ |
| NASA SDO AIA 131 Å browse images, cropped and resized | 2016–2024 weeks | The Sun on the flare day, and before and at the flare's peak on the reveal | https://sdo.gsfc.nasa.gov/ |
| NASA SDO AIA 131 Å rendered by Helioviewer.org (NASA/ESA Helioviewer Project) | 2012–2014 weeks (the SDO browse archive starts in 2016) | Same as above | https://api.helioviewer.org/docs/v2/ |
| NASA EOSDIS GIBS: VIIRS SNPP true colour (from 2016); MODIS Terra, gaps filled from MODIS Aqua (before 2016) | every day of the 14 weeks | The Earth of that day on the globe in the sky | https://nasa-gibs.github.io/gibs-api-docs/ |
| NASA DSCOVR EPIC natural colour | the storm day, 7 weeks from 2017 | The whole Earth that day on the reveal screen | https://epic.gsfc.nasa.gov/ |
| NASA GSFC Scientific Visualization Studio, Moon Phase and Libration (Dial-A-Moon) | the storm's hour, all 14 weeks | The Moon as Earth saw it, on the reveal screen | https://svs.gsfc.nasa.gov/3894 (one page per year) |
| JPL Horizons (NASA JPL Solar System Dynamics) | every day of the 14 weeks | Sun direction, Earth position and phase (computed) | https://ssd.jpl.nasa.gov/horizons/ |
| NASA LRO LOLA heights, GSFC Planetary Geodesy Data Archive: Site01 "Connecting ridge" 5 m/px (Barker et al. 2021) and 80–90°S 20 m/px (Barker et al. 2023) | static | The real ground and skyline around the base | https://pgda.gsfc.nasa.gov/products/78 · https://pgda.gsfc.nasa.gov/products/90 |

The SDO pictures are extreme-ultraviolet (131 Å) images in false colour. Credits: "Courtesy of NASA/SDO and the AIA,
EVE, and HMI science teams." (2012–2014 weeks: "… Image rendered by Helioviewer.org."); Earth photos: "NASA EPIC
Team"; Moon: "NASA/Goddard Space Flight Center Scientific Visualization Studio".

NASA resources (3D models, prepared by the team in Blender):

| Resource | Use | Link |
|---|---|---|
| NASA 3D Resources "Astronaut" | The playable astronaut, rigged and animated by the team | https://science.nasa.gov/3d-resources/astronaut/ |
| NASA 3D Resources: Space Exploration Vehicle, RASSOR, crew lock bags, Lunar Reconnaissance Orbiter, and base buildings after the Habitat Demonstration Unit, Apollo Lunar Module and Deep Space Network 34-meter antenna | Base decor, the LRO on the reveal screen, buildings | https://github.com/nasa/NASA-3D-Resources |
| NASA Science / NASA/JPL-Caltech "Curiosity" rover model | The robot arm (cut from the rover into three moving parts) | https://science.nasa.gov/resource/curiosity-rover-3d-model/ |

## 8. Space Agency Partner Data

No dataset from a partner agency is used directly. The SDO pictures for the 2012–2014 weeks are rendered by
Helioviewer.org, a joint NASA/ESA project. [TODO human: keep this line, or write "None".]

## 9. References

- Every third-party file and its licence: `CREDITS.md` in the repo. Our code: MIT licence.
- ASTRA — Junior Astronaut Mission Trainer, by HamzaAli0911 and the ASTRA contributors (MIT),
  https://github.com/HamzaAli0911/astra-mission-trainer — their procedural models (habitat with its regolith shield,
  greenhouse, lab, lander, hexagonal pads, equipment cabinet, solar arrays, battery bank, ice drill, science scout),
  material kit and Moon light recipe, vendored at commit 843d779 with our changes marked; our interface style
  (colours, type, panels, buttons, icon style) is adapted from theirs, with no text, names or images taken.
- Libraries in the game: React 19.3.1 and React DOM (MIT); three.js 0.187.0 (MIT); React Three Fiber 9.8.2, drei
  10.7.9, @react-three/postprocessing 3.2.2 (MIT); postprocessing 6.39.6 (Zlib); Tailwind CSS 4.3.5 (MIT); Workbox via
  vite-plugin-pwa 2.0.0 (MIT); MediaPipe Tasks Vision 1.2.0 with the Hand and Pose Landmarker lite models
  (Apache-2.0); Draco decoder (Apache-2.0); Lexend font (OFL-1.1); Lucide icons (ISC).
- Development tools: Vite 8, Vitest 5, TypeScript 7, Playwright 1.65, gltf-transform 4.5, gltfjsx 6.5 (MIT /
  Apache-2.0); Blender.
- Fact sources for the numbers in the game: NASA NSSDCA Moon and Earth Fact Sheets
  (https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html,
  https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html); NASA Science Moon facts, Top Moon Questions and
  "Shadows near the Moon's South Pole" (https://science.nasa.gov/moon/facts/,
  https://science.nasa.gov/moon/top-moon-questions/,
  https://science.nasa.gov/resource/shadows-near-the-moons-south-pole/); NASA Space Place, Moon distance
  (https://spaceplace.nasa.gov/moon-distance/en/); NASA, laser ranging between Earth and Moon
  (https://www.nasa.gov/missions/laser-beams-reflected-between-earth-and-moon-boost-science/); NASA SVS, LRO first
  year (https://svs.gsfc.nasa.gov/10595); LCROSS and LRO mission pages (https://science.nasa.gov/mission/lcross/,
  https://science.nasa.gov/mission/lro/); DONKI flare record FLR 18096
  (https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/18096/-1); SDO data channels (https://sdo.gsfc.nasa.gov/data/channels.php);
  VIIRS at LAADS DAAC (https://ladsweb.modaps.eosdis.nasa.gov/missions-and-measurements/viirs/).
- NOAA Space Weather Scales — the idea of a 10× step per level, used as a game rule
  (https://www.spaceweather.gov/noaa-scales-explanation).
- SDO data use rules (https://sdo.gsfc.nasa.gov/data/rules.php).

## 10. Use of Artificial Intelligence (AI)

We used AI tools a lot, and we log every significant piece of AI-assisted work in `docs/AI-USE.md` in the repo.

- **Idea and design:** the idea, the game design, the rules and the decisions are the team's. Our concept documents
  were drafted with AI help (Claude) and edited by the team.
- **Code:** much of the code, the tests, and the build and data scripts were written with Claude Code (Anthropic;
  Claude Opus 5.5, Claude Sonnet 5.5 and Claude Fable 5.2 models), then reviewed and tested by the team. OpenAI Codex
  reviewed code.
- **Research:** Claude agents and Gemini (Antigravity CLI) helped search NASA services, references and past
  challenges. Claude agents collected the 17 facts in our fact sheet; each value was checked against the quoted
  source page.
- **Text:** Claude wrote first drafts of the English game text; Aminjon (team) edits them. Claude also drafted Uzbek
  and Russian lines for Aminjon to check. [TODO human: say whether the uz/ru lines were checked.]
- **Data:** NASA data is downloaded and converted by scripts, some written with AI. The measurements are unchanged
  NASA records; no data is generated.
- **3D models:** AI-made models are marked in `CREDITS.md`: the furnished interiors of four buildings (modelled in
  Blender by Claude Code, with NASA reports as reference only) and a new lunar lander used only in the video and pitch
  (geometry made by AI-written Blender scripts; its renders carry a visible "AI" mark). The NASA-based models
  (astronaut, rover, RASSOR, LRO, Curiosity's robot arm) come from NASA 3D Resources and were prepared by the team in
  Blender, partly with AI-written scripts; some astronaut animation clips were also made by AI-written scripts.
  OpenAI Codex made sky panoramas and a render gallery for our Blender work, outside the game.
- **Images and voice:** the avatars, rocks and ground textures in the game are drawn by code, not AI images. English
  and Russian narration uses the device's text-to-speech. [TODO human: confirm the game ships no AI-generated picture,
  and that every AI image or shot in the video carries a visible "AI" mark.]

## 11. Open items before submitting

- [TODO human] Exact 2026 field names and character limits (see the top of this file).
- [TODO human] Demo video link (section 4); Cloudflare mirror (section 5).
- [TODO human] Team page: members, roles, global judging box, "read the guide" box; project image if the form asks for
  one; tags if the form has them.
- [TODO human] One honest sentence on work done before the hackathon, if the team wants it on the page: the git
  history starts on 14 Nov at 12:20, after the start; the concept was written earlier (`docs/STATUS.md`, "Risk for the
  pitch").
- [TODO human] Real-phone check, uz/ru coverage, playtest numbers, AI marks in the video (sections 6 and 10).
