---
paths:
  - 'src/ui/**'
  - 'src/state/**'
  - 'src/i18n/**'
  - 'src/audio/**'
---

# Screens, text and sound

- Day flow is fixed (concept v2 §05, 3.0 §04): morning report → guess → day card / shelter → energy board →
  day runs (≤ 6 s, skippable) → night log. Same order every day.
- Four screen rules: price before choice (show `preview` before confirm); undo free until "Confirm day";
  cause → effect in the night log; "Ask Houston" always available and free.
- Text keys only (`t('key')`). New keys go to `en.json` with `""`; the team writes the words. Never fill text yourself,
  not even placeholders. One line of text on screen at a time during scenes.
- Uzbek: oʻ gʻ with U+02BB, tutuq belgisi U+02BC (`npm run check`). Layouts must fit the longest of en/uz/ru.
- Cadet: ≤ 5 words per line, every line read aloud. English/Russian via `speechSynthesis`; Uzbek via the team's
  recorded files (`public/audio/voice-uz/<key>.ogg` + `.m4a`).
- Tap targets ≥ 48 px; every drag has a tap alternative; keep controls away from screen edges.
- Sound starts only after the first tap (`audio.unlock()`); every sound has a visual twin; no sirens, no red flashing;
  the sound button is always visible. The dosimeter rate formula is a game rule; the ratio it reads is measured.
- State: one `useReducer` in `src/state/game.ts`. UI reads `model`/`view` and dispatches START · SET · CHOOSE ·
  CONFIRM · NEXT; it never changes numbers itself. Price before choice = `model.preview` (engine `preview`).
