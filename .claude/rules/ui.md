---
paths:
  - 'src/ui/**'
  - 'src/index.css'
  - 'public/art/**'
---

# Interface: the helmet visor, for 7–14-year-olds (lane D)

Sources: Dizayn 2.0 §04 (visor), final version §02 (text rules), §07 (★ levels), design brief (colours, type,
contrast — still valid), NN/g children's UX, Game Accessibility Guidelines. References: `docs/REFERENCES.md` §6.

## Layout — everything on the visor or on objects, no floating white windows
1. Day + level, top centre: "DAY 4 OF 7" + level badge = number + word + colour (never colour alone).
2. Three gauges along the bottom curve: Energy, Air and water, Dose. **Never a fourth.**
3. Radio line: who speaks + one sentence, at most two lines; Quindar tone before Houston.
4. Target rings over tappable things (an offer, not a crosshair).
5. Batteries are scene objects on the hub (lane C draws them; you show counts and prices).
6. Wrist tablet: the selected building's price and result ("reserve 4 → 4"), the night log (≤ 3 cause → effect lines).
7. Visor edge = state: calm faint gold · alert yellow + "?" + one beep · storm in the level colour + dose line grows ·
   low air blue. One big button at the bottom ("Confirm day" lever on the hub).

## Rules that win awards with kids
- **Price before choice**: every button shows what it costs before it is pressed (from `model.preview`).
  Undo is free until "Confirm day". Nothing is ever spent silently.
- ≤ 8 words per line (★: ≤ 5, and every line is read aloud). State the goal, not only the control.
- Tap targets ≥ 48 px (~2 cm for small children); spacing ≥ 8 px; nothing important within 16 px of screen edges
  or under the notch (use `env(safe-area-inset-*)`).
- Works in landscape and portrait; designed at 360×640 first. Uzbek and Russian run ~30 % longer than English:
  layouts grow, they never truncate or overflow. Test en, uz, ru.
- Colour + word + shape for every state (colour-blind safe); text contrast ≥ 4.5:1 on the visor.
- No more than three flashes per second; no red flashing; no sirens. "Sound" button always visible.
- A scientific word is tappable and explained in one sentence. Real numbers carry the "measured" mark.
- ★ shows colour + word (Quiet / Storm); ★★ level + times normal ("level 2 · 42×"); ★★★ real unit (µGy/h) and the curve.
- The date of the week is never shown during play — only UTC clock times.

## Engineering
- Read `model`, `view`, `model.preview`; dispatch START · SET · CHOOSE · CONFIRM · NEXT. Never compute a game number.
- Text only via `t(lang, 'ui.*')`; add keys to `src/i18n/<lang>/ui.json` with `""`. Never write the words.
- Design tokens live in `src/index.css` `@theme`; components use tokens, not raw hex.
- 3D labels: DOM elements positioned from the camera projection each frame (not drei `<Html>`).
- Keep components small; memoize lists; no animation library beyond CSS transitions (no GSAP).
- Before freeze: `ux-heuristics` audit of the day screen and the truth screen.
