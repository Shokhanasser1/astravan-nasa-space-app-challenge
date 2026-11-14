# Physics numbers for the scene: walk, lope, jump, fall (Moon, 1.62 m/s²)

Date: 14 Nov 2026 · Task: `docs/TASKS.md` §4, item 9 (Sarvar: physics numbers) · Prepared with Claude Code for
Sarvar to check. Sarvar owns these numbers. This note changes no code.

**Labels** (the four words of `src/lib/labels.ts`):
**measured** = recorded by an instrument, a film, a TV record or a test (source given) ·
**computed** = a formula applied to measured numbers (formula given) ·
**rule** = our choice for the game, not a fact · **story** = not used here.
"(assumed)" marks an input we chose without a source. "Crew report" marks what Apollo astronauts said in their
debriefs: useful, but not a measurement.

**In short:** gravity 1.62 m/s². Walk 0.7 m/s, lope 1.4 m/s (game top speed 2.0 m/s). Jump take-off 1.2 m/s
straight up: at most 0.44 m high and 1.5 s in the air. "Six times higher" holds only for the same push. In a
suit, John Young's best jump on Apollo 16 was 0.42 m. Our Walk and Jump clips move faster than Moon gravity allows.
Our Run clip is a two-footed hop, which Apollo crews used on level ground only in play.

---

## 1. Main table

| # | Quantity | Value | Unit | Label | How it was obtained | Note for the scene |
|---|---|---|---|---|---|---|
| **Gravity** | | | | | | |
| G1 | Moon surface gravity | 1.62 | m/s² | measured | NSSDC Moon Fact Sheet [S1] | One constant in one place (`.claude/rules/three.md`). Rapier: `gravity={[0, -1.62, 0]}`. No extra "fall faster" factor: it would break every number below. |
| G2 | Earth surface gravity | 9.81 | m/s² | measured | Standard gravity 9.80665 [S2]; the Moon fact sheet lists 9.80 [S1] | Comparisons only. |
| G3 | Moon ÷ Earth | 0.165 (1/6.06) | — | computed | 1.62 / 9.81; the fact sheet gives 0.165 [S1] | "About one sixth" is fine in player text. |
| **Jump** | | | | | | |
| J1 | Vertical jump of a child, no suit, Earth | 0.22 (ages 6–11, median) · 0.25–0.26 (age 9) · 0.31–0.32 (age 12) | m | measured | PLAY study [S12]; Gabel 2016, 50th percentile, girls–boys [S11] | Rise of the centre of mass. We use 0.25 m. |
| J2 | Take-off speed for J1 | 2.2 (2.1–2.5) | m/s | computed | v = √(2 · 9.81 · h) | |
| J3 | Same take-off speed on the Moon: jump height | 1.5 (1.3–1.9) | m | computed | h = v² / (2 · 1.62) = 6.06 × the Earth height | The "six times higher" case. It needs the same push as on Earth, so no suit and no backpack. Not reachable in a suit. |
| J4 | Same take-off speed: time in the air, Earth / Moon | 0.45 / 2.7 | s | computed | t = 2v / g | Air time also grows 6×: the jump looks slow, not only high. |
| J5 | Suited jump on the Moon: John Young, Apollo 16 | 0.42 high, 1.45 s in the air | m, s | measured | Timed on the 16-mm film; Lunar Surface Journal [S3] | His second jump: 0.34 m, 1.30 s. Armstrong, Apollo 11: about 0.5 m, 1.6 s [S5]. |
| J6 | Take-off speed for J5 | 1.17 (Armstrong: 1.3) | m/s | computed | v = g · t / 2 ([S3] gives the same) | Our game jump uses 1.2 m/s. |
| J7 | Why a suit lowers the jump | Young's total weight on the Moon was about 30 kg (65 lb), so his mass was about 182 kg | — | computed | 30 × 9.81 / 1.62 [S3] | The same legs push more than twice their body mass, in stiff pressurised joints. Armstrong nearly tipped over backwards on a high jump; Duke did tip over [S4]. Keep the jump modest and straight up. |
| J8 | Distance covered by one jump while moving | 1.0 at 0.7 m/s · 2.1 at 1.4 m/s · 3.0 at 2.0 m/s | m | computed | d = v_forward × t_air, t_air = 1.48 s (take-off 1.2 m/s) | This is "how far it jumps" in the game. Earth, same take-off: 0.17 / 0.34 / 0.49 m. |
| J9 | Standing leap at 45°, child, no suit (centre-of-mass flight only) | Earth 0.50 · Moon 3.0 | m | computed | R = v² / g, v = 2.2 m/s | Upper bound without a suit. A real standing long jump adds leg reach at take-off and landing. |
| **Walk, lope, run** | | | | | | |
| W1 | Froude number: how "fast" a gait is for its leg length and gravity | Fr = v² / (g · L) | — | computed | L = leg length (hip height): rig 0.79 m (measured in Blender), adult 0.9 m and child 0.65 m (assumed) | The same Fr gives the same-looking gait at any gravity. |
| W2 | Walk–run transition, Earth | Fr ≈ 0.5, so about 2.1 m/s for an adult | — | measured | Kram 1997 [S8]; speed computed for L = 0.9 m | |
| W3 | Walk–run transition, Moon, if Fr stays 0.5 | 0.80 (rig) · 0.85 (adult) · 0.73 (child) | m/s | computed | v = √(0.5 · 1.62 · L) | Kram's abstract: at lower gravity the switch came at "approximately the same Froude number" [S8]. |
| W4 | Walk–run transition, no suit, real or simulated lunar gravity | Fr 1.39 ± 0.45 (flight test), 1.11 ± 0.26 (simulated); Carr & McGee read Kram's data as Fr 0.9 at 1/6 g | — | measured | De Witt 2014 [S9]; Carr & McGee 2009 [S7] | So 1.1–1.4 m/s for an adult (computed). The sources disagree with W3: without a suit people keep walking longer on the Moon. |
| W5 | Walk–run transition **in a suit**, Apollo crews (38 gait events on film and TV: 10 walking, 10 loping, 18 running) | Fr 0.36 ± 0.11, so 0.68 m/s (rig) · 0.72 (adult) · 0.62 (child) | m/s | measured (Fr), computed (speed) | Carr & McGee 2009 [S7]; v = √(0.36 · 1.62 · L) | **Our player wears a suit: the walk ends at about 0.7 m/s.** |
| W6 | Fastest stiff-legged walk (Fr 1) | 1.13 (rig) · 1.21 (adult) | m/s | computed | v = √(g · L): faster, and the body lifts off at the top of each step | Bent knees let unsuited people pass it (W4). For a suited player it is far above the switch (W5). |
| W7 | How Apollo crews moved | A lope: alternate feet, both feet off the ground at once. "It's a lope and it's very hard to just walk" (Aldrin). | — | crew report | Lunar Surface Journal, "Lunar Gaits" [S4] | The normal fast move on the Moon is a lope, not an Earth run and not a two-footed hop. |
| W8 | Armstrong's lope across the TV picture, Apollo 11 | about 1.0 (22 m in 22 s, 3.6 km/h) | m/s | measured | Timed on the TV record; Lunar Surface Journal [S6] | "a loping, foot-to-foot stride" [S6]. |
| W9 | Lope speed of later Apollo crews | over 1.4 (5 km/h), for up to 300 m | m/s | measured | Lunar Surface Journal [S6] | Our lope speed. |
| W10 | Stopping | "two or three steps to come comfortably to a stable stationary position from a fairly rapid forward movement" (Aldrin) | — | crew report | [S4] | Brake over about 1 s, not 0.1 s. |
| W11 | Largest start or stop acceleration | ≤ 1.6 | m/s² | computed | a ≤ μ · g, with grip μ ≤ 1 (assumed) | A stop from 1.4 m/s takes ≥ 0.9 s and ≥ 0.6 m; from 2.0 m/s ≥ 1.2 s and ≥ 1.2 m. Boot treads digging into the soil add a little. |
| **Falling** | | | | | | |
| F1 | Fall from 1 m, Moon: time · landing speed | 1.11 · 1.80 | s · m/s | computed | t = √(2h / g), v = √(2gh) | Earth: 0.45 s · 4.43 m/s. Lands like a 0.17 m drop on Earth (Earth drop with the same landing speed = h × 0.165). |
| F2 | Fall from 1.72 m (top of the lower stage of our `lander.glb`) | 1.46 · 2.36 | s · m/s | computed | same | Earth: 0.59 s · 5.81 m/s. Like a 0.28 m drop on Earth. |
| F3 | Fall from 3.31 m (top of our lander model) | 2.02 · 3.27 | s · m/s | computed | same | Earth: 0.82 s · 8.06 m/s. Like a 0.55 m drop on Earth. |
| F4 | Real Apollo 11 lander: from the bottom rung to the footpad | "slightly more than 32 inches" (0.81 m): 1.00 s · 1.62 m/s | m; s · m/s | measured (height), computed (time, speed) | Lunar Surface Journal, "One Small Step" [S5] | The strut did not compress on landing, so the last step was a jump. Armstrong: "Takes a pretty good little jump." Our lander is a scaled-down Apollo LM (3.31 m against about 7 m), so its ladder is not to scale. |
| **Carrying** | | | | | | |
| L1 | Weight of a load on the Moon | 0.165 × its Earth weight | — | computed | W = m · g; "weight is reduced to one-sixth" [S10] | A 10 kg box weighs 16 N: it feels like 1.7 kg. |
| L2 | Mass (inertia) of a load | unchanged | — | computed | F = m · a; "Mass does not change" [S10] (said there of the ISS; the physics is the same on the Moon) | Starting, stopping and turning with a 10 kg box take the same force as on Earth: 20 N to reach 1 m/s in 0.5 s. In the game a load should make stops and turns slower, not the walk heavier. |
| L3 | Apollo suit with backpack | 200 lb (91 kg) on Earth with backpack and purge unit; 30 lb on the Moon with the backpack. A7LB at its heaviest: 96 kg, lunar weight 156 N. | lb, kg, N | measured | Smithsonian, Armstrong's suit [S13]; Carr & McGee 2009 [S7] | Aldrin: "Some attention must be paid to the mass that you have in the suit and, also, to the mass of the PLSS" [S4]. |
| L4 | Walking speed with a load | no number | — | — | No source found that gives one | Our Carry clip measures 0.57 m/s (section 2). Any game choice is a rule. |
| **Eye height** | | | | | | |
| E1 | Eye height used by the game | 1.7 | m | rule | `EYE` in `src/scene/points.ts`; Asilbek's walker uses the same | An adult eye: a person about 1.8 m tall. |
| E2 | Height of a child aged 7 / 10 / 12 (median) | 1.22 / 1.38–1.39 / 1.49–1.51 | m | measured | CDC stature-for-age data table, girls–boys [S14] | |
| E3 | Eye height of a child aged 7–12 | 1.1–1.4 | m | computed | E2 minus about 0.1 m from the top of the head to the eye (assumed) | If the player is a child: `EYE` ≈ 1.3 m (rule). Our rigged astronaut is 1.86 m tall: an adult-size suit. |

---

## 2. Our astronaut clips against Moon physics

**What was measured.** `astronaut_rig.blend` (armature `AstronautRig`, 30 fps), in Blender, headless, every ¼ frame.
The game's `public/models/astronaut/astronaut.glb` has the same six clips with the same lengths. The clips are in
place (no root motion) and the character faces −Y. Ground = the lowest boot point in Idle. Boots = mesh vertices
weighted to the foot and toe bones.

- **Ground speed** of an in-place clip = how fast the planted boot moves backward. Here: the ankle's travel from
  its most forward to its most backward point, divided by that time.
- **Moon check.** While a boot is on the ground, the ground can only push. So the body can never move downward
  faster than free fall: the hips' downward acceleration must stay ≤ 1.62 m/s². Playing a clip at rate r
  multiplies its accelerations by r². So the fastest playback that stays lunar is r = √(1.62 / a_down).

| Clip | Length at 1× | What we measured | Moon check | Recommendation |
|---|---|---|---|---|
| Walk | 36 frames = 1.2 s (2 steps) | Ground speed **0.92 m/s**: the ankle moves back 0.66 m in 0.72 s (60 % of the cycle). Stride 1.11 m. The earlier figure, 1.10 m/s, assumed a 50 % stance. Hips bob 7 cm, twice a cycle. At any constant speed the planted boot slides up to 13 cm (the feet follow a sine wave). The trailing toe sinks 14 cm into the ground; the swinging boot lifts only 3 cm. | **No.** The bob needs 3.8 m/s² downward, 2.3 × Moon gravity. 0.92 m/s is Fr 0.66 for the rig's 0.79 m leg: past the suited switch to a lope (Fr 0.36, W5). | Lunar as it is only at ≤ 0.65× (0.60 m/s). For the recommended 0.7 m/s (0.76×), Sarvar cuts the hip bob from 7 cm to ≤ 5 cm and lifts the toe out of the ground. Playback rate = speed ÷ 0.92. |
| Carry | 42 frames = 1.4 s | **0.57 m/s**, stride 0.79 m. Bob 4.4 cm. Boot slides up to 10 cm. Toes sink 13 cm into the ground. | **About right:** 1.76 m/s², 9 % over. | Rate = speed ÷ 0.57; ≤ 0.96× is fully lunar. A carry speed of 0.5 m/s fits. |
| Run (two-footed hop) | 24 frames = 0.8 s per hop | About **1.0 m/s** (0.90–1.06 by method), 0.8 m per hop. Both boots off the ground for 0.28 s, up to 12 cm high. In flight the hips fall at 1.3–2.3 m/s² (curve fit / top-to-landing drop). Toes sink 12–13 cm into the ground at push-off. | Flight: **yes**, roughly lunar. Speed: **no faster than Walk.** Gait: "No one used the two-footed, kangaroo hop on level ground - except in play" [S4]. | Do not speed it up. On the Moon "you can't move your feet any more rapidly than the next time you come into contact with the surface" (Aldrin, [S4]), so the flight sets the rhythm. Use rate 0.9–1.2 only. For a 1.4–2.0 m/s lope, Sarvar keys an alternate-foot lope: 1.1–1.6 m per 0.8 s cycle. Keep the hop for play. |
| Jump | 36 frames = 1.2 s, played once | In place: hips 0.84 → 0.70 m (crouch, frame 5) → 0.87 m (push-off, frame 9) → 0.84 m, held to the end. **No apex, so no jump height in the clip.** Airborne pose frames 9–31 = 0.73 s. At take-off (frames 8–10) the pointed toes are 13.5 cm below the floor; in the tuck the boots stay 3–6 cm below it. | Height and air time must come from physics. At 1× the airborne part matches a Moon hop of only 0.11 m (take-off 0.59 m/s); Young's real jump lasted 1.45 s. The crouch drops the hips 14 cm in 0.17 s, with 19 m/s² downward; on the Moon that drop needs at least 0.58 s. | Play it in three parts. Frames 0–9 on the ground: ≤ 0.3× is strictly lunar; 0.5–1× is a fair rule for quick controls. Take off at frame 9 with the body raised ≥ 0.14 m above the clip's root. Frames 9–31 at rate 0.73 s ÷ air time (0.49× for a 1.2 m/s take-off, 1.48 s). Frames 31–36 on touchdown. |
| Idle | 60 frames = 2 s | Hips bob 0.8 cm | **Yes** (0.19 m/s²) | Any rate. |
| Pour | 60 frames = 2 s | Hips do not move | **Yes** | — |

Also from the rig: it is 1.86 m tall and 0.84 × 0.81 m wide and deep with the backpack, so about 0.42 m from the
middle to the widest point. Asilbek's walker body (`BODY = 0.35` m) would let the backpack and elbows poke about
7 cm into walls.

Scripts (in Sarvar's Blender work folder `~/dev/oy-karvonsaroyi-3d/hb7/_physics/`, outside this repo):
`measure_clips.py` (Blender; writes `clips_measured.json`), `backstroke_speed.py`, `vertical_check.py`,
`compute_numbers.py` (every computed number in this note).

---

## 3. Recommended numbers for the scene

All of these are **rule** numbers (our choices), each based on the rows named in brackets.

- **Gravity:** 1.62 m/s², one constant, no extra fall factor (G1).
- **Walk:** 0.7 m/s, where suited Apollo crews switched to a lope (W5). Walk clip at 0.76× after a smaller bob.
- **Lope (the fast move):** 1.4 m/s, what later Apollo crews kept up (W8–W9). Game top speed 2.0 m/s at most. It
  needs a lope clip; until then the Run clip at 1.0–1.2× gives 1.0–1.2 m/s.
- **Jump take-off:** 1.2 m/s straight up, between Young's 1.17 and Armstrong's 1.3 m/s (J5–J6).
  **Max jump height 0.44 m**, air time 1.48 s. Forward distance = forward speed × 1.48 s: about 1.0 m from a walk,
  2.1 m from a lope, 3.0 m at 2.0 m/s (J8).
- **Starting and stopping:** about 1.6 m/s², so just under 1 s from a lope to a stop: "two or three steps"
  (W10–W11).
- **Eye:** 1.3 m if the player is a child; 1.7 m only if the player is an adult (E1–E3).
- **Fact for the Data page** (`TASKS.md` §4, item 7): "With the same push, a jump on the Moon goes about 6 times
  higher and lasts about 6 times longer. In a spacesuit the push is weaker: Apollo astronauts jumped about
  0.3–0.5 m." (J3–J5)

**Compared with Asilbek's numbers** (`src/walk/move.ts` and `collide.ts` on `asilbek/work`). His values are scene
numbers to tune with children; these rows are suggestions, not corrections:

| Asilbek | Value there | This note | Why they differ |
|---|---|---|---|
| `PACE.walk` | 2.0 m/s ("try 1.5–2.5") | walk 0.7, lope 1.4, top 2.0 | On the Moon 2.0 m/s is a lope (Fr 3.1 for our rig), not a walk. The Walk clip would need 2.2× playback: the boots slide and the bob needs 18 m/s². 2.0 fits as the top lope speed. |
| `PACE.accel` | 20 per s: full speed in about 0.15 s, 40 m/s² at the start | about 1.6 m/s²: about 1.2 s to 2.0 m/s | 25 times what boots can push against on the Moon, and 4 g even on Earth. |
| `PACE.brake` | 30 per s: a stop in about 0.1 s, 60 m/s² | about 1 s, "two or three steps" | Same reason (W10–W11). If a slow stop feels bad in first person, a faster stop is a fair rule; call it a rule. |
| `BODY` | 0.35 m ("suited child-sized") | about 0.42 m for our rig | The rig is an adult-size suit, 1.86 m tall. A child-size astronaut would fit 0.35 m. |
| Eye | 1.7 m | 1.3 m for a child | An adult eye height (E1–E3). |
| `PACE.tick` | 1/60 s | same | Fine. |

---

## 4. Sources

Every page below was fetched on 14 Nov 2026 and the number was found on it, unless the line says otherwise. The
Apollo Lunar Surface Journal moved from `hq.nasa.gov/alsj` to `apollojournals.org` (NASA's landing page
https://www.nasa.gov/history/alsj-and-afj/ links there); the old addresses redirect or return 404.

- **[S1]** NSSDC, Moon Fact Sheet — https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html —
  "Surface gravity (m/s2) 1.62 9.80 0.165" (Moon, Earth, ratio). Confirmed.
- **[S2]** NIST, standard acceleration of gravity — https://physics.nist.gov/cgi-bin/cuu/Value?gn — 9.806 65 m s⁻²,
  exact. Confirmed.
- **[S3]** Apollo Lunar Surface Journal, Apollo 16, "ALSEP Off-load" — https://apollojournals.org/alsj/a16/a16.alsepoff.html —
  "He is off the ground about 1.45 seconds which … means that he launched himself at a velocity of about 1.17 m/s
  and reached a maximum height of 0.42 m." Second jump "1.30 seconds … 1.05 m/s … 0.34 m". "John's total weight -
  body, suit, and backpack, is about 30 kilograms or 65 pounds." Confirmed.
- **[S4]** Apollo Lunar Surface Journal, Apollo 11, "Lunar Gaits" (Eric M. Jones, revised 2 Nov 2010) —
  https://apollojournals.org/alsj/a11/a11.gaits.html — Aldrin: "very hard to just walk"; "two or three steps to come
  comfortably to a stable stationary position from a fairly rapid forward movement"; "you can't move your feet any
  more rapidly than the next time you come into contact with the surface". Commentary: "No one used the
  two-footed, kangaroo hop on level ground - except in play". Confirmed.
- **[S5]** Apollo Lunar Surface Journal, Apollo 11, "One Small Step" — https://apollojournals.org/alsj/a11/a11.step.html —
  "a jump of slightly more than 32 inches"; Armstrong "off the ground for approximately 1.6 seconds … about
  1.3 m/s and got up about 0.5 meters". Confirmed. The "3.5 feet" often quoted for this step is **not** on this page.
- **[S6]** Apollo Lunar Surface Journal, Apollo 11, "Closeout" — https://apollojournals.org/alsj/a11/a11.clsout.html —
  "about 22 seconds … about 22 meters … about 3.6 km/hr"; "Later crews regularly achieved speeds of over 5 km/hr
  over distances of up to 300 meters"; "a loping, foot-to-foot stride". Confirmed. (Carr & McGee quote an older
  version of this passage: 25 s, 3.2 km/h.)
- **[S7]** Carr C. E., McGee J. (2009) The Apollo Number: Space Suits, Self-Support, and the Walk-Run Transition.
  PLoS ONE 4(8): e6614 — https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0006614 — unsuited Fr*
  "rising to 0.9 in 1/6 g; space suits appear to lower Fr*"; Apollo "Fr* (0.36±0.11, mean±95% CI)"; "10 involved
  walking, 10 loping, and 18 running"; "156N lunar weight of the A7LB at its maximum mass condition (96 kg)".
  Confirmed (full text).
- **[S8]** Kram R., Domingo A., Ferris D. P. (1997) Effect of reduced gravity on the preferred walk-run transition
  speed. J Exp Biol 200: 821–826 — https://pubmed.ncbi.nlm.nih.gov/9076966/ — "at approximately the same Froude
  number (0.5)"; "at lower levels of gravity, the walk-run transition occurred at progressively slower absolute
  speeds but at approximately the same Froude number." Abstract confirmed (read through NCBI E-utilities).
  **Not confirmed:** the speeds at each gravity level (full text blocked).
- **[S9]** De Witt J. K. et al. (2014) The preferred walk to run transition speed in actual lunar gravity.
  J Exp Biol 217: 3200–3203 — https://pubmed.ncbi.nlm.nih.gov/25232195/ — "Froude numbers at the PTS in actual
  lunar gravity (1.39±0.45) and simulated lunar gravity (1.11±0.26) were much greater than 0.5." Abstract
  confirmed; the abstract gives no speeds in m/s.
- **[S10]** NASA, "Mass vs. Weight" educator introduction (PDF) — https://www.nasa.gov/pdf/591747main_MVW_Intro.pdf —
  "Mass does not change whether it is measured on Earth or the ISS."; "on the Moon where weight is reduced to
  one-sixth that of on Earth." Confirmed.
- **[S11]** Gabel L. et al. (2016) Reference data for jumping mechanography in Canadian children, adolescents and
  young adults. J Musculoskelet Neuronal Interact 16(4): 283 — https://pmc.ncbi.nlm.nih.gov/articles/PMC5259569/ —
  jump height (Hmax) 50th percentile: age 9 girls 0.26 m, boys 0.25 m; age 12 girls 0.31 m, boys 0.32 m (single
  two-legged jump, hands on waist). Confirmed.
- **[S12]** PLAY study (2023) Assessment of Physical Tests in 6–11 Years Old Children. Int J Environ Res Public
  Health 20(3): 2552 — https://pmc.ncbi.nlm.nih.gov/articles/PMC9915144/ — "Vertical Jump (cm) … 22.3 (18.0, 26.2)"
  (median, quartiles). Confirmed.
- **[S13]** Smithsonian National Air and Space Museum, Armstrong's spacesuit — https://airandspace.si.edu/explore/stories/armstrong-suit —
  "200 pounds is how much this type of suit weighted on Earth with the fully pressurized O2 PLSS … and OPS …
  attached"; "30 pounds is how much the suit with the PLSS attached weighed on the lunar surface". Confirmed
  (a museum page, not NASA).
- **[S14]** CDC growth charts, stature-for-age data table — https://www.cdc.gov/growthcharts/data/zscore/statage.csv —
  median (M) stature: 7 y boys 122.0 cm, girls 121.8 cm; 10 y 138.8 / 138.2 cm; 12 y 149.3 / 151.5 cm. Confirmed.

**Could not confirm or did not use:** Kram 1997 speeds per gravity level (full text blocked); Pavei, Biancardi
and Minetti 2015 (J Appl Physiol 119: 93–100; the abstract has no Apollo speeds, the full text did not load);
Minetti 2001 (Nature; no abstract on PubMed); a measured preferred walking speed at 1/6 g (none found). The
grip μ ≤ 1, the leg lengths 0.9 m (adult) and 0.65 m (child) and the 0.1 m from head top to eye are assumptions.
