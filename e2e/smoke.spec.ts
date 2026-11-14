import { expect, test } from '@playwright/test';

// G2 gate in code: the game loads without errors and seven days can be played to the truth screen.
// Update the selectors when the real screens replace the placeholders (they show i18n keys until text is written).
test('loads, starts and plays seven days', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?week=2021-10-25');
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByRole('button', { name: 'ui.start.mission' }).click();

  const again = page.getByRole('button', { name: 'ui.end.again' });
  for (let i = 0; i < 60 && !(await again.isVisible()); i++) {
    const confirm = page.getByRole('button', { name: 'ui.board.confirmDay' });
    await ((await confirm.isVisible()) ? confirm : page.getByRole('button', { name: 'ui.hud.next' })).click();
  }
  await expect(again).toBeVisible();
  expect(errors).toEqual([]);
});
