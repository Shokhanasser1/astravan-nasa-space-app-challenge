# YER stansiyasi — NASA modellari va haqiqiy NASA ma'lumotlari taqqoslanishi

"Oy karvonsaroyi" o'yinining birinchi bekati — **Yer**. Bu yerda raketa uchirish maydoni,
"Houston" (Missiya boshqaruv markazi) va Oy hamda Mars bilan gaplashadigan katta antenna bor.
Biz NASA bergan 3D modellarni oldik, o'lchamini haqiqiy o'lchamga moslab qo'ydik (1 Blender birligi = 1 metr),
ranglarini NASA fotosuratlariga qarab tuzatdik.

**3D models: NASA 3D Resources / NASA Science. Not endorsed by NASA.**

Fayllar:
- Sahna skripti: `scenes/yer/build_yer.py` (qayta ishga tushirilsa hammasi noldan quriladi va `yer.blend` saqlanadi)
- Render yordamchisi: `scenes/yer/render_yer.py`, hammasini chiqarish: `scenes/yer/render_all.sh`
- O'yin fonlari (1920x1080 PNG + JPG q82): `renders/yer/yer_bg_launchpad`, `yer_bg_houston`, `yer_bg_dsn`;
  qo'shimcha burchaklar (1280x720): `yer_alt_launchpad_low`, `yer_alt_houston_corner`
- Spritelar (shaffof PNG, ≤512 px, kesilgan): `renders/yer/sprites/yer_sls.png`, `yer_orion.png`, `yer_dsn.png`,
  `yer_helmet.png`, `yer_mobile_launcher.png`
- Taqqoslash renderlari: `renders/yer/compare/yer_cmp_pad.png`, `yer_cmp_dsn.png`, `yer_cmp_mcc.png`
- NASA fotolari (taqqoslash uchun): `docs/ref/yer/ref_*.jpg`, yonma-yon varaqlar: `docs/ref/yer/cmp_*.jpg`

## 1. Asosiy jadval

| Model | Haqiqiy o'lcham (NASA) + manba | Modeldagi o'lcham (bbox) | Masshtab | Ko'rinadigan farqlar | Tuzatildimi? |
|---|---|---|---|---|---|
| **SLS Block 1** (`sls.glb`) | Balandligi 322 ft = **98,1 m**; markaziy bosqich (core stage) 212 ft = 64,6 m, diametri 27,6 ft = **8,4 m**; yon tezlatgichlar (booster) 177 ft x 12 ft = 54 m x 3,7 m. [SLS fact sheet](https://www.nasa.gov/wp-content/uploads/2024/10/sls-4960-sls-fact-sheet-oct2024-508.pdf), [Core stage](https://www.nasa.gov/reference/space-launch-system-core-stage/) | 45,3 x 23,0 x 198,7 birlik. Pastdagi 5,19 birlik — 3D-printer taglik (raketa emas). Raketaning o'zi 193,7 birlik | **0,5063** (98,1 / 193,7) | 1) Bitta kulrang material, rangsiz. 2) Ostida 3D-print taglik. 3) Tezlatgichlar ~10% yo'g'on (4,1 m, haqiqiysi 3,7 m), ICPS 5,5 m (haq. 5,1 m). 4) Tezlatgichni ajratuvchi kichik motorlar (har birida 8 ta) modellanmagan. 5) Haqiqiy raketada NASA "worm" logotipi bor | 1) **Ha** — qismlar va balandlik bo'yicha bo'yaldi: to'q sariq ko'pik (core stage + LVSA konusi), intertank va forward skirt ochroq halqa, oq boosterlar + qora segment chiziqlari, oq-qora "checker" belgilar, oq Orion/LAS, qora LAS soplolari, metall RS-25 dvigatellari. 2) **Ha** — taglik o'chirildi. 3) Yo'q (kichik farq). 4) Yo'q. 5) Logotip ataylab chizilmagan (qoida) |
| ↳ tekshiruv | Core stage 64,6 m x 8,4 m | 128,1 x 16,7 birlik → **64,8 m x 8,45 m** | — | +0,4% / +0,6% — juda yaqin | — |
| ↳ tekshiruv | Booster uzunligi 54 m | 106,6 birlik → **54,0 m** | — | mos | — |
| ↳ tekshiruv | LAS 50 ft = 15,25 m; Orion to'liq steki 67 ft = 20,4 m. [Orion by the numbers](https://www.nasa.gov/wp-content/uploads/2026/01/orion-by-the-numbers-2026b.pdf) | LAS ~16,1 m; Orion steki ~21,6 m | — | +5–6% (model chegaralari taxminiy) | Yo'q |
| **Mobile Launcher 1** (`mobile-launcher.glb`) | Umumiy balandlik **~380 ft (116 m)**, minora ~355 ft, 40 ft (12,2 m) kvadrat ([ML-1 sahifasi](https://www.nasa.gov/humans-in-space/exploration-ground-systems/mobile-launcher/)); eski fact sheet'da "about 400 ft" deyilgan ([FS](https://www.nasa.gov/wp-content/uploads/2021/04/final_-_mobile_launcher_1_fact_sheet.pdf)); taglik 165 x 135 x 25 ft, 22 ft oyoqlarda → "0-deck" **47 ft = 14,3 m**; olov teshigi 34 x 64 ft; raketa 5 ft tayanchlarda. [ML-1 fact sheet](https://www.nasa.gov/wp-content/uploads/2021/04/final_-_mobile_launcher_1_fact_sheet.pdf), [Mobile Launcher](https://www.nasa.gov/humans-in-space/exploration-ground-systems/mobile-launcher/) | 1,02 x 0,87 x 2,46 birlik (normallashtirilgan) | **48,57** (minora eni 12,19 m / 0,251) | 1) O'lcham normallashtirilgan. 2) Eski dizayn: faqat ekipaj ko'prigi (crew access arm) bor; haqiqiy ML-1 da yana 5–6 ta "umbilical" qo'l (Orion SM, ICPS, vehicle stabilizer, forward skirt, intertank) va qizil halqali oq quvurlar bor. 3) Tekstura juda qorong'i. 4) Olov teshigi modelda 7,8 x 18,5 m (haq. 10,4 x 19,5 m) | 1) **Ha** — natija: balandlik 119,7 m = 393 ft (380 ft dan +3,4%), deck 14,6 m (haq. 14,3 m), taglik 48,0 x 40,6 m (haq. 50,3 x 41,1 m). 2) Yo'q (model geometriyasi). 3) **Ha** — fotoga qarab: minora och kulrang-yashilroq po'lat, taglik to'q ko'mir rang. SLS 1,5 m (5 ft) tayanchlarga qo'yildi. 4) Yo'q |
| **Orion** (`orion.glb`) | Ekipaj moduli diametri 16,5 ft = **5,03 m**, balandligi 11 ft = 3,35 m. [Orion by the numbers](https://www.nasa.gov/wp-content/uploads/2026/01/orion-by-the-numbers-2026b.pdf) | 16,31 x 16,30 x 10,63 birlik | **0,3084** (5,03 / 16,31) | 1) Faqat ekipaj moduli (xizmat moduli ESM va 19 m quyosh panellari yo'q). 2) Kulrang STL. 3) Balandlik 3,28 m (−2%) | 1) SLS ichida Orion allaqachon bor, shuning uchun bu model faqat **sprite** sifatida ishlatildi. 2) **Ha** — kumushrang orqa qobiq + jigarrang issiqlik qalqoni. 3) Kichik farq |
| **Mission Control "Houston"** (`mission-control.glb`) | Apollo MOCR-2, Building 30 (Christopher C. Kraft Jr. MCC); 1969-yil 20-iyuldagi ko'rinishga qaytarilgan; old devorda 5 ta katta ekran + tepada 9 ta soat/taymer ekrani; ~20 dan ortiq pult. Xona o'lchami NASA sahifalarida topilmadi. [Apollo MCC restoration](https://www.nasa.gov/johnson/history/apollo-mcc-restoration/), [MCC tarixi](https://www.nasa.gov/history/building-on-a-mission-the-houston-mission-control-center/) | 14,5 x 24,6 x 5,9 m | **1,0** (stol balandligi 0,74 m, klaviatura 0,70 m — real) | 1) Hamma materiallar qop-qora (0,0,0). 2) 5 ta ekran o'rniga bitta keng ekran (9,5 x 3,5 m), tepada 5 ta panel (haq. 9). 3) Haqiqiy xonada AQSh bayrog'i va missiya nishonlari (patch) bor. 4) Pult nomlari (nameplate) yozuvli | 1) **Ha** — och kulrang-yashil pultlar, yashil CRT ekranlar, yonib turgan tugmachalar, iliq bej devor, jigarrang gilam. 2) Katta ekranda Yer → Oy yo'li (yozuvsiz), tepada to'q sariq/yashil raqamli soatlar. 3) Bayroq/patch qo'yilmadi — devordagi ramkalar oddiy ko'k plakat. 4) Nameplate'lar bo'sh. Kamera xona ichida (ship o'chirilmagan) |
| **DSN 34 m antenna** (`dsn-34m.glb`) | Tarelka diametri **34 m** ("112-foot-wide"); DSS-35 (Kanberra) balandligi ~35 m; oq rangda; Goldstone, Madrid, Kanberra. [PIA25136](https://www.jpl.nasa.gov/images/pia25136-a-new-antenna-for-nasas-deep-space-network/), [DSS-35](https://www.cdscc.nasa.gov/Pages/Antennas/dss35.html), [DSN](https://www.nasa.gov/communicating-with-missions/dsn/) | Tarelka 34,02 m, umumiy 36,8 m (1 m poydevor yer ostida) | **0,9993** (≈1) | 1) Tarelka ichidagi halqa to'q kulrang (haqiqiysi butunlay oq). 2) Manba faylida yordamchi "_root" quti bor. 3) Haqiqiy antennada to'q sariq panjaralar va sariq bollardlar bor. 4) Glb faylida tarelka tik (zenitga) qaragan | 1) **Ha** — oq qilindi. 2) **Ha** — yashirildi. 3) Yo'q (kichik detal). 4) **Ha** — azimut/elevatsiya bo'g'inlari aylantirildi, tarelka Oyga qaratildi |
| **Dubulg'a** (`helmet.glb`) | Z-2.5 sinov dubulg'asi pufagi 13 x 10 in (33 x 25 cm). [NTRS 20190027309](https://ntrs.nasa.gov/api/citations/20190027309/downloads/20190027309.pdf). Orion skafandri dubulg'asi o'lchami topilmadi | 14,07 x 14,07 x 13,73 birlik + mayda begona bo'laklar ("Tree" materiali) | **~0,028** (tashqi visor qobig'i ~40 sm deb) | 1) Begona mayda obyektlar. 2) Rangsiz | 1) **Ha** — o'chirildi. 2) **Ha** — oq qobiq + oltinrang quyosh visori (EVA dubulg'alaridagi kabi). Faqat sprite |
| **39B maydon muhiti** (o'zimiz yasadik) | 3 ta chaqmoqdan himoya minorasi ~600 ft (~594 ft) + kabel; suv minorasi 400 000 gallon (~1 514 m³), shuttle davrida 290 ft, maydonning shimoli-sharqida. [Lightning towers](https://www.nasa.gov/blogs/missions/2022/08/27/team-assessing-lightning-strikes-to-towers-at-launch-pad/), [NTRS 20130012038](https://ntrs.nasa.gov/citations/20130012038), [Pad 39B](https://www.nasa.gov/humans-in-space/exploration-ground-systems/launch-pad-39b/), [LC-39 (shuttle)](https://science.ksc.nasa.gov/shuttle/technology/sts-newsref/sts-lc39.html) | — | 1:1 | Soddalashtirilgan: panjara minoralar 181 m, suv minorasi ~88 m va ~1 550 m³ sharsimon bak, maydon tepaligi ~13 m | Suv minorasi o'yin mavzusiga (suv baki) mos — bolalarga ko'rsatsa bo'ladi |
| **Saturn V** (`saturn-v.glb`) | — | — | — | Teksturada chizilgan bayroq va yozuvlar bor | **Ishlatilmadi** (vaqt; yozuvlarni bo'yash kerak bo'lardi) |

## 2. Fotosurat bilan taqqoslash

Uchala NASA fotosi `docs/ref/yer/` papkasida; biz xuddi shunday burchakdan render qildik (`renders/yer/compare/`),
yonma-yon varaqlar: `docs/ref/yer/cmp_pad.jpg`, `cmp_dsn.jpg`, `cmp_mcc.jpg`.

| NASA fotosi | Bizning render | Nima mos | Nima farq qiladi |
|---|---|---|---|
| `ref_sls_pad.jpg` — KSC-20220323-PH-JBS01_0012, "Artemis I at Pad 39B - Sunrise" | `compare/yer_cmp_pad.png` | Minora chapda, raketa o'ngda, bitta booster old tomonda; ekipaj ko'prigi Orionga tegib turibdi; raketa va minora balandligi nisbati; to'q sariq core + LVSA, oq tepa qism, oq boosterlar, och kulrang minora, to'q taglik | Haqiqiy minorada ko'proq quvur va umbilical qo'llar; boosterda NASA logotipi bor (bizda yo'q, qoida); foto quyosh chiqishida, bulutlar ko'p; oldingi plandagi daraxtlar yo'q |
| `ref_dsn34.jpg` — PIA25136, DSS-53 Madrid | `compare/yer_cmp_dsn.png` | Oq tarelka, panjarali tayanch, tepadagi kichik ko'zgu (subreflector) | DSS-53 yangiroq dizayn; foto kunduzi, bizniki quyosh botishida; to'q sariq panjaralar yo'q |
| `ref_mcc.jpg` — S69-59525, Apollo 12 vaqtidagi MOCR | `compare/yer_cmp_mcc.png` | Qatorma-qator och kulrang-yashil pultlar, kichik ekranlar, old devorda katta xarita-ekran, tepada to'q sariq raqamli soatlar | Haqiqiy xona qorong'iroq (ship qora, kichik kvadrat chiroqlar); bizniki bolalar uchun iliqroq va yorug'roq. Haqiqiy xonada 5 ta alohida ekran, bayroq va patchlar (bizda yo'q) |

## 3. Qisqa izohlar

- **Nega SLS to'q sariq?** Core stage va LVSA suyuq vodorod va kislorodni sovuq saqlash uchun to'q sariq
  ko'pik (spray-on foam insulation) bilan qoplangan — bo'yoq emas ([NASA](https://www.nasa.gov/reference/space-launch-system-core-stage/)).
- **Masshtab qanday topildi:** har bir model uchun inventory.json dagi bbox o'lchamini NASA raqamiga bo'ldik.
  SLS uchun 3D-print taglik hisobga olinmadi; ML uchun minora eni (40 ft) ishlatildi, chunki u boshqa o'lchamlarni ham
  yaxshi beradi (deck 14,6 m ≈ 47 ft; balandlik 119,7 m — NASA'ning 380 ft (116 m) qiymatidan 3,4% baland).
- **Brend qoidasi:** hech bir renderda NASA logotipi, bayroq, patch yoki yozuv yo'q. Modellarda yozuvli tekstura
  yo'q edi; Mission Control'dagi nameplate va rasm ramkalari oddiy materialga almashtirildi. Barcha renderlar
  ko'z bilan tekshirildi.
- **Badiiy erkinlik:** DSN sahnasidagi Oy haqiqiydan ~4 marta katta ko'rsatilgan (o'yin uchun); bulutlar va bug'
  (steam) soddalashtirilgan effekt.
- **Suv mavzusi:** 39B maydonidagi suv minorasi 400 000 gallon suv saqlaydi va uchish paytida 30 soniyadan kamroq
  vaqtda hammasini olov kanaliga quyadi (tovush va zarbani yutish uchun) — o'yindagi "suv baki" g'oyasiga yaxshi bog'lanadi.
