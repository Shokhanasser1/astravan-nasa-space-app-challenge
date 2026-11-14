---
paths:
  - 'src/i18n/**'
  - 'src/audio/**'
  - 'public/audio/**'
---

# Words, voices and sound

## Words (lane F writes them; every lane adds keys)
- One file per language and lane: `src/i18n/<lang>/<lane>.json`, keys prefixed `<lane>.` (ui, scene, story,
  engine, data). Add a key with `""` in **your** lane file; never fill the value — the team writes every word
  (Space Apps AI rules; NASA media guidelines). `npm run check` rejects wrong prefixes and duplicates.
- Final-version text rules: ≤ 8 words a line; price first, then choice; nobody dies, nobody fights; real numbers
  marked "measured"; the date never shown during play.
- Uzbek: Latin script; oʻ gʻ = U+02BB, tutuq belgisi = U+02BC (never ' ‘ ’ `). Russian: Cyrillic, same keys.
- Placeholders `{name}` only for numbers and names the engine gives; never build sentences by concatenation.
- Use `i18n-sync` to find missing or stale keys across en/uz/ru — it never writes the words.

## Voices
- Characters: Houston (calm, honest, says "I don't know"), Pilot (energy, air, water; short), Scout (research and
  radiation, curious, speaks in numbers), Buvi and Zuhra (home, warm, one or two lines). The player is addressed
  by a call sign (Lochin, Yulduz, Humo) — never a real name.
- Uzbek lines: recorded by adults on the team (~40), `public/audio/voice-uz/<key>.ogg` + `.m4a`, mono, 96 kbps,
  file name = the i18n key. English/Russian: `speechSynthesis`. **Never record children.**

## Sound (`src/audio/`, lane C)
- One `AudioContext`, created on the first tap (`audio.unlock()`); playable with sound off; every sound has a visual twin.
- Outside: breath loop (≤ 6 s) + radio only — no air, no sound. Inside: fan noise, voices clear and close.
- Dosimeter: Poisson clicks, `rate = min(40, 0.5 × ratio^0.6)` (×1 → 0.5/s, ×42 → 4.7/s); the formula is a game rule,
  the ratio is measured. Quindar tones 2525 Hz before / 2475 Hz after Houston, 250 ms. All generated in code.
- No sirens; low volume; the Sound button is always visible. Logic gets Vitest tests (`dosimeter.test.ts`).
