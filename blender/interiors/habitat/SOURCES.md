# habitat — sources (NASA APIs, fetched 15 Nov 2026 06:05–06:15 Tashkent)

All raw downloads are in `sources/raw/` (NTRS JSON + PDFs, Image Library JSON + `~medium.jpg`).
PDF text was read page by page; page numbers below are PDF pages.

## Documents (keys used in `build_habitat.py` comments)

| key | document | API request that found it | download |
|---|---|---|---|
| **CH** | Howard, *Internal Architecture of the Common Habitat*, NTRS **20210021782** (NASA JSC) | `https://ntrs.nasa.gov/api/citations/search?q=Deep%20Space%20Habitat%20galley%20wardroom%20hygiene&page.size=8` | `https://ntrs.nasa.gov/api/citations/20210021782/downloads/Internal%20Architecture%20of%20the%20Common%20Habitat.pdf` |
| **VTS** | *Vertical Translation System for the Common Habitat Architecture*, NTRS **20220010356** | `https://ntrs.nasa.gov/api/citations/search?q=hatch%20size%20habitat%20crew%20translation&page.size=8` | `https://ntrs.nasa.gov/api/citations/20220010356/downloads/Vertical%20Translation%20System%20for%20the%20Common%20Habitat%20Architecture.pdf` |
| **RadWorks** | Simon, Cerro, Clowdsley, *RadWorks Storm Shelter Design for Solar Particle Event Shielding*, NTRS **20170002287** (NASA LaRC) | `https://ntrs.nasa.gov/api/citations/search?q=storm%20shelter%20radiation%20habitat&page.size=8` | `https://ntrs.nasa.gov/api/citations/20170002287/downloads/20170002287.pdf` |
| **SPE** | Simon, Clowdsley, Walker, *Habitat Design Considerations for Implementing Solar Particle Event Radiation Protection*, NTRS **20140000592** | same search as RadWorks | `https://ntrs.nasa.gov/api/citations/20140000592/downloads/20140000592.pdf` |
| **HDU** | Gill et al., *Integration Process for the Habitat Demonstration Unit*, NTRS **20110007942** | `https://ntrs.nasa.gov/api/citations/search?q=Integration%20Process%20for%20the%20Habitat%20Demonstration%20Unit&page.size=8` | `https://ntrs.nasa.gov/api/citations/20110007942/downloads/20110007942.pdf` |
| **EVA** | *Evaluating Extravehicular Activity Access Options for a Lunar Surface Habitat*, NTRS **20230002484** | `https://ntrs.nasa.gov/api/citations/search?q=suitport%20airlock%20habitat&page.size=8` | `https://ntrs.nasa.gov/api/citations/20230002484/downloads/IEEE%20EVA%20Access%20March%202023%20V3.pdf` |
| **ISS-CQ** | *International Space Station USOS Crew Quarters Development*, NTRS **20080013462** | `https://ntrs.nasa.gov/api/citations/search?q=crew%20quarters%20International%20Space%20Station%20design&page.size=8` | `https://ntrs.nasa.gov/api/citations/20080013462/downloads/20080013462.pdf` |

Photos (NASA Image and Video Library; search → `https://images-api.nasa.gov/asset/<nasa_id>` → `~medium.jpg`):

| nasa_id | search request | what we took from it |
|---|---|---|
| `iss054e022260` (inside ISS crew quarters) | `https://images-api.nasa.gov/search?q=crew%20quarters%20space%20station&media_type=image&page_size=12` | white quilted padded walls; green sleeping bag; grey work shelf |
| `iss028e007685` (Node 2 crew quarters doorway) | `https://images-api.nasa.gov/search?q=crew%20quarters%20Harmony&media_type=image&page_size=15` | off-white rack-size CQ front; **blue handrails**; rounded-square hatch |
| `KSC-08pd3209` (Water Recovery System rack 2) | `https://images-api.nasa.gov/search?q=water%20recovery%20system%20rack&media_type=image&page_size=15` | ECLSS rack look: steel frame, stacked box modules, big round steel tanks |
| `iss034e009690` (Hadfield with CTBs) | `https://images-api.nasa.gov/search?q=cargo%20transfer%20bags&media_type=image&page_size=15` | cargo transfer bags: soft off-white boxes with a blue label patch |
| `KSC-20190325-PH_KLS01_0082` (NextSTEP habitat prototype hatch) | `https://images-api.nasa.gov/search?q=deep%20space%20habitat%20prototype&media_type=image&page_size=15` | hatch: black rubber seal ring, white surround, grey frame ring |
| `iss071e666858` (galley table in Unity) | `https://images-api.nasa.gov/search?q=galley%20space%20station&media_type=image&page_size=15` | dark galley table with white strips; blue handrails; rounded-square hatch with handle |

## Object table

| object | value used | NASA value | source |
|---|---|---|---|
| Hatch opening (outer + inner) | 1.016 × 1.524 m, rounded-square | "sixty inches in height, forty inches in width" | CH p3 |
| Hatch sill / step-over | sill 0.406 m above the airlock floor (top of opening 2.43 m above ground deck) | 16 in step-over | CH p3 |
| Steps beside each hatch | steps on both sides of both hatches (their 0.20 m height is plain: no NASA height fetched) | "a deployable intermediate step on each side of the hatch" | CH p3 |
| Can the game astronaut (1.8 × 0.6 m) pass? | top of opening 1.93 m above the deck (1.524 + 0.406) ≥ 1.8 m, width 1.016 m ≥ 0.6 m → yes, feet step over the sill; checked by rays in the build (`fit_check.json` → `path_check`: 0.6 × 1.8 m body clear porch → ring hall with both hatches open) | "if a suited crew member is shorter than the sum of hatch height and step-over height then stepping over the hatch threshold is sufficient" | CH p3 |
| Airlock (two hatches, suit don/doff room) | vestibule 2.30 × ~1.85 m ≈ 4.3 m², floor 0.5, ceiling 3.1 (**fit to shell**: link opening half-width 2.0, room depth to the hall ring) | habitat airlock floor ≈ 4.7 m², volume 12.0 m³; crew enters the habitat through a hatch, suit don/doff in the airlock | EVA p3, p6 |
| Airlock floor + porch | slatted/grated floor inside, grated porch with a step down outside | HDU EVA porch "suitable gratings on the main deck and ramp to permit sand, dirt, and dust to fall freely"; Airlock/Dust Mitigation Module is the operational entrance | HDU p7, p12–13 |
| Hatch seal colour | dark ring #2a3140 | black seal ring in photo | `KSC-20190325-PH_KLS01_0082` |
| Hatch swing | outer leaf swings into the airlock, inner leaf too (both leaves end up along the side walls) | **no NASA source fetched** — layout choice so neither leaf hits the shelter wall | — |
| Storm shelter in the middle | water-wall ring r 1.5–1.9 m round the core (**fit to shell**: ASTRA HOME.shelter / core) | group shelter "in the center of the habitat" (SPE p3); "centralized placement of the sheltered area resulted in lower exposures" (SPE p9); "placing the crew quarters as close to the center of the habitat as possible" (RadWorks p7) | SPE p3, p9; RadWorks p7 |
| Shelter wall material | 5 courses of water bags (blue) + 3 courses of cargo transfer bags (off-white) | shelter strategies: "Water bags", "Cargo Transfer Bags (CTBs)", "Soft goods storage"; logistics used as shielding | RadWorks p3, p5–6 |
| Shelter wall thickness | 0.40 m (**fit to shell**) | 50 % dose cut: 2.1–5.0 in water (wearable/CQ); 70 %: 3.5–7.7 in; group shelter panels 1.0–5.0 in | RadWorks p10–11; SPE p5–6 (tables) |
| Shelter seats | bench round the north half inside | deployable group shelter "to protect 4 crew" | RadWorks p6 |
| Ladder between decks | ladder from the shelter up through a deck opening into the command room | vertical passage 40 × 60 in; folding ladder; HDU: translation between lower level and loft through an upper hatch/atrium | VTS p1–2, p6; HDU p11 |
| Deck opening | 1.016 × 1.524 m | 40 in × 60 in | VTS p1, p6 |
| Guard rail round the opening | 1.067 m tall, closed on all four sides, with a gate | "42-inch tall, complete wall enclosure on all four sides … easy to open gate" | VTS p6 |
| Two decks | ground floor + upper floor (ASTRA HOME floors 0.5 / 3.35, ceilings 3.1 / 5.95: **fit to shell**, 2.6 m clear) | HDU-DSH: hard-shell base level + inflatable loft as second level; Common Habitat deck heights 2.0–2.85 m | HDU p4, p6; CH p4 |
| Which deck holds what | ground: entrance, shelter, galley/wardroom, hygiene, ECLSS, stowage; upper: crew quarters, command, medical, stowage | separate functions by deck (private / mission / social); walls and doors for private functions | CH p4–5 |
| ECLSS racks | 3 racks 1.049 × 0.859 × 2.014 m on the north side | ISS International Standard Payload Rack 41.3 × 33.8 × 79.3 in; habitat subsystems "primarily environmental control and life support (ECLSS)" pallets | CH p3, p10 |
| ECLSS rack faces | box modules + two round steel tanks | Water Recovery System rack photo | `KSC-08pd3209` |
| ECLSS room on the north side | bearings 335–25 | (ASTRA's own shell has the life-support vent and radiators on the north: habitat.ts) | ASTRA, not NASA |
| Galley | counter with lockers, 2 food warmers, hot/cold water dispenser, overhead lockers | "six modified food warmers", "four water dispensers … hot, ambient, or cold", stowage lockers, trash, "horizontal work surface" (scaled down for our small crew) | CH p8 |
| Wardroom table | 1.70 × 0.86 m top on a locker block, 4 stools | "The table is mounted on eight mid deck lockers"; crew can sit at work places | CH p8, p2 |
| Wall screen in the wardroom | 1.2 × 0.68 m screen on the wall | "panoramic screen mounted on the habitat pressure vessel hull" | CH p8 |
| Table colour | dark top #2a3140 with a white strip | dark table with white strips | `iss071e666858` |
| Hygiene | enclosed: toilet room + wash room, each with a door and stowage locker | separate waste-management and hygiene compartments, stowage; HDU hygiene module = waste collection area + wet bath/general hygiene area + stowage | CH p5; HDU p9 |
| Crew quarters | 4 rooms, one per small upper window; each: horizontal bunk, desk with laptop, locker, window, door | "Each crew quarters contains a horizontal bunk, horizontal work surface, window, and … stowage"; "must have its own door"; four CQs in the RadWorks/HDU study | CH p5; RadWorks p11 |
| CQ door | 1.016 m wide doorway (as the hatch), 2.05 m high | ISS CQ door opening 51 × 102 cm (microgravity — too low for walking, so not used); CH hatch width 40 in | ISS-CQ p5; CH p3 |
| CQ radiation panel | padded panel 6.5 cm thick on the wall beside the bunk | "approximately 6.5 cm of ultra high molecular weight polyethylene" on back wall and ceiling | ISS-CQ p3 |
| Sleeping bag colour | green #7fa86a (by eye) | green sleeping bag | `iss054e022260` |
| Padded walls | white #e8ecf2 (ASTRA white) | white quilted padded walls | `iss054e022260` |
| Handrails | blue #2f6fd6 (ASTRA blue) | blue handrails | `iss028e007685`, `iss071e666858` |
| Command room | desk round the north of the core, 3 screens, 2 chairs (ASTRA HOME.command 1.75 m: **fit to shell**) | Command and Control Center: monitoring and commanding of all subsystems; crew may sit at a workstation | CH p9, p2 |
| Medical corner | bed with raised backrest + wall display | "The surgical bed is reconfigurable to support a variety of patient postures"; "display screen on the wall" | CH p9 |
| Cargo transfer bags | soft off-white boxes with a blue patch on open shelves; 3 big floor bags | CTBs (photo); bulk stowage: "Three M3 stowage bags … each … 10 Cargo Transfer Bag Equivalent … on the floor" | `iss034e009690`; CH p8 |
| Lights | ceiling light panels (glow_lamp), green status lamps at both hatches, screens (glow_screen) | ISS CQ has adjustable lighting (ISS-CQ p1); colours/positions are plain (no NASA layout for lamps) | ISS-CQ p1 |

Plain, unsourced choices (kept simple on purpose): lamp positions, stool/chair shapes, table and counter heights,
shelf counts, the doorway height 2.05 m, light-blue colour of water bags (#6fb0ee, to read as water), the medical
cross-free orange marks on the medical cabinet (shapes only, no text).
