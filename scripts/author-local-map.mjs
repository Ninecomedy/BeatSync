import fs from 'node:fs';
const a = JSON.parse(fs.readFileSync('artifacts/local-audio-analysis.json'));
const peaks = a.frames.filter(
  (p, i, f) => i > 0 && i < f.length - 1 && p.flux > f[i - 1].flux && p.flux >= f[i + 1].flux,
);
const notes = [];
const lanes = [0, 1, 2, 3, 1, 2, 0, 3, 2, 1, 3, 0];
for (let beat = 40; beat < 119; beat++) {
  const grid = (beat * 60) / 132 + 0.0078;
  const candidates = peaks.filter((p) => Math.abs(p.time - grid) < 0.065);
  const p = candidates.sort((a, b) => b.flux - a.flux)[0];
  if (p && p.time >= 18 && p.time < 53.7 && p.flux > 30)
    notes.push({ time: +(2 + p.time - 18).toFixed(5), lane: lanes[notes.length % lanes.length] });
}
fs.writeFileSync(
  'public/beatmaps/monitoring-local.json',
  JSON.stringify(
    {
      id: 'monitoring-local-v1',
      title: 'モニタリング',
      artist: 'DECO*27 feat. 初音ミク',
      bpm: 132,
      clipStart: 18,
      clipDuration: 36,
      leadIn: 2,
      duration: 38,
      sha256: a.sha256,
      notes,
    },
    null,
    2,
  ) + '\n',
);
console.log({ notes: notes.length, first: notes[0], last: notes.at(-1) });
