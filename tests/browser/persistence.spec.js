import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { registerLogin } from './helpers.js';
const catalog = JSON.parse(readFileSync('scripts/song-metadata.json', 'utf8'));
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
test('persistence: migration, cloud precedence, offline fallback and every chart leaderboard', async ({
  page,
  browser,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('qa-seeded')) {
      localStorage.setItem(
        'beatsync.settings.v1',
        JSON.stringify({
          noteSpeed: 1.7,
          musicVolume: 0.4,
          sfxVolume: 0.2,
          keys: ['KeyA', 'KeyS', 'KeyJ', 'KeyK'],
        }),
      );
      localStorage.setItem('qa-seeded', '1');
    }
  });
  const credentials = await registerLogin(page, 'PersistQA');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('#note-speed')).toHaveValue('1.7');
  const cloud = await page.evaluate(async () => {
    const { auth } = await import('/src/firebase/client.js');
    const { loadUserSettings } = await import('/src/firebase/service.js');
    return loadUserSettings(auth.currentUser.uid, {
      noteSpeed: 0.5,
      musicVolume: 0,
      sfxVolume: 0,
      keys: ['KeyD', 'KeyF', 'KeyJ', 'KeyK'],
    });
  });
  expect(cloud.noteSpeed).toBe(1.7);
  await page.context().setOffline(true);
  await page.locator('#note-speed').evaluate((el) => {
    el.value = '1.8';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('#settings-status')).toContainText('Saved on this device', {
    timeout: 10000,
  });
  expect(
    await page.evaluate(() =>
      Object.values(localStorage).some((x) => x.includes('"noteSpeed":1.8')),
    ),
  ).toBe(true);
  await page.context().setOffline(false);
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('#settings-status')).toContainText('Settings saved', {
    timeout: 15000,
  });
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  try {
    const second = await context.newPage();
    await second.addInitScript(() =>
      localStorage.setItem(
        'beatsync.settings.v1',
        JSON.stringify({
          noteSpeed: 0.6,
          musicVolume: 0,
          sfxVolume: 0,
          keys: ['KeyQ', 'KeyW', 'KeyE', 'KeyR'],
        }),
      ),
    );
    await second.goto('/#login');
    await second.getByLabel('Email', { exact: true }).fill(credentials.email);
    await second.getByLabel('Password', { exact: true }).fill(credentials.password);
    await second.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(second.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
    await second.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(second.locator('#note-speed')).toHaveValue('1.8');
    await expect(second.getByLabel('Lane 1 key')).toHaveValue('A');
  } finally {
    await context.close();
  }
  // Emulator-only metadata provisioning; no production writes or audio playback.
  for (const [id, song] of Object.entries(catalog)) {
    const response = await fetch(
      'http://127.0.0.1:8080/v1/projects/demo-beatsync/databases/(default)/documents/songs/' + id,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
        body: JSON.stringify(encode(song).mapValue),
      },
    );
    expect(response.ok, await response.text()).toBeTruthy();
  }
  const count = await page.evaluate(async (catalog) => {
    const api = await import('/src/firebase/service.js');
    const { auth } = await import('/src/firebase/client.js');
    let count = 0;
    for (const [songId, song] of Object.entries(catalog))
      for (const [difficulty, total] of Object.entries(song.counts || { normal: 48 })) {
        await api.saveScore(
          api.newScoreId(),
          auth.currentUser,
          'PersistQA',
          { score: 1000, maxCombo: 1, perfect: 1, good: 0, miss: total - 1 },
          songId,
          difficulty,
        );
        count++;
      }
    return count;
  }, catalog);
  expect(count).toBe(13);
  await page.getByRole('button', { name: 'Songs', exact: true }).click();
  for (const [id, song] of Object.entries(catalog)) {
    await page
      .locator('[data-song-board="' + (id === 'neon-pulse-v1' ? 'neon' : id) + '"]')
      .click();
    for (const difficulty of Object.keys(song.counts || { normal: 48 })) {
      if (song.counts) await page.getByLabel('Leaderboard difficulty').selectOption(difficulty);
      await expect(page.locator('#scores')).toContainText('PersistQA');
      await expect(page.locator('#board-best')).toHaveText('1,000');
    }
    await page.getByRole('button', { name: '← Back', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('#best-score')).toHaveText('1,000');
});
