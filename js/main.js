// SNOWBALL SLINGER — screens, level map, progress, leaderboard wiring.
// The 3D scene runs behind every screen; js/game.js owns actual play.

import { LEVELS, AMMO, LOCALE_INFO } from './levels.js';
import { createRenderer } from './render.js';
import { createGame } from './game.js';
import { sound } from './audio.js';
import {
  lbEnabled, getName, submitScore, renamePlayer, fetchTop, monthLabel, playerId,
} from './leaderboard.js';

const $ = (id) => document.getElementById(id);
const LS_PROGRESS = 'snowball-slinger.progress';

const AMMO_CLASS = { snow: 'am-snow', slush: 'am-slush', ice: 'am-ice' };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------- progress
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(LS_PROGRESS)) || { levels: {} }; }
  catch { return { levels: {} }; }
}
function saveProgress(p) { localStorage.setItem(LS_PROGRESS, JSON.stringify(p)); }
let progress = loadProgress();
const bestFor = (i) => progress.levels[i] || null;
const isUnlocked = (i) => i === 0 || !!bestFor(i - 1);
const totalBest = () => Object.values(progress.levels).reduce((s, l) => s + l.score, 0);
const totalStars = () => Object.values(progress.levels).reduce((s, l) => s + l.stars, 0);

// ------------------------------------------------------------ 3D + game
const canvas = $('game');
const renderer = createRenderer(canvas);

const ui = {
  onScore(total, delta, screenPos) {
    $('score').textContent = total.toLocaleString();
    if (delta) {
      $('score').classList.remove('pop'); void $('score').offsetWidth;
      $('score').classList.add('pop');
      if (screenPos) floatText(`+${delta.toLocaleString()}`, screenPos);
    }
  },
  onAmmo(queue) {
    const row = $('ammoRow');
    row.innerHTML = '';
    queue.forEach((type, i) => {
      const dot = document.createElement('span');
      dot.className = `ammo-dot ${AMMO_CLASS[type]}${i === 0 ? ' loaded' : ''}`;
      dot.title = AMMO[type].label;
      row.appendChild(dot);
    });
  },
  onLoaded(type) {
    $('ammoName').textContent = AMMO[type].label.toUpperCase();
  },
  onWin(r) { onLevelWon(r); },
  onLose(r) {
    setTimeout(() => {
      $('failScore').textContent = r.score.toLocaleString();
      show('fail');
    }, 700);
  },
};
const game = createGame(canvas, renderer, ui);

function floatText(text, { x, y }) {
  const el = document.createElement('div');
  el.className = 'float-pts';
  el.textContent = text;
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// --------------------------------------------------------------- screens
const SCREENS = ['menu', 'map', 'clear', 'fail'];
function show(name) {
  for (const s of SCREENS) $(s).classList.toggle('hidden', s !== name);
  $('hud').classList.toggle('hidden', name !== null);
}
function showGameHud() {
  for (const s of SCREENS) $(s).classList.add('hidden');
  $('hud').classList.remove('hidden');
}

function startLevel(i) {
  sound.unlock(); sound.blip();
  showGameHud();
  $('levelName').textContent = `${i + 1}. ${LEVELS[i].name}`;
  game.start(i);
  showPlacard(LEVELS[i].locale);
  // The dotted aim line is a teaching aid on levels 1-3 only. Say so once, on
  // the first level without it, so its absence doesn't read as a bug.
  const aimLineGone = !LEVELS[i].hint && i > 0 && LEVELS[i - 1].hint;
  if (aimLineGone && !progress.aimTipSeen) {
    progress.aimTipSeen = true;
    saveProgress(progress);
    toast(LEVELS[i].blurb, 'Training wheels off: no more dotted aim line. Eyeball it.');
  } else {
    toast(LEVELS[i].blurb);
  }
}

// Locale placard: a brief "BATTERY PARK · GOLDEN HOUR" chip at level intro.
let placardTimer = null;
function showPlacard(locale) {
  const el = $('placard');
  const info = LOCALE_INFO[locale];
  el.textContent = `${info.name} · ${info.time}`.toUpperCase();
  clearTimeout(placardTimer);
  el.classList.remove('hidden', 'fading');
  if (!reducedMotion) { void el.offsetWidth; } // restart the entrance animation
  placardTimer = setTimeout(() => {
    if (reducedMotion) { el.classList.add('hidden'); return; } // plain show/hide
    el.classList.add('fading');
    placardTimer = setTimeout(() => el.classList.add('hidden'), 450);
  }, 2000);
}

// Extra arguments queue up and play one after another.
let toastTimer = null;
let toastQueue = [];
function toast(text, ...rest) {
  toastQueue = rest;
  showToast(text);
}
function showToast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (toastQueue.length) { showToast(toastQueue.shift()); return; }
    el.classList.add('hidden');
  }, 3200);
}

// -------------------------------------------------------------- level map
function buildMap() {
  const grid = $('mapGrid');
  grid.innerHTML = '';
  let lastLocale = null;
  LEVELS.forEach((lv, i) => {
    if (lv.locale !== lastLocale) {
      lastLocale = lv.locale;
      const h = document.createElement('div');
      h.className = 'map-locale';
      h.textContent = LOCALE_INFO[lv.locale].name;
      grid.appendChild(h);
    }
    const best = bestFor(i);
    const unlocked = isUnlocked(i);
    const btn = document.createElement('button');
    btn.className = `map-card${unlocked ? '' : ' locked'}`;
    const stars = best ? '★'.repeat(best.stars) + '☆'.repeat(3 - best.stars) : '☆☆☆';
    btn.innerHTML = `<span class="mc-num">${unlocked ? i + 1 : '🔒'}</span>`
      + `<span class="mc-stars">${unlocked ? stars : ''}</span>`
      + `<span class="mc-name">${lv.name}</span>`;
    if (unlocked) btn.addEventListener('click', () => startLevel(i));
    grid.appendChild(btn);
  });
  $('mapTotal').textContent = totalBest().toLocaleString();
  $('mapStars').textContent = `${totalStars()} / ${LEVELS.length * 3} ★`;
}

// --------------------------------------------------------------- win/lose
function onLevelWon({ levelIndex, score, stars, bonus, shots }) {
  const prev = bestFor(levelIndex);
  const improved = !prev || score > prev.score;
  if (improved) {
    progress.levels[levelIndex] = { score, stars: Math.max(stars, prev?.stars || 0) };
  } else if (stars > prev.stars) {
    progress.levels[levelIndex] = { score: prev.score, stars };
  }
  saveProgress(progress);
  submitTotal();

  setTimeout(() => {
    $('clearTitle').textContent = ['', 'FORT TOPPLED!', 'GREAT SLINGING!', 'MAPLE PERFECT!'][stars];
    $('clearScore').textContent = score.toLocaleString();
    $('clearBonus').textContent = bonus ? `includes +${bonus.toLocaleString()} for unused snowballs` : 'no snowballs to spare!';
    $('clearBest').textContent = `level best ${progress.levels[levelIndex].score.toLocaleString()} · total ${totalBest().toLocaleString()}`;
    const starEls = [...document.querySelectorAll('#clearStars .st')];
    starEls.forEach((el, i) => {
      el.classList.remove('lit', 'bounce');
      if (i < stars) setTimeout(() => { el.classList.add('lit', 'bounce'); sound.sparkle(); }, 350 + i * 380);
    });
    $('nextBtn').classList.toggle('hidden', levelIndex >= LEVELS.length - 1);
    $('nextBtn').dataset.next = levelIndex + 1;
    $('clearReplay').dataset.level = levelIndex;
    show('clear');
  }, 900);
}

// ------------------------------------------------------------ leaderboard
const lbBox = $('lb'), lbList = $('lbList'), lbStatus = $('lbStatus');
const lbForm = $('lbForm'), lbNameInput = $('lbNameInput');
let lbMonthOffset = 0;

if (lbEnabled()) {
  lbBox.classList.remove('hidden');
  $('lbThisBtn').textContent = `🏆 ${monthLabel(0).toUpperCase()}`;
  $('lbLastBtn').textContent = monthLabel(-1).toUpperCase();
}

async function submitTotal() {
  const total = totalBest();
  if (!lbEnabled() || total <= 0) return;
  if (!getName()) return; // the map screen's name form will send it later
  try { await submitScore(total); } catch { /* offline */ }
}

async function renderBoard() {
  if (!lbEnabled()) return;
  lbForm.classList.toggle('hidden', !!getName());
  $('lbRenameBtn').classList.toggle('hidden', !getName());
  lbStatus.textContent = getName() ? 'Loading…' : 'Pick a name to join the monthly leaderboard!';
  if (!getName()) { lbList.innerHTML = ''; return; }
  try {
    const rows = await fetchTop(lbMonthOffset);
    const me = playerId();
    lbList.innerHTML = '';
    rows.slice(0, 10).forEach((r, i) => {
      const li = document.createElement('li');
      if (r.player_id === me) li.className = 'me';
      const medal = ['🥇', '🥈', '🥉'][i];
      li.innerHTML = '<span class="rank"></span><span class="nm"></span><span class="sc"></span>';
      li.querySelector('.rank').textContent = medal || String(i + 1);
      li.querySelector('.nm').textContent = r.name;
      li.querySelector('.sc').textContent = r.score.toLocaleString();
      lbList.appendChild(li);
    });
    const myRank = rows.findIndex((r) => r.player_id === me);
    const when = lbMonthOffset === 0 ? 'this month' : `in ${monthLabel(-1)}`;
    lbStatus.textContent = rows.length === 0
      ? `No scores yet ${when} — be the first!`
      : myRank >= 0 ? `You're #${myRank + 1} of ${rows.length} ${when}` : '';
  } catch {
    lbStatus.textContent = 'Leaderboard unavailable (offline?)';
  }
}

$('lbSaveBtn').addEventListener('click', async () => {
  const name = lbNameInput.value.trim();
  if (!name) { lbNameInput.focus(); return; }
  sound.unlock(); sound.blip();
  try {
    await renamePlayer(name);
    await submitTotal();
  } catch { /* offline */ }
  renderBoard();
});
lbNameInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') $('lbSaveBtn').click();
});
$('lbRenameBtn').addEventListener('click', () => {
  sound.unlock(); sound.blip();
  lbNameInput.value = getName();
  lbForm.classList.remove('hidden');
  $('lbRenameBtn').classList.add('hidden');
  lbNameInput.focus();
});
$('lbThisBtn').addEventListener('click', () => {
  lbMonthOffset = 0;
  $('lbThisBtn').classList.add('sel'); $('lbLastBtn').classList.remove('sel');
  renderBoard();
});
$('lbLastBtn').addEventListener('click', () => {
  lbMonthOffset = -1;
  $('lbLastBtn').classList.add('sel'); $('lbThisBtn').classList.remove('sel');
  renderBoard();
});

// ---------------------------------------------------------------- buttons
$('playBtn').addEventListener('click', () => {
  sound.unlock(); sound.blip();
  // jump straight in the first time; show the map once there's progress
  if (!bestFor(0)) startLevel(0);
  else { buildMap(); renderBoard(); show('map'); }
});
$('menuMapBtn').addEventListener('click', () => {
  sound.unlock(); sound.blip();
  buildMap(); renderBoard(); show('map');
});
$('mapBackBtn').addEventListener('click', () => { sound.blip(); show('menu'); });
$('hudMapBtn').addEventListener('click', () => {
  sound.blip(); game.stop(); buildMap(); renderBoard(); show('map');
});
$('hudRetryBtn').addEventListener('click', () => {
  sound.blip(); const i = game.levelIndex; game.stop(); startLevel(i);
});
$('nextBtn').addEventListener('click', (e) => startLevel(Number(e.currentTarget.dataset.next)));
$('clearReplay').addEventListener('click', (e) => startLevel(Number(e.currentTarget.dataset.level)));
$('clearMapBtn').addEventListener('click', () => { sound.blip(); buildMap(); renderBoard(); show('map'); });
$('failRetryBtn').addEventListener('click', () => { sound.blip(); startLevel(game.levelIndex); });
$('failMapBtn').addEventListener('click', () => { sound.blip(); buildMap(); renderBoard(); show('map'); });

$('shareBtn').addEventListener('click', async () => {
  const text = `I won back ${totalStars()} ⭐ of maple candy in SNOWBALL SLINGER, Btown's slingshot showdown! ${location.href}`;
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast('Copied to clipboard!'); }
  } catch { /* dismissed */ }
});

const muteBtn = $('mute');
muteBtn.textContent = sound.muted ? '🔇' : '🔊';
muteBtn.addEventListener('click', () => {
  sound.unlock();
  sound.setMuted(!sound.muted);
  muteBtn.textContent = sound.muted ? '🔇' : '🔊';
});

// --------------------------------------------------------------- boot
// live scene behind the title screen; ?og poses the grand finale fort with no
// UI so tools/og.html can screenshot it for the social image
const ogMode = location.search.includes('og');
import('./sim.js').then(({ createSim }) => {
  if (game.state === 'off') {
    const idx = ogMode ? 11 : 0;
    const preview = createSim(LEVELS[idx]);
    preview.presettle();
    renderer.buildLevel(preview, LEVELS[idx].locale);
    renderer.setCameraMode(ogMode ? 'idle' : 'fort');
  }
});
if (ogMode) document.body.classList.add('og');
show('menu');

// debug handle for playtesting agents (harmless in production)
window.__snowball = { game, renderer, frames: 0 };

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  game.tick(dt);
  renderer.update(dt);
  window.__snowball.frames++;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
