# References for HOME BY SEVEN

Curated from the team's research (1,425 links in `E:\portfolio\hackaton\docs\havolalar.md`, checked 11–13 Nov)
and the sources of concept 3.0, the developer guide and the 3D guide. Only what this game uses. Grouped by owner.
Facts here were true when researched; re-check anything a judge might ask about.

## 1. Rules, judging, submission (Aminjon)

| Link | Why |
|---|---|
| https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/ | Our challenge page (names DONKI, OSDR, Artemis/Mars data); check the Resources tab |
| https://www.spaceappschallenge.org/2026/local-events/tashkent/ | Tashkent schedule: Sun judging 14:00 |
| https://spaceapps-v2-staging.s3.amazonaws.com/media/documents/Final_Space_Apps_2025_Judging_Guidelines_for_web.pdf | 2025 judging guide: minimum requirements (English page, ≤ 30 s demo, AI declared, links open without login) |
| https://web.archive.org/web/20251004151100/https://www.spaceappschallenge.org/resources/project-submission-guide/ | 2025 submission guide: page fields; "submission is final"; no minors' names, voices or likeness |
| https://www.spaceappschallenge.org/resources/participant-faqs/ | FAQ: AI ("SI") rules, watermarks |
| https://www.spaceappschallenge.org/legal/ | Cite every resource, even open source; licence of the project |
| https://www.spaceappschallenge.org/awards/ | Global award categories (Best Use of Data, Science, Storytelling…) |
| https://www.nasa.gov/nasa-brand-center/images-and-media/ | NASA media guidelines (updated 2026-10-27): no "according to NASA", no insignia with AI imagery |
| https://www.nasa.gov/nasa-brand-center/brand-guidelines/ | No meatball, worm, seal or mission patches |
| https://sdo.gsfc.nasa.gov/data/rules.php | SDO credit line: "Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams." |

## 2. How winners present (Aminjon: page, video, pitch)

| Link | Why |
|---|---|
| https://www.spaceappschallenge.org/2025/awards/global-winners/ | 2025 winners: 8 of 10 open with "‹Name› is a/an ‹type› that…"; 8 of 10 link a running site |
| https://www.spaceappschallenge.org/2025/awards/global-finalists/ | Finalists for comparison |
| https://www.spaceappschallenge.org/2025/find-a-team/zumorroda-x/?tab=project | Henry's Farm: page field order; data named in a "Data Sources" paragraph |
| https://www.spaceappschallenge.org/2025/find-a-team/gaialeo/?tab=project | The most precise "NASA data" field: dataset names with dates and variables |
| https://www.spaceappschallenge.org/2025/find-a-team/team-nomads/?tab=project | Stellar Tales: space-weather stories for kids — finalist, not winner (topic close to ours) |
| https://youtu.be/yEDVRpjkd6o | Stellar Tales 30-second demo: pacing reference |
| https://www.spaceappschallenge.org/2025/find-a-team/pureflow2/?tab=project | Winner that forgot its main dataset in the data field — do not repeat |
| https://www.youtube.com/watch?v=FcyVWf5iX-0 | Finalist demo showing the NASA meatball — what not to do |

## 3. Competitors on our challenge (everyone; Aminjon for the pitch)

~150 public repos; none shows evidence from real children. Do not copy code or art (110 of 140 have no licence).

| Link | What they do |
|---|---|
| https://github.com/SadManQT/nasa-space-apps-2026 | Last Light Academy: 3D station at the Moon south pole, 7 shifts — closest to us |
| https://github.com/StratonDefenseSecurity/junior-astronaut-mission-trainer | Mars Base: 3D third-person, six roles |
| https://github.com/brian53013new/junior-astronaut-mission-trainer | Outpost Control: first-person 3D desk at the south pole |
| https://github.com/HamzaAli0911/astra-mission-trainer | ASTRA: 3D outpost with rover and four cameras |
| https://github.com/WahiduzzamanRahat/juniorastraonauttrainer | Outpost One: budget and event cards |
| https://github.com/mdmithen/Nasa-game-app | Listed in concept 3.0 sources |
| https://github.com/Hlwan-Moe-Aung/solar-alert-trainer | Solar Alert: three decisions inside a 45-minute storm budget |
| https://github.com/Corneafata/flight-rules | Flight Rules: real storm, labels on numbers; says DONKI gives times, not dose |
| https://github.com/ridwanrifat13-afk/sol-keeper | Sol Keeper: recent DONKI events trigger storms; labelled constants |
| https://github.com/kavya-mutyala8/radio-silence-nasa-2026 | Radio Silence: delayed Mission Control replies |
| https://github.com/DrDavidDa/moon-base-pals | Moon Base Pals: ages 6–9, "Listen" narration |
| https://github.com/search?q=%22junior+astronaut+mission+trainer%22&type=repositories | Search to re-check before the pitch |

What we lead with that they do not show: every hour of the storm measured (CRaTER), the real Sun photo and real Earth
of that day, the week revealed at the end, seven predictions, Uzbek language, before/after numbers from real kids.

## 4. NASA data (Claude, Samandar)

| Link | Why |
|---|---|
| https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR?startDate=2021-10-25&endDate=2021-10-31 | DONKI flares, no key (the api.nasa.gov proxy returns 404 as of 14 Nov). Also `SEP`, `CME`, `notifications` |
| https://visualization.osdr.nasa.gov/radlab/ | RadLab: LRO CRaTER hourly dose (team source for `weeks.json`) |
| https://iswa.gsfc.nasa.gov/IswaSystemWebApp/hapi/info?id=CRaTER | Same CRaTER dose via iSWA HAPI (cGy/day, two detector pairs) — cross-check |
| https://iswa.gsfc.nasa.gov/IswaSystemWebApp/hapi/info?id=goesp_part_flux_P5M | GOES proton flux every 5 min (P10, P100) — storm hardness and timing |
| https://crater.unh.edu/instrument.shtml | What CRaTER is (for the Data page) |
| https://sdo.gsfc.nasa.gov/assets/img/browse/ | SDO archive by date: `YYYYMMDD_HHMMSS_1024_0131.jpg` (131 Å = flaring regions) |
| https://sdo.gsfc.nasa.gov/data/channels.php | SDO channels; colours are false colour — say so once |
| https://sdo.gsfc.nasa.gov/data/bestpractice.php | Best practice for SDO browse data |
| https://nasa-gibs.github.io/gibs-api-docs/ | GIBS: Earth of that day (MODIS / VIIRS true colour, WMS by date) |
| https://ssd-api.jpl.nasa.gov/doc/horizons.html | JPL Horizons API: check Sun and Earth positions in `sky.json` |
| https://ssd.jpl.nasa.gov/horizons/manual.html | Horizons manual (observer on the Moon: `CENTER='coord@301'`) |
| https://www.spaceweather.gov/noaa-scales-explanation | NOAA S-scale: each level ten times the previous — same as our levels |
| https://soho.nascom.nasa.gov/hotshots/2000_07_14/ | SOHO "snow" in proton storms — source for the scout-camera snow |
| https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-020-radiation-protection.pdf | TB-020: shelter from water stores; shielding not effective against GCR |
| https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf | NASA-STD-3001: crew radiation limits and shielding guidance |
| https://ntrs.nasa.gov/api/citations/20205000837/downloads/20205000837.pdf | NESC report: behind shielding the dose comes from > 100 MeV protons; alert thresholds |
| https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html | Moon fact sheet: axis tilt, gravity (shadow length, Earth size in the sky) |

## 5. Facts behind the wow and knowledge layers (Aminjon texts, Claude fact sheet)

| Source | Used for |
|---|---|
| Hsu & Horányi, "Ballistic motion of dust particles in the Lunar Roving Vehicle dust trails", Am. J. Phys. 80 (2012) | Dust arcs (gravity measured from Apollo 16 rover dust) |
| Pinsky, Osborne, Bailey, ALFMED experiment, NASA NTRS 19760044009 | Light flashes in astronauts' eyes, ~1 per 2.9 min |
| Colaprete et al., Science 330 (2010) — LCROSS | Water in Cabeus crater |
| Paige et al., Science 330 (2010) — LRO Diviner | Coldest permanently shadowed crater temperatures |
| Apollo 15 hammer and feather, 2 Aug 1971 | Day 1 guess (gravity) |
| Richland, Kornell & Kao, "The pretesting effect", J. Exp. Psych.: Applied 15 (2009) | Why each day starts with a guess |
| White & Gunstone, *Probing Understanding* (1992) — Predict-Observe-Explain | The guess → observe → evidence loop |
| https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/ | Why "6.5-day orbit" and "Gateway" are no longer said (Artemis plan changed in 2026) |

## 6. Kids' design and testing (Asilbek UI, Aminjon test)

| Link | Why |
|---|---|
| https://www.nngroup.com/articles/children-ux-physical-development/ | Touch targets ≥ 2 cm for young children |
| https://www.nngroup.com/articles/kids-cognition/ | Instructions must state the goal, not only the controls |
| https://lisa-anthony.com/wp-content/uploads/2013/04/anthony-et-al-jpuc2013.pdf | Children miss small targets on phones |
| https://joanganzcooneycenter.org/wp-content/uploads/2020/02/SesameWorkshop-2012.pdf | Immediate feedback; sound on every action |
| https://gameaccessibilityguidelines.com/avoid-flickering-images-and-repetitive-patterns/ | No more than three flashes per second (flare and storm effects) |
| https://pure.mpg.de/pubman/item/item_3248990_10/component/file_3383744/30%20Gigerenzer_Do%202021_Postprint_final_JH.pdf | "N out of M" frequencies are understood far better than percent |
| https://www.cs.umd.edu/projects/hcil/jazz/learn/papers/chi-98-sdg.pdf | Shared-screen play for groups (class use) |
| https://kpu.pressbooks.pub/psychmethods4e/chapter/one-group-designs/ | Limits of a before/after test without a control group — say it honestly |

## 7. 3D, models and art (Shoxjahon aka scene, Sarvar models, Asilbek UI)

| Link | Why |
|---|---|
| https://r3f.docs.pmnd.rs/ | React Three Fiber docs (v9) |
| https://drei.docs.pmnd.rs/ | drei: `useGLTF`, `Instances`, `PerformanceMonitor`, `Stars` |
| https://react-postprocessing.docs.pmnd.rs/ | Bloom, Vignette, N8AO |
| https://github.com/pmndrs/gltfjsx | GLB → React component (`npm run gltfjsx`) |
| https://gltf-transform.dev/cli | `npm run glb`: meshopt + WebP compression |
| https://science.nasa.gov/3d-resources/ | NASA 3D models (LRO, astronaut, Moon) — keep NASA ID and credit |
| https://svs.gsfc.nasa.gov/4720 | NASA SVS CGI Moon Kit (Moon colour and elevation maps) |
| https://kenney.nl/assets/space-kit | Kenney Space Kit, CC0 |
| https://quaternius.com/ | Quaternius models, CC0 |
| https://lucide.dev/ | Icons, ISC licence (Asilbek's choice) |
| https://github.com/google/fonts/tree/main/ofl | OFL fonts; check ʻ (U+02BB) renders cleanly in "Oʻzbekiston" (avoid Nunito) |
| https://github.com/unicode-org/cldr/blob/main/common/main/uz.xml | Uzbek letters oʻ gʻ = U+02BB, tutuq belgisi = U+02BC |

**Licences of AI models (Sarvar, read before exporting).** The 3D guide notes: Meshy free plan outputs are CC BY 4.0
with Meshy credited (and Meshy 6/7 cannot be downloaded on the free plan); Tripo free plan is non-commercial with export
limits; Hunyuan3D has its own licence. Generate through Higgsfield's paid plan and record in `CREDITS.md`: tool,
model, date, prompt id, and that the asset is AI-made. Space Apps wants resources freely available — if a tool's
terms are unclear, prefer Kenney/Quaternius (CC0), NASA 3D, or the grey code shapes.

## 8. Web platform pitfalls (Shoxjahon aka, Asilbek)

| Link | Why |
|---|---|
| https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay | No sound before the first tap |
| https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action | Drag is not scroll/zoom |
| https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices | Textures ≤ 4096 work everywhere |
| https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL | Cross-origin images cannot be textures: bundle SDO/GIBS files |
| https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria | localStorage can vanish: write before/after counts on paper too |
| https://vite-pwa-org.netlify.app/guide/service-worker-precache | What the offline cache includes |
| https://vercel.com/docs/deployment-protection | Why not Vercel: judges may hit a login page |
| https://developers.cloudflare.com/pages/configuration/preview-deployments/ | Frozen copy: each deployment keeps its own URL |
