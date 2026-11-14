/**
 * Cut list as switches (concept 3.0, section 08, cut from the bottom; concept v2, section 14).
 * Cutting a feature = set it to false. Every component behind a flag must have a plain fallback.
 * Aminjon decides at each gate.
 */
export const features = {
  // 3.0 wow / knowledge / data layers, in cut order (top = keep longest)
  light: true, // 2 · one Sun, long shadows, tone mapping
  sound: true, // 3 · breath, Quindar, inside/outside (cut → breath + radio tone only)
  invisibleStorm: true, // 4 · dosimeter, scout-cam snow, sparks (cut → dosimeter only)
  realFlarePhoto: true, // 5 · SDO image on the wrist tablet (cut → photo on the truth screen)
  guesses: true, // 6 · seven predictions (cut → days 1, 4, 7)
  truthSequence: true, // 7 · 25-second sequence (cut → old truth screen + SDO photo)
  earthOfTheDay: true, // 8 · GIBS texture on the globe (cut → generic Earth texture, phase still right)
  levels: true, // 9 · ★ / ★★ / ★★★ (cut → one level)
  dustArcs: true, // 10
  shadowClock: false, // 11 · optional
  // v2 "should" / "nice"
  modules: true, // Wing, Dish, Rover garage (cut → wall only)
  moonwalkMap: true, // cut → Explore stays a button
  missionLog: true, // seven patches
  storyScenes: true, // cut → seven stills with captions
  beforeAfter: true, // three questions before and after, counted on the device
  hardMode: false,
  // Pitch answer 5 (Sunday plan): "no account, no names, no date stored, nothing goes to a server".
  // Keep false unless the whole team changes that answer. True = anonymous results go to our PocketBase.
  sendResults: false,
} as const;

export type Feature = keyof typeof features;
