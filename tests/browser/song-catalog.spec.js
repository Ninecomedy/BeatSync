import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { LOCAL_SONGS } from '../../src/game/song-catalog.js';
import { registerLogin, observeAudio } from './helpers.js';

test('six visible songs: exact options, covers and all 10 active imported chart/audio pairs', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.addInitScript(observeAudio);
  await registerLogin(page, 'SixSongs');
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
  const cards = page.locator('[data-song-id]');
  await expect(cards).toHaveCount(6);
  for (const id of ['neon', ...Object.keys(LOCAL_SONGS)])
    await expect(page.locator(`[data-song-id="${id}"]`)).toBeVisible();
  await page.getByRole('button', { name: 'Select モニタリング', exact: true }).click();
  await expect(page.getByLabel('Difficulty', { exact: true }).locator('option')).toHaveText([
    'Medium',
    'Hard',
  ]);
  await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
  await page.getByRole('button', { name: 'Select Neon Pulse', exact: true }).click();
  await expect(page.locator('.selected-song > h2')).toHaveText('Neon Pulse');
  await page.getByRole('button', { name: 'Play Neon Pulse', exact: true }).click();
  await page.waitForFunction(() => window.localClock?.context.state === 'running');
  expect(await page.evaluate(() => localClock.bufferDuration)).toBe(27);
  await page.getByRole('button', { name: 'Exit Song', exact: true }).click();
  let checked = 0;
  const audioPaths = {
    yuusha: '2070252',
    hibana: '662688',
    mesmerizer: '2178387',
    'rabbit-hole': '2141937',
  };
  for (const [id, setId] of Object.entries(audioPaths)) {
    const song = LOCAL_SONGS[id];
    await page.getByRole('button', { name: `Select ${song.title}`, exact: true }).click();
    await expect(page.locator('.selected-song > h2')).toHaveText(song.title);
    await expect(page.locator('.selected-song > p')).toHaveText(song.artist);
    await expect(page.locator('.selected-song .demo-cover')).toHaveAttribute('data-song', id);
    await expect(page.locator('.selected-song .demo-cover strong')).toHaveText(song.title);
    await expect(page.getByLabel('Difficulty', { exact: true }).locator('option')).toHaveText(
      Object.values(song.charts).map((c) => c.label),
    );
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
    let first = true;
    for (const [key, chart] of Object.entries(song.charts)) {
      const map = JSON.parse(fs.readFileSync('public' + chart.chartPath));
      await page.getByLabel('Difficulty', { exact: true }).selectOption(key);
      await expect(page.locator('#chart-info')).toContainText(`${chart.stars.toFixed(2)}★`);
      await expect(page.locator('#chart-info')).toContainText(
        `${chart.noteCount.toLocaleString('en-US')} taps`,
      );
      await expect(page.locator('#required-audio')).toContainText(chart.audioFilename);
      const audio = path.join(
        process.env.BEATSYNC_DOWNLOADS || 'C:/Users/pikac/Downloads',
        'BeatSync-imports',
        setId,
        chart.audioFilename,
      );
      await page.locator('#local-file').setInputFiles(audio);
      const play = page.getByRole('button', { name: song.playLabel, exact: true });
      await expect(play).toBeEnabled();
      const loaded = page.waitForResponse((r) => r.url().includes(chart.chartPath) && r.ok());
      await play.click();
      expect((await (await loaded).json()).id).toBe(map.id);
      await page.waitForFunction(() => window.localClock?.context.state === 'running');
      expect(await page.evaluate(() => localClock.bufferDuration)).toBeCloseTo(map.clipDuration, 4);
      expect(await page.evaluate(() => localClock.offset)).toBe(0);
      await expect(page.locator('.score-panel > p')).toHaveText(song.title);
      if (first) {
        await page.evaluate(
          ({ note, leadIn }) => {
            const timer = setInterval(() => {
              if (localClock.context.currentTime - localClock.when + leadIn >= note.time) {
                const code = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'][note.lane];
                window.dispatchEvent(new KeyboardEvent('keydown', { code }));
                window.dispatchEvent(new KeyboardEvent('keyup', { code }));
                document.querySelector('#pause').click();
                clearInterval(timer);
              }
            }, 4);
          },
          { note: map.notes[0], leadIn: map.leadIn },
        );
        await expect(page.locator('#score')).toHaveText('1,000', { timeout: 25000 });
        await expect(page.locator('#hold-hint')).toBeHidden();
        first = false;
      }
      await page.getByRole('button', { name: 'Exit Song', exact: true }).click();
      await expect(page.locator('.song-selection')).toHaveAttribute('data-selected-song', id);
      await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue(key);
      checked++;
    }
  }
  expect(checked).toBe(10);
  await page.screenshot({
    path: `artifacts/six-songs-${process.env.BEATSYNC_LIVE_URL ? 'live' : 'local'}.png`,
    fullPage: true,
  });
  console.log(
    'Six songs visible; all 10 active chart/audio pairs loaded; one tap checked per new song; no full-song autoplay',
  );
});
