# Oy karvonsaroyi — astronavt personaji va 3D test demo

NASA Space Apps 2026, OUTPOST jamoasi. Bu papkada o'yin uchun skeletli, animatsiyali astronavt va uni sinab ko'rish uchun brauzer demo bor.

## Nima qayerda

| Fayl | Nima |
|---|---|
| `characters/astronaut.glb` | Personaj: skinned mesh + 23 suyak + 6 animatsiya (~640 KB) |
| `characters/build_astronaut.py` | GLB ni noldan quradi (Blender, headless) |
| `characters/verify_astronaut.py` | GLB ni yangi Blender'da ochib tekshiradi (suyak, klip, tris, o'lcham, logo) |
| `characters/_work/astronaut_rig.blend` | Rassom uchun: skelet va animatsiyalar Blender faylida |
| `demo/index.html` | Demo sahifasi (import map: three@0.170.0, CDN) |
| `demo/demo.js` | Brauzer qismi: renderer, osmon, level, kamera, HUD |
| `demo/game.js` | O'yin mantig'i (DOM'siz): o'yinchi, sumkalar, kamera to'qnashuvi, animatsiya holati |
| `demo/physics.js` | Fizika va formulalar (three.js'ga bog'liq emas) |
| `demo/world.js` | Level o'qish (COL_/BAG_/ICE_/SPAWN_), yerning balandligi, animatsiya boshqaruvchisi |
| `demo/input.js` | Klaviatura, sichqoncha, sensorli joystik |
| `demo/smoke_test.mjs` | Brauzersiz test (Node) |

## Personaj: `characters/astronaut.glb`

- Manba: `source/models/astronaut.glb` (NASA 3D Resources). 6379 uchburchak (≤15k), tekstura 1024 px (kostyum) + 128 px (shlem oynasi).
- Bo'yi **1.85 m**. Origin — ikki oyoq o'rtasida, tovon tagida (y = 0). Old tomoni **+Z** (glTF). Chap qo'li +X tomonda.
- Teksturadagi 2 ta AQSh bayrog'i, NASA belgisi va missiya patchi bo'yab yopilgan. `verify_astronaut.py` buni avtomatik tekshiradi: logo joylarida rangli piksel 0 % → `CLEAN`.
- Eslatma: 15:44 dagi birinchi eksportda bayroqlar teksturaga qaytib tushgan edi. Blender eksporteri tasvirning eski "packed" baytlarini ishlatgan. Bu tuzatildi (16:04): tozalangan PNG yangi tasvir sifatida yuklanadi.

### Suyaklar (23 ta, Mixamo uslubidagi nomlar)

```
AstronautRig (armature tuguni)
└─ Hips
   ├─ LeftUpLeg → LeftLeg → LeftFoot → LeftToeBase
   ├─ RightUpLeg → RightLeg → RightFoot → RightToeBase
   └─ Spine → Spine1 → Spine2
              ├─ Neck → Head
              ├─ LeftShoulder → LeftArm → LeftForeArm → LeftHand
              ├─ RightShoulder → RightArm → RightForeArm → RightHand
              └─ BagSocket   (sumka "rozetkasi": ko'krak oldida, Carry/Pour da qo'llar orasida)
```

PLSS ryukzak, shlem va ko'krakdagi DCM pulti qattiq (Spine2/Head ga to'liq bog'langan), shuning uchun egilmaydi. Nomlar Mixamo'ga o'xshash, retarget qilish oson.

### Animatsiyalar (30 fps, alohida glTF animation) — 15 Nov, Oy fizikasiga moslangan

| Klip | Uzunlik | Takror | Tezlik (oyoq shu tezlikda yerga qadaladi) | Nima |
|---|---|---|---|---|
| `Idle` | 2.0 s | loop | 0 | Tik turish, nafas, og'irlikni oyoqdan oyoqqa o'tkazish |
| `Walk` | 1.33 s | loop | 1.0 m/s | Oyda yurish: tizza bukik, tovon → panja dumalashi, son tebranishi 2.4 sm |
| `Run` | 1.33 s | loop | 2.0 m/s | Apollo uslubidagi lope: navbatma-navbat oyoq, har qadamda ikkala oyoq 0.33 s havoda (g = 1.62) |
| `Carry` | 1.27 s | loop | 0.8 m/s | Sumkani ikki qo'lda ko'tarib yurish (BagSocket) |
| `Pour` | 2.0 s | loop | 0 | Sumkani ko'krakkacha ko'tarib, ~75° egib suv quyish |
| `JumpStart` | 0.83 s | bir marta | 0 | Idle → Oyda sekin cho'kish (14 sm) → itarilish; oxirgi kadr = uchish pozasi, son +1.2 m/s |
| `JumpAir` | 1.5 s | bir marta | 0 | Butun parvoz (1.48 s, 0.44 m): o'yin uni parvoz ulushi u bo'yicha aylantiradi (0 uchish, 0.5 cho'qqi, 1 qo'nish) |
| `JumpLand` | 0.73 s | bir marta | 0 | Qo'nish: tizzalar zarbani yutadi (14.5 sm), oxiri = Idle'ning birinchi kadri |
| `Jump` | 3.13 s | bir marta | 0 | Uchalasi bitta klipda, son haqiqiy parabola bo'yicha 0.44 m ko'tariladi (eski kod va ko'rish uchun) |

Hamma klip joyida (root motion yo'q): personajni o'yin kodi suradi. Yurish kliplarini `timeScale = tezlik / klip tezligi`
bilan o'ynating — shunda yerdagi oyoq sirpanmaydi (`demo/world.js` → `CLIP_SPEED`). O'lchovlar (skinlangan mesh'da):
botish ≤ 4 mm, yerdagi oyoq sirpanishi ≤ 1.3 sm, son pastga tezlanishi hech qayerda −1.62 m/s² dan oshmaydi.
Manba skriptlar: `characters/anim/` (`lunar_rig.py` — IK, bake, o'lchov; `clips/*.py` — kliplar; `ship.sh` — yig'ish).

### Three.js'da ishlatish

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltf = await new GLTFLoader().loadAsync('/characters/astronaut.glb');
const model = gltf.scene;                       // Y yuqori, +Z oldinga, 1 birlik = 1 m
scene.add(model);
const mixer = new THREE.AnimationMixer(model);
const clip = (name) => gltf.animations.find((a) => a.name === name);
let current = mixer.clipAction(clip('Idle')).play();

function playClip(name, fade = 0.25) {           // silliq almashish (crossfade)
  const next = mixer.clipAction(clip(name));
  if (next === current) return;
  next.reset().fadeIn(fade).play();
  current.fadeOut(fade);
  current = next;
}
for (const n of ['Jump', 'JumpStart', 'JumpAir', 'JumpLand']) {   // bir marta o'ynaydi, oxirida to'xtaydi
  const a = mixer.clipAction(clip(n));
  a.setLoop(THREE.LoopOnce, 1);
  a.clampWhenFinished = true;
}
// yurish: oyoq sirpanmasligi uchun klip tezligini harakat tezligiga moslang
// mixer.clipAction(clip('Walk')).timeScale = speed / 1.0;   // Run: / 2.0, Carry: / 0.8

// sumkani qo'lga berish: BagSocket suyagiga bola qilib qo'shing
model.getObjectByName('BagSocket').add(bagObject);

// har kadrda: mixer.update(dt);
```

To'liq holat mashinasi (Idle/Walk/Run/Carry/Pour + JumpStart/JumpAir/JumpLand) `demo/world.js` dagi `AnimController` da.

## Demo'ni ishga tushirish

```
cd ~/dev/oy-karvonsaroyi-3d/game3d && python3 -m http.server 8000
```

Keyin brauzerda: **http://localhost:8000/demo/**

- `file://` orqali ochmang — GLB yuklanmaydi.
- Internet kerak: three.js (cdn.jsdelivr.net) va Draco dekoderi (gstatic.com) CDN'dan keladi.
- URL parametrlari: `?g=earth` yoki `?g=mars` (boshlang'ich tortishish), `?debug=1` (hitboxlar ko'rinadi), `?level=none` (oy_level.glb bo'lsa ham placeholder), `?props=0` (placeholder'da NASA modellari o'rniga oddiy qutilar). Bir nechtasini birga: `?g=earth&debug=1`.
- Brauzer konsolida `__game` — o'yin obyekti (tekshirish uchun).

### Boshqaruv

| Klaviatura / sichqoncha | Nima qiladi |
|---|---|
| `W A S D` yoki strelkalar | Yurish (kamera qaragan tomonga nisbatan) |
| `Shift` | Yugurish |
| `Space` (bo'shliq) | Sakrash |
| `E` | Sumkani olish / qo'yish (`BAG_*`) |
| `F` (bosib turing) | Sumka qo'lda bo'lsa — suv quyish (`Pour`) |
| Sichqoncha (bosing → pointer lock), `Esc` | Kamera aylanadi; g'ildirak — yaqin/uzoq |
| `G` | Tortishish: Oy → Yer → Mars (sakrash farqini ko'rish uchun) |
| `C` | Hitboxlarni ko'rsatish (to'q sariq — devor, ko'k — sumka, yashil — o'yinchi) |
| `R` / `H` | Boshiga qaytish / yordam panelini yashirish |

Planshet: chapda joystik, o'ngda tugmalar — **Sakrash**, **Ol/Qo'y**, **Yugurish** (yoqish/o'chirish), **Quyish**. Ekranning bo'sh joyini barmoq bilan sursangiz, kamera aylanadi.

### HUD (o'zbekcha + kichik inglizcha)

Tezlik (m/s), tortishish (m/s²), yuk (kg), umumiy massa (odam + EMU + yuk), tezlik ulushi, **sakrash balandligi** (formula bilan va Yerdagi qiymat bilan solishtirib), oxirgi sakrashning o'lchangan balandligi, og'irlik (N).

## Fizika raqamlari va manbalar

| Kattalik | Qiymat | Manba |
|---|---|---|
| Oy tortishishi | 1.62 m/s² | NASA NSSDC Moon Fact Sheet — https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html |
| Yer tortishishi | 9.81 m/s² | NASA NSSDC Earth Fact Sheet — https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html |
| Mars tortishishi | 3.71 m/s² | NASA NSSDC Mars Fact Sheet — https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html |
| EMU skafandr massasi | 145 kg | NASA EMU fact sheet — https://www.nasa.gov/wp-content/uploads/2015/07/2019_07_ea_emu.pdf |
| Sumka (CTB) | 42.5 × 50.2 × 23.5 sm, 27 kg gacha | STS-92 press kit — https://www.nasa.gov/wp-content/uploads/2023/05/sts-092-press-kit.pdf |
| Odam massasi | 75 kg | o'yin tanlovi (taxmin) |
| Yurish / yugurish (lope) | 1.0 / 2.0 m/s | Apollo o'lchovlari (15 Nov; oldin 1.4 / 3.2 edi) |
| Sakrashdan oldin cho'kish | 0.83 s | `JumpStart` klipi uzunligi (Oyda tezroq cho'kib bo'lmaydi; oldin 0.15 s) |
| Sakrashdagi tik tezlik | 1.2 m/s | o'yin tanlovi (Yerda ham, Oyda ham bir xil) |

Agar `game3d/manifest.json` da `"gravity"` bo'lsa, demo o'sha qiymatni oladi (hozir: 9.81 / 1.62 / 3.71).

Formulalar (`demo/physics.js`):

- Sakrash balandligi: **h = v² / (2g)**. Oyda 1.2² / (2 × 1.62) = **0.44 m**, Yerda 1.2² / (2 × 9.81) = **0.07 m** → Oyda **9.81 / 1.62 ≈ 6.1 marta** baland. Havoda turish vaqti t = 2v/g: Oyda 1.48 s, Yerda 0.24 s.
- Yuk tezlikni kamaytiradi: oyoq kuchi bir xil, massa ko'payadi → tezlik × **M / (M + m)**. M = 75 + 145 = 220 kg. 27 kg sumka bilan: 220 / 247 = **×0.89** (yurish 1.4 → 1.25 m/s).
- Yuk bilan sakrash: oyoq bajargan ish bir xil → v = 1.2 × √(M / (M + m)) → 27 kg bilan Oyda 0.40 m.
- Og'irlik F = m·g: skafandrdagi odam (220 kg) Oyda 356 N, Yerda 2158 N.
- Yerdagi tezlanish ishqalanishga bog'liq (≈1.5·g, kamida 2.5 m/s²) — Oyda to'xtash va burilish sekinroq.

## Level qoidalari (kelajakdagi `levels/oy_level.glb` uchun)

Fayl paydo bo'lishi bilan demo uni avtomatik yuklaydi (hozir yo'q — placeholder yer + qutilar ishlatiladi). Nomlar:

| Nom | Ma'nosi |
|---|---|
| `COL_ground` | Yurish mumkin bo'lgan yer (past poligonli mesh). Ko'rinmaydi. Balandlik shundan olinadi. |
| `COL_*` | Devor/qattiq jism. Mesh (har bir alohida bo'lak = bitta quti) yoki extras `boxes` = `[[cx,cy,cz,sx,sy,sz], …]` (game3d/assets qoidasi). Ko'rinmaydi. |
| `BAG_*` | Olib yuriladigan sumka. Ixtiyoriy extras `mass_kg` (bo'lmasa 27 kg). Havoda tursa, yerga/qutiga tushadi. |
| `ICE_*` | Muz bo'lagi (yaqinlashganda HUD da yozuv chiqadi). |
| `SPAWN_player` | Bo'sh obyekt: o'yinchi shu yerda, shu tomonga (+Z) qarab paydo bo'ladi. |

Level yo'q bo'lsa, placeholder sahnaga `game3d/assets/` dan modellar qo'yiladi: `hdu-1` + `hdu-2` (bir xil joyda, rampa o'yinchi tomonga), `sev`, `rassor`, `crew-lock-bag` (sumkalar ko'rinishi). Ular bo'lmasa — oddiy qutilar. Hitbox — har bir assetdagi `COL_<id>` qutilari.

Osmon: `game3d/sky/sky.json` bo'lsa, `oy_sky` panoramasi fon bo'ladi, quyosh yo'nalishi va rangi sky.json dan olinadi (Yer panoramada bor). Bo'lmasa — qora osmon, yulduzlar va kichik Yer (`assets/earth-globe.glb` yoki ko'k shar).

## Qanday tekshirildi

1. `verify_astronaut.py` (yangi Blender'da qayta import): 23 suyak, 6 klip va uzunliklari, 6379 tris, bo'yi 1.850 m, oyoqlar markazi (0, 0), shlem oynasi +Z tomonda, logo tekshiruvi `CLEAN`. 5 ta pozadan Cycles CPU renderlar ko'rib chiqildi (deformatsiya joyida).

   ```
   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
       -P game3d/characters/verify_astronaut.py -- --renders --res=512 Walk:9 Carry:10
   ```

2. `node --check` hamma JS faylda.
3. `demo/smoke_test.mjs` — Node'da: formulalar, simulyatsiya qilingan sakrash (h = v²/2g ga mos), devordan o'tolmaslik, qutining ustida turish, sumka bilan sekinlashish; three.js bilan esa: GLB ni o'qish (suyaklar, kliplar, o'lcham, +Z), placeholder level, yurish/yugurish/sakrash/sumka olish-qo'yish/quyish, kamera devor oldida yaqinlashishi, sintetik `oy_level` (COL_ground qiyalik, extras qutilar, BAG_, ICE_, SPAWN_player).

   ```
   cd ~/dev/oy-karvonsaroyi-3d/game3d
   node demo/smoke_test.mjs                                   # faqat fizika
   npm i --prefix "$TMPDIR/t" three@0.170.0
   THREE_DIR="$TMPDIR/t/node_modules/three" node demo/smoke_test.mjs   # hammasi (64 ta tekshiruv)
   ```

## Cheklovlar

- Demo haqiqiy brauzerda ochib ko'rilmagan (sandbox'da brauzer va port yo'q). Uning o'rniga demo.js soxta DOM bilan Node'da to'liq ishga tushirildi va sahna joylashuvi Blender renderida ko'rildi. Birinchi ochishda konsolni (F12) tekshiring.
- To'qnashuv faqat qutilar bilan (kapsula vs quti). HDU rampasi va zinasi — bitta qattiq quti, ustiga chiqib bo'lmaydi; yurish mumkin bo'lgan yuzalar levelda `COL_ground` orqali beriladi.
- Sumka qo'lda ushlash uchun biroz kattalashtiriladi (qo'llar orasi 42 sm), qo'yganda asl o'lchamiga qaytadi. Sumkalar bir-biriga "teleport" bilan tushadi (fizik dumalash yo'q).
- `Pour` faqat animatsiya — suv tizimi (bak, devor) bu demoda yo'q.
- `crew-lock-bag` modeli CTB dan kichikroq, lekin massa 27 kg (CTB) qoldirilgan; manifestda `mass_kg` paydo bo'lsa yoki level sumkasida extras `mass_kg` bo'lsa, o'sha olinadi.
- Odam massasi, yurish tezligi va sakrash tezligi — o'yin tanlovi (NASA raqami emas).
- Planshetda ko'p uchburchakli assetlar (SEV, RASSOR ~30k) sekinlashtirishi mumkin; unda `?props=0` bilan oching.

## Kredit

3D models: NASA 3D Resources. Not endorsed by NASA.
