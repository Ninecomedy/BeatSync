import { RhythmEngine } from './engine.js';
import { createDemoAudio } from './audio.js';
import { loadSettings, keyLabel, travelSeconds } from '../settings/store.js';
export async function playGame(map, elements, onFinish, onError, audioFactory = createDemoAudio) {
  const settings = loadSettings();
  const KEYS = settings.keys;
  const travel = travelSeconds(settings);
  const audio = await audioFactory(map, settings);
  const engine = new RhythmEngine(map);
  let stopped = false,
    paused = false,
    frame;
  let countdown = 0,
    transition = 0,
    countdownTimer,
    releaseDelay;
  let pauseReady = Promise.resolve();
  const held = new Set();
  const pointerLanes = new Map();
  const laneDown = (lane) => held.has(KEYS[lane]) || [...pointerLanes.values()].includes(lane);
  const showHeld = (lane) => elements.keys[lane].classList.toggle('pressed', laneDown(lane));
  const { canvas, score, combo, judgement, pause, progress } = elements;
  elements.keys.forEach((key, i) => {
    key.textContent = keyLabel(KEYS[i]);
    key.classList.toggle('long-key', key.textContent.length > 1);
    key.setAttribute('aria-label', 'Play lane ' + keyLabel(KEYS[i]));
  });
  canvas.setAttribute('aria-label', 'Falling notes for ' + KEYS.map(keyLabel).join(' '));
  const ctx = canvas.getContext('2d');
  const press = (lane) => {
    if (paused || stopped) return;
    if (engine.hit(lane, audio.time)) audio.hit?.(lane);
    elements.keys[lane].classList.add('pressed');
  };
  const keydown = (event) => {
    if (event.target.closest?.('#settings-dialog')) return;
    const lane = KEYS.indexOf(event.code);
    if (lane < 0) return;
    event.preventDefault();
    if (stopped || event.repeat || held.has(event.code)) return;
    const alreadyDown = laneDown(lane);
    held.add(event.code);
    showHeld(lane);
    if (!alreadyDown) press(lane);
  };
  const keyup = (event) => {
    const lane = KEYS.indexOf(event.code);
    if (lane < 0) return;
    held.delete(event.code);
    if (!paused && !stopped && !laneDown(lane)) engine.release(lane, audio.time);
    showHeld(lane);
  };
  function clearHeld() {
    held.clear();
    pointerLanes.clear();
    elements.keys.forEach((key) => key.classList.remove('pressed'));
  }
  function feedback() {
    judgement.textContent = countdown ? String(countdown) : paused ? 'PAUSED' : engine.judgement;
    judgement.parentElement.dataset.overlay = paused ? 'true' : 'false';
    judgement.parentElement.dataset.countdown = countdown ? 'true' : 'false';
    const hint = document.querySelector('#hold-hint');
    if (hint) {
      const lanes = engine.activeLanes;
      hint.hidden = !paused || !lanes.length;
      hint.textContent =
        'Hold ' + lanes.map((lane) => keyLabel(KEYS[lane])).join(' + ') + ' through Resume';
    }
  }
  function cancelCountdown() {
    clearTimeout(countdownTimer);
    releaseDelay?.();
    releaseDelay = null;
    countdown = 0;
  }
  function freeze() {
    if (stopped) return;
    transition++;
    cancelCountdown();
    paused = true;
    pause.disabled = false;
    pause.textContent = 'Resume';
    feedback();
    pauseReady = audio.pause().catch((error) => {
      if (!stopped) onError(error);
    });
  }
  async function resumeWithCountdown() {
    const token = ++transition;
    pause.textContent = 'Cancel resume';
    await pauseReady;
    for (const number of [3, 2, 1]) {
      if (stopped || token !== transition || document.hidden) return;
      countdown = number;
      feedback();
      await new Promise((resolve) => {
        releaseDelay = resolve;
        countdownTimer = setTimeout(() => {
          releaseDelay = null;
          resolve();
        }, 1000);
      });
    }
    if (stopped || token !== transition || document.hidden) return;
    pause.disabled = true;
    try {
      engine.reconcileHeld(new Set(KEYS.map((_, lane) => lane).filter(laneDown)), audio.time);
      await audio.resume();
      if (stopped) return;
      if (token !== transition || document.hidden) {
        await audio.pause();
        return;
      }
      countdown = 0;
      paused = false;
      pause.textContent = 'Pause';
      feedback();
    } catch (error) {
      if (!stopped) {
        freeze();
        onError(error);
      }
    } finally {
      if (!stopped) pause.disabled = false;
    }
  }
  const hidden = () => {
    if (document.hidden) {
      freeze();
      clearHeld();
    }
  };
  const pauseClick = () => {
    if (stopped) return;
    if (!paused || countdown || pause.textContent === 'Cancel resume') freeze();
    else resumeWithCountdown();
  };
  const pointers = elements.keys.map((key, lane) => {
    const down = (event) => {
      event.preventDefault();
      if (stopped || pointerLanes.has(event.pointerId)) return;
      const alreadyDown = laneDown(lane);
      pointerLanes.set(event.pointerId, lane);
      try {
        key.setPointerCapture(event.pointerId);
      } catch {}
      showHeld(lane);
      if (!alreadyDown) press(lane);
    };
    const up = (event) => {
      if (pointerLanes.get(event.pointerId) !== lane) return;
      pointerLanes.delete(event.pointerId);
      if (!paused && !stopped && !laneDown(lane)) engine.release(lane, audio.time);
      showHeld(lane);
    };
    key.addEventListener('pointerdown', down);
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      key.addEventListener(name, up);
    return () => {
      key.removeEventListener('pointerdown', down);
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
        key.removeEventListener(name, up);
    };
  });
  function stop() {
    if (stopped) return;
    stopped = true;
    transition++;
    cancelCountdown();
    clearHeld();
    cancelAnimationFrame(frame);
    audio.close();
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    document.removeEventListener('visibilitychange', hidden);
    pause.removeEventListener('click', pauseClick);
    pointers.forEach((fn) => fn());
  }
  function draw() {
    if (stopped) return;
    const time = audio.time;
    if (!paused) engine.advance(time);
    score.textContent = engine.score.toLocaleString();
    combo.textContent = engine.combo;
    feedback();
    progress.value = time / map.duration;
    const bounds = canvas.getBoundingClientRect();
    const { width, height } = bounds;
    const ratio = window.devicePixelRatio || 1;
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    // DOM button centers are the targets, including after responsive layout changes.
    const targets = elements.keys.map((key) => {
      const rect = key.getBoundingClientRect();
      return {
        x: rect.left - bounds.left + rect.width / 2,
        y: rect.top - bounds.top + rect.height / 2,
        radius: Math.min(rect.width, rect.height) * 0.35,
      };
    });
    for (const note of engine.notes) {
      if (note.judged) continue;
      const { x, y: target, radius } = targets[note.lane];
      const y = note.active ? target : target - ((note.time - time) / travel) * target;
      const tail =
        note.endTime === undefined ? y : target - ((note.endTime - time) / travel) * target;
      if (Math.max(y, tail) < -radius || Math.min(y, tail) > height + radius) continue;
      ctx.fillStyle = ['#41d4ff', '#b69cff', '#b69cff', '#41d4ff'][note.lane];
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 15;
      if (note.endTime !== undefined) {
        ctx.globalAlpha = note.active ? 0.85 : 0.5;
        ctx.fillRect(
          x - radius * 0.55,
          Math.max(-radius, tail),
          radius * 1.1,
          Math.max(0, y - Math.max(-radius, tail)),
        );
        ctx.globalAlpha = 1;
        ctx.beginPath();
        ctx.arc(x, tail, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      // The note center overlaps the button center exactly at note.time.
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    if (!paused && (audio.finished ?? time >= map.duration)) {
      engine.advance(map.duration);
      stop();
      onFinish(engine.result());
      return;
    }
    frame = requestAnimationFrame(draw);
  }
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);
  document.addEventListener('visibilitychange', hidden);
  pause.addEventListener('click', pauseClick);
  stop.pause = freeze;
  audio.start();
  if (elements.isSettingsOpen?.()) freeze();
  draw();
  return stop;
}
