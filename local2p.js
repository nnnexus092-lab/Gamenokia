const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const RENDER_SIZE = 500, gridSize = 20, cellSize = RENDER_SIZE / gridSize;
canvas.width = RENDER_SIZE; canvas.height = RENDER_SIZE;

// AMBIL DATA SKIN
const SKINS = [
    { p1: '#0f380f', p2: '#004d40' }, { p1: '#b71c1c', p2: '#d32f2f' },
    { p1: '#0d47a1', p2: '#1976d2' }, { p1: '#4a148c', p2: '#7b1fa2' },
    { p1: '#ff8f00', p2: '#fbc02d' }, { p1: '#424242', p2: '#757575' },
    { p1: '#880e4f', p2: '#e91e63' }, { p1: '#006064', p2: '#00bcd4' },
    { p1: '#e65100', p2: '#ff9800' }, { p1: '#33691e', p2: '#8bc34a' },
    { p1: '#3e2723', p2: '#795548' }, { p1: '#263238', p2: '#cfd8dc' }
];
const savedSkin = JSON.parse(localStorage.getItem('snakeSkinIndex')) || { p1: 0, p2: 0 };
const COLOR_P1 = SKINS[savedSkin.p1].p1;
const COLOR_P2 = SKINS[savedSkin.p2].p2;

const s1El = document.getElementById('s1'), s2El = document.getElementById('s2'), 
      menu = document.getElementById('menu-main'), modeList = document.getElementById('mode-list'),
      timerDisplay = document.getElementById('timer-display'), modeTitle = document.getElementById('mode-title'),
      timeSelect = document.getElementById('time-select');

const MODES = [
  { id: "classic", name: "KLASIK", desc: "Dinding = mati", wrap: false, maze: false, speedBoost: false },
  { id: "maze", name: "LABIRIN", desc: "Rintangan", wrap: false, maze: true, speedBoost: false },
  { id: "portal", name: "PORTAL", desc: "Tembus dinding", wrap: true, maze: false, speedBoost: false },
  { id: "speed", name: "SPEED", desc: "Makin cepat", wrap: false, maze: false, speedBoost: true }
];

const MAZE_MAP = [
  "....................","....................","....................","...####......####...","...####......####...","....................","....................","....................","....................","....................","....................","....................","....................","....................","....................","...####......####...","...####......####...","....................","....................","...................."
];

let p1, p2, d1, nd1, d2, nd2;
let food = null, bigFood = null, score1, score2;
let highScore1 = 0, highScore2 = 0; // Variabel Skor Tertinggi 2P
let totalNormalEaten = 0, running = false;
let gameLoop = null, tickRate = 150, currentMode = null, walls = new Set();
let timeLeft = 0, timerInterval = null;

// Fungsi Format Waktu (Detik -> Menit)
function formatTime(seconds) {
    if (seconds >= 60) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s < 10 ? '0' : ''}${s}s`;
    }
    return `${seconds}s`;
}

MODES.forEach(m => {
  const btn = document.createElement('button');
  btn.className = 'mode-btn';
  btn.innerHTML = `<b>${m.name}</b><small>${m.desc}</small>`;
  btn.onclick = () => startGame(m);
  modeList.appendChild(btn);
});

function startGame(mode) {
  currentMode = mode; menu.style.display = 'none'; modeTitle.textContent = mode.name;
  
  p1 = [{x: 3, y: 10}, {x: 2, y: 10}, {x: 1, y: 10}]; d1 = {x: 1, y: 0}; nd1 = {x: 1, y: 0};
  p2 = [{x: 16, y: 10}, {x: 17, y: 10}, {x: 18, y: 10}]; d2 = {x: -1, y: 0}; nd2 = {x: -1, y: 0};
  
  score1 = 0; score2 = 0; totalNormalEaten = 0;
  
  // BACA SKOR TERTINGGI DARI MEMORI BROWSER
  highScore1 = Number(localStorage.getItem('nokiaSnake2P_high_p1') || 0);
  highScore2 = Number(localStorage.getItem('nokiaSnake2P_high_p2') || 0);
  
  s1El.textContent = "0"; s2El.textContent = "0"; food = null; bigFood = null;
  
  walls.clear();
  if (mode.maze) {
    MAZE_MAP.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) { if (row[x] === '#') walls.add(`${x},${y}`); }
    });
  }

  clearInterval(timerInterval); 
  timeLeft = parseInt(timeSelect.value); 
  timerDisplay.style.display = 'block'; 
  timerDisplay.textContent = `T: ${formatTime(timeLeft)}`;
  
  timerInterval = setInterval(() => {
    if (!running) return; 
    timeLeft--; 
    timerDisplay.textContent = `T: ${formatTime(timeLeft)}`;
    if (timeLeft <= 0) endGame("Waktu Habis!");
  }, 1000);

  tickRate = mode.speedBoost ? 180 : 150;
  spawnNormalFood(); running = true;
  
  clearInterval(gameLoop); gameLoop = setInterval(tick, tickRate); draw();
}

function spawnNormalFood() {
  let pos, tries = 0;
  do { pos = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) }; tries++; if (tries > 500) break; } 
  while (p1.some(s => s.x === pos.x && s.y === pos.y) || p2.some(s => s.x === pos.x && s.y === pos.y) || walls.has(`${pos.x},${pos.y}`) || (bigFood && bigFood.x === pos.x && bigFood.y === pos.y));
  food = pos;
}

function spawnBigFood() {
  let pos, tries = 0;
  do { pos = { x: Math.floor(Math.random() * gridSize), y: Math.floor(Math.random() * gridSize) }; tries++; if (tries > 500) break; } 
  while (p1.some(s => s.x === pos.x && s.y === pos.y) || p2.some(s => s.x === pos.x && s.y === pos.y) || walls.has(`${pos.x},${pos.y}`) || (food && food.x === pos.x && food.y === pos.y));
  bigFood = pos;
}

function tick() {
  if (!running) return;
  d1 = nd1; let h1 = { x: p1[0].x + d1.x, y: p1[0].y + d1.y };
  d2 = nd2; let h2 = { x: p2[0].x + d2.x, y: p2[0].y + d2.y };
  let p1Dead = false, p2Dead = false;

  if (currentMode.wrap) {
    h1.x = (h1.x + gridSize) % gridSize; h1.y = (h1.y + gridSize) % gridSize;
    h2.x = (h2.x + gridSize) % gridSize; h2.y = (h2.y + gridSize) % gridSize;
  } else {
    if (h1.x < 0 || h1.x >= gridSize || h1.y < 0 || h1.y >= gridSize) p1Dead = true;
    if (h2.x < 0 || h2.x >= gridSize || h2.y < 0 || h2.y >= gridSize) p2Dead = true;
  }

  if (walls.has(`${h1.x},${h1.y}`)) p1Dead = true;
  if (walls.has(`${h2.x},${h2.y}`)) p2Dead = true;
  if (p1.some(s => s.x === h1.x && s.y === h1.y) || p2.some(s => s.x === h1.x && s.y === h1.y)) p1Dead = true;
  if (p2.some(s => s.x === h2.x && s.y === h2.y) || p1.some(s => s.x === h2.x && s.y === h2.y)) p2Dead = true;
  if (h1.x === h2.x && h1.y === h2.y) { p1Dead = true; p2Dead = true; }

  if (p1Dead || p2Dead) {
    let reason = "Tabrakan!";
    if (p1Dead && p2Dead) reason = "Saling Tabrak / Tabrakan Bersamaan!";
    else if (p1Dead) reason = "Pemain 1 Menabrak!";
    else if (p2Dead) reason = "Pemain 2 Menabrak!";
    return endGame(reason);
  }

  p1.unshift(h1); p2.unshift(h2);
  let ateP1 = false, ateP2 = false;

  if (food && h1.x === food.x && h1.y === food.y) {
    score1 += 1; s1El.textContent = score1; spawnNormalFood(); ateP1 = true;
    totalNormalEaten++; if (totalNormalEaten % 2 === 0 && !bigFood) spawnBigFood();
  }
  if (food && h2.x === food.x && h2.y === food.y) {
    score2 += 1; s2El.textContent = score2; spawnNormalFood(); ateP2 = true;
    totalNormalEaten++; if (totalNormalEaten % 2 === 0 && !bigFood) spawnBigFood();
  }
  if (bigFood && h1.x === bigFood.x && h1.y === bigFood.y) { score1 += 2; s1El.textContent = score1; bigFood = null; ateP1 = true; }
  if (bigFood && h2.x === bigFood.x && h2.y === bigFood.y) { score2 += 2; s2El.textContent = score2; bigFood = null; ateP2 = true; }

  if (!ateP1) p1.pop(); if (!ateP2) p2.pop();

  if ((ateP1 || ateP2) && currentMode.speedBoost) {
    tickRate = Math.max(60, tickRate - 5); clearInterval(gameLoop); gameLoop = setInterval(tick, tickRate);
  }
  draw();
}

function draw() {
  ctx.fillStyle = '#8bac0f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(15,56,15,.06)'; 
  for (let y = 0; y < canvas.height; y += 15) { for (let x = 0; x < canvas.width; x += 15) { ctx.fillRect(x, y, 2, 2); } }

  walls.forEach(key => {
    const [x, y] = key.split(',').map(Number), px = x * cellSize, py = y * cellSize, pad = cellSize * 0.05;
    ctx.fillStyle = '#0f380f'; ctx.fillRect(px + pad, py + pad, cellSize - pad*2, cellSize - pad*2);
    ctx.fillStyle = '#306230'; const lineW = cellSize * 0.1;
    ctx.fillRect(px + pad*2, py + pad*3, cellSize - pad*4, lineW); ctx.fillRect(px + pad*2, py + cellSize/2, cellSize - pad*4, lineW); ctx.fillRect(px + pad*2, py + cellSize - pad*3 - lineW, cellSize - pad*4, lineW);
  });

  if (food) {
    const x = food.x * cellSize, y = food.y * cellSize, s = cellSize, p = s * 0.3;
    ctx.fillStyle = '#0f380f'; ctx.fillRect(x + p, y + s/2 - s*0.1, s - p*2, s*0.2); ctx.fillRect(x + s/2 - s*0.1, y + p, s*0.2, s - p*2); ctx.fillRect(x + s/2 - s*0.15, y + s/2 - s*0.15, s*0.3, s*0.3);
  }
  if (bigFood) {
    const x = bigFood.x * cellSize, y = bigFood.y * cellSize, s = cellSize, center = s / 2, pad = s * 0.1, thickness = s * 0.4;
    ctx.fillStyle = '#0f380f'; ctx.fillRect(x + center - thickness/2, y + pad, thickness, s - pad*2); ctx.fillRect(x + pad, y + center - thickness/2, s - pad*2, thickness); ctx.fillRect(x + center - thickness, y + center - thickness, thickness*2, thickness*2);
  }

  drawSnake(p1, COLOR_P1, d1);
  drawSnake(p2, COLOR_P2, d2);

  ctx.strokeStyle = '#0f380f'; ctx.lineWidth = 4;
  if (currentMode?.wrap) { ctx.setLineDash([10, 10]); ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4); ctx.setLineDash([]); }
  else { ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4); }
}

function drawSnake(snakeArr, color, dir) {
  snakeArr.forEach((seg, i) => {
    const rx = seg.x * cellSize, ry = seg.y * cellSize;
    ctx.fillStyle = color; ctx.fillRect(rx + cellSize*0.08, ry + cellSize*0.08, cellSize*0.84, cellSize*0.84);
    if (i === 0) {
      ctx.fillStyle = '#8bac0f'; const eye = cellSize * 0.2;
      let e1x = rx + cellSize*0.25, e1y = ry + cellSize*0.25, e2x = rx + cellSize*0.75 - eye, e2y = ry + cellSize*0.25;
      if (dir.x === -1) { e2x = e1x; e2y = ry + cellSize*0.75 - eye; }
      if (dir.x === 1) { e1x = e2x; e1y = ry + cellSize*0.75 - eye; }
      if (dir.y === 1) { e1y = ry + cellSize*0.75 - eye; e2y = e1y; e2x = rx + cellSize*0.75 - eye; }
      ctx.fillRect(e1x, e1y, eye, eye); ctx.fillRect(e2x, e2y, eye, eye);
    }
  });
}

function endGame(reason) {
  running = false; clearInterval(gameLoop); clearInterval(timerInterval);
  
  // SIMPAN SKOR TERTINGGI KE MEMORI BROWSER
  if (score1 > highScore1) { highScore1 = score1; localStorage.setItem('nokiaSnake2P_high_p1', highScore1); }
  if (score2 > highScore2) { highScore2 = score2; localStorage.setItem('nokiaSnake2P_high_p2', highScore2); }

  let winnerMsg = "";
  if (score1 > score2) winnerMsg = "🏆 PEMAIN 1 MENANG!";
  else if (score2 > score1) winnerMsg = "🏆 PEMAIN 2 MENANG!";
  else winnerMsg = "🤝 PERMAINAN SERI!";
  
  setTimeout(() => { 
    // TAMPILKAN SKOR TERTINGGI DI LAYAR GAME OVER
    alert(`GAME OVER!\nAlasan: ${reason}\n\n${winnerMsg}\n\nSkor Akhir:\nP1: ${score1} (BEST: ${highScore1})\nP2: ${score2} (BEST: ${highScore2})`); 
    window.location.reload(); 
  }, 100);
}

function dir1(x, y) { if (!running) return; if (x === -nd1.x && y === -nd1.y) return; if (x === nd1.x && y === nd1.y) return; nd1 = {x, y}; }
function dir2(x, y) { if (!running) return; if (x === -nd2.x && y === -nd2.y) return; if (x === nd2.x && y === nd2.y) return; nd2 = {x, y}; }

document.addEventListener('keydown', e => {
  if (e.key === 'w' || e.key === 'W') dir1(0, -1); if (e.key === 's' || e.key === 'S') dir1(0, 1); if (e.key === 'a' || e.key === 'A') dir1(-1, 0); if (e.key === 'd' || e.key === 'D') dir1(1, 0);
  if (e.key === 'ArrowUp') { dir2(0, -1); e.preventDefault(); } if (e.key === 'ArrowDown') { dir2(0, 1); e.preventDefault(); } if (e.key === 'ArrowLeft') { dir2(-1, 0); e.preventDefault(); } if (e.key === 'ArrowRight') { dir2(1, 0); e.preventDefault(); }
});