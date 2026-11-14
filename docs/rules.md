# Game rules (for agents)

Plain-text copy of concept v2, sections 05–10 (numbers read from the PDF pages). The **authority is
`rules_engine.py`** and its port `src/engine/rules.ts`: if this file and the engine disagree, the engine wins and
this file gets fixed. Labels: levels are measured (DONKI + LRO CRaTER); wall, shelter, strength and scores are game rules.

## Day flow (same order every day)

1. Morning report — Scout reads today's level with the real number; Houston speaks if there is news.
2. Guess (concept 3.0) — one tap, never changes resources, never punished.
3. Day card — one event, two choices, each button shows its price. On alert/storm days: the shelter choice.
4. Energy board — place today's batteries; every machine shows the result before confirming. Undo until "Confirm day".
5. The day runs (≤ 6 s, skippable). 6. Night log — at most three cause → effect lines.

Day 1: Life Support, Garden, Explore only, no card. Day 2: Workshop opens, first card. Days 3–5: cards; in stormy
weeks the warning and alert fall here; family call on Day 4. Day 6: garden result. Day 7: launch.

## Gauges

| Gauge | Start | How it moves |
|---|---|---|
| Energy | 6 batteries a day (Cadet 7), 1 stored | Unused batteries are stored, up to 2 |
| Air and water (reserve) | 5 of 8 | Crew uses 2 a day; each battery on Life Support adds 1 |
| Dose | 0 | Every day: background + storm + time outside |
| Garden health | 3 of 4 | −1, 0 or +1 a day by energy |
| Shield wall | 0 of 3 | 2 batteries build 1 level; works from the next day; stays |

## Energy board

| Machine | Batteries | Result |
|---|---|---|
| Life Support | 0 / 1 / 2 / 3 | Reserve −2 / −1 / 0 / +1 |
| Moon Garden | 0 / 1 / 2 | Health −1 / holds / +1 |
| Workshop | 0, 2 or 3 | One build a day: a wall level (2), or a module |
| Explore | 0 to 3 | +1 discovery each; 2 or 3 = long walk: reserve −1 |
| Launch | 4, Day 7 only | You go home on time |

## Radiation

```
level      = 0..4 from the real reading (day mean / calm value of the 27 days before the week)
strength e = 0, 0.3, 1, 2, 4      for levels 0, 1, 2, 3, 4
storm      = e × (1 − 0.25 × wall) × shelter
outside    = Explore batteries × 0.1 × (1 + e)
extra dose = storm + outside      (summed over the week)
blocked %  = 1 − storm received / storm with no wall and no shelter
```

| Level | Times normal | Word | e |
|---|---|---|---|
| 0 | below 2 | Quiet | 0 |
| 1 | 2 to 10 | Raised | 0.3 |
| 2 | 10 to 100 | Storm | 1 |
| 3 | 100 to 1,000 | Severe storm | 2 |
| 4 | above 1,000 | Extreme | 4 |

| Shelter (alert and storm days) | Storm part | Price |
|---|---|---|
| Keep working | × 1.0 | none |
| Half day inside | × 0.6 | Explore at most 1 |
| Everyone inside | × 0.25 | No Explore, no Workshop, Garden at most 1 |

## Cards (concept v2 §08)

| Card | Text idea | Choice A | Choice B |
|---|---|---|---|
| Dust | Dust covers the solar wing | Brush now: 1 battery today, Explore ≤ 2 | Leave: 1 battery every day from tomorrow |
| Filter | Water recycler filter clogged | Swap: 1 battery today | Wait: reserve −1 every day |
| Shadow | Ridge shadow will cross the garden tonight | Heat the garden: 1 battery today | Let it cool: garden −1 |
| Ice | Ice signal in a dark crater | Go: first Explore battery gives 2, long walk: reserve −1 | Skip |
| Request | Two extra samples by tomorrow | (no choice) Explore ≥ 4 over today+tomorrow: +2 discoveries | — |
| Tired | Crew slept badly | Rest: Explore ≤ 1 today, Crew +1 | Push on: Crew −1 |
| Sunrise | Sun clears the ridge early | (gift) +1 battery today | — |

Storm cards from the real data: **Watch** (DONKI eruption/strong flare before the storm; no choice),
**Flare alert** (day of a strong flare or first particles; four buttons: Everyone inside, Half day inside, Keep working,
Ask Houston), **Still storming** (later days at level ≥ 1; same shelter buttons, the level is known).
Build order: Dust, Filter, Shadow, Ice, Tired first; Request and Sunrise second.

## Garden result (end of Day 6) and safety nets

| Health | Discoveries | Crew |
|---|---|---|
| 4 | +5 | +1 |
| 3 | +4 | +1 |
| 2 | +2 | 0 |
| 0 or 1 | 0 | −1 |

- **Emergency day:** reserve hits 0 → backup tank; next day runs itself: 3 to Life Support, 1 to Garden. Crew −2.
- **Late ride home:** Launch does not get 4 batteries on Day 7 → rescue ship later. Crew −2, special ending.

## Scores and titles (concept v2 §10)

- **Crew 0–10:** starts at 7; minus the extra-dose penalty; −2 per emergency day; ± garden; +1 rest / −1 push on; −2 late ride.
- **Science:** one per Explore battery + card bonuses + garden result.

| Extra dose over the week | ≤ 1.0 | ≤ 2.5 | ≤ 5 | ≤ 10 | more |
|---|---|---|---|---|---|
| Crew penalty | 0 | −1 | −2 | −3 | −4 |

| Week kind | "High" crew from | "High" science from |
|---|---|---|
| Quiet, false alarm | 8 | 14 |
| Storm | 7 | 14 |
| Severe | 6 | 11 |

Titles: **Balance Master** (both high), **Bold Explorer** (science high, crew low), **Careful Commander** (crew high,
science low), **Cadet in Training** (both low), **Late Ride Home** (launch missed). The game never says "you lost".

## Golden plans — week 2021-10-25 (cards Shadow day 2, Ice day 3)

Plan A day by day (batteries = Life Support / Garden / Workshop / Explore):

| Day | Level | Card and choice | Batteries | Reserve | Wall | Extra dose | Science |
|---|---|---|---|---|---|---|---|
| 1 | 0 | none | 2 / 2 / 0 / 3 | 4 | 0 | 0.30 | 3 |
| 2 | 0 | Shadow: heat the garden | 2 / 1 / 2 (wall) / 0 | 4 | 1 | 0.30 | 3 |
| 3 | 0 | Ice: go | 2 / 1 / 2 (wall) / 1 | 3 | 2 | 0.40 | 5 |
| 4 | 1 | Flare alert: half day inside | 3 / 1 / 0 / 1 · one stored | 4 | 2 | 0.62 | 6 |
| 5 | 2 | Storm: everyone inside | 2 / 1 / 0 / 0 · two stored | 4 | 2 | 0.75 | 6 |
| 6 | 2 | Storm: half day inside | 2 / 1 / 2 (wall) / 1 · garden result 4 | 4 | 3 | 1.25 | 7 + 5 |
| 7 | 1 | Launch | 2 Life, 4 Launch, 2 Explore | 3 | 3 | 1.58 | 14 |

| Plan | How they played | Extra dose | Storm blocked | Crew | Science | Title |
|---|---|---|---|---|---|---|
| A | Two wall levels early, half day on the alert, inside on the worst day | 1.58 | 77 % | 7 | 14 | Balance Master |
| B | No wall, no shelter, three moonwalks a day, garden left to die | 5.09 | 0 % | 3 | 19 | Bold Explorer |
| C | Two wall levels, everyone inside on all three storm days | 0.81 | 85 % | 8 | 9 | Careful Commander |

**Check of Plan A by the formulas above (Claude, 14 Nov):** day 4 storm 0.3×0.5×0.6 = 0.09 + outside 1×0.1×1.3 = 0.13
→ 0.62; day 5 1×0.5×0.25 = 0.125 → 0.745; day 6 1×0.5×0.6 = 0.30 + 0.20 → 1.245; day 7 0.3×0.25×1 = 0.075 + 0.26
→ 1.58. Storm raw 0.3+1+1+0.3 = 2.6, received 0.59 → 77 % blocked. Crew 7 − 1 (dose ≤ 2.5) + 1 (garden 4) = 7.
The wall built on a day protects from the next day. Perfect play without cards: at most 12 Science at Crew 8,
19 at Crew 7, 22 at Crew 6.
