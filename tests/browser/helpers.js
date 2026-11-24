import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
export async function registerLogin(page, prefix = 'Player') {
  const email = `${prefix.toLowerCase()}-${Date.now()}@example.com`,
    password = `BeatSync-${randomUUID()}!`;
  await page.goto('/#register');
  await page.getByLabel('Player name', { exact: true }).fill(prefix);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByRole('heading', { name: 'SONG SELECTION' })).toBeVisible({
    timeout: 20000,
  });
  return { email, password };
}
export function observeAudio() {
  window.audioEdges = [];
  window.resumeSamples = [];
  const resume = AudioContext.prototype.resume;
  AudioContext.prototype.resume = function (...args) {
    if (window.localClock?.context === this)
      window.resumeSamples.push({
        time: this.currentTime - localClock.when,
        at: performance.now(),
      });
    return resume.apply(this, args);
  };
  window.circleSamples = [];
  window.resultCount = 0;
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    window.audioEdges.push([this, dest]);
    return connect.call(this, dest, ...rest);
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
    if (this.buffer.duration < 1) {
      window.sfxStarts = (window.sfxStarts || 0) + 1;
      return start.call(this, when, offset, duration);
    }
    window.audioStarts = (window.audioStarts || 0) + 1;
    window.localClock = {
      context: this.context,
      when,
      offset: offset || 0,
      duration: duration || this.buffer.duration,
      bufferDuration: this.buffer.duration,
      ended: false,
    };
    this.addEventListener('ended', () => {
      window.localClock.ended = true;
      window.localClock.endTime = this.context.currentTime;
    });
    return start.call(this, when, offset, duration);
  };
  const arc = CanvasRenderingContext2D.prototype.arc;
  CanvasRenderingContext2D.prototype.arc = function (x, y, r, a, b, ...rest) {
    if (this.canvas.id === 'notes' && window.localClock) {
      window.lastCircle = {
        x,
        y,
        r,
        a,
        b,
        time: localClock.context.currentTime - localClock.when,
        progress: document.querySelector('progress')?.value,
        height: this.canvas.getBoundingClientRect().height,
        width: this.canvas.getBoundingClientRect().width,
      };
    }
    if (window.captureCircles && this.canvas.id === 'notes')
      window.circleSamples.push({ ...window.lastCircle });
    return arc.call(this, x, y, r, a, b, ...rest);
  };
  new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (node.nodeType === 1 && (node.matches('.result') || node.querySelector('.result')))
          window.resultCount++;
  }).observe(document, { childList: true, subtree: true });
}

// Keep hold regression coverage independent of the tap-only song catalog.
export async function useHoldFixture(page) {
  await page.route('**/beatmaps/monitoring-medium.json', async (route) => {
    const response = await route.fetch();
    const map = await response.json();
    map.notes = [
      { time: 4.326, lane: 0, endTime: 4.871 },
      { time: 4.871, lane: 2, endTime: 6.871 },
    ];
    await route.fulfill({ json: map });
  });
}
