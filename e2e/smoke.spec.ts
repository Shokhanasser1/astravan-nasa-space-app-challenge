import { expect, test } from '@playwright/test';

// G2 gate in code: the first mission loads without errors and seven days can be played to the truth screen,
// driven only through the DOM layer (works without WebGL). Selectors are data-testid only — never words or keys.
test('loads, starts and plays the first mission to the truth screen', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?week=2021-10-25');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByTestId('start-mission').click();

  const truth = page.getByTestId('truth');
  for (let i = 0; i < 80 && !(await truth.isVisible()); i++) {
    const confirm = page.getByTestId('confirm-day');
    if (await confirm.isVisible()) {
      // a day card must be answered first: take the first choice
      if (await confirm.isDisabled()) await page.getByTestId('card').getByRole('button').first().click();
      // batteries on Life Support so the reserve never runs out
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
  await page.getByTestId('truth').screenshot({ path: test.info().outputPath('truth.png') });
  // 360×640: the reveal is taller than the screen, so the panel stays inside it and scrolls (Play again reachable).
  await page.setViewportSize({ width: 360, height: 640 });
  const box = await truth.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(640);
  expect(await truth.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
  await page.getByTestId('again').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('again')).toBeInViewport();
  expect(errors).toEqual([]);
});
