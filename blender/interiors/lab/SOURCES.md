# lab (Workshop) — sources

Every real-world fact below was fetched on 15 Nov 2026 from NASA NTRS (`ntrs.nasa.gov/api`) or the NASA Image and
Video Library (`images-api.nasa.gov`, assets on `images-assets.nasa.gov`). Raw responses, PDFs and photos are in
`sources/raw/` (search JSON = `search_*.json`, PDFs = `ntrs_<id>.pdf`, photos = `img_<nasa_id>.jpg`, asset lists =
`asset_<nasa_id>.json`). PDF links: `https://ntrs.nasa.gov/api/citations/<id>/downloads/<id>.pdf`. Asset lists:
`https://images-api.nasa.gov/asset/<nasa_id>`. The exact search request behind every id is in the **request index**
at the end. Photo colours are estimates read from the photos.
"Fit to shell" = ASTRA's `buildLab` hull (cylinder r 0.96, x ±1.95 with domed ends, axis at y 1.363) forces the size;
the real NASA value is given next to it. Where no source gives a detail it is kept plain.

Check (15 Nov, 06:40–06:50): every NTRS id and nasa_id below was traced to a saved search response (script over
`sources/raw/search_*.json`); every quoted number was re-read in the PDF or caption it is credited to. The NTRS
searches whose URL is not stored in the response (msg, mwa, 3dprint) were re-run and returned the same 10 ids in the
same order. The `glovebox lunar sample` image search had been printed but not saved at 06:08; it was re-run and saved
as `search_img_glovebox_lunar_sample.json` (1 hit: S82-26777).

## Shell (not NASA — ASTRA source)
| object | value used | NASA value | source |
|---|---|---|---|
| hull, ribs, windows, hatch spot | lathe profile, r 0.96, axis y = 0.213 + 1.15, ribs at x ±0.4/±1.2 (r 0.965 ± 0.03), windows x ±0.6 south, hatch group at (−1.9, hy, 0) r 0.38 | — (ASTRA game model) | `src/vendor/astra/scene/models/works.ts` `buildLab`, `common.ts` `skid` |
| things poking into the hull | mast foot down to y 2.238 → flat ceiling at y 2.199; cradle horns r 0.90 at x ±0.95 → lining r 0.875 | — | `ref/lab.json` + works.ts |

## Hatch (entrance, west end)
| object | value used | NASA value | source |
|---|---|---|---|
| hatch type | round hinged hatch, single leaf, outward swing | NASA Docking System: "a 31.4961-inch (800 mm) diameter circular hatch for astronauts to pass through when docked … or for entrance or egress on surface environments" | NTRS **20190030368** p.1 abstract; search `https://ntrs.nasa.gov/api/citations/search?q=NASA%20Docking%20System%20hatch%20diameter&page.size=8` |
| clear opening | Ø 0.72 m (fit to shell: ASTRA hatch disc r 0.36, torus r 0.38) | Ø 800 mm / 31.4961 in (NDS, on Orion, = IDSS); "the 32” hatch is in place on the Orion Spacecraft and the 50x50” CBM is currently being used on the International Space Station" | NTRS 20190030368 p.1 (abstract + §1) |
| tunnel / collar depth | 0.28 m collar (x −1.98 → −1.70) | 32″ hatch mock-up: tunnel length 10″ (0.254 m), hatch depth 6¼″ (Table 2) | NTRS 20190030368 p.3, Table 2 |
| hatch size vs crew | kept ASTRA size; see HANDOFF scale note | "the hatch, approximately 32 inches, is too small, and a bigger hatch size would better accommodate most astronauts" (p.1); "A 50x50” or greater size hatch will better accommodate all anthropometries" (p.7) | NTRS 20190030368 p.1, p.7 |
| viewport in the leaf | round window r 0.056 above the hand wheel | Orion: "full window stack that is ready for installation in the docking hatch"; Destiny's hatch has a round window in its middle (photo) | nasa_id **KSC-20180409-PH_AAG01_0001** (caption), search `https://images-api.nasa.gov/search?q=Orion%20hatch&media_type=image`; photo nasa_id **s98e5113** |
| hatch + trim colours | grey leaf, blue trim ring round the bore, blue hand rails | Destiny: grey hatch in a blue frame, white rack faces, blue hand rails, white floor panels, light rows along the ceiling edges | nasa_id **s98e5113** (Destiny interior, 11 Feb 2001); search `https://images-api.nasa.gov/search?q=Destiny%20laboratory%20interior&media_type=image` |
| hand wheel, handles, hinge | plain shapes (orange wheel = ASTRA palette) | not given in a source → kept plain | — |

## Glovebox / sample station (east end)
| object | value used | NASA value | source |
|---|---|---|---|
| role | lunar-sample glovebox mounted on the east bulkhead | GeoLab glovebox: "preliminary examination, by astronauts, of geological samples"; "The glovebox is mounted on the habitat bulkhead, with three sample pass-though chambers" | NTRS **20120007479** (NASA Tech Briefs Feb 2012 p.13), NTRS **20100034890** p.1; search `https://ntrs.nasa.gov/api/citations/search?q=GeoLab%20glovebox%20Habitat%20Demonstration%20Unit&page.size=5` |
| shape + material | trapezoid box (sloped front), stainless steel, clear front + top windows | "trapezoidal-shaped design follows the HDU1-PEM structural rib design"; "304 stainless steel, Viton seals, and clear polycarbonate"; "clear polycarbonate top and front viewing windows" | NTRS 20120007479 |
| glove ports | 2 × Ø 0.25 m in the front window, dark bolted rings, dark gloves | "Two 10-in. (≈25-cm) glove ports were installed in the front polycarbonate window with long-sleeved, 32-in. (≈81-cm) Hypalon gloves" | NTRS 20120007479; ring look: nasa_id **S82-26777** ("Technicians examine lunar samples in a glovebox at NASA's Johnson Space Center": black bolted port rings, black gloves), search `https://images-api.nasa.gov/search?q=glovebox%20lunar%20sample&media_type=image` |
| pass-through antechambers | 3 × Ø 0.25 m cylinders from the box back to the east bulkhead (toward ASTRA's outdoor glovebox); fit to shell: 0.13 m long | "three 10-in. (≈25-cm) diameter, vacuum-rated, pass-through antechambers to transfer samples from the outside EVA porch area"; "17-in. (≈43-cm) long sliding stainless steel tray" | NTRS 20120007479 |
| top lighting | flat LED panel under the top window (glow_light) | "The top of the glovebox was designed to be the main viewing window, and is constructed with low-profile Waldmann Flat LED lighting" | NTRS 20120007479 |
| work volume | 0.92 W × 0.65 H × 0.52 D m | ISS Microgravity Science Glovebox work volume "260 liters, 920 mm wide x 650 mm high x 500 mm deep (at the floor)"; 2 round glove ports in the front (drawing p.2) | NTRS **19990079845** p.4 (+ p.2 drawing); search `https://ntrs.nasa.gov/api/citations/search?q=microgravity%20science%20glovebox&page.size=10`; photo nasa_id **iss058e028142**, search `https://images-api.nasa.gov/search?q=microgravity%20science%20glovebox&media_type=image` |
| instruments inside | sample tray with rocks, stereo microscope, mass balance | 2010 GeoLab: "a mass balance, a stereomicroscope with a HD camera for detailed imaging of samples, and a handheld XRF analyzer" | NTRS 20100034890 p.1 (same search as 20120007479) |
| two monitors above | 2 screens on a post above the box | the photo "The GeoLab Glovebox installed in section H of the HDU1-PEM" shows two monitors mounted above the glovebox | NTRS 20120007479 p.13 photo (same search) |
| rock colour | grey #6f7176 | grey rock in the JSC lunar-sample glovebox photo | nasa_id S82-26777 |

## Maintenance work bench (north wall)
| object | value used | NASA value | source |
|---|---|---|---|
| bench | 2.2 m bench along the north wall (fit to shell), dark-blue surface | ISS Maintenance Work Area: "similar to a work bench on Earth … The MWA is a portable platform that can be set up throughout the space station's U.S. segment"; "The MWA consists of four main components: the Work Surface Area, Containment System, Utility Kit, and Utility Strip" | nasa_id **iss063e004863** (caption), search `https://images-api.nasa.gov/search?q=maintenance%20work%20area%20ISS&media_type=image`; NTRS **20100042411** p.~4, search `https://ntrs.nasa.gov/api/citations/search?q=maintenance%20work%20area%20international%20space%20station&page.size=10` |
| bench look | `int_mwa` #1f3f78 hinged panels, silver hinge strips, white velcro squares, clamps along the front hinge row (orange = ASTRA palette; red in photo) | photo iss063e004863: dark-blue panels, silver hinges, white velcro squares, red clamps | iss063e004863 |
| tool board | dark-blue backboard with light-blue squares; wrench, screwdriver, 2 tape rolls, cutters, socket rail | MWA photo: blue backboard, light-blue velcro holding tools, grey tape rolls; ISS tool kit (caption: "Tools that look much like those that you might find in any residential garage"): chrome wrenches, sockets, screwdrivers, red-handled cutters | iss063e004863; nasa_id **S106E5259**, search `https://images-api.nasa.gov/search?q=ISS%20tool%20kit&media_type=image` |
| drawers | 9 grey/silver drawer fronts under the bench | "retrieves a tool from a drawer in the Unity node": silver metal drawer pulled from a rack | nasa_id **s131e008502**, search `https://images-api.nasa.gov/search?q=tool%20drawer%20station&media_type=image` |
| work surface size, mounting | not found → bench fills the shell's north side | — | — |
| "part being serviced" | plain grey box with open lid + cable | no specific source → kept plain | — |

## 3D printer + robot arm (north-east)
| object | value used | NASA value | source |
|---|---|---|---|
| printer size | 0.33 W × 0.30 H × 0.36 D m | ISS "3D Print": "Dimensions 33 cm x 30 cm x 36 cm", "Print Volume 6 cm x 12 cm x 6 cm", "Mass 20 kg" | NTRS **20140011720** slide ~6; search `https://ntrs.nasa.gov/api/citations/search?q=3D%20printing%20in%20zero-g%20technology%20demonstration&page.size=10` |
| printer look | off-white front, framed landscape window, grey chamber, round dark fan grille, metal build plate + black print tray, grey foam door folded down, feedstock door with black strap on the left | Additive Manufacturing Facility front (frame is bronze in the photo → grey here); 3D Print tray is black | nasa_id **iss047e152500** ("A view of the Additive Manufacturing Facility (AMF)"), search `https://images-api.nasa.gov/search?q=additive%20manufacturing%20facility&media_type=image`; nasa_id **iss042e031282**, search `https://images-api.nasa.gov/search?q=3D%20printer%20space%20station&media_type=image` |
| printed part colour | cream (`int_bag`) | "the filament feedstock used was undyed ABS plastic at 1.75-mm diameter"; the printer "operated inside the Microgravity Science Glovebox (MSG)" | NTRS **20180002403** (same search as 20140011720) |
| AMF | — | "the Additive Manufacturing Facility (AMF), the second generation commercial 3D-printer on ISS"; AMF dimensions not found | NTRS **20190033333** p.~1–2; search `https://ntrs.nasa.gov/api/citations/search?q=additive%20manufacturing%20facility%20Made%20In%20Space%20ISS&page.size=10` |
| robot arm `lab_arm` | small bench arm (base, 2 links, gripper) reaching to the printer door; size fit to bench, colours ASTRA palette | FabLab concept: "This development effort includes a robotic arm to grasp and move the part between an additive manufacturing unit and an inspection chamber or stowage drawer" | NTRS 20190033333 p.~8 |

## Stowage (south wall)
| object | value used | NASA value | source |
|---|---|---|---|
| cargo bags | 8 single CTBs in cubbies, ends out: 0.42 × 0.25 m faces | "a single CTB has approximate dimensions of 50 cm long x 42 cm wide x 25 cm high. CTBs are also available in half, double, and triple sizes" | NTRS **20160002631** p.1–2; search `https://ntrs.nasa.gov/api/citations/search?q=logistics%20reduction%20cargo%20transfer%20bag&page.size=10` |
| bag look | cream #ece7da, blank blue label patch, dark strap handle | "floats near stowed Cargo Transfer Bags (CTBs)": cream bags with blue label patches, zips, straps | nasa_id **iss034e009690**, search `https://images-api.nasa.gov/search?q=cargo%20transfer%20bag&media_type=image` |
| laptop on the counter | plain laptop, glowing screen (no text) | GeoLab sensors "can be remotely viewed by computers on the HDU1-PEM avionics networks" | NTRS 20120007479 |
| rock samples on the counter | 3 grey rocks | "The crewed rovers conducted geological traverses and collected samples … Selected samples were transferred into GeoLab" | NTRS 20100034890 p.1 |

## Lights, rails, walls
| object | value used | NASA value | source |
|---|---|---|---|
| ceiling lights | 8 units 0.50 × 0.13 m (~4:1): white plate, glowing lens, chrome end handles; two rows on the ceiling edges | SSLA photo: long white plate, lens in a chrome bezel, chrome handles at both ends; caption: "The SSLAs were designed to replace General Luminaire Assemblies (GLAs)". The LED module SSLM was built "identical in fit, form, and function" to the GLA (GLA: 30 W, 449 lm, 4.0 kg). Panel size in mm not found → fit to shell | nasa_id **iss049e028948**, search `https://images-api.nasa.gov/search?q=solid%20state%20lighting%20assembly&media_type=image`; NTRS **20090022250** p.1 (report pp.102–103), search `https://ntrs.nasa.gov/api/citations/search?q=solid%20state%20lighting%20assembly%20international%20space%20station&page.size=10`; rows on the ceiling edges: s98e5113 |
| lining, floor, rails | white lining, white/grey floor plates, blue rails | Destiny interior colours | s98e5113 |
| window openings | lining cut-outs in front of ASTRA's 2 south windows | ASTRA shell (windows lit from inside) | works.ts |

## Materials and colours (14)
ASTRA palette = `common.ts` `C` (white #e8ecf2, off #d3d9e2, grey #a9b2c0, steel #8b94a3, dark #2a3140, orange #ff8a3d,
blue #2f6fd6) plus colours ASTRA already uses in its models.

| material | colour | origin |
|---|---|---|
| int_white | #e8ecf2 | ASTRA C.white — lining, cabinets, light plates (white rack faces in s98e5113) |
| int_off | #d3d9e2 | ASTRA C.off — floor plates (white floor panels in s98e5113) |
| int_grey | #a9b2c0 | ASTRA C.grey — hatch leaf, drawers, printer body, stand (grey hatch s98e5113, grey chamber iss047e152500, silver drawer s131e008502) |
| int_steel | #b9c0cb | ASTRA metal colour (`site.ts` footpad `metal("#b9c0cb")`), lighter than C.steel — stainless glovebox (NTRS 20120007479), chrome tools (S106E5259), light handles (iss049e028948) |
| int_dark | #2a3140 | ASTRA C.dark — glove-port rings + gloves (black in S82-26777), print tray (black, iss042e031282), monitors, straps |
| int_blue | #2f6fd6 | ASTRA C.blue — hand rails, hatch trim, window reveals (blue in s98e5113), CTB label patches (blue, iss034e009690), light-blue velcro squares (iss063e004863) |
| int_mwa | #1f3f78 | photo iss063e004863 — MWA work surface + backboard (estimate) |
| int_orange | #ff8a3d | ASTRA C.orange — hand wheel, clamps (red in iss063e004863), cutter handles (red in S106E5259), drawer pulls, hazard band, step edge |
| int_glass | #dff3ff (alpha 0.28) | ASTRA glass (`works.ts` glovebox `glass("#dff3ff")`) — polycarbonate windows (NTRS 20120007479), hatch viewport |
| int_bag | #ece7da | photo iss034e009690 — CTB cream (estimate); also the undyed ABS printed part (NTRS 20180002403) |
| int_rock | #6f7176 | photo S82-26777 — grey lunar sample (estimate) |
| glow_light | #fff4dc, emission 6 | white LED light (SSLA lens iss049e028948; GeoLab flat LED, NTRS 20120007479); warm tint close to ASTRA's work light `light("#fff3d6")` in works.ts — tint not from a NASA source |
| glow_screen | #4fb6ff, emission 2.5 | screens (GeoLab monitors, laptop) — plain blue glow, no text; colour not from a source (kept plain) |
| glow_led | #3ee39a, emission 4 | ASTRA status-lamp green (`common.ts` `light("#3ee39a")`) — status LEDs |

## Request index (every id → the API request it came from → raw files)
NTRS search = `https://ntrs.nasa.gov/api/citations/search?q=<q>&page.size=<n>`; image search =
`https://images-api.nasa.gov/search?q=<q>&media_type=image`.

| id | request (q, page.size) | raw files |
|---|---|---|
| NTRS 20120007479, 20100034890 | `GeoLab%20glovebox%20Habitat%20Demonstration%20Unit`, 5 | `search_geolab.json`, `ntrs_20120007479.pdf`, `ntrs_20100034890.pdf` |
| NTRS 20190030368 | `NASA%20Docking%20System%20hatch%20diameter`, 8 | `search_ntrs_hatch.json`, `ntrs_20190030368.pdf` |
| NTRS 19990079845 | `microgravity%20science%20glovebox`, 10 (re-run 06:45, identical) | `search_ntrs_msg.json`, `ntrs_19990079845.pdf` |
| NTRS 20100042411 | `maintenance%20work%20area%20international%20space%20station`, 10 (re-run 06:45, identical) | `search_ntrs_mwa.json`, `ntrs_20100042411.pdf` |
| NTRS 20140011720, 20180002403 | `3D%20printing%20in%20zero-g%20technology%20demonstration`, 10 (re-run 06:45, identical) | `search_ntrs_3dprint.json`, `ntrs_20140011720.pdf`, `ntrs_20180002403.pdf` |
| NTRS 20190033333 | `additive%20manufacturing%20facility%20Made%20In%20Space%20ISS`, 10 | `search_ntrs_amf.json`, `ntrs_20190033333.pdf` |
| NTRS 20160002631 | `logistics%20reduction%20cargo%20transfer%20bag`, 10 | `search_ntrs_ctb5.json`, `ntrs_20160002631.pdf` |
| NTRS 20090022250 | `solid%20state%20lighting%20assembly%20international%20space%20station`, 10 | `search_ntrs_ssla.json`, `ntrs_20090022250.pdf` |
| s98e5113 | `Destiny%20laboratory%20interior` | `search_img_Destiny_20laboratory_20interior_.json`, `img_s98e5113.jpg` |
| KSC-20180409-PH_AAG01_0001 | `Orion%20hatch` (caption only) | `search_img_Orion_20hatch_.json` |
| S82-26777 | `glovebox%20lunar%20sample` (re-run + saved 06:45) | `search_img_glovebox_lunar_sample.json`, `img_S82-26777.jpg` |
| iss058e028142 | `microgravity%20science%20glovebox` | `search_img_msg.json`, `img_iss058e028142.jpg`, `asset_iss058e028142.json` |
| iss063e004863 | `maintenance%20work%20area%20ISS` | `search_img_mwa.json`, `img_iss063e004863.jpg`, `asset_iss063e004863.json` |
| S106E5259 | `ISS%20tool%20kit` | `search_img_toolkit.json`, `img_S106E5259.jpg` |
| s131e008502 | `tool%20drawer%20station` | `search_img_tooldrawer.json`, `img_s131e008502.jpg` |
| iss047e152500 | `additive%20manufacturing%20facility` | `search_img_amf.json`, `img_iss047e152500.jpg`, `asset_iss047e152500.json` |
| iss042e031282 | `3D%20printer%20space%20station` | `search_img_3dprinter.json`, `img_iss042e031282.jpg`, `asset_iss042e031282.json` |
| iss034e009690 | `cargo%20transfer%20bag` | `search_img_ctb.json`, `img_iss034e009690.jpg`, `asset_iss034e009690.json` |
| iss049e028948 | `solid%20state%20lighting%20assembly` | `search_img_ssla.json`, `img_iss049e028948.jpg`, `asset_iss049e028948.json` |

## Not used (searched or looked at, nothing usable)
"General Maintenance Work Station" (NASA calls it MWA), HDU/Deep Space Habitat interior photos, ReFabricator photo,
AMF dimensions, MSG glove-port diameter, ISS rack outer size, SSLA size in mm. Downloaded but not used for the model:
jsc2022e045011 (Orion docking-hatch evaluation — hatch not readable), iss006e07275 (MWA soft glovebox), MSFC-201900819
(outside of a habitat prototype only), and the other PDFs in `sources/raw/` (EXPRESS rack, MCTB, MSG slides/poster).
