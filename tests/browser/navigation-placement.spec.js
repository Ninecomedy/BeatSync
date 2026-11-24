import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { registerLogin, observeAudio } from './helpers.js';
const encode = (v) =>
  typeof v === 'string'
    ? { stringValue: v }
    : typeof v === 'number'
      ? Number.isInteger(v)
        ? { integerValue: String(v) }
        : { doubleValue: v }
      : {
          mapValue: {
            fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x)])),
          },
        };
async function seed(id, data) {
  const res = await fetch(
    'http://127.0.0.1:8080/v1/projects/demo-beatsync/databases/(default)/documents/' + id,
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify(encode(data).mapValue),
    },
  );
  expect(res.ok).toBeTruthy();
}
test('ranked profile uses full leaderboard, shares ties and shows independent best placement', async ({
  page,
}) => {
  const catalog = JSON.parse(readFileSync('scripts/song-metadata.json', 'utf8'));
  for (const id of ['yuusha', 'hibana']) await seed('songs/' + id, catalog[id]);
  await registerLogin(page, 'RankQA');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('#best-placement-song')).toHaveText('No completed scores yet');
  for (let i = 0; i < 23; i++)
    await seed('scores/rank-neon-' + i, {
      uid: 'rank-peer',
      playerName: 'RankPeer',
      songId: 'neon-pulse-v1',
      score: 2000,
      difficulty: 'normal',
    });
  for (let i = 0; i < 3; i++)
    await seed('scores/rank-yuusha-' + i, {
      uid: 'rank-peer',
      playerName: 'RankPeer',
      songId: 'yuusha',
      score: i === 2 ? 2000 : 3000,
      difficulty: 'med',
    });
  const save = async (songId, difficulty, total, perfect, good = 0) =>
    page.evaluate(
      async ({ songId, difficulty, total, perfect, good }) => {
        const api = await import('/src/firebase/service.js'),
          { auth } = await import('/src/firebase/client.js');
        await api.saveScore(
          api.newScoreId(),
          auth.currentUser,
          'RankQA',
          {
            score: perfect * 1000 + good * 500,
            maxCombo: perfect + good,
            perfect,
            good,
            miss: total - perfect - good,
          },
          songId,
          difficulty,
        );
      },
      { songId, difficulty, total, perfect, good },
    );
  await save('neon-pulse-v1', 'normal', 48, 1);
  await expect(page.locator('#best-placement')).toHaveText('#24');
  await save('yuusha', 'med', 813, 2);
  await expect(page.locator('#best-placement')).toHaveText('#3');
  await expect(page.locator('#best-score-title')).toHaveText('Highest Score · Yuusha');
  await expect(page.locator('#best-score-song')).toHaveText('Med');
  await save('hibana', 'easy', 656, 0, 1);
  await expect(page.locator('#best-placement')).toHaveText('#1');
  await expect(page.locator('#best-placement-title')).toHaveText('Best Placement · HIBANA');
  await expect(page.locator('#best-placement-song')).toHaveText('Easy');
  await expect(page.locator('#best-score')).toHaveText('2,000');
  await page.getByRole('button', { name: 'Song Selection', exact: true }).click();
  await page.getByRole('button', { name: 'Yuusha leaderboard', exact: true }).click();
  await page.getByLabel('Leaderboard difficulty').selectOption('med');
  await expect(
    page.locator('#scores tr').filter({ hasText: 'RankQA' }).locator('td').first(),
  ).toHaveText('3');
  const peer = page
    .locator('#scores tr')
    .filter({ hasText: 'RankPeer' })
    .filter({ hasText: '2,000' });
  await expect(peer.locator('td').first()).toHaveText('3');
  await page
    .locator('#scores tr')
    .filter({ hasText: 'RankQA' })
    .getByRole('button', { name: 'Comment on RankQA score' })
    .click();
  await page.getByLabel('Comment', { exact: true }).fill('Emulator spacing check');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.locator('.comment-list')).toContainText('Emulator spacing check');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.comments-header h2')).toBeVisible();
  const rect = await page.locator('.comments-dialog').boundingBox();
  expect(rect.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'artifacts/comments-mobile.png' });
});
test('Settings everywhere and gameplay remains paused until explicit countdown', async ({
  page,
}) => {
  await page.addInitScript(observeAudio);
  for (const route of ['login', 'register']) {
    await page.goto('/#' + route);
    await expect(page.getByText('เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.locator('#settings-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Back from Settings', exact: true }).click();
  }
  await registerLogin(page, 'SettingsNavQA');
  for (const id of ['monitoring', 'yuusha', 'hibana', 'mesmerizer', 'rabbit-hole']) {
    await page.locator('[data-select-song="' + id + '"]').click();
    await expect(page.locator('#required-audio')).toHaveText(id + '.mp3');
    await expect(page.getByText('เลือกไฟล์เสียงที่ตรงกับระดับนี้', { exact: true })).toHaveCount(0);
  }
  for (const screen of ['profile', 'leaderboard', 'songs']) {
    if (screen === 'leaderboard') {
      await page.getByRole('button', { name: 'Songs', exact: true }).click();
      await page.locator('[data-song-board="neon"]').click();
    } else await page.locator('nav [data-page="' + screen + '"]').click();
    await expect(page.locator('nav [data-page="leaderboard"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Back from Settings', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Play Neon Pulse', exact: true }).click();
  await page.waitForFunction(() => window.localClock?.context.state === 'running');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForFunction(() => window.localClock.context.state === 'suspended');
  const frozen = await page.evaluate(() => localClock.context.currentTime);
  const score = await page.locator('#score').textContent();
  await page.getByLabel('Lane 1 key').press('q');
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => localClock.context.currentTime)).toBe(frozen);
  await expect(page.locator('#score')).toHaveText(score);
  await page.getByRole('button', { name: 'Back from Settings', exact: true }).click();
  await expect(page.locator('#judgement')).toHaveText('PAUSED');
  expect(await page.evaluate(() => localClock.context.state)).toBe('suspended');
  await page.locator('#pause').click();
  await expect(page.locator('#judgement')).toHaveText('3');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Back from Settings', exact: true }).click();
  await expect(page.locator('#judgement')).toHaveText('PAUSED');
  await page.locator('#pause').click();
  await expect(page.locator('#judgement')).toHaveText('3');
  await page.waitForFunction(() => localClock.context.state === 'running', {}, { timeout: 6000 });
  expect(await page.evaluate(() => localClock.context.currentTime)).toBeGreaterThanOrEqual(frozen);
  await page.locator('#quit').click();
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
});
