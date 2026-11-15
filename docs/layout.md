# Base layout (for the scene)

From the developer guide §03 (read from the PDF page). Metres; Y is up; the camera looks at the base from the
south-east. Flat ground for 11 m around the base, craters beyond, a ridge on the horizon at 130–240 m.

| Object | Code name / file | X, m | Z, m | Machine it powers |
|---|---|---|---|---|
| Habitat (Turar modul) | `Habitat` (ASTRA, 5.8 m tall, r 3.2) | 0.2 | 0.8 | Life Support (`ls`) |
| Moon garden (Oy bogʻi) | `Garden` (ASTRA greenhouse 4.4 m) | −9.0 | −3.2 | Garden (`gh`) |
| Workshop (Ustaxona) | `Workshop` (ASTRA lab, 3.4 m tall) | 8.9 | 5.9 | Workshop (`ws`) |
| Lander (Qoʻnish apparati) | `Lander` (ASTRA, 4.3 m tall) | 7.6 | −12.4 | Launch (`launch`) |
| Solar wing (Quyosh qanoti) | `SolarWing` / ASTRA arrays | −11.5 | −12.0 | — (bent at landing; "Wing Fixed") |
| Power hub (Quvvat tuguni) | `Hub` (code) | −5.5 | 6.5 | — (six lights = batteries) |
| Scout (Skaut) | `Scout` / `scout.glb` | −5.2 | 15.5 | Explore (`sc`) |
| Antenna / Dish | `Dish` / `dish.glb` | 15.7 | −4.2 | — (module) |
| Life-support tanks | `parts/Tanks.tsx` (air/water level bands) | 0.2 | 7.75 | — (shows `res.air`) |

**15 Nov ~05:00 (Shoxjahon aka: "the base models are small"):** ASTRA's buildings at real-ish size next to the
1.85 m astronaut and the plan spread ~1.5× around the habitat; the numbers live in `src/scene/layout.ts` (LAYOUT,
RADIUS, PAD, BATTERY_BANK, PARKED_ROVER, TANKS) — code wins over this table. Flat pad 22 m.

**15 Nov ~13:00 — Samandar, variant A (`features.hduHabitat` / `?hdu`, off by default):** the base core is NASA's
Habitat Demonstration Unit as three modules at real size (shell r 2.1 m, 5.8 m tall) joined by two pressurised
tunnels, every module walk-in (eight sections, the X-Hab loft, a centre ladder). Its own plan, `HDU_PLAN` in
`src/scene/layout.ts` (code wins over this table): the complex along x across the back of the flat pad, doors to the
north, module centres = the machines' sites; everything else in front, ≥ 2 m of walkway between hitboxes, all on the pad
(tests `src/walk/hduWorld.test.ts`). The HDU outpost 50 m north is off while it is on.

| Object | X, m | Z, m |
|---|---|---|
| C greenhouse module (Garden `gh`) | −12.25 | −4.0 |
| A habitat module (Life Support `ls`) | 0.75 | −4.0 |
| B lab module (Workshop `ws`) | 13.75 | −4.0 |
| Power hub | −1.5 | 4.5 |
| Lander | 9.5 | 11.5 |
| Scout | −7.0 | 16.0 |
| Dish | 17.0 | 8.0 |
| Solar wing / arrays | −13.5 | 11.0 |
| Battery bank | −18.5 | 3.5 |
| Parked crew rover | 3.5 | 16.0 |
| Life-support tanks | 7.05 | 1.4 |

Rules (developer guide §03–§06):
- No free orbit and no free walking: the child looks around with one finger from a standing point (final version);
  the camera moves only by floating ~1 s to another standing point, and turns to the event by itself (`view.focus`).
- The Sun moves along the horizon like the real one: one lap = 29.5 days, ~12° a day; shadows turn as much.
  Sun elevation 1.5° (concept 3.0). Azimuth per day from `sky.json`.
- Tap a building = add a battery (`onTap('ls' | 'gh' | 'ws' | 'sc' | 'launch')`): a light on the hub goes out,
  the cable lights up (#F0B43C, intensity 2.2; off #3A3F55), windows glow (#FFD98A, intensity 3.2, `toneMapped={false}`).
- Wall: up to three regolith rings around the habitat (#8A7A5C), rising from the ground in 0.6 s; dim until tomorrow.
- Only big bodies cast shadows; poles, boxes, cables and plants do not. Repeats via `<Instances>`.
- Materials: white panel #E9ECF2 (roughness 0.55, metalness 0.05), gold foil #C9972B (0.38 / 0.85),
  black glass #141A33 (0.30 / 0.40), soil #A3A5AD (1.0 / 0).
