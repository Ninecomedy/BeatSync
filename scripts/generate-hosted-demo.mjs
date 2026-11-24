import { LOCAL_SONGS } from '../src/game/song-catalog.js';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createDemoBuffer } from '../src/game/audio.js';
const map = JSON.parse(fs.readFileSync('public/beatmaps/neon-pulse.json'));
const context = {
  sampleRate: 44100,
  createBuffer(channels, length, rate) {
    const samples = new Float32Array(length);
    return { samples, getChannelData: () => samples };
  },
};
const { samples } = createDemoBuffer(context, map);
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write('RIFF');
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(44100, 24);
wav.writeUInt32LE(88200, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples.length * 2, 40);
samples.forEach((sample, i) =>
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + i * 2),
);
fs.mkdirSync('public/audio', { recursive: true });
fs.writeFileSync('public/audio/neon-pulse.wav', wav);
const catalog = {
  'neon-pulse-v1': {
    title: 'Neon Pulse',
    artist: 'BeatSync',
    mode: 'hosted',
    audioPath: '/audio/neon-pulse.wav',
    chartPath: '/beatmaps/neon-pulse.json',
    duration: map.duration,
    sha256: createHash('sha256').update(wav).digest('hex'),
    rights: 'Original synthesized BeatSync demo',
  },
  monitoring: {
    title: 'モニタリング',
    mode: 'local',
    audioFilename: 'audio.mp3',
    charts: { medium: '/beatmaps/monitoring-medium.json', hard: '/beatmaps/monitoring-hard.json' },
    counts: {
      medium: JSON.parse(fs.readFileSync('public/beatmaps/monitoring-medium.json')).notes.length,
      hard: JSON.parse(fs.readFileSync('public/beatmaps/monitoring-hard.json')).notes.length,
    },
    defaultDifficulty: 'hard',
  },
};
for (const song of Object.values(LOCAL_SONGS).filter((song) => song.id !== 'monitoring')) {
  catalog[song.id] = {
    title: song.title,
    artist: song.artist,
    mode: 'local',
    defaultDifficulty: song.defaultDifficulty,
    charts: Object.fromEntries(Object.entries(song.charts).map(([key, c]) => [key, c.chartPath])),
    audioFilenames: Object.fromEntries(
      Object.entries(song.charts).map(([key, c]) => [key, c.audioFilename]),
    ),
    counts: Object.fromEntries(Object.entries(song.charts).map(([key, c]) => [key, c.noteCount])),
    labels: Object.fromEntries(Object.entries(song.charts).map(([key, c]) => [key, c.label])),
    stars: Object.fromEntries(Object.entries(song.charts).map(([key, c]) => [key, c.stars])),
  };
}
fs.writeFileSync('scripts/song-metadata.json', JSON.stringify(catalog, null, 2) + '\n');
console.log('Generated original Neon Pulse static audio and song metadata');
