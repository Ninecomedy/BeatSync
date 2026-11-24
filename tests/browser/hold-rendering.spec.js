import { test, expect } from '@playwright/test';
import { registerLogin, observeAudio, useHoldFixture } from './helpers.js';

for (const speed of [0.5, 2]) {
  test(`paused hold has equal circular ends and connected body at ${speed}x`, async ({ page }) => {
    test.skip(!process.env.BEATSYNC_OSU_AUDIO, 'Set BEATSYNC_OSU_AUDIO to local audio.mp3');
    await useHoldFixture(page);
    await page.addInitScript(observeAudio);
    await page.addInitScript(() => {
      window.holdFrame = { arcs: [], bodies: [] };
      for (const method of ['clearRect', 'arc', 'fillRect']) {
        const original = CanvasRenderingContext2D.prototype[method];
        CanvasRenderingContext2D.prototype[method] = function (...args) {
          if (this.canvas.id === 'notes') {
            if (method === 'clearRect') window.holdFrame = { arcs: [], bodies: [] };
            else window.holdFrame[method === 'arc' ? 'arcs' : 'bodies'].push(args);
          }
          return original.apply(this, args);
        };
      }
    });
    await registerLogin(page, `HoldSize${speed}`);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('slider', { name: 'Note Speed', exact: true }).evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(speed));
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.getByRole('button', { name: 'Back from Settings' }).click();
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
    await page.waitForFunction(() => localClock.context.state === 'suspended');
    await page.waitForTimeout(100);
    const geometry = await page.evaluate(() => {
      const canvas = document.querySelector('#notes').getBoundingClientRect();
      const button = document.querySelector('.keys button').getBoundingClientRect();
      return {
        ...window.holdFrame,
        x: button.left - canvas.left + button.width / 2,
        y: button.top - canvas.top + button.height / 2,
        diameter: Math.min(button.width, button.height),
        time: localClock.context.currentTime - localClock.when + 4,
      };
    });
    const ends = geometry.arcs.filter((a) => Math.abs(a[0] - geometry.x) < 0.1);
    expect(ends).toHaveLength(2);
    const [tail, head] = ends;
    for (const end of ends) {
      expect(end[2] * 2).toBeCloseTo(geometry.diameter * 0.7, 8);
      expect(end[3]).toBe(0);
      expect(end[4]).toBe(Math.PI * 2);
    }
    expect(tail[2]).toBe(head[2]);
    expect(tail[0]).toBe(head[0]);
    expect(head[1]).toBeCloseTo(geometry.y, 8);
    expect(tail[1]).toBeCloseTo(
      geometry.y - ((4.871 - geometry.time) / (1.8 / speed)) * geometry.y,
      8,
    );
    const body = geometry.bodies.find((b) => Math.abs(b[0] + b[2] / 2 - geometry.x) < 0.1);
    expect(body).toBeTruthy();
    expect(body[1]).toBeCloseTo(tail[1], 8);
    expect(body[1] + body[3]).toBeCloseTo(head[1], 8);
    await page.screenshot({ path: `artifacts/hold-equal-ends-${speed}.png` });
    await page.getByRole('button', { name: 'Exit Song' }).click();
  });
}
