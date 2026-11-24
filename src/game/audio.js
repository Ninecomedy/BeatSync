import { createMix } from './mixer.js';
import { DEFAULT_SETTINGS } from '../settings/store.js';
// Original synthesized demo: no external recordings or copyrighted song samples.
export async function createDemoAudio(map, settings = DEFAULT_SETTINGS) {
  const context = new AudioContext();
  await context.resume();
  const buffer = createDemoBuffer(context, map);
  const source = context.createBufferSource();
  source.buffer = buffer;
  const mix = await createMix(context, settings);
  source.connect(mix.music);
  let origin = 0;
  return {
    hit: mix.hit,
    start() {
      origin = context.currentTime + 0.1;
      source.start(origin);
    },
    get time() {
      return Math.max(0, context.currentTime - origin);
    },
    pause: () => context.suspend(),
    resume: () => context.resume(),
    close() {
      source.onended = null;
      try {
        source.stop();
      } catch {}
      return context.close();
    },
  };
}

export function createDemoBuffer(context, map) {
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.ceil(map.duration * sampleRate), sampleRate);
  const samples = buffer.getChannelData(0);
  const addTone = (time, frequency, duration, volume, kick = false) => {
    const start = Math.floor(time * sampleRate);
    for (let i = 0; i < duration * sampleRate && start + i < samples.length; i++) {
      const t = i / sampleRate;
      const phase = kick
        ? 2 * Math.PI * (45 * t + (70 * (1 - Math.exp(-25 * t))) / 25)
        : 2 * Math.PI * frequency * t;
      samples[start + i] +=
        Math.sin(phase) * Math.min(t * 200, 1) * Math.exp(-t * (kick ? 14 : 9)) * volume;
    }
  };
  for (let t = 2; t < map.duration - 1; t += 0.5) addTone(t, 55, 0.3, 0.4, true);
  for (const note of map.notes)
    addTone(note.time, [261.63, 329.63, 392, 523.25][note.lane], 0.32, 0.22);
  return buffer;
}
