import { test, expect } from '@playwright/test';
import { registerLogin, observeAudio } from './helpers.js';
async function clock(page) {
  return page.evaluate(() => localClock.context.currentTime - localClock.when);
}
async function fire(page, code) {
  await page.evaluate((code) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  }, code);
}
async function centered(page) {
  const center = await page.locator('#judgement').boundingBox();
  const viewport = page.viewportSize();
  expect(center.x + center.width / 2).toBeCloseTo(viewport.width / 2, 0);
  expect(center.y + center.height / 2).toBeCloseTo(viewport.height / 2, 0);
}
test('resume countdown freezes near a note, ignores hits, survives repeated cycles and cancellation', async ({
  page,
}) => {
  await page.addInitScript(observeAudio);
  await registerLogin(page, 'Countdown');
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
  await page.getByRole('button', { name: 'Play Neon Pulse', exact: true }).click();
  await page.waitForFunction(
    () => window.localClock && localClock.context.currentTime - localClock.when > 1.85,
  );
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.waitForFunction(() => localClock.context.state === 'suspended');
  const paused = await clock(page);
  expect(paused).toBeLessThan(2.15);
  await centered(page);
  await expect(page.locator('.combo')).toBeHidden();
  await page.screenshot({ path: 'artifacts/game-paused.png' });
  for (let cycle = 0; cycle < 2; cycle++) {
    await page.evaluate(() => {
      window.countdownTimes = [];
      const node = document.querySelector('#judgement');
      window.countdownObserver?.disconnect();
      window.countdownObserver = new MutationObserver(() => {
        const text = node.textContent;
        if (['3', '2', '1'].includes(text) && window.countdownTimes.at(-1)?.text !== text)
          window.countdownTimes.push({ text, at: performance.now() });
      });
      window.countdownObserver.observe(node, { childList: true, subtree: true });
    });
    const before = await clock(page);
    await page.waitForTimeout(40);
    const frozenCircle = await page.evaluate(() => window.lastCircle.y);
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    for (const number of ['3', '2', '1']) {
      await expect(page.locator('#judgement')).toHaveText(number, { timeout: 1800 });
      await centered(page);
      await expect(page.locator('.combo')).toBeHidden();
      expect(await clock(page)).toBeCloseTo(before, 5);
      expect(await page.evaluate(() => window.lastCircle.y)).toBeCloseTo(frozenCircle, 5);
      await fire(page, 'KeyD');
      await page.getByRole('button', { name: 'Play lane D', exact: true }).click();
      await expect(page.locator('#score')).toHaveText('0');
      if (cycle === 0 && number === '3')
        await page.screenshot({ path: 'artifacts/game-countdown.png' });
    }
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({
      timeout: 1800,
    });
    const times = await page.evaluate(() => window.countdownTimes);
    expect(times.map((t) => t.text)).toEqual(['3', '2', '1']);
    for (let i = 1; i < times.length; i++) {
      expect(times[i].at - times[i - 1].at).toBeGreaterThanOrEqual(950);
      expect(times[i].at - times[i - 1].at).toBeLessThan(1250);
    }
    expect(
      await page.evaluate(() => performance.now() - countdownTimes.at(-1).at),
    ).toBeGreaterThanOrEqual(950);
    expect(await page.evaluate(() => window.audioStarts)).toBe(1);
    // Immediately freeze again, before the upcoming note leaves the original hit window.
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.waitForFunction(() => localClock.context.state === 'suspended');
    expect((await clock(page)) - before).toBeLessThan(0.5);
    expect(await page.evaluate(() => window.resumeSamples.at(-1).time)).toBeCloseTo(before, 5);
  }
  // Cancel a countdown and verify the old timer cannot resume audio later.
  const frozen = await clock(page);
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#judgement')).toHaveText('3');
  await page.getByRole('button', { name: 'Cancel resume' }).click();
  await expect(page.locator('#judgement')).toHaveText('PAUSED');
  await page.waitForTimeout(3100);
  expect(await clock(page)).toBeCloseTo(frozen, 5);
  // Resume once more and hit the next not-yet-passed note against the unchanged audio clock.
  await page.evaluate(() => {
    const notes = [
      { time: 2, lane: 0 },
      { time: 2.5, lane: 1 },
      { time: 3, lane: 2 },
    ];
    const note = notes.find((n) => n.time >= localClock.context.currentTime - localClock.when);
    window.expectedHit = note;
    const timer = setInterval(() => {
      if (
        localClock.context.state === 'running' &&
        localClock.context.currentTime - localClock.when >= note.time
      ) {
        const code = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'][note.lane];
        window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        clearInterval(timer);
      }
    }, 4);
  });
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#score')).toHaveText('1,000', { timeout: 5000 });
  await expect(page.locator('#judgement')).toHaveText('PERFECT');
  await centered(page);
  const judgement = await page.locator('#judgement').boundingBox(),
    combo = await page.locator('#combo').boundingBox();
  expect(combo.y).toBeGreaterThan(judgement.y + judgement.height);
  expect(combo.height).toBeGreaterThan(45);
  await page.screenshot({ path: 'artifacts/game-perfect.png' });
  // Quitting during countdown must clean timers and must not resume detached audio.
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.locator('#judgement')).toHaveText('3');
  await page.getByRole('button', { name: 'Exit Song' }).click();
  await page.waitForTimeout(3100);
  expect(await page.evaluate(() => localClock.context.state)).toBe('closed');
  await expect(page.locator('#notes')).toHaveCount(0);
});
for (const [speed, width, height] of [
  [0.5, 1100, 720],
  [1, 390, 844],
  [2, 1100, 720],
]) {
  test(`button center arrival and 70% diameter at ${speed}x (${width}px)`, async ({ page }) => {
    await page.addInitScript(observeAudio);
    await registerLogin(page, `Speed${speed}`);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('slider', { name: 'Note Speed', exact: true }).evaluate((el, value) => {
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(speed));
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.getByRole('button', { name: 'Back from Settings' }).click();
    await page.setViewportSize({ width, height });
    await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
    await page.evaluate(() => (window.captureCircles = true));
    await page.getByRole('button', { name: 'Play Neon Pulse', exact: true }).click();
    await page.waitForFunction(
      () => window.localClock && localClock.context.currentTime - localClock.when > 2.06,
    );
    const geometry = await page.evaluate(() => {
      const b = document.querySelector('#notes').getBoundingClientRect();
      return [...document.querySelectorAll('.keys button')].map((key) => {
        const r = key.getBoundingClientRect();
        return {
          x: r.left - b.left + r.width / 2,
          y: r.top - b.top + r.height / 2,
          diameter: r.width,
          bottom: r.bottom,
        };
      });
    });
    const samples = await page.evaluate(() => window.circleSamples);
    const first = samples
      .filter((c) => Math.abs(c.x - geometry[0].x) < 1)
      .sort((a, b) => Math.abs(a.time - 2) - Math.abs(b.time - 2))[0];
    expect(Math.abs(first.time - 2)).toBeLessThan(0.03);
    expect(first.r * 2).toBeCloseTo(geometry[0].diameter * 0.7, 1);
    expect(Math.abs(first.y - geometry[0].y)).toBeLessThan(
      (geometry[0].y * 0.03) / (1.8 / speed) + 2,
    );
    for (const c of samples.filter(
      (c) =>
        Math.abs(c.x - geometry[0].x) < 1 &&
        c.time >= 0 &&
        c.time < 2.08 &&
        c.y > geometry[0].y / 2,
    ))
      expect(
        Math.abs(c.y - (geometry[0].y - ((2 - c.progress * 27) / (1.8 / speed)) * geometry[0].y)),
      ).toBeLessThan(5);
    expect(height - geometry[0].bottom).toBeGreaterThanOrEqual(30);
    await page.screenshot({ path: `artifacts/game-target-${speed}.png` });
    await page.getByRole('button', { name: 'Exit Song' }).click();
  });
}
