import { test, expect } from '@playwright/test';
import fs from 'node:fs';
test('production read-only UI assets and guest Settings navigation', async ({ page, request }) => {
  test.skip(!process.env.BEATSYNC_LIVE_URL, 'Live read-only verification only');
  for (const route of ['login', 'register']) {
    await page.goto('/#' + route);
    await expect(page.locator('nav [data-page="leaderboard"]')).toHaveCount(0);
    await expect(page.getByText('เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(page.locator('#settings-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Back from Settings', exact: true }).click();
  }
  const html = await (await request.get('/index.html')).text();
  const local = fs.readFileSync('dist/index.html', 'utf8');
  expect(html).toBe(local);
  const path = html.match(/src="([^\"]+\.js)"/)[1];
  const js = await (await request.get(path)).text();
  expect(js).toBe(fs.readFileSync('dist' + path, 'utf8'));
  for (const text of ['Best Placement', 'Highest Score', 'settings-dialog', 'comments-header'])
    expect(js).toContain(text);
  expect(js).not.toContain('Full song · คะแนนเฉพาะรอบนี้');
});
