import {
  loadSettings,
  saveSettings,
  DEFAULT_SETTINGS,
  keyLabel,
  validKey,
} from '../settings/store.js';
export function settingsMarkup(back) {
  return `<main class="settings-screen"><div class="settings-title"><button data-page="${back}" aria-label="Back from Settings" class="outline">←</button><h1><img src="/assets/b8500.png" alt="">SETTINGS</h1></div><form class="glass settings-card" id="settings-form"><section><h2>Gameplay</h2><label class="setting-row" for="note-speed"><span>Note Speed</span><output id="speed-value"></output></label><input id="note-speed" aria-label="Note Speed" type="range" min="0.5" max="2" step="0.1"><p class="hint">Change travel speed without changing hit timing.</p></section><section><h2>Audio</h2><label class="setting-row" for="music-volume"><span>Music Volume</span><output id="music-value"></output></label><input id="music-volume" aria-label="Music Volume" type="range" min="0" max="100" step="1"><label class="setting-row" for="sfx-volume"><span>SFX Volume</span><output id="sfx-value"></output></label><input id="sfx-volume" aria-label="SFX Volume" type="range" min="0" max="100" step="1"></section><section><h2>Key Bindings</h2><p class="hint">Select a lane, then press a key. Each lane needs a different key.</p><div class="binding-grid">${[0, 1, 2, 3].map((i) => `<label>Lane ${i + 1}<input class="key-binding" data-lane="${i}" aria-label="Lane ${i + 1} key" readonly></label>`).join('')}</div></section><p id="settings-status" role="status" aria-live="polite"></p><div class="settings-actions"><button type="button" id="reset-settings" class="outline">Reset to Default</button><button type="submit" class="primary">Save Changes</button></div></form></main>`;
}
export function bindSettings(root, persist = async () => {}) {
  let draft = loadSettings();
  const status = root.querySelector('#settings-status');
  const controls = [
    ['note-speed', 'noteSpeed', 1, 'speed-value'],
    ['music-volume', 'musicVolume', 100, 'music-value'],
    ['sfx-volume', 'sfxVolume', 100, 'sfx-value'],
  ];
  function paint() {
    for (const [id, key, scale, out] of controls) {
      root.querySelector('#' + id).value = draft[key] * scale;
      root.querySelector('#' + out).textContent =
        scale === 1 ? draft[key].toFixed(1) + '×' : Math.round(draft[key] * 100) + '%';
    }
    root.querySelectorAll('.key-binding').forEach((el, i) => (el.value = keyLabel(draft.keys[i])));
  }
  for (const [id, key, scale] of controls)
    root.querySelector('#' + id).oninput = (event) => {
      draft[key] = Number(event.target.value) / scale;
      status.textContent = 'Unsaved changes';
      paint();
    };
  root.querySelectorAll('.key-binding').forEach(
    (el, i) =>
      (el.onkeydown = (event) => {
        if (event.code === 'Tab') return;
        event.preventDefault();
        if (event.ctrlKey || event.altKey || event.metaKey || !validKey(event.code)) {
          status.textContent = 'Choose a letter, number, arrow or punctuation key';
          return;
        }
        if (draft.keys.some((code, j) => j !== i && code === event.code)) {
          status.textContent = 'Each lane needs a different key';
          return;
        }
        draft.keys[i] = event.code;
        status.textContent = 'Unsaved changes';
        paint();
      }),
  );
  root.querySelector('#settings-form').onsubmit = async (event) => {
    event.preventDefault();
    try {
      draft = saveSettings(draft);
      await persist(draft);
      status.textContent = 'Settings saved. Ready for your next game.';
    } catch (error) {
      status.textContent =
        'Saved on this device. Cloud sync failed; retry Save Changes when online.';
    }
  };
  root.querySelector('#reset-settings').onclick = async () => {
    try {
      draft = saveSettings(DEFAULT_SETTINGS);
      paint();
      await persist(draft);
      status.textContent = 'Defaults restored and saved.';
    } catch (error) {
      status.textContent =
        'Saved on this device. Cloud sync failed; retry Save Changes when online.';
    }
  };
  paint();
}
