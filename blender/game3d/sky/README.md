# 360° osmonlar

Oltita osmon, har biri 4096×2048 (JPEG q88) va 2048×1024 (JPEG q85). Blender 5.3, Cycles, Metal GPU, 128 sample va denoising ishlatiladi. Barcha chiqishlar shu papkada qoladi.

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P game3d/sky/make_skies.py
# Bitta osmonni qayta yaratish:
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P game3d/sky/make_skies.py -- --only oy_sky
```

## Three.js bilan ulash

```js
import * as THREE from 'three';

const base = '/game3d/sky/'; // Saytdagi joylashuvga moslang.
const catalog = await fetch(base + 'sky.json').then(r => r.json());
const cfg = catalog.skies.yer_dusk;
const texture = await new THREE.TextureLoader().loadAsync(base + cfg.file_2k);
texture.mapping = THREE.EquirectangularReflectionMapping;
texture.colorSpace = THREE.SRGBColorSpace;
scene.background = texture;
scene.backgroundRotation.set(0, 0, 0);
scene.backgroundIntensity = 1;

// Y yuqori. Azimut 0° = +X, 90° = +Z; balandlik 0° = ufq.
function skyDirection(azimuth, elevation) {
  const a = THREE.MathUtils.degToRad(azimuth);
  const e = THREE.MathUtils.degToRad(elevation);
  return new THREE.Vector3(Math.cos(e) * Math.cos(a), Math.sin(e),
                           Math.cos(e) * Math.sin(a));
}
const sun = new THREE.DirectionalLight(cfg.sun.color, cfg.sun.intensity);
sun.position.copy(skyDirection(cfg.sun.azimuth_deg, cfg.sun.elevation_deg))
  .multiplyScalar(100);
sun.target.position.set(0, 0, 0);
scene.add(sun, sun.target);
const ambient = new THREE.HemisphereLight(cfg.hemisphere.sky_color,
  cfg.hemisphere.ground_color, cfg.hemisphere.intensity);
scene.add(ambient);
```

Osmonni almashtirganda eski teksturani `dispose()` qiling, eski yoritgichlarni olib tashlang. Kamera osmon markazida bo‘lishi shart emas: `scene.background` cheksiz uzoqda chiziladi. O‘yin yer yuzasi pastki yarimsharni yopadi. Rasmlar sRGB LDR: yorug‘lik kuchlari tavsiya, HDR yoritish o‘lchovi emas. Ranglarni saqlash uchun renderer tone mapping sozlamasini loyihaga moslang.

## Yo‘nalish va tekshiruv

Rasmning chapdan ulushi `u = 0.5 + azimut / 360` (1 bo‘yicha aylantiriladi), tepadan ulushi `v = 0.5 - balandlik / 180`. Quyoshning markazi shu nuqtada. Blenderdagi yo‘nalish `(x, y, z)` Three.js da `(x, z, -y)` bo‘ladi. `backgroundRotation` o‘zgartirilsa, yorug‘lik va Yer yo‘nalishini ham bir xil burish kerak.

- `yer_dusk`: Nishita asosidagi atmosferada 4° baland Quyosh, pushti bulutlar, pastda yumshoq dengiz/quruqlik tusi. KSC atrofidagi muhit talqini; aniq geografik fotopanorama emas.
- `xks_orbit`: Yer sferasi radiusi 6371 km, kamera markazdan 6771 km; ufq taxminan 19.8° pastda. To‘liq 360° tasvirda ufq gorizontal tasma bo‘ladi, tor kamera ko‘rinishida Yer cheti egri ko‘rinadi. Atmosfera 15 km qalinlikdagi badiiy yupqa qobiq.
- `oy_sky`: Yer 25° balandda, diametri 1.9°, Quyoshga 90° yo‘nalishda — yarim yoritilgan. Pastki yarimshar to‘q kulrang; yulduzlar juda xira.
- `mars_day`: mavjud Mars sahnasidagi `#e6ba92`, `#daa87e`, `#b87e58` chang ranglari.
- `mars_sunset`: mavjud sahnaning kulrang-jigarrang tusi, Quyosh atrofida PIA19400 ga mos ko‘kimtir yorug‘lik talqini.
- `koinot_space`: mavjud yulduz rasmi va sferik protsedurali xira yulduzlar, yengil Somon Yo‘li tasmasi; sayyoralar yo‘q. Bu aniq astronomik yulduz xaritasi emas.

## Manbalar

Yer: NASA Blue Marble Next Generation (`scenes/xks/tex/bluemarble_oct_5400.jpg`). Yulduzlar: loyihadagi `scenes/koinot/tex/starfield_1920x1080.png`. Ranglar: `scenes/mars/build_mars.py`, `scenes/yer/build_yer.py`; Oy yoritilishi: `scenes/oy/build_oy.py`.

Oy xaritasi krediti: NASA SVS CGI Moon Kit (LRO). Mars xaritasi krediti: NASA/JPL-Caltech/USGS. Oy va Mars sirt xaritalari bu osmonlarda ishlatilmagan: ular sirt ustidan ko‘rinadigan osmonlar, sayyora globuslari emas.

Not endorsed by NASA.

## Sifat nazorati

`check_skies.py` Pillow va NumPy bilan ishlaydi: 12 JPEG o‘lchami, 40 MB chegarasi, chap/o‘ng chetlar farqi va Quyosh nuqtasini qayd qiladi. `preview.jpg` — oltita fon ko‘rinishi, `checks.json` — tekshiruv raqamlari. Denoising chetida chiziq qolmasligi uchun render skripti 12 piksellik chetlarni davriy tutashtiradi (taxminan 1° maydon).

HawkScan tekshiruvi bajarilmadi: tizimda `hawk` CLI topilmadi. Ushbu papka statik rasmlar va mahalliy Blender skriptidan iborat; veb-server yoki API qo‘shilmagan.
