import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RhythmEngine } from '../src/game/engine.js';
const map = JSON.parse(
  readFileSync(new URL('../public/beatmaps/neon-pulse.json', import.meta.url)),
);
test('beatmap is ordered, has 48 valid notes, and finishes inside the song', () => {
  assert.equal(map.notes.length, 48);
  map.notes.forEach((n, i) => {
    assert.ok(n.lane >= 0 && n.lane <= 3);
    assert.ok(n.time >= 1.8 && n.time < map.duration - 0.15);
    if (i) assert.ok(n.time > map.notes[i - 1].time);
  });
});
test('perfect full run, duplicate hits and wrong lanes', () => {
  const game = new RhythmEngine(map);
  for (const n of map.notes) {
    assert.equal(game.hit((n.lane + 1) % 4, n.time), false);
    assert.equal(game.hit(n.lane, n.time), true);
    assert.equal(game.hit(n.lane, n.time), false);
  }
  assert.deepEqual(game.result(), { score: 48000, maxCombo: 48, perfect: 48, good: 0, miss: 0 });
});
test('timing windows, misses reset combo, late frames catch all missed notes', () => {
  const game = new RhythmEngine(map);
  assert.ok(game.hit(0, 2.06));
  assert.ok(game.hit(1, 2.65));
  game.advance(3.16);
  assert.equal(game.combo, 0);
  assert.equal(game.hit(2, 3.17), false);
  game.advance(map.duration);
  assert.deepEqual(game.result(), { score: 1500, maxCombo: 2, perfect: 1, good: 1, miss: 46 });
});
test('early presses do not consume notes', () => {
  const game = new RhythmEngine(map);
  assert.equal(game.hit(0, 1), false);
  assert.ok(game.hit(0, 2));
});

// Saved data must not introduce NaN travel times, invalid gains or duplicate lanes.
import { DEFAULT_SETTINGS, validateSettings, travelSeconds } from '../src/settings/store.js';
test('settings reject corrupt values and speed changes travel without changing note times', () => {
  const defaults = validateSettings(DEFAULT_SETTINGS);
  assert.throws(() => validateSettings({ ...defaults, keys: ['KeyD', 'KeyD', 'KeyJ', 'KeyK'] }));
  assert.throws(() => validateSettings({ ...defaults, noteSpeed: 0 }));
  assert.throws(() => validateSettings({ ...defaults, musicVolume: NaN }));
  assert.throws(() => validateSettings({ ...defaults, sfxVolume: 1.1 }));
  assert.throws(() => validateSettings({ ...defaults, keys: ['Escape', 'KeyF', 'KeyJ', 'KeyK'] }));
  for (const noteSpeed of [0.5, 1, 2]) {
    const travel = travelSeconds({ ...defaults, noteSpeed });
    const noteTime = 42,
      target = 400;
    assert.equal(target - ((noteTime - noteTime) / travel) * target, target);
    assert.equal(travel, 1.8 / noteSpeed);
  }
  defaults.keys[0] = 'KeyA';
  assert.equal(DEFAULT_SETTINGS.keys[0], 'KeyD');
});

import { parseMania4K } from '../src/game/osu-chart.js';
const osuFixture = `[General]\nMode: 3\nAudioFilename: audio.mp3\n[Difficulty]\nCircleSize: 4\n[Metadata]\nVersion: Test\n[HitObjects]\n64,192,1000,128,0,2000:0:0:0:0:\n448,192,1000,1,0,0:0:0:0:\n192,192,1250,1,0,0:0:0:0:\n320,192,1500,1,0,0:0:0:0:`;
test('native importer rejects standard and other key counts; preserves lanes, chords and exact hold endpoints', () => {
  assert.throws(() => parseMania4K(osuFixture.replace('Mode: 3', 'Mode: 0')));
  assert.throws(() => parseMania4K(osuFixture.replace('CircleSize: 4', 'CircleSize: 7')));
  const result = parseMania4K(osuFixture);
  assert.deepEqual(result.notes, [
    { time: 5, lane: 0, endTime: 6 },
    { time: 5, lane: 3 },
    { time: 5.25, lane: 1 },
    { time: 5.5, lane: 2 },
  ]);
  assert.equal(result.holdCount, 1);
  assert.equal(result.lastEnd, 2);
  assert.equal(result.audioFilename, 'audio.mp3');
});

for (const [level, count, holds, id] of [
  ['medium', 1559, 1275, '4953374'],
  ['hard', 2217, 166, '4917580'],
]) {
  test(`${level}: tap-only chart counts, exact-ms timestamps and scoring`, () => {
    const chart = JSON.parse(
      readFileSync(new URL(`../public/beatmaps/monitoring-${level}.json`, import.meta.url)),
    );
    assert.equal(chart.source.mode, 3);
    assert.equal(chart.source.circleSize, 4);
    assert.equal(chart.source.beatmapSetId, '2299124');
    assert.equal(chart.source.beatmapId, id);
    assert.equal(chart.notes.length, count);
    assert.equal(chart.notes.filter((n) => n.endTime !== undefined).length, 0);
    assert.equal(chart.source.holdCount, holds);
    assert.equal(chart.audioFilename, 'audio.mp3');
    assert.equal(chart.clipDuration, 176.8);
    assert.equal(chart.clipStart, 0);
    const events = [];
    const laneEnds = [0, 0, 0, 0];
    for (const n of chart.notes) {
      assert.ok(n.time >= laneEnds[n.lane]);
      laneEnds[n.lane] = n.endTime ?? n.time;
      assert.ok(
        Math.abs((n.time - chart.leadIn) * 1000 - Math.round((n.time - chart.leadIn) * 1000)) <
          1e-6,
      );
      events.push({ time: n.time, lane: n.lane, release: false });
      if (n.endTime !== undefined) {
        assert.ok(n.endTime > n.time && n.endTime < chart.duration);
        assert.ok(
          Math.abs(
            (n.endTime - chart.leadIn) * 1000 - Math.round((n.endTime - chart.leadIn) * 1000),
          ) < 1e-6,
        );
        events.push({ time: n.endTime, lane: n.lane, release: true });
      }
    }
    events.sort((a, b) => a.time - b.time || Number(b.release) - Number(a.release));
    const game = new RhythmEngine(chart);
    for (const e of events) {
      if (e.release) game.release(e.lane, e.time);
      else assert.ok(game.hit(e.lane, e.time));
    }
    game.advance(chart.duration);
    assert.deepEqual(game.result(), {
      score: count * 1000,
      maxCombo: count,
      perfect: count,
      good: 0,
      miss: 0,
    });
  });
}
test('hold awards once at the tail; early release fails without partial score or rescue', () => {
  const chart = { notes: [{ time: 1, endTime: 2, lane: 0 }] };
  const game = new RhythmEngine(chart);
  assert.ok(game.hit(0, 1));
  assert.equal(game.score, 0);
  game.advance(1.5);
  assert.equal(game.score, 0);
  game.release(0, 1.999);
  assert.equal(game.miss, 1);
  assert.equal(game.hit(0, 2), false);
  game.advance(5);
  assert.equal(game.score, 0);
  assert.equal(game.miss, 1);
  const complete = new RhythmEngine(chart);
  complete.hit(0, 1);
  complete.release(0, 2);
  complete.release(0, 3);
  complete.advance(5);
  assert.equal(complete.score, 1000);
  assert.equal(complete.perfect, 1);
});
test('hold start grade is retained, missed heads and late starts beyond short tails fail', () => {
  const game = new RhythmEngine({
    notes: [
      { time: 1, endTime: 2, lane: 0 },
      { time: 3, endTime: 4, lane: 1 },
      { time: 5, endTime: 5.05, lane: 2 },
    ],
  });
  game.hit(0, 1.1);
  game.advance(2);
  assert.equal(game.good, 1);
  assert.equal(game.score, 500);
  game.advance(4);
  assert.equal(game.miss, 1);
  assert.equal(game.hit(2, 5.1), false);
  assert.equal(game.miss, 2);
});
test('frozen active holds survive re-grip, but missing held keys on resume break only their lanes', () => {
  const game = new RhythmEngine({
    notes: [
      { time: 1, endTime: 3, lane: 0 },
      { time: 1, endTime: 3, lane: 3 },
    ],
  });
  game.hit(0, 1);
  game.hit(3, 1);
  for (let i = 0; i < 10; i++) game.advance(1.5);
  assert.deepEqual(game.activeLanes, [0, 3]);
  assert.equal(game.score, 0);
  game.reconcileHeld(new Set([0, 3]), 1.5);
  assert.equal(game.miss, 0);
  game.reconcileHeld(new Set([0]), 1.5);
  assert.equal(game.miss, 1);
  game.release(0, 3);
  assert.equal(game.score, 1000);
  assert.equal(game.perfect, 1);
});
test('sample-clock rounding at an exact hold tail completes; a real early release still fails', () => {
  const chart = { notes: [{ time: 15.962, endTime: 16.076, lane: 0 }] };
  const exact = new RhythmEngine(chart);
  exact.hit(0, 15.962);
  exact.release(0, 16.075999999999997);
  assert.equal(exact.perfect, 1);
  assert.equal(exact.miss, 0);
  const early = new RhythmEngine(chart);
  early.hit(0, 15.962);
  early.release(0, 16.075);
  assert.equal(early.miss, 1);
  assert.equal(early.score, 0);
});
