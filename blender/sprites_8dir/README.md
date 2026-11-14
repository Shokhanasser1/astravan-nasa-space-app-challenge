# sprites_8dir — NASA 3D modellaridan o'yin sprite'lari

"Oy karvonsaroyi" (Phaser 3) o'yini uchun 35 ta NASA 3D modelidan bir xil uslubda chizilgan sprite'lar.

## Fayllar

| Fayl | Nima |
|---|---|
| `<id>_8dir.png` | 8 yo'nalishli varaq: 4 ustun × 2 qator, har katak **256×256 px**, fon shaffof (RGBA). Varaq o'lchami 1024×512. |
| `single/<id>.png` | Bitta 3/4 ko'rinish, **512×512 px**, fon shaffof. |
| `KATALOG.png` | Barcha `single/` rasmlar bitta jadvalda, har birining tagida model id. |
| `make_sprites.py` | Blender skripti (bitta model yoki katalog). |
| `run_all.sh` | Hamma modellarni ketma-ket render qiladi (har model alohida Blender jarayoni). |

## Ko'rinish tartibi (`_8dir.png`)

Kamera modelni 45° qadam bilan aylanib chiqadi (yuqoridan qaraganda soat strelkasiga teskari):

```
| 0: old       | 1: old-o'ng (3/4) | 2: o'ng yon  | 3: orqa-o'ng |
| 4: orqa      | 5: orqa-chap      | 6: chap yon  | 7: old-chap  |
```

Phaser'da: `this.load.spritesheet('emu', 'sprites_8dir/emu_8dir.png', { frameWidth: 256, frameHeight: 256 })` — kadr raqami = yo'nalish raqami.
Ba'zi NASA modellarida "old" tomon aniq emas (masalan, sun'iy yo'ldoshlar) — bunday holatda 0-kadr shunchaki boshlang'ich burchak.

## Uslub

- Model birlik qutiga sig'diriladi, asosi "yerda" (z=0) turadi, markazi o'rtada.
- Bitta varaqdagi 8 katakda masshtab bir xil (model aylanganda "sakramaydi").
- Kamera: orthographic, ~20° yuqoridan. Yorug'lik: iliq asosiy (key), sovuq to'ldiruvchi (fill), orqa kontur (rim). Cycles, 20 sample + denoise.
- Faqat `single/` (8dir varaq yo'q): relyef/xonalar — `moon-near-side`, `apollo-11-site`, `mount-hadley`, `mission-control` (relyeflar ~50°, xona ~45° yuqoridan, 3/4 burchakdan); globuslar — `moon-globe`, `earth-globe`, `mars-globe`.

## NASA brend qoidasi: logotiplar olib tashlangan

O'yin grafikasida NASA logotipi, muhri, AQSh bayrog'i, missiya nishonlari va yozuvlari bo'lmasligi kerak. Skript import qilingandan keyin teksturalarning **xotiradagi nusxasini** (numpy bilan) bo'yaydi — `source/` fayllariga tegilmaydi:

| Model | Nima bor edi | Qanday tuzatildi |
|---|---|---|
| emu | AQSh bayrog'i patch, missiya nishoni (vitruvian), boshqaruv qutisidagi yozuv | `emusuitFLAGpatch`, `emusuitvitruvianpatch` — oq rang bilan to'liq bo'yaldi; `emusuitbox4` — o'rtacha (median) rang |
| mark-3 | NASA "meatball" logotipi (`texturelogo`) | tekstura to'liq oq rangga bo'yaldi |
| astronaut | 2 ta AQSh bayrog'i, NASA logotipi, missiya nishoni (`astnt1_1`) | 4 ta hudud atrofdagi mato rangi bilan bo'yaldi |
| hdu-1 | AQSh bayroqlari, NASA logotiplari, HAB/HDU nishonlari, mayda bayroqlar ustuni, "AIRLOCK" yozuvi (`HDU_01`) | 10 ta hudud atrof rangi bilan bo'yaldi |
| hdu-2 | (inventarda shubha) — teksturada bayroq/logo topilmadi | o'zgartirilmadi |
| saturn-v | qizil "USA" / "UNITED STATES" yozuvlari, kichik bayroqlar | qizil piksellar (+2 px kengaytma) fon rangiga almashtirildi; `SATURNVT` dagi bayroqlar qatori bo'yaldi |
| apollo-lm | AQSh bayrog'i (`TEXTURE_`), "UNITED STATES" (`TEXTUREA`) | oltin folga rangi bilan bo'yaldi |
| curiosity | "CURIOSITY" yozuvi, NASA/JPL/bayroq medalyonlari (`tex_05`) | 2 ta hudud bo'yaldi |
| perseverance | "MARS 2020"/"PERSEVERANCE", NASA/JPL logolari (`arm_graphics`), bayroq/NASA/JPL plitalari (`blade`) | 5 ta hudud bo'yaldi |
| gateway | "Canada" so'zi (`DSXR_BaseColor`) | hudud bo'yaldi |

Boshqa tuzatishlar: `iss` — model ustida "suzib yurgan" 7 ta ortiqcha bo'lak olib tashlandi; `mission-control` — xona shifti va old devori kesildi (ichini ko'rish uchun), manba materiallari qora bo'lgani uchun nomiga qarab oddiy rang palitrasi berildi; relyef modellar (moon-near-side, apollo-11-site, mount-hadley) — regolit kulrang + past yorug'lik; `emu`, `mark-3` — 0-kadr old tomon bo'lishi uchun 180° burildi.

Shuningdek: ko'p glTF materiallarda noto'g'ri `Transmission = 1` bor edi (skafandrlar shishadek ko'rinardi) — nomida glass/visor/lens bo'lmagan materiallarda u o'chirildi.

## Qayta yaratish

```
sprites_8dir/run_all.sh            # hammasi
sprites_8dir/run_all.sh emu hdu-1  # faqat tanlanganlar
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P sprites_8dir/make_sprites.py -- --katalog
```

## Kredit

3D models: NASA 3D Resources / NASA Science. Not endorsed by NASA.
