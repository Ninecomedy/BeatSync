import fs from 'node:fs';
const analysis = JSON.parse(fs.readFileSync('artifacts/local-audio-analysis.json'));
const excerpt = JSON.parse(fs.readFileSync('public/beatmaps/monitoring-local.json'));
if (analysis.sha256 !== excerpt.sha256 || analysis.frames.at(-1).time < analysis.duration - 0.1)
  throw new Error('Analyze the complete original recording first');
const peaks = analysis.frames.filter(
  (p, i, f) => i > 0 && i < f.length - 1 && p.flux > f[i - 1].flux && p.flux >= f[i + 1].flux,
);
const leadIn = 4,
  beat = 60 / 132;
const energy = (time) => {
  const f = analysis.frames.filter((p) => Math.abs(p.time - time) < 1);
  return f.reduce((s, p) => s + p.rms, 0) / f.length;
};
// The opening has a different phase. Track local phase, while snapping every note to real onsets.
const sections = [];
for (let start = 0; start < analysis.duration; start += 8) {
  const f = analysis.frames.filter((p) => p.time >= start && p.time < start + 8);
  let re = 0,
    im = 0;
  for (const p of f) {
    re += p.flux * Math.cos((p.time / beat) * 2 * Math.PI);
    im += p.flux * Math.sin((p.time / beat) * 2 * Math.PI);
  }
  sections.push({
    start,
    phase: (Math.atan2(im, re) / 2 / Math.PI) * beat,
    rms: energy(start + 4),
  });
}
const nearest = (time, window = 0.065) =>
  peaks.filter((p) => Math.abs(p.time - time) <= window).sort((a, b) => b.flux - a.flux)[0];
function candidates(hard) {
  const result = [];
  for (const section of sections) {
    const dense = section.rms > 0.19;
    const subdivision = hard && dense ? 2 : 1;
    const step = beat / subdivision;
    for (let n = Math.ceil((section.start - section.phase) / step); ; n++) {
      const grid = n * step + section.phase;
      if (grid >= section.start + 8 || grid >= analysis.duration - 0.2) break;
      const p = nearest(grid);
      if (!p || p.rms < 0.018 || p.flux < 35) continue;
      if (section.rms < 0.09 && n % 2) continue;
      result.push({ ...p, accent: subdivision === 1 || n % 2 === 0 });
      // Short four-note bursts only in strong passages, at measured sixteenth onsets.
      if (hard && dense && n % 16 === 0 && p.flux > 150) {
        for (let j = 1; j < 4; j++) {
          const extra = nearest(p.time + (j * beat) / 4, 0.035);
          if (extra && extra.flux > 65) result.push({ ...extra, accent: false });
        }
      }
    }
  }
  return result
    .sort((a, b) => a.time - b.time)
    .filter((p, i, a) => !i || p.time - a[i - 1].time > 0.07);
}
const normal = [];
const normalLanes = [0, 2, 1, 3, 0, 3, 1, 2];
for (const p of candidates(false)) {
  if (p.time >= 18 && p.time < 54) continue;
  normal.push({ time: +(leadIn + p.time).toFixed(5), lane: normalLanes[normal.length % 8] });
}
// Excerpt times include its old lead-in: convert to source time exactly once, then add the new lead-in.
normal.push(
  ...excerpt.notes.map((n) => ({
    time: +(n.time - excerpt.leadIn + excerpt.clipStart + leadIn).toFixed(5),
    lane: n.lane,
  })),
);
normal.sort((a, b) => a.time - b.time || a.lane - b.lane);
const hard = [];
let index = 0,
  lastChord = -100;
const alternating = [0, 2, 1, 3, 1, 2, 0, 3];
for (const p of candidates(true)) {
  let lane = alternating[index++ % 8];
  const time = +(leadIn + p.time).toFixed(5);
  if (hard.some((n) => n.lane === lane && time - n.time < 0.16)) lane = (lane + 1) % 4;
  if (hard.some((n) => n.lane === lane && time - n.time < 0.16)) continue;
  hard.push({ time, lane });
  if (p.accent && p.flux > 240 && energy(p.time) > 0.15 && p.time - lastChord > beat * 3) {
    const other = lane < 2 ? 2 + (index % 2) : index % 2;
    if (!hard.some((n) => n.lane === other && time - n.time < 0.16)) {
      hard.push({ time, lane: other });
      lastChord = p.time;
    }
  }
}
for (const [difficulty, notes] of [
  ['Normal', normal],
  ['Hard', hard],
]) {
  notes.sort((a, b) => a.time - b.time || a.lane - b.lane);
  const map = {
    id: `monitoring-${difficulty.toLowerCase()}-v1`,
    title: excerpt.title,
    artist: excerpt.artist,
    difficulty,
    bpm: 132,
    clipStart: 0,
    clipDuration: analysis.duration,
    leadIn,
    duration: leadIn + analysis.duration,
    sha256: analysis.sha256,
    notes,
  };
  fs.writeFileSync(
    `public/beatmaps/monitoring-${difficulty.toLowerCase()}.json`,
    JSON.stringify(map, null, 2) + '\n',
  );
  console.log(
    difficulty,
    notes.length,
    'notes',
    notes.filter((n, i) => i && n.time === notes[i - 1].time).length,
    'chords',
  );
}
fs.writeFileSync(
  'artifacts/full-chart-analysis.json',
  JSON.stringify({ duration: analysis.duration, sections }, null, 2),
);
