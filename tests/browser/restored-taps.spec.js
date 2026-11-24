import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { registerLogin, observeAudio } from './helpers.js';
for (const [difficulty, count] of [
  ['medium', 1559],
  ['hard', 2217],
]) {
  test(`${difficulty}: restored head taps match displayed count and gameplay`, async ({ page }) => {
    test.skip(!process.env.BEATSYNC_OSU_AUDIO, 'Set matching local audio.mp3');
    const expected = JSON.parse(readFileSync(`public/beatmaps/monitoring-${difficulty}.json`));
    await page.addInitScript(observeAudio);
    await page.addInitScript(() => {
      window.holdDraws = 0;
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function (...args) {
        if (this.canvas.id === 'notes') window.holdDraws++;
        return fill.apply(this, args);
      };
    });
    await registerLogin(page, `Taps-${difficulty}`);
    await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
    await page.getByLabel('Difficulty', { exact: true }).selectOption(difficulty);
    await expect(page.locator('#chart-info')).toContainText(
      `${count.toLocaleString('en-US')} taps`,
    );
    const response = await page.request.get(`/beatmaps/monitoring-${difficulty}.json`);
    const chart = await response.json();
    expect(chart.notes).toEqual(expected.notes);
    expect(chart.notes).toHaveLength(count);
    expect(chart.notes.every((n) => Object.keys(n).sort().join(',') === 'lane,time')).toBe(true);
    await page.locator('#local-file').setInputFiles(process.env.BEATSYNC_OSU_AUDIO);
    const loaded = page.waitForResponse(
      (r) => r.url().includes(`/beatmaps/monitoring-${difficulty}.json`) && r.ok(),
    );
    await page.getByRole('button', { name: 'Play Monitoring' }).click();
    expect((await (await loaded).json()).notes).toHaveLength(count);
    await page.waitForFunction(() => window.localClock?.context.state === 'running');
    await page.evaluate(
      ({ note, leadIn }) => {
        window.captureCircles = true;
        const timer = setInterval(() => {
          const time = localClock.context.currentTime - localClock.when + leadIn;
          if (time >= note.time) {
            const code = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'][note.lane];
            window.dispatchEvent(new KeyboardEvent('keydown', { code }));
            window.dispatchEvent(new KeyboardEvent('keyup', { code }));
            document.querySelector('#pause').click();
            clearInterval(timer);
          }
        }, 4);
      },
      { note: chart.notes[0], leadIn: chart.leadIn },
    );
    // Each first object was originally a hold: an immediate release must score as one tap.
    await expect(page.locator('#score')).toHaveText('1,000', { timeout: 12000 });
    await expect(page.locator('#judgement')).toHaveText('PAUSED');
    await expect(page.locator('#hold-hint')).toBeHidden();
    expect(await page.evaluate(() => window.holdDraws)).toBe(0);
    const circles = await page.evaluate(() => window.circleSamples);
    expect(circles.length).toBeGreaterThan(0);
    expect(circles.every((c) => c.a === 0 && c.b === Math.PI * 2)).toBe(true);
    await page.screenshot({
      path: `artifacts/restored-${process.env.BEATSYNC_LIVE_URL ? 'live' : 'local'}-${difficulty}.png`,
    });
    await page.getByRole('button', { name: 'Exit Song', exact: true }).click();
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue(difficulty);
  });
}
