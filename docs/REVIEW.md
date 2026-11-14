# Сверка: наши наработки × документы команды × свежие правила (14.11.2026)

Спецификация: `docs/specs/2026-11-14-reconcile-review.md`. Всё, что ниже помечено «проверено», проверено сегодня
по первоисточнику. Ни один пункт не меняет решений итоговой версии без пометки.

## 0. Десять действий, по порядку пользы

| # | Что сделать | Кто | Когда | Зачем |
|---|---|---|---|---|
| 1 | Переписать рискованные строки (§2) | Аминжон, Асилбек | до G3 | Правила NASA про ИИ и атрибуцию |
| 2 | Видео и демо без реальных детей (проба с детьми не в кадре); про нарисованных ИИ детей (Зухра) — спросить Local Lead | Аминжон, Асилбек | сейчас | Гайд 2026: нельзя «likeness to persons under 18»; распространяется ли на нарисованных персонажей — наша трактовка, не цитата |
| 3 | Осторожность: Tripo и Hunyuan3D — спросить Local Lead, пока брать Meshy / NASA / Kenney / код | Сарвар | сейчас | Гайд 2026 проверяет «bilateral activity» с китайскими организациями; относится ли к покупке сервиса — наша трактовка, не цитата |
| 4 | На странице и в питче: ядро игры — **DONKI и RadLab**, два ресурса, названных в самой задаче; плюс ресурс CSA «Food production on the Moon» | Аминжон | до G5 | Relevance 5 = «данные NASA — ядро, а не украшение» |
| 5 | Честное поле «Use of SI»: идея и решения команды, ИИ — исследование, черновики документов, код, графика | Аминжон | до G5 | Гайд 2026: SI не должен придумывать идею |
| 6 | Пометка ИИ в коде, данных и озвучке: README, CREDITS, страница «Данные» | Claude | сегодня | Гайд 2026: код, данные, аудио — пометка в тексте и метаданных |
| 7 | Добавить недели 2025–2026 через iSWA CRaTER: буря ноября 2025, буря S4 января 2026, неделя облёта **Artemis II** (апрель 2026) | дорожка данных | после G2 | Самое сильное «это было в этом году» для судей |
| 8 | Для ★ и ★★ показывать «8 из 10 остановлено», а не «77 %» | Асилбек | после G2 | Дети понимают частоты лучше процентов |
| 9 | Ссылка «Final Project» — на github.io; для домена VPS подать заявку FortiGuard | Шохжахон-ака | вс до 11:00 | Гайд 2026: новые сайты могут блокироваться у судей |
| 10 | 7-й день недели 25.10.2021 измерен 15 ч — показать «частично измерено» | Самандар (данные), Асилбек (метка) | до G3 | Честность данных |

## 1. Перепроверено сегодня

**Гайд подачи проекта 2026** (опубликован 13.11) — https://www.spaceappschallenge.org/resources/project-submission-guide/
- Подача: сб 14.11 09:00 — вс 15.11 23:59 по местному времени; часы местного судейства уточнять у Local Lead
  (Ташкент судит в 14:00 — наш срок 13:00 остаётся).
- Демо: видео **≤ 30 с** или **≤ 7 слайдов**; «Projects that exceed these limits will not be eligible for Global Judging».
  Видео можно на другом языке, но **с английскими субтитрами**; страница и материалы — на английском.
- Super Intelligence (так теперь называют ИИ): «SI should not be used to come up with your idea»; созданное ИИ
  не может содержать «NASA logos, flags, or mission identifiers»; картинки и видео — **видимый водяной знак**;
  **аудио, код и данные — пометка в описании и в метаданных**. Ответ в поле SI судьи не видят, но видят пометки в проекте.
- «Project demonstrations and final projects may not include any images, video, audio, or other likeness to persons
  under 18 years old.»
- Для нового сайта рекомендуют заявку **FortiGuard Web Filter Classification**, чтобы судьи могли его открыть.
- Картинки на странице — до 10 МБ; видео и документы — только ссылкой без входа. Есть «замок» редактирования.

**Гайд судейства 2026** — https://www.spaceappschallenge.org/resources/judging-awards-guide/
- Пять критериев 1–5. **Relevance 5:** «NASA data is integral… a core component… rather than a superficial addition».
  **Validity 5:** научно обоснован, технически реализуем, «highly usable and user-friendly».
- Галочки при подаче: «original work» и все внешние ресурсы — в поле References.
- Проверка на «prohibited bilateral activity with China, or a Chinese-owned entity».
- Даты: Global Nominees 3.12, Finalists 17.12, Winners **26.01.2027**. Десять наград, включая Best Use of Data,
  Best Storytelling, Most Inspirational, **Local Impact**.

**Вкладка Resources нашей задачи** — https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/?tab=resources
- NASA: Open APIs, **DONKI**, OSDR, **RadLab** (dosimetry database), Mars Trek.
- CSA (партнёр): ресурсы STEM для детей и «**Food production on the moon and in remote areas**»
  (https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/) — это наш лунный сад.

**Данные**
- DONKI через CCMC — работает; через api.nasa.gov — 404 (проверено, ключ при этом рабочий).
- `weeks.json` собран из RadLab + DONKI (14 недель; уровни недели 25.10.2021 — 0 0 0 1 2 2 1, как в концепции v2).
- **CRaTER через iSWA доступен до 07.10.2026**, включая апрель 2026 (проверен запрос за 02.04.2026) —
  https://iswa.gsfc.nasa.gov/IswaSystemWebApp/hapi/info?id=CRaTER. RadLab заканчивается июнем 2024.
- SDO и GIBS — скачаны сегодня для недели 1 (`public/data/media/2021-10-25/`).
- **Доза экипажа Artemis II официально не опубликована**: DLR обещал результаты M-42 EXT «shortly» —
  https://www.dlr.de/en/latest/news/2026/artemis-ii-launches-to-the-moon-with-german-and-european-tech-on-board;
  цифра «≈12 мЗв» встречается только в неподтверждённой новости — не использовать.
- Tripo принадлежит VAST (Пекин), Hunyuan3D — Tencent (источники в конце).

## 2. Убрать или переписать

| Где | Строка | Почему рискованно | Замена (слова пишет команда) |
|---|---|---|---|
| Концепция 3.0 §03, момент 5 (Скаут) | «This is not a drawing. NASA took this picture.» | Правила NASA для ИИ-продуктов: нельзя приписывать информацию NASA напрямую | «This is not a drawing. The SDO spacecraft took this picture.» |
| Итоговая версия / 3.0 §06, правда | «Photographed by NASA's SDO.» / «NASAʼning SDO apparati suratga olgan» | То же | «Photographed by the SDO spacecraft.» / «SDO apparati suratga olgan» |
| 3.0, обложка | «Har bir kadri NASA oʻlchoviga tayanadi» | Близко к запрещённому «всё реально» | «Boʻronning har soati oʻlchangan» |
| Дизайн 2.0, трейлер; промпты Асилбека (Зухра, «ребёнок со спины») | Дети в ИИ-картинках и видео | Гайд 2026: никакой «likeness» лиц младше 18 в демо и проекте | Взрослый астронавт и Буви в кадре; Зухра — голос за кадром (взрослый) или без изображения. Уточнить у Local Lead |
| Любые ИИ-картинки и видео | Флаги на скафандрах, «NASA», «Artemis», нашивки миссий | Гайд 2026: «no NASA logos, flags, mission identifiers» | В каждый промпт: «no text, no logos, no flags, no mission patches» + видимый знак «AI» |
| 3D-руководство | Tripo H3.1, Hunyuan3D | Компании из Китая; гайд 2026 проверяет «bilateral activity» с китайскими организациями (применимо ли к сервису — уточнить у Local Lead) | Meshy, NASA 3D Resources, Kenney/Quaternius (CC0) или фигуры в коде (ASTRA показала, что этого хватает) |
| Концепция 3.0 §09, «Bu hujjat haqida» | «AI yordamida (Claude) tayyorlandi» — про концепцию | Гайд 2026: SI не должен придумывать идею | В поле SI честно: что придумала команда и в чём помогал ИИ. Ничего не скрывать и не приукрашивать |
| План воскресенья, видео | Проба с детьми в кадре | Нельзя изображения, видео, голос детей | В видео — только экран игры и взрослые |
| Руководство разработчиков | Хостинг Vercel или Netlify | У Vercel защита по умолчанию показывает судье вход | GitHub Pages (работает) + VPS |
| Документы команды | «Nothing after June 2024» | Устарело: iSWA даёт CRaTER до октября 2026 | См. предложение П3 |

## 3. Уроки критиков: что HOME BY SEVEN уже закрыл

Пять критиков оценивали прошлые версии (v3 — 58, v7 — 84 из 100; по рубрике NASA: Impact 3, Creativity 4,
Validity 3, Relevance 4, Presentation 4). Что они требовали для пятёрок (`idea_v7_RU.md`):

| Требование критиков | В HOME BY SEVEN | Что ещё открыто |
|---|---|---|
| Relevance → 5: данные должны решать исход, метод опубликован | Уровни бури из измерений CRaTER, неделя раскрывается в конце, страница «Данные» с четырьмя ярлыками | Сказать на странице, что DONKI и RadLab — ресурсы самой задачи; ссылка на метод |
| Impact → 4: тот же вопрос до и после + внешнее обязательство (письмо школы или учителя) | Три вопроса до/после — в плане | **Письмо от школы или учителя (Space Edu)** — пока никто не взял. Аминжон |
| Validity → 4: дети играют сами на хакатоне | Проба в вс 09:00–11:00 | Честно опубликовать числа: «из N детей до — x, после — y» |
| Снимки SDO внутри сборки | Сделано (неделя 1) | Остальные недели — после `weeks.json` |
| Пометка об ИИ на странице и в репозитории | `docs/AI-USE.md` | Пометка в README/CREDITS для кода, данных, озвучки (действие 6) |
| Не перегружать систему (v3: «4 мира, 12 заданий» — 58 баллов) | Три показателя, одна база | Не возвращать карту и модули до G3 |

## 4. Что из наших исследований стоит добавить

1. **Частоты вместо процентов** для детей: «из 10 частиц 8 остановлены», «так бывает 2 недели из 20»
   (исследование Gigerenzer: с частотами 4-классники решали в разы лучше, ссылка в `docs/REFERENCES.md` §6).
2. **«Громкая буря ≠ опасная буря».** Январь 2026 — S4 по шкале NOAA, но мягкий; ноябрь 2025 — S3, но жёсткий
   (поток ≥ 100 МэВ из GOES). Для ★★★ и для питча; требует недель 2025–2026 (П3).
3. **Частицы приходят не всегда и не сразу**: от пика вспышки до порога проходило от 16 минут до 17 часов —
   основа «часа тишины» 4-го дня и предсказания T4 (данные DONKI).
4. **Цели касания ≥ 2 см, инструкции называют цель, а не кнопку** (NN/g) — уже в правилах интерфейса.
5. **Не больше трёх вспышек в секунду** (Game Accessibility Guidelines) — уже в правилах сцены.

## 5. Новые предложения (польза ÷ часы)

| П | Что | Часы | Кто | Ворота | Если не успели |
|---|---|---|---|---|---|
| П1 | Строка на странице и в питче: «Built on two of the challenge's own resources — NASA DONKI and RadLab (LRO CRaTER)» + CSA Food production в поле партнёров | 0,5 | Аминжон | до G5 | — |
| П2 | Переписать строки из §2 | 1 | Аминжон, Асилбек | до G3 | Убрать строки целиком |
| П3 | Недели 2025–2026 из iSWA CRaTER: 10.11.2025 (жёсткая S3), 18.01.2026 (S4, сильнейшая с 2003), неделя Artemis II (1–7.04.2026, тихая); «выбери свой день» до октября 2026. Формат `weeks.json` тот же, движок не меняется | 1,5 | дорожка данных | после G2 | Только в питче: «следующая версия — недели 2026 года» |
| П4 | Частоты для ★/★★ на экране правды | 1 | Асилбек | после G2 | Проценты остаются для ★★★ |
| П5 | Модели не из Tripo/Hunyuan3D | 0 | Сарвар | сейчас | Серые фигуры |
| П6 | Никаких детей в ИИ-контенте и видео; поле SI честно | 0,5 | Аминжон, Асилбек | сейчас | — |
| П7 | Пометка SI для кода/данных/озвучки (README, CREDITS, «Данные»: «narration: device text-to-speech») | 0,25 | Claude | сегодня | — |
| П8 | FortiGuard для домена VPS; в поле Final Project — github.io | 0,5 | Шохжахон-ака | вс до 11:00 | Только github.io |
| П9 | Письмо школы или учителя о том, что игру будут использовать (Space Edu) | 0,5 | Аминжон | до G5 | Строка в питче о планах внедрения |
| П10 | Доза экипажа Artemis II рядом с CRaTER | — | — | после хакатона | Ждать публикации DLR/NASA |

## Источники

- Project Submission Guide 2026: https://www.spaceappschallenge.org/resources/project-submission-guide/
- Judging & Awards Guide 2026: https://www.spaceappschallenge.org/resources/judging-awards-guide/
- Challenge Resources: https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/?tab=resources
- RadLab data API: https://visualization.osdr.nasa.gov/radlab/gui/data-api/
- iSWA CRaTER: https://iswa.gsfc.nasa.gov/IswaSystemWebApp/hapi/info?id=CRaTER
- CSA Food production on the Moon: https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/
- DLR, Artemis II and M-42 EXT: https://www.dlr.de/en/latest/news/2026/artemis-ii-launches-to-the-moon-with-german-and-european-tech-on-board
- Mirion, crew dosimeters on Artemis II: https://www.mirion.com/discover/knowledge-hub/articles/stories/from-ram-to-cad-the-evolution-of-astronaut-radiation-monitoring-through-artemis-ii
- Unverified Artemis II dose claim (do not use): https://healthwireusa.com/artemis-ii-crew-space-radiation-exposure-data-questions/
- Tripo / VAST: https://scmp.com/tech/tech-trends/article/3323106/ex-minimax-co-founders-new-venture-aims-challenge-tencent-and-google-3d-ai-models
- Hunyuan3D / Tencent: https://www.bloomberg.com/news/articles/2025-03-18/tencent-touts-open-source-ai-models-to-turn-text-into-3d-visuals
- Critics' rounds: `E:\portfolio\hackaton\docs\idea_v7_RU.md`; our research summary: `Oy karvonsaroyi итоговый свод команды.md`
