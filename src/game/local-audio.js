import { createMix } from './mixer.js';
import { DEFAULT_SETTINGS } from '../settings/store.js';
// Only File API data is decoded; the recording never goes to a server.
export async function loadLocalSong(file, map) {
  if (!file || file.size > 50 * 1024 * 1024) throw new Error('เลือกไฟล์ MP3 / OGG ขนาดไม่เกิน 50 MB');
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, '0')).join('');
  if (hash !== map.sha256)
    throw new Error(
      `ไฟล์ไม่ตรงกับ Beatmap กรุณาเลือกไฟล์ ${map.audioFilename || 'DECO 27 - モニタリング feat. 初音ミク.mp3'} ต้นฉบับสำหรับระดับนี้`,
    );
  const decoder = new OfflineAudioContext(2, 1, 44100);
  const buffer = await decoder.decodeAudioData(bytes);
  if (Math.abs(buffer.duration - map.clipDuration) > 0.05)
    throw new Error('ความยาวไฟล์เสียงไม่ตรงกับ Beatmap');
  return { buffer, name: file.name, map, sha256: hash };
}
export async function createLocalAudio(song, settings = DEFAULT_SETTINGS) {
  const context = new AudioContext();
  try {
    await context.resume();
  } catch (error) {
    await context.close();
    throw error;
  }
  const source = context.createBufferSource();
  source.buffer = song.buffer;
  const gain = context.createGain();
  const mix = await createMix(context, settings);
  source.connect(gain).connect(mix.music);
  let ended = false;
  source.onended = () => {
    ended = true;
  };
  let origin = 0;
  return {
    hit: mix.hit,
    get finished() {
      return ended;
    },
    start() {
      origin = context.currentTime + 0.1;
      const start = origin + song.map.leadIn;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(1, start + 0.01);
      gain.gain.setValueAtTime(1, start + song.buffer.duration - 0.03);
      gain.gain.linearRampToValueAtTime(0, start + song.map.clipDuration);
      source.start(start, song.map.clipStart, song.map.clipDuration);
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
