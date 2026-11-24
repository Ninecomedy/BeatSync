import { test, expect } from '@playwright/test';
import { registerLogin, observeAudio } from './helpers.js';

test('Clcik MP4 audio plays on a judged keypress and SFX mute suppresses playback', async ({
  page,
}) => {
  await page.addInitScript(observeAudio);
  await registerLogin(page, 'KeyboardSfx');
  for (const volume of [70, 0]) {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('slider', { name: /SFX Volume/ }).evaluate((el, value) => {
      el.value = String(value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, volume);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.getByRole('button', { name: 'Back from Settings' }).click();
    if (await page.getByRole('heading', { name: 'SONG SELECTION' }).isVisible())
      await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
    const before = await page.evaluate(() => window.sfxStarts || 0);
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
    expect(await page.evaluate(() => window.sfxStarts || 0)).toBe(before + (volume ? 1 : 0));
    if (volume) {
      const sample = await page.evaluate(() => {
        const [source, bus] = audioEdges.find(
          ([a]) => a instanceof AudioBufferSourceNode && a.buffer.duration < 1,
        );
        return {
          duration: source.buffer.duration,
          gain: bus.gain.value,
          rate: source.playbackRate.value,
        };
      });
      expect(sample.duration).toBeGreaterThan(0);
      expect(sample.gain).toBeCloseTo(0.7);
      expect(sample.rate).toBe(1);
    }
    await page.getByRole('button', { name: 'Exit Song' }).click();
  }
});
