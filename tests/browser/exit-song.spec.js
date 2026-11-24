import { test, expect } from '@playwright/test';
import { registerLogin, observeAudio } from './helpers.js';
for (const difficulty of ['medium', 'hard']) {
  const audioPath = process.env.BEATSYNC_OSU_AUDIO;
  test(`Exit Song retains ${difficulty}, cancels countdown, discards run and starts another song`, async ({
    page,
  }) => {
    test.skip(!audioPath, 'Set local audio environment variables');
    await page.addInitScript(observeAudio);
    await registerLogin(page, 'ExitSong');
    await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
    await page.getByLabel('Difficulty', { exact: true }).selectOption(difficulty);
    await page.locator('#local-file').setInputFiles(audioPath);
    await expect(page.getByRole('button', { name: 'Play Monitoring' })).toBeEnabled();
    await page.getByRole('button', { name: 'Play Monitoring' }).click();
    await expect(page.locator('#notes')).toBeVisible();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.locator('#judgement')).toHaveText('PAUSED');
    await page.getByRole('button', { name: 'Exit Song' }).click();
    await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
    await expect(page.locator('.song-selection')).toHaveAttribute(
      'data-selected-song',
      'monitoring',
    );
    await expect(page.locator('.selected-song h2')).toHaveText('モニタリング');
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue(difficulty);
    await expect(page.getByRole('button', { name: 'Play Monitoring' })).toBeEnabled();
    expect(await page.evaluate(() => localClock.context.state)).toBe('closed');
    expect(await page.evaluate(() => resultCount)).toBe(0);
    // Restart the retained song, then exit while its resume countdown is active.
    await page.getByRole('button', { name: 'Play Monitoring' }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.locator('#judgement')).toHaveText('3');
    await page.getByRole('button', { name: 'Exit Song' }).click();
    await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
    await page.waitForTimeout(3200);
    expect(await page.evaluate(() => localClock.context.state)).toBe('closed');
    expect(await page.evaluate(() => resultCount)).toBe(0);
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue(difficulty);
    // Start a different song directly from selection, then return with that song selected.
    await page.getByRole('button', { name: 'Play Neon Pulse', exact: true }).click();
    await expect(page.locator('#notes')).toBeVisible();
    await expect(page.locator('#score')).toHaveText('0');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Exit Song' }).click();
    await expect(page.locator('.song-selection')).toHaveAttribute('data-selected-song', 'neon');
    await expect(page.locator('.selected-song h2')).toHaveText('Neon Pulse');
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await expect(page.locator('#best-score')).toHaveText('0');
  });
}
