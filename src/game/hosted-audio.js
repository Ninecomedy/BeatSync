import { createLocalAudio } from './local-audio.js';
export async function loadHostedSong(metadata, map) {
  if (metadata.mode !== 'hosted' || !/^\/audio\/[\w.-]+$/.test(metadata.audioPath))
    throw new Error('Invalid hosted audio path');
  const response = await fetch(metadata.audioPath);
  if (!response.ok) throw new Error('Could not load song audio');
  const bytes = await response.arrayBuffer();
  const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
  if (sha !== metadata.sha256) throw new Error('Hosted audio does not match the song');
  const decoder = new OfflineAudioContext(1, 1, 44100);
  const buffer = await decoder.decodeAudioData(bytes);
  if (Math.abs(buffer.duration - map.duration) > 0.05)
    throw new Error('Hosted audio duration does not match the chart');
  return (chart, settings) =>
    createLocalAudio(
      { buffer, map: { ...chart, clipStart: 0, clipDuration: buffer.duration, leadIn: 0 } },
      settings,
    );
}
