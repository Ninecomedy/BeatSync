import { test, expect } from '@playwright/test';
import { registerLogin, observeAudio } from './helpers.js';
import fs from 'node:fs';

test('production path: hosted Play, saved score, two-account comments/reactions/chat', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120000);
  if (!process.env.BEATSYNC_LIVE_URL) {
    const values = (v) =>
      typeof v === 'string'
        ? { stringValue: v }
        : typeof v === 'number'
          ? { integerValue: String(v) }
          : { mapValue: { fields: fields(v) } };
    const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, values(v)]));
    const catalog = JSON.parse(fs.readFileSync('scripts/song-metadata.json'));
    const response = await page.request.patch(
      'http://127.0.0.1:8080/v1/projects/demo-beatsync/databases/(default)/documents/songs/neon-pulse-v1',
      {
        headers: { Authorization: 'Bearer owner' },
        data: { fields: fields(catalog['neon-pulse-v1']) },
      },
    );
    expect(response.ok()).toBeTruthy();
  }
  const prefix = Date.now().toString(36),
    nameA = `QA-A-${prefix}`,
    nameB = `QA-B-${prefix}`;
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(observeAudio);
  let hostedRequest = false;
  page.on('response', (r) => {
    if (r.url().endsWith('/audio/neon-pulse.wav') && r.ok()) hostedRequest = true;
  });
  await registerLogin(page, nameA);
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
  await page.getByRole('button', { name: 'Play Neon Pulse', exact: true }).click();
  await page.waitForFunction(() => window.localClock?.context.state === 'running');
  await page.evaluate(() => {
    const timer = setInterval(() => {
      if (localClock.context.currentTime - localClock.when >= 2) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
        clearInterval(timer);
      }
    }, 4);
  });
  await expect(page.locator('#score')).toHaveText('1,000');
  // One keypress only; let the short demo finish naturally, without full-song autoplay.
  await expect(page.getByRole('button', { name: 'View Leaderboard' })).toBeEnabled({
    timeout: 35000,
  });
  expect(hostedRequest).toBeTruthy();
  expect(await page.evaluate(() => localClock.bufferDuration)).toBe(27);
  await page.getByRole('button', { name: 'View Leaderboard' }).click();
  const row = page.locator('tr[data-score-id]').filter({ hasText: nameA });
  await expect(row).toBeVisible();
  const scoreId = await row.getAttribute('data-score-id');
  await row.locator('td').nth(1).click();
  await page.getByLabel('Comment', { exact: true }).fill('Online comment A');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.locator('.comment-list')).toContainText('Online comment A');
  await page.getByRole('button', { name: 'Edit comment', exact: true }).click();
  await page.getByLabel('Comment', { exact: true }).fill('Edited comment A');
  await page.getByRole('button', { name: 'Save comment', exact: true }).click();
  await expect(page.locator('.comment-list')).toContainText('Edited comment A');
  const contextB = await browser.newContext({ baseURL });
  const b = await contextB.newPage();
  try {
    await registerLogin(b, nameB);
    await b.getByRole('button', { name: 'Leaderboard', exact: true }).click();
    const other = b.locator(`tr[data-score-id="${scoreId}"]`);
    await expect(other).toBeVisible();
    await other.getByRole('button', { name: `Like ${nameA}`, exact: true }).click();
    await other.getByRole('button', { name: `Love ${nameA}`, exact: true }).click();
    await expect(other.getByRole('button', { name: `Like ${nameA}`, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await other.locator('td').nth(1).click();
    await expect(b.locator('.comment-list')).toContainText('Edited comment A');
    await expect(b.getByRole('button', { name: 'Delete comment', exact: true })).toHaveCount(0);
    await b.getByLabel('Comment', { exact: true }).fill('Online comment B');
    await b.getByRole('button', { name: 'Post comment', exact: true }).click();
    await expect(page.locator('.comment-list')).toContainText('Online comment B');
    await b.getByRole('button', { name: 'Delete comment', exact: true }).click();
    await expect(page.locator('.comment-list')).not.toContainText('Online comment B');
    await b.getByRole('button', { name: 'Close comments', exact: true }).click();
    await page.getByRole('button', { name: 'Delete comment', exact: true }).click();
    await page.getByRole('button', { name: 'Close comments', exact: true }).click();
    await b.getByLabel('Chat message', { exact: true }).fill(`Deployment check ${prefix}`);
    await b.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.locator('#messages')).toContainText(`Deployment check ${prefix}`);
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await expect(page.locator('#best-score')).toHaveText('1,000');
    await page.reload();
    await expect(page.locator('#best-score')).toHaveText('1,000');
    expect(errors).toEqual([]);
    console.log(
      `Verified two accounts ${nameA}, ${nameB}; score ${scoreId}; hosted audio, comments, reactions, chat, Profile`,
    );
  } finally {
    await contextB.close();
  }
});
