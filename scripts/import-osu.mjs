import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseMania4K } from '../src/game/osu-chart.js';
const [chartPath, analysisPath, difficulty] = process.argv.slice(2);
if (!chartPath || !analysisPath || !['Medium', 'Hard'].includes(difficulty))
  throw new Error('Usage: node scripts/import-osu.mjs chart.osu audio-analysis.json Medium|Hard');
const bytes = fs.readFileSync(chartPath),
  leadIn = 4,
  parsed = parseMania4K(bytes.toString('utf8'), leadIn);
const folder = path.dirname(path.resolve(chartPath)),
  audioPath = path.resolve(folder, parsed.audioFilename);
const relative = path.relative(folder, audioPath);
if (relative.startsWith('..') || path.isAbsolute(relative))
  throw new Error('AudioFilename must remain inside the chart folder');
const audioSha = createHash('sha256').update(fs.readFileSync(audioPath)).digest('hex');
const analysis = JSON.parse(fs.readFileSync(analysisPath));
if (
  analysis.sha256 !== audioSha ||
  !Number.isFinite(analysis.duration) ||
  analysis.duration <= parsed.lastEnd
)
  throw new Error('Analyze the referenced audio file before importing');
const { notes: originalNotes, ...source } = parsed;
const notes = originalNotes.map(({ time, lane }) => ({ time, lane }));
const chart = {
  id: `monitoring-${difficulty.toLowerCase()}-taps-v4`,
  title: 'モニタリング',
  artist: 'DECO*27 feat. 初音ミク',
  difficulty,
  stars: difficulty === 'Medium' ? 3.43 : 3.86,
  bpm: 132,
  clipStart: 0,
  clipDuration: analysis.duration,
  leadIn,
  duration: leadIn + analysis.duration,
  sha256: audioSha,
  audioFilename: parsed.audioFilename,
  source: {
    ...source,
    filename: path.basename(chartPath),
    sha256: createHash('sha256').update(bytes).digest('hex'),
    conversion:
      'All original heads become taps; hold ends removed; original lanes and head times preserved; four-second preparation only.',
  },
  notes,
};
fs.writeFileSync(
  `public/beatmaps/monitoring-${difficulty.toLowerCase()}.json`,
  JSON.stringify(chart, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      difficulty: chart.difficulty,
      duration: chart.clipDuration,
      notes: notes.length,
      adaptedHoldStarts: parsed.holdCount,
      first: notes[0],
      last: notes.at(-1),
      beatmapId: chart.source.beatmapId,
    },
    null,
    2,
  ),
);
