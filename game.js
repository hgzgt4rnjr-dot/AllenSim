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

let score = 0;          // in seconds, continuous
let lastScoreInt = 0;   // last integer score we processed for events
let highScore = 0;
let lastTimestamp = null;

// ====== Spikes (asteroids style, right -> left) ======
const SPIKE_COUNT = 8;
const SPIKE_SIZE = 40;
let spikeSpeed = 200;     // px/sec base
let spikes = [];

// ====== Keiran (right -> left, same size as Allen) ======
let enemySpeed = 250;     // px/sec base
let enemies = [];         // we’ll keep max 1, but use array to mirror original

// ====== Donut ======
let donut = {
  active: false,
  x: 0,
  y: 0,
  w: 40,
  h: 40
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
    const x = WIDTH + i * 200;
    const y = randRange(0, HEIGHT - SPIKE_SIZE);
    spikes.push({
      x,
      y,
      w: SPIKE_SIZE,
      h: SPIKE_SIZE
    });
  }
}

// ====== Player control (relative joystick style) ======
let touchActive = false;
let touchStartX = 0;
let touchStartY = 0;
let playerStartX = 0;
let playerStartY = 0;

function beginControl(clientX, clientY) {
  touchActive = true;
  touchStartX = clientX;
  touchStartY = clientY;
  // capture current player position so movement is relative
  playerStartX = player.x;
  playerStartY = player.y;
}

function updateControl(clientX, clientY) {
  if (!touchActive) return;
  const dx = clientX - touchStartX;
  const dy = clientY - touchStartY;

  // Relative movement from original position
  player.x = playerStartX + dx;
  player.y = playerStartY + dy - FINGER_OFFSET_Y; // keep Allen above finger

  // clamp to screen
  player.x = clamp(player.x, 0, WIDTH - player.w);
  player.y = clamp(player.y, 0, HEIGHT - player.h);
}

function endControl() {
  touchActive = false;
}

// Touch
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    const t = e.touches[0];
    if (!t) return;

    if (!gameStarted || gameOver) {
      startOrRestart();
    }
    beginControl(t.clientX, t.clientY);
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    if (!gameStarted || gameOver) return;
    const t = e.touches[0];
    if (!t) return;
    updateControl(t.clientX, t.clientY);
  },
  { passive: false }
);

canvas.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    endControl();
  },
  { passive: false }
);

// Mouse (desktop testing, same idea)
let mouseDown = false;
canvas.addEventListener("mousedown", (e) => {
  if (!gameStarted || gameOver) {
    startOrRestart();
  }
  mouseDown = true;
  beginControl(e.clientX, e.clientY);
});
window.addEventListener("mouseup", () => {
  mouseDown = false;
  endControl();
});
canvas.addEventListener("mousemove", (e) => {
  if (!mouseDown) return;
  if (!gameStarted || gameOver) return;
  updateControl(e.clientX, e.clientY);
});

// ====== Start / restart ======
function startOrRestart() {
  gameStarted = true;
  gameOver = false;
  score = 0;
  lastScoreInt = 0;
  lives = 3;

  player.invincible = false;
  player.invTimer = 0;

  donut.active = false;
  enemies = [];

  spikeSpeed = 200;
  enemySpeed = 250;

  initSpikes();
  lastTimestamp = null;
}

// ====== Spawning ======
function spawnDonut() {
  donut.active = true;
  donut.x = randRange(0, WIDTH - donut.w);
  donut.y = randRange(0, HEIGHT - donut.h);
}

function spawnKeiran() {
  // Only spawn a new Keiran if none on screen
  if (enemies.length > 0) return;

  const x = WIDTH + PLAYER_WIDTH; // just off the right side
  const y = randRange(0, HEIGHT - PLAYER_HEIGHT);
  enemies.push({
    x,
    y,
    w: PLAYER_WIDTH,
    h: PLAYER_HEIGHT
  });
}

// ====== Main update ======
function update(dt) {
  if (!gameStarted || gameOver) return;

  // Update continuous score
  score += dt;

  const scoreInt = Math.floor(score);

  // Trigger once-per-second events like original frame_count logic
  if (scoreInt > lastScoreInt) {
    lastScoreInt = scoreInt;

    // Donut every 5 points, if none currently visible
    if (scoreInt > 0 && scoreInt % 5 === 0 && !donut.active) {
      spawnDonut();
    }

    // Keiran every 10 points
    if (scoreInt > 0 && scoreInt % 10 === 0) {
      spawnKeiran();
      // Every 10 points, also speed up spikes and Keiran slightly
      spikeSpeed += 20;
      enemySpeed += 25;
    }

    // High score update
    if (scoreInt > highScore) {
      highScore = scoreInt;
      localStorage.setItem("allen_high_score", String(highScore));
    }
  }

  // Invincibility timer (for spikes only)
  if (player.invincible) {
    player.invTimer -= dt;
    if (player.invTimer <= 0) {
      player.invincible = false;
      player.invTimer = 0;
    }
  }

  const playerRect = { x: player.x, y: player.y, w: player.w, h: player.h };

  // Move spikes right -> left, wrap back to right like asteroids belt
  for (const s of spikes) {
    s.x -= spikeSpeed * dt;
    if (s.x < -s.w) {
      s.x = WIDTH + randRange(100, 300);
      s.y = randRange(0, HEIGHT - s.h);
    }

    // Spike collision: -1 life with invulnerability
    const spikeRect = { x: s.x, y: s.y, w: s.w, h: s.h };
    if (!player.invincible && rectsOverlap(playerRect, spikeRect)) {
      lives -= 1;
      player.invincible = true;
      player.invTimer = 1.0; // 1 second invincibility vs spikes
      if (lives < 0) {
        saveHighScore();
        gameOver = true;
        break;
      }
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

  // Move Keiran (right -> left, slight vertical tracking)
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    // horizontal movement
    e.x -= enemySpeed * dt;

    // vertical tracking: move a bit toward player's y
    const targetY = player.y;
    const dy = targetY - e.y;
    e.y += dy * 0.03; // similar to original: slight tracking

    const enemyRect = { x: e.x, y: e.y, w: e.w, h: e.h };

    // collision with Allen: instant death
    if (rectsOverlap(playerRect, enemyRect)) {
      saveHighScore();
      gameOver = true;
    }

    // if enemy goes off screen to the left or too far off vertical, remove
    if (e.x < -e.w || e.y < -e.h || e.y > HEIGHT) {
      enemies.splice(i, 1);
    }
  }

  // Mirror HUD into status element so you always see score/lives
  statusEl.textContent = `Score: ${scoreInt}   High: ${highScore}   Lives: ${Math.max(
    0,
    lives + 1
  )}`;
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
    // simple triangle spike
    ctx.beginPath();
    ctx.moveTo(s.x + s.w / 2, s.y);           // top
    ctx.lineTo(s.x, s.y + s.h);              // bottom left
    ctx.lineTo(s.x + s.w, s.y + s.h);        // bottom right
    ctx.closePath();
    ctx.fill();
  }
}

function drawHUD() {
  const scoreInt = Math.floor(score);

  ctx.fillStyle = "#ffffff";
  ctx.font = "20px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Score: " + scoreInt, 20, 30);
  ctx.fillText("High: " + highScore, 20, 55);

  // Lives as donuts
  const lifeSize = 30;
  for (let i = 0; i < Math.max(0, lives + 1); i++) {
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
    ctx.fillText("Drag like a joystick to move Allen (he sits above your finger).", WIDTH / 2, HEIGHT / 2 - 20);
    ctx.fillText("Spikes move right to left – hit = -1 life.", WIDTH / 2, HEIGHT / 2 + 10);
    ctx.fillText("Donut every 5 points = extra life.", WIDTH / 2, HEIGHT / 2 + 40);
    ctx.fillText("Keiran every 10 points, instant kill if he hits you.", WIDTH / 2, HEIGHT / 2 + 70);
    ctx.fillText("Tap to start.", WIDTH / 2, HEIGHT / 2 + 100);

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
    ctx.fillText("High Score: " + highScore, WIDTH / 2, HEIGHT / 2 + 30);
    ctx.fillText("Tap to restart.", WIDTH / 2, HEIGHT / 2 + 70);

    ctx.textAlign = "left";
  }
}

function draw() {
  drawBackground();

  // Spikes (right -> left)
  drawSpikes();

  // Donut
  if (donut.active) {
    ctx.drawImage(assets.donut, donut.x, donut.y, donut.w, donut.h);
  }

  // Keiran(s)
  for (const e of enemies) {
    ctx.drawImage(assets.keiran, e.x, e.y, e.w, e.h);
  }

  // Allen
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
    statusEl.textContent = "Tap to start. Drag like a joystick to move Allen.";
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
