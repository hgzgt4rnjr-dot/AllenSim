// ====== Canvas / context ======
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// ====== Assets ======
const assets = {
  allen: new Image(),
  donut: new Image(),
  keiran: new Image()
};

const assetPaths = {
  allen: "Allens.png",
  donut: "Donut.png",
  keiran: "Keiran.png"
};

let assetsLoaded = 0;
const totalAssets = Object.keys(assets).length;

// ====== Game state ======
let gameStarted = false;
let gameOver = false;

const PLAYER_WIDTH = 80;
const PLAYER_HEIGHT = 95;
const FINGER_OFFSET_Y = 100; // Allen sits 100px above the finger

let player = {
  x: WIDTH / 2 - PLAYER_WIDTH / 2,
  y: HEIGHT / 2 - PLAYER_HEIGHT / 2,
  w: PLAYER_WIDTH,
  h: PLAYER_HEIGHT,
  invincible: false,
  invTimer: 0
};

let lives = 3;
const MAX_LIVES = 5;

let score = 0;
let highScore = 0;
let lastTimestamp = null;

// Difficulty tracking (for events)
let lastDonutScoreStep = -1;   // floor(score / 5) last used
let lastKeiranScoreStep = -1;  // floor(score / 10) last used

// ====== Spikes ======
const SPIKE_COUNT = 8;
const SPIKE_SIZE = 40;

let spikes = [];

// ====== Keiran ======
let keiran = {
  active: false,
  x: 0,
  y: 0,
  w: 130,
  h: 140,
  baseSpeed: 150
};

// ====== Donut ======
let donut = {
  active: false,
  x: 0,
  y: 0,
  w: 70,
  h: 70
};

// ====== Utility ======
function clamp(v, min, max) {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function rectsOverlap(a, b) {
  return !(
    a.x + a.w < b.x ||
    a.x > b.x + b.w ||
    a.y + a.h < b.y ||
    a.y > b.y + b.h
  );
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function loadHighScore() {
  const stored = localStorage.getItem("allen_high_score");
  highScore = stored ? parseInt(stored, 10) : 0;
}

function saveHighScore() {
  if (score > highScore) {
    highScore = score;
    localStorage.setItem("allen_high_score", String(highScore));
  }
}

// ====== Init spikes ======
function initSpikes() {
  spikes = [];
  for (let i = 0; i < SPIKE_COUNT; i++) {
    const x = randRange(0, WIDTH - SPIKE_SIZE);
    const y = randRange(0, HEIGHT - SPIKE_SIZE);
    let vx = randRange(-120, 120);
    let vy = randRange(-120, 120);
    if (Math.abs(vx) < 40) vx = vx < 0 ? -40 : 40;
    if (Math.abs(vy) < 40) vy = vy < 0 ? -40 : 40;
    spikes.push({ x, y, w: SPIKE_SIZE, h: SPIKE_SIZE, vx, vy });
  }
}

// ====== Player control (touch + mouse) ======
function movePlayerToClientPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  player.x = x - player.w / 2;
  player.y = y - player.h / 2 - FINGER_OFFSET_Y;

  player.x = clamp(player.x, 0, WIDTH - player.w);
  player.y = clamp(player.y, 0, HEIGHT - player.h);
}

// Touch
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    if (!gameStarted || gameOver) {
      startOrRestart();
      return;
    }
    const t = e.touches[0];
    if (t) movePlayerToClientPoint(t.clientX, t.clientY);
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    if (!gameStarted || gameOver) return;
    const t = e.touches[0];
    if (t) movePlayerToClientPoint(t.clientX, t.clientY);
  },
  { passive: false }
);

// Mouse (desktop)
let mouseDown = false;
canvas.addEventListener("mousedown", (e) => {
  if (!gameStarted || gameOver) {
    startOrRestart();
    return;
  }
  mouseDown = true;
  movePlayerToClientPoint(e.clientX, e.clientY);
});
window.addEventListener("mouseup", () => {
  mouseDown = false;
});
canvas.addEventListener("mousemove", (e) => {
  if (!mouseDown) return;
  if (!gameStarted || gameOver) return;
  movePlayerToClientPoint(e.clientX, e.clientY);
});

// ====== Start / restart ======
function startOrRestart() {
  gameStarted = true;
  gameOver = false;
  score = 0;
  lives = 3;
  player.invincible = false;
  player.invTimer = 0;

  donut.active = false;
  keiran.active = false;
  lastDonutScoreStep = -1;
  lastKeiranScoreStep = -1;

  initSpikes();
  lastTimestamp = null;
}

// ====== Spawn helpers ======
function spawnDonut() {
  donut.active = true;
  donut.x = randRange(40, WIDTH - 40 - donut.w);
  donut.y = randRange(60, HEIGHT - 60 - donut.h);
}

function spawnKeiran() {
  keiran.active = true;

  // Spawn at a random edge
  const edge = Math.floor(Math.random() * 4); // 0: left, 1: right, 2: top, 3: bottom
  if (edge === 0) {
    keiran.x = -keiran.w - 20;
    keiran.y = randRange(40, HEIGHT - 40 - keiran.h);
  } else if (edge === 1) {
    keiran.x = WIDTH + 20;
    keiran.y = randRange(40, HEIGHT - 40 - keiran.h);
  } else if (edge === 2) {
    keiran.x = randRange(40, WIDTH - 40 - keiran.w);
    keiran.y = -keiran.h - 20;
  } else {
    keiran.x = randRange(40, WIDTH - 40 - keiran.w);
    keiran.y = HEIGHT + 20;
  }
}

// ====== Main update ======
function update(dt) {
  if (!gameStarted || gameOver) return;

  // Update score
  score += dt;

  // Difficulty scaling
  const speedStep = Math.floor(score / 10); // 0–9 => 0, 10–19 => 1, etc.
  const speedMultiplier = 1 + speedStep * 0.25;

  // Invincibility timer (for spikes only)
  if (player.invincible) {
    player.invTimer -= dt;
    if (player.invTimer <= 0) {
      player.invincible = false;
      player.invTimer = 0;
    }
  }

  // Move spikes
  for (const s of spikes) {
    s.x += s.vx * dt * speedMultiplier;
    s.y += s.vy * dt * speedMultiplier;

    // bounce off walls
    if (s.x < 0) {
      s.x = 0;
      s.vx *= -1;
    } else if (s.x + s.w > WIDTH) {
      s.x = WIDTH - s.w;
      s.vx *= -1;
    }

    if (s.y < 0) {
      s.y = 0;
      s.vy *= -1;
    } else if (s.y + s.h > HEIGHT) {
      s.y = HEIGHT - s.h;
      s.vy *= -1;
    }
  }

  // Donut spawn every 5 points
  const donutStep = Math.floor(score / 5); // 0,1,2... each = a new event
  if (donutStep > lastDonutScoreStep) {
    lastDonutScoreStep = donutStep;
    if (!donut.active && donutStep > 0) {
      spawnDonut();
    }
  }

  // Keiran spawn every 10 points
  const keiranStep = Math.floor(score / 10);
  if (keiranStep > lastKeiranScoreStep) {
    lastKeiranScoreStep = keiranStep;
    if (!keiran.active && keiranStep > 0) {
      keiran.baseSpeed = 150 + keiranStep * 30;
      spawnKeiran();
    }
  }

  // Keiran movement: go out of his way to hunt Allen
  if (keiran.active) {
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    const kx = keiran.x + keiran.w / 2;
    const ky = keiran.y + keiran.h / 2;

    let dx = px - kx;
    let dy = py - ky;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    dx /= dist;
    dy /= dist;

    const speed = keiran.baseSpeed * speedMultiplier;
    keiran.x += dx * speed * dt;
    keiran.y += dy * speed * dt;
  }

  const playerRect = { x: player.x, y: player.y, w: player.w, h: player.h };

  // Spike collisions: lose 1 life (with invincibility window)
  for (const s of spikes) {
    const spikeRect = { x: s.x, y: s.y, w: s.w, h: s.h };
    if (rectsOverlap(playerRect, spikeRect) && !player.invincible) {
      lives -= 1;
      player.invincible = true;
      player.invTimer = 1.0; // 1 sec of invincibility vs spikes
      if (lives < 0) {
        saveHighScore();
        gameOver = true;
      }
      break;
    }
  }

  // Donut collision: +1 life
  if (donut.active) {
    const dRect = { x: donut.x, y: donut.y, w: donut.w, h: donut.h };
    if (rectsOverlap(playerRect, dRect)) {
      donut.active = false;
      if (lives < MAX_LIVES) {
        lives += 1;
      }
    }
  }

  // Keiran collision: instant death
  if (keiran.active) {
    const kRect = { x: keiran.x, y: keiran.y, w: keiran.w, h: keiran.h };
    if (rectsOverlap(playerRect, kRect)) {
      saveHighScore();
      gameOver = true;
    }
  }
}

// ====== Draw ======
function drawBackground() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // faint grid
  ctx.strokeStyle = "#101010";
  ctx.lineWidth = 1;
  for (let x = 0; x < WIDTH; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y < HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
}

function drawSpikes() {
  ctx.fillStyle = "#ff5252";
  for (const s of spikes) {
    // draw triangle spike
    ctx.beginPath();
    ctx.moveTo(s.x + s.w / 2, s.y);           // top
    ctx.lineTo(s.x, s.y + s.h);              // bottom left
    ctx.lineTo(s.x + s.w, s.y + s.h);        // bottom right
    ctx.closePath();
    ctx.fill();
  }
}

function drawHUD() {
  ctx.fillStyle = "#ffffff";
  ctx.font = "20px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Score: " + Math.floor(score), 20, 30);
  ctx.fillText("High: " + Math.floor(highScore), 20, 55);

  // Lives as donuts
  const lifeSize = 30;
  for (let i = 0; i < Math.max(0, lives + 1); i++) { // lives can be -1 briefly, clamp
    const x = WIDTH - (i + 1) * (lifeSize + 10);
    const y = 20;
    ctx.drawImage(assets.donut, x, y, lifeSize, lifeSize);
  }
}

function drawOverlays() {
  if (!gameStarted && !gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#ffffff";
    ctx.font = "32px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Allen Simulator", WIDTH / 2, HEIGHT / 2 - 60);

    ctx.font = "20px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("Drag your finger to move Allen (he sits above your finger).", WIDTH / 2, HEIGHT / 2 - 20);
    ctx.fillText("Every 5 points: donut = +1 life.", WIDTH / 2, HEIGHT / 2 + 10);
    ctx.fillText("Every 10 points: Keiran spawns and hunts you.", WIDTH / 2, HEIGHT / 2 + 40);
    ctx.fillText("Avoid moving spikes and Keiran. Tap to start.", WIDTH / 2, HEIGHT / 2 + 80);

    ctx.textAlign = "left";
  }

  if (gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#ff5252";
    ctx.font = "32px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("YOU DIED", WIDTH / 2, HEIGHT / 2 - 40);

    ctx.fillStyle = "#ffffff";
    ctx.font = "22px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("Score: " + Math.floor(score), WIDTH / 2, HEIGHT / 2);
    ctx.fillText("High Score: " + Math.floor(highScore), WIDTH / 2, HEIGHT / 2 + 30);
    ctx.fillText("Tap to restart.", WIDTH / 2, HEIGHT / 2 + 70);

    ctx.textAlign = "left";
  }
}

function draw() {
  drawBackground();

  // Spikes
  drawSpikes();

  // Donut
  if (donut.active) {
    ctx.drawImage(assets.donut, donut.x, donut.y, donut.w, donut.h);
  }

  // Keiran
  if (keiran.active) {
    ctx.drawImage(assets.keiran, keiran.x, keiran.y, keiran.w, keiran.h);
  }

  // Player (Allen)
  if (player.invincible) {
    if (Math.floor(player.invTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
  }
  ctx.drawImage(assets.allen, player.x, player.y, player.w, player.h);
  ctx.globalAlpha = 1;

  // HUD + overlays
  drawHUD();
  drawOverlays();
}

// ====== Main loop ======
function loop(timestamp) {
  if (lastTimestamp === null) lastTimestamp = timestamp;
  const dt = (timestamp - lastTimestamp) / 1000;
  lastTimestamp = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// ====== Asset loading ======
function onAssetLoaded() {
  assetsLoaded += 1;
  statusEl.textContent = `Loading… ${assetsLoaded}/${totalAssets}`;
  if (assetsLoaded === totalAssets) {
    statusEl.textContent = "Tap to start. Drag to move Allen.";
    loadHighScore();
    initSpikes();
    requestAnimationFrame(loop);
  }
}

for (const key in assets) {
  assets[key].onload = onAssetLoaded;
  assets[key].onerror = () => {
    console.error("Failed to load", key, assetPaths[key]);
    onAssetLoaded();
  };
  assets[key].src = assetPaths[key];
}
