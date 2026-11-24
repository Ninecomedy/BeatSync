import { test, expect } from '@playwright/test';
import { registerLogin, observeAudio, useHoldFixture } from './helpers.js';

for (const regrip of [true, false]) {
  test(`native hold: paused release ${regrip ? 're-gripped through repeated resume' : 'missing on resume fails'}`, async ({
    page,
  }) => {
    test.skip(!process.env.BEATSYNC_OSU_AUDIO, 'Set BEATSYNC_OSU_AUDIO');
    await useHoldFixture(page);
    await page.addInitScript(observeAudio);
    await registerLogin(page, regrip ? 'Regrip' : 'Release');
    await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
    await page.getByLabel('Difficulty', { exact: true }).selectOption('medium');
    await page.locator('#local-file').setInputFiles(process.env.BEATSYNC_OSU_AUDIO);
    await page.getByRole('button', { name: 'Play Monitoring' }).click();
    await page.waitForFunction(() => window.localClock);
    await page.evaluate(() => {
      let pressed = false;
      const timer = setInterval(() => {
        const t = localClock.context.currentTime - localClock.when;
        if (!pressed && t >= 0.326) {
          window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
          pressed = true;
        }
        if (t >= 0.38) {
          document.querySelector('#pause').click();
          clearInterval(timer);
        }
      }, 4);
    });
    await expect(page.locator('#judgement')).toHaveText('PAUSED');
    await expect(page.locator('#hold-hint')).toContainText('Hold D');
    await expect(page.locator('#score')).toHaveText('0');
    for (let cycle = 0; cycle < (regrip ? 2 : 1); cycle++) {
      await page.keyboard.up('d');
      const frozen = await page.evaluate(() => localClock.context.currentTime);
      await page.getByRole('button', { name: 'Resume', exact: true }).click();
      await expect(page.locator('#judgement')).toHaveText('3');
      if (regrip) await page.keyboard.down('d');
      await page.waitForTimeout(1100);
      expect(await page.evaluate(() => localClock.context.currentTime)).toBe(frozen);
      await expect(page.locator('#score')).toHaveText('0');
      if (regrip && cycle === 0) {
        await page.evaluate(() => {
          const timer = setInterval(() => {
            if (document.querySelector('#pause').textContent === 'Pause') {
              document.querySelector('#pause').click();
              clearInterval(timer);
            }
          }, 4);
        });
        await expect(page.locator('#judgement')).toHaveText('PAUSED', { timeout: 4000 });
      } else {
        await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({
          timeout: 4000,
        });
      }
    }
    if (regrip) {
      await expect(page.locator('#score')).toHaveText('1,000');
      await page.keyboard.up('d');
      await expect(page.locator('#score')).toHaveText('1,000');
    } else {
      await expect(page.locator('#judgement')).toHaveText('MISS');
      await expect(page.locator('#score')).toHaveText('0');
    }
    await page.getByRole('button', { name: 'Exit Song' }).click();
  });
}
