import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { registerLogin } from './helpers.js';
const songs = ['monitoring', 'yuusha', 'hibana', 'mesmerizer', 'rabbit-hole'];
const driveIds = [
  '1OYilRGyFrVIkfknmv88Od950Z9UkDgD0',
  '1H1PUS6XP4sxii7y6YhZ10E_NSOQf8naa',
  '1qxTnaz972OgR-br-Umb6FSVgNdJCLsDe',
  '1IRpVrP0Wbw7Y7zVWS8RoE1TDuApbmZ5S',
  '1xny36aIjTZ80YnBb1W4l5fODyhw5jPKG',
];
function audio(index) {
  const count = 16000,
    bytes = Buffer.alloc(44 + count * 2);
  bytes.write('RIFF');
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24);
  bytes.writeUInt32LE(16000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++)
    bytes.writeInt16LE(Math.round(Math.sin((i * (index + 1)) / 20) * 3000), 44 + i * 2);
  return bytes;
}
const files = songs.map((id, i) => ({
  name: id + '.wav',
  mimeType: 'audio/wav',
  buffer: audio(i),
}));
async function fixture(page) {
  await page.route('**/beatmaps/*.json', async (route) => {
    const filename = new URL(route.request().url()).pathname.split('/').at(-1);
    const index = songs.findIndex((id) => filename.startsWith(id + '-'));
    if (index < 0) return route.continue();
    // Tiny synthetic audio/chart fixtures test browser caching without copyrighted files or full songs.
    await route.fulfill({
      json: {
        id: songs[index],
        title: songs[index],
        bpm: 120,
        duration: 6,
        leadIn: 4,
        clipStart: 0,
        clipDuration: 2,
        sha256: createHash('sha256').update(files[index].buffer).digest('hex'),
        notes: [{ time: 4.5, lane: 0 }],
      },
    });
  });
}
test('five Drive links and local audio Blobs persist by song and across difficulties', async ({
  page,
}) => {
  await fixture(page);
  await registerLogin(page, 'CacheQA');
  for (let i = 0; i < songs.length; i++) {
    await page.locator('[data-select-song="' + songs[i] + '"]').click();
    await expect(page.locator('#download-audio')).toHaveAttribute(
      'href',
      'https://drive.google.com/file/d/' + driveIds[i] + '/view',
    );
    await expect(page.locator('#download-audio')).toHaveAttribute('target', '_blank');
    await expect(page.locator('#local-status')).toContainText('load the MP3/OGG');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Load Audio', exact: true }).click();
    await (await chooser).setFiles(files[i]);
    await expect(page.locator('#local-status')).toContainText('Saved on this browser');
    await expect(page.locator('#play-local')).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Change Audio', exact: true })).toBeVisible();
  }
  await page.reload();
  for (const id of songs) {
    await page.locator('[data-select-song="' + id + '"]').click();
    await expect(page.locator('#play-local')).toBeEnabled();
  }
  await page.locator('[data-select-song="monitoring"]').click();
  await page.getByLabel('Difficulty', { exact: true }).selectOption('medium');
  await expect(page.locator('#play-local')).toBeEnabled();
  const cached = await page.evaluate(async () => {
    const { readCachedAudio } = await import('/src/game/audio-cache.js');
    const f = await readCachedAudio('monitoring');
    return { size: f.size, name: f.name };
  });
  expect(cached).toEqual({ size: files[0].buffer.length, name: 'monitoring.wav' });
  await page.locator('#play-local').click();
  await expect(page.locator('#notes')).toBeVisible();
  await page.locator('#quit').click();
  await expect(page.locator('#play-local')).toBeEnabled();
});
test('invalid, missing and inaccessible cached audio fail gracefully without blocking valid playback', async ({
  page,
}) => {
  await fixture(page);
  await registerLogin(page, 'CacheErrorQA');
  await page.locator('[data-select-song="monitoring"]').click();
  await page
    .locator('#local-file')
    .setInputFiles({ name: 'invalid.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('bad') });
  await expect(page.locator('#play-local')).toBeDisabled();
  await expect(page.locator('#local-status')).toContainText('ไฟล์ไม่ตรง');
  await page.evaluate(async () => {
    const { cacheAudio } = await import('/src/game/audio-cache.js');
    await cacheAudio('monitoring', new File(['bad'], 'corrupt.mp3'));
  });
  await page.reload();
  await expect(page.locator('#local-status')).toContainText('Saved audio unavailable');
  await page.addInitScript(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (names, mode, ...rest) {
      if (this.name === 'beatsync.audio.v1' && mode === 'readwrite')
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, names, mode, ...rest);
    };
  });
  await page.reload();
  await page.locator('[data-select-song="monitoring"]').click();
  await page.locator('#local-file').setInputFiles(files[0]);
  await expect(page.locator('#local-status')).toContainText('Ready for this visit');
  await expect(page.locator('#play-local')).toBeEnabled();
});
test('comment avatars reuse author profiles, fallback initials, and preserve editing; Settings has one surface', async ({
  page,
  browser,
}) => {
  await registerLogin(page, 'AvatarQA');
  await page.evaluate(async () => {
    const api = await import('/src/firebase/service.js'),
      { auth } = await import('/src/firebase/client.js');
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    c.getContext('2d').fillRect(0, 0, 128, 128);
    await api.saveProfilePicture(auth.currentUser.uid, c.toDataURL('image/webp'));
    await api.saveScore(api.newScoreId(), auth.currentUser, 'AvatarQA', {
      score: 1000,
      maxCombo: 1,
      perfect: 1,
      good: 0,
      miss: 47,
    });
  });
  await page.locator('[data-song-board="neon"]').click();
  await page.getByRole('button', { name: 'Comment on AvatarQA score', exact: true }).click();
  await page.getByLabel('Comment', { exact: true }).fill('Avatar comment');
  await page.getByRole('button', { name: 'Post comment', exact: true }).click();
  await expect(page.getByAltText('AvatarQA profile picture')).toBeVisible();
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173' });
  try {
    const other = await context.newPage();
    await registerLogin(other, 'ReaderQA');
    await other.locator('[data-song-board="neon"]').click();
    await other.getByRole('button', { name: 'Comment on AvatarQA score', exact: true }).click();
    await expect(other.getByAltText('AvatarQA profile picture')).toBeVisible();
    await other.getByLabel('Comment', { exact: true }).fill('Initial fallback');
    await other.getByRole('button', { name: 'Post comment', exact: true }).click();
    await expect(
      other.locator('article').filter({ hasText: 'Initial fallback' }).locator('.avatar'),
    ).toHaveText('R');
    await page.getByRole('button', { name: 'Edit comment', exact: true }).click();
    await page.getByLabel('Comment', { exact: true }).fill('Edited avatar comment');
    await page.getByRole('button', { name: 'Save comment', exact: true }).click();
    await expect(other.locator('.comment-list')).toContainText('Edited avatar comment');
    await page.getByRole('button', { name: 'Delete comment', exact: true }).click();
    await expect(other.locator('.comment-list')).not.toContainText('Edited avatar comment');
  } finally {
    await context.close();
  }
  await page.getByRole('button', { name: 'Close comments', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const surface = await page.locator('#settings-dialog .settings-card').evaluate((el) => {
    const s = getComputedStyle(el);
    return { background: s.backgroundColor, border: s.borderTopWidth, shadow: s.boxShadow };
  });
  expect(surface).toEqual({ background: 'rgba(0, 0, 0, 0)', border: '0px', shadow: 'none' });
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page.locator('#settings-status')).toContainText('Settings saved');
  await page.screenshot({ path: 'artifacts/settings-single-surface.png' });
});
