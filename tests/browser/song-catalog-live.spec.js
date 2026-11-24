import { test, expect } from '@playwright/test';
import { registerLogin } from './helpers.js';
import { LOCAL_SONGS } from '../../src/game/song-catalog.js';
test('live site exposes six selectable songs with the exact available options', async ({
  page,
}) => {
  test.skip(!process.env.BEATSYNC_LIVE_URL, 'Live-only catalog smoke check');
  await registerLogin(page, 'CatalogLive');
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
  await expect(page.locator('[data-song-id]')).toHaveCount(6);
  await page.getByRole('button', { name: 'Select Neon Pulse', exact: true }).click();
  await expect(page.locator('.selected-song > h2')).toHaveText('Neon Pulse');
  await expect(page.getByRole('button', { name: 'Play Neon Pulse', exact: true })).toBeEnabled();
  for (const song of Object.values(LOCAL_SONGS)) {
    await expect(page.locator(`[data-song-id="${song.id}"]`)).toBeVisible();
    await page.getByRole('button', { name: `Select ${song.title}`, exact: true }).click();
    await expect(page.locator('.selected-song > h2')).toHaveText(song.title);
    await expect(page.locator('.selected-song > p')).toHaveText(song.artist);
    await expect(page.locator('.selected-song .demo-cover')).toHaveAttribute('data-song', song.id);
    await expect(page.getByLabel('Difficulty', { exact: true }).locator('option')).toHaveText(
      Object.values(song.charts).map((c) => c.label),
    );
    for (const [key, chart] of Object.entries(song.charts)) {
      await page.getByLabel('Difficulty', { exact: true }).selectOption(key);
      await expect(page.locator('#chart-info')).toContainText(`${chart.stars.toFixed(2)}★`);
      await expect(page.locator('#chart-info')).toContainText(
        `${chart.noteCount.toLocaleString('en-US')} taps`,
      );
      await expect(page.locator('#required-audio')).toContainText(chart.audioFilename);
    }
    await expect(page.getByRole('button', { name: song.playLabel, exact: true })).toBeDisabled();
  }
  await page.screenshot({ path: 'artifacts/six-songs-live.png', fullPage: true });
  console.log(
    'Live: six selectable songs, correct titles/artists/covers, all assigned difficulties/stars/counts, local-file requirements preserved',
  );
});
