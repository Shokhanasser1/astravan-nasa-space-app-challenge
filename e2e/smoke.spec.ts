import { expect, test, type Page } from '@playwright/test';
import { features } from '../src/config/features';

/**
 * The mission quiz (features.quiz): answers are tried in order until one is right (a wrong one shows why and
 * "Try again"), then Next; the debrief ends with the "next mission" card. Returns the kinds of questions asked.
 */
async function passQuiz(page: Page): Promise<string[]> {
  const quiz = page.getByTestId('quiz');
  const asked: string[] = [];
  for (let n = 0; n < 30 && (await quiz.isVisible()); n++) {
    if (await page.getByTestId('quiz-finish').isVisible()) {
      await page.getByTestId('quiz-finish').click();
      break;
    }
    if (await page.getByTestId('quiz-next').isVisible()) {
      await page.getByTestId('quiz-next').click();
      continue;
    }
    if (await page.getByTestId('quiz-retry').isVisible()) {
      await page.getByTestId('quiz-retry').click();
      continue;
    }
    const template = (await page.getByTestId('quiz-question').getAttribute('data-template')) ?? '';
    if (asked[asked.length - 1] !== template) asked.push(template); // (a retry shows the same question again)
    // every retry turns the answers one place, so the first button is always an answer not tried yet
    await quiz.locator('[data-testid^="quiz-option-"]').first().click();
  }
  await expect(quiz).toBeHidden();
  return asked;
}

// G2 gate in code: the first mission loads without errors and seven days can be played to the truth screen,
// driven only through the DOM layer (works without WebGL). Selectors are data-testid only — never words or keys.
test('loads, starts and plays the first mission to the truth screen', async ({ page }) => {
  // A whole week with the 3D scene drawn in software (SwiftShader, no GPU): ~55 s at laptop size before ASTRA's
  // base (15 Nov), more with it (a laptop run on a busy machine reached Day 6 at 120 s, so 180 s). Real phones and
  // laptops draw on the GPU; their speed is checked with ?perf.
  // (+ the mission quiz on some nights and the 1.3 s radio delay, 15 Nov: a laptop run reached Day 7 at 180 s → 300 s)
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/?week=2021-10-25');
  // The intro film on entering the site (features.introVideo): Skip is always on screen.
  if (features.introVideo) await page.getByTestId('intro-skip').click({ timeout: 15_000 }).catch(() => {});
  await expect(page.locator('canvas')).toBeVisible();
  await page.getByTestId('start-mission').click();

  const truth = page.getByTestId('truth');
  // The first mission opens with the Day 1 tutorial: its task line is on screen, and it never blocks a button. With
  // the home story's crash start its first step is the walk to the base light (`reach`); Next skips the walk, so the
  // week below plays without walking, through the "IMPACT" intro (it never takes a pointer).
  const crash = features.homeStory && features.homeStoryCrash;
  await expect(page.getByTestId('task')).toHaveAttribute('data-step', crash ? 'reach' : 'next');
  // CAPCOM's first line travels from Earth first (the 1.3 s radio delay), then shows its words.
  await expect(page.getByTestId('radio')).toBeVisible();
  await expect(page.getByTestId('radio-delay')).toBeHidden({ timeout: 5000 });
  const asked: string[] = [];
  for (let i = 0; i < 100 && !(await truth.isVisible()); i++) {
    // A radio check on some nights (features.quiz): answer it, then the night goes on.
    if (await page.getByTestId('quiz').isVisible()) {
      asked.push(...(await passQuiz(page)));
      continue;
    }
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
      // Day 7 (home story): the ship does not charge itself — its four batteries first (a press on a full ship
      // does nothing). The launch button may warn first ("only n% ready"); the next pass presses it again.
      const ship = page.getByTestId('machine-launch-add');
      if ((await ship.isVisible()) && (await ship.isEnabled())) await ship.click();
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
  await expect(page.getByTestId('truth-title')).not.toHaveAttribute('data-title', 'Late Ride Home'); // the ship flew
  // The real Earth (EPIC) and Moon (SVS Dial-A-Moon) of the storm day: public/data/media/2021-10-25/manifest.json.
  await expect(page.getByTestId('home-truth')).toBeVisible();
  // The datasets behind the week, the "not an official NASA product" line, and day 7's partly measured mark (15 h).
  await expect(page.getByTestId('truth-sources')).toBeAttached();
  await expect(page.getByTestId('not-nasa')).toBeAttached();
  await expect(page.getByTestId('truth-partly')).toContainText('7');
  await page.screenshot({ path: test.info().outputPath('truth.png'), animations: 'disabled' });
  // 360×640: the reveal is taller than the screen, so the panel stays inside it and scrolls (Play again reachable).
  await page.setViewportSize({ width: 360, height: 640 });
  const box = await truth.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(640);
  expect(await truth.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
  await page.getByTestId('again').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('again')).toBeInViewport();
  // Three radio checks came on nights 2, 4 and 6; the debrief (three more) opens the next mission.
  expect(asked).toHaveLength(3);
  await expect(page.getByTestId('again')).toHaveAttribute('data-quiz', 'pending');
  await page.getByTestId('again').click();
  const debrief = await passQuiz(page);
  expect(debrief).toHaveLength(3);
  expect(new Set([...asked, ...debrief]).size).toBe(6); // never the same kind of question twice
  await expect(truth).toBeHidden();
  expect(errors).toEqual([]);
});
