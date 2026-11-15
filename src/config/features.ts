/**
 * Switches for what is built (concept 3.0, section 08: cut from the bottom). Cutting a feature = set it to false.
 * Every switch here is read by code and has a plain fallback. A plan that is not built yet is not a switch: the
 * layers still to build are in concept 3.0, section 08 (15 Nov cleanup: 15 switches no code read were removed).
 */
export const features = {
  // The suited astronaut seen from behind outside (src/character/, src/scene/Astronaut.tsx, the rig): walk, lope,
  // jump at Moon gravity, boot prints and dust. Cut → the first-person rig, as before. ?character = one visit.
  character: true,
  // The astronaut's one-shot gestures (src/character/anim.js GESTURES, src/scene/Astronaut.tsx): a battery placed
  // on a building → puts it in from the thigh pocket (taken back → backward); Confirm → checks the wrist tablet;
  // standing still a while → looks around. Cut → Idle only, as before.
  gestures: true,
  // The suit tablet on the astronaut's left forearm (src/scene/suit/wristTablet.ts): oxygen (the base reserve, game rule),
  // radiation (measured), the seal; standing still a moment, it checks the wrist and a HUD hologram rises. Cut → none.
  suitTablet: true,
  // NASA-based buildings (public/models/nasa-base/) replace the grey shells, all six or none; ?models = one visit.
  nasaModels: true,
  // Free walking with hitboxes (src/walk/): W A S D, arrows or the touch stick, from the six standing points.
  // Cut → tap the glowing markers only. ?walk = one visit.
  freeWalk: true,
  // Game keys (E Q Enter Tab M H 1–9 Esc F1), the touch action buttons (✋ ↩ 📟 🎧), the base map and the controls
  // list (src/controls/, docs/specs/2026-11-14-controls-guide.html). Cut → the HUD as before (tap and buttons only).
  controls: true,
  // Entry (docs/specs/2026-11-15-entry.md): the reception desk — the briefing, what the game is and why, then check
  // in with a cadet badge (call sign + patch colour, progress kept on this device) or a guest pass (one mission,
  // nothing saved). Cut → the briefing with Start / Continue and one shared save, as before.
  entry: true,
  light: true, // one Sun at 1.5°, long shadows, tone mapping (cut → plain ambient light)
  // Curiosity's robot arm on the east edge of the base (src/scene/RobotArm.tsx, src/arm/), driven by a camera scan of
  // the player's forearm and hand (K or the button that shows near the arm), the astronaut holding a remote. Needs
  // `character`. Cut → no arm, no button, no hitbox.
  robotArm: true,
  // The crew rover is drivable on computers without ?drive (Shoxjahon aka, 15 Nov ~08:35: PC first): E at its
  // hatch climbs in, W/S/A/D drive, E again climbs out (src/scene/arrival.ts). Phones keep ?drive. Off → ?drive only.
  drive: true,
  // The main habitat as NASA's Habitat Demonstration Unit at 1.5x (15 Nov, Samandar; src/scene/HduHabitat.tsx):
  // a white cylinder and loft dome with a furnished walk-in interior (eight sections, crew loft, ladder) in place of
  // ASTRA's habitat. Off until the team looks at it: `?hdu` shows it for one visit. Cut → ASTRA's habitat.
  hduHabitat: false,
  // The HDU outpost 50 m north (src/scene/outpostSite.ts, Outpost.tsx; 15 Nov, Samandar's proposal): three NASA Habitat
  // Demonstration Unit modules joined by tunnels, somewhere to drive to; exterior and hitboxes only. On computers
  // with a graphics card (Samandar asked ~10:35 to make it live); phones only with `?outpost`. Cut → nothing there.
  outpost: true,
  // Mission quiz (src/quiz/, src/ui/play/Quiz.tsx; 15 Nov): a radio check on nights 2, 4, 6 and a three-question
  // debrief after the truth screen that opens the next mission. Questions only about days already played, numbers
  // from the real week. Cut → the night's Next and the truth screen's Play again work as before.
  quiz: true,
  // The home story (Shoxjahon aka's document "tanqid, yangi ssenariy va o'yin mantig'i", 15 Nov; plan
  // docs/plans/2026-11-15-home-story.md): crash → reach the base → finish the base ship with your wreck's parts → home
  // on Day 7. New words, 4 gauges + hearts, Today's 5, a fact a night, the finale, judge links. The engine is unchanged.
  // Off → today's game. Turned on only when the whole story is green.
  homeStory: true,
  // AI graphics pack (branch aminjon/hf-graphics, 15 Nov; Higgsfield-made pictures and models, docs/AI-USE.md):
  // each part loads after the first frame and falls back to the old look if its file is missing or fails.
  // hfSky: the Milky Way all-sky picture instead of drei's point stars (public/hf/sky/).
  hfSky: true,
  // hfGround: photo-real regolith in two layers (2.7 m grains and pebbles, 14 m craterlets and stones) instead of the
  // code-made noise (public/hf/ground/).
  hfGround: true,
  // hfRocks: AI-made 3D boulders (PBR) instead of the faceted code-made blocks; computers only (triangles).
  hfRocks: true,
  // hfPost: a touch more contrast, fine film grain and a faint lens fringe on the computer tier only. (N8AO was tried:
  // +100 KB gzip in the first download for every phone and little to see under the hard Sun, so it is left out.)
  hfPost: true,
  // hfArt: AI key art on the finale (the ship lifting off home, all endings but the late one) and the no-WebGL still.
  // (The loading splash in index.html is plain HTML and not behind a flag: delete its block to remove it.)
  hfArt: true,
  // Pitch answer 5 (Sunday plan): "no account, no names, no date stored, nothing goes to a server".
  // Keep false unless the whole team changes that answer. True = anonymous results go to our PocketBase.
  sendResults: false,
} as const;

export type Feature = keyof typeof features;
