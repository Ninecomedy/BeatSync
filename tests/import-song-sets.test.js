import { IMPORTED_SONGS } from '../src/game/imported-songs.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { LOCAL_SONGS, LOCAL_CHARTS, chartUrl } from '../src/game/song-catalog.js';
const manifest = JSON.parse(fs.readFileSync('scripts/song-imports.json', 'utf8'));
const downloads = process.env.BEATSYNC_DOWNLOADS || 'C:/Users/pikac/Downloads';
const expected = {
  yuusha: [
    ['Easy', 1.49, '4331793', 353],
    ['Med', 3.12, '4331794', 813],
    ['Hard', 4.44, '4331792', 1192],
  ],
  hibana: [
    ['Easy', 1.28, '1567254', 656],
    ['Med', 1.94, '1432276', 1011],
    ['Hard', 3.13, '1578289', 1681],
    ['Lunatic', 3.98, '1593446', 2290],
  ],
  mesmerizer: [
    ['Med', 2, '4603030', 946],
    ['Hard', 3.58, '4672485', 1683],
  ],
  'rabbit-hole': [
    ['Hard', 4, '4621071', 2210],
    ['Lunatic', 4.37, '4508345', 2210],
  ],
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
test('exactly 11 explicit assignments; archived import assignments remain intact; Monitoring unchanged', () => {
  let count = 0;
  for (const song of manifest) {
    assert.deepEqual(
      song.charts.map((c) => [c.difficulty, c.stars, c.beatmapId, c.expectedNotes]),
      expected[song.id],
    );
    assert.deepEqual(
      Object.values(IMPORTED_SONGS[song.id].charts).map((c) => c.label),
      expected[song.id].map((c) => c[0]),
    );
    assert.equal(IMPORTED_SONGS[song.id].defaultDifficulty, 'hard');
    count += song.charts.length;
  }
  assert.equal(count, 11);
  const files = fs
    .readdirSync('public/beatmaps')
    .filter((n) => Object.keys(expected).some((id) => n.startsWith(id + '-')));
  assert.equal(files.length, 11);
  assert.deepEqual(Object.keys(LOCAL_CHARTS), ['medium', 'hard']);
  assert.equal(LOCAL_SONGS.monitoring.defaultDifficulty, 'hard');
  assert.equal(chartUrl('medium'), '/beatmaps/monitoring-medium.json');
  assert.throws(() => chartUrl('easy', 'mesmerizer'));
  assert.throws(() => chartUrl('med', 'monitoring'));
});
for (const song of manifest)
  for (const assigned of song.charts) {
    test(`${song.id} ${assigned.difficulty}: exact original heads/chords and matching local audio`, () => {
      const chart = JSON.parse(
        fs.readFileSync(
          'public' + IMPORTED_SONGS[song.id].charts[assigned.difficulty.toLowerCase()].chartPath,
        ),
      );
      const folder = path.join(downloads, 'BeatSync-imports', song.setId);
      const bytes = fs.readFileSync(path.join(folder, chart.source.filename));
      const source = bytes.toString('utf8').replace(/^\uFEFF/, '');
      const field = (name) => source.match(new RegExp('^' + name + ':\\s*(.*?)\\r?$', 'm'))?.[1];
      assert.equal(field('Mode'), '3');
      assert.equal(field('CircleSize'), '4');
      assert.equal(field('BeatmapID'), assigned.beatmapId);
      assert.equal(field('BeatmapSetID'), song.setId);
      assert.equal(field('Version'), assigned.version);
      const objects = source
        .split('[HitObjects]')[1]
        .trim()
        .split(/\r?\n/)
        .map((row) => row.split(','));
      const heads = objects
        .map((row) => ({
          time: Number((4 + Number(row[2]) / 1000).toFixed(3)),
          lane: Math.min(3, Math.floor(Number(row[0]) / 128)),
        }))
        .sort((a, b) => a.time - b.time || a.lane - b.lane);
      assert.deepEqual(chart.notes, heads); // Includes every chord member and exactly one head per hold.
      assert.equal(chart.notes.length, assigned.expectedNotes);
      assert.ok(chart.notes.every((n) => Object.keys(n).sort().join(',') === 'lane,time'));
      assert.equal(chart.source.holdCount, objects.filter((row) => Number(row[3]) & 128).length);
      assert.equal(chart.source.sha256, hash(bytes));
      assert.equal(chart.source.archive, song.archive);
      assert.equal(chart.difficulty, assigned.difficulty);
      assert.equal(chart.stars, assigned.stars);
      assert.equal(Math.floor(chart.source.publishedStars * 100), Math.round(assigned.stars * 100));
      assert.equal(chart.audioFilename, field('AudioFilename'));
      assert.equal(chart.sha256, hash(fs.readFileSync(path.join(folder, chart.audioFilename))));
      assert.equal(chart.clipStart, 0);
      assert.equal(chart.leadIn, 4);
      assert.equal(chart.duration, chart.clipDuration + 4);
      assert.ok(chart.duration > chart.notes.at(-1).time);
      const option = IMPORTED_SONGS[song.id].charts[assigned.difficulty.toLowerCase()];
      assert.equal(option.audioFilename, chart.audioFilename);
      assert.equal(option.noteCount, chart.notes.length);
    });
  }
test('Rabbit Hole speed variants keep different original timelines and audio fingerprints', () => {
  const hard = JSON.parse(
    fs.readFileSync('public' + IMPORTED_SONGS['rabbit-hole'].charts.hard.chartPath),
  );
  const lunatic = JSON.parse(
    fs.readFileSync('public' + IMPORTED_SONGS['rabbit-hole'].charts.lunatic.chartPath),
  );
  assert.equal(hard.audioFilename, 'audio_0.9.mp3');
  assert.equal(lunatic.audioFilename, 'audio.mp3');
  assert.notEqual(hard.sha256, lunatic.sha256);
  assert.notEqual(hard.clipDuration, lunatic.clipDuration);
  assert.notDeepEqual(hard.notes, lunatic.notes);
});
