# HOME BY SEVEN — Space Apps 2026 project page, draft to paste

> **Editor note — do not paste.**
>
> **Fields from the 2026 guide.** The eight fields below have the names and the order of "Project Page Form Field
> Instructions" in the 2026 Project Submission Guide (dated 13 November 2026), page
> https://www.spaceappschallenge.org/resources/project-submission-guide/ (URL as recorded in `docs/REVIEW.md`; the
> saved copies do not carry their own page URL — the only Space Apps resources link in them is
> https://www.spaceappschallenge.org/resources/). Saved copies in the repo:
> `shots/sa-guides/sa-submission-guide.json` (submission guide, cut at 14,000 characters: it ends inside "Submitting
> Your Project"), `shots/sa-guides/sa-judging-guide.json` (2026 Judging & Awards Guide, complete) and
> `shots/sa-guides/shots-challenge-resources.json` (the challenge's Resources tab,
> https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/?tab=resources). The guide gives
> no character limits for any field: **[TODO human: read the counter under each box in the form and cut to fit.]**
> All content in the form must be in English (guide). Submission closes Sunday 15 November, 11:59 p.m. Tashkent time
> (the team's own gate G5 is 13:00).
>
> Draft by Claude Code, 15 Nov 2026, for Aminjon to edit; moved to the 2026 fields the same day. Every fact comes
> from the repo (`docs/STATUS.md`, `docs/DATA.md`, `docs/rules.md`, `CREDITS.md`, `docs/AI-USE.md`, `README.md`,
> `src/engine/weeks.json`, `public/data/media/*/manifest.json`, `public/data/facts.json`). `[TODO human]` = a person
> fills it in or confirms it; delete the marker before pasting. Lines starting with "Editor note" are for us, not
> for the form.
>
> Wording rules for the page (judges and `npm run check`): English only. Never "live data", "real-time", "according
> to NASA", "NASA says", "NASA confirmed", "everything is real", "Gateway", "NRHO", "6.5-day orbit". Name the
> instrument and the date instead.

---

## 1. Project Name

> **Editor note — do not paste.** Guide: "What is the name of your project?"

HOME BY SEVEN

## 2. High-Level Project Summary

> **Editor note — do not paste.** Guide: "Provide a high-level summary of your project. What did you develop? How
> does it address the challenge? Why is it important?" No length limit in the guide.

HOME BY SEVEN is a browser 3D game that trains a junior astronaut (ages 7–14, mainly 7–12) through one week at a
Moon base near the south pole. Each day the child carries batteries to the base's machines — air and water, the Moon
garden, the workshop, moonwalks for science — and decides when the crew shelters from a solar storm. The storm is one
real week from the archive: hourly radiation measured by the CRaTER instrument on NASA's Lunar Reconnaissance
Orbiter, with flare, particle and coronal mass ejection records from NASA's DONKI. On the way home the game reveals
the date. In the first mission it is 25–31 October 2021, with the X1.0 flare of 28 October. Every number is labelled
measured, computed, game rule or story. The game opens in any browser, with no install and no login, in English,
Uzbek and Russian. Nothing about the child leaves the device.

## 3. Link to Project Demo

> **Editor note — do not paste.** Guide: a demo is required, "either in the form of a 7-slide presentation
> (including title and introductory slides) or a 30-second or less video presentation", hosted outside the Space Apps
> site (YouTube, Google Drive, GitHub, OneDrive, Dropbox …) behind "a publicly accessible link" that does "not
> require a password, permission, or registration". A video may be spoken in another language but "MUST include
> English language subtitles"; slide decks must be in English. "Projects that exceed these limits will not be
> eligible for Global Judging." Demos and final projects "may not include any images, video, audio, or other likeness
> to persons under 18 years old" — so no playtest children on camera or in photos. SI images and video need a
> visible watermark (see field 6).

[TODO human: link to the 30-second video. It must be 30 s or less, open without login, have English subtitles burned
in, show no person under 18, and every AI-made shot (for example the lander renders) must carry a visible "AI" mark.]

## 4. Link to Final Project

> **Editor note — do not paste.** Guide: "Share a publicly accessible link to your final project" (a website, a
> cloud host or a code repository); it must "not require a password, permission, or registration". Test it in a
> private browser window. For a new website the guide recommends (not requires) a FortiGuard Web Filter
> Classification request, Company Name "N/A".

- Play: https://shokhanasser1.github.io/astravan-nasa-space-app-challenge/
- Code: https://github.com/Shokhanasser1/astravan-nasa-space-app-challenge
- [TODO human: Cloudflare mirror URL, if the team uploads one.]

## 5. Detailed Project Description

> **Editor note — do not paste.** Guide: "Provide additional details about your project. Some questions to consider
> are: What exactly does it do? How does it work? What benefits does it have? What do you hope to achieve? What
> tools, coding languages, hardware, or software did you use to develop your project?" No length limit in the guide.
> The subheadings below follow those questions.

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
- **Storm watch.** When a fast coronal mass ejection or a strong flare is recorded before the storm, Houston radios a
  storm watch: a storm may come.
- **Shelter from the storm.** On a flare alert you choose: everyone inside, half a day inside, keep working, or ask
  Houston. The wall and time inside cut the storm dose; moonwalks add to it.
- **Night log.** Up to three "cause → effect" lines tell you what your choices did.
- **The robot arm.** On the rover's roof rides a robot arm made from NASA's Curiosity rover model. Switch on the
  scanner and move your own forearm and hand in front of the camera: the arm follows you.
- **That week's sky.** The Sun's direction is computed with JPL Horizons. The Earth hangs at its real height, wearing
  the NASA GIBS picture of that very day.
- **Go home.** On Day 7 the lander takes off. You get a crew score, a science score and a title: Balance Master, Bold
  Explorer, Careful Commander, Cadet in Training or Late Ride Home. The game never says "you lost".
- **The reveal.** On the way home you learn that the storm really happened. The screen shows the real dates, the
  radiation measured by LRO CRaTER, the SDO picture of the flare before and at its peak, the whole Earth that day
  (DSCOVR EPIC, on the weeks from 2018 on) and the Moon as Earth saw it at that hour.

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
  with steps at 2, 10, 100 and 1,000 times normal. DONKI flare and particle records time the alerts: an X-class flare
  that day, or the week's first particle event. A front-side coronal mass ejection of 600 km/s or more, or an M5+
  flare, before the first storm day sets a storm watch.
- **Honest labels.** Every number on screen carries one of four labels: measured, computed, game rule or story. Tap a
  gauge to see what it means. CRaTER measures in lunar orbit behind thin shielding, so the game shows "times normal",
  never a dose "at the base". A day with fewer than 18 measured hours is marked "partly measured".
- **Engine.** The rules (batteries, storm dose, scores) are pure TypeScript, tested against golden plans for the week
  of 25 October 2021. One reducer turns the game state into the view that the 3D scene and the interface read.
- **3D.** three.js with React Three Fiber in one canvas: the real LOLA heights and a skyline out to 60 km with
  mountain shadows, models from NASA 3D Resources, and procedural base buildings adapted from ASTRA (MIT). Quality
  steps down on slower phones.
- **Checked.** 309 unit tests, plus Playwright end-to-end tests that play the whole week to the reveal on phone and
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
- The radio voices are adult synthetic voices (AI text-to-speech) or the device's text-to-speech. No child's voice is
  recorded or imitated.

HOME BY SEVEN is not an official NASA product and is not endorsed by NASA.

### Works anywhere

Open the link in a browser; there is nothing to install. On a laptop or desktop it plays with keyboard and mouse;
phones and tablets get a touch stick and one big action button. English, Uzbek and Russian are one button away, and
every line of the game exists in all three.

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
  to show them. Numbers only: no names, photos or voices of the children.]
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
- AI tools: Claude Code (Anthropic), OpenAI Codex and Gemini (Antigravity CLI); Google Gemini TTS (radio voices);
  ElevenLabs Music and Meshy, both through Higgsfield (background music; the kid astronaut's body). What each one did
  is logged in `docs/AI-USE.md` in the repo, and AI-made models, music and voices are marked in `CREDITS.md`.
- Hardware: any phone, tablet or laptop with a web browser; a camera only for the optional scanner.

## 6. Use of Super Intelligence (SI)

> **Editor note — do not paste.** Guide: "Did you utilize any Super Intelligence (SI) tools and software in preparing
> your solution? If yes, how did you use them?" SI tools (machine learning, chatbots, image generation, large language
> models) are permitted, but "SI should not be used to (come up with your idea of how to solve the challenge)."
> Generated content "may not use, contain, or modify any NASA branding or design elements (such as the NASA logos,
> flags, or mission identifiers)". Images and videos: "a visible watermark"; audio, code and data: acknowledge SI
> generation "in descriptive text and metadata". "This SI question is for data‑collection purposes only, and your
> response will not be seen by the judges" — judges see the marks inside the project (the "AI" mark on images and
> video, `docs/AI-USE.md`, `CREDITS.md`, the AI-tools line in field 5). No length limit in the guide.

Yes. We used SI tools a lot, and we log every significant piece of SI-assisted work in `docs/AI-USE.md` in the repo;
AI-made models are also marked in `CREDITS.md`.

- **Idea and design:** the idea, the game design, the rules and the decisions are the team's. [TODO human: confirm —
  the idea is the team's; say exactly what AI helped write.]
- **Code:** much of the code, the tests, and the build and data scripts were written with Claude Code (Anthropic;
  Claude Opus 5.5, Claude Sonnet 5.5 and Claude Fable 5.2 models), then reviewed and tested by the team. OpenAI Codex
  reviewed code.
- **Research:** Claude agents and Gemini (Antigravity CLI) helped search NASA services, references and past
  challenges. Claude agents collected the 17 facts in our fact sheet; each value was checked against the quoted
  source page.
- **Game text:** Claude wrote the first drafts of the English game text; Aminjon (team) edits them. Claude also
  drafted the Uzbek and Russian lines, which Aminjon (team) checks. [TODO human: confirm the uz/ru check is
  finished.]
- **Data:** NASA data is downloaded and converted by scripts, some written with AI. The measurements are unchanged
  NASA records; no data is generated.
- **3D models made with AI** (marked in `CREDITS.md`):
  - the playable kid astronaut's body: a textured 3D model made by Meshy (multi-image-to-3D, run on Higgsfield) from
    the team's own concept picture; the team fitted its rig and made the animation clips in Blender, and painted the
    visor solid gold so no face is shown;
  - the furnished interiors of the habitat, greenhouse, workshop and lander (`public/models/interiors`), modelled in
    Blender by AI-written scripts (Claude Code), with NASA reports as reference only;
  - a new lunar lander (`blender/lander_v2`), built by AI-written Blender scripts; it is not in the game and is used
    only in the video and pitch, where its renders carry a visible "AI" mark.
- **NASA-based models:** the rover, RASSOR, LRO, the Habitat Demonstration Unit modules and Curiosity's robot arm
  come from NASA 3D Resources and were prepared by the team in Blender, partly with AI-written scripts (logos, flags
  and insignia removed). OpenAI Codex made sky panoramas and a render gallery for our Blender work, outside the game.
- **Music and voices:** the three background music loops are AI-made (ElevenLabs Music v2.5 through Higgsfield). The
  radio voices in English and Russian are AI-made with Google Gemini TTS from the game's own text, adult voices only.
  Every music and voice file says "AI-generated" in its metadata; a line without a made voice uses the device's
  text-to-speech. Sound effects are made in code.
- **Images:** the avatars, rocks and ground textures in the game are drawn by code, not AI images. [TODO human: confirm
  the game ships no AI-generated picture, and that every AI image or shot in the video carries a visible "AI" mark.]

## 7. NASA Data

> **Editor note — do not paste.** Guide: "Provide specific details about what NASA data and resources you used. To be
> eligible for a Global Award, you must use at least one NASA data or resource." No length limit in the guide.

Most important first. Weeks used (start dates): 2012-01-20, 2012-03-04, 2012-05-14, 2013-05-19, 2014-01-04,
2014-10-20, 2017-09-06, 2018-08-06, 2020-06-01, 2021-10-25, 2023-12-12, 2024-02-20, 2024-03-20, 2024-05-08.

| Dataset | Dates used | What it does in the game | Link |
|---|---|---|---|
| NASA LRO CRaTER hourly absorbed dose rate, via NASA OSDR RadLab | the 14 weeks and the 27 days before each (record: 2009-06-26 to 2024-06-18) | The radiation level of each day, the measured curve on the reveal screen | https://visualization.osdr.nasa.gov/radlab/ |
| NASA DONKI, CCMC: flares (FLR), solar energetic particles (SEP) and coronal mass ejections (CME) | each of the 14 weeks | Flare alerts and particle arrival times; a fast front-side CME (600 km/s or more) or an M5+ flare before the storm triggers the storm-watch radio call | https://ccmc.gsfc.nasa.gov/tools/DONKI/ |
| NASA SDO AIA 131 Å browse images, cropped and resized | the 8 weeks from 2017 to 2024 | The Sun on the flare day, and before and at the flare's peak on the reveal (one picture of Day 4 on the two quiet weeks) | https://sdo.gsfc.nasa.gov/ |
| NASA SDO AIA 131 Å rendered by Helioviewer.org (NASA/ESA Helioviewer Project) | the 6 weeks from 2012 to 2014 (the SDO browse archive starts in 2016) | Same as above | https://api.helioviewer.org/docs/v2/ |
| NASA EOSDIS GIBS: VIIRS SNPP true colour (2017–2024 weeks); MODIS Terra, gaps filled from MODIS Aqua (2012–2014 weeks) | every day of the 14 weeks | The Earth of that day on the globe in the sky | https://nasa-gibs.github.io/gibs-api-docs/ |
| NASA DSCOVR EPIC natural colour | the flare day (Day 4 on the two quiet weeks) of the 7 weeks from 2018 to 2024 | The whole Earth that day on the reveal screen | https://epic.gsfc.nasa.gov/ |
| NASA GSFC Scientific Visualization Studio, Moon Phase and Libration (Dial-A-Moon) | the flare's hour (Day 4 on the two quiet weeks), all 14 weeks | The Moon as Earth saw it, on the reveal screen | https://svs.gsfc.nasa.gov/3894 (one page per year) |
| JPL Horizons (NASA JPL Solar System Dynamics) | every day of the 14 weeks | Sun direction, Earth position and phase (computed) | https://ssd.jpl.nasa.gov/horizons/ |
| NASA LRO LOLA heights, GSFC Planetary Geodesy Data Archive: Site01 "Connecting ridge" 5 m/px (Barker et al. 2021) and 80–90°S 20 m/px (Barker et al. 2023) | static | The real ground and skyline around the base | https://pgda.gsfc.nasa.gov/products/78 · https://pgda.gsfc.nasa.gov/products/90 |

The SDO pictures are extreme-ultraviolet (131 Å) images in false colour. Credits: "Courtesy of NASA/SDO and the AIA,
EVE, and HMI science teams." (2012–2014 weeks: "… Image rendered by Helioviewer.org."); Earth of the day: "NASA
EOSDIS GIBS / Worldview"; Earth photos: "NASA EPIC Team"; Moon: "NASA/Goddard Space Flight Center Scientific
Visualization Studio".

NASA resources (3D models, prepared by the team in Blender):

| Resource | Use | Link |
|---|---|---|
| NASA 3D Resources: Space Exploration Vehicle, RASSOR, crew lock bags, Lunar Reconnaissance Orbiter, and base buildings after the Habitat Demonstration Unit, Apollo Lunar Module and Deep Space Network 34-meter antenna | Base decor, the LRO on the reveal screen, buildings | https://github.com/nasa/NASA-3D-Resources |
| NASA Science / NASA/JPL-Caltech "Curiosity" rover model | The robot arm (cut from the rover into three moving parts) | https://science.nasa.gov/resource/curiosity-rover-3d-model/ |

## 8. Space Agency Partner Data and Other References

> **Editor note — do not paste.** Guide: "List all of the data, resources, and tools used in your project. Resources
> should include any code, text, and images (even if they are open source or freely available) that you used when
> creating your project. If you are using any copyrighted materials, make sure you have permission to use them." The
> 2026 Space Agency Partners: Angola National Space Programme Management Office, Bahrain Space Agency, Brazilian Space
> Agency, CSA, ESA, ISRO, Italian Space Agency, JAXA, KASA, Mohammed Bin Rashid Space Center, National Space
> Activities Commission of Argentina, Nigeria's NASRDA, Paraguayan Space Agency, Senegalese Space Studies Agency,
> Spanish Space Agency, Turkish Space Agency, UK Space Agency. The second required checkbox (see below) says every
> external resource is listed in this field, so keep the `CREDITS.md` line. No length limit in the guide.

**Space Agency Partner data.** No dataset from a partner agency is used directly. The SDO pictures for the 2012–2014
weeks are rendered by Helioviewer.org, a joint NASA/ESA project. [TODO human: keep this line, or write "None".]

**References.**

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
  https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html); NASA NSSDCA, LRO CRaTER experiment page
  2009-031A-06 (https://nssdc.gsfc.nasa.gov/nmc/experiment/display.action?id=2009-031A-06); NASA, Artemis base camp
  article — the Moon's 1.5° axial tilt
  (https://www.nasa.gov/humans-in-space/nasas-artemis-base-camp-on-the-moon-will-need-light-water-elevation/); NASA
  Science Moon facts, Top Moon Questions and "Shadows near the Moon's South Pole"
  (https://science.nasa.gov/moon/facts/, https://science.nasa.gov/moon/top-moon-questions/,
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

---

## Not a form field: team page and the two required checkboxes

> **Editor note — do not paste.** The truncated submission-guide copy stops before the checkboxes; the complete
> judging-guide copy (`shots/sa-guides/sa-judging-guide.json`, "Eligibility for Global Judging") quotes both. Tick
> them on the form:
>
> 1. "I have read and understand the project submission requirements as contained in the NASA Space Apps Project
>    Submission Guide, and I agree to the Participant Terms and Conditions and Privacy Policy."
> 2. "I confirm that the submitted project represents my team’s original work and that all external resources
>    including code, text and images (even if they are open source or freely available) used in the project are
>    listed in the References field of the project submission form. In creating our solution, my team has not used
>    any copyrighted materials (i.e., music, images, text, etc.) that we don’t have permission to use."
>
> Team rules from the same guide: every member registered for the same Local Event (not waitlisted) and on the
> Members tab; at most six members; no new members after submission closes.

- Team: Team Astrakarvan, Tashkent (local event: Tashkent)
- Challenge: Build a Junior Astronaut Mission Trainer
- [TODO human: team page — add every member (at most 6) with their roles, all on the Tashkent Local Event; tick both
  checkboxes above.]

## Open items before submitting

- [TODO human] Character limits: read the counter under each box (the 2026 guide gives none).
- [TODO human] Demo video link (field 3); Cloudflare mirror (field 4).
- [TODO human] Team page and the two checkboxes (section above); a project image if the team wants one (the page
  takes JPG, PNG or GIF up to 10 MB; no videos or documents).
- [TODO human] One honest sentence on work done before the hackathon, if the team wants it on the page: the git
  history starts on 14 Nov at 12:20, after the start; the concept was written earlier (`docs/STATUS.md`, "Risk for the
  pitch").
- [TODO human] Real-phone check, uz/ru check, playtest numbers, AI marks in the video (fields 3, 5 and 6).
- Click "Submit for Judging" before Sunday 15 November, 11:59 p.m. Tashkent time.
