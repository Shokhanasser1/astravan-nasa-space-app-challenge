# Qoʻl bilan boshqarish (kamera orqali) — tadqiqot va reja

Sana: 14.11.2026, kechqurun (Toshkent). Muallif: Asilbek + Claude (tadqiqot). Holat: **faqat reja**, oʻyin kodi
oʻzgarmagan. Qoʻshishdan oldin Shoxjahon akadan ruxsat kerak (yangi kutubxona).

Qisqasi: qoʻshsa boʻladi. Taxminan 6–7 soatlik ish, faqat kamera yoqilganda ~11 MB yuklanadi, flag ortida turadi
va oʻchirilsa oʻyin avvalgidek qoladi.

---

## 1. Shu turdagi oʻyinlar bormi?

Bor, lekin kamera bilan boshqariladigan, bolalar uchun **brauzerdagi 3D oʻyin** deyarli uchramadi. Bu bizga
noodatiy narsa boʻladi.

**Konsollar (katta, mashhur misollar):**
- **Sony EyeToy** (PS2) va **Xbox Kinect** (masalan Fruit Ninja Kinect): kamera butun tanani kuzatadi.
- **Nex Playground**: bolalar uchun kamerali konsol, pult kerak emas. 40 dan ortiq oʻyin, internetsiz ishlaydi,
  maʼlumot yigʻmaydi ([Engadget](https://www.engadget.com/gaming/the-nex-playground-is-everything-xbox-kinect-wanted-to-be-133000397.html?src=rss),
  [Tom's Guide](https://www.tomsguide.com/gaming/this-gadget-is-like-a-wii-without-the-controllers-and-my-kid-loves-it)).

**Brauzer oʻyinlari (MediaPipe bilan, ochiq kod):**
- [Hand Tracking Games](https://gh.r-mj.com/ali-ezz/hand-tracking-games): meva kesish, labirint, havoda rasm chizish,
  shakl chizish.
- [Brick breaker](https://hn.svelte.dev/item/42733905): platformani qoʻl bilan surish.
- [Hand Gesture Puzzle](https://chettra.is-a.dev/projects/hand-gesture-puzzle/): barmoqlarni chimchilab ushlash.
- Boshqa misollar: [GitHub webcam-game](https://github.com/topics/webcam-game),
  [MediaPipe Playground](https://gh.r-mj.com/5of12/MediaPipe-Playground).

**Three.js bilan (bizning texnologiyaga yaqin):**
- [Codrops darsligi](https://tympanus.net/codrops/2024/10/24/creating-a-3d-hand-controller-using-a-webcam-with-mediapipe-and-three-js/):
  kamera va qoʻl bilan 3D sahnani boshqarish.
- [threejs-handtracking-101](https://github.com/collidingScopes/threejs-handtracking-101): chimchilab sharni
  kattalashtirish.
- [web-ar-hand-tracking](https://awesome.ecosyste.ms/projects/github.com%2Fdamiansire%2Fweb-ar-hand-tracking):
  Vite + TypeScript + yangi `tasks-vision`.
- React Three Fiber uchun tayyor oʻyin topilmadi. Faqat alfa holatidagi kutubxona bor:
  [@handtrack3d](https://libraries.io/npm/@handtrack3d%2Freact).

**Bolalar haqida tadqiqot:** York universiteti (2024): bolalarga qoʻl harakati sichqonchadan koʻra yoqqan va
natijalari ham yaxshiroq chiqqan, lekin boshida qiynalishgan ([York 2024](https://www.yorku.ca/mack/bhci2024.html)).

---

## 2. Asosiy fikr: qoʻl sichqoncha va sensorli ekranning oʻrnini bosadi

Oʻyin hozir uchta harakat bilan boshqariladi:
- **bosish:** binoga batareya qoʻyish, tugmalar, halqalar;
- **sudrab qarash:** atrofga qarash;
- **yurish:** `?walk` bilan.

Qoʻl bilan boshqaruv **soxta sichqoncha hodisalarini** yuboradi (`pointerdown`, `pointermove`, `pointerup`,
`click`). Sahna, `Rig.tsx` va tugmalar oʻzgarmaydi — ular qoʻlni oddiy sichqoncha deb qabul qiladi.

| Qoʻl | Oʻyinda | Qanday ishlaydi |
|---|---|---|
| ☝️ Koʻrsatkich barmoq | Ekranda kursor (astronavt qoʻlqopi) | Barmoq uchi ekran nuqtasiga aylanadi |
| 🤏 Chimchilash yoki 1 soniya ushlab turish | Bosish | Bino, tugma, halqa bosiladi |
| ✊ Musht va qoʻlni surish | Atrofga qarash | Barmoq bilan sudrash bilan bir xil |
| ✋ Ochiq kaft (faqat `?walk` da) | Yurish | `walkInput.stick` ga yoziladi, hozirgi joystik kabi |

Nega boshqa oʻzgarish kerak emas: `Rig.tsx` sudrashni `window` dagi `pointermove` dan oladi, R3F `click` ni
oʻzi tinglaydi, DOM tugmalari esa `click` ni oladi. Hodisa `document.elementFromPoint(x, y)` ga `bubbles: true`
bilan yuboriladi: tugma ustida boʻlsa tugmaga, boʻsh joyda canvasga tushadi (`pointer-events-none` qatlamlar
oʻtkazib yuboriladi).

---

## 3. Texnologiya

**[MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker?tab=Web)**
(`@mediapipe/tasks-vision` 1.2.3, Apache-2.0). Har qoʻlda 21 nuqta topadi, hammasi qurilmaning oʻzida ishlaydi,
video hech qayerga yuborilmaydi.

Hajmlar (14.11 da oʻlchandi):

| Fayl | Hajmi |
|---|---|
| `hand_landmarker.task` (model, float16) | 7.8 MB |
| `vision_wasm_internal.wasm` | 14.7 MB (brotli bilan 3.3 MB) |
| `vision_bundle.mjs` | 0.16 MB |

Hammasi faqat kamera tugmasi bosilganda yuklanadi. Birinchi yuklanish hozirgidek ~0.42 MB gzip qoladi.

**Nega [Gesture Recognizer](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer)
emas:** modeli 8.4 MB, tayyor imolari bor (`Open_Palm`, `Closed_Fist`, `Pointing_Up`, `Thumb_Up`, `Victory`...),
lekin chimchilash yoʻq. Chimchilashni baribir oʻzimiz hisoblaymiz: bosh barmoq uchi (4-nuqta) va koʻrsatkich
barmoq uchi (8-nuqta) orasidagi masofa, kaft oʻlchamiga boʻlingan. Hand Landmarker + oʻzimizning kichik qoidalar
yengilroq va Vitest bilan testlanadi.

---

## 4. Muhim texnik nuqtalar

1. **Internetsiz ishlash.** Google CDN ishlatilmaydi, fayllar oʻz serverimizdan:
   - WASM fayllarini `scripts/copy-decoders.mjs` `public/mediapipe/` ga koʻchiradi (Draco uchun allaqachon bor).
   - PWA hozir hamma narsani birinchi tashrifda keshlaydi, chegara 8 MB (`vite.config`,
     `maximumFileSizeToCacheInBytes`). WASM 14.7 MB — shuning uchun `mediapipe/**` ni `globIgnores` ga qoʻshamiz
     va `runtimeCaching` (CacheFirst) beramiz: birinchi ishlatilganda keshga tushadi, keyin internetsiz ishlaydi.
2. **Tezlik.** Har kadrda aniqlash 60 fps sahnani sekinlashtiradi:
   - qoʻl sekundiga 15–20 marta tekshiriladi (`runningMode: "VIDEO"`, `detectForVideo`);
   - GPU ishlamasa protsessorga (CPU) oʻtiladi.

   Brauzerda iPhone uchun ishonchli oʻlchov topilmadi. Native iPhone 12 haqida bitta tekshirilmagan xabar:
   ~8 daqiqadan keyin qizib 30 dan 18 fps ga tushgan
   ([DEV](https://dev.to/diyoraharshit52/mediapipe-on-ios-what-the-docs-leave-out-22bl)). Haqiqiy qurilmada
   `?perf` bilan oʻlchash shart.
3. **Titrash.** Kursor qaltiramasligi uchun [1€ filtr](https://gery.casiez.net/1euro/). Chimchilashda ikki chegara
   (yopildi < 0.25, ochildi > 0.4, kaft oʻlchamiga nisbatan). Chimchilayotganda kursor joyida qotadi, aks holda
   `tapOnly` (10 px chegarasi) bosishni bekor qiladi.
4. **Kamera faqat HTTPS yoki `localhost` da ishlaydi.** Jonli havola (GitHub Pages) HTTPS — muammo yoʻq. Telefonda
   `npm run dev` LAN orqali (`http://192.168…`) ochilsa kamera ishlamaydi; sinov noutbukda `localhost` da.
5. **`frameloop="demand"`.** Qoʻl harakatlanayotganda `invalidate()` chaqiriladi, `WalkStick` dagidek.

---

## 5. Bolalar uchun dizayn

- **Bosish uchun ushlab turish chimchilashdan yaxshiroq.** Tadqiqotda ushlab turish (dwell) sekinroq, lekin eng
  aniq va eng kam charchatadigan usul; chimchilash tez, lekin koʻp xato qiladi va charchatadi
  ([York 2022](https://www.yorku.ca/mack/iss2022.html)). Taklif: halqa toʻlib boradigan 1 soniyalik ushlab turish
  asosiy usul, chimchilash tezkor yoʻl.
- **Qoʻl tez charchaydi** ("gorilla arm"). Kameraning faqat oʻrtadagi 60 % qismi butun ekranga moslanadi — qoʻlni
  uzoqqa choʻzish kerak emas. Barmoq bilan bosish va klaviatura doim ishlab turadi.
- **Boshida qiynalishadi** ([York 2024](https://www.yorku.ca/mack/bhci2024.html)) — 5 soniyalik koʻrgazma:
  "qoʻlingni koʻrsat".
- **Asosan noutbuk va planshet uchun.** Telefonda bir qoʻl telefonni ushlab turadi — telefonda sensorli boshqaruv
  qoladi.
- Hamma yozuvlar kalit orqali (`ui.hud.hand` va boshqalar), matnni jamoa yozadi.

---

## 6. Bolalar xavfsizligi

`CLAUDE.md`: "bola yuzi koʻrsatilmaydi, saqlanmaydi, qurilmadan chiqmaydi". Shuning uchun:
- kamera videosi **ekranda koʻrsatilmaydi**, faqat qoʻl skeleti (nuqta va chiziqlar) chiziladi;
- hech bir kadr saqlanmaydi va yuborilmaydi;
- kamera faqat bola ✋ tugmasini bosganda yoqiladi va tugma bosilsa darhol oʻchadi (`track.stop()`);
- hakamlarga: "kamera faqat qoʻl nuqtalarini koʻradi, hammasi qurilmada".

---

## 7. Fayllar (`src/walk/` kabi alohida papka)

```
src/hand/
  gestures.ts      — pure: chimchilash, musht, ochiq kaft, 1€ filtr, kamera → ekran (Vitest testlari bilan)
  tracker.ts       — kamerani yoqish, modelni dangasa yuklash, sekundiga 15–20 marta aniqlash
  bridge.ts        — soxta pointer/click hodisalarini yuborish, walkInput.stick
src/ui/play/HandCursor.tsx — qoʻlqop kursori, ushlab turish halqasi, qoʻl skeleti
src/config/features.ts     — handControl: false  (+ ?hand bilan sinash)
```

Qolgan oʻzgarishlar:
- `src/ui/Hud.tsx` ga ✋ tugmasi, kaliti `ui.hud.hand`.
- `vite.config.ts` va `scripts/copy-decoders.mjs` ga yangi fayllar.
- `CREDITS.md` ga MediaPipe (Apache-2.0, Google) va model fayli, `docs/AI-USE.md` ga bir qator.

---

## 8. Vaqt va xavflar

| Ish | Vaqt |
|---|---|
| `gestures.ts` va testlar | ~2 soat |
| Kamera va model yuklash | ~1.5 soat |
| Hodisalar koʻprigi va kursor | ~1.5 soat |
| PWA va internetsiz ishlash | ~0.5 soat |
| Noutbuk va planshetda sinash | ~1 soat |
| **Jami** | **~6–7 soat** |

**Xavflar:**
- Yakshanba 09:00 — kontent (G3), 11:00 — muzlatish (G4).
- `docs/STATUS.md` ga koʻra hozir hamma narsa qayta koʻrib chiqilyapti.
- Yangi kutubxona uchun Shoxjahon akadan ruxsat kerak.

Flag ortida boʻlgani uchun oʻyinni buzmaydi: oʻchirilsa, oʻyin avvalgidek.

**Foydasi:** 14:00 dagi mahalliy hakamlikda noutbukda qoʻl bilan oʻynab koʻrsatish katta taassurot qoldiradi.
Brauzerda kamera bilan boshqariladigan bolalar 3D oʻyini topilmadi.

---

## Manbalar

- [MediaPipe Hand Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker?tab=Web)
- [MediaPipe Gesture Recognizer](https://developers.google.com/edge/mediapipe/solutions/vision/gesture_recognizer)
- [York 2022 — havoda tanlash usullari](https://www.yorku.ca/mack/iss2022.html)
- [York 2024 — bolalar va qoʻl imolari](https://www.yorku.ca/mack/bhci2024.html)
- [1€ filtr](https://gery.casiez.net/1euro/)
- [DEV — MediaPipe iOS tajribasi](https://dev.to/diyoraharshit52/mediapipe-on-ios-what-the-docs-leave-out-22bl)
- [Codrops — Three.js va qoʻl](https://tympanus.net/codrops/2024/10/24/creating-a-3d-hand-controller-using-a-webcam-with-mediapipe-and-three-js/)
- [Engadget — Nex Playground](https://www.engadget.com/gaming/the-nex-playground-is-everything-xbox-kinect-wanted-to-be-133000397.html?src=rss)
- [Tom's Guide — Nex Playground](https://www.tomsguide.com/gaming/this-gadget-is-like-a-wii-without-the-controllers-and-my-kid-loves-it)
- [Hand Tracking Games](https://gh.r-mj.com/ali-ezz/hand-tracking-games) ·
  [Brick breaker](https://hn.svelte.dev/item/42733905) ·
  [Hand Gesture Puzzle](https://chettra.is-a.dev/projects/hand-gesture-puzzle/)
