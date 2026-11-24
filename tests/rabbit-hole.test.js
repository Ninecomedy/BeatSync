import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { LOCAL_SONGS, chartUrl } from '../src/game/song-catalog.js';
test('Rabbit Hole exposes Hard 4.00 only and reuses the unchanged original x1.0 taps/audio', () => {
  const song = LOCAL_SONGS['rabbit-hole'];
  assert.deepEqual(Object.keys(song.charts), ['hard']);
  assert.equal(song.defaultDifficulty, 'hard');
  assert.equal(song.charts.hard.label, 'Hard');
  assert.equal(song.charts.hard.stars, 4);
  assert.equal(chartUrl('hard', 'rabbit-hole'), '/beatmaps/rabbit-hole-lunatic.json');
  assert.throws(() => chartUrl('lunatic', 'rabbit-hole'));
  const map = JSON.parse(fs.readFileSync('public' + chartUrl('hard', 'rabbit-hole')));
  assert.equal(map.source.version, 'x1.0');
  assert.equal(map.source.beatmapId, '4508345');
  assert.equal(map.notes.length, 2210);
  assert.ok(map.notes.every((n) => Object.keys(n).sort().join(',') === 'lane,time'));
  const folder = 'C:/Users/pikac/Downloads/BeatSync-imports/2141937/';
  const raw = fs.readFileSync(folder + map.source.filename, 'utf8');
  const heads = raw
    .split('[HitObjects]')[1]
    .trim()
    .split(/\r?\n/)
    .map((row) => {
      const f = row.split(',');
      return {
        time: Number((4 + Number(f[2]) / 1000).toFixed(3)),
        lane: Math.min(3, Math.floor(Number(f[0]) / 128)),
      };
    })
    .sort((a, b) => a.time - b.time || a.lane - b.lane);
  assert.deepEqual(map.notes, heads); // Every original head/chord, including beginning/middle/end.
  assert.equal(map.audioFilename, 'audio.mp3');
  assert.equal(map.clipDuration, 159);
  assert.equal(map.clipStart, 0);
  assert.equal(
    createHash('sha256')
      .update(fs.readFileSync(folder + 'audio.mp3'))
      .digest('hex'),
    map.sha256,
  );
});
