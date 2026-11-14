# Состояние HOME BY SEVEN — сб 14.11.2026, ~15:00 (Ташкент)

Файл для новой сессии: прочитать первым, потом `CLAUDE.md`, `docs/PLAN.md`, `docs/TASKS.md`, `docs/REVIEW.md`.

## Что это

Браузерная игра для детей 7–14 на NASA Space Apps 2026 («Build a Junior Astronaut Mission Trainer»), команда
Astrakarvan (Ташкент, на сайте ASTRAVAN). Неделя на базе у южного полюса Луны, вид из шлема; Солнце, буря и Земля —
настоящая неделя из данных NASA, дата раскрывается в конце. Главный документ команды — итоговая версия
(*HOME_BY_SEVEN_yakuniy_versiya.pdf*, лежит в `E:\Downloads\Telegram Desktop\`); остальные PDF — в корне `E:\astravan`
(не в git). Репозиторий: https://github.com/Shokhanasser1/astravan-nasa-space-app-challenge (публичный),
запасная ссылка игры: https://shokhanasser1.github.io/astravan-nasa-space-app-challenge/

## Ворота

G2 сб 20:00 — семь дней в 3D на телефоне · G3 вс 09:00 — контент · G4 вс 11:00 — заморозка ·
G5 вс 13:00 — отправлено (местное судейство 14:00). Тесты, e2e и `./shot.sh` на трёх устройствах — вс 08:00.

## Кто что делает

| Кто | Дорожка |
|---|---|
| Самандар | движок `src/engine`, состояние `src/state` — **не пушил ни разу** |
| Шохжахон-ака (пользователь) | сцена `src/scene`, звук `src/audio`; владелец `package.json`, `CLAUDE.md` |
| Асилбек | интерфейс шлема `src/ui` — запушил только `docs/HOME-BY-SEVEN-PROMPTS.md` (старый 2D-бриф) |
| Сарвар | 3D-модели `public/models` — не пушил |
| Аминжон | слова, голос, питч, страница проекта — не пушил |
| **Вторая сессия Claude** (пользователя) | по решению пользователя ведёт движок, состояние и данные; работает в этой же папке |
| Эта сессия Claude | сведение исследований, проверка пушей команды, документы, тесты/CI |

## Что в репозитории (сделано)

- Стек: Vite 8, React 19, TS 7, three 0.187 + R3F 9 + drei 10 + postprocessing, PWA, Vitest, Playwright; CI
  (`npm run verify` → деплой на Pages; VPS — когда будут секреты).
- `CLAUDE.md` + `.claude/rules/*` + 14 навыков в `.claude/skills/`; строки по дорожкам `src/i18n/<lang>/<lane>.json`.
- Документы: `PLAN.md` (порядок 0–9 итоговой версии по ролям), `TASKS.md` (задачи каждому), `REVIEW.md` (сверка
  с гайдами 2026, риски, 10 предложений), `REFERENCES.md`, `rules.md`, `layout.md`, `ARCHITECTURE.md`, `STACK.md`.
- Данные: `src/engine/sky.json` (неделя 2021-10-25), медиа недели 1 в `public/data/media/2021-10-25/`
  (SDO до и в пик X1.0, без даты на снимке; Земля GIBS ×7; 893 КБ; `manifest.json`), скрипты `scripts/data/donki.mjs`,
  `fetch_media.py` (+ тесты). Спецификации — `docs/specs/`, планы — `docs/plans/`.

## Не закоммичено (работа второй сессии — не трогать без пользователя)

~58 изменённых/новых файлов: порт движка (`rules.ts`, `golden.ts`, `rules.test.ts`), `weeks.json` (14 недель
RadLab + DONKI) и `scripts/data/weeks.mjs`, reducer, сцена от первого лица (`Rig.tsx`, `points.ts`, `parts/`…),
интерфейс (`src/ui/play/`), правки правил и навыков, `.claude/rules/integration.md`.

## Открыто

1. Пуши команды: Самандар, Сарвар, Аминжон — ничего; проверить, что у них проходит `git push`.
2. Вопросы к Local Lead (Аминжон): нарисованные ИИ дети (Зухра) — можно ли; модели из Tripo/Hunyuan3D — не мешает
   ли проверке на китайские организации. Оба пункта — наша трактовка, не цитата гайда.
3. Строки для переписывания (`REVIEW.md` §2): «NASA took this picture» → «The SDO spacecraft took this picture» и др.
4. Письмо школы/учителя (Impact) — никто не взял (предложено Аминжону).
5. Предложение П3: недели 2025–2026 через iSWA CRaTER (буря S4 янв. 2026, неделя Artemis II) — дорожка данных, после G2.
6. 7-й день недели 2021-10-25 измерен 15 ч → «частично измерено».
7. VPS не настроен (`docs/SERVER.md`); для судей ссылка github.io; для домена — заявка FortiGuard.

## Полезное

- Сайт Space Apps: `curl --cacert /mingw64/etc/ssl/certs/ca-bundle.crt`; гайды 2026 рендерятся только в браузере
  (Playwright); сохранённые тексты — `shots/sa-guides/` (git-ignored).
- DONKI: только CCMC (`npm run donki`); ключ NASA — в `scripts/data/.env` (git-ignored), работает для других API.
- Процесс пользователя: сначала спецификация, потом план и TDD; в отчётах отделять цитату от своей трактовки.
