# MARS stansiyasi: 3D modellar va haqiqiy NASA faktlari

**Loyiha:** Oy karvonsaroyi (OUTPOST jamoasi, NASA Space Apps 2026, Toshkent)
**Stansiya:** `mars`. Bu oxirgi bekat va "keyingi missiya" uchun teaser.
**Kredit:** 3D models: NASA 3D Resources / NASA Science (NASA/JPL-Caltech). Not endorsed by NASA.

Barcha sahnalar `scenes/mars/build_mars.py` skriptida quriladi. Skript qayta ishga tushirilsa, hammasini noldan quradi va `scenes/mars/mars.blend` faylini saqlaydi. 1 Blender birligi = 1 metr.

---

## 1. Asosiy jadval: model va haqiqat

| Model | Haqiqiy o'lcham (manba) | Model o'lchami (bbox, import) | Masshtab | Farqlar | Tuzatildimi? |
|---|---|---|---|---|---|
| **Curiosity** (MSL) | Uzunligi 3,0 m (qo'lsiz), eni 2,7 m, balandligi 2,2 m, massasi 899 kg ([learncuriosity](https://mars.nasa.gov/multimedia/interactives/learncuriosity/index-2.html)). Press-kit: eni 2,8 m, machta tepasigacha 2,1 m, qo'l 2,1 m, g'ildirak 0,5 m ([MSLLaunch.pdf](https://solarsystem.nasa.gov/docs/MSLLaunch.pdf)). Mastcam yerdan ~2,0 m balandda ([instruments](https://science.nasa.gov/mission/msl-curiosity/science-instruments/)). G'ildirak 50 / 50,8 sm ([new-wheels](https://science.nasa.gov/photojournal/new-wheels/), [wheels](https://science.nasa.gov/resource/curiositys-and-perseverances-wheels/)) | 2,78 × 3,94 × 2,22 m (eni × uzunligi × balandligi). Uzunlikka ko'tarilgan qo'l ham kiradi. G'ildirak diametri 0,485 m (o'lchandi) | **1,0** (model allaqachon metrda; balandlik +0,7 %, g'ildirak −3…−4,5 %) | Model toza oq. Haqiqiy rover 2019 yilgi selfida qalin qizg'ish-jigarrang chang bilan qoplangan. Haqiqiy g'ildiraklarda 2013 yildan beri teshik va yoriqlar bor, modelda ular yo'q. Modelda qo'l yuqoriga ko'tarilgan pozada. Teksturada "CURIOSITY" yozuvi, MSL / JPL / AQSh bayrog'i / NASA medalyonlari, MAHLI kalibrovka yozuvi va Linkoln penni bor | Ha: chang qatlami qo'shildi (yuqoriga qaragan yuzalarga ko'proq, metall yuzalarda "metallic" kamayadi). Barcha logo, bayroq va yozuvlar `tex_05` nusxasida bo'yab yopildi (`scenes/mars/tex_clean/`). G'ildirak shikastlari qo'shilmadi |
| **Perseverance** (Mars 2020) | 3 × 2,7 × 2,2 m, 1025 kg, g'ildirak 52,5 sm, qo'l 2,1 m ([rover components](https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/)). Mastcam-Z ~2 m balandda ([instruments](https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/)) | 2,70 × 3,11 × 1,85 m (machta yig'ilgan holatda). Machta ko'tarilgach balandligi 2,23 m. G'ildirak 0,526 m | **1,0** | Importdagi standart pozada machta yotqizilgan (uchishdagi holat). Modelda 2 m lik yordamchi sfera ("Icosphere") bor. Logolar: qo'lda "MARS 2020" va "PERSEVERANCE" yozuvlari, NASA "meatball" va JPL logolari, AQSh bayrog'i plastinkasi, NASA va JPL panjaralari, "10,932,295 Explorers" yozuvi. Ingenuity vertolyoti modelda yo'q | Ha: glTF animatsiyasidan kadr 120 olinib, "machta tik" pozasi saqlandi (2,23 m, NASA bo'yicha 2,2 m). Sfera o'chirildi. Hamma logo va yozuvlar bo'yab yopildi (`arm_graphics`, `blade`, `mars_2020_03`, `mars_2020_04`). Harf shaklidagi fiducial belgilar kulrang qilindi. Biroz chang qo'shildi (2021 yilgi selfiga mos, deyarli toza) |
| **Viking lander** (1976) | ~3 m kenglikda, ~2 m balandlikda, yoqilg'isiz ~576 kg. Korpus 1,5 m keng, 46 sm qalin. Oyoqlar 1,3 m, oyoq tagligi 30,5 sm ([NASA Facts PDF](https://mars.nasa.gov/internal_resources/828/)). Oyoqlar 2,21 m tomonli uchburchak hosil qiladi, qo'ngandan keyin ~600 kg ([NSSDC](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-075C)) | 16,74 × 12,55 × 8,97 (birlik noma'lum, metr emas) | **0,2229** (balandlik 2,0 m ga keltirildi). Natija: 3,73 × 2,80 × 2,00 m, korpus ~1,6 m | 3,73 m ga cho'zilgan namuna oluvchi qo'l (sampler boom) ham kiradi. Material faqat tekis rang, tekstura yo'q. Haqiqiy lander korpusida AQSh bayrog'i bor edi, modelda yo'q (biz uchun yaxshi) | Ha: masshtab, yengil chang, g'adir-budirlik 0,55 |
| **Namuna trubkasi** (Mars 2020 sample tube) | Uzunligi 6 dyuymdan (15,2 sm) kam, og'irligi 57 g dan kam, asosan titan ([tube 266](https://science.nasa.gov/photojournal/perseverance-sample-tube-266/), [JPL](https://www.jpl.nasa.gov/news/a-martian-roundtrip-nasas-perseverance-rover-sample-tubes/)). Tashqarida oq alumina qoplama, oltinrang TiN qoplama, ochiq uchida yalang'och titan ([anatomy](https://science.nasa.gov/resource/anatomy-of-a-sample-tube/)). Namuna o'zagi 13 mm × 60 mm ([core](https://science.nasa.gov/photojournal/perseverances-rock-core-from-berea-outcrop)). Trubka diametri NASA sahifalarida topilmadi | 0,906 × 0,968 × 5,60 (STL fayldan, birlik dyuym) | **0,0254** (dyuym → metr). Natija: 14,2 sm uzunlik, 2,3 sm diametr | STL fayl rangsiz. Haqiqiysi uch xil qoplamali (oq, oltinrang, yalang'och titan). Diametr tekshirib bo'lmadi, lekin 13 mm lik o'zak sig'ishi uchun ~2,3 sm mantiqiy | Qisman: bitta och-kumush "satin" metall material berildi. Uch xil qoplama qilinmadi |
| **Mars globusi** (Viking xaritasi) | Radiusi 3389,5 km ([NSSDC fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)), "3390 km" ([Mars facts](https://science.nasa.gov/mars/facts/)). Atmosfera "scale height" 11 km | Radiusi 1,0 | **3 389 500** (haqiqiy o'lchamda) | GLB ichidagi xarita 1440×720. Atmosfera yo'q | Ha: 2048×1024 xarita (`source/tex/mars-globe.jpg`) qo'yildi. Xarita yo'nalishi tekshirildi (0° uzunlik +X da, sharq +Y da). Valles Marineris kameraga qaratildi. Yupqa atmosfera chegarasi (radius +1,2 %, ~40 km) faqat yorug' tomonda yorishadi |
| **Gale krateri va Sharp tog'i** (fon) | Gale diametri 154 km. Sharp tog'i krater tubidan ~5,5 km baland ([PIA](https://science.nasa.gov/photojournal/destination-gale-crater-in-august-2012/)). Boshqa sahifada 5 km ([panorama](https://science.nasa.gov/photojournal/wide-angle-panorama-from-ridge-in-mars-gale-crater/)) | Protsedura (skriptda) | Haqiqiy metr | Tog' markazi roverdan 34 km uzoqda, cho'qqisi tekislikdan 4,6 km baland (Curiosity hozir tog' etagida yuqoriroq turibdi). Krater devori 70–84 km radiusda past tizma. Mars egriligi hisobga olingan (R = 3389,5 km): ufq ~3,3 km da | Yer: qum, toshlar, och rangli tekis tosh plitalar ("bedrock"). Tog' qatlamli, uzoqlik tumani (haze) bilan |

**Yer teksturasi:** `mars-ground.jpg` (HiRISE, Gale, Bagnold qumtepalarining qora chizig'i) uzoqdagi yer uchun katta masshtabli yorug'lik o'zgarishi sifatida ishlatildi (6 km plitka). Ranglar NASA selfilaridan olindi: jigarrang-kulrang qum va och-pushti-sarg'ish tosh plitalar.

---

## 2. Qisqa izohlar (o'yin matni uchun ham foydali)

- **RAD qayerda?** Curiosity'ning radiatsiya detektori (RAD) rover palubasining **old chap burchagi** yaqinida, osmonga qarab o'rnatilgan, 65° ko'rish maydoni bilan. Hajmi kichik toster yoki 6 ta ichimlik bankasiday ([RAD PIA](https://science.nasa.gov/photojournal/radiation-assessment-detector-for-mars-science-laboratory/), [instruments](https://science.nasa.gov/mission/msl-curiosity/science-instruments/)). Bizning modelda bu `curiosity_root` ning +X / −Y (old chap) tomoni.
- **2017 yil sentabrdagi quyosh bo'roni:** 2017 yil 11 sentabrda katta quyosh hodisasi bo'ldi. RAD Mars sirtida 2012 yildan beri o'lchangan eng yuqori darajadan **ikki baravardan ko'p** radiatsiyani qayd etdi. Yuqori daraja 2 kundan ko'proq davom etdi ([JPL news](https://www.jpl.nasa.gov/news/large-solar-storm-sparks-global-aurora-and-doubles-radiation-levels-on-the-martian-surface/)). O'sha paytda Curiosity Gale kraterida edi.
- **Aloqa kechikishi:** Yer va Mars orasida signal bir tomonga **4 dan 20 daqiqagacha** yuradi ([NASA](https://www.nasa.gov/missions/tech-demonstration/deep-space-atomic-clock/how-an-atomic-clock-will-get-humans-to-mars-on-time/)). NSSDC masofalaridan (54,6–401,4 mln km) bizning hisob: ~3–22 daqiqa.
- **Kunduzgi osmon:** inson ko'ziga "butterscotch" (karamel-sarg'ish) rangda ko'rinadi ([PIA](https://science.nasa.gov/resource/mount-sharp-panorama-in-white-balanced-colors/)). Sababi havodagi chang ([Mars facts](https://science.nasa.gov/mars/facts/)).
- **Ko'k quyosh botishi:** mayda chang zarralari ko'k nurni Quyosh yo'nalishiga yaqin sochadi. Shuning uchun Quyosh atrofida ko'kimtir nur ko'rinadi, osmonning qolgan qismi sariq-to'q sariq yoki kulrang bo'ladi ([PIA19400](https://science.nasa.gov/photojournal/sunset-in-mars-gale-crater/), [explainer](https://science.nasa.gov/solar-system/planets/mars/what-does-a-sunrise-sunset-look-like-on-mars/)). Bizning quyosh botishi sahnamiz PIA19400 fotosiga qarab sozlandi: kulrang-ko'k osmon, Quyosh atrofida ko'k nur, qorong'i oldingi plan, uzoqda krater devori.
- **"Oila surati" haqiqat emas:** uchala apparat Marsning **turli joylarida**: Curiosity Gale kraterida (2012), Perseverance Jezero kraterida (2021), Viking 1 Chryse Planitia'da va Viking 2 Utopia Planitia'da (1976). `mars_family` kadri faqat o'lchamlarni solishtirish uchun badiiy kompozitsiya. Yonidagi namuna trubkasi ham shunday (haqiqatda trubkalar Jezero'da).

## 3. NASA fotolari bilan solishtirish

Fotolar `docs/ref/mars/` papkasida:
- `curiosity_selfie_PIA23240.jpg`: Curiosity selfisi, "Aberlady/Kilmarie", 2019 ([asset](https://images-assets.nasa.gov/image/PIA23240/PIA23240~medium.jpg))
- `perseverance_selfie_PIA24542.jpg`: Perseverance va Ingenuity, 2021 ([asset](https://images-assets.nasa.gov/image/PIA24542/PIA24542~medium.jpg))
- `mars_sunset_PIA19400.jpg`: Gale'da quyosh botishi, 2015 ([asset](https://images-assets.nasa.gov/image/PIA19400/PIA19400~orig.jpg))

Shunga o'xshash burchakdan olingan renderlar: `renders/mars/compare/curiosity_selfie_angle.png`, `renders/mars/compare/perseverance_selfie_angle.png`.

Ko'rilgan farqlar va nima qilindi:
1. **Chang:** haqiqiy Curiosity juda changli (palubasi jigarrang-pushti). Modelga kuchliroq chang (0,22) berildi, Perseverance'ga yengil chang (0,07).
2. **Yer rangi:** birinchi renderlarda yer juda to'q sariq edi. Fotolarga qarab jigarrang-kulrangroq qilindi va och rangli tekis tosh plitalar qo'shildi.
3. **Metall + chang:** changli alyuminiy g'ildiraklar mis rangiga kirib qolgandi. Chang tushgan joyda "metallic" kamaytirildi.
4. **Quyosh botishi:** avval ko'k doira juda katta va keskin edi. PIA19400 ga qarab yumshatildi, osmon kulrang-ko'k qilindi, oldingi plan qoraytirildi.
5. **Qolgan farqlar:** g'ildirak shikastlari yo'q. Curiosity qo'li yuqoriga ko'tarilgan, selfida esa qo'l raqamli o'chirilgan. Ingenuity yo'q. Viking ranglari soddalashtirilgan.
6. **Perseverance metall qismlari** (g'ildiraklar, qo'l) renderda fotodagidan iliqroq, jigarrangroq ko'rinadi. Sababi: modelning bronza va "gunmetal" materiallari to'q sariq osmonni aks ettiradi. 2021 yilgi fotoda ular kulrangroq. Tuzatilmadi.
7. **Masshtab:** Curiosity balandligi 2,215 m (NASA: 2,2 m), g'ildiragi 0,485 m (NASA: 0,50–0,508 m). Shuning uchun masshtab 1,0 qoldirildi. Balandlik va eni to'g'ri, g'ildiraklar ~3 % kichik.

## 4. NASA brend qoidalari (bajarildi)

Hech bir renderda NASA "meatball" yoki "worm" logosi, JPL logosi, AQSh bayrog'i, missiya emblemasi yoki yozuv ko'rinmasligi kerak. Tozalangan teksturalar:
- Curiosity `tex_05`: "CURIOSITY" yozuvi va rover rasmi, MSL / JPL / bayroq / NASA medalyonlari (tekis disklar), MAHLI kalibrovka nishonidagi yozuv, penni (oddiy mis disk).
- Perseverance `arm_graphics`: "MARS 2020", "PERSEVERANCE", NASA + JPL logolari, harf shaklidagi fiducial belgilar. `blade`: JPL, AQSh bayrog'i, NASA plastinkalari. `mars_2020_03`: NASA va JPL panjaralari. `mars_2020_04`: "10,932,295 Explorers" yozuvi.
- Nusxalar `scenes/mars/tex_clean/*.png` da saqlangan. `.blend` ichidagi rasmlar ham shu tozalangan holatda (packed).
- Viking, trubka va globusda logo yo'q.

## 5. Renderlar

| Fayl | Nima |
|---|---|
| `renders/mars/mars_gale_day_1920.png` + `.jpg` | Gale krateri, kunduz: Curiosity, karamel osmon, Sharp tog'i |
| `renders/mars/mars_family_1920.png` + `.jpg` | Viking, Curiosity, Perseverance haqiqiy o'lchamlarda (turli joylardan, badiiy) |
| `renders/mars/mars_sunset_1920.png` + `.jpg` | Ko'k quyosh botishi, rover silueti (final sahna uchun) |
| `renders/mars/mars_globe_orbit_1920.png` + `.jpg` | Orbitadan Mars (teaser) |
| `renders/mars/sprites/mars_*.png` | Shaffof spritelar, ≤512 px: curiosity, perseverance, viking, sample_tube, globe |

Fon renderlari 1920×1080 PNG, veb uchun JPG (q82). Ular Cycles CPU'da, 64 sample va denoise bilan olingan.

Qayta render qilish (terminal, CPU): `Blender -b --factory-startup -P scenes/mars/build_mars.py -- --render day,family,sunset,globe,sprites,compare --res 1920 --samples 64` (barcha CPU yadrolari ishlatiladi; `--threads N` bilan cheklash mumkin). Argumentsiz ishga tushirilsa, faqat `mars.blend` qayta quriladi (~5 s).

## 6. Blender ilovasida tekshirish uchun

- `mars.blend` ichidagi sahnalar: `mars_gale_day`, `mars_family`, `mars_sunset`, `mars_globe`, `mars_sprites`. Fayl Cycles + GPU ga sozlangan (256 sample, spritelar 64). Preferences → System → Cycles Render Devices → **Metal** ni yoqing.
- Tosh va shag'allar `ground_near` obyektidagi Geometry Nodes ("MarsScatter") orqali qilingan. Zichlik `rocks` va `pebbles` vertex group'laridan olinadi.
- Uzoqlik tumani: sahnaning `haze_color` va `haze_dist` custom property'lari (Scene → Custom Properties). Material "MarsHaze" node group orqali ularni o'qiydi.
- Sprite sahnasida `cam_sprite` kamerasi skript bilan har bir model uchun alohida joylanadi. Qo'lda render qilsangiz, kerakli kolleksiyadan boshqasini o'chiring.
- Tekshirib ko'ring: yaqin plandagi kadrlarda logo qoldiqlari yo'qligi, Perseverance machtasi tikligi (2,23 m), Viking masshtabi (2 m).
