---
paths:
  - 'src/ui/**'
  - 'src/index.css'
  - 'public/art/**'
---

# Interface: the helmet visor, for 7–14-year-olds (lane D)

## Look — read first (Asilbek, 15 Nov ~08:00; full rules and references: `docs/DESIGN.md`)
- Minimal, **cold colours** (space), very clean. Tokens only from `src/index.css` — never a raw hex in a component.
- One ice-cyan `--accent` "go" per screen; periwinkle / mint / violet tell things apart; **amber (`--color-alert`)
  is the only warm colour and only means "warning"**. Text `--text-1/2/3`.
- Lexend; Lucide icons only (2 px, `currentColor`); **no emoji**. Panels = `Panel`/`.glass`; buttons = `Btn`/`.abtn`
  (`.primary` for the one "go"); reuse the stat strip (`.hud-stats`), icon rows (`.machine-row`), day pill, crew mark.
- The centre of the screen is the 3D base; the interface sits at the edges; the big button never leaves the screen.
  Check 360×640, 844×390, 1024×768, 1280×720.

Sources: Dizayn 2.0 §04 (visor), final version §02 (text rules), §07 (★ levels), design brief (colours, type,
contrast — still valid), NN/g children's UX, Game Accessibility Guidelines. References: `docs/REFERENCES.md` §6.

## Layout — everything on the visor or on objects, no floating white windows
1. Day + radiation level, top centre: "DAY 4 OF 7" + the radiation-level badge (0–4) = number + word + colour
   (never colour alone). The ★ difficulty is chosen on the start screen and is never called "level" on screen.
2. Three gauges along the bottom curve: Energy, Air and water, Dose. **Never a fourth.**
3. Radio line: who speaks + one sentence, at most two lines; Quindar tone before Houston.
4. Target rings over tappable things (an offer, not a crosshair).
5. Batteries are scene objects on the hub (lane C draws them; you show counts and prices). Without WebGL the
   scene shows a fallback, so the wrist tablet must also offer every machine with add/remove battery buttons —
   a whole week stays playable in the DOM (`docs/ARCHITECTURE.md`, e2e drives the game this way).
6. Wrist tablet: the selected building's price and result ("reserve 4 → 4"), the night log (≤ 3 cause → effect lines).
7. Visor edge = state: calm faint gold · alert yellow + "?" + one beep · storm in the level colour + dose line grows ·
   low air blue. One big button at the bottom ("Confirm day" lever on the hub).

## Rules that win awards with kids
- **Price before choice**: every button shows what it costs before it is pressed, from the engine's previews in the
  state: the current plan's preview for the board, and each choice's own preview for card and shelter buttons
  (today `board.cardOptions[].preview`, `board.shelterOptions[].preview`). Never reuse one preview for two choices.
  Undo is free until "Confirm day". Nothing is ever spent silently.
- ≤ 8 words per line (★: ≤ 5, and every line is read aloud). State the goal, not only the control.
- Tap targets ≥ 48 px (~2 cm for small children); spacing ≥ 8 px; nothing important within 16 px of screen edges
  or under the notch (use `env(safe-area-inset-*)`).
- Works in landscape and portrait; designed at 360×640 first. Uzbek and Russian run ~30 % longer than English:
  layouts grow, they never truncate or overflow. Test en, uz, ru.
- Colour + word + shape for every state (colour-blind safe); text contrast ≥ 4.5:1 on the visor.
- No more than three flashes per second; no red flashing; no sirens. "Sound" button always visible.
- A scientific word is tappable and explained in one sentence. Real numbers carry the "measured" mark.
- The radiation badge by difficulty: ★ colour + word (Quiet / Storm); ★★ level + times normal ("level 2 · 42×");
  ★★★ real unit (µGy/h) and the curve.
- The date of the week is never shown during play — only UTC clock times.

## Engineering
- Read `model`, `view`, `model.preview`; dispatch START · SET · CHOOSE · CONFIRM · NEXT. Never compute a game number.
- Text only via `t(lang, key)`. **Create** keys only in `src/i18n/<lang>/ui.json` (prefix `ui.`, value `""`);
  **render** any lane's key: radio lines `story.*`, night log, warnings and titles `engine.*`, facts `data.*`.
  Never write the words, never build a sentence by joining strings.
- Every control the e2e test drives gets a stable `data-testid` (kebab-case English, e.g. `confirm-day`);
  e2e never selects by words or keys.
- Design tokens live in `src/index.css` `@theme`; components use tokens, not raw hex.
- 3D labels: DOM elements positioned from the camera projection each frame (not drei `<Html>`).
- Keep components small; stable `key`s on lists; memoize only what the Profiler shows is slow
  (`react-performance`); no animation library beyond CSS transitions (no GSAP).
- Before freeze: `ux-heuristics` audit of the day screen and the truth screen.
