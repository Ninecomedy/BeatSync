import { test, expect } from '@playwright/test';
import { registerLogin } from './helpers.js';

test('Leaderboard Back restores song and difficulty and shows tap-only counts', async ({
  page,
}) => {
  await registerLogin(page, 'BoardBack');
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
  const difficulty = page.getByLabel('Difficulty', { exact: true });
  await expect(difficulty).toHaveValue('hard');
  for (const [song, level, count] of [
    ['neon', 'hard', '2,217'],
    ['monitoring', 'medium', '1,559'],
    ['monitoring', 'hard', '2,217'],
  ]) {
    if (song === 'monitoring') await difficulty.selectOption(level);
    await expect(page.locator('#chart-info')).toContainText(`${count} taps`);
    await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
    const back = page.getByRole('button', { name: '← Back', exact: true });
    const heading = page.locator('.board-heading h1');
    const b = await back.boundingBox(),
      h = await heading.boundingBox();
    expect(b.x + b.width).toBeLessThan(h.x);
    await back.click();
    await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
    await expect(page.locator('.song-selection')).toHaveAttribute('data-selected-song', song);
    await expect(difficulty).toHaveValue(level);
  }
});
