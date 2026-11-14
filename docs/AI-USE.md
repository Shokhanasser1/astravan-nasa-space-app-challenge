# Use of AI

Source for the "Use of AI" field on the project page (Aminjon). One line per significant AI-assisted piece of work.
Game text is written by the team. AI-generated images, if any, carry a visible mark. No NASA logo is used.

| Date | What | Tool | Checked by |
|---|---|---|---|
| 2026-11-14 | Concept documents v2 and 3.0 drafted with AI assistance | Claude (Anthropic) | team |
| 2026-11-14 | Project scaffold: architecture and stack docs, Vite/React/R3F setup, store, engine contract stub, light and dosimeter recipes in code, data types and loader, check script, PocketBase migrations, CI/deploy, Claude Code rules and skills | Claude Code (Claude Opus 5.5) | |
| 2026-11-14 | `blender/` (outside the game build): Blender scripts that clean (logos, flags), decimate and scale 35 NASA 3D Resources models; station scenes and renders; sprites; 360° skies; rigged astronaut with clips; a Three.js test demo; NASA size comparisons and fact cards. Models and textures are NASA's, not AI-generated | Claude Code (Claude Opus 5.5) agents, OpenAI Codex (sky panoramas, render gallery) | Samandar |
| 2026-11-14 | `public/data/facts.json` (17 facts: value, unit, label, source link and the quoted page text, each checked on the page), its test `src/lib/facts.test.ts`, and AI draft lines en/uz/ru in `docs/specs/2026-11-14-facts.md` (the game's `data.fact.*` texts stay empty for Aminjon); physics numbers table for Sarvar `docs/specs/2026-11-14-physics-numbers.md` (Apollo sources, clip measurements in Blender) | Claude Code (Claude Opus 5.5) agents | Samandar; numbers: Sarvar |
