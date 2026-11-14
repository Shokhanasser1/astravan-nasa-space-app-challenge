# Use of AI

Source for the "Use of AI" field on the project page (Aminjon). One line per significant AI-assisted piece of work.
Game text is written by the team. AI-generated images, if any, carry a visible mark. No NASA logo is used.

| Date | What | Tool | Checked by |
|---|---|---|---|
| 2026-11-14 | Concept documents v2 and 3.0 drafted with AI assistance | Claude (Anthropic) | team |
| 2026-11-14 | Project scaffold: architecture and stack docs, Vite/React/R3F setup, store, engine contract stub, light and dosimeter recipes in code, data types and loader, check script, PocketBase migrations, CI/deploy, Claude Code rules and skills | Claude Code (Claude Opus 5.5) | |
| 2026-11-14 | `blender/` (outside the game build): Blender scripts that clean (logos, flags), decimate and scale 35 NASA 3D Resources models; station scenes and renders; sprites; 360° skies; rigged astronaut with clips; a Three.js test demo; NASA size comparisons and fact cards. Models and textures are NASA's, not AI-generated | Claude Code (Claude Opus 5.5) agents, OpenAI Codex (sky panoramas, render gallery) | Samandar |
| 2026-11-14 | NASA-based buildings behind `features.nasaModels` / `?models`: Blender scripts that build the six buildings, LRO and astronaut GLBs, and the scene code (`src/scene/models/`, `src/scene/fit.ts`, wiring in `src/scene/parts/`), tests, spec `docs/specs/2026-11-14-nasa-models.md`. The models are NASA-derived (NASA 3D Resources), not AI-generated | Claude Code (Claude Opus 5.5) | |
| 2026-11-14 | Free walk behind `features.freeWalk` / `?walk`: collision, movement, keys and touch stick, base hitboxes, F3 debug view, tests, spec (`src/walk/`, `docs/specs/2026-11-14-free-walk.md`) | Claude Code (Claude Fable 5.2) | Asilbek |
