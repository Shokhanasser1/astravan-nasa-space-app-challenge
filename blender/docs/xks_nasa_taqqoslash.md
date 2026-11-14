# XKS (Xalqaro kosmik stansiya) — NASA modellari va haqiqiy NASA ma'lumotlari taqqoslanishi

"Oy karvonsaroyi" o'yinining 2-bekati: XKS (ISS). Bu hujjatda Blender sahnasida ishlatilgan har bir NASA 3D modeli
haqiqiy NASA ma'lumotlari bilan solishtirilgan: haqiqiy o'lcham, modelning o'lchami, qo'llangan masshtab,
ko'rinadigan farqlar va nima tuzatilgani.

**Kredit:** 3D models: NASA 3D Resources / NASA Science. Not endorsed by NASA. Earth: NASA Blue Marble Next Generation.

- Skript: `scenes/xks/build_xks.py` (qayta ishga tushirsangiz hammasini noldan quradi va `scenes/xks/xks.blend` ni saqlaydi)
- Renderlar: `renders/xks/xks_bg_orbit_1920x1080.png|jpg`, `renders/xks/xks_bg_spacewalk_1920x1080.png|jpg` (fonlar), `renders/xks/sprites/*.png` (shaffof spraytlar, ≤512 px), `renders/xks/check/` (brend-qoida tekshiruvi)
- NASA fotolari (taqqoslash uchun): `docs/ref/xks/`
- Birlik: **1 Blender birligi = 1 metr**. Har bir model haqiqiy o'lchamiga keltirilgan.

## 1. Asosiy jadval

| Model | Haqiqiy o'lcham (manba) | Model o'lchami (inventory bbox) | Masshtab | Farqlar | Tuzatildimi? |
|---|---|---|---|---|---|
| **iss** — XKS | Uchidan-uchigacha **109 m** (356 ft, quyosh panellari bilan), truss 94 m (310 ft), bosimli modullar zanjiri **67 m** (218 ft), bo'ylama panellar orasi 73 m (239 ft), massa 419 725 kg, balandlik ~400 km (370–460 km), 90 daqiqada 1 aylanish — [NASA facts](https://www.nasa.gov/international-space-station/space-station-facts-and-figures/) | 14.4 × 45.5 × 45.4 birlik (bbox ichida stansiyadan 41 birlik uzoqdagi 7 ta ortiqcha disk ham bor); stansiyaning o'zi 6.1 × 45.5 × 29.9 | **×2.393** (45.54 → 109 m) | Natija: 109 m × 71.7 m (haqiqiy 73 m ✓). Bosimli modullar zanjiri ~45 m — haqiqiydan (67 m) ~33% qisqa. Truss — oddiy quti (panjara yo'q), 102 m (haqiqiy 94 m). Barcha materiallar bir xil kulrang, tekstura yo'q. Eski konfiguratsiya (taxminan 2011-yil): **Nauka + Prichal (2021), Bishop (2020), BEAM (2016), iROSA panellari (2021–2026)** yo'q; Pirs (2021-da olib tashlangan) hali bor ko'rinadi. Quyosh panellari bir holatda qotgan (SARJ/BGA aylanmaydi) | Ha: yangi materiallar (oq MLI modullar, kulrang-alyumin truss, to'q-sariq panellar, oq radiatorlar), 7 ta ortiqcha disk o'chirildi, **8 ta iROSA qo'shildi**, radiatorlar qayta qurildi. Yo'q: modul uzunligi, Nauka/Prichal |
| ↳ eski (legacy) quyosh paneli qanoti | 8 qanot, har biri **35 × 11.6 m** (115 × 38 ft), Kapton plyonka — to'q-sariq/amber, kumushrang chiziqlar — [NASA podcast](https://www.nasa.gov/podcasts/houston-we-have-a-podcast/station-solar-arrays/), [NTRS 20200002554](https://ntrs.nasa.gov/api/citations/20200002554/downloads/20200002554.pdf) | har qanot 13.9 × 3.4 birlik (2 ta varaq) | ×2.393 → **33.3 × 8.1 m** | Uzunligi to'g'ri, lekin ~30% tor (8.1 m va 11.6 m). Rangi kulrang edi | Rang: ha (to'q-sariq katakchalar + kumush chiziqlar, NASA foto iss061e005514 ga qarab). Kenglik: yo'q |
| ↳ radiatorlar | Asosiy HRS: 6 ta, har biri **23.3 × 3.4 m**, oq (Z-93 qoplama); PVR: 4 ta, **13.6 × 3.1 m** — [NASA ATCS overview](https://www.nasa.gov/wp-content/uploads/2021/02/473486main_iss_atcs_overview.pdf) | HRS 8.1 × 1.4 birlik, PVR 3.9 × 1.1 birlik, zig-zag (akkordeon) shaklda | ×2.393 → HRS 19.4 × 3.4 m, PVR 9.3 × 2.6 m | Zig-zag panellarning yarmi quyoshdan teskari qarab, renderda **qop-qora shaxmat** bo'lib chiqdi | Ha: radiator yuzalari o'chirildi va o'sha joyga tekis oq panellar (panelma-panel ozgina farqli oqlik bilan) qurildi. Uzunlik o'zgartirilmadi |
| **solar-wing** → iROSA sifatida | iROSA: **18.3 × 6 m** (60 × 20 ft), har biri 20+ kW; **8 tadan 8 tasi o'rnatilgan**: 2B/4B (2021-iyun), 3A/4A (2022-dek), 1A/1B (2023-iyun), 2A (2026-okt), 3B (**2026-yil 5-noyabr**, oxirgisi) — [NASA blog 2026-11-05](https://www.nasa.gov/blogs/spacestation/2026/11/05/spacewalkers-install-final-roll-out-solar-array/), [assembly elements](https://www.nasa.gov/international-space-station/international-space-station-assembly-elements/) | umumiy sun'iy yo'ldosh qanoti, 0.09 × 0.099 × 0.002 birlik (2 ta kichik ko'k panel) | bitta panel notekis masshtablandi → **6.0 × 18.3 × 0.08 m** | ISS'niki emas — oddiy och-ko'k "sun'iy yo'ldosh" paneli | Ha: to'q-ko'k katakli material, har bir eski qanot ustiga ildiz tomondan 10° qiyalikda 1 tadan (jami 8) o'rnatildi — bugungi (2026-noyabr) XKS ko'rinishi |
| **earth-globe** — Yer | Radius **6 371 km** — [NSSDC Earth fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html); 400 km dan gorizont ~2 293 km uzoqda, ~19.8° pastda | 2 birlik shar, 9 024 uchburchak, 2048 × 1024 tekstura | radius → **6 371 000 m** (o'z sharimiz, 512 × 256 segment) | Glb shari juda qo'pol (gorizont qirrali chiqardi), tekstura 20 km/piksel — xira | Ha: haqiqiy o'lchamdagi silliq shar, tekstura **Blue Marble NG Oktyabr 2004, 5400 × 2700** ([science.nasa.gov](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/october/world.topo.bathy.200410.3x5400x2700.jpg)) ga almashtirildi, protsedural bulutlar va atmosfera chegarasi qo'shildi |
| **emu** — skafandr | ISS EMU (PLSS + SAFER bilan) **145 kg** (319 lb); 1.57–1.88 m (5'2"–6'2") bo'yli odamlarga mos; oq, 1-astronavt qizil chiziqli; kislorod 7 soat + 30 daqiqa zaxira — [NASA EMU fact sheet](https://www.nasa.gov/wp-content/uploads/2015/07/2019_07_ea_emu.pdf), [spacesuit basics](https://www.nasa.gov/centers-and-facilities/johnson/spacewalk-spacesuit-basics/) | 1.13 × 1.41 × **2.00** | **×0.949** → bo'yi **1.90 m** (taxmin: 1.88 m odam + etik/dubulg'a; NASA bitta "bo'y" raqami bermaydi) | Barcha materiallarda glTF transmission=1 — skafandr shishadek shaffof ko'rinardi; AQSh bayrog'i (emusuitFLAGpatch), missiya yamog'i (emusuitvitruvianpatch), yozuvli DCM qutisi (emusuitbox4); ryukzakda jigarrang qatlam | Ha: shaffoflik o'chirildi (oq mato), bayroq/yamoq/yozuvli 4 material oddiy oq/kulrang materialga almashtirildi va bu 3 rasm fayldan o'chirildi; visor oltin rang |
| **astronaut** | yuqoridagi EMU bilan bir xil | 68.9 × 27.6 × **74.3** (T-poza) | **×0.02558** → 1.90 m | Teksturaga 2 ta AQSh bayrog'i, NASA logotipi (meatball), missiya yamog'i chizilgan | Ha: numpy bilan teksturadagi rangli/qora joylar avtomatik topildi va atrofdagi oq mato rangi bilan bo'yaldi (9 ta to'rtburchak). Tekshiruv renderlari: `renders/xks/check/chk_astronaut_front.png`, `chk_astronaut_back.png` |
| **robonaut-2** | **150 kg** (330 lb), beldan boshgacha **1.02 m** (3 ft 4 in), yelka kengligi 0.79 m, oyoqlar to'liq ochilganda 9 ft (2.7 m); 2011 STS-133 bilan uchgan, oyoqlar 2014, 2018-yil Yerga qaytgan — [R2 fact sheet](https://www.nasa.gov/wp-content/uploads/2016/09/robonaut2_508.pdf), [R2 legs](https://www.nasa.gov/press/2013/december/nasa-developing-legs-for-space-stations-robonaut-2), [nasa.gov/robonaut2](https://www.nasa.gov/robonaut2/) | 2.34 × 0.68 × 2.61 (oyoq ostida ortiqcha "R2.Hips" bo'lagi bilan) | ortiqcha bo'lak o'chirilgach to'liq bo'y **2.40 m** → beldan boshgacha 1.02 m (NASA ✓) | Barcha 13 material bir xil kulrang metall; oyoq ostida ortiqcha bo'lak | Ha: ranglar (oq qoplama/mato, oltin bosh, qora visor, ko'k chiroqlar), ortiqcha bo'lak o'chirildi. 2026-yilda R2 stansiyada yo'q (2018-da qaytgan) — shuning uchun faqat sprayt |
| **crew-lock-bag** | Aniq o'lchami NASA sahifasida yo'q — [3D resources sahifasi](https://science.nasa.gov/3d-resources/crew-lock-bag/). Taqqoslash uchun yuk sumkasi (CTB): **50.2 × 42.5 × 23.5 cm** (19¾ × 16¾ × 9¼ in), 27 kg gacha — [STS-92 press kit](https://www.nasa.gov/wp-content/uploads/2023/05/sts-092-press-kit.pdf) | 14.05 × 5.41 × **15.46** | **×0.02975** → 0.42 × 0.16 × **0.46 m** (taxmin, CTB yuzasiga yaqin) | Pastida 2 ta mayda shtrix-kod yorlig'i (mayda yozuv bilan) | Yorliqlar bo'yab tashlandi. O'lcham — taxmin (NASA'da raqam topilmadi) |
| **oru** — almashtiriladigan blok | ORU = orbitada almashtiriladigan zaxira blok ([NASA ESP](https://www.nasa.gov/international-space-station/external-stowage-platforms-1-3/)). Li-ion batareya ORU: **104 × 94 × 53 cm**, **197 kg** (435 lb), 30 element — [NTRS 20160012048](https://ntrs.nasa.gov/api/citations/20160012048/downloads/20160012048.pdf) | 173.5 × 151.0 × 141.4 | **×0.00599** → 1.04 × 0.90 × 0.85 m | Model batareya emas, oq lotokdagi oltin MLI bilan o'ralgan quti; chuqurligi 0.85 m (batareya 0.53 m) | Oltin plyonka rangi yorqinlashtirildi. Shakl o'zgartirilmadi |
| **helmet** — dubulg'a | Polikarbonat (plastik) shar + oltin qoplamali quyosh visori (EVVA) — [spacesuit basics](https://www.nasa.gov/centers-and-facilities/johnson/spacewalk-spacesuit-basics/). Diametri/massasi NASA manbalarida topilmadi | 14.07 × 14.07 × 13.73 | **×0.02842** → **0.40 m** (taxmin) | Hamma qismlari oq metall; kichik yashil "Tree" qismi | Ha: oq qobiq + oltin visor; "Tree" kulrangga |

## 2. Yer, atmosfera va "haqiqiy masshtab" — nima qilindi

- XKS koordinata boshida, **Yer markazi 6 371 km + 400 km pastda** — ya'ni Yer ham haqiqiy o'lchamda (kamera hiylasisiz).
  Shar 512 × 256 segmentli: bu o'lchamda bitta qirraning bo'rtishi ~120 m, 2 300 km uzoqdagi gorizontda bu 1 pikseldan ancha kichik,
  shuning uchun gorizont mutlaq dumaloq ko'rinadi. Kamera `clip_end` = 20 000 km.
- Tekstura sharning normalidan (ekvirektangulyar) hisoblanadi; Yer obyekti aylantirilib, kerakli nuqta XKS ostiga keltirilgan:
  1-sahna — Arab dengizi (19° sh.k., 61° sh.u.), shimolga qaralganda gorizontda Eron va O'rta Osiyo; 2-sahna — Hind okeani.
- **Bulutlar** protsedural (2 qavatli 3D shovqin) — Blue Marble'da bulut yo'q, haqiqiy fotolarda esa ko'p.
- **Atmosfera**: Yerdan 80 km yuqoridagi ikkinchi shar. Shader har bir kamera nurining Yer markazigacha eng yaqin masofasini
  (tangens balandlik h) hisoblaydi: osmonda yorqinlik ~ exp(−h / 8.5 km) (NASA: atmosfera shkala balandligi 8.5 km),
  Yer ustida esa qiya qarashda kuchayadigan ko'kish tuman. Faqat kamera nurlari uchun — shovqin yo'q.
- Eslatma: Blender 5.3 da `exp()` katta argumentda cheksizlikka chiqib NaN berardi (Yer ustida qora doira) — h manfiy bo'lganda 0 ga cheklab tuzatildi.

## 3. Haqiqiy foto bilan solishtirish

| NASA foto | Bizning render | Ko'rinadigan farq | Tuzatildi |
|---|---|---|---|
| `docs/ref/xks/iss_overview.jpg` — iss072e316172, 2024-10-23, Crew Dragon'dan tepadan | `renders/xks/xks_ref_compare_960x640.png` (o'sha burchak: zenitdan pastga) | Haqiqiy stansiyada panellar burilgan (qiya, qorong'i ko'rinadi), Rus segmenti uzunroq (Nauka, Prichal, Soyuz/Progress), truss jihozlar bilan zich, radiatorlar oq-qora chiziqli; fotoda 6 ta iROSA (2024), bizda 8 ta (2026-noyabr holati) | iROSA, radiatorlar, ranglar — ha; Nauka/Prichal, panellar burilishi — yo'q |
| `docs/ref/xks/eva_truss.jpg` — iss061e005514, 2019-10-11, P6 trussda batareya almashtirish | `renders/xks/xks_bg_spacewalk_1920x1080.png` | Fotoda panel varaqlari yorqin to'q-sariq, kumush chiziqli; truss oq, tutqichlar oltin; Yer — ko'k + oq bulut, gorizontda ingichka ko'k chiziq | Panel rangi fotoga qarab to'g'rilandi; truss yaqin plan uchun alohida (panjara, oq qutilar, oltin tutqichlar) qurildi |
| `docs/ref/xks/robonaut2.jpg` — iss034e013990, 2013, Destiny modulida R2 | `renders/xks/sprites/xks_robonaut.png` | Fotoda R2 oyoqsiz (2013), oltin bosh, oq yumshoq qoplamalar | Ranglar fotoga moslandi |

## 4. O'yin uchun qisqa faktlar (bolalarga)

- XKS Yer atrofini **90 daqiqada** bir marta aylanadi — bir kunda **16 marta** quyosh chiqishi va botishini ko'radi.
- XKS ~400 km balandlikda — bu Toshkentdan Buxorogacha (~440 km, to'g'ri chiziqda) bo'lgan masofadan biroz kamroq, faqat yuqoriga!
- Stansiya suvning **~98%** ini qayta tozalab ishlatadi (2023-yil iyun) — [NASA](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/).
  Har bir ekipaj a'zosiga kuniga ~**3.8 litr** (1 gallon) suv kerak.
- Skafandr ichida kislorod ~7 soatga yetadi (+30 daqiqa zaxira).

## 5. Cheklovlar

- Modul zanjiri qisqa (45 m va 67 m), legacy qanotlar tor, panellar bir holatda qotgan, Nauka/Prichal yo'q — NASA modelining o'zidan.
- Crew Lock Bag va dubulg'a o'lchamlari NASA manbalarida topilmadi — taxminiy.
- Yer teksturasi 7.4 km/piksel: yaqin pastki qismlar biroz xira (bulutlar yashiradi). Tekstura NASA Blue Marble NG (2004-oktyabr).

## 6. xks.blend ichida

- Sahnalar: `XKS_library` (barcha modellar haqiqiy o'lchamda, X o'qi bo'ylab terilgan), `XKS_1_orbit`, `XKS_2_spacewalk`,
  `XKS_3_ref_iss072e316172` (NASA foto burchagi), `XKS_spr_*` (6 ta sprayt), `XKS_spr_chk_*` (brend tekshiruvi).
  Boshqa sahnalar modellarni collection instance orqali ishlatadi — `XKS_library` dagi o'zgarish hammasiga o'tadi.
- Render: Cycles, GPU (Metal), fonlar 256 sample / 1920×1080, spraytlar 128 sample, shaffof fon, denoise yoqilgan.
  Preferences → System → Cycles Render Devices → **Metal** tanlanishi kerak.
- Yer 6 371 km radiusli haqiqiy shar: viewportda ko'rish uchun kamera ko'rinishiga o'ting (kamera `clip_end` = 20 000 km)
  yoki View → Clip End ni oshiring.
- Teksturalar .blend ichiga joylangan (packed); logotip/bayroq bo'yalgan nusxalar: `astnt1_1_nologo`, `crwlckbg_nolabels`.
