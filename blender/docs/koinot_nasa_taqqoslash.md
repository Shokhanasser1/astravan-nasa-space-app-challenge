# Koinot sahnalari: NASA modellari va haqiqiy NASA ma'lumotlari taqqoslash

"Oy karvonsaroyi" o'yini uchun KOINOT (ST = "koinot") qismi: Quyosh, yo'nalish (marshrut) va 4 ta kosmik apparat
(SDO, GOES, LRO, Gateway). Bu hujjat har bir 3D modelni haqiqiy NASA ma'lumotlari bilan solishtiradi:
o'lcham, rang, asosiy qismlar va biz nimani tuzatdik.

## Mualliflik (credit) satrlari — o'yinda va taqdimotda shu holicha yozing

- 3D models: NASA 3D Resources. Not endorsed by NASA.
- Moon: NASA SVS CGI Moon Kit (LRO). Earth: NASA Blue Marble Next Generation. Mars: NASA/JPL-Caltech/USGS Viking.
- Quyosh rasmi biz yasagan protsedur (sun'iy) Quyosh, haqiqiy SDO suratidan nusxa EMAS. Agar keyin o'yinga
  haqiqiy SDO surati qo'yilsa, bu satrni qo'shing: "Courtesy of NASA/SDO and the AIA, EVE, and HMI science teams."
- Ma'lumotnoma (reference) suratlar: NASA/JPL-Caltech (PIA raqamlilari), NASA/KSC (KSC raqamlilari), NOAA/NASA (GOES).
  Ular faqat solishtirish uchun, o'yinga qo'yilmaydi.

## Asosiy jadval

Masshtab = haqiqiy o'lcham / modelning o'zi (import qilingandagi bbox, `source/inventory.json`).
Kosmik apparatlar sahnada 1 birlik = 1 metr, haqiqiy o'lchamida turadi.

| Model | Haqiqiy o'lcham (NASA manbasi) | Model o'lchami (xom bbox) | Masshtab → natija | Farqlar | Tuzatildimi? |
|---|---|---|---|---|---|
| **SDO** (Solar Dynamics Observatory) | Quyoshga qaragan o'q bo'yicha 4,5 m, yon tomonlari 2,22 m, quyosh panellari yoyilganda 6,25 m; 3 000 kg; 1 500 W ([sdo.gsfc.nasa.gov/mission/spacecraft.php](https://sdo.gsfc.nasa.gov/mission/spacecraft.php)) | 37,02 × 37,03 × 30,75 (birliksiz), 273 ming uchburchak | **0,1688** (panel kengligi 37,03 → 6,25 m) → 6,25 × 6,25 × 5,19 m; korpus eni 2,11 m | 1) Modelning normallari teskari edi (97 %) → render qop-qora chiqardi. 2) Rang yo'q, hammasi bir xil kulrang. 3) Balandlik 5,19 m (haqiqiy 4,5 m): pastki antenna shtangalari ham hisobga kirgan; korpus eni −5 %. | ✅ Normallar tozalandi va qayta hisoblandi. ✅ Korpus: qora-ko'k g'ijim MLI (NASA rasmidagidek), oltin naychalar, to'q ko'k panellar. ➖ O'lchamdagi kichik farq qoldi (≤ 15 %). |
| **GOES** (GOES-R seriyasi ob-havo yo'ldoshi) | Korpus 6,1 × 5,6 × 3,9 m; 5 192 kg; bitta qanot, 5 ta panel (har biri ≈ 4,0 × 1,37 m, ya'ni ≈ 6,9 × 4 m), 4 000 W dan ortiq; magnitometr shtangasi 8,5 m ([nesdis.noaa.gov GOES-R spacecraft](https://www.nesdis.noaa.gov/our-satellites/currently-flying/goes-east-west/goes-r-series-spacecraft-instruments), [nasa.gov solar array](https://www.nasa.gov/technology/noaas-goes-r-satellite-solar-array-spreads-its-wing/), [NTRS 8,5 m boom](https://ntrs.nasa.gov/api/citations/20230007151/downloads/GOES-R_OnBoardDeploymentVer_103Chapel.pdf)) | 0,134 × 0,111 × 0,122 (juda kichik, ~santimetr) | **105,6** (korpus qutisi → 6,1 m) → korpus **6,1 × 5,2 × 3,9 m** ✅ mos; umumiy 14,2 × 11,8 × 12,9 m | 1) Model 100 marta kichik edi. 2) Quyosh qanoti modelda 6,2 × 3,6 m (haqiqiy ≈ 6,9 × 4 m, ~10 % kichik) va Yerga qarab yassi yotgan edi. 3) Magnitometr shtangasi 10,7 m va yaxlit tayoq (haqiqiysi 8,5 m, ingichka panjara/"truss"). 4) Ranglar oddiy CAD ranglari. | ✅ Masshtab. ✅ Qanot alohida bo'lakka ajratildi va o'z o'qi (yoke) atrofida 75° burildi — korpus Yerga qaraydi, qanot yonga ochilgan (bronza katakchalar tomoshabinga ko'rinadi). ✅ Yaxlit tayoq o'chirildi, o'rniga haqiqiy uzunlikdagi (8,5 m) ingichka uchburchak panjara + 2 ta oq magnitometr silindri yasaldi. ✅ Qora MLI + bronza rangli panel. ➖ Qanot ~10 % kichikligicha qoldi. |
| **LRO** (Lunar Reconnaissance Orbiter) | 1 850 kg ([science.nasa.gov/mission/lro/about](https://science.nasa.gov/mission/lro/about/)); quyosh qanoti 10,7 m², 3 panel, 1 850 W ([NSSDCA 2009-031A](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2009-031A)); orbita: 2009-yildan ~50 km, 2015-yildan ~20 × 165 km. Umumiy o'lcham NASA sahifalarida topilmadi (Vikipediyada 3,9 × 2,7 × 2,6 m — tasdiqlanmagan) | 5,45 × 5,51 × 3,66 (allaqachon metrda) | **1,0** (qanot maydoni modelda ≈ 11 m², NASA 10,7 m²) → 5,45 × 5,51 × 3,66 m | 1) Model ichida materialsiz 1 m lik yordamchi kub (`_root`) bor edi. 2) Folga materiallari 256 px "ramp" teksturadan olingani uchun korpus qorong'i kulrang chiqardi (haqiqiysi kumush + oltin + mis rang). 3) Qanot qotib qolgan, yassi. 4) CRaTER alohida qism sifatida yasalmagan (model atigi 8 ming uchburchak). | ✅ Kub yashirildi. ✅ Kumush/oltin folga ranglari (KSC surati bo'yicha). ✅ Qanot alohida bo'lakka ajratilib, sharnirida 50° burildi (haqiqiy LRO'da qanot 2 o'qli gimbalda Quyoshni kuzatadi). ➖ CRaTER belgilanmadi (pastga qarang). |
| **Gateway** (Artemis Oy stansiyasi) | NASA FAQ: ~63 t; ~43 m baland, 19 m eni, 20 m bo'yi; PPE 60 kW; orbita NRHO, Oydan ~1 500 – 70 000 km, 6,5 kun ([nasa.gov/gateway-frequently-asked-questions](https://www.nasa.gov/gateway-frequently-asked-questions/)); HALO ~7 m uzun, 3 m diametr ([Thales Alenia Space](https://www.thalesaleniaspace.com/en/news/lunar-gateways-halo-pressurized-module-preparation-shipment-united-states)); Canadarm3 ~8,5 m ([nasa.gov/gateway-capabilities](https://www.nasa.gov/gateway-capabilities/)) | 17,88 × 30,07 × 38,97 (metrda), HALO 8,0 m (ulanish portlari bilan) | **1,0** → balandlik 39 m (−9 %), eni 17,9 m (−6 %), HALO 8,0 m (portlar bilan) | 1) Bu 2023–2024 yillardagi "Gateway Core" konfiguratsiyasi: PPE, HALO, I-Hab, ESPRIT/ERM (hozir "Lunar View"), havo shlyuzi (airlock), Canadarm3. Orion va yuk kemasi yo'q. 2) Canadarm3 teksturasida **"Canada" yozuvi** bor edi. 3) PPE panellari modelda to'q-binafsha katakli qizg'ish-to'q sariq, NASA rasmida binafsha-ko'k. | ✅ "Canada" yozuvi teksturaning nusxasida oddiy panel rangi bilan bo'yab o'chirildi (`scenes/koinot/tex/gateway_DSXR_BaseColor_clean.png`). ➖ Konfiguratsiya o'zgartirilmadi (pastga qarang). |
| **Yer / Oy / Mars sharlari** | Yer r = 6 371 km, Oy 1 737 km, Mars 3 390 km | Har biri 2 × 2 × 2 shar | Sahnalarda **masshtabsiz** (pastga qarang) | Oy xaritasi faqat 2048 px — yaqin kadrlarda xira. | ✅ Oyga protsedur krater "bump"i qo'shildi; LRO sahnasida fon biroz xiralashtirilgan (DOF). |

## Qisqa izohlar

**SDO — "Quyosh kamerasi".** Tepada 4 ta AIA teleskopi (10 xil yorug'likda suratga oladi), yonida HMI va EVE.
Ikki yuqori kuchli antenna shtangada turadi va har orbitada Yerga qarab buriladi. Quyosh panellari "uy tomi"
(home plate) shaklida — antennalarni to'smasligi uchun. Bolalar uchun fakt: *SDO Quyoshni har 12 soniyada
10 xil rangdagi yorug'likda suratga oladi* ([nasa.gov](https://www.nasa.gov/solar-system/watch-a-10-year-time-lapse-of-sun-from-nasas-sdo/)).
Sahnada SDO Quyoshga qarab turibdi, lekin teleskoplar va panellar ko'rinsin deb ~40° tomoshabinga burilgan
(badiiy poza: Quyosh kadrda bo'lsa, aniq Quyoshga qaragan SDO faqat orqasi bilan ko'rinadi).

**GOES — "Bo'ron signali".** Yerga qaragan tomonda ABI (bulut kamerasi) va GLM (chaqmoq xaritasi), Quyosh
qanotining "yoke"ida Quyoshga qaragan platforma (SPP): SUVI (Quyosh ultrabinafsha kamerasi) va EXIS (rentgen
o'lchagich). Bolalar uchun: *GOES rentgen datchigi chaqnash (flare) haqida birinchi signalni beradi; NOAA M5
kuchida ogohlantirish yuboradi* ([spaceweather.gov](https://www.spaceweather.gov/products/goes-x-ray-flux)).
Modelda korpus o'lchami NASA/NOAA raqamiga juda yaxshi mos keldi (6,1 × 5,2 × 3,9 m va 6,1 × 5,6 × 3,9 m).

**LRO va CRaTER — "Oy o'lchovi".** LRO uch qismdan iborat: dvigatel moduli (pastda, mis rang), avionika va
asboblar moduli. Asboblar (LROC, LOLA, Diviner, LAMP, LEND, CRaTER) Oyga qaraydi — modelda bu **+Z** tomon,
sahnada shu tomon Oyga qaratilgan. **CRaTER** (Cosmic Ray Telescope for the Effects of Radiation) — 5,5 kg lik
kichik teleskop + elektronika qutisi: bir uchi Oyga, bir uchi ochiq koinotga qaraydi, ichida inson to'qimasiga
o'xshash plastik bor — "odam tanasi qancha radiatsiya olardi?" degan savolga javob beradi
([Spence va b. 2010](https://www.issibern.ch/teams/interactplanetbody/wp-content/uploads/sites/52/2016/03/CRaTER_SSR2010.pdf)).
U asboblar modulida, Oyga qaragan asboblar orasida joylashgan. Bu soddalashtirilgan modelda (8 ming uchburchak)
CRaTER alohida qism sifatida yo'q, shuning uchun renderda belgi qo'ymadik (xato joyni ko'rsatmaslik uchun).
Bolalar uchun: *50 km balandlikda CRaTER kuniga taxminan 0,22–0,27 mGy o'lchagan* — bu NASA sahifasi emas,
CRaTER ma'lumotiga tayangan ilmiy maqola ([arXiv 2001.11028](https://arxiv.org/pdf/2001.11028)).

**Gateway.** Modeldagi qismlar nomi: `Maxar_PPE`, `NG_HALO`, `I-Hab`, `ERMXL` (ESPRIT Refueling Module, 2024
dan "Lunar View"), `Airlock` (2024-yil yanvardan BAA "Crew and Science Airlock"), `Big Arm` (DSXR = Deep Space
Exploration Robotics, ya'ni **Canadarm3**), `NDS port` (ulanish portlari). Bu NASA'ning 2023–2024 yillardagi
konfiguratsiyasi. **Holati:** NASA 2026-yil 24-martdagi bayonotida Gateway'ni "hozirgi ko'rinishida pauza
qilish" niyatini e'lon qildi ([nasa.gov news release](https://www.nasa.gov/news-release/nasa-unveils-initiatives-to-achieve-americas-national-space-policy/)).
O'yinda "rejalashtirilgan Artemis stansiyasi" deb yozish to'g'ri, "hozir Oy atrofida uchmoqda" deb yozmang.

## Sahnalar masshtabsiz (NOT to scale) — nima uchun

Kosmik apparatlar haqiqiy o'lchamida (metr). Sayyoralar va Quyosh esa **sahna fonlari**: o'lchami va masofasi
rasm chiroyli va tushunarli bo'lishi uchun tanlangan. Haqiqatda:
- Yo'nalish ekranida Yer, Oy, Mars bir-biriga juda yaqin va deyarli bir xil kattalikda; aslida Oy Yerdan 384 400 km,
  Mars eng yaqin kelganda ham ~55 mln km uzoqda, Mars Yerdan 2 marta kichik.
- Quyosh SDO va GOES orqasida juda katta ko'rinadi (aslida u 150 mln km uzoqda, osmonda ~0,5°).
- LRO sahnasida Oy LRO'dan ~300 m pastda turgan 190 m lik shar (aslida 1 737 km lik Oy, LRO 20–165 km balandlikda).
- Gateway sahnasida Oy va Yer kattaligi ham badiiy.
Yer sharida O'rta Osiyo (Toshkent) ko'rinadigan tomoni kameraga burilgan.

## Brend qoidalari tekshiruvi

- SDO, GOES — teksturasiz modellar, logotip yo'q. LRO teksturalari (3 ta, 1024 px) va Gateway'ning 37 ta teksturasi
  qizil/ko'k rangli joylar bo'yicha avtomatik qidirildi va ko'z bilan ko'rildi: faqat Canadarm3 dagi **"Canada"**
  yozuvi topildi va o'chirildi. NASA "meatball/worm", NOAA logotipi, bayroqlar, missiya nishonlari renderlarda yo'q.
- Har bir render ko'z bilan tekshirildi.

## Ma'lumotnoma suratlar (`docs/ref/koinot/`)

| Fayl | Manba / ID | Nima ko'rinadi |
|---|---|---|
| sdo_ref_1.jpg | NASA PIA18169 "Solar Dynamics Observatory Artist Concept" | SDO Yer ustida, panel va antennalar ochiq |
| sdo_ref_2.jpg | NASA KSC-2009-6422 | Haqiqiy SDO toza xonada (kumush folga, antenna sinovi) |
| goes_ref_1.jpg | NOAA NESDIS "GOES-R spacecraft with instruments labeled" | SUVI, EXIS, SEISS, GLM, ABI, magnitometr belgilangan |
| goes_ref_2.jpg | NOAA NESDIS "GOES-R spacecraft in orbit" | Qanot ochiq, Yer fonda |
| goes_ref_3.jpg | NASA KSC-20160926-PH_DNG01_0005 | Haqiqiy GOES-R, qora MLI, yig'ilgan qanot |
| lro_ref_1.jpg | NASA PIA18163 "Lunar Reconnaissance Orbiter Artist Concept" | LRO Oy ustida, 3 panelli qanot va antenna shtangasi |
| lro_ref_2.jpg | NASA KSC-2009-2814 | Haqiqiy LRO: kumush korpus, mis rangli asos |
| gateway_ref_1.jpg | NASA "Gateway – Full Configuration Hero Image" (2023-12) | To'liq Gateway |
| gateway_ref_2.jpg | NASA "Gateway Space Station Configuration" infografika (2023) | Modullar nomi bilan |

Solishtirish renderlari (model NASA suratiga o'xshash burchakdan, kulrang studiyada):
`renders/koinot/compare/model_*.png` va yonma-yon varaqlar `renders/koinot/compare/taqqos_*.png`
(chapda NASA surati, o'ngda bizning model).

Yonma-yon qarab ko'rilgan farqlar:
- **SDO:** korpus qora-ko'k g'ijim folga — NASA rasmiga mos. Asboblar moduli bizda kumush quti (KSC suratidagidek);
  NASA badiiy rasmida AIA naychalari oltin rangda, modelda esa ular qora. Panellar korpus ustida, asboblar ostida — mos.
- **GOES:** NOAA rasmida qanot 5 ta alohida bronza panel va korpusdan "yoke" bilan uzoqlashgan; modelda qanot
  bitta tekis plita, korpusga yaqin. Magnitometr shtangasi endi rasmdagidek ingichka panjara.
- **LRO:** korpus kumush (KSC surati bilan mos), qanot to'q ko'k katakchali. NASA badiiy rasmida asboblar moduli
  oltin folgada — modelda oltin faqat pastdagi halqada.
- **Gateway:** NASA "hero" rasmida Orion kemasi ham ulangan; modelda Orion yo'q (u alohida model). PPE panellari
  NASA rasmida binafsha, bizda to'q qizg'ish-qora (model teksturasi shunday).

## Fayllar

- `scenes/koinot/build_koinot.py` — hammasini noldan quradi va `koinot.blend` ni saqlaydi.
  `Blender -b --factory-startup -P scenes/koinot/build_koinot.py -- --render bg,sprites,cmp --samples 48 --res 1920x1080`
  (`--render none` = faqat .blend; `--test` = tez past sifatli sinov).
- `scenes/koinot/koinot.blend` — sahnalar: `1_marshrut`, `1b_marshrut_yolli` (nuqtali yo'l bilan),
  `2_quyosh_kamerasi`, `3_boron_signali`, `4_oy_olchovi`, `5_gateway`, `6_sprites`, `7_taqqoslash`, `_ASSETS`
  (modellar kolleksiyalari; sahnalarda "collection instance" sifatida ishlatiladi).
- `renders/koinot/*.png` (1920 × 1080) + `*.jpg` (veb nusxa, sifat 82); `renders/koinot/sprites/koinot_*.png`
  (512 × 512, shaffof fon).
- Yulduzlar foni rasm sifatida compositor'da qo'shiladi (`scenes/koinot/tex/starfield_1920x1080.png`), shuning
  uchun denoiser yulduzlarni o'chirib yubormaydi.

## Blender ilovasida nimani tekshirish kerak

- `koinot.blend` Cycles + **GPU (Metal)** bilan saqlangan, fonlar 1920 × 1080 da 256 namuna, sprite'lar 128.
  Blender → Preferences → System → Cycles Render Devices → **Metal** yoqilganini tekshiring.
- Bu yerda (sandbox) Metal yo'q edi, shuning uchun hozirgi renderlar CPU'da 48 namunada qilingan; yakuniy
  sifat uchun har bir sahnada F12 bosing (yoki skriptni `--samples 128` bilan qayta ishga tushiring).
- Sprite sahnasi (`6_sprites`) bir vaqtda bitta obyektni ko'rsatadi: boshqasini render qilish uchun skriptdagi
  `--render spr_goes` kabi kalitdan foydalaning (kamera avtomatik moslanadi).
- `2_quyosh_kamerasi` da SDO badiiy burchakda; `3_boron_signali` da GOES qanoti tomoshabinga burilgan — o'yin
  dizayni uchun kerak bo'lsa, `GOES_ARRAY_TURN`, `GOES_YAW`, `LRO_ARRAY_TILT` qiymatlarini skriptda o'zgartiring.
