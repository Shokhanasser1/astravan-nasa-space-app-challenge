---
name: i18n-sync
description: Audit the HOME BY SEVEN locale files (src/i18n/<lang>/<lane>.json, en/uz/ru) for missing, empty, stale or duplicated keys, interpolation-slot mismatches and wrong Uzbek apostrophes, and produce a worklist for the people who write the words. Never writes, drafts or translates a value.
---

# i18n audit (report only)

**Player-facing words are written by people** (`CLAUDE.md`, hard rule; Space Apps AI rules). This skill finds
work for them; it never does that work. Do not write, draft, suggest or translate any value — not in the JSON, not
in the report, not "as a placeholder". The only edit you may make is adding a **key** with value `""` to **your own
lane's** file.

Files: `src/i18n/<lang>/<lane>.json`, `lang` ∈ en, uz, ru; `lane` ∈ ui, scene, story, engine, data; key prefix =
`<lane>.`. Loader: `src/i18n/t.ts` (missing value → English → the key itself). Guard: `npm run check`.

## Steps

1. Run `npm run check` and keep its output (prefixes, cross-lane and in-file duplicates, Uzbek ʻ/ʼ, Cyrillic in
   uz, forbidden phrases, count of empty values).
2. Build the key sets per language with a short Node script (read-only; print, do not write files):
   - keys in en but missing from uz or ru (they must exist with `""` so writers see them);
   - keys in uz/ru that en does not have (stale or misplaced);
   - empty values per language and lane (the writers' queue);
   - interpolation slots `{name}` that differ between languages for the same key;
   - keys used in code but defined nowhere: search `src/` for `t(lang, '…')` / `tr('…')` literals;
   - keys defined but never used in `src/` (candidates to delete — ask the key's lane owner first).
3. For each key in the writers' queue, record where and how it is shown (component, button/heading/radio line,
   the length limit: ≤ 8 words a line, ★ ≤ 5) so the writer has context. Describe the place, not the words.

## Report (to the teammate, for Aminjon)

```
Lane | Key | en | uz | ru | Where it appears | Limit | Problem
ui   | ui.board.confirmDay | empty | empty | empty | Hub lever + visor button | ≤ 3 words | needs text
```

Then: structural fixes you can make yourself (a missing `""` key in your own lane file), fixes that belong to another
lane (name the owner), and the `npm run check` result. Never mark a key "done" because a value exists — only a
person can judge the words.
