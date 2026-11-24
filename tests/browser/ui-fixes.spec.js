import { test, expect } from '@playwright/test';
import { registerLogin } from './helpers.js';
test('comments, highest score labels and responsive six-card layout', async ({ page }) => {
  await registerLogin(page, 'UIFixQA');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('#best-score-song')).toHaveText('No completed scores yet');
  await page.getByRole('button', { name: 'Song Selection', exact: true }).click();
  await expect(page.locator('[data-song-id="yuusha"] h2')).toHaveText('Yuusha');
  await expect(page.getByText('Yuusha (TV Size)', { exact: true })).toHaveCount(0);
  for (const width of [1100, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.locator('[data-song-id]').evaluateAll((cards) =>
      cards.map((c) => {
        const box = c.getBoundingClientRect(),
          select = c.querySelector('[data-select-song]').getBoundingClientRect(),
          trophy = c.querySelector('[data-song-board]').getBoundingClientRect();
        return {
          top: box.top,
          bottom: box.bottom,
          height: box.height,
          selectX: select.x,
          trophyX: trophy.x,
          right: box.right,
        };
      }),
    );
    expect(layout).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(Math.abs(layout[i].selectX - layout[0].selectX)).toBeLessThan(1);
      expect(Math.abs(layout[i].trophyX - layout[0].trophyX)).toBeLessThan(1);
      expect(Math.abs(layout[i].height - layout[0].height)).toBeLessThan(1);
      expect(layout[i].right).toBeLessThanOrEqual(width);
      if (i) expect(layout[i].top - layout[i - 1].bottom).toBeCloseTo(14, 0);
    }
    await page.screenshot({ path: 'artifacts/song-cards-' + width + '.png', fullPage: true });
  }
  await page.setViewportSize({ width: 1100, height: 720 });
  await page.evaluate(async () => {
    const api = await import('/src/firebase/service.js'),
      { auth } = await import('/src/firebase/client.js');
    await api.saveScore(api.newScoreId(), auth.currentUser, 'UIFixQA', {
      score: 1000,
      maxCombo: 1,
      perfect: 1,
      good: 0,
      miss: 47,
    });
  });
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('#best-score-song')).toHaveText('Normal');
  await page.evaluate(async () => {
    const api = await import('/src/firebase/service.js'),
      { auth } = await import('/src/firebase/client.js');
    await api.saveScore(
      api.newScoreId(),
      auth.currentUser,
      'UIFixQA',
      { score: 2000, maxCombo: 2, perfect: 2, good: 0, miss: 811 },
      'yuusha',
      'med',
    );
  });
  await expect(page.locator('#best-score')).toHaveText('2,000');
  await expect(page.locator('#best-score-song')).toHaveText('Med');
  await page.getByRole('button', { name: 'Song Selection', exact: true }).click();
  await page.getByRole('button', { name: 'Yuusha leaderboard', exact: true }).click();
  await expect(page.locator('.song-panel h2')).toHaveText('Yuusha');
  await page.getByLabel('Leaderboard difficulty').selectOption('med');
  const row = page.locator('#scores tr').filter({ hasText: 'UIFixQA' });
  await row.getByRole('button', { name: 'Like UIFixQA', exact: true }).click();
  await row.getByRole('button', { name: 'Love UIFixQA', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Like UIFixQA', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await row.getByRole('button', { name: 'Comment on UIFixQA score', exact: true }).click();
  await page.getByRole('textbox', { name: 'Comment', exact: true }).fill('Keep this score comment');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.locator('.comment-list')).toContainText('Keep this score comment');
  await page.getByRole('button', { name: 'Close comments', exact: true }).click();
  await row.getByRole('button', { name: 'Comment on UIFixQA score', exact: true }).click();
  await expect(page.locator('.comment-list')).toContainText('Keep this score comment');
  await page.getByRole('button', { name: 'Close comments', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Love UIFixQA', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(row).toContainText('2,000');
});
