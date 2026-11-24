import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const map = JSON.parse(readFileSync('public/beatmaps/neon-pulse.json'));
const password = crypto.randomUUID() + '!';
async function registerLogin(page, name, email) {
  await page.goto('/#register');
  await page.getByLabel('Player name', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
}
async function selectSong(page, screenshot) {
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
  await expect(page.locator('.song-row')).toHaveCount(2);
  await expect(page.locator('#notes')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('LOCAL EMULATOR');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (screenshot) await page.screenshot({ path: screenshot });
  await page.getByRole('button', { name: 'Play Neon Pulse', exact: true }).click();
}

test('two accounts: register, login, real-time full song, score, profile, reactions and chat', async ({
  browser,
}) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const alice = await a.newPage(),
    bob = await b.newPage();
  const stamp = Date.now();
  const aliceName = `Alice${stamp % 100000}`,
    bobName = `Bob${stamp % 100000}`;
  // Observe the real audio clock solely in the test; no scoring bypass in app code.
  await alice.addInitScript(() => {
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function (x, y, r, start, end, ...rest) {
      if (this.canvas.id === 'notes' && window.testSong) {
        window.testCircle = {
          x,
          y,
          r,
          start,
          end,
          time: document.querySelector('progress').value * 27,
        };
      }
      return arc.call(this, x, y, r, start, end, ...rest);
    };
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when, ...rest) {
      window.testSong = { context: this.context, origin: when };
      return start.call(this, when, ...rest);
    };
  });
  await registerLogin(alice, aliceName, `alice-${stamp}@example.com`);
  await expect(alice.locator('body')).not.toContainText('Neon Pulse · 120 BPM · 27 seconds');
  await expect(alice.locator('body')).not.toContainText('เมื่อโน้ตถึงเส้น');
  await expect(alice.locator('footer')).toHaveCount(0);
  await alice.screenshot({ path: 'artifacts/start.png' });
  await registerLogin(bob, bobName, `bob-${stamp}@example.com`);
  await bob.getByRole('button', { name: 'Leaderboard', exact: true }).click();
  await selectSong(alice, 'artifacts/song-selection.png');
  await expect(alice.locator('#notes')).toBeVisible();
  await alice.waitForFunction(() => !!window.testSong);
  await alice.evaluate((notes) => {
    window.testInputFinished = false;
    let index = 0;
    const timer = setInterval(() => {
      const time = window.testSong.context.currentTime - window.testSong.origin;
      while (index < notes.length && time >= notes[index].time) {
        const code = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'][notes[index++].lane];
        window.dispatchEvent(new KeyboardEvent('keydown', { code }));
        window.dispatchEvent(new KeyboardEvent('keyup', { code }));
      }
      if (index === notes.length) {
        clearInterval(timer);
        window.testInputFinished = true;
      }
    }, 4);
  }, map.notes);
  await alice.waitForFunction(() => window.testCircle?.time > 1.2);
  const geometry = await alice.evaluate(() => {
    const canvas = document.querySelector('#notes');
    const lanes = [...document.querySelectorAll('.keys button')];
    const bounds = canvas.getBoundingClientRect();
    return {
      circle: window.testCircle,
      target:
        lanes[0].getBoundingClientRect().top -
        bounds.top +
        lanes[0].getBoundingClientRect().height / 2,
      centers: lanes.map((lane) => {
        const rect = lane.getBoundingClientRect();
        return rect.left - bounds.left + rect.width / 2;
      }),
    };
  });
  const circle = geometry.circle;
  expect(circle.r).toBeGreaterThan(0);
  expect(circle.end - circle.start).toBeCloseTo(2 * Math.PI);
  const lane = geometry.centers.findIndex((x) => Math.abs(x - circle.x) < 1);
  expect(lane).toBeGreaterThanOrEqual(0);
  const note = map.notes.find((n) => n.lane === lane && n.time > circle.time);
  expect(
    Math.abs(circle.y - (geometry.target - ((note.time - circle.time) / 1.8) * geometry.target)),
  ).toBeLessThan(3);
  await expect(alice.locator('.keys button')).toHaveText(['D', 'F', 'J', 'K']);
  await alice.screenshot({ path: 'artifacts/game.png' });
  await expect(alice.locator('#save-state')).toHaveText('บันทึกคะแนนแล้ว', { timeout: 40000 });
  const scoreText = await alice.locator('.result-score').innerText();
  expect(Number(scoreText.replaceAll(',', ''))).toBeGreaterThan(0);
  await alice.getByRole('button', { name: 'View Leaderboard' }).click();
  const aliceRow = alice.locator('tbody tr').filter({ hasText: aliceName });
  const bobRow = bob.locator('tbody tr').filter({ hasText: aliceName });
  await expect(aliceRow).toContainText(scoreText);
  await expect(bobRow).toContainText(scoreText);
  expect(await aliceRow.getAttribute('data-score-id')).toBeTruthy();
  await bobRow.getByRole('button', { name: `Like ${aliceName}`, exact: true }).click();
  await expect(aliceRow.locator('[data-kind=like] span')).toHaveText('1');
  await bobRow.getByRole('button', { name: `Love ${aliceName}`, exact: true }).click();
  await expect(aliceRow.locator('[data-kind=love] span')).toHaveText('1');
  await bobRow.getByRole('button', { name: `Like ${aliceName}`, exact: true }).click();
  await expect(aliceRow.locator('[data-kind=like] span')).toHaveText('0');
  await aliceRow.getByRole('button', { name: `Love ${aliceName}`, exact: true }).click();
  await expect(bobRow.locator('[data-kind=love] span')).toHaveText('2');
  const message = `สวัสดี ${stamp} <img src=x onerror=alert(1)>`;
  await bob.getByLabel('Chat message').fill(message);
  await bob.getByRole('button', { name: 'Send message' }).click();
  await expect(alice.getByText(message, { exact: true })).toBeVisible();
  await expect(alice.locator('#messages img')).toHaveCount(0);
  await alice.getByLabel('Chat message').fill(`ตอบกลับ ${stamp}`);
  await alice.getByRole('button', { name: 'Send message' }).click();
  await expect(bob.getByText(`ตอบกลับ ${stamp}`, { exact: true })).toBeVisible();
  await alice.screenshot({ path: 'artifacts/leaderboard.png' });
  await alice.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(alice.getByRole('heading', { name: aliceName, exact: true })).toBeVisible();
  await expect(alice.locator('#best-score')).toHaveText(scoreText);
  await alice.screenshot({ path: 'artifacts/profile.png' });
  await alice.reload();
  await expect(alice.locator('#best-score')).toHaveText(scoreText);
  await alice.getByRole('button', { name: 'Log out' }).click();
  await expect(alice.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
  await a.close();
  await b.close();
});
test('forms, mobile layout, pause/resume and abandoned runs', async ({ page }) => {
  await page.goto('/#login');
  await page.screenshot({ path: 'artifacts/login.png' });
  await page.getByRole('link', { name: 'Sign Up' }).click();
  await page.getByLabel('Player name', { exact: true }).fill('Mismatch');
  await page.getByLabel('Email', { exact: true }).fill('mismatch@example.com');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password', { exact: true }).fill('different');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('alert')).toContainText('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/register-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await registerLogin(page, 'PauseTest', `pause-${Date.now()}@example.com`);
  await selectSong(page, 'artifacts/song-selection-mobile.png');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('#judgement')).toHaveText('PAUSED');
  const value = await page.locator('progress').getAttribute('value');
  await page.waitForTimeout(300);
  expect(await page.locator('progress').getAttribute('value')).toBe(value);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.locator('#judgement')).toHaveText('3');
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({
    timeout: 5000,
  });
  await page.getByRole('button', { name: 'Exit Song' }).click();
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await expect(page.locator('#best-score')).toHaveText('0');
});
