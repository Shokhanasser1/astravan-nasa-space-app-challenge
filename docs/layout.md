# Base layout (for the scene)

From the developer guide §03 (read from the PDF page). Metres; Y is up; the camera looks at the base from the
south-east. Flat ground for 11 m around the base, craters beyond, a ridge on the horizon at 130–240 m.

| Object | Code name / file | X, m | Z, m | Machine it powers |
|---|---|---|---|---|
| Habitat (Turar modul) | `Habitat` / `hab.glb`, 3.6 m tall | 0.2 | 0.8 | Life Support (`ls`) |
| Moon garden (Oy bogʻi) | `Garden` / `garden.glb` | −5.6 | −2.4 | Garden (`gh`) |
| Workshop (Ustaxona) | `Workshop` / `workshop.glb` | 6.0 | 4.2 | Workshop (`ws`) |
| Lander (Qoʻnish apparati) | `Lander` / `lander.glb` | 5.6 | −8.6 | Launch (`launch`) |
| Solar wing (Quyosh qanoti) | `SolarWing` (code) | −7.4 | −7.2 | — (bent at landing; "Wing Fixed") |
| Power hub (Quvvat tuguni) | `Hub` (code) | −3.6 | 4.6 | — (six lights = batteries) |
| Scout (Skaut) | `Scout` / `scout.glb` | −3.4 | 10.6 | Explore (`sc`) |
| Antenna / Dish | `Dish` / `dish.glb` | 10.5 | −2.5 | — (module) |

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
