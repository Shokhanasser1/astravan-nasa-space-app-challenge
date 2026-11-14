# HOME BY SEVEN: Higgsfield promptlari (2 kunlik variant)

Dizayn brifiga aynan mos: fayl nomlari, oʻlchamlar, holatlar va soatlar brifdagidek. Eski `HIGGSFIELD-PROMPTS.md` endi ishlatilmaydi.

## 0. Asosiy gʻoya: 2 kunga qanday sigʻadi

1. **Bitta tayanch rasm, qolgani unga qarab.** Birinchi `hab_off` yaratiladi. Keyingi hamma bino shu rasmni namuna (Reference) qilib oladi. Shunda hammasi bitta qoʻl bilan chizilgandek chiqadi.
2. **Holatlar yangidan chizilmaydi, tahrirlanadi.** `hab_on`, `garden_p0`–`p4`, `solar_fixed`, `lander_ready` bu asl rasmni "Edit" qilish. Bino joyidan siljimaydi, tayanch nuqta ham oʻzgarmaydi.
3. **Rangli rasm darhol, kulrang esa undan.** Brif 14:00 da kulrang toʻplamni soʻraydi. Rangli rasmni yaratib, Photopea da bir tugma bilan rangsizlantirasan (`Image › Adjustments › Desaturate`) va oʻsha nom bilan topshirasan. 22:00 da rangli fayl ustidan yoziladi.
4. **AI kerak boʻlmagan joyda AI ishlatilmaydi.** Belgilar, sarlavha, unvonlar va kartalar tayyor kutubxonadan yoki Figma dan olinadi (4-boʻlim). `truth_hero` esa haqiqiy NASA modelidan.

**Hammasi boʻlib taxminan 30 ta rasm.** Har biridan 2 variant chiqarilsa, bu taxminan 60 ta generatsiya. Mening hisobimda bitta 2K rasm 2,75 kredit edi, demak taxminan 170 kredit. Sizda narx boshqacha boʻlishi mumkin.

## 1. Qoidalar (brifdan)

- **Rasm ichida soʻz, raqam, logotip va bayroq yoʻq.** Faqat `art/share/` dagi rasmlarda inglizcha soʻz boʻlishi mumkin, uni ham Figma da yozasan.
- **AI rasm CREDITS.md ga yoziladi.** Namuna qator: `hab_off.webp · AI: Higgsfield GPT Image 2.6 · prompt B1 · 2026-11-14`.
- **Kirish sahnalari va muqova burchagida kichik "AI" yozuvi.** Oʻyin ichidagi mayda rasmlarga ham kerakmi, buni Aminjon Local Lead dan soʻraydi.
- **Hech qanday haqiqiy bolaning yuzi yoki ismi yoʻq.** Buvi va Zuhra fotosuratga oʻxshamasligi kerak.
- **Vaqt:** Space Apps ishni oldindan boshlashni taqiqlaydi. Yakuniy oʻyin rasmlarini shanba 09:00 dan keyin yarat. Juma kechasi faqat sinov va konsept.

## 2. Higgsfield sozlamalari

| Nima | Model | Sozlama |
|---|---|---|
| Baza boʻlaklari, Skaut, quvvat tuguni | **GPT Image 2.6** | Quality High · 1K · Aspect 1:1 yoki 3:2 · **Background: Transparent** |
| Fon (`bg_sky`, `bg_ground`) | GPT Image 2.6 | High · 2K · Aspect 1:1 |
| Portretlar | GPT Image 2.6 | High · 1K · Aspect 1:1 |
| Kirish sahnalari | GPT Image 2.6 | High · 2K · Aspect 3:2 |
| `start_key` | GPT Image 2.6 | High · 2K · Aspect 4:5 |
| Muqova | GPT Image 2.6 | High · 2K · Aspect 16:9 |
| "Edit" promptlari | GPT Image 2.6 | Asl rasmni Reference ga qoʻyasan, oʻlcham oʻsha-oʻsha |

- Shaffof fon chiqmasa: Higgsfield dagi **Remove background**, yoki Photopea dagi `Select › Subject`.
- GPT Image boʻlmasa: **FLUX 3 Image** (10 tagacha namuna rasm oladi).
- Har promptda **2 variant** chiqar va yaxshisini ol. 2 marta urinishdan keyin ham boʻlmasa, 7-boʻlimdagi tuzatish promptini ishlat.

## 3. Ish tartibi (brif soatlariga bogʻlangan)

| Vaqt | Nima qilasan | Promptlar | Brif darvozasi |
|---|---|---|---|
| **Juma 22:00 gacha** (sinov) | Bitta `hab_off` sinovi va bitta namuna portret. Model Studio da 3D sinov. Vektor yoki 3D qarori | B1, P2 | G0 |
| **Sh 09:00–10:00** | `hab_off` yakuniy, `bg_sky`, `bg_ground` | B1, F1, F2 | |
| **10:00–12:00** | `garden`, `workshop`, `scout`, `lander` + hammasining kulrang nusxasi | B2, B3, B4, B5 | G1 12:00 |
| **12:00–14:00** | `solar`, `hub`, `dish` (ghost) + kulrang | B6, B7, B8 | 14:00 kulrang toʻplam |
| **14:00–16:00** | Holatlar: `hab_on`, devor 1–3, bogʻ 0–4, `solar_fixed`, `lander_ready`, `scout_away`. 5 ta portret | E1–E6, P1–P5 | |
| **16:00–19:00** | `start_key`, `truth_hero` (Model Studio), sarlavha (Figma) | K1, K2 | |
| **20:00–22:00** | Rangli fayllarni kulranglar ustidan yozish | | 22:00 rangli |
| **22:00–23:00** | 4 ta kirish sahnasi | S1–S4 | |
| **Yak 09:00–10:00** | Muqova, havola rasmi, video kadrlari (Figma) | C1 | |

---

## 4. AI kerak emas: tezroq yoʻllar

### Belgilar (21 ta SVG, karta belgilari ham): Lucide kutubxonasi
**lucide.dev**: bepul (ISC litsenziya), aynan brifdagidek **24 px panjara, 2 px chiziq, dumaloq uchlar, rang `currentColor`**. Yuklab olasan, nomini brifdagidek qilasan. Bu bir necha soat ish oʻrniga 30 daqiqa.

| Brifdagi nom | Lucide belgisi (lucide.dev da qidir) |
|---|---|
| `ic_energy` | `zap` yoki `battery-full` |
| `ic_air` | `droplets` |
| `ic_dose` | `radiation` |
| `ic_ls` | `heart-pulse` |
| `ic_garden` | `sprout` |
| `ic_workshop` | `wrench` |
| `ic_explore` | `footprints` |
| `ic_launch` | `rocket` |
| `ic_work` | `hammer` |
| `ic_half` | `door-open` |
| `ic_inside` | `house` |
| `ic_lock` | `lock` |
| `ic_warn` | `triangle-alert` |
| `ic_crew` | `users` |
| `ic_science` | `flask-conical` |
| `ic_wall` | `brick-wall` |
| `ic_walk` | `footprints` |
| `ic_info` | `info` |
| `ic_lang` | `languages` |
| `ic_undo` | `undo-2` |
| `ic_close` | `x` |
| `card_shadow` | `mountain` |
| `card_ice` | `snowflake` |
| `card_dust` | `sun-dim` |
| `card_filter` | `filter` |
| `card_request` | `send` |
| `card_tired` | `bed` |
| `card_sunrise` | `sunrise` |

CREDITS.md ga bitta qator: `icons: Lucide (lucide.dev), ISC license`.

### `title_lockup`, unvon nishonlari, video kadrlari: Figma
Matn rasm ichida boʻlmasligi kerak, shuning uchun bularni AI emas, **Figma** da Space Grotesk 700 bilan yozasan. Unvon nishonlari: bitta shakl (masalan olti burchak), ichida Lucide belgisi, 5 ta rangda.

### `truth_hero` (1170×600): haqiqiy NASA modeli
**Model Studio** (claude.ai/artifact/Ek9cnnwNRukSymbkfEbGC7):
1. Model: **Lunar Reconnaissance Orbiter**. Background: **Above the Moon**. Sun: **Orbit**.
2. Kamerani LRO yon tomondan va biroz yuqoridan koʻrinadigan qilib burasan.
3. Size **2048**, Shape **Wide 16:9**, keyin **Save this view**.
4. Photopea da **1170×600** ga qirqasan.

Bu haqiqiy NASA modeli, AI emas. Haqiqat ekranidagi eng muhim kadr uchun bu kuchli dalil. CREDITS: `truth_hero.webp · NASA 3D Resources: Lunar Reconnaissance Orbiter; Moon map: NASA LRO WAC (Moon Trek)`.

---

## 5. Promptlar

Hamma promptlar oʻzi yetarli: nusxa olasan, qoʻyasan. Qavs ichidagi `[...]` joylar yoʻq.

### B. Baza boʻlaklari (`art/base/`, shaffof fon, tayanch nuqta pastki oʻrtada)

#### B1 · `hab_off` · Turar modul · 512 px · ENG BIRINCHI
Aspect 3:2 · Namuna: yoʻq (bu tayanch rasm)

```
The crew habitat of a small Moon base: a horizontal white cylindrical module with rounded end caps, lying on four short sturdy landing legs with round foot pads. Proportions about 2.4 times longer than tall. Three round porthole windows along its side, the glass flat black (lights off). At the left end, a round airlock hatch with a short three-step ladder down to the ground. A band of gold thermal foil wraps the middle of the cylinder. Thin panel seams, two small handrails, one short gray power cable that leaves the bottom left of the module and ends at the ground. The module is unpowered: no glow anywhere.
GAME PIECE: one single isolated object, whole and uncropped, seen from the side and slightly from above (about 15 degrees), standing upright, centered left to right, its base near the bottom of the frame with a small margin, on a fully transparent background. It keeps its own long pure-black shadow on a thin sliver of gray ground directly under it, falling to the right. Nothing else in the frame: no other buildings, no sky, no stars, no Earth.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

#### B2 · `garden_off` · Oy bogʻi · 512 px
Aspect 3:2 · Namuna: **B1 natijasi**

```
The Moon garden of the same base, drawn in exactly the same style, scale and light as the reference image: a short white cylindrical greenhouse module standing upright on three short legs, about as tall as the habitat in the reference but narrower. Its front has one large rectangular window in the middle, the glass flat black (lights off), with an empty planting shelf just visible behind the glass. A small gold-foil radiator fin on the right side, one short gray power cable leaving the bottom left and ending at the ground. Unpowered: no glow anywhere.
GAME PIECE: one single isolated object, whole and uncropped, seen from the side and slightly from above (about 15 degrees), standing upright, centered left to right, its base near the bottom of the frame with a small margin, on a fully transparent background. It keeps its own long pure-black shadow on a thin sliver of gray ground directly under it, falling to the right. Nothing else in the frame: no other buildings, no sky, no stars, no Earth.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

#### B3 · `workshop_off` · Ustaxona · 512 px
Aspect 3:2 · Namuna: **B1 natijasi**

```
The workshop of the same base, drawn in exactly the same style, scale and light as the reference image: a low, wide, boxy white module with slightly rounded corners on four short legs. The front has one wide roll-up door, closed, made of horizontal white slats. On its roof sits a small folded robotic crane arm with two joints. A narrow strip window above the door, its glass flat black (lights off). Gold-foil patches on the roof corners. One short gray power cable leaves the bottom left and ends at the ground. Unpowered: no glow anywhere.
GAME PIECE: one single isolated object, whole and uncropped, seen from the side and slightly from above (about 15 degrees), standing upright, centered left to right, its base near the bottom of the frame with a small margin, on a fully transparent background. It keeps its own long pure-black shadow on a thin sliver of gray ground directly under it, falling to the right. Nothing else in the frame: no other buildings, no sky, no stars, no Earth.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

#### B4 · `scout_home` · Skaut rover · 256 px
Aspect 1:1 · Namuna: **B1 natijasi**

```
Scout, the small exploration rover of the same base, drawn in exactly the same style and light as the reference image. A low white box body the size of a suitcase on four wire-mesh wheels, a flat near-black solar cell top, and one thin vertical mast at the front carrying a single round camera head with one large round lens: its only "eye", ringed with a soft warm-yellow light. No mouth, no arms, no screen face. A tiny whip antenna at the back. Slightly dusty wheels. It stands still, facing right, on a small patch of gray ground with its long shadow.
GAME PIECE: one single isolated object, whole and uncropped, seen from the side and slightly from above (about 15 degrees), standing upright, centered left to right, its base near the bottom of the frame with a small margin, on a fully transparent background. It keeps its own long pure-black shadow on a thin sliver of gray ground directly under it, falling to the right. Nothing else in the frame: no other buildings, no sky, no stars, no Earth.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

#### B5 · `lander_off` · Qoʻnish apparati · 512 px
Aspect 1:1 · Namuna: **B1 natijasi**

```
The crew lander of the same base, drawn in exactly the same style, scale and light as the reference image. A compact modern crew lander standing on four splayed landing legs with round foot pads: a lower descent stage wrapped in gold thermal foil with spherical fuel tanks visible between the legs, and on top an upper white crew cabin with one small triangular black window and a small docking ring on its roof. One engine bell under the center. Unpowered: windows flat black, no lights, no flame. A light dusting of gray regolith on the foot pads.
GAME PIECE: one single isolated object, whole and uncropped, seen from the side and slightly from above (about 15 degrees), standing upright, centered left to right, its base near the bottom of the frame with a small margin, on a fully transparent background. It keeps its own long pure-black shadow on a thin sliver of gray ground directly under it, falling to the right. Nothing else in the frame: no other buildings, no sky, no stars, no Earth.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

#### B6 · `solar_bent` · Quyosh qanoti · 512 px (balandligi)
Aspect 2:3 · Namuna: **B1 natijasi**

```
The solar power tower of the same base, drawn in exactly the same style and light as the reference image: a tall thin white mast on a wide tripod base, carrying one tall, narrow, flat solar panel, dark navy-black cells in a fine grid with a thin silver frame, facing left toward the low Sun. The panel is damaged from a hard landing: its upper third is bent forward at a hinge, hanging at an angle, with one corner crumpled. Everything else is intact. A short gray power cable leaves the base on the right and ends at the ground.
GAME PIECE: one single isolated object, whole and uncropped, seen from the side and slightly from above (about 15 degrees), standing upright, centered left to right, its base near the bottom of the frame with a small margin, on a fully transparent background. It keeps its own long pure-black shadow on a thin sliver of gray ground directly under it, falling to the right. Nothing else in the frame: no other buildings, no sky, no stars, no Earth.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

#### B7 · `hub` · Quvvat tuguni · 256 px
Aspect 1:1 · Namuna: **B1 natijasi**

```
The power hub of the same base, drawn in exactly the same style and light as the reference image: a squat white equipment cabinet the size of a washing machine, standing on a flat metal skid. On its front face, six round lamp sockets in one straight horizontal row, evenly spaced, each one a dark empty round lens (all lamps off). Three short gray cables leave it at ground level to the left and right. A gold-foil top cover. No labels.
GAME PIECE: one single isolated object, whole and uncropped, seen from the side and slightly from above (about 15 degrees), standing upright, centered left to right, its base near the bottom of the frame with a small margin, on a fully transparent background. It keeps its own long pure-black shadow on a thin sliver of gray ground directly under it, falling to the right. Nothing else in the frame: no other buildings, no sky, no stars, no Earth.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

#### B8 · `dish_ghost` · Antenna, hali qurilmagan · 256 px (fayl nomini Shoxjahon aka bilan tekshir)
Aspect 1:1 · Namuna: yoʻq

```
A simple outline drawing of a small communications dish antenna on a short tripod: a round dish about one meter across, tilted up to the left, with a small receiver on three thin struts in front of it. Drawn ONLY as an even dashed outline: white dashes about 6 px long with 6 px gaps, line 3 px thick, rounded ends. No fill, no shading, no shadow, no ground: the inside is empty and transparent. Side view from slightly above. Centered, filling about 80% of a square frame, on a fully transparent background. No text.
```

### E. Holatlar ("Edit": asl rasmni Reference ga qoʻyasan)

#### E1 · `hab_on` · Namuna: **B1 natijasi**

```
Edit the attached image. Keep the module, its outline, size, position, legs, shadow and every detail exactly the same, pixel for pixel. Change only two things: the three porthole windows now glow warm yellow from inside (#F2C24E at the center, softly fading at the edge), and the power cable at the bottom left is now warm gold instead of gray. Nothing else changes. Transparent background stays transparent. No text.
```
Shu prompt bilan qolgan binolarning "on" holatlari ham chiqadi: `garden_on` (B2 dan, bogʻning katta oynasi yonadi), `workshop_on` (B3 dan, eshik ustidagi tor oyna yonadi). `windows` soʻzini mos oynaga almashtirasan.

#### E2 · `hab_wall1`, `hab_wall2`, `hab_wall3` · Tuproq devori · Namuna: **E1 natijasi**
Uch marta yaratasan: `LEVEL` oʻrniga navbat bilan qoʻyasan.
- wall1: `one row of bags, reaching about one quarter of the module's height`
- wall2: `three rows of bags, reaching just below the windows`
- wall3: `five rows of bags, covering everything up to the windows and reaching the very top edge of the legs, with the windows still fully visible above the wall`

```
Edit the attached image. Keep the module, its windows, size and position exactly the same. Add only a protective wall in front of it: a low curved wall of sandbags filled with gray Moon soil, built along the full length of the module in front of its legs. The bags are rough woven fabric in light and dark gray, stacked like bricks in neat rows. LEVEL. The wall casts its own long black shadow to the right like everything else. Nothing else changes. Transparent background stays transparent. No text.
```
**Ustki qatlam (overlay) qilish, har biriga 3 daqiqa:** Photopea da devorli rasmni och, `Eraser` bilan devordan boshqa hamma joyni (modul, oynalar, oyoqlar) oʻchir. Kenglik va balandlik oʻzgarmasin, shunda devor binoga aniq tushadi.
**Vaqt kam boʻlsa:** Shoxjahon akadan soʻra, toʻliq rasmlarni (`hab_on_wall1` va hokazo) qabul qila oladimi. Unda oʻchirish kerak boʻlmaydi.

#### E3 · `garden_p0` … `garden_p4` · Bogʻ oʻsimligi · Namuna: **`garden_on` natijasi**
Besh marta yaratasan: `STAGE` oʻrniga navbat bilan qoʻyasan.
- p0: `the shelf holds a row of small wilted, drooping brown-gray seedlings`
- p1: `the shelf holds a row of tiny fresh green sprouts`
- p2: `the shelf holds a row of small young lettuce plants`
- p3: `the shelf holds a row of half-grown leafy lettuce plants`
- p4: `the shelf is packed with full, healthy, deep-green leafy lettuce heads ready to harvest`

```
Edit the attached image. Keep the greenhouse module, its glowing window, size and position exactly the same. Change only what is visible behind the large window: STAGE. Plants are seen through the glass, lit by the warm light inside. Nothing else changes. Transparent background stays transparent. No text.
```
Ustki qatlam: Photopea da oyna ichidagi oʻsimliklardan boshqasini oʻchirasan (E2 dagidek).

#### E4 · `solar_fixed` · Namuna: **B6 natijasi**

```
Edit the attached image. Keep the mast, the tripod, the panel size, the position, the light and the shadow exactly the same. Change only the damage: the upper third of the panel is now straightened and flat again, in line with the rest, and the crumpled corner is repaired, so the whole panel is one clean straight rectangle. Nothing else changes. Transparent background stays transparent. No text.
```

#### E5 · `lander_ready` · Namuna: **B5 natijasi**

```
Edit the attached image. Keep the lander, its legs, size, position and shadow exactly the same. Change only three things: the small triangular cabin window glows warm yellow from inside; two small navigation lights on the cabin glow, one on each side; and a faint soft warm glow appears inside the engine bell, ready for launch, with no flame and no smoke. Nothing else changes. Transparent background stays transparent. No text.
```

#### E6 · `scout_away` · Faqat izlar · Namuna: **B4 natijasi**

```
Edit the attached image. Remove the rover completely. Keep only the small patch of gray ground under it, now showing two parallel sets of fresh wheel tracks that start where the rover stood and curve away to the right edge of the image. Same light from the left. Transparent background around the ground patch stays transparent. No text.
```

### F. Fon (`art/base/`)

#### F1 · `bg_sky` · 1170×1200, ≤150 KB
Aspect 1:1 · Namuna: yoʻq

```
Background for a Moon game, sky layer only. A deep, almost black night-blue sky, flat and calm (#090E22). Only a few faint, small, dim stars, scattered sparsely, mostly in the upper half. On the right side, at about 40% of the image height from the top (just above where the ground layer's horizon will sit), hangs a small Earth: about 7% of the image width, half-lit from the left, blue oceans and white cloud swirls on the lit half, the night half almost invisible. The Earth is the only saturated color in the image. No ground, no Moon, no Sun, no glow, no nebula, no Milky Way band, no text.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

#### F2 · `bg_ground` · 1170×1200, ≤200 KB
Aspect 1:1 · Namuna: `nasa-real-kit/models/Moon - Lunar Terrain.jpg` (haqiqiy Apollo surati)

```
Background for a Moon game, ground layer: the Moon's south pole seen from the side and slightly above. The horizon line sits exactly at 55% of the image height; everything above it is fully transparent. Below the horizon: gently rolling gray regolith ground, lit by a very low Sun from the LEFT, so the ground is lighter on the left (#C9CCD6) and darker toward the right (#7C8199), with small craters (#5E637B in their shadowed half) and a few rocks, each throwing a long pure-black shadow to the right. On the far horizon, two broad, smooth, gently sloped massifs, as crisp as the near ground (no haze), their left slopes lit and right slopes in deep shadow. In the lower middle, a wide, flat, smooth, cleared strip of ground across the whole width, with almost no rocks, where buildings will stand. No grass, no water, no blue anywhere, no buildings, no text.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

### P. Portretlar (`art/faces/`, 512×512, muhim qism oʻrtadagi doira ichida)

Birinchi portret (P2) qolgan toʻrttasi uchun namuna boʻladi.

#### P1 · `face_houston` · Namuna: **P2 natijasi**

```
Portrait for a game dialog, inside a circle: a mission control flight director seen as a simple calm silhouette from the chest up, wearing a headset with a small microphone, facing slightly left. The person is softly backlit by the teal-green glow (#1596A6) of control room screens behind them, so the face stays a soft dark shape with no detailed features. Simplified, friendly, adult. Dark navy background (#0E1430). Everything important fits inside a centered circle that fills 90% of the square.
PORTRAIT RULES: square image. The subject is centered and fits inside a circle that fills 90% of the square, because the game crops it to a circle; the corners stay plain. Do not draw the circle, a frame or a border. No text.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

#### P2 · `face_pilot` · Namuna: **B1 natijasi** (uslub uchun)

```
Portrait for a game dialog, inside a circle: an astronaut in a white Moon surface suit, seen from the chest up, facing slightly left, helmet on, with the gold sun visor fully lowered so that no face is visible. The visor softly reflects a gray horizon line. One single warm-gold stripe (#DFA02E) across the right shoulder of the suit. No patches, no flags, no lettering. Light from the left. Dark navy background (#0E1430). Everything important fits inside a centered circle that fills 90% of the square.
PORTRAIT RULES: square image. The subject is centered and fits inside a circle that fills 90% of the square, because the game crops it to a circle; the corners stay plain. Do not draw the circle, a frame or a border. No text.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

#### P3 · `face_scout` · Namuna: **B4 natijasi**

```
Portrait for a game dialog, inside a circle: a close-up of the small rover Scout from the reference image: its single round camera head on the thin mast, filling most of the circle, the one large round lens ringed with warm-yellow light, slightly tilted like a curious head. No mouth, no added face, no arms. Part of the white body and solar top visible at the bottom. Light from the left. Dark navy background (#0E1430). Everything important fits inside a centered circle that fills 90% of the square.
PORTRAIT RULES: square image. The subject is centered and fits inside a circle that fills 90% of the square, because the game crops it to a circle; the corners stay plain. Do not draw the circle, a frame or a border. No text.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

#### P4 · `face_buvi` · Namuna: **P2 natijasi** (uslub uchun)

```
Portrait for a game dialog, inside a circle: a kind Uzbek grandmother in the evening courtyard of her house in Samarkand, seen from the chest up, facing slightly right, smiling softly. She wears a soft white headscarf tied behind her head and a dark vest over a long patterned dress. Simple drawn features: gentle eyes and a small smile, no photographic detail. Behind her, out of focus, a warm hanging lamp and green grape-vine leaves. Warm golden evening light. Painterly illustration, clearly drawn by hand, NOT a photograph. Everything important fits inside a centered circle that fills 90% of the square.
PORTRAIT RULES: square image. The subject is centered and fits inside a circle that fills 90% of the square, because the game crops it to a circle; the corners stay plain. Do not draw the circle, a frame or a border. No text.
STYLE: warm hand-painted storybook illustration for a children's game. Simplified shapes with soft two-tone shading, no black outlines, gentle brush texture, warm golden lamp light against deep blue evening tones. Real proportions. People are drawn simply, with minimal facial detail, and clearly read as an illustration, never as a photograph. NOT ALLOWED: text, letters, numbers, logos, flags, watermarks, the likeness of any real person.
```

#### P5 · `face_zuhra` · Namuna: **P4 natijasi**

```
Portrait for a game dialog, inside a circle, in exactly the same drawn style as the reference image: the grandmother's granddaughter Zuhra, a cheerful girl of about six, in the same evening courtyard, seen from the chest up, facing slightly left, with two dark braids and a small embroidered Uzbek skullcap on her head, holding a toy telescope and pointing up. Simple drawn features: big bright eyes and a wide smile, no photographic detail. Warm lamp light, grape-vine leaves behind. Painterly illustration, clearly drawn by hand, NOT a photograph, not a real child. Everything important fits inside a centered circle that fills 90% of the square.
PORTRAIT RULES: square image. The subject is centered and fits inside a circle that fills 90% of the square, because the game crops it to a circle; the corners stay plain. Do not draw the circle, a frame or a border. No text.
STYLE: warm hand-painted storybook illustration for a children's game. Simplified shapes with soft two-tone shading, no black outlines, gentle brush texture, warm golden lamp light against deep blue evening tones. Real proportions. People are drawn simply, with minimal facial detail, and clearly read as an illustration, never as a photograph. NOT ALLOWED: text, letters, numbers, logos, flags, watermarks, the likeness of any real person.
```

### K. Bosh ekran (`art/ui/`)

#### K1 · `start_key` · 1170×1400, ≤250 KB
Aspect 4:5 · Namuna: **B5 natijasi** + **F2 natijasi**

```
Title screen art for a Moon game, portrait format. The crew lander from the reference image stands on the gray south-pole ground in the lower third, slightly right of center, its cabin window glowing warm yellow, its long black shadow stretching right. The ground is lit by a very low Sun from the left. Above the horizon a deep night-blue sky (#090E22) with a few faint stars. In the upper right, at about one third of the height, a small half-lit blue-and-white Earth. The whole upper 35% of the image is calm, empty sky, kept free for the game title. Do not draw any title, letters or numbers.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```
Orbita chizigʻini Figma da qoʻshasan: Yerdan oʻtadigan ingichka punktir yoy (oq, 2 px, 40% shaffof).

### S. Kirish sahnalari (`art/story/`, 1170×780, ≤180 KB, burchakda kichik "AI")

#### S1 · `story_1` · Hovli (Samarqand, kechqurun)
Aspect 3:2 · Namuna: **P4 natijasi** + **P5 natijasi**

```
Story scene for a children's game, in exactly the same drawn style as the reference portraits. Evening in a traditional courtyard house in Samarkand: a wooden tapchan day-bed with a red-and-gold suzani cloth, a grape-vine trellis overhead, a warm lamp hanging in a carved wooden doorway, warm brick walls, and far beyond the roofs the turquoise dome of an old madrasa against a deep-blue dusk sky. A large bright full Moon rises above the dome. In the doorway, the grandmother from the reference calls out with one hand raised. In the middle of the courtyard a child of about ten stands seen completely from behind, looking up at the Moon. The child's face is never shown. Warm, cozy, magical, calm.
STORY FRAME: wide 3:2 image. Keep the bottom 20% calm and simple, because subtitles appear there, and keep the top-right corner plain for a small AI label. No text, letters or numbers anywhere.
STYLE: warm hand-painted storybook illustration for a children's game. Simplified shapes with soft two-tone shading, no black outlines, gentle brush texture, warm golden lamp light against deep blue evening tones. Real proportions. People are drawn simply, with minimal facial detail, and clearly read as an illustration, never as a photograph. NOT ALLOWED: text, letters, numbers, logos, flags, watermarks, the likeness of any real person.
```

#### S2 · `story_2` · Xyuston (oʻquv markazi)
Aspect 3:2 · Namuna: **P2 natijasi** + **S1 natijasi** (uslub uchun)

```
Story scene for a children's game, same drawn style as the reference images. Years later: a bright, high astronaut training hall on Earth. A young astronaut trainee in a white suit, seen from behind and from the side so that no face shows, stands before three training stations side by side: on the left, a tall frame with a harness hanging from an overhead cable (to practice walking in Moon gravity); in the middle, a tall clear vacuum chamber with a hammer and a feather hanging inside; on the right, a short half-built wall of gray sandbags. Soft daylight from high windows, clean white and gray surfaces, a few teal-green monitor glows (#1596A6) on a console in the background with no readable text. Calm and focused.
STORY FRAME: wide 3:2 image. Keep the bottom 20% calm and simple, because subtitles appear there, and keep the top-right corner plain for a small AI label. No text, letters or numbers anywhere.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

#### S3 · `story_3` · Uchish (Buvi va Zuhra uydan koʻradi)
Aspect 3:2 · Namuna: **S1 natijasi**

```
Story scene for a children's game, in exactly the same drawn style and the same Samarkand courtyard as the reference image, but now at dawn: pale gold and pink sky, the lamp still glowing. The grandmother and the little girl Zuhra sit together on the tapchan, seen from behind and from the side so that their faces are hidden, watching the launch on a tablet that Zuhra holds up. On its screen, a bright white rocket rises on a column of flame from a launch pad by the sea. The screen shows only the picture: no text, no buttons, no logos. Zuhra waves at the screen with her free hand. A pale, thin daytime Moon hangs above the madrasa dome. Hopeful, warm, a little emotional.
STORY FRAME: wide 3:2 image. Keep the bottom 20% calm and simple, because subtitles appear there, and keep the top-right corner plain for a small AI label. No text, letters or numbers anywhere.
STYLE: warm hand-painted storybook illustration for a children's game. Simplified shapes with soft two-tone shading, no black outlines, gentle brush texture, warm golden lamp light against deep blue evening tones. Real proportions. People are drawn simply, with minimal facial detail, and clearly read as an illustration, never as a photograph. NOT ALLOWED: text, letters, numbers, logos, flags, watermarks, the likeness of any real person.
```

#### S4 · `story_4` · Oy tortadi (qoʻnish)
Aspect 3:2 · Namuna: **B5 natijasi** + **F2 natijasi**

```
Story scene for a children's game, in the same style as the reference images. The crew lander from the reference descends toward the Moon's south pole, seen from the side at about one third of the image from the left, slightly tilted, its engine firing a short clean bright flame straight down and blowing a low flat ring of gray dust outward along the ground (no smoke, no clouds: there is no air). One of its solar panels is slightly bent. Below and to the right, the rolling gray south-pole ground with long black shadows from a very low Sun on the left; on the horizon, two broad massifs. A small half-lit Earth low in the deep night-blue sky. Leave the right half of the sky and ground calm and clear: lines will be drawn there by the game.
STORY FRAME: wide 3:2 image. Keep the bottom 20% calm and simple, because subtitles appear there, and keep the top-right corner plain for a small AI label. No text, letters or numbers anywhere.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```

### C. Muqova (`art/share/`)

#### C1 · `cover` 1920×1080 va `og` 1200×630
Aspect 16:9 · Namuna: **K1 natijasi** + **E1 natijasi** + **B4 natijasi**

```
Wide cover image for a children's Moon game. The south-pole ground lit by a very low Sun from the left, long pure-black shadows to the right. On a flat line across the lower third, the small Moon base from the reference images, left to right: a tall solar panel tower, a small power cabinet, the white habitat module with its three windows glowing warm yellow and a low wall of gray soil bags in front, a small greenhouse with green plants glowing in its window, a boxy workshop, the small rover Scout, and the crew lander with its window lit. Deep night-blue sky with a few faint stars; a small half-lit Earth low on the right. The left 40% of the sky is calm and empty, kept free for the title. Do not draw any title, letters or numbers.
STYLE: simplified-realistic illustration for a phone game. Real proportions of real NASA-style hardware, but few details: big simple shapes that stay readable when the object is only 100 pixels wide. Every surface has just two flat tones, a lit tone and a shadow tone, with at most a very subtle soft gradient. No black outlines, no line art, no texture noise, no photographic grain. Materials: matte white panels (lit #F2F2EF, shadow #A9AEC0), gold thermal foil (lit #DFA02E, shadow #9A6A1E), flat black glass. Light: a very low Sun from the far LEFT, so every shadow is long, sharp, pure black and falls to the right. Lit windows and lamps are warm yellow, and only on powered objects. Moon ground grays: light #C9CCD6, mid #8A8FA3, dark #7C8199, crater #5E637B. NOT ALLOWED: text, letters, numbers, labels, logos, flags, mission patches, watermarks, blue sky, clouds, haze, neon, glowing outlines, science-fiction shapes, and eyes or mouths on machines.
```
`og` (1200×630) ni muqovadan qirqasan. Sarlavha va "AI" yozuvini Figma da qoʻshasan.

---

## 6. Eksport (Photopea, bepul, brauzerda)

1. **Oʻlcham:** `Image › Canvas Size` bilan brifdagi oʻlchamga keltirasan. Bino rasmning pastki oʻrtasida tursin.
2. **Tayanch nuqta:** binoning yerga tegib turgan oʻrta nuqtasining pikselini `manifest.json` ga `anchor` deb yozasan.
3. **Kulrang nusxa:** `Image › Adjustments › Desaturate` va oʻsha nom bilan eksport.
4. **WebP:** `File › Export as › WebP`, sifat 85–90. Baza boʻlagi 60 KB dan oshmasin.
5. **Repoga:** `src/art/...` ga qoʻyasan, keyin `manifest.json` va `CREDITS.md` ni yangilaysan.

## 7. Tuzatish promptlari

Rasmni Reference ga qoʻyib, keragini yuborasan.

```
Edit the attached image. Keep everything exactly the same, but remove every piece of text, letter, number, label, logo, flag and patch, replacing each with plain matching surface.
```

```
Edit the attached image. Keep everything exactly the same, but simplify it: fewer small details, bigger flat shapes, each surface in only two flat tones (a lit tone and a shadow tone), no outlines, so it still reads clearly when shown 100 pixels wide.
```

```
Edit the attached image. Keep everything exactly the same, but make the light come only from the far left at a very low angle, with every shadow long, sharp, pure black and falling to the right.
```

```
Edit the attached image. Keep everything exactly the same, but make the background fully transparent, keeping only the object and its own shadow on the ground directly under it.
```

```
Edit the attached image. Keep everything exactly the same, but match the drawing style of the second reference image exactly: same flat two-tone shading, same line-free edges, same colors for white panels and gold foil.
```

## 8. Har bir rasm uchun tekshiruv (brifning "Tayyor degani" roʻyxatidan)

- [ ] Rasm ichida soʻz, raqam, logotip, bayroq yoʻq.
- [ ] Yorugʻlik chapdan, soya oʻngga, uzun va qora.
- [ ] Osmon qora-koʻk. Koʻk osmon, tuman, neon yoʻq. Yer yagona toʻyingan rang.
- [ ] Bino 110–130 px kenglikda ham taniladi (Photopea da kichraytirib qara).
- [ ] Har yuzada ikki tus, qora kontur yoʻq.
- [ ] Faqat quvvat olgan narsa yonadi (oʻchiq holatda hech qanday nur yoʻq).
- [ ] Yuz koʻrinmaydi: skafandrlarda visor yopiq. Buvi va Zuhra chizilgan, fotosuratga oʻxshamaydi.
- [ ] Holat rasmlari asl rasm bilan bir xil oʻlcham va joyda.
- [ ] Fayl nomi brifdagidek, `manifest.json` va `CREDITS.md` yangilangan.
