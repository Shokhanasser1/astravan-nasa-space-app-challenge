# HOME BY SEVEN — interface design rules

Asilbek's decision, 15 Nov 2026 (~08:00): **minimal, cold colours (it is a space game), very clean; a child of 7–12
who opens the game should want to play.** Interface only — the 3D look (ASTRA's base, light) is Shoxjahon aka's.
Every new screen, panel or button follows these rules, so it matches without a redesign. Claude sessions get the
short version automatically from `.claude/rules/ui.md`.

## References (principles, not a copy of any game's look)

- **Destiny 2** — menus praised as minimal and clean; the design never gets in the way
  ([GamesRadar](https://gamesradar.com/destiny-2-menu), [UX Collective](https://medium.com/@saoliveri95/ui-of-destiny-2-the-character-screen-3463f8fc0e3a)).
- **No Man's Sky** — thin lines, generous spacing, a holographic in-helmet feel
  ([Super Jump](https://medium.com/super-jump/armchair-vgux-no-mans-sky-9d91bb257e16)).
- **Kerbal Space Program 2** — stark icons that never block reading; the centre of the screen belongs to the craft
  ([KSP2 developer insights](https://kerbalspaceprogram.com/news/dev-diaries-developer-insights-7-ksp-2-ux-architects)).
- Minimal HUD: start empty, add only what is needed now, group what belongs together, one place for each thing
  ([StraySpark](https://www.strayspark.studio/blog/game-ui-ux-design-principles), [Pixune](https://pixune.com/blog/game-hud-design/)).
- Living title screen: the menu shows the game itself ([Game Developer](https://gamedeveloper.com/design/setting-the-tone-main-menus-are-the-game)).

## Colour — one cold family on deep navy

All tokens live in `src/index.css` (`@theme` and `:root`). Use the token, never a raw hex in a component.

| Token | Value | Use |
|---|---|---|
| `--bg-0` / `--bg-1` / `--bg-2` | #050816 / #0a1028 / #121b3c | space, panels |
| `--glass` + `.glass` | navy glass, thin light border, blur | every panel |
| `--text-1` / `--text-2` / `--text-3` | #eef3ff / #b9c6ea / #8391bd | text: main / secondary / quiet |
| `--accent` (+ `-hi`, `-ink`, `-edge`) | ice cyan #4fd2ff, text on it #032036 | **"go"**: the one main button of a screen, + buttons, the current day |
| `--peri` | #8fb3ff | energy, quiet bars, calm detail |
| `--mint` / `--color-good` | #5fe0c0 | good, garden |
| `--violet` / `--c-dose` | #b49bff | dose, computed |
| `--color-measured` / `--cyan` | #5ee0ff | "measured" mark, air and water |
| `--color-alert` | #ffc23d (amber) | **the only warm colour**: storms, alerts, a price that goes down |

Rules: one `--accent` "go" per screen; amber only means "warning" (never decoration); colour always comes with a word
or an icon (never colour alone); text contrast ≥ 4.5 : 1 on the glass.

## Type, shape, icons, space

- **Lexend** (bundled) for everything; titles 700–900, body 500–600. Numbers `tabular-nums`.
- **Shapes:** panels 20–28 px radius; buttons 14–16 px radius or round; one thin border (`--line`).
- **Icons:** Lucide only (24 px grid, 2 px stroke, `currentColor`), coloured by meaning (table above). **No emoji in
  the interface.**
- **Space:** 8 px steps (8 / 12 / 16 / 24). Targets ≥ 44 px (≥ 48 px for main buttons, ~2 cm on a tablet).
- **Motion:** short and soft (≤ 0.3 s; entry 0.7 s); nothing flashes > 3×/s; `prefers-reduced-motion` stops it.

## Parts to reuse (do not rebuild them)

| Part | Where |
|---|---|
| `Btn` (`.abtn`, `.abtn.primary`, `.abtn.big`), `Panel` (`.glass`), `Kbd` | `src/ui/play/kit.tsx`, `Controls.tsx` |
| Stat strip (`.hud-stats` / `.hud-stat`) — any 2–4 numbers side by side | `src/ui/play/Visor.tsx` `Gauges` |
| Icon row with a round stepper (`.machine-row`, `.machine-btn`) | `src/ui/play/Tablet.tsx` `Machines` |
| Day pill with day marks (`.hud-day`) | `src/ui/play/Visor.tsx` `DayBadge` |
| Crew mark (night disc, letter, orbit ring) | `src/ui/entry/art.tsx` `CrewMark` |
| Glass card over the 3D scene with a scrim | `src/ui/entry/Reception.tsx`, `.entry-*` |

## Flight Deck skin (15 Nov, Shoxjahon aka's request: "like a top game, something kids have not seen")

`src/ui/flight-deck.css`, loaded after `index.css` (one layer, one cut to remove). Every control is flight
hardware seen through the visor: `.abtn` = backlit panel key (hard lower edge, travels down 3–4 px when pressed, a
light sweep on hover, a lit legend line on top); `.primary` = illuminated key that breathes slowly (2.8 s);
`.choice` = slab key with a status strip on the left; `.machine-btn` = knurled knob; `.entry-chip` = latching
switch with a status LED; `.kbd` = keycap; colour patches are stitched; `.glass` = visor glass with two lit edge
marks and faint scan lines; the pass has a tear line before its stub. Every key press ticks (`audio.key()`, silent
when sound is off). New controls get these looks for free by using `Btn`, `Panel`, `Kbd`; do not restyle them
one by one.

## Screen layout

- The centre of the screen is the 3D base; the interface sits at the edges (top bar, one column at the bottom on a
  phone, a left column on wide screens). The big button is always on screen; a long panel scrolls, never pushes it out.
- Phone portrait first (360 × 640), then landscape (≈ 390 px tall), tablet and laptop — check all four.
- Words: ≤ 8 a line (★: ≤ 5); one heading per panel; no paragraph where an icon and two words will do.

## Checklist for a new screen

1. Tokens only (no raw hex), Lucide icons only, no emoji.
2. One `--accent` "go"; amber only for warnings.
3. Fits 360 × 640, 844 × 390, 1024 × 768 and 1280 × 720 without hiding the big button.
4. Every control ≥ 44 px, has a `data-testid`, works by touch and by keyboard.
5. Text through `t()` keys; numbers keep their measured / computed / rule mark.
