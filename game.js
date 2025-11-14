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
const FINGER_OFFSET_Y = 110; // how far ABOVE the finger Allen should be

let player = {
  x: WIDTH / 2 - PLAYER_WIDTH / 2,
  y: HEIGHT / 2 - PLAYER_HEIGHT / 2,
  w: PLAYER_WIDTH,
  h: PLAYER_HEIGHT,
  invincible: false,
  invTimer: 0
};

let lives = 2; // donuts = lives
const MAX_LIVES = 3;

let score = 0;
let highScore = 0;

// Enemies (Keirans flying across screen)
const ENEMY_COUNT = 4;
const ENEMY_WIDTH = 110;
const ENEMY_HEIGHT = 130;

let enemies = [];

// Donut powerup
let donut = {
  active: false,
  x: 0,
  y: 0,
  w: 70,
  h: 70,
  timer: 0,
  cooldown: 8 // seconds between spawns
};

let lastTimestamp = null;

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

// ====== Init enemies ======
function resetEnemies() {
  enemies = [];
  for (let i = 0; i < ENEMY_COUNT; i++) {
    spawnEnemy(i);
  }
}

function spawnEnemy(i) {
  const speed = 120 + Math.random() * 80; // px/s
  const yPadding = 60;
  enemies[i] = {
    x: WIDTH + Math.random() * 300,
    y: yPadding + Math.random() * (HEIGHT - 2 * yPadding - ENEMY_HEIGHT),
    w: ENEMY_WIDTH,
    h: ENEMY_HEIGHT,
    speed: speed
  };
}

// ====== Player control (touch + mouse) ======
function movePlayerToClientPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  player.x = x - player.w / 2;
  player.y = y - player.h / 2 - FINGER_OFFSET_Y;

  // keep Allen fully on screen
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

// Mouse (for desktop testing)
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
  lives = 2;
  player.invincible = false;
  player.invTimer = 0;
  donut.active = false;
  donut.timer = 0;
  resetEnemies();
  lastTimestamp = null;
}

// ====== Main update loop ======
function update(dt) {
  if (!gameStarted || gameOver) return;

  // score in whole seconds
  score += dt;

  // invincibility timer
  if (player.invincible) {
    player.invTimer -= dt;
    if (player.invTimer <= 0) {
      player.invincible = false;
      player.invTimer = 0;
    }
  }

  // Move enemies
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    e.x -= e.speed * dt;
    if (e.x + e.w < -50) {
      // off screen, respawn
      spawnEnemy(i);
    }
  }

  // Donut spawn logic
  donut.timer += dt;
  if (!donut.active && donut.timer >= donut.cooldown) {
    donut.active = true;
    donut.timer = 0;
    donut.x = 40 + Math.random() * (WIDTH - 80 - donut.w);
    donut.y = 40 + Math.random() * (HEIGHT - 80 - donut.h);
  }

  // Collisions
  const playerRect = { x: player.x, y: player.y, w: player.w, h: player.h };

  // Enemy collisions
  for (const e of enemies) {
    const enemyRect = { x: e.x, y: e.y, w: e.w, h: e.h };
    if (!player.invincible && rectsOverlap(playerRect, enemyRect)) {
      lives -= 1;
      player.invincible = true;
      player.invTimer = 1.3; // seconds
      if (lives < 0) {
        saveHighScore();
        gameOver = true;
        break;
      }
    }
  }

  // Donut collision (gain life)
  if (donut.active) {
    const dRect = { x: donut.x, y: donut.y, w: donut.w, h: donut.h };
    if (rectsOverlap(playerRect, dRect)) {
      donut.active = false;
      donut.timer = 0;
      if (lives < MAX_LIVES) {
        lives += 1;
      }
    }
  }
}

// ====== Draw ======
function draw() {
  // background
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // faint grid or background lines
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

  // Keiran enemies
  for (const e of enemies) {
    ctx.drawImage(assets.keiran, e.x, e.y, e.w, e.h);
  }

  // Donut
  if (donut.active) {
    ctx.drawImage(assets.donut, donut.x, donut.y, donut.w, donut.h);
  }

  // Player (Allen)
  if (player.invincible) {
    // flicker while invincible
    if (Math.floor(player.invTimer * 10) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }
  }
  ctx.drawImage(assets.allen, player.x, player.y, player.w, player.h);
  ctx.globalAlpha = 1;

  // HUD
  ctx.fillStyle = "#ffffff";
  ctx.font = "20px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("Score: " + Math.floor(score), 20, 30);
  ctx.fillText("High: " + Math.floor(highScore), 20, 55);

  // lives as small donuts
  const lifeSize = 30;
  for (let i = 0; i <= lives; i++) {
    const x = WIDTH - (i + 1) * (lifeSize + 10);
    const y = 20;
    ctx.drawImage(assets.donut, x, y, lifeSize, lifeSize);
  }

  // Start / instructions overlay
  if (!gameStarted && !gameOver) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = "#ffffff";
    ctx.font = "32px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Allen Simulator", WIDTH / 2, HEIGHT / 2 - 40);

    ctx.font = "20px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText("Drag your finger to move Allen.", WIDTH / 2, HEIGHT / 2);
    ctx.fillText("Avoid Keiran heads, collect donuts.", WIDTH / 2, HEIGHT / 2 + 30);
    ctx.fillText("Tap to start.", WIDTH / 2, HEIGHT / 2 + 70);

    ctx.textAlign = "left";
  }

  // Game over overlay
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
    statusEl.textContent = "Drag Allen to start. Tap screen to begin.";
    loadHighScore();
    resetEnemies();
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
