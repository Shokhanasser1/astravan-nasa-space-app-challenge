---
name: submission-check
description: Use before the Sunday 11:00 freeze, before submitting the Space Apps project, or when asked "are we ready to submit" - walks the Space Apps 2026 submission and judging checklist and reports each item as pass, fail or needs a human.
---

# Submission check

Under the 2025 judging rules, failing any of items 1–7 means a score of 1 without review. The 2026 Project
Submission Guide and Judging & Awards Guide came out on 13.11: if a teammate has them, their wording wins.

Deadlines (Tashkent): Sunday 11:00 freeze, 13:00 submitted (judges start 14:00). Assume a submission cannot be edited.

## Checklist

| # | Item | How to check |
|---|---|---|
| 1 | Project page in English | Ask the teammate for the page text; scan it |
| 2 | Project answers the chosen challenge (Build a Junior Astronaut Mission Trainer) | Compare page summary with the challenge |
| 3 | Demo ≤ 30 seconds or ≤ 7 slides | Ask for the video length |
| 4 | Every link opens without login | Open the Pages URL, repo and video in a private window; ask a teammate to do it on another phone |
| 5 | NASA data used and named, one row per dataset, most important first | `CREDITS.md` NASA data table and the page's "NASA data & resources" field match `public/data/weeks.json` sources |
| 6 | AI use described; no AI images, or each has a visible watermark | `docs/AI-USE.md` is complete and copied into the "Use of AI" field |
| 7 | No NASA logos, flags, mission insignia | Look through `public/models/, public/textures/, public/audio/` and the video |
| 8 | No names, faces or voices of children | Screenshots, video, data, commits |
| 9 | Every brick cited, licences named, project licence stated | `npm run check` passes; `CREDITS.md` has no empty rows; `LICENSE` present |
| 10 | English subtitles burned into the video | Ask |
| 11 | All team members listed on the team page | Ask |
| 12 | Global judging participation ticked | Ask |
| 13 | Published version frozen; same `dist/` also uploaded to Cloudflare Pages | CI green on the last commit; Cloudflare deployment URL recorded |

Also check:
- `npm run verify` passes on a clean checkout (`git status` is clean, CI green).
- No "according to NASA" / "NASA says" / "NASA wall" anywhere (page, game, video); page states
  "not an official NASA product".
- SDO credit line present; false colours of SDO images mentioned once on the page.
- The "before → after" number from real kids is written down outside the browser (localStorage can vanish).
- Game works with sound off, on a phone in landscape, and with Uzbek switched on.

## Report

List every item as PASS / FAIL / ASK HUMAN with one line of evidence. Fix nothing silently after the freeze:
propose the fix and let the team decide.
