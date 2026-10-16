'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600];
const PERFECT_CLEAR_SCORES = [0, 800, 1200, 1800, 2000];
const B2B_MULTIPLIER = 1.5;
const EFFECT_MS = 1000;
const FLASH_MS = 400;
const LINE_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const comboEl = document.getElementById('combo');
const soundToggle = document.getElementById('sound-toggle');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const saveBtn = document.getElementById('save-btn');
const recordMsg = document.getElementById('record-msg');
const recordsBody = document.getElementById('records-body');
const recordsStats = document.getElementById('records-stats');
const clearRecordsBtn = document.getElementById('clear-records-btn');

let gridColor, ghostAlpha;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, b2b, lastMoveRotate, effects, flashUntil;
let soundOn = true, audioCtx;
let started = false, maxCombo = 0, lastSaved = null;

const MAX_RECORDS = 5;
const MAX_NAME = 12;

// ---- Sonido (Web Audio, sintetizado) ----
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, duration, type = 'square', delay = 0, volume = 0.08) {
  if (!soundOn) return;
  const ac = ensureAudio();
  if (!ac) return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration);
}

function playSound(kind, n = 0) {
  switch (kind) {
    case 'clear':
      tone(330 * Math.pow(2, Math.max(n, 0) / 12), 0.18, 'square');
      break;
    case 'tetris':
      [262, 330, 392, 523].forEach(f => tone(f, 0.35, 'triangle', 0, 0.06));
      break;
    case 'tspin':
      tone(440, 0.12, 'sawtooth');
      tone(660, 0.2, 'sawtooth', 0.1);
      break;
    case 'b2b':
      tone(784, 0.15, 'triangle', 0.15);
      break;
    case 'perfect':
      [262, 330, 392, 523, 659, 784].forEach((f, i) => tone(f, 0.25, 'triangle', i * 0.08));
      break;
  }
}

function setSound(on) {
  soundOn = on;
  soundToggle.textContent = on ? 'Sonido: sí' : 'Sonido: no';
  soundToggle.setAttribute('aria-pressed', String(on));
  try { localStorage.setItem('sound', on ? 'on' : 'off'); } catch (e) {}
}

// ---- Records (localStorage) ----
function loadRecords() {
  try {
    const list = JSON.parse(localStorage.getItem('records'));
    if (!Array.isArray(list)) return [];
    return list
      .filter(r => r && Number.isFinite(r.score) && r.score > 0)
      .map(r => ({
        name: String(r.name ?? '').slice(0, MAX_NAME) || 'Jugador',
        score: r.score,
        lines: Number(r.lines) || 0,
        maxCombo: Number(r.maxCombo) || 0,
        date: String(r.date ?? ''),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS);
  } catch (e) { return []; }
}

function loadStat(key) {
  try { return Number(localStorage.getItem(key)) || 0; } catch (e) { return 0; }
}

function saveStat(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (e) {}
}

function saveRecords(list) {
  try { localStorage.setItem('records', JSON.stringify(list)); } catch (e) {}
}

function qualifiesForTop(sc) {
  if (sc <= 0) return false;
  const list = loadRecords();
  return list.length < MAX_RECORDS || sc > list[list.length - 1].score;
}

function renderRecords() {
  const list = loadRecords();
  recordsBody.textContent = '';
  if (!list.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'empty';
    td.textContent = 'Aún no hay records';
    tr.appendChild(td);
    recordsBody.appendChild(tr);
  }
  list.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (lastSaved && r.date === lastSaved.date) {
      tr.className = 'new-record';
    }
    let day = '';
    const d = new Date(r.date);
    if (!isNaN(d)) day = d.toLocaleDateString('es');
    [i + 1, r.name, r.score.toLocaleString(), r.lines, day].forEach(v => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    recordsBody.appendChild(tr);
  });
  const bc = loadStat('bestCombo');
  recordsStats.textContent = `Mejor combo: ${bc >= 2 ? 'x' + bc : '–'} · Líneas máx.: ${loadStat('maxLines')}`;
}

function showRecordsOverlay() {
  overlay.classList.add('with-records');
  renderRecords();
  overlay.classList.remove('hidden');
}

function submitRecord() {
  if (nameForm.classList.contains('hidden')) return;
  const name = nameInput.value.trim().slice(0, MAX_NAME) || 'Jugador';
  const entry = { name, score, lines, maxCombo, date: new Date().toISOString() };
  const list = loadRecords();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  saveRecords(list.slice(0, MAX_RECORDS));
  lastSaved = entry;
  nameForm.classList.add('hidden');
  recordMsg.textContent = 'Record guardado';
  renderRecords();
  nameInput.blur();
}

// ---- Efectos visuales ----
function addEffect(text, color) {
  effects.push({ text, color, start: performance.now() });
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      lastMoveRotate = true;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

// T-spin: pieza T cuyo último movimiento fue una rotación y con >= 3 esquinas de su caja 3x3 ocupadas.
// Debe llamarse antes de merge().
function isTSpin() {
  if (current.type !== 3 || !lastMoveRotate) return false;
  let filled = 0;
  for (const [dy, dx] of [[0, 0], [0, 2], [2, 0], [2, 2]]) {
    const x = current.x + dx, y = current.y + dy;
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) filled++;
  }
  return filled >= 3;
}

function clearLines(tspin) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }

  if (!cleared) {
    combo = -1;
    if (tspin) {
      score += TSPIN_SCORES[0] * level;
      addEffect('T-SPIN', '#ba68c8');
      playSound('tspin');
      updateHUD();
    }
    return;
  }

  combo++;
  maxCombo = Math.max(maxCombo, combo + 1);
  const difficult = cleared === 4 || tspin;
  let base = tspin ? TSPIN_SCORES[cleared] : LINE_SCORES[cleared];
  const backToBack = difficult && b2b;
  if (backToBack) base *= B2B_MULTIPLIER;
  b2b = difficult;
  const gained = Math.round(base * level * (combo + 1));
  score += gained;

  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);

  // efectos y sonido
  if (tspin) {
    addEffect(`T-SPIN ${LINE_NAMES[cleared]}`, '#ba68c8');
    playSound('tspin');
  } else if (cleared === 4) {
    addEffect('TETRIS', '#4dd0e1');
    playSound('tetris');
  } else {
    playSound('clear', combo);
  }
  if (backToBack) {
    addEffect('BACK-TO-BACK', '#ffb74d');
    playSound('b2b');
  }
  if (combo >= 1) addEffect(`COMBO x${combo + 1}`, '#ffd54f');
  addEffect(`+${gained.toLocaleString()}`, '#e0e0e0');

  if (board.every(row => row.every(v => v === 0))) {
    score += PERFECT_CLEAR_SCORES[cleared] * level;
    addEffect('PERFECT CLEAR', '#81c784');
    flashUntil = performance.now() + FLASH_MS;
    playSound('perfect');
  }

  updateHUD();
  if (combo >= 1) {
    comboEl.classList.remove('pulse');
    void comboEl.offsetWidth; // reinicia la animación
    comboEl.classList.add('pulse');
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  if (gy > current.y) lastMoveRotate = false;
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const tspin = isTSpin();
  merge();
  clearLines(tspin);
  spawn();
}

function spawn() {
  lastMoveRotate = false;
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  comboEl.textContent = combo >= 1 ? `x${combo + 1}` : '–';
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, ghostAlpha);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);

  drawEffects(performance.now());
}

function drawEffects(now) {
  if (now < flashUntil) {
    ctx.globalAlpha = 0.6 * ((flashUntil - now) / FLASH_MS);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1;
  }

  effects = effects.filter(e => now - e.start < EFFECT_MS);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  effects.forEach((e, i) => {
    const t = (now - e.start) / EFFECT_MS;
    const y = canvas.height / 2 + (i - (effects.length - 1) / 2) * 30 - t * 40;
    ctx.globalAlpha = 1 - t * t;
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(e.text, canvas.width / 2, y);
    ctx.fillStyle = e.color;
    ctx.fillText(e.text, canvas.width / 2, y);
  });
  ctx.globalAlpha = 1;
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  restartBtn.textContent = 'Reiniciar';
  saveStat('bestCombo', Math.max(loadStat('bestCombo'), maxCombo));
  saveStat('maxLines', Math.max(loadStat('maxLines'), lines));
  lastSaved = null;
  if (qualifiesForTop(score)) {
    recordMsg.textContent = '¡Entraste al top 5!';
    nameForm.classList.remove('hidden');
  } else {
    recordMsg.textContent = score > 0 ? 'No alcanzaste el top 5' : '';
    nameForm.classList.add('hidden');
  }
  showRecordsOverlay();
  if (!nameForm.classList.contains('hidden')) {
    nameInput.value = 'Jugador';
    nameInput.focus();
    nameInput.select();
  }
}

function showStartScreen() {
  started = false;
  cancelAnimationFrame(animId); // el loop arranca al pulsar Jugar
  draw();
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  recordMsg.textContent = '';
  nameForm.classList.add('hidden');
  restartBtn.textContent = 'Jugar';
  showRecordsOverlay();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveRotate = false;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return; // endGame() corrió dentro de este frame: cancelAnimationFrame no lo detiene
  animId = requestAnimationFrame(loop);
}

function applyTheme(theme) {
  const light = theme === 'light';
  if (light) document.documentElement.dataset.theme = 'light';
  else delete document.documentElement.dataset.theme;
  themeToggle.textContent = light ? 'Modo oscuro' : 'Modo claro';
  themeToggle.setAttribute('aria-pressed', String(light));
  const styles = getComputedStyle(document.documentElement);
  gridColor = styles.getPropertyValue('--grid').trim();
  ghostAlpha = parseFloat(styles.getPropertyValue('--ghost-alpha'));
  try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch (e) {}
  // en pausa/game over el loop no corre: repintar manualmente
  if (board && current && next) {
    draw();
    drawNext();
  }
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  combo = -1;
  maxCombo = 0;
  b2b = false;
  effects = [];
  flashUntil = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  overlay.classList.remove('with-records');
  restartBtn.textContent = 'Reiniciar';
  recordMsg.textContent = '';
  nameForm.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === themeToggle || e.target === soundToggle || e.target === nameInput) return;
  if (!started) return;
  if (e.code === 'KeyM') { setSound(!soundOn); return; }
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastMoveRotate = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastMoveRotate = false; }
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => {
  submitRecord(); // si quedó un nombre sin guardar, no perder la puntuación
  started = true;
  init();
  restartBtn.blur();
});

saveBtn.addEventListener('click', submitRecord);
nameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') submitRecord();
});

clearRecordsBtn.addEventListener('click', () => {
  if (!confirm('¿Borrar todos los records?')) return;
  try {
    localStorage.removeItem('records');
    localStorage.removeItem('bestCombo');
    localStorage.removeItem('maxLines');
  } catch (e) {}
  lastSaved = null;
  nameForm.classList.add('hidden');
  recordMsg.textContent = '';
  renderRecords();
  clearRecordsBtn.blur();
});

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeToggle.blur();
});

soundToggle.addEventListener('click', () => {
  setSound(!soundOn);
  soundToggle.blur();
});

applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
try { setSound(localStorage.getItem('sound') !== 'off'); } catch (e) { setSound(true); }
init();
showStartScreen();
