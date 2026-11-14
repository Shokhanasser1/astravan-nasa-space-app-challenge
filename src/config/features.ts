/**
 * Switches for what is built (concept 3.0, section 08: cut from the bottom). Cutting a feature = set it to false.
 * Every switch here is read by code and has a plain fallback. A plan that is not built yet is not a switch: the
 * layers still to build are in concept 3.0, section 08 (15 Nov cleanup: 15 switches no code read were removed).
 */
export const features = {
  // The suited astronaut seen from behind outside (src/character/, src/scene/Astronaut.tsx, the rig): walk, lope,
  // jump at Moon gravity, boot prints and dust. Cut → the first-person rig, as before. ?character = one visit.
  character: true,
  // NASA-based buildings (public/models/nasa-base/) replace the grey shells, all six or none; ?models = one visit.
  nasaModels: true,
  // Free walking with hitboxes (src/walk/): W A S D, arrows or the touch stick, from the six standing points.
  // Cut → tap the glowing markers only. ?walk = one visit.
  freeWalk: true,
  // Game keys (E Q Enter Tab M H 1–9 Esc F1), the touch action buttons (✋ ↩ 📟 🎧), the base map and the controls
  // list (src/controls/, docs/specs/2026-11-14-controls-guide.html). Cut → the HUD as before (tap and buttons only).
  controls: true,
  light: true, // one Sun at 1.5°, long shadows, tone mapping (cut → plain ambient light)
  // Pitch answer 5 (Sunday plan): "no account, no names, no date stored, nothing goes to a server".
  // Keep false unless the whole team changes that answer. True = anonymous results go to our PocketBase.
  sendResults: false,
} as const;

export type Feature = keyof typeof features;
