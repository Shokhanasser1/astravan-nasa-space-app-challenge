# game3d/assets — o'yin uchun 35 ta NASA modeli (GLB)

"Oy karvonsaroyi" 3D web o'yini uchun tayyorlangan modellar. NASA Space Apps 2026, OUTPOST jamoasi.

- `assets/<id>.glb` — 35 ta model (jami ~9 MB). Har birida Draco siqilgan mesh va WebP teksturalar bor.
- `manifest.json` — har bir model haqida ma'lumot: fayl, uchburchak soni, o'lcham (metr), haqiqiy o'lcham va NASA manbasi, massa (`mass_kg`), o'yindagi roli, kredit. Gravitatsiya bloki ham shu yerda.
- `assets/_preview.png` — hamma modellarning ko'rinishi (bitta rasmda).
- `assets/_build/` — modellarni qayta yasaydigan skriptlar (pastga qarang).

**Oy darajasi (`levels/oy_level.glb`) hozircha yo'q.** Uni jamoa dizaynni kelishib olgach, jamoaning spetsifikatsiyasi bo'yicha keyinroq yasaymiz.

## Three.js'da yuklash

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

loader.load('assets/sev.glb', (gltf) => {
  const root = gltf.scene;
  const boxes = [];                       // hitbox'lar (metr, modelning o'z koordinatasida)
  root.traverse((o) => {
    if (o.name.startsWith('COL_')) {
      o.visible = false;                  // kolliziya obyekti ko'rinmasin
      if (o.userData.boxes) {
        for (const [cx, cy, cz, sx, sy, sz] of JSON.parse(o.userData.boxes)) {
          boxes.push({ center: new THREE.Vector3(cx, cy, cz), size: new THREE.Vector3(sx, sy, sz) });
        }
      }
    }
  });
  scene.add(root);
});
```

- Teksturalar `EXT_texture_webp` kengaytmasida. Three.js GLTFLoader buni o'zi o'qiydi. Kengaytmalar ro'yxati: `KHR_draco_mesh_compression`, `EXT_texture_webp`, ba'zi modellarda `KHR_materials_specular`, `KHR_materials_ior`, `KHR_materials_emissive_strength`, `KHR_materials_clearcoat`.
- Model ichida animatsiya, kamera va chiroq yo'q. Osmon va yorug'lik o'yin dvigatelida qilinadi.

## Birliklar va o'qlar

- **1 birlik = 1 metr.** Modellar haqiqiy o'lchamda. Masshtab koeffitsiyentlari bekat hujjatlaridan olingan (`docs/<bekat>_nasa_taqqoslash.md`).
- **Y yuqoriga** (glTF standarti). Modelning **oldi +Z** tomonga qaragan (qayerda ma'nosi bo'lsa): skafandrlar va robotlarning yuzi, SEV kabinasi, HDU havo shlyuzi (airlock) va zinapoyasi.
- **Origin = pastki markaz:** model y = 0 da yerga tegib turadi, x/z bo'yicha o'rtada.
- **Istisnolar:**
  - `hdu-1` (qobiq) va `hdu-2` (taglik, zinapoya, ayvon) bitta NASA modelining ikki qismi. Ikkalasini **bir xil joy va burchakka** qo'ying, shunda ular to'g'ri birlashadi. Taglik y = 0 da, qobiq o'qi x = z = 0 da.
  - Globuslar (`earth-globe`, `moon-globe`, `mars-globe`): origin markazda, radiusi **1 m**. Haqiqiy radius `manifest.json` da yozilgan. Kerakli o'lchamga o'zingiz kattalashtiring.
  - Relyeflar (`apollo-11-site` 30×30 km, `mount-hadley` ~40 km, `moon-near-side` ~400 km) haqiqiy o'lchamda, shuning uchun juda katta. Ular uzoq fon uchun. `apollo-11-site` da NASA bosmasidagi 60 marta bo'rttirish olib tashlangan, shuning uchun u deyarli tekis (relyefi ~36 m). Bosma ko'rinishi kerak bo'lsa, Y ni 60 ga ko'paytiring.
  - `solar-wing` yerda yotibdi (panellar +Y ga qaragan). Tik turg'izish uchun X o'qi atrofida −90° buring.
  - `astronaut` T-pozada, skeleti yo'q. Harakatlanadigan qahramon `game3d/characters/` papkasida (boshqa ishchi qilyapti).

## Kolliziya (hitbox) nomlari

- Har bir GLB ichida ikkita tugun bor: ko'rinadigan model `<id>` va kolliziya `COL_<id>`.
- `COL_<id>` materialsiz. Uni yashiring (`visible = false`).
- Ko'p modellarda `COL_<id>` bir nechta to'g'ri burchakli qutidan iborat. Qutilar ro'yxati `userData.boxes` da JSON qator ko'rinishida: `[cx, cy, cz, sx, sy, sz]` (markaz va o'lcham, metr, glTF/Three.js o'qlarida, modelning o'z koordinatasida). Model surilsa yoki burilsa, qutilarga ham modelning `matrixWorld` ini qo'llang. `userData.collider = "boxes"`.
- Relyeflarda (`apollo-11-site`, `moon-near-side`, `mount-hadley`) `COL_<id>` — soddalashtirilgan mesh (~4 ming uchburchak), `userData.collider = "mesh"`. Undan trimesh yoki heightfield kolliziya yasang.
- `mission-control` xona: pol, 4 devor va pultlar uchun qutilar (ichida yurish mumkin).
- Keyingi Oy darajasida ham shu qoida bo'ladi: `COL_*` qattiq obyektlar, `COL_ground` yer, `BAG_*` suv sumkalari, `ICE_*` muz bo'laklari, `SPAWN_player` o'yinchi chiqadigan joy.

## Fizika

- Gravitatsiya (`manifest.json` → `gravity`): Yer **9.81**, Oy **1.62**, Mars **3.71** m/s². Manba: NASA NSSDC fakt varaqlari, https://nssdc.gsfc.nasa.gov/planetary/factsheet/
- Massa: `manifest.json` dagi `mass_kg`. Topilmagan bo'lsa `null` (o'zingiz o'yin uchun qiymat bering). `mass_status`: `confirmed` (rasmiy manbada bor) yoki `approximate` (taxminiy).
- `crew-lock-bag` ("suv g'ishti") o'lchami taxmin: NASA bu sumkaning o'lchamini e'lon qilmagan. Suv massasini hajmdan hisoblang (1 litr = 1 kg).

## Uchburchak va hajm cheklovlari

| Turi | Chegara | Misollar |
|---|---|---|
| Kichik buyumlar | ≤ 5 000 | crew-lock-bag 514, hammer 692, helmet 4 925, sample-tube 4 924, oru 2 776, solar-wing 216 |
| Skafandr, robot, rover | ≤ 30 000 | sev 29 547, rassor 29 550 (2 mln dan), emu 29 550 (343 ming dan), astronaut 6 381, curiosity 29 549, perseverance 29 458 |
| Katta kema va stansiyalar | ≤ 50 000 | hdu-1 2 264, hdu-2 4 240, iss 49 233, gateway 49 250, sls 49 250, sdo 49 250 (273 ming dan) |
| Relyef | ≤ 60 000 | apollo-11-site, moon-near-side, mount-hadley — 59 099 |

Teksturalar ko'pi bilan 1024 px (kichik buyumlarda 512 px yoki kamroq). Jami hajm ~9 MB.

## NASA brend qoidasi (logolar)

Hech bir teksturada NASA logotipi, muhr, AQSh bayrog'i, missiya yamog'i yoki agentlik yozuvi qolmagan. Har bir teksturani ko'z bilan tekshirdik. Bo'yab yopilganlari:

- `hdu-1`: 2 ta bayroq, 2 ta NASA logosi, X-Hab va HDU logolari, "Segment" yozuvlari, "AIRLOCK" yozuvi.
- `astronaut`: 2 ta AQSh bayrog'i, NASA logosi, missiya yamog'i.
- `emu`: bayroq, missiya yamog'i va yozuvli quti materiallari oddiy oq rangga almashtirildi.
- `mark-3`: NASA logosi materiali oddiy oq rangga almashtirildi.
- `apollo-lm`: AQSh bayrog'i va "UNITED STATES" yozuvi.
- `saturn-v`: qizil "UNITED STATES"/"USA" yozuvlari.
- `curiosity`: "CURIOSITY" yozuvi, MSL/JPL/bayroq/NASA medalyonlari.
- `perseverance`: "MARS 2020", "PERSEVERANCE" yozuvlari, NASA va JPL logolari, bayroq plastinkasi, "10,932,295 Explorers" yozuvi.
- `gateway`: Canadarm3 dagi "Canada" yozuvi.
- `crew-lock-bag`: 2 ta shtrix-kod yorlig'i.

Boshqa tuzatishlar: shisha kabi ko'rinadigan materiallar (Transmission = 1) oddiy qilindi; SDO ning teskari normallari tuzatildi; HDU dagi haqiqatda yo'q qora "qanotlar" olib tashlandi; ISS, SLS, Orion, RASSOR, mission-control kabi rangsiz modellarga oddiy ranglar berildi; ortiqcha yordamchi bo'laklar (LRO va DSN kubi, ISS uzoqdagi disklari, Robonaut 2 oyog'i ostidagi bo'lak, dubulg'a yonidagi mayda bo'laklar) o'chirildi. Har modelning tuzatishlari `manifest.json` → `fixes` da.

## Kreditlar (o'yinda albatta yozing)

- **3D models: NASA 3D Resources / NASA Science (NASA/JPL-Caltech). Not endorsed by NASA.**
- Yer globusi: NASA Blue Marble Next Generation. Oy globusi: NASA SVS CGI Moon Kit (LRO). Mars globusi: NASA/JPL-Caltech/USGS Viking.
- Gateway: NASA uni 2026-yil 24-martda to'xtatgan — o'yinda "rejalashtirilgan edi" deb yozing.

## Qayta yasash

```
cd ~/dev/oy-karvonsaroyi-3d/game3d/assets
_build/run_one.sh sev            # bitta model: yasash + qayta import tekshiruvi + 512 px preview
cat ids.txt | xargs -P 8 -n 1 _build/run_one.sh    # bir nechta model parallel
python3 _build/make_manifest.py  # manifest.json (_work/ dagi statistikadan)
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P _build/make_contact.py   # _preview.png
```

`build_asset.py` har modelni alohida Blender'da yasaydi (biri buzilsa, qolganlari to'xtamaydi), `verify_asset.py` tayyor GLB ni yangi Blender'da qayta ochib tekshiradi (uchburchak, o'lcham, rasmlar, kolliziya). Manba `source/models/*.glb` fayllari o'zgartirilmaydi. `_work/` papkasi vaqtinchalik, ish oxirida o'chirildi; manifest qayta kerak bo'lsa, avval modellarni qayta yasang.
