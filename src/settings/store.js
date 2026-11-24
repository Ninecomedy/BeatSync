export const DEFAULT_SETTINGS = Object.freeze({
  noteSpeed: 1,
  musicVolume: 1,
  sfxVolume: 0.5,
  keys: Object.freeze(['KeyD', 'KeyF', 'KeyJ', 'KeyK']),
});
const STORAGE_KEY = 'beatsync.settings.v1';
let settingsUid = null;
export function setSettingsUser(uid) {
  settingsUid = uid;
  // Claim the old device-only preferences once; never copy another account's settings.
  if (uid && !localStorage.getItem(STORAGE_KEY + '.migrated')) {
    const old = localStorage.getItem(STORAGE_KEY);
    if (old && !localStorage.getItem(storageKey())) localStorage.setItem(storageKey(), old);
    localStorage.setItem(STORAGE_KEY + '.migrated', uid);
  }
}
const storageKey = () => (settingsUid ? STORAGE_KEY + '.' + settingsUid : STORAGE_KEY);
export const validKey = (code) =>
  /^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Comma|Period|Semicolon|Slash|BracketLeft|BracketRight|Minus|Equal|Backquote|Quote|Backslash)$/.test(
    code,
  );
const KEY_LABELS = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  Space: 'Space',
  Comma: ',',
  Period: '.',
  Semicolon: ';',
  Slash: '/',
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Backquote: '\u0060',
  Quote: "'",
  Backslash: '\\',
};
export const keyLabel = (code) => KEY_LABELS[code] || code.replace(/^Key|^Digit/, '');
export function validateSettings(value) {
  if (!value || !Number.isFinite(value.noteSpeed) || value.noteSpeed < 0.5 || value.noteSpeed > 2)
    throw new Error('Note Speed must be between 0.5 and 2');
  for (const key of ['musicVolume', 'sfxVolume'])
    if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] > 1)
      throw new Error('Volume must be between 0 and 100%');
  if (!Array.isArray(value.keys) || value.keys.length !== 4 || !value.keys.every(validKey))
    throw new Error('Choose four letter, number, arrow or punctuation keys');
  if (new Set(value.keys).size !== 4) throw new Error('Each lane needs a different key');
  return {
    noteSpeed: value.noteSpeed,
    musicVolume: value.musicVolume,
    sfxVolume: value.sfxVolume,
    keys: [...value.keys],
  };
}
export function loadSettings() {
  try {
    return validateSettings(JSON.parse(localStorage.getItem(storageKey())));
  } catch {
    return validateSettings(DEFAULT_SETTINGS);
  }
}
export function saveSettings(value) {
  const settings = validateSettings(value);
  localStorage.setItem(storageKey(), JSON.stringify(settings));
  return settings;
}
export const travelSeconds = (settings) => 1.8 / settings.noteSpeed;
