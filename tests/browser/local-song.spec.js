import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { registerLogin, observeAudio } from './helpers.js';
for (const difficulty of ['Medium', 'Hard']) {
  const key = difficulty.toLowerCase();
  const audioPath = process.env.BEATSYNC_OSU_AUDIO;
  const map = JSON.parse(readFileSync(`public/beatmaps/monitoring-${key}.json`));
  test(`local MP3 ${difficulty}: full duration, sync beginning/middle/end, one result`, async ({
    page,
  }) => {
    test.setTimeout(240000);
    test.skip(!audioPath, 'Set BEATSYNC_OSU_AUDIO to the matching audio.mp3');
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(observeAudio);
    await registerLogin(page, `Local${key}`);
    await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
    await expect(page.getByLabel('Difficulty', { exact: true })).toHaveValue('hard');
    await page.getByLabel('Difficulty', { exact: true }).selectOption({ label: difficulty });
    const play = page.getByRole('button', { name: 'Play Monitoring' });
    await expect(play).toBeDisabled();
    await page
      .locator('#local-file')
      .setInputFiles({ name: 'wrong.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('wrong') });
    await expect(page.locator('#local-status')).toContainText('ไฟล์ไม่ตรง');
    await expect(play).toBeDisabled();
    await page.locator('#local-file').setInputFiles(audioPath);
    await expect(play).toBeEnabled({ timeout: 15000 });
    await expect(page.getByLabel('Difficulty', { exact: true }).locator('option')).toHaveText([
      'Medium',
      'Hard',
    ]);
    await page
      .getByLabel('Difficulty', { exact: true })
      .selectOption(key === 'hard' ? 'medium' : 'hard');
    await expect(play).toBeEnabled();
    await page.getByLabel('Difficulty', { exact: true }).selectOption(key);
    await expect(page.locator('#required-audio')).toContainText('audio.mp3');
    await page.screenshot({ path: `artifacts/full-${key}-selection.png` });
    await play.click();
    await page.waitForFunction(() => window.localClock && window.lastCircle);
    const clock = await page.evaluate(() => ({
      offset: localClock.offset,
      duration: localClock.duration,
      actual: localClock.bufferDuration,
    }));
    expect(clock.offset).toBe(0);
    expect(clock.duration).toBeCloseTo(map.clipDuration, 4);
    expect(clock.actual).toBeCloseTo(map.clipDuration, 4);
    await page.evaluate((map) => {
      let index = 0;
      const events = map.notes
        .flatMap((n) => [
          { time: n.time, lane: n.lane, type: 'keydown', order: 1, note: n },
          { time: n.endTime ?? n.time, lane: n.lane, type: 'keyup', order: n.endTime ? 0 : 2 },
        ])
        .sort((a, b) => a.time - b.time || a.order - b.order);
      const pauseAt = map.notes[0].time + 0.04;
      const keys = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
      window.syncChecks = [];
      const targets = [
        map.notes.find((n) => n.time > map.leadIn + 5),
        map.notes.find((n) => n.time > map.leadIn + 90),
        map.notes.find((n) => n.time > map.leadIn + 168),
      ];
      const timer = setInterval(() => {
        const time = localClock.context.currentTime - localClock.when + map.leadIn;
        if (localClock.context.state !== 'running') return;
        if (!window.holdPaused && time >= pauseAt) {
          window.holdPaused = true;
          document.querySelector('#pause').click();
          return;
        }
        while (index < events.length && time >= events[index].time) {
          const event = events[index++];
          if (event.note && targets.includes(event.note))
            window.syncChecks.push({
              sourceTime: time - map.leadIn,
              target: event.time - map.leadIn,
              error: time - event.time,
            });
          window.dispatchEvent(new KeyboardEvent(event.type, { code: keys[event.lane] }));
        }
        if (index === events.length) clearInterval(timer);
      }, 4);
    }, map);
    await page.waitForFunction(() => window.holdPaused && localClock.context.state === 'suspended');
    await expect(page.locator('#hold-hint')).toBeHidden();
    const paused = await page.evaluate(() => localClock.context.currentTime);
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => localClock.context.currentTime)).toBe(paused);
    await page.screenshot({ path: `artifacts/full-${key}-hold-paused.png` });
    await page.getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({
      timeout: 5000,
    });
    await page.waitForTimeout(1000);
    const circle = await page.evaluate(() => window.lastCircle);
    expect(circle.b).toBeCloseTo(Math.PI * 2);
    // The recorded circle's center follows the same source clock as scoring.
    const geometry = await page.evaluate(() => {
      const canvas = document.querySelector('#notes').getBoundingClientRect();
      return [...document.querySelectorAll('.keys button')].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left - canvas.left + r.width / 2,
          y: r.top - canvas.top + r.height / 2,
          diameter: r.width,
        };
      });
    });
    const lane = geometry.findIndex((target) => Math.abs(target.x - circle.x) < 1);
    expect(lane).toBeGreaterThanOrEqual(0);
    const target = geometry[lane].y;
    expect(circle.r * 2).toBeCloseTo(geometry[lane].diameter * 0.7, 1);
    const renderedTime = circle.progress * map.duration;
    const note = map.notes.find(
      (n) =>
        n.lane === lane &&
        (Math.abs(target - ((n.time - renderedTime) / 1.8) * target - circle.y) < 2 ||
          (n.endTime > renderedTime && n.time <= renderedTime && Math.abs(target - circle.y) < 2)),
    );
    expect(note).toBeTruthy();
    await page.screenshot({ path: `artifacts/full-${key}-game.png` });
    await expect(page.locator('.result-score')).toBeVisible({ timeout: 200000 });
    await expect(page.locator('.result')).toContainText(difficulty);
    await expect(page.locator('.result')).toContainText('Miss 0');
    await expect(page.locator('.result')).toContainText('คะแนนทดลองเฉพาะรอบนี้');
    const result = await page.evaluate(() => ({
      ended: localClock.ended,
      elapsed: localClock.endTime - localClock.when,
      checks: window.syncChecks,
      count: window.resultCount,
    }));
    expect(result.ended).toBe(true);
    expect(result.elapsed).toBeGreaterThanOrEqual(map.clipDuration - 0.03);
    expect(result.checks).toHaveLength(3);
    for (const check of result.checks) expect(check.error).toBeLessThan(0.06);
    expect(result.count).toBe(1);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.resultCount)).toBe(1);
    const score = Number((await page.locator('.result-score').textContent()).replaceAll(',', ''));
    expect(score).toBeGreaterThan(map.notes.length * 900);
    console.log(difficulty, JSON.stringify({ score, ...result }));
    await page.screenshot({ path: `artifacts/full-${key}-result.png` });
    await page.getByRole('button', { name: 'Play again', exact: true }).click();
    await expect(page.locator('#notes')).toBeVisible();
    await page.getByRole('button', { name: 'Exit Song' }).click();
    await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible();
    await expect(play).toBeEnabled();
    await page.reload();
    await expect(play).toBeDisabled();
    expect(errors).toEqual([]);
  });
}
