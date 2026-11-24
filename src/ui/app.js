import { readCachedAudio, cacheAudio } from '../game/audio-cache.js';
import { setSettingsUser, saveSettings, loadSettings } from '../settings/store.js';
import { loadHostedSong } from '../game/hosted-audio.js';
import { emulatorMode } from '../firebase/client.js';
import * as api from '../firebase/service.js';
import { playGame } from '../game/player.js';
import { loadLocalSong, createLocalAudio } from '../game/local-audio.js';
import { settingsMarkup, bindSettings } from './settings.js';
let settingsBack = 'songs';
let leaderboardSong = 'neon';
let leaderboardDifficulty = 'hard';
import { LOCAL_SONGS, getLocalSong, chartUrl, AUDIO_DOWNLOADS } from '../game/song-catalog.js';
let difficulty = 'hard';
let localSongId = 'monitoring';
const localDifficulties = { monitoring: 'hard' };
const songInfo = () => getLocalSong(localSongId);
const localCharts = () => songInfo().charts;
let selectedSong = 'neon';
let localSong = null;
const root = document.querySelector('#app');
const logo = '/assets/500b4.png';
const esc = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const icon = (file, text) => `<img src="/assets/${file}.png" alt="" class="icon">${text}`;
let user,
  profile,
  registering = false,
  page = '',
  subscriptions = [],
  stopGame,
  generation = 0,
  noticeTimer;
function notify(message) {
  const el = document.querySelector('#notice');
  el.textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => (el.textContent = ''), 9000);
}
function errorMessage(error) {
  const messages = {
    'auth/invalid-credential': 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
    'auth/email-already-in-use': 'อีเมลนี้มีบัญชีแล้ว',
    'auth/weak-password': 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร',
    'auth/network-request-failed': 'เชื่อมต่อไม่ได้ กรุณาตรวจเครือข่ายและ Emulator',
    'permission-denied': 'ไม่มีสิทธิ์บันทึกข้อมูล กรุณาตรวจ Firestore Rules',
    'auth/too-many-requests': 'ลองใหม่อีกครั้งภายหลัง',
  };
  return messages[error.code] || error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}
const fail = (error) => notify(errorMessage(error));
async function action(button, task) {
  if (button.disabled) return;
  button.disabled = true;
  try {
    await task();
  } catch (error) {
    fail(error);
  } finally {
    button.disabled = false;
  }
}
function clear() {
  generation++;
  document.querySelector('#settings-dialog')?.close();
  stopGame?.();
  stopGame = null;
  subscriptions.forEach((fn) => fn());
  subscriptions = [];
}
function shell(content, className = '') {
  root.className = className;
  root.innerHTML = `<header><a class="mini-logo" href="#songs" aria-label="BeatSync home"><img src="${logo}" alt="BeatSync"></a><nav aria-label="Main navigation">${user && profile ? `<button data-page="songs">Songs</button><button data-page="profile">${icon('b1a56', 'Profile')}</button><button id="logout">Log out</button>` : ''}<button data-page="settings" class="settings-gear" aria-label="Settings"><img src="/assets/b8500.png" alt=""></button></nav></header>${content}`;
  root.querySelectorAll('[data-page]').forEach((b) => (b.onclick = () => navigate(b.dataset.page)));
  root
    .querySelector('#logout')
    ?.addEventListener('click', (event) => action(event.currentTarget, api.logout));
}
function navigate(next) {
  if (next === 'settings') {
    openSettings();
    return;
  }
  if (next === 'start') next = 'songs';
  location.hash = next;
  if (page === next) render();
}
function authScreen(register = false) {
  shell(
    `<main class="auth-layout ${register ? 'register-layout' : ''}">${register ? '' : `<div class="brand"><img src="${logo}" alt="BeatSync"></div>`}<section class="glass auth-card"><h1>${register ? 'Register' : 'Login'}</h1><form id="auth-form">
    ${register ? '<label class="field"><span>Player name</span><input name="name" aria-label="Player name" placeholder="Player name" required maxlength="24" autocomplete="nickname"></label>' : ''}
    <label class="field"><span>Email</span><input name="email" aria-label="Email" placeholder="Email" type="email" autocomplete="email" required maxlength="254"></label>
    <label class="field password"><span>Password</span><input name="password" aria-label="Password" placeholder="Password" type="password" minlength="6" required autocomplete="${register ? 'new-password' : 'current-password'}"><button type="button" id="show-password" aria-label="Show password">◉</button></label>
    ${register ? '<label class="field"><span>Confirm Password</span><input name="confirm" aria-label="Confirm Password" placeholder="Confirm Password" type="password" required autocomplete="new-password"></label>' : ''}
    <button class="primary wide" type="submit">${register ? 'Create Account' : 'Login'}</button><p id="form-error" role="alert"></p></form><p class="auth-switch">${register ? 'Already have an account? <a href="#login">Login</a>' : 'Don’t have an account? <a href="#register">Sign Up</a>'}</p></section></main>`,
    register ? 'register-page' : 'login-page',
  );
  const form = root.querySelector('form');
  root.querySelector('#show-password').onclick = (event) => {
    const field = form.elements.password;
    field.type = field.type === 'password' ? 'text' : 'password';
    event.currentTarget.setAttribute(
      'aria-label',
      field.type === 'password' ? 'Show password' : 'Hide password',
    );
  };
  form.onsubmit = (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type=submit]');
    action(submit, async () => {
      const data = new FormData(form);
      root.querySelector('#form-error').textContent = '';
      try {
        if (register) {
          if (!data.get('name').trim()) throw new Error('กรุณากรอกชื่อผู้เล่น');
          if (data.get('password') !== data.get('confirm'))
            throw new Error('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
          registering = true;
          const registeredUser = await api.register(
            data.get('name').trim(),
            data.get('email').trim(),
            data.get('password'),
          );
          registering = false;
          await handleAuthUser(registeredUser);
        } else {
          notify('');
          await api.login(data.get('email').trim(), data.get('password'));
        }
      } catch (error) {
        form.querySelector('#form-error').textContent = errorMessage(error);
      } finally {
        registering = false;
      }
    });
  };
}
function openSettings() {
  if (document.querySelector('#settings-dialog')) return;
  stopGame?.pause?.();
  const dialog = document.createElement('dialog');
  dialog.id = 'settings-dialog';
  dialog.className = 'glass settings-dialog';
  dialog.setAttribute('aria-label', 'Settings');
  dialog.innerHTML = settingsMarkup(page);
  document.body.append(dialog);
  const uid = user?.uid;
  bindSettings(dialog, uid ? (settings) => api.saveUserSettings(uid, settings) : async () => {});
  dialog.querySelector('[aria-label="Back from Settings"]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.showModal();
}
function settingsScreen() {
  shell(settingsMarkup(user ? settingsBack : 'login'));
  const uid = user?.uid;
  bindSettings(root, uid ? (settings) => api.saveUserSettings(uid, settings) : async () => {});
}
function songSelectionScreen() {
  const selectionToken = generation;
  shell(
    `<main class="song-selection"><h1><img src="/assets/e3042.png" alt="">SONG SELECTION</h1><div class="selection-grid"><section aria-label="Available songs"><article class="glass song-row" data-song-id="neon"><div class="song-thumbnail" aria-hidden="true">NEON<br>PULSE</div><div class="song-info"><h2>Neon Pulse</h2><p>BeatSync</p><small>Demo · 48 taps · Hosted audio</small></div><button class="outline song-pick" data-select-song="neon" aria-label="Select Neon Pulse">Select</button><button data-song-board="neon" class="song-action" aria-label="Neon Pulse leaderboard">${icon('7fff4', '')}</button><button data-page="game" class="song-action" aria-label="Play Neon Pulse">${icon('9f9a9', '')}</button></article>${Object.values(
      LOCAL_SONGS,
    )
      .map(
        (song) =>
          `<article class="glass song-row catalog-song" data-song-id="${esc(song.id)}"><div class="song-thumbnail" aria-hidden="true">${esc(song.title.slice(0, 2))}</div><div class="song-info"><h2>${esc(song.title)}</h2><p>${esc(song.artist)}</p><div class="song-difficulties">${Object.values(
            song.charts,
          )
            .map(
              (chart) =>
                `<span>${esc(chart.label)} ${chart.stars.toFixed(2)}★ · ${chart.noteCount.toLocaleString()} taps</span>`,
            )
            .join(
              '',
            )}</div></div><button class="outline song-pick" data-select-song="${esc(song.id)}" aria-label="Select ${esc(song.title)}">Select</button><button data-song-board="${esc(song.id)}" class="song-action" aria-label="${esc(song.title)} leaderboard">${icon('7fff4', '')}</button></article>`,
      )
      .join(
        '',
      )}<article class="glass local-song"><label for="local-song-choice">Local song</label><select id="local-song-choice">${Object.values(
      LOCAL_SONGS,
    )
      .map((song) => `<option value="${esc(song.id)}">${esc(song.title)}</option>`)
      .join(
        '',
      )}</select><div class="song-row"><div class="song-thumbnail" aria-hidden="true">LOCAL<br>MP3</div><div class="song-info"><h2>${esc(songInfo().title)}</h2><p>${esc(songInfo().artist)}</p></div><button id="play-local" class="song-action" aria-label="${esc(songInfo().playLabel)}" disabled>▶</button></div><label for="difficulty">Difficulty</label><select id="difficulty">${Object.entries(
      localCharts(),
    )
      .map(([key, chart]) => `<option value="${key}">${esc(chart.label)}</option>`)
      .join(
        '',
      )}</select><p class="chart-info" id="chart-info"></p><p id="required-audio" class="hint"></p><div class="audio-actions"><a id="download-audio" class="outline" target="_blank" rel="noopener noreferrer">Download Audio</a><button id="load-audio" class="outline" type="button">Load Audio</button><button id="change-audio" class="text-button" type="button" hidden>Change Audio</button></div><input id="local-file" type="file" aria-label="Load MP3 or OGG audio" accept=".mp3,.ogg,audio/mpeg,audio/ogg" hidden><p id="local-status" role="status">ไฟล์เสียงจะอยู่ในเบราว์เซอร์ ไม่อัปโหลด</p></article></section><aside class="song-panel selected-song" aria-label="Selected song"><div class="record-art"><img class="record" src="/assets/9e74f.png" alt=""><div class="demo-cover"><span>BEATSYNC ORIGINAL</span><strong>NEON<br>PULSE</strong><span>120 BPM / VOL. 01</span></div></div><h2>Neon Pulse</h2><p>BeatSync</p></aside></div></main>`,
  );
  root.querySelector('.selected-song').append(root.querySelector('.local-song'));
  function showSelection() {
    root.querySelector('.song-selection').dataset.selectedSong = selectedSong;
    root
      .querySelectorAll('[data-song-id]')
      .forEach((card) =>
        card.classList.toggle('selected-track', card.dataset.songId === selectedSong),
      );
    root
      .querySelector('.local-song')
      .classList.toggle('selected-track', selectedSong === localSongId);
    const panel = root.querySelector('.selected-song');
    const local = selectedSong === localSongId;
    panel.querySelector('h2').textContent = local ? songInfo().title : 'Neon Pulse';
    panel.querySelector('p').textContent = local ? songInfo().artist : 'BeatSync';
    const cover = panel.querySelector('.demo-cover');
    cover.dataset.song = selectedSong;
    cover.classList.toggle('local-cover', local);
    cover.innerHTML = local
      ? '<span>LOCAL AUDIO</span><strong>' +
        esc(songInfo().title) +
        '</strong><span>' +
        esc(localCharts()[difficulty].label) +
        '</span>'
      : '<span>BEATSYNC ORIGINAL</span><strong>NEON<br>PULSE</strong><span>120 BPM / VOL. 01</span>';
  }
  root.querySelectorAll('[data-song-board]').forEach((button) => {
    button.onclick = () => {
      leaderboardSong = button.dataset.songBoard;
      leaderboardDifficulty =
        localDifficulties[leaderboardSong] ||
        LOCAL_SONGS[leaderboardSong]?.defaultDifficulty ||
        'normal';
      navigate('leaderboard');
    };
  });
  showSelection();
  const choice = root.querySelector('#difficulty');
  choice.value = difficulty;
  const input = root.querySelector('#local-file');
  const play = root.querySelector('#play-local');
  const status = root.querySelector('#local-status');
  const load = root.querySelector('#load-audio');
  const change = root.querySelector('#change-audio');
  load.onclick = change.onclick = () => {
    input.value = '';
    input.click();
  };
  const ready = (value) => {
    play.disabled = !value;
    load.hidden = value;
    change.hidden = !value;
  };
  const songChoice = root.querySelector('#local-song-choice');
  songChoice.value = localSongId;
  songChoice.onchange = () => {
    localDifficulties[localSongId] = difficulty;
    localSongId = songChoice.value;
    difficulty = localDifficulties[localSongId] || songInfo().defaultDifficulty;
    selectedSong = localSongId;
    choice.innerHTML = Object.entries(localCharts())
      .map(([key, chart]) => `<option value="${esc(key)}">${esc(chart.label)}</option>`)
      .join('');
    choice.value = difficulty;
    root.querySelector('.local-song h2').textContent = songInfo().title;
    root.querySelector('.local-song .song-info p').textContent = songInfo().artist;
    play.setAttribute('aria-label', songInfo().playLabel);
    input.value = '';
    showSelection();
    refreshChoice();
  };

  for (const card of root.querySelectorAll('[data-song-id]')) {
    const select = () => {
      if (card.dataset.songId === 'neon') {
        selectedSong = 'neon';
        showSelection();
      } else {
        songChoice.value = card.dataset.songId;
        songChoice.onchange();
      }
    };
    card.querySelector('[data-select-song]').onclick = select;
    card.onclick = (event) => {
      if (!event.target.closest('button, input, select')) select();
    };
  }
  play.onclick = () => navigate('game-local');
  let request = 0;
  async function refreshChoice() {
    const current = ++request,
      songId = localSongId;
    ready(false);
    const selected = localCharts()[difficulty];
    root.querySelector('#chart-info').textContent = selected.detail;
    root.querySelector('#required-audio').textContent = songId + '.mp3';
    root.querySelector('#download-audio').href = AUDIO_DOWNLOADS[songId];
    status.textContent = 'Checking saved audio…';
    try {
      const response = await fetch(chartUrl(difficulty, songId), { cache: 'no-cache' });
      if (!response.ok) throw new Error('โหลด Beatmap ไม่สำเร็จ');
      const chart = await response.json();
      if (current !== request || selectionToken !== generation) return;
      if (localSong?.sha256 !== chart.sha256) {
        const file = await readCachedAudio(songId);
        if (current !== request || selectionToken !== generation) return;
        if (!file) {
          status.textContent = 'Download audio, then load the MP3/OGG file once.';
          return;
        }
        const restored = await loadLocalSong(file, chart);
        if (current !== request || selectionToken !== generation) return;
        localSong = restored;
      }
      ready(true);
      status.textContent = 'Ready: ' + localSong.name;
    } catch {
      if (current === request && selectionToken === generation)
        status.textContent =
          'Saved audio unavailable. Load Audio to select a matching MP3/OGG file.';
    }
  }
  choice.onchange = () => {
    difficulty = choice.value;
    localDifficulties[localSongId] = difficulty;
    selectedSong = localSongId;
    showSelection();
    input.value = '';
    refreshChoice();
  };
  refreshChoice();
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    const current = ++request,
      songId = localSongId,
      selectedDifficulty = difficulty;
    ready(false);
    status.textContent = 'Checking audio…';
    try {
      const response = await fetch(chartUrl(selectedDifficulty, songId), { cache: 'no-cache' });
      if (!response.ok) throw new Error('โหลด Beatmap ไม่สำเร็จ');
      const song = await loadLocalSong(file, await response.json());
      if (current !== request || selectionToken !== generation) return;
      localSong = song;
      selectedSong = songId;
      showSelection();
      ready(true);
      status.textContent = 'Ready: ' + song.name;
      try {
        await cacheAudio(songId, file);
        if (current === request && selectionToken === generation)
          status.textContent = 'Ready: ' + song.name + ' · Saved on this browser';
      } catch {
        if (current === request && selectionToken === generation)
          status.textContent =
            'Ready for this visit. Browser storage unavailable; load again next time.';
      }
    } catch (error) {
      if (current === request && selectionToken === generation) status.textContent = error.message;
    }
  };
}
async function gameScreen(local = false) {
  if (local && !localSong) {
    navigate('songs');
    return;
  }
  selectedSong = local ? localSongId : 'neon';
  const token = generation;
  shell(
    `<main class="game"><aside class="score-panel"><span>Score</span><strong id="score">0</strong><p>${local ? esc(songInfo().title) : 'Neon Pulse'}</p><small>${local ? (songInfo().bpm ? songInfo().bpm + ' BPM · ' : '') + esc(localCharts()[difficulty].label) : '120 BPM · DEMO'}</small><button id="pause" class="outline">Pause</button><button id="quit" class="text-button">Exit Song</button></aside><section class="highway" aria-label="Four lane rhythm game"><div class="lane-background">${'<i></i>'.repeat(4)}</div><canvas id="notes" aria-label="Falling notes for D F J K"></canvas><div class="keys">${['D', 'F', 'J', 'K'].map((k) => `<button aria-label="Play lane ${k}">${k}</button>`).join('')}</div></section><div class="game-feedback" data-overlay="false"><div id="judgement" aria-live="off">GET READY</div><div class="combo"><strong id="combo">0</strong><span>COMBO</span></div><div id="hold-hint" hidden></div></div><progress id="progress" max="1" value="0" aria-label="Song progress"></progress></main>`,
    'game-page',
  );
  root.querySelector('#quit').onclick = () => {
    clear(); // Stop audio and cancel the countdown before navigating; do not finish/save this run.
    navigate('songs');
  };
  try {
    const metadata = local ? null : await api.getSong('neon-pulse-v1');
    if (!local && !metadata && !emulatorMode) throw new Error('Song catalog is unavailable');
    const path = local
      ? chartUrl(difficulty, localSongId)
      : metadata?.chartPath || '/beatmaps/neon-pulse.json';
    if (!/^\/beatmaps\/[\w.-]+\.json$/.test(path)) throw new Error('Invalid chart path');
    const response = await fetch(path, { cache: 'no-cache' });
    if (!response.ok) throw new Error('โหลด Beatmap ไม่สำเร็จ');
    const map = await response.json();
    if (token !== generation) return;
    if (local && localSong.sha256 !== map.sha256) {
      notify('เลือกไฟล์เสียงที่ตรงกับระดับนี้ก่อนเล่น');
      navigate('songs');
      return;
    }
    const hostedAudio = metadata ? await loadHostedSong(metadata, map) : undefined;
    if (token !== generation) return;
    const runId = api.newScoreId();
    const runSong = local ? localSongId : 'neon-pulse-v1';
    const runDifficulty = local ? difficulty : 'normal';
    const runUser = user,
      runName = profile.name;
    const cleanup = await playGame(
      map,
      {
        isSettingsOpen: () => !!document.querySelector('#settings-dialog[open]'),
        canvas: root.querySelector('canvas'),
        score: root.querySelector('#score'),
        combo: root.querySelector('#combo'),
        judgement: root.querySelector('#judgement'),
        pause: root.querySelector('#pause'),
        progress: root.querySelector('progress'),
        keys: [...root.querySelectorAll('.keys button')],
      },
      (result) => resultScreen(runId, runUser, runName, result, runSong, runDifficulty),
      fail,
      local
        ? (chart, settings) => createLocalAudio({ ...localSong, map: chart }, settings)
        : hostedAudio,
    );
    if (token !== generation) cleanup();
    else stopGame = cleanup;
  } catch (error) {
    fail(error);
    navigate('songs');
  }
}
function resultScreen(runId, runUser, name, result, songId, playedDifficulty) {
  leaderboardSong = songId === 'neon-pulse-v1' ? 'neon' : songId;
  leaderboardDifficulty = playedDifficulty;
  clear();
  shell(
    `<main class="result glass"><p class="eyebrow">TRACK COMPLETE</p><h1>Nice rhythm, ${esc(name)}!</h1><strong class="result-score">${result.score.toLocaleString()}</strong><p>Max Combo ${result.maxCombo} · Perfect ${result.perfect} · Good ${result.good} · Miss ${result.miss}</p><p id="save-state" role="status">กำลังบันทึกคะแนน…</p><button id="retry" class="primary" hidden>Retry save</button><button data-page="leaderboard" class="outline" id="view-board" disabled>View Leaderboard</button><button data-page="songs" class="text-button">Back to Songs</button></main>`,
  );
  const state = root.querySelector('#save-state'),
    retry = root.querySelector('#retry'),
    board = root.querySelector('#view-board');
  async function save() {
    retry.hidden = true;
    try {
      await api.saveScore(runId, runUser, name, result, songId, playedDifficulty);
      state.textContent = 'บันทึกคะแนนแล้ว';
      board.disabled = false;
    } catch (error) {
      state.textContent = errorMessage(error);
      retry.hidden = false;
    }
  }
  retry.onclick = () => action(retry, save);
  save();
}
function leaderboardScreen() {
  const boardSong = LOCAL_SONGS[leaderboardSong];
  const boardTitle = boardSong?.title || 'Neon Pulse';
  shell(
    `<main class="community"><div class="board-heading"><button data-page="songs" class="outline">← Back</button><h1>${icon('7fff4', 'LEADERBOARD')}</h1></div><div class="community-grid"><div><section class="glass board"><div class="table-scroll"><table><thead><tr><th>#</th><th>Player</th><th>Score</th><th>Like / Love</th></tr></thead><tbody id="scores"><tr><td colspan="4">กำลังโหลดคะแนน…</td></tr></tbody></table></div><p class="hint">Top 20 · ${esc(boardTitle)}</p></section><section class="glass chat"><h2>LIVE CHAT</h2><div id="messages" role="log" aria-live="polite"><p class="hint">กำลังเชื่อมต่อ…</p></div><form id="chat-form"><input aria-label="Chat message" placeholder="Type a message…" maxlength="280" required><button aria-label="Send message" type="submit">${icon('88826', '')}</button></form></section></div><aside class="song-panel"><div class="record-art"><img class="record" src="/assets/9e74f.png" alt=""><div class="demo-cover"><span>BEATSYNC ORIGINAL</span><strong>NEON<br>PULSE</strong><span>120 BPM / VOL. 01</span></div></div><h2>Neon Pulse</h2><p>BeatSync · Original synthesized demo</p><div class="glass personal-best"><span>Your best</span><strong id="board-best">—</strong></div><button data-page="game" class="outline">Play again</button></aside></div></main>`,
  );
  if (boardSong) {
    const picker = document.createElement('select');
    picker.setAttribute('aria-label', 'Leaderboard difficulty');
    for (const [key, chart] of Object.entries(boardSong.charts))
      picker.add(new Option(chart.label, key));
    picker.value = leaderboardDifficulty;
    picker.onchange = () => {
      leaderboardDifficulty = picker.value;
      render();
    };
    root.querySelector('.board-heading').append(picker);
    const panel = root.querySelector('.song-panel');
    panel.querySelector('h2').textContent = boardTitle;
    panel.querySelector('p').textContent = boardSong.artist;
    panel.querySelector('.demo-cover').textContent = boardTitle;
    panel.querySelector('button').textContent = 'Choose song';
    panel.querySelector('button').onclick = () => navigate('songs');
  }
  const tbody = root.querySelector('#scores');
  let reactionUnsubs = [];
  subscriptions.push(() => reactionUnsubs.forEach((fn) => fn()));
  subscriptions.push(
    api.watchScores(
      (rows) => {
        reactionUnsubs.forEach((fn) => fn());
        reactionUnsubs = [];
        tbody.innerHTML = rows.length
          ? rows
              .map(
                (row, i) =>
                  `<tr data-score-id="${esc(row.id)}"><td>${row.rank}</td><td><span class="avatar">${esc(row.playerName.slice(0, 1))}</span><span>${esc(row.playerName)}</span></td><td>${row.score.toLocaleString()}</td><td class="reactions"><button data-kind="like" aria-label="Like ${esc(row.playerName)}" aria-pressed="false">Like <span>0</span></button><button data-kind="love" aria-label="Love ${esc(row.playerName)}" aria-pressed="false">♥ <span>0</span></button><button data-comments aria-label="Comment on ${esc(row.playerName)} score">Comment</button></td></tr>`,
              )
              .join('')
          : '<tr><td colspan="4">ยังไม่มีคะแนน เล่นเพลงแรกเพื่อขึ้นอันดับ!</td></tr>';
        rows.forEach((row) => {
          const tr = [...tbody.rows].find((el) => el.dataset.scoreId === row.id);
          reactionUnsubs.push(
            api.watchReactions(
              row.id,
              (reactions) => {
                for (const kind of ['like', 'love']) {
                  const button = tr.querySelector(`[data-kind="${kind}"]`);
                  button.querySelector('span').textContent = reactions.filter(
                    (r) => r[kind],
                  ).length;
                  button.setAttribute(
                    'aria-pressed',
                    String(!!reactions.find((r) => r.id === user.uid)?.[kind]),
                  );
                }
              },
              fail,
            ),
          );
          tr.tabIndex = 0;
          tr.setAttribute('aria-label', 'Comments for ' + row.playerName);
          tr.onclick = (event) => {
            if (!event.target.closest('button')) openComments(row);
          };
          tr.onkeydown = (event) => {
            if (event.target === tr && ['Enter', ' '].includes(event.key)) {
              event.preventDefault();
              openComments(row);
            }
          };
          tr.querySelector('[data-comments]').onclick = () => openComments(row);
          tr.querySelectorAll('[data-kind]').forEach(
            (b) =>
              (b.onclick = () =>
                action(b, () => api.toggleReaction(row.id, user.uid, b.dataset.kind))),
          );
        });
      },
      (error) => {
        tbody.innerHTML = '<tr><td colspan="4">โหลดคะแนนไม่ได้ กรุณาลองเปิดหน้านี้ใหม่</td></tr>';
        fail(error);
      },
      boardSong?.id || 'neon-pulse-v1',
      leaderboardDifficulty,
    ),
  );
  subscriptions.push(
    api.watchBest(
      user.uid,
      (rows) =>
        (root.querySelector('#board-best').textContent = (rows[0]?.score ?? 0).toLocaleString()),
      fail,
      boardSong?.id || 'neon-pulse-v1',
      leaderboardDifficulty,
    ),
  );
  const messages = root.querySelector('#messages');
  subscriptions.push(
    api.watchChat((rows) => {
      const nearBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 50;
      messages.innerHTML = rows.length
        ? rows
            .map(
              (row) =>
                `<article><span class="avatar">${esc(row.playerName.slice(0, 1))}</span><div><strong>${esc(row.playerName)}</strong> <time>${row.createdAt?.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) ?? 'ส่ง…'}</time><p>${esc(row.text)}</p></div></article>`,
            )
            .join('')
        : '<p class="hint">เริ่มพูดคุยกับผู้เล่นคนอื่นได้เลย</p>';
      if (nearBottom) messages.scrollTop = messages.scrollHeight;
    }, fail),
  );
  const form = root.querySelector('#chat-form');
  form.onsubmit = (event) => {
    event.preventDefault();
    const input = form.querySelector('input');
    const text = input.value.trim();
    if (!text) return;
    action(form.querySelector('button'), async () => {
      await api.sendMessage(user.uid, profile.name, text);
      input.value = '';
    });
  };
}
function openComments(score) {
  const dialog = document.createElement('dialog');
  dialog.className = 'glass comments-dialog';
  dialog.innerHTML = `<div class="comments-header"><h2>Comments · ${esc(score.playerName)}</h2><button class="outline close-comments">Close comments</button></div><div class="comment-list" role="log"></div><form><label>Comment<input aria-label="Comment" maxlength="280" required></label><button type="submit" class="primary">Post comment</button><p role="status"></p></form>`;
  root.append(dialog);
  let editing = null;
  const input = dialog.querySelector('input'),
    submit = dialog.querySelector('[type=submit]');
  const avatars = new Map();
  const unsub = api.watchComments(
    score.id,
    (rows) => {
      dialog.querySelector('.comment-list').innerHTML =
        rows
          .map(
            (row) =>
              `<article data-comment-id="${esc(row.id)}"><div class="comment-author"><span class="avatar" data-author="${esc(row.uid)}">${esc(row.playerName.slice(0, 1))}</span><strong>${esc(row.playerName)}</strong></div><p>${esc(row.text)}</p>${row.uid === user.uid ? '<button class="edit-comment">Edit comment</button><button class="delete-comment">Delete comment</button>' : ''}</article>`,
          )
          .join('') || '<p>No comments yet</p>';
      for (const row of rows) {
        if (!avatars.has(row.uid))
          avatars.set(
            row.uid,
            api.getCommentAvatar(row.uid).catch(() => null),
          );
        avatars.get(row.uid).then((photo) => {
          if (!photo || !dialog.isConnected) return;
          for (const avatar of dialog.querySelectorAll('[data-author]')) {
            if (avatar.dataset.author !== row.uid) continue;
            const image = document.createElement('img');
            image.src = photo;
            image.alt = row.playerName + ' profile picture';
            image.onerror = () => {
              avatar.textContent = row.playerName.slice(0, 1);
            };
            avatar.replaceChildren(image);
          }
        });
      }
      for (const row of rows.filter((r) => r.uid === user.uid)) {
        const article = [...dialog.querySelectorAll('article')].find(
          (el) => el.dataset.commentId === row.id,
        );
        article.querySelector('.edit-comment').onclick = () => {
          editing = row.id;
          input.value = row.text;
          submit.textContent = 'Save comment';
          input.focus();
        };
        article.querySelector('.delete-comment').onclick = () =>
          action(article.querySelector('.delete-comment'), () =>
            api.removeComment(score.id, row.id),
          );
      }
    },
    fail,
  );
  subscriptions.push(unsub);
  dialog.querySelector('.close-comments').onclick = () => dialog.close();
  dialog.onclose = () => {
    unsub();
    dialog.remove();
  };
  dialog.querySelector('form').onsubmit = (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    const submittedId = editing,
      submittedText = input.value;
    action(submit, async () => {
      if (submittedId) await api.editComment(score.id, submittedId, submittedText);
      else await api.addComment(score.id, user.uid, profile.name, submittedText);
      // A live snapshot can offer Edit before this write acknowledgement arrives.
      if (editing === submittedId && input.value === submittedText) {
        editing = null;
        input.value = '';
        submit.textContent = 'Post comment';
      }
    });
  };
  dialog.showModal();
}
function scoreDescription(row) {
  const song = row && LOCAL_SONGS[row.songId];
  return {
    title: row?.songId === 'neon-pulse-v1' ? 'Neon Pulse' : song?.title || 'Unknown song',
    difficulty:
      row?.songId === 'neon-pulse-v1' && !row.difficulty
        ? 'Normal'
        : song?.charts[row?.difficulty]?.label ||
          (row?.difficulty === 'normal' ? 'Normal' : row?.difficulty || 'Unspecified difficulty'),
  };
}
function profileScreen() {
  shell(
    `<main class="profile"><h1>${icon('b1a56', 'PROFILE')}</h1><div class="profile-layout"><div class="profile-avatar">${profile.photo ? `<img src="${esc(profile.photo)}" alt="Profile picture" width="128" height="128" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : esc(profile.name.slice(0, 1))}</div><section><h2>${esc(profile.name)}</h2><p>Feel the Beat · Sync Your World</p><div class="profile-stats"><div class="glass profile-stat">${icon('7fff4', '')}<div><strong id="best-score">—</strong><p id="best-score-title">Highest Score</p><p id="best-score-song" class="hint" aria-live="polite">Loading…</p></div></div><div class="glass profile-stat">${icon('7fff4', '')}<div><strong id="best-placement">—</strong><p id="best-placement-title">Best Placement</p><p id="best-placement-song" class="hint" aria-live="polite">Loading…</p></div></div></div><button data-page="songs" class="outline">Song Selection</button></section></div></main>`,
  );
  subscriptions.push(
    api.watchBest(
      user.uid,
      (rows) => {
        const best = rows[0],
          details = scoreDescription(best);
        root.querySelector('#best-score').textContent = (best?.score ?? 0).toLocaleString();
        root.querySelector('#best-score-title').textContent = best
          ? 'Highest Score · ' + details.title
          : 'Highest Score';
        root.querySelector('#best-score-song').textContent = best
          ? details.difficulty
          : 'No completed scores yet';
      },
      fail,
    ),
  );
  subscriptions.push(
    api.watchPlacement(
      user.uid,
      (best) => {
        const details = scoreDescription(best);
        root.querySelector('#best-placement').textContent = best ? '#' + best.rank : '—';
        root.querySelector('#best-placement-title').textContent = best
          ? 'Best Placement · ' + details.title
          : 'Best Placement';
        root.querySelector('#best-placement-song').textContent = best
          ? details.difficulty
          : 'No completed scores yet';
      },
      (error) => {
        root.querySelector('#best-placement-song').textContent = 'Placement unavailable';
        fail(error);
      },
    ),
  );
}
function recoverProfile() {
  shell(
    '<main class="auth-layout register-layout"><form class="glass auth-card" id="recover"><h1>Complete your profile</h1><label>Player name<input name="name" required maxlength="24"></label><button class="primary">Save profile</button></form></main>',
  );
  root.querySelector('form').onsubmit = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    action(form.querySelector('button'), async () => {
      const name = form.elements.name.value.trim();
      if (!name) throw new Error('กรุณากรอกชื่อ');
      profile = await api.ensureProfile(user, name);
      navigate('songs');
      render();
    });
  };
}
function render() {
  clear();
  page = location.hash.slice(1) || (user ? 'songs' : 'login');
  if (page === 'settings') {
    settingsScreen();
    return;
  }
  if (!user) {
    authScreen(page === 'register');
    return;
  }
  if (!profile) {
    recoverProfile();
    return;
  }
  (
    ({
      songs: songSelectionScreen,
      settings: settingsScreen,
      leaderboard: leaderboardScreen,
      profile: profileScreen,
      game: gameScreen,
      'game-local': () => gameScreen(true),
    })[page] || songSelectionScreen
  )();
}
let authVersion = 0;
async function handleAuthUser(nextUser) {
  if (registering) return;
  const version = ++authVersion;
  clear();
  user = nextUser;
  setSettingsUser(user?.uid || null);
  profile = null;
  if (user) {
    try {
      const uid = user.uid;
      profile = await api.ensureProfile(user);
      if (version !== authVersion) return;
      try {
        const savedSettings = await api.loadUserSettings(uid, loadSettings());
        if (version !== authVersion) return;
        saveSettings(savedSettings);
      } catch {
        if (version === authVersion)
          notify('Using settings saved on this device; cloud sync unavailable');
      }
    } catch (error) {
      fail(error);
    }
    if (version !== authVersion) return;
    if (['login', 'register', 'start', ''].includes(location.hash.slice(1)))
      location.hash = 'songs';
  }
  render();
}
export async function mount() {
  window.addEventListener('hashchange', render);
  api.observeAuth(handleAuthUser);
}
