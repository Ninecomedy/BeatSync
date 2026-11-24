import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';
import { parseMania4K } from '../src/game/osu-chart.js';
const manifest = JSON.parse(fs.readFileSync('scripts/song-imports.json', 'utf8'));
const downloads = process.argv[2];
if (!downloads) throw new Error('Usage: node scripts/import-song-sets.mjs path-to-Downloads');
if (manifest.reduce((n, s) => n + s.charts.length, 0) !== 11)
  throw new Error('Expected exactly 11 explicit chart assignments');
const result = spawnSync('python', ['-X', 'utf8', 'scripts/extract-song-imports.py', downloads], {
  encoding: 'utf8',
});
if (result.status !== 0) throw new Error(result.stderr);
const sources = JSON.parse(result.stdout),
  catalog = {},
  durations = new Map(),
  staged = [];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<input type="file">');
  for (const song of manifest) {
    catalog[song.id] = {
      id: song.id,
      title: song.title,
      artist: song.artist,
      playLabel: `Play ${song.title}`,
      defaultDifficulty: 'hard',
      audioFolder: `Downloads/BeatSync-imports/${song.setId}`,
      charts: {},
    };
    for (const selection of song.charts) {
      const source = sources.find(
        (s) => s.songId === song.id && s.beatmapId === selection.beatmapId,
      );
      const raw = fs.readFileSync(source.chartPath),
        parsed = parseMania4K(raw.toString('utf8'), 4);
      if (
        parsed.beatmapId !== selection.beatmapId ||
        parsed.beatmapSetId !== song.setId ||
        parsed.version !== selection.version
      )
        throw new Error('Source identity mismatch');
      const audioBytes = fs.readFileSync(source.audioPath),
        audioSha = sha(audioBytes);
      if (!durations.has(audioSha)) {
        await page.locator('input').setInputFiles(source.audioPath);
        const duration = await page.evaluate(async () => {
          const file = document.querySelector('input').files[0];
          const decoder = new OfflineAudioContext(2, 1, 44100);
          return (await decoder.decodeAudioData(await file.arrayBuffer())).duration;
        });
        durations.set(audioSha, duration);
      }
      const duration = durations.get(audioSha);
      const notes = parsed.notes.map(({ time, lane }) => ({ time, lane }));
      if (
        notes.length !== selection.expectedNotes ||
        duration <= Math.max(parsed.lastEnd, notes.at(-1).time - 4)
      )
        throw new Error('Invalid source count/audio duration');
      const key = selection.difficulty.toLowerCase(),
        chartPath = `/beatmaps/${song.id}-${key}.json`;
      const { notes: originalNotes, ...provenance } = parsed;
      const chart = {
        id: `${song.id}-${key}-taps-v1`,
        title: song.title,
        artist: song.artist,
        difficulty: selection.difficulty,
        stars: selection.stars,
        clipStart: 0,
        clipDuration: duration,
        leadIn: 4,
        duration: duration + 4,
        sha256: audioSha,
        audioFilename: parsed.audioFilename,
        source: {
          ...provenance,
          filename: path.basename(source.chartPath),
          sha256: sha(raw),
          archive: song.archive,
          archiveSha256: source.archiveSha256,
          ratingSource: song.ratingSource,
          publishedStars: selection.publishedStars,
          conversion:
            'All original heads become single taps; tails removed; original lanes and timestamps plus four-second preparation preserved.',
        },
        notes,
      };
      staged.push([`public${chartPath}`, JSON.stringify(chart, null, 2) + '\n']);
      catalog[song.id].charts[key] = {
        label: selection.difficulty,
        stars: selection.stars,
        chartPath,
        audioFilename: parsed.audioFilename,
        noteCount: notes.length,
        detail: `${selection.stars.toFixed(2)}★ · ${selection.version} · ${notes.length.toLocaleString('en-US')} taps`,
      };
      console.log(
        `${song.title} | ${selection.difficulty} ${selection.stars.toFixed(2)}★ | ${selection.version} | ${notes.length} taps (${parsed.holdCount} hold starts)`,
      );
    }
  }
} finally {
  await browser.close();
}
if (staged.length !== 11) throw new Error('Import must produce exactly 11 charts');
for (const [file, data] of staged) fs.writeFileSync(file, data);
fs.writeFileSync(
  'src/game/imported-songs.js',
  '// Generated from the explicit assignments in scripts/song-imports.json.\nexport const IMPORTED_SONGS = ' +
    JSON.stringify(catalog, null, 2) +
    ';\n',
);
console.log('Imported exactly 11 charts; unmatched ratings: none. Audio remains outside Git.');
