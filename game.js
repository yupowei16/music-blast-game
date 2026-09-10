
const homeScreen = document.getElementById("homeScreen");
const levelScreen = document.getElementById("levelScreen");
const characterScreen = document.getElementById("characterScreen");
const gameScreen = document.getElementById("gameScreen");

const startButton = document.getElementById("startButton");
const backToLevelsButton = document.getElementById("backToLevelsButton");
const leaveGameButton = document.getElementById("leaveGameButton");
const restartButton = document.getElementById("restartButton");
const messageBackButton = document.getElementById("messageBackButton");

const levelTitle = document.getElementById("levelTitle");
const selectedCharacterPortrait = document.getElementById("selectedCharacterPortrait");
const selectedCharacterName = document.getElementById("selectedCharacterName");
const selectedCharacterAttribute = document.getElementById("selectedCharacterAttribute");
const playerHpText = document.getElementById("playerHpText");
const playerHpBar = document.getElementById("playerHpBar");
const scoreText = document.getElementById("scoreText");
const enemyCountText = document.getElementById("enemyCountText");

const gameMessage = document.getElementById("gameMessage");
const messageTitle = document.getElementById("messageTitle");
const messageText = document.getElementById("messageText");

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const images = {
  mikuSelect: new Image(),
  kanadeSelect: new Image(),
  angryKirby: new Image(),
  mikuGame: new Image(),
  kanadeGame: new Image()
};

images.mikuSelect.src = "images/3654-removebg-preview.jpg";
images.kanadeSelect.src = "images/3655-removebg-preview.jpg";
images.angryKirby.src = "images/3668-removebg-preview.jpg";
images.mikuGame.src = "images/3669-removebg-preview.jpg";
images.kanadeGame.src = "images/3670-removebg-preview.jpg";

const characterData = {
  miku: {
    name: "初音未來",
    attribute: "屬性：冰",
    color: "#9deeff",
    bulletColor: "#9b66ff",
    portrait: "images/3669-removebg-preview.jpg",
    image: "mikuGame"
  },
  kanade: {
    name: "宵崎奏",
    attribute: "屬性：毒",
    color: "#75f0c6",
    bulletColor: "#40e6cb",
    portrait: "images/3670-removebg-preview.jpg",
    image: "kanadeGame"
  }
};

const levels = {
  1: {
    name: "音符森林",
    enemies: 8,
    speed: 1.1,
    hp: 22,
    boss: false
  },
  2: {
    name: "節奏洞窟",
    enemies: 13,
    speed: 1.55,
    hp: 30,
    boss: false
  },
  3: {
    name: "憤怒的卡比",
    enemies: 1,
    speed: 1.25,
    hp: 260,
    boss: true
  }
};

let selectedLevel = 1;
let selectedCharacter = "miku";
let running = false;
let animationId = null;
let lastTime = 0;
let mouse = { x: W / 2, y: H / 2 };

let keys = {};
let player;
let bullets = [];
let enemies = [];
let particles = [];
let score = 0;
let elapsed = 0;
let lastShot = 0;
let lastBurst = 0;
let bossSpawnTimer = 0;

function showScreen(screen) {
  [homeScreen, levelScreen, characterScreen, gameScreen].forEach((item) => {
    item.classList.remove("active");
  });

  screen.classList.add("active");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function formatAttribute(character) {
  return character === "miku" ? "屬性：冰" : "屬性：毒";
}

function startGame(level, character) {
  selectedLevel = Number(level);
  selectedCharacter = character;

  const levelData = levels[selectedLevel];
  const characterInfo = characterData[selectedCharacter];

  levelTitle.textContent = `第 ${selectedLevel} 關：${levelData.name}`;
  selectedCharacterPortrait.src = characterInfo.portrait;
  selectedCharacterName.textContent = characterInfo.name;
  selectedCharacterAttribute.textContent = characterInfo.attribute;

  player = {
    x: W / 2,
    y: H / 2,
    radius: 30,
    hp: 100,
    maxHp: 100,
    speed: 4.6,
    invincible: 0
  };

  bullets = [];
  enemies = [];
  particles = [];
  score = 0;
  elapsed = 0;
  lastShot = 0;
  lastBurst = 0;
  bossSpawnTimer = 0;
  running = true;
  lastTime = performance.now();

  if (levelData.boss) {
    enemies.push(createBoss());
  } else {
    for (let i = 0; i < levelData.enemies; i++) {
      enemies.push(createEnemy(levelData));
    }
  }

  updateHud();
  gameMessage.classList.add("hidden");
  showScreen(gameScreen);

  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(gameLoop);
}

function createEnemy(levelData) {
  const side = Math.floor(Math.random() * 4);
  const margin = 60;
  let x;
  let y;

  if (side === 0) {
    x = randomBetween(0, W);
    y = -margin;
  } else if (side === 1) {
    x = W + margin;
    y = randomBetween(0, H);
  } else if (side === 2) {
    x = randomBetween(0, W);
    y = H + margin;
  } else {
    x = -margin;
    y = randomBetween(0, H);
  }

  return {
    x,
    y,
    radius: randomBetween(18, 27),
    hp: levelData.hp,
    maxHp: levelData.hp,
    speed: levelData.speed * randomBetween(0.75, 1.25),
    color: Math.random() > 0.5 ? "#ff83bd" : "#a98bff",
    frozen: 0,
    poison: 0,
    poisonTick: 0,
    isBoss: false,
    hitFlash: 0
  };
}

function createBoss() {
  return {
    x: W / 2,
    y: 130,
    radius: 78,
    hp: levels[3].hp,
    maxHp: levels[3].hp,
    speed: levels[3].speed,
    color: "#ff668b",
    frozen: 0,
    poison: 0,
    poisonTick: 0,
    isBoss: true,
    hitFlash: 0,
    contactDamage: 16
  };
}

function shoot(normal = true) {
  if (!running) return;

  const now = performance.now();
  const cooldown = normal ? 220 : 560;

  if (now - (normal ? lastShot : lastBurst) < cooldown) return;

  if (normal) {
    lastShot = now;
  } else {
    lastBurst = now;
  }

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

  if (normal) {
    bullets.push(createBullet(angle, false));
  } else {
    for (let i = -2; i <= 2; i++) {
      bullets.push(createBullet(angle + i * 0.16, true));
    }
  }
}

function createBullet(angle, burst) {
  const characterInfo = characterData[selectedCharacter];

  return {
    x: player.x + Math.cos(angle) * 34,
    y: player.y + Math.sin(angle) * 34,
    vx: Math.cos(angle) * (burst ? 8.8 : 9.8),
    vy: Math.sin(angle) * (burst ? 8.8 : 9.8),
    radius: burst ? 12 : 8,
    damage: burst ? 18 : 10,
    life: burst ? 115 : 92,
    burst,
    color: characterInfo.bulletColor
  };
}

function applySpecialEffect(enemy) {
  if (selectedCharacter === "miku") {
    enemy.frozen = Math.max(enemy.frozen, 150);
  } else {
    enemy.poison = Math.max(enemy.poison, 240);
  }
}

function addParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x,
      y,
      vx: randomBetween(-2.5, 2.5),
      vy: randomBetween(-2.5, 2.5),
      life: randomBetween(18, 38),
      size: randomBetween(2, 5),
      color
    });
  }
}

function update(dt) {
  const levelData = levels[selectedLevel];
  elapsed += dt;

  updatePlayer(dt);
  updateBullets(dt);
  updateEnemies(dt, levelData);
  updateParticles(dt);

  if (!levelData.boss && enemies.length === 0) {
    finishGame(true);
    return;
  }

  if (levelData.boss && enemies.length === 0) {
    finishGame(true);
    return;
  }

  updateHud();
}

function updatePlayer(dt) {
  const moveSpeed = player.speed * dt;

  if (keys["w"] || keys["arrowup"]) player.y -= moveSpeed;
  if (keys["s"] || keys["arrowdown"]) player.y += moveSpeed;
  if (keys["a"] || keys["arrowleft"]) player.x -= moveSpeed;
  if (keys["d"] || keys["arrowright"]) player.x += moveSpeed;

  player.x = clamp(player.x, player.radius, W - player.radius);
  player.y = clamp(player.y, player.radius, H - player.radius);

  if (player.invincible > 0) {
    player.invincible -= dt;
  }
}

function updateBullets(dt) {
  bullets.forEach((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    enemies.forEach((enemy) => {
      if (bullet.life <= 0) return;

      const hitDistance = bullet.radius + enemy.radius;
      if (distance(bullet.x, bullet.y, enemy.x, enemy.y) < hitDistance) {
        enemy.hp -= bullet.damage;
        enemy.hitFlash = 10;
        applySpecialEffect(enemy);
        addParticles(bullet.x, bullet.y, bullet.color, bullet.burst ? 14 : 7);
        bullet.life = 0;
      }
    });
  });

  bullets = bullets.filter((bullet) => {
    return (
      bullet.life > 0 &&
      bullet.x > -40 &&
      bullet.x < W + 40 &&
      bullet.y > -40 &&
      bullet.y < H + 40
    );
  });
}

function updateEnemies(dt, levelData) {
  enemies.forEach((enemy) => {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const angle = Math.atan2(dy, dx);

    let speedMultiplier = 1;

    if (enemy.frozen > 0) {
      enemy.frozen -= dt;
      speedMultiplier = 0.38;
    }

    if (enemy.poison > 0) {
      enemy.poison -= dt;
      enemy.poisonTick += dt;

      while (enemy.poisonTick >= 60) {
        enemy.hp -= 3;
        enemy.poisonTick -= 60;
        addParticles(enemy.x, enemy.y, "#45e6be", 3);
      }
    } else {
      enemy.poisonTick = 0;
    }

    if (enemy.hitFlash > 0) {
      enemy.hitFlash -= dt;
    }

    enemy.x += Math.cos(angle) * enemy.speed * speedMultiplier * dt;
    enemy.y += Math.sin(angle) * enemy.speed * speedMultiplier * dt;

    const collisionDistance = player.radius + enemy.radius - 5;
    if (
      distance(player.x, player.y, enemy.x, enemy.y) < collisionDistance &&
      player.invincible <= 0
    ) {
      const damage = enemy.isBoss ? enemy.contactDamage : 10;
      player.hp -= damage;
      player.invincible = 44;
      addParticles(player.x, player.y, "#ff6d8b", 15);

      const pushAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
      player.x += Math.cos(pushAngle) * 24;
      player.y += Math.sin(pushAngle) * 24;

      if (player.hp <= 0) {
        player.hp = 0;
        updateHud();
        finishGame(false);
      }
    }
  });

  const removedEnemies = enemies.filter((enemy) => enemy.hp <= 0);

  removedEnemies.forEach((enemy) => {
    score += enemy.isBoss ? 1000 : 100;
    addParticles(enemy.x, enemy.y, enemy.isBoss ? "#ff6f97" : "#ffd56a", enemy.isBoss ? 38 : 18);
  });

  enemies = enemies.filter((enemy) => enemy.hp > 0);

  if (!levelData.boss && enemies.length < 4 && elapsed > bossSpawnTimer + 100) {
    bossSpawnTimer = elapsed;
  }
}

function updateParticles(dt) {
  particles.forEach((particle) => {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
  });

  particles = particles.filter((particle) => particle.life > 0);
}

function updateHud() {
  playerHpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  playerHpBar.style.width = `${(player.hp / player.maxHp) * 100}%`;
  scoreText.textContent = score;
  enemyCountText.textContent = enemies.length;
}

function drawBackground() {
  ctx.clearRect(0, 0, W, H);

  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, "#16285a");
  gradient.addColorStop(1, "#351c52");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  for (let i = 0; i < 38; i++) {
    const x = (i * 107 + 37) % W;
    const y = (i * 61 + 41) % H;
    const size = (i % 3) + 1;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(176, 193, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  for (let y = 0; y < H; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawPlayer() {
  const characterImage = images[characterData[selectedCharacter].image];

  ctx.save();

  if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
  ctx.fillStyle = selectedCharacter === "miku"
    ? "rgba(132, 235, 255, 0.32)"
    : "rgba(74, 244, 193, 0.30)";
  ctx.fill();

  if (characterImage.complete && characterImage.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      characterImage,
      player.x - player.radius,
      player.y - player.radius,
      player.radius * 2,
      player.radius * 2
    );
    ctx.restore();

    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = characterData[selectedCharacter].color;
    ctx.fill();
  }

  ctx.restore();
}

function drawMusicalNote(x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.2;

  ctx.beginPath();
  ctx.ellipse(-size * 0.24, size * 0.31, size * 0.28, size * 0.2, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillRect(0, -size * 0.68, size * 0.13, size * 1.04);

  ctx.beginPath();
  ctx.moveTo(size * 0.1, -size * 0.68);
  ctx.lineTo(size * 0.67, -size * 0.5);
  ctx.lineTo(size * 0.67, -size * 0.28);
  ctx.lineTo(size * 0.1, -size * 0.43);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawBullets() {
  bullets.forEach((bullet) => {
    ctx.save();
    ctx.shadowBlur = bullet.burst ? 20 : 12;
    ctx.shadowColor = bullet.color;
    drawMusicalNote(bullet.x, bullet.y, bullet.burst ? 16 : 11, bullet.color);
    ctx.restore();
  });
}

function drawEnemy(enemy) {
  ctx.save();

  if (enemy.isBoss && images.angryKirby.complete && images.angryKirby.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      images.angryKirby,
      enemy.x - enemy.radius,
      enemy.y - enemy.radius,
      enemy.radius * 2,
      enemy.radius * 2
    );
    ctx.restore();

    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = enemy.hitFlash > 0 ? "#ffffff" : "#ff85a5";
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fillStyle = enemy.hitFlash > 0 ? "#ffffff" : enemy.color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    ctx.fillStyle = "#2a2548";
    ctx.beginPath();
    ctx.arc(enemy.x - enemy.radius * 0.25, enemy.y - 4, 3, 0, Math.PI * 2);
    ctx.arc(enemy.x + enemy.radius * 0.25, enemy.y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (enemy.frozen > 0) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 7, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(140, 238, 255, 0.9)";
    ctx.lineWidth = 4;
    ctx.stroke();
  }

  if (enemy.poison > 0) {
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius + 9, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(74, 241, 185, 0.9)";
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const barWidth = enemy.isBoss ? 132 : 48;
  const barHeight = enemy.isBoss ? 10 : 6;
  const barX = enemy.x - barWidth / 2;
  const barY = enemy.y - enemy.radius - 18;

  ctx.fillStyle = "rgba(0, 0, 0, 0.46)";
  ctx.fillRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = enemy.isBoss ? "#ff5479" : "#ffdd7d";
  ctx.fillRect(barX, barY, barWidth * (enemy.hp / enemy.maxHp), barHeight);

  if (enemy.isBoss) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px Microsoft JhengHei";
    ctx.textAlign = "center";
    ctx.fillText("憤怒的卡比", enemy.x, barY - 9);
  }

  ctx.restore();
}

function drawEnemies() {
  enemies.forEach(drawEnemy);
}

function drawParticles() {
  particles.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = particle.life / 38;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawAim() {
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
  ctx.moveTo(mouse.x - 16, mouse.y);
  ctx.lineTo(mouse.x + 16, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - 16);
  ctx.lineTo(mouse.x, mouse.y + 16);
  ctx.stroke();
  ctx.restore();
}

function draw() {
  drawBackground();
  drawParticles();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawAim();
}

function gameLoop(timestamp) {
  if (!running) return;

  const dt = Math.min((timestamp - lastTime) / 16.67, 2.2);
  lastTime = timestamp;

  update(dt);
  draw();

  if (running) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

function finishGame(won) {
  running = false;
  cancelAnimationFrame(animationId);

  messageTitle.textContent = won ? "關卡完成！" : "挑戰失敗";
  messageText.textContent = won
    ? `你使用${characterData[selectedCharacter].name}成功完成「${levels[selectedLevel].name}」！最終分數：${score}`
    : "生命值歸零了。調整走位與爆裂彈時機後，再試一次吧！";

  gameMessage.classList.remove("hidden");
}

function canvasPosition(event) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * W;
  mouse.y = ((event.clientY - rect.top) / rect.height) * H;
}

startButton.addEventListener("click", () => showScreen(levelScreen));

document.querySelectorAll(".back-home").forEach((button) => {
  button.addEventListener("click", () => showScreen(homeScreen));
});

document.querySelectorAll(".level-card").forEach((button) => {
  button.addEventListener("click", () => {
    selectedLevel = Number(button.dataset.level);
    showScreen(characterScreen);
  });
});

document.querySelectorAll(".character-button").forEach((button) => {
  button.addEventListener("click", () => {
    selectedCharacter = button.dataset.character;
    startGame(selectedLevel, selectedCharacter);
  });
});

backToLevelsButton.addEventListener("click", () => {
  showScreen(levelScreen);
});

leaveGameButton.addEventListener("click", () => {
  running = false;
  cancelAnimationFrame(animationId);
  showScreen(levelScreen);
});

restartButton.addEventListener("click", () => {
  startGame(selectedLevel, selectedCharacter);
});

messageBackButton.addEventListener("click", () => {
  gameMessage.classList.add("hidden");
  showScreen(levelScreen);
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;

  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
    event.preventDefault();
  }

  if (key === " " && running) {
    shoot(true);
  }

  if (key === "e" && running) {
    shoot(false);
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

canvas.addEventListener("mousemove", (event) => {
  canvasPosition(event);
});

canvas.addEventListener("click", (event) => {
  canvasPosition(event);
  shoot(true);
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});
