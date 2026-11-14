import { expect, test } from '@playwright/test';

// G2 gate in code: the game loads without errors and seven days can be confirmed to the truth screen.
// Update the selectors when the real screens replace the placeholders.
test('loads, starts and plays seven days', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?week=2021-10-25');
  await expect(page.locator('canvas')).toBeVisible();

  await page.getByRole('button', { name: 'title.start' }).click();
  for (let day = 1; day <= 7; day++) {
    await page.getByRole('button', { name: 'board.confirmDay' }).click();
  }
  await expect(page.getByRole('button', { name: 'end.again' })).toBeVisible();
  expect(errors).toEqual([]);
});
