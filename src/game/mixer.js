// Separate buses ensure song volume never changes hit feedback volume.
export async function createMix(context, settings) {
  // Original user-supplied Clcik.mp4; decode its audio track without altering the file.
  // Retain the original synthesized feedback if the sample cannot be loaded.
  const keyboard = await fetch('/audio/Clcik.mp4')
    .then((response) => {
      if (!response.ok) throw new Error('Keyboard sound unavailable');
      return response.arrayBuffer();
    })
    .then((bytes) => context.decodeAudioData(bytes))
    .catch(() => null);
  const music = context.createGain(),
    sfx = context.createGain();
  music.gain.value = settings.musicVolume;
  sfx.gain.value = settings.sfxVolume;
  music.connect(context.destination);
  sfx.connect(context.destination);
  return {
    music,
    hit(lane) {
      if (!settings.sfxVolume || context.state !== 'running') return;
      if (keyboard) {
        const press = context.createBufferSource();
        press.buffer = keyboard;
        press.connect(sfx);
        press.onended = () => press.disconnect();
        press.start();
        return;
      }
      const tone = context.createOscillator(),
        envelope = context.createGain(),
        now = context.currentTime;
      tone.frequency.value = [660, 740, 880, 990][lane];
      envelope.gain.setValueAtTime(0.13, now);
      envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      tone.connect(envelope).connect(sfx);
      tone.start(now);
      tone.stop(now + 0.06);
      tone.onended = () => {
        tone.disconnect();
        envelope.disconnect();
      };
    },
  };
}
