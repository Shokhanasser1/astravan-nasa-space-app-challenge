import { expect, test } from '@playwright/test';

// G2 gate in code: the first mission loads without errors and seven days can be played to the truth screen,
// driven only through the DOM layer (works without WebGL). Selectors are data-testid only — never words or keys.
test('loads, starts and plays the first mission to the truth screen', async ({ page }) => {
  // A whole week with the 3D scene drawn in software (SwiftShader, no GPU): ~55 s at laptop size before ASTRA's
  // base (15 Nov), more with it (a laptop run on a busy machine reached Day 6 at 120 s, so 180 s). Real phones and
  // laptops draw on the GPU; their speed is checked with ?perf.
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?week=2021-10-25');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByTestId('start-mission').click();

  const truth = page.getByTestId('truth');
  // The first mission opens with the Day 1 tutorial: its task line is on screen, and it never blocks a button.
  await expect(page.getByTestId('task')).toHaveAttribute('data-step', 'next');
  for (let i = 0; i < 100 && !(await truth.isVisible()); i++) {
    // The day's decision (day card, shelter) is its own dialog: take the first choice.
    const decision = page.getByTestId('decision');
    if (await decision.isVisible()) {
      await decision.locator('[data-testid^="card-"], [data-testid^="shelter-"]').first().click();
      continue;
    }
    const confirm = page.getByTestId('confirm-day');
    if (await confirm.isVisible()) {
      // a day card must be answered first: the Decision button opens the dialog again
      if (await confirm.isDisabled()) {
        await page.getByTestId('decision-open').click();
        continue;
      }
      // The plan list never opens by itself (15 Nov): open it, then batteries on Life Support so the reserve
      // never runs out (the list is the DOM way to play without walking, and without WebGL).
      if (!(await page.getByTestId('plan-tablet').isVisible())) await page.getByTestId('tablet-open').click();
      await expect(page.getByTestId('resources')).toBeVisible();
      const add = page.getByTestId('machine-ls-add');
      while (await add.isEnabled()) await add.click();
      await confirm.click();
    } else {
      await page.getByTestId('next').click();
    }
  }
  await expect(truth).toBeVisible();
  await expect(page.getByTestId('truth-dates')).toContainText('2021-10-25');
  await expect(page.getByTestId('truth-title')).toHaveAttribute('data-title', /.+/);
  // The real Earth (EPIC) and Moon (SVS Dial-A-Moon) of the storm day: public/data/media/2021-10-25/manifest.json.
  await expect(page.getByTestId('home-truth')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('truth.png'), animations: 'disabled' });
  // 360×640: the reveal is taller than the screen, so the panel stays inside it and scrolls (Play again reachable).
  await page.setViewportSize({ width: 360, height: 640 });
  const box = await truth.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(640);
  expect(await truth.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
  await page.getByTestId('again').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('again')).toBeInViewport();
  expect(errors).toEqual([]);
});
