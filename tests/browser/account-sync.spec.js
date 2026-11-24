import { test, expect } from '@playwright/test';
import { registerLogin } from './helpers.js';

async function login(page, credentials) {
  await page.goto('/#login');
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
}
async function range(page, id, value) {
  await page.locator(id).evaluate((el, value) => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}
test('account sync, picture persistence and six song leaderboards', async ({ page, browser }) => {
  const credentials = await registerLogin(page, 'AccountQA');
  await expect(page.locator('.start-screen')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play Neon Pulse', exact: true }).click();
  await expect(page.locator('#notes')).toBeVisible();
  await page.locator('#pause').click();
  await page.locator('#quit').click();
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
  await expect(page.locator('[data-song-board]')).toHaveCount(6);
  for (const id of ['neon', 'monitoring', 'yuusha', 'hibana', 'mesmerizer', 'rabbit-hole']) {
    await page.locator('[data-song-board="' + id + '"]').click();
    await expect(page.locator('.board-heading')).toContainText('LEADERBOARD');
    await expect(page.locator('#scores')).not.toContainText('กำลังโหลด');
    await expect(page.locator('#scores')).not.toContainText('โหลดคะแนนไม่ได้');
    await page.getByRole('button', { name: '← Back', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await range(page, '#note-speed', '1.6');
  await range(page, '#music-volume', '31');
  await range(page, '#sfx-volume', '0');
  await page.getByLabel('Lane 1 key').press('a');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('#settings-status')).toContainText('Settings saved');
  await page.getByRole('button', { name: 'Profile', exact: true }).click();
  await page
    .locator('#profile-photo')
    .setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.locator('#photo-status')).toContainText('Choose a JPEG');
  await page
    .locator('#profile-photo')
    .setInputFiles({
      name: 'large.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 1),
    });
  await expect(page.locator('#photo-status')).toContainText('smaller than 5 MB');
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    c.getContext('2d').fillRect(0, 0, 16, 16);
    return c.toDataURL().split(',')[1];
  });
  await page.locator('#profile-photo').setInputFiles({
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.getByAltText('Profile picture')).toBeVisible();
  const photo = await page.getByAltText('Profile picture').getAttribute('src');
  const context = await browser.newContext({
    baseURL: process.env.BEATSYNC_LIVE_URL || 'http://127.0.0.1:5173',
  });
  try {
    const other = await context.newPage();
    await login(other, credentials);
    await other.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(other.locator('#note-speed')).toHaveValue('1.6');
    await expect(other.locator('#music-volume')).toHaveValue('31');
    await expect(other.locator('#sfx-volume')).toHaveValue('0');
    await expect(other.getByLabel('Lane 1 key')).toHaveValue('A');
    await other.getByRole('button', { name: 'Profile', exact: true }).click();
    await expect(other.getByAltText('Profile picture')).toHaveAttribute('src', photo);
    await other.reload();
    await expect(other.getByAltText('Profile picture')).toHaveAttribute('src', photo);
    // Replace the thumbnail and verify the original session sees it after refresh.
    const changed = await other.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 100;
      const x = c.getContext('2d');
      x.fillStyle = 'red';
      x.fillRect(0, 0, 200, 100);
      return c.toDataURL().split(',')[1];
    });
    await other
      .locator('#profile-photo')
      .setInputFiles({
        name: 'changed.png',
        mimeType: 'image/png',
        buffer: Buffer.from(changed, 'base64'),
      });
    await expect(other.getByAltText('Profile picture')).not.toHaveAttribute('src', photo);
    await expect(other.getByAltText('Profile picture')).toHaveJSProperty('naturalWidth', 128);
    await expect(other.getByAltText('Profile picture')).toHaveJSProperty('naturalHeight', 128);
    const changedPhoto = await other.getByAltText('Profile picture').getAttribute('src');
    await page.reload();
    await expect(page.getByAltText('Profile picture')).toHaveAttribute('src', changedPhoto);
    await other.getByRole('button', { name: 'Remove picture', exact: true }).click();
    await expect(other.getByAltText('Profile picture')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.profile h2')).toHaveText('AccountQA');
    await expect(page.getByAltText('Profile picture')).toHaveCount(0);
    await other.getByRole('button', { name: 'Log out' }).click();
    await expect(other.getByRole('heading', { name: 'Login', exact: true })).toBeVisible();
    await registerLogin(other, 'IsolatedQA');
    await other.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(other.locator('#note-speed')).toHaveValue('1');
    await expect(other.getByLabel('Lane 1 key')).toHaveValue('D');
    await other.getByRole('button', { name: 'Profile', exact: true }).click();
    await expect(other.getByAltText('Profile picture')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
