---
name: e2e-testing
description: Writing, running or debugging Playwright end-to-end tests in HOME BY SEVEN (the e2e/ directory), including flaky tests, selectors, 360x640 layout checks, raw i18n key checks and canvas/WebGL behavior.
---

# E2E tests (Playwright, `e2e/`)

Setup: `playwright.config.ts`. Run `npx playwright install chromium` once, then `npm run e2e`.
`webServer` runs `npm run build` and serves it with `vite preview` on port 4173. Locally an already running server is
reused, so rebuild after code changes. Tests use `page.goto('/?week=2021-10-25')` (baseURL is set), never a full URL.

Projects: `phone` (Pixel 7, touch) and `laptop` (1366x768). Phone first. 60 s timeout per test; retries are 1 on CI
and 0 locally; trace and video are kept on failure (`npx playwright show-trace <trace.zip>`).
Reference test: `e2e/smoke.spec.ts` (plays the first mission to the truth screen).

One test: `npx playwright test e2e/smoke.spec.ts --project=phone -g "<part of title>"`. Debug: `--headed` or `--debug`.

## Selectors

- Use `getByTestId` (`data-testid`) or `getByRole` with a name that is not English wording.
- Never select by English text or by raw i18n keys. Player text is written later by humans, so keys disappear and
  wording changes. Tests must depend on neither.
- Current hooks: `grep -rn data-testid src/ui` (e.g. `day-badge`, `gauge-energy`, `radio`, `card`, `machines`,
  `night-log`, `shelter`, `warning`, `truth`, `truth-title`). Assert state through attributes (`data-title`,
  `disabled`, `aria-*`), not visible words.
- Need a hook that does not exist? Add the `data-testid` in `src/ui/` yourself (lane D, Asilbek — tell him).

## Required checks

1. No raw keys on screen once human text exists:
   ```ts
   const text = await page.locator('body').innerText();
   expect(text.match(/\b(ui|scene|story|engine|data)\.[a-zA-Z0-9.]+\b/g) ?? []).toEqual([]);
   ```
   Run it in en, uz and ru. It fails by design while values are still empty; keep it out of the default run until
   lane F has filled the words.
2. 360x640 layout in each language. The language is read from localStorage key `hb7:lang` (JSON string), so set it
   before load:
   ```ts
   await page.addInitScript((l) => localStorage.setItem('hb7:lang', JSON.stringify(l)), 'uz');
   await page.setViewportSize({ width: 360, height: 640 });
   await page.goto('/?week=2021-10-25');
   const overflow = await page.evaluate(
     () => document.documentElement.scrollWidth > document.documentElement.clientWidth);
   expect(overflow).toBe(false);
   ```
   Uzbek and Russian run about 30 % longer than English: layouts grow, they never truncate or overflow.
3. Page errors: collect `page.on('pageerror')` and assert the list is empty at the end.

## Canvas and WebGL

- Normal run: assert the canvas is visible (`expect(page.locator('canvas')).toBeVisible()`). Do not assert pixels
  or 3D content; headless WebGL is software-rendered and slow.
- No-WebGL run (required by `.claude/rules/ui.md`): make WebGL unavailable before load, assert there is **no**
  canvas, then play the week to the truth screen through the DOM:
  ```ts
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    // @ts-expect-error narrow override for this test only
    HTMLCanvasElement.prototype.getContext = function (type: string, ...a: unknown[]) {
      return /webgl/.test(type) ? null : get.call(this, type, ...a);
    };
  });
  ```
- The game must stay playable through the DOM layer (buttons, tablet, gauges). Drive it with DOM clicks, not canvas
  coordinates.
- `./shot.sh '<view json>'` is the complement: screenshots of scene states plus printed draw calls and triangles
  (budgets in `.claude/rules/three.md`). E2E proves the flow works; `shot.sh` proves the picture and the GPU cost.

## Flaky tests

- No `waitForTimeout` or fixed sleeps. Use polling assertions (`await expect(locator).toBeVisible()`,
  `toHaveAttribute`, `toContainText`) and `expect.poll(...)` for computed values.
- Loops that click through days need an iteration cap and must end on an assertion (see the 80-iteration loop in
  `smoke.spec.ts`).
- Each test starts from `page.goto`; do not share state between tests. If a test sees stale UI, suspect an old build
  in preview or a cached service worker: rebuild first.
- A test that passes only on retry is still a bug. Open the trace; do not raise `retries`.
- The game makes no NASA calls and sends no child data; an unexpected external request in a test is a bug to report.

## Before saying "done"

Run `npm run e2e` (both projects) and read the output. `npm run verify` does not include e2e.
