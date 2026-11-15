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
  // Mission quiz (src/quiz/, src/ui/play/Quiz.tsx; 15 Nov): a radio check on nights 2, 4, 6 and a three-question
  // debrief after the truth screen that opens the next mission. Questions only about days already played, numbers
  // from the real week. Cut → the night's Next and the truth screen's Play again work as before.
  quiz: true,
  // Pitch answer 5 (Sunday plan): "no account, no names, no date stored, nothing goes to a server".
  // Keep false unless the whole team changes that answer. True = anonymous results go to our PocketBase.
  sendResults: false,
} as const;

export type Feature = keyof typeof features;
