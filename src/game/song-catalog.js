import { IMPORTED_SONGS } from './imported-songs.js';
export const LOCAL_CHARTS = {
  medium: {
    label: 'Medium',
    stars: 3.43,
    noteCount: 1559,
    audioFilename: 'audio.mp3',
    detail: "3.43★ · [4K] anatha's going insane · 1,559 taps · 2:56.800",
  },
  hard: {
    label: 'Hard',
    stars: 3.86,
    noteCount: 2217,
    audioFilename: 'audio.mp3',
    detail: '3.86★ · [4K] Insane · 2,217 taps · 2:56.800',
  },
};
export const LOCAL_SONGS = {
  monitoring: {
    id: 'monitoring',
    title: 'モニタリング',
    artist: 'DECO*27 feat. 初音ミク',
    playLabel: 'Play Monitoring',
    bpm: 132,
    defaultDifficulty: 'hard',
    audioFolder: 'Downloads/2299124-BeatSync',
    charts: LOCAL_CHARTS,
  },
  ...IMPORTED_SONGS,
  yuusha: { ...IMPORTED_SONGS.yuusha, title: 'Yuusha', playLabel: 'Play Yuusha' },
  // Reuse the original x1.0 asset unchanged; its legacy filename is not a selectable difficulty.
  'rabbit-hole': {
    ...IMPORTED_SONGS['rabbit-hole'],
    charts: {
      hard: {
        ...IMPORTED_SONGS['rabbit-hole'].charts.lunatic,
        label: 'Hard',
        stars: 4.0,
        detail: '4.00★ · x1.0 · 2,210 taps · normal speed',
      },
    },
  },
};
export const getLocalSong = (id) => {
  if (!Object.hasOwn(LOCAL_SONGS, id)) throw new Error('Unknown local song');
  return LOCAL_SONGS[id];
};
export const chartUrl = (key, songId = 'monitoring') => {
  const charts = getLocalSong(songId).charts;
  if (!Object.hasOwn(charts, key)) throw new Error('Unknown difficulty');
  return charts[key].chartPath || `/beatmaps/monitoring-${key}.json`;
};
