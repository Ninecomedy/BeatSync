import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { registerLogin, observeAudio } from './helpers.js';
test('Rabbit Hole Hard uses original x1.0 at normal playback speed', async ({ page }) => {
  await page.addInitScript(observeAudio);
  await page.addInitScript(() => {
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      if (this.buffer.duration > 1) window.trackRate = this.playbackRate.value;
      return start.apply(this, args);
    };
  });
  await registerLogin(page, 'RabbitNormal');
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
  await page.getByRole('button', { name: 'Select Rabbit Hole', exact: true }).click();
  await expect(page.getByLabel('Difficulty', { exact: true }).locator('option')).toHaveText([
    'Hard',
  ]);
  await expect(page.locator('#chart-info')).toContainText('4.00★');
  await expect(page.locator('#chart-info')).toContainText('2,210 taps');
  await expect(page.locator('#required-audio')).toContainText('audio.mp3');
  const map = JSON.parse(fs.readFileSync('public/beatmaps/rabbit-hole-lunatic.json'));
  await page
    .locator('#local-file')
    .setInputFiles('C:/Users/pikac/Downloads/BeatSync-imports/2141937/audio.mp3');
  const loaded = page.waitForResponse(
    (r) => r.url().includes('/beatmaps/rabbit-hole-lunatic.json') && r.ok(),
  );
  await page.getByRole('button', { name: 'Play Rabbit Hole', exact: true }).click();
  expect((await (await loaded).json()).notes).toEqual(map.notes);
  await page.waitForFunction(() => window.localClock?.context.state === 'running');
  expect(await page.evaluate(() => window.trackRate)).toBe(1);
  expect(await page.evaluate(() => localClock.bufferDuration)).toBe(159);
  await expect(page.locator('.score-panel small')).toHaveText('Hard');
  await page.evaluate((note) => {
    const timer = setInterval(() => {
      if (localClock.context.currentTime - localClock.when + 4 >= note.time) {
        const code = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'][note.lane];
        window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        document.querySelector('#pause').click();
        clearInterval(timer);
      }
    }, 4);
  }, map.notes[0]);
  await expect(page.locator('#score')).toHaveText('1,000', { timeout: 12000 });
  await expect(page.locator('#hold-hint')).toBeHidden();
  await page.getByRole('button', { name: 'Exit Song', exact: true }).click();
  await expect(page.getByLabel('Difficulty', { exact: true }).locator('option')).toHaveText([
    'Hard',
  ]);
});
