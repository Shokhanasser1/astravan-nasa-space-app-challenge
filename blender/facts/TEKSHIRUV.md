# TEKSHIRUV — stansiya hujjatlaridagi "haqiqiy o'lcham"larni mustaqil tekshirish

Tekshiruvchi: claude1 (fakt-tekshiruvchi). Asos: `facts/nasa_facts.json` / `facts/NASA_FAKTLAR.md` dagi tasdiqlangan raqamlar.
Stansiya fayllari **o'zgartirilmadi** — bu yerda faqat izohlar.

Belgilar: ✅ mos keladi · ⚠️ kichik farq (yaxlitlash, manba noto'g'ri ko'rsatilgan) · ❌ jiddiy farq · ❔ men tekshira olmadim (xato degani emas).

Holat: 5 ta stansiyaning hammasi o'qildi — `yer` (14:16), `koinot` (14:32 versiyasi), `oy` (14:29 versiyasi), `mars` (14:17), `xks` (14:40). Tekshiruv tugadi: 2026-11-14 ~14:50.

---

## 1. Asosiy xulosa

- **Bitta ❌ xato** bor: `xks` dagi bolalar fakti "XKS ~400 km — Toshkentdan Samarqandgacha bo'lgan masofadan ham kamroq". Aslida Toshkent–Samarqand to'g'ri chiziqda **~266 km**, ya'ni 400 km undan ~1.5 marta **ko'p** (6-bo'limga qarang).
- Hamma stansiyalar Mount Hadley uchun to'g'ri raqamni (~4.5 km) ishlatgan, studiyadagi "~1.5 km" hech qayerda qolmagan.
- Bir nechta **⚠️ kichik farq** bor — asosan yaxlitlash yoki manba noto'g'ri ko'rsatilgani (pastdagi jadval).
- Stansiya hujjatlari **meni ham tuzatdi**: SEV (2 994 kg, 4.48 m), HDU (5 m diametr, 3.3 m), EMU (145 kg), Li-ion batareya ORU (197 kg, 104 × 94 × 53 sm) va Robonaut 2 (150 kg) raqamlarini ular NASA fakt varaqlari/NTRS dan topgan. Men PDF larni o'zim ochib tekshirdim — **ular to'g'ri**, mening kartalarim yangilandi (3-bo'lim).
- Ikki stansiya o'rtasida bitta ichki nomuvofiqlik: Orion diametri (`yer`: 5.02 m, `oy`: 5.03 m).

## 2. Kelishmovchiliklar jadvali

| # | Stansiya | Model | Ularning raqami | Mening raqamim | Manbalar | Qaysi biri to'g'ri / tavsiya |
|---|---|---|---|---|---|---|
| 1 | koinot | lro (CRaTER) | CRaTER **5.5 kg** (Spence va b. 2010) | **5.6 kg** | [NSSDC CRaTER](https://nssdc.gsfc.nasa.gov/nmc/experiment/display.action?id=2009-031A-06) | ⚠️ Rasmiy NASA katalogi 5.6 kg deydi. O'yinda "~5.6 kg" yozing. |
| 2 | koinot | lro | massa **1 850 kg** | 1 850 kg (science.nasa.gov) va 1 846 kg (NSSDC) | [LRO about](https://science.nasa.gov/mission/lro/about/), [NSSDC](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2009-031A) | ✅ Ikkalasi ham NASA; farq 0.2 %. 1 850 kg yaxshi. |
| 3 | yer / oy | orion | `yer`: diametr **5.02 m**; `oy`: **5.03 m** | **5.03 m** (16.5 ft = 5.029 m) | [nasa.gov crew module](https://www.nasa.gov/reference/crew-module/) | ⚠️ Ikki stansiya bir xil yozsin: **5.03 m**. (NASA: issiqlik qalqoni 16.5 ft.) |
| 4 | yer | dsn-34m | "34 m (**111 ft**)" | 34 m = **112 ft** (NASA yozuvi) | [NASA Canberra maqolasi](https://www.nasa.gov/technology/space-comms/deep-space-network/nasas-deep-space-network-starts-new-dish-marks-60-years-in-australia/) | ⚠️ Yaxlitlash: 34 m = 111.5 ft. NASA "112-foot-wide" deydi — futda 112 yozing. |
| 5 | yer | mobile-launcher | umumiy balandlik "**~380–400 ft**", minora "~345–355 ft" | **380 ft** umumiy, minora "about **355 ft**", 662 zinapoya, 11.5 mln funt | [NASA ML-1](https://www.nasa.gov/humans-in-space/exploration-ground-systems/mobile-launcher/) | ⚠️ NASA sahifasi aniq **380 ft** deydi. "400 ft" ni olib tashlash yoki manbasini ko'rsatish kerak. |
| 6 | oy | emu | odam bo'yi "**1.52**–1.88 m" | **1.57**–1.88 m (5 ft 2 in … 6 ft 2 in) | [NASA EMU fakt varag'i 2019](https://www.nasa.gov/wp-content/uploads/2015/07/2019_07_ea_emu.pdf) | ⚠️ Pastki chegara 1.57 m (5-persentil ayol, 5'2"). 145 kg — ✅ to'g'ri. |
| 7 | oy | mark-3 | "~**55 kg**", manba: NASA 3D sahifasi | NASA 3D sahifasida massa **yo'q** (faqat 8.3 psi). 55/59 kg — Encyclopedia Astronautica | [NASA 3D Mark III](https://science.nasa.gov/3d-resources/mark-iii-spacesuit/), [Astronautix nusxasi](https://www.fplib.org/partners/mwade/craft/nasrkiii.htm) | ⚠️ Raqam taxminan to'g'ri, lekin **manba noto'g'ri**. "taxminiy, ikkilamchi manba" deb belgilang. |
| 8 | oy | hammer | Apollo 15 bolg'asi **39.1 × 15.2 × 3.2 sm**, "**1.1**–1.32 kg", manba: NSSDC | NSSDC faqat **1.32 kg** va ~1.6 m balandlikni beradi | [NSSDC hammer-feather](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_15_feather_drop.html) | ⚠️ O'lchamlar va "1.1 kg" NSSDC sahifasida **yo'q** — boshqa manba kerak yoki "tekshirilmagan" deb yozing. 1.32 kg ✅. |
| 9 | oy | apollo-11-site | haqiqiy relyef "**~36 m**" (18.7 birlik × 117.4 / 60) | 30 × 30 km ✅, 60× ✅; relyef hisob — ❔ | [NASA 3D Apollo 11](https://science.nasa.gov/3d-resources/apollo-11-landing-site/) | ⚠️ bbox balandligi (18.7) STL **tagligining qalinligini** ham o'z ichiga olishi mumkin (bbox min Z = 1.12). Shuning uchun 36 m — **yuqori chegara**, haqiqiy relyef undan kichik bo'lishi mumkin. |
| 10 | oy | moon-near-side | relyef "**~8 km**" | NASA bo'rttirishni **aytmagan** → real relyefni modeldan chiqarib bo'lmaydi | [NASA 3D Moon](https://science.nasa.gov/3d-resources/moon/) | ⚠️ "~8 km" — model asosida taxmin; NASA raqami emas. 400 km va 1:5 000 000 ✅. |
| 11 | oy | solar-wing | "NASA 3D sahifasi topilmadi, kelib chiqishi tasdiqlanmadi" | Topildi: **NASA Ames "Satellite Kit — wings 1"** (fayl 4 860 bayt = 4.75 KB, mos) | [NASA 3D Satellite Kit](https://science.nasa.gov/3d-resources/satellite-kit/) | ℹ️ Bu umumiy o'quv-kit qismi, aniq kema emas. 4.5 × 4.95 m — badiiy o'lcham (to'g'ri qaror). |
| 12 | oy | crew-lock-bag | model birligi "**dyuym** deb olindi" → 0.36 × 0.14 × 0.39 m | CLB o'lchami NASA ochiq manbalarida **yo'q** (null) | [NASA 3D CLB](https://science.nasa.gov/3d-resources/crew-lock-bag/) | ⚠️ Taxmin oqilona, lekin o'yinda "real o'lcham" deb ko'rsatmang. Muhim: NASA "suv devori" tadqiqotlari **CTB** (yuk sumkasi; single CTB 42.5 × 50.2 × 23.5 sm — [STS-92 press kit](https://www.nasa.gov/wp-content/uploads/2023/05/sts-092-press-kit.pdf)) bilan qilingan, CLB bilan emas ([NTRS 20160006051](https://ntrs.nasa.gov/api/citations/20160006051/downloads/20160006051.pdf)). |
| 13 | yer | helmet | Z-2.5 pufagi 13 × 10 in; masshtab "~0.028" | Model — umumiy NASA Ames "Helmet", Z-2.5 emas; real o'lcham null | [NASA 3D Helmet](https://science.nasa.gov/3d-resources/helmet/) | ℹ️ Ular buni o'zlari "taxminiy" deb yozgan — to'g'ri. Faqat sprite bo'lgani uchun muammo yo'q. |
| 14 | koinot | sdo (fakt) | "har **12** soniyada 10 rangda" | **12 s** ✅ (nasa.gov). Eslatma: sdo.gsfc.nasa.gov/instruments sahifasida "10 seconds" | [nasa.gov SDO time-lapse](https://www.nasa.gov/solar-system/watch-a-10-year-time-lapse-of-sun-from-nasas-sdo/), [SDO instruments](https://sdo.gsfc.nasa.gov/mission/instruments.php) | ✅ 12 s to'g'ri (AIA). Ikki NASA sahifasi farq qiladi, 12 s ni ishlating. Mening kartam ham 12 s ga tuzatildi. |
| 15 | koinot | gateway (matn) | "O'yinda 'rejalashtirilgan Artemis stansiyasi' deb yozish to'g'ri" | Holat: 2026-03-24 da **to'xtatilgan**; PPE → SR-1 Freedom, HALO → Oy yuzasi namoyishlari | [NASA 2026-03-24](https://www.nasa.gov/news-release/nasa-unveils-initiatives-to-achieve-americas-national-space-policy/), [SR-1 Freedom](https://www.nasa.gov/mission/space-reactor-1-freedom/), [HALO repurpose](https://www.nasa.gov/missions/moon-base/nasa-provides-updates-on-moon-base-cargo-landers-tech-demonstrations/) | ⚠️ Aniqroq matn: "rejalashtirilgan edi, 2026-yilda NASA uni to'xtatdi; qismlari boshqa missiyalarga berilmoqda". Raqamlar (63 t, 43×19×20 m, 6.5 kun, 1 500–70 000 km) ✅ — [Gateway FAQ](https://www.nasa.gov/gateway-frequently-asked-questions/) da men ham ko'rdim (bu **reja** raqamlari). |

## 3. Mening kartalarim tuzatildi (stansiyalar to'g'ri chiqdi)

| Model | Mening eski raqamim | To'g'ri (stansiya topgan, men PDF ni ochib tasdiqladim) | Manba |
|---|---|---|---|
| sev | massa ~4 000 kg (Wikipedia, taxminiy); uzunlik null | **2 994 kg** (6 600 funt), **4.48 m** (14.7 ft), balandlik **3.05 m**, g'ildirak Ø **0.99 m**, ekipaj 2 (favqulodda 4) | [SEV fact sheet FS-2011-08-045-JSC](https://www.nasa.gov/wp-content/uploads/2015/08/464826main_sev_factsheet_508.pdf) |
| hdu-1/2 | diametr/balandlik null | ichki diametr **5.0 m**, balandlik **3.3 m** (2.0 m + 2 × 0.64 m), tagkursi **4.2 m**, hajm 148.1 m³ (2 qavat) | [HDU-DSH fact sheet](https://www.nasa.gov/pdf/468441main_HDU_FactSheet_508.pdf) |
| emu | ~113 kg (taxminiy) | **145 kg** (XKS EMU, ryukzak + SAFER), shattl EMU 124.7 kg, ichimlik xaltasi 21 untsiya | [EMU fact sheet 2019](https://www.nasa.gov/wp-content/uploads/2015/07/2019_07_ea_emu.pdf) |
| sdo (fakt) | har 10 s | har **12 s** | [nasa.gov](https://www.nasa.gov/solar-system/watch-a-10-year-time-lapse-of-sun-from-nasas-sdo/) |
| oru | Li-ion batareya 104 × 94 × **48** sm, **169 kg** (Spaceflight101, taxminiy) | **~41 × 37 × 21 in ≈ 104 × 94 × 53 sm**, **435 funt ≈ 197 kg**, 30 ta element (`xks` topgan) | [NTRS 20160012048](https://ntrs.nasa.gov/api/citations/20160012048/downloads/20160012048.pdf) |
| robonaut-2 | 300 funt (2010 press-reliz), bo'yi null | **330 funt ≈ 150 kg**, beldan boshgacha **1.02 m**, yelka 0.79 m (`xks` topgan; 2010 relizdagi 300 funt eski raqam) | [R2 fact sheet](https://www.nasa.gov/wp-content/uploads/2016/09/robonaut2_508.pdf) |
| crew-lock-bag (CTB) | ~50 × 42 × 25 sm (taxminiy) | single CTB **16¾ × 19¾ × 9¼ in ≈ 42.5 × 50.2 × 23.5 sm**, 60 funt (27 kg) gacha | [STS-92 press kit](https://www.nasa.gov/wp-content/uploads/2023/05/sts-092-press-kit.pdf) |
| iss | balandlik/tezlik/suv ehtiyoji yo'q edi | **~250 mil ≈ 400 km**, 17 500 mil/soat; kosmonavtga kuniga **~1 gallon (3.8 l)** suv | [NASA (5–8 sinf)](https://www.nasa.gov/learning-resources/for-kids-and-students/what-is-the-international-space-station-grades-5-8/), [NASA water](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/) |

**O'yin uchun muhim topilma (SEV fakt varag'i):** SEV kabinasi quyosh zarralari bo'roni paytida **boshpana** bo'la oladi va ekipajni **72 soatgacha** himoya qiladi; shlyuz atrofida **2.5 sm muzlagan suv** qatlami radiatsiyadan himoya qiladi. Bu o'yindagi "suv devori" va "haydaladigan boshpana" g'oyalarini NASA'ning haqiqiy konsepsiyasi bilan to'g'ridan-to'g'ri bog'laydi.

## 4. Mos kelgan asosiy raqamlar (✅)

| Stansiya | Model | Raqam | Manba |
|---|---|---|---|
| yer | sls | 322 ft ≈ 98.1 m (Dekabr 2025 fakt varag'i: 322.4 ft = 98.3 m) | [SLS fact sheet](https://www.nasa.gov/sites/default/files/files/SLS-Fact-Sheet_aug2014-finalv3.pdf), [Block 1B fact sheet](https://www.nasa.gov/wp-content/uploads/2026/02/sls-5644-sls-block-1b-fact-sheet-dec2025-508.pdf) |
| yer | mobile-launcher | minora 40 ft kvadrat | [NASA ML-1](https://www.nasa.gov/humans-in-space/exploration-ground-systems/mobile-launcher/) |
| yer | dsn-34m | balandlik ~35 m (DSS-34 va DSS-35) | [DSS-34](https://www.cdscc.nasa.gov/Pages/Antennas/dss34.html) |
| yer | mission-control | xona o'lchami NASA da topilmadi (men ham topmadim) | [Apollo MCC restoration](https://www.nasa.gov/johnson/history/apollo-mcc-restoration/) |
| koinot | sdo | 4.5 m, 2.22 m, 6.25 m, 3 000 kg, 1 500 W | [SDO spacecraft](https://sdo.gsfc.nasa.gov/mission/spacecraft.php) |
| koinot | goes | 6.1 × 5.6 × 3.9 m, 5 192 kg | [GOES-R spacecraft](https://www.goes-r.gov/spacesegment/spacecraft.html) |
| koinot | lro | qanot 10.7 m², ~1 850 W, orbita ~50 km → 20 × 165 km | [NSSDC](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2009-031A), [LRO about](https://science.nasa.gov/mission/lro/about/) |
| koinot | globuslar | Yer r 6 371 km, Oy 1 737 km, Mars 3 390 km; Oy 384 400 km; Mars eng yaqin ~55 mln km | NSSDC fact sheets |
| oy | rassor | RASSOR 2.0: 66 kg | [NTRS 20210011366](https://ntrs.nasa.gov/citations/20210011366) |
| oy | mount-hadley | **~4 500 m** (studiyadagi 1.5 km xatosi tuzatilgan) | [Apollo 15 PSR 5-17](https://www.nasa.gov/history/alsj/a15/a15psrf5-17.html) |
| oy | apollo-11-site | 30 × 30 km, Z 60× | [NASA 3D](https://science.nasa.gov/3d-resources/apollo-11-landing-site/) |
| oy | moon-near-side | ~400 km, 1 : 5 000 000 | [NASA 3D Moon](https://science.nasa.gov/3d-resources/moon/) |
| oy | sample-tube | < 15.2 sm, titan | [JPL](https://www.jpl.nasa.gov/news/a-martian-roundtrip-nasas-perseverance-rover-sample-tubes/) |
| oy | earth-globe | Oydan Yer ~1.9° (12 756 / 384 400 km = 0.0332 rad) | [NSSDC Moon](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) |
| mars | curiosity | 3.0 × 2.7 × 2.2 m, 899 kg, g'ildirak 50.8 sm | [MSL press kit](https://www.jpl.nasa.gov/news/press_kits/MSLLaunch.pdf), [wheels](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/) |
| mars | perseverance | 3 × 2.7 × 2.2 m, 1 025 kg, g'ildirak 52.5 sm | [rover components](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/) |
| mars | viking | ~576 kg (yoqilg'isiz) — NSSDC "qo'ngandan keyin ~600 kg" bilan **zid emas** (qo'nishda ~22 kg yoqilg'i qolgan); oyoqlar 2.21 m uchburchak | [NSSDC Viking 1](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-075C) |
| mars | mars-globe | r = 3 389.5 km | [NSSDC Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |
| mars | (matn) | 2017-09-11 bo'roni: RAD radiatsiyasi oldingi eng yuqoridan 2 baravardan ko'p, 2 kundan ortiq | [JPL](https://www.jpl.nasa.gov/news/large-solar-storm-sparks-global-aurora-and-doubles-radiation-levels-on-the-martian-surface/) |
| mars | (matn) | Yer–Mars signal ~3–22 daqiqa (54.6–401.4 mln km ÷ yorug'lik tezligi) — hisob to'g'ri | [NSSDC Mars](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html) |

## 5. Men tekshira olmagan da'volar (❔ — xato degani emas)

- `yer`: SLS core stage 212 ft × 27.6 ft, boosterlar 177 × 12 ft, LAS 50 ft, Orion steki 67 ft, ML taglik 165 × 135 × 25 ft va 0-deck 47 ft, 39B suv minorasi 400 000 gallon va "30 soniyadan kamroq" vaqtda to'kilishi, chaqmoq minoralari ~600 ft. (Ular NASA PDF/sahifalariga havola bergan; men ochmadim.)
- `koinot`: GOES quyosh paneli 5 × (4.0 × 1.37 m), > 4 000 W, magnitometr shtangasi 8.5 m; HALO ~7 × 3 m (Thales Alenia — NASA emas); Canadarm3 ~8.5 m; CRaTER kuniga 0.22–0.27 mGy (arXiv — NASA emas, ular buni o'zlari aytgan).
- `oy`: HDU massasi ~12 t (fakt varag'ida yo'q); X-Hab loft ~4 m (NASA emas); "haqiqiy HDU da dizel generator"; Orion 186 Avcoat bloki; RASSOR barabani ~353 mm va ~20 ayl/min; Apollo 11 da Quyosh balandligi 10.8° (SP-4029).
- `mars`: Gale krateri 154 km, Sharp tog'i 5–5.5 km (NASA PIA sahifalari); RAD o'rni va 65° ko'rish maydoni; Viking oyog'i 1.3 m va taglik 30.5 sm.

## 6. `xks` stansiyasi (`docs/xks_nasa_taqqoslash.md`, 14:40)

### Kelishmovchiliklar

| # | Model | Ularning raqami | Mening raqamim | Manbalar | Qaysi biri to'g'ri / tavsiya |
|---|---|---|---|---|---|
| X1 | iss (bolalar fakti) | "XKS ~400 km balandlikda — **Toshkentdan Samarqandgacha** bo'lgan masofadan ham kamroq" | Toshkent–Samarqand to'g'ri chiziqda **~266 km** (yo'l bo'yicha ~300 km). 400 km undan **~1.5 marta ko'p**. Toshkent–Buxoro ~**439 km** | XKS balandligi: [NASA](https://www.nasa.gov/learning-resources/for-kids-and-students/what-is-the-international-space-station-grades-5-8/) (~250 mil). Shahar masofalari — mening hisobim (koordinatalar bo'yicha, taxminiy) | ❌ **Xato.** To'g'ri variant: "XKS ~400 km balandlikda — bu Toshkentdan Buxorogacha (to'g'ri chiziqda ~440 km) bo'lgan masofadan biroz kam, faqat tepaga!" |
| X2 | emu / astronaut | "1.**52**–1.88 m bo'yli odamlarga mos" | **1.57**–1.88 m (5 ft 2 in … 6 ft 2 in) | [EMU fact sheet 2019](https://www.nasa.gov/wp-content/uploads/2015/07/2019_07_ea_emu.pdf) | ⚠️ `oy` dagi xato bilan bir xil — pastki chegara 1.57 m. 145 kg ✅. |
| X3 | crew-lock-bag (CTB) | "50 × 43 × **25 cm** (19¾ × 16¾ × **9¼** in), 27 kg gacha" | 9¼ in = **23.5 cm** (25 sm emas) | [STS-92 press kit](https://www.nasa.gov/wp-content/uploads/2023/05/sts-092-press-kit.pdf) | ⚠️ Hujjat ichida nomuvofiqlik: dyuymdagi raqam to'g'ri, sm ga o'girish xato. Boshqa NASA hujjatlarida ~24.8–25 sm (9¾ in) ham uchraydi — bitta manbani tanlab, birligini moslang. 27 kg (60 funt) ✅. |
| X4 | emu | "kislorod **7 soat + 30 daqiqa** zaxira" | ❔ Ko'rsatilgan sahifalarda (spacesuit basics, EMU fact sheet) bu raqamni topa olmadim — "spacewalk typically lasts multiple hours" deyilgan | [spacesuit basics](https://www.nasa.gov/centers-and-facilities/johnson/spacewalk-spacesuit-basics/) | ⚠️ Raqam haqiqatga yaqin bo'lishi mumkin, lekin **aniq NASA manbasi** kerak; topilmasa o'yinda ishlatmang. |
| X5 | robonaut-2 | **150 kg (330 lb)** | 330 funt ✅ (fakt varag'i); NASA 2010 press-relizida "300-pound" | [R2 fact sheet](https://www.nasa.gov/wp-content/uploads/2016/09/robonaut2_508.pdf), [2010 reliz](https://www.nasa.gov/news-release/nasa-to-launch-human-like-robot-to-join-space-station-crew/) | ✅ Ularniki to'g'ri (yangiroq fakt varag'i). Mening kartam tuzatildi. |
| X6 | oru | Li-ion batareya **104 × 94 × 53 cm, 197 kg (435 lb)**, 30 element | ✅ Bir xil (NTRS). Mening eski raqamim (169 kg) xato edi | [NTRS 20160012048](https://ntrs.nasa.gov/api/citations/20160012048/downloads/20160012048.pdf) | ✅ Ularniki to'g'ri. Eslatma: NTRS'da boshqa joyda "Maximum battery ORU weight ~430 lbs" ham bor — 430–435 funt. |

### Mos kelgan (✅)

- iss: 109 m, truss 94 m, bosimli modullar 67 m, panellar 73 m, 419 725 kg, 90 daqiqa, kuniga 16 aylanish — [NASA facts](https://www.nasa.gov/international-space-station/space-station-facts-and-figures/). ~400 km — NASA "~250 mil" bilan mos.
- solar-wing → iROSA: 8-chi va oxirgi iROSA **2026-11-05** da o'rnatilgan; quvvat 160 → ~215 kW — [NASA blog](https://www.nasa.gov/blogs/spacestation/2026/11/05/spacewalkers-install-final-roll-out-solar-array/). (Ularning "solar-wing — XKS niki emas, umumiy sun'iy yo'ldosh paneli" degan gapi ham to'g'ri: bu NASA Ames "Satellite Kit — wings 1".)
- earth-globe: r = 6 371 km; 400 km dan gorizont ~2 293 km va ~19.8° pastda — men qayta hisobladim, to'g'ri (√(6771² − 6371²) = 2 293 km; arccos(6371/6771) = 19.8°). Atmosfera shkala balandligi 8.5 km — [NSSDC Earth](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html).
- Suv: ~98 % qayta tiklash (2023) va kosmonavtga kuniga ~1 gallon (3.8 l) — [NASA](https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/).
- crew-lock-bag va helmet o'lchami NASA manbalarida yo'q — men ham topmadim (null). Ularning "taxmin" deb yozgani to'g'ri.
- robonaut-2: 2011 STS-133, oyoqlar 2014, 2018 da Yerga qaytgan, 2026 da stansiyada yo'q — mening kartam bilan mos.

### Tekshira olmaganlarim (❔)

- Eski quyosh qanoti 35 × 11.6 m (NASA podcast / NTRS 20200002554); radiatorlar HRS 23.3 × 3.4 m va PVR 13.6 × 3.1 m (NASA ATCS PDF); iROSA 18.3 × 6 m va 20+ kW; oldingi iROSA sanalari (2021-06, 2022-12, 2023-06, 2026-10); XKS balandligi oralig'i 370–460 km; R2 oyoqlari ochilganda 9 ft; dubulg'a "polikarbonat" (NASA sahifasida "strong plastic").
