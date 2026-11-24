import { test, expect } from '@playwright/test';
import { registerLogin, observeAudio } from './helpers.js';
async function setRange(locator, value) {
  await locator.evaluate((el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
test('Settings: both gear routes, persisted bindings and independent mix, speed, reset', async ({
  page,
}) => {
  await page.addInitScript(observeAudio);
  await registerLogin(page, 'Settings');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SETTINGS', exact: true })).toBeVisible();
  await page.getByLabel('Lane 1 key').press('f');
  await expect(page.locator('#settings-status')).toContainText('different key');
  await expect(page.getByLabel('Lane 1 key')).toHaveValue('D');
  for (const [i, key] of ['a', 's', 'k', 'l'].entries()) {
    // Free K before assigning lane 3, because it is initially lane 4.
    if (i === 2) await page.getByLabel('Lane 4 key').press('l');
    await page.getByLabel(`Lane ${i + 1} key`).press(key);
  }
  await setRange(page.getByRole('slider', { name: /Note Speed/ }), '1.6');
  await setRange(page.getByRole('slider', { name: /Music Volume/ }), '25');
  await setRange(page.getByRole('slider', { name: /SFX Volume/ }), '70');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('#settings-status')).toContainText('Settings saved');
  await page.reload();
  for (const [i, key] of ['A', 'S', 'K', 'L'].entries())
    await expect(page.getByLabel(`Lane ${i + 1} key`)).toHaveValue(key);
  await expect(page.getByRole('slider', { name: /Music Volume/ })).toHaveValue('25');
  await expect(page.getByRole('slider', { name: /SFX Volume/ })).toHaveValue('70');
  await expect(page.getByRole('slider', { name: /Note Speed/ })).toHaveValue('1.6');
  await page.screenshot({ path: 'artifacts/settings.png' });
  await page.getByRole('button', { name: 'Back from Settings' }).click();
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SETTINGS', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/settings-mobile.png' });
  await page.setViewportSize({ width: 1100, height: 720 });
  await page.getByRole('button', { name: 'Back from Settings' }).click();
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
  await page.getByRole('button', { name: 'Play Neon Pulse', exact: true }).click();
  await expect(page.locator('.keys button')).toHaveText(['A', 'S', 'K', 'L']);
  await page.waitForFunction(
    () => window.lastCircle && localClock.context.currentTime - localClock.when > 1.3,
  );
  const c = await page.evaluate(() => window.lastCircle);
  const targets = await page.evaluate(() => {
    const bounds = document.querySelector('#notes').getBoundingClientRect();
    return [...document.querySelectorAll('.keys button')].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left - bounds.left + r.width / 2, y: r.top - bounds.top + r.height / 2 };
    });
  });
  const lane = targets.findIndex((t) => Math.abs(t.x - c.x) < 1);
  const target = targets[lane].y;
  expect(
    Math.abs(c.y - (target - ((2 + lane * 0.5 - c.progress * 27) / (1.8 / 1.6)) * target)),
  ).toBeLessThan(4);
  await page.evaluate(() => {
    const timer = setInterval(() => {
      if (localClock.context.currentTime - localClock.when >= 2) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA' }));
        clearInterval(timer);
      }
    }, 4);
  });
  await expect(page.locator('#score')).toHaveText('1,000');
  const mix = await page.evaluate(() =>
    audioEdges
      .filter(([a, b]) => a instanceof GainNode && b instanceof AudioDestinationNode)
      .map(([a]) => a.gain.value),
  );
  expect(mix[0]).toBeCloseTo(0.25);
  expect(mix[1]).toBeCloseTo(0.7);
  expect(
    await page.evaluate(() =>
      audioEdges.some(([a]) => a instanceof AudioBufferSourceNode && a.buffer.duration < 1),
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Exit Song' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset to Default' }).click();
  await page.reload();
  await expect(page.getByRole('slider', { name: /Note Speed/ })).toHaveValue('1');
  await expect(page.getByRole('slider', { name: /Music Volume/ })).toHaveValue('100');
  await expect(page.getByRole('slider', { name: /SFX Volume/ })).toHaveValue('50');
  for (const [i, key] of ['D', 'F', 'J', 'K'].entries())
    await expect(page.getByLabel(`Lane ${i + 1} key`)).toHaveValue(key);
});
