const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const statusText = document.getElementById("status");
const xpBar = document.getElementById("xp-bar");
const ultBar = document.getElementById("ult-bar");
const ultText = document.getElementById("ult-text");
const dashBar = document.getElementById("dash-bar");
const dashText = document.getElementById("dash-text");

const bossHpContainer = document.getElementById("boss-hp-container");
const bossHpBar = document.getElementById("boss-hp-bar");
const bossHpText = document.getElementById("boss-hp-text");

const stageNumberText = document.getElementById("stage-number");
const stageGoalText = document.getElementById("stage-goal");
const weaponNameText = document.getElementById("weapon-name");
const weaponDetailText = document.getElementById("weapon-detail");
const explosiveCooldown = document.getElementById("explosive-cooldown");
const explosiveCooldownText = document.getElementById("explosive-cooldown-text");
const explosiveCooldownBar = document.getElementById("explosive-cooldown-bar");

const modals = {
    main: document.getElementById("main-menu"),
    character: document.getElementById("character-select-modal"),
    level: document.getElementById("level-up-modal"),
    reward: document.getElementById("stage-reward-modal"),
    achievement: document.getElementById("achievement-modal"),
    pause: document.getElementById("pause-modal"),
    end: document.getElementById("end-modal")
};

const stageRewardTitle = document.getElementById("stage-reward-title");
const stageRewardText = document.getElementById("stage-reward-text");
const achievementList = document.getElementById("achievement-list");
const skillChoicesDiv = document.getElementById("skill-choices");
const pauseInfo = document.getElementById("pause-info");
const endTitle = document.getElementById("end-title");
const endStats = document.getElementById("end-stats");

const GAME_IMAGES = {
    selectMiku: "images/3654-removebg-preview.jpg",
    selectKanade: "images/3655-removebg-preview.jpg",
    playerMiku: "images/3668-removebg-preview.jpg",
    playerKanade: "images/3670-removebg-preview.jpg",
    normalEnemy: "images/3657-removebg-preview.jpg",
    eliteEnemy: "images/3663-removebg-preview.jpg",
    angryKirbyBoss: "images/3669-removebg-preview.jpg"
};

const images = {};

function loadImages() {
    Object.entries(GAME_IMAGES).forEach(([key, source]) => {
        const image = new Image();
        image.src = source;
        images[key] = image;
    });
}

loadImages();

function updateDeviceMode() {
    const hasTouch =
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches;

    const mobileMode = hasTouch && window.innerWidth <= 900;

    document.body.classList.toggle("mobile-mode", mobileMode);
    document.body.classList.toggle("desktop-mode", !mobileMode);

    return mobileMode;
}

let isMobileMode = updateDeviceMode();

window.addEventListener("resize", () => {
    isMobileMode = updateDeviceMode();
});

const MAX_STAGES = 50;
const KILLS_PER_STAGE = 8;
const BOSS_STAGE_INTERVAL = 5;

const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

let lastTime = 0;
let selectedCharacter = null;
let game = null;

function createGameState() {
    return {
        running: false,
        paused: false,
        stage: 1,
        kills: 0,
        stageKills: 0,
        bossSpawned: false,
        bossDefeated: false,
        stageRewardReady: false,
        gold: 0,
        elapsedMs: 0,
        enemies: [],
        bullets: [],
        particles: [],
        floatingTexts: [],
        spawnTimer: 0,
        levelUpPending: false,
        unlockedAchievements: new Set(),
        player: {
            x: canvas.width / 2,
            y: canvas.height / 2,
            radius: 24,
            speed: 225,
            health: 100,
            maxHealth: 100,
            baseDamage: 18,
            level: 1,
            xp: 0,
            xpToNext: 60,
            attackIntervalMs: 360,
            lastAttackAt: -9999,
            facingX: 1,
            facingY: 0,
            dashCooldownMs: 1800,
            lastDashAt: -9999,
            dashUntil: 0,
            invulnerableUntil: 0,
            ultimateCharge: 0,
            weaponLevel: 1,
            weaponType: "pistol",
            lastExplosiveShotAt: -9999,
            explosiveShotCooldownMs: 1500,
            skillLevels: {
                fireRate: 0,
                speed: 0,
                damage: 0,
                health: 0,
                magnet: 0
            }
        }
    };
}

function showModal(name) {
    modals[name].classList.add("visible");
}

function hideModal(name) {
    modals[name].classList.remove("visible");
}

function hideAllGameplayModals() {
    hideModal("level");
    hideModal("reward");
    hideModal("pause");
    hideModal("end");
}

function startButtonFlow() {
    hideModal("main");
    showModal("character");
}

function chooseCharacter(characterId) {
    selectedCharacter = characterId;
    hideModal("character");
    startNewGame();
}

function startNewGame() {
    game = createGameState();

    game.player.image =
        selectedCharacter === "miku"
            ? images.playerMiku
            : images.playerKanade;

    game.running = true;
    game.paused = false;

    hideAllGameplayModals();
    startStage(1);
    updateUI();
}

function restartGame() {
    selectedCharacter = selectedCharacter || "miku";
    hideModal("end");
    hideModal("pause");
    startNewGame();
}

function startStage(stage) {
    game.stage = stage;
    game.stageKills = 0;
    game.bossSpawned = false;
    game.bossDefeated = false;
    game.stageRewardReady = false;
    game.enemies = [];
    game.bullets = [];
    game.particles = [];
    game.floatingTexts = [];
    game.spawnTimer = 0;

    game.player.x = canvas.width / 2;
    game.player.y = canvas.height / 2;
    game.player.health = Math.min(
        game.player.maxHealth,
        game.player.health + Math.round(game.player.maxHealth * 0.2)
    );

    updateUI();
}

function getDifficulty(stage) {
    return {
        enemyHp: 1 + (stage - 1) * 0.07,
        enemyDamage: 1 + (stage - 1) * 0.025,
        enemySpeed: 1 + (stage - 1) * 0.007,
        spawnInterval: Math.max(450, 1150 - (stage - 1) * 11),
        eliteHp: 1.8 + Math.min(stage * 0.01, 0.5),
        bossHp: 4.6 + stage * 0.14
    };
}

function stageNeedsBoss() {
    return game.stage % BOSS_STAGE_INTERVAL === 0;
}

function randomEdgePosition(radius) {
    const side = Math.floor(Math.random() * 4);

    if (side === 0) {
        return { x: Math.random() * canvas.width, y: -radius };
    }

    if (side === 1) {
        return { x: canvas.width + radius, y: Math.random() * canvas.height };
    }

    if (side === 2) {
        return { x: Math.random() * canvas.width, y: canvas.height + radius };
    }

    return { x: -radius, y: Math.random() * canvas.height };
}

function spawnEnemy(forceType = null) {
    const difficulty = getDifficulty(game.stage);
    const type = forceType || (Math.random() < 0.16 ? "elite" : "normal");
    const isElite = type === "elite";

    const radius = isElite ? 27 : 20;
    const pos = randomEdgePosition(radius);

    const baseHp = isElite ? 92 : 56;
    const baseDamage = isElite ? 14 : 9;

    const hp = Math.round(
        baseHp *
        difficulty.enemyHp *
        (isElite ? difficulty.eliteHp : 1)
    );

    game.enemies.push({
        type,
        x: pos.x,
        y: pos.y,
        radius,
        speed:
            (isElite ? 78 : 92) *
            difficulty.enemySpeed,
        maxHealth: hp,
        health: hp,
        contactDamage: Math.round(
            baseDamage * difficulty.enemyDamage
        ),
        contactCooldownUntil: 0,
        image: isElite ? images.eliteEnemy : images.normalEnemy,
        color: isElite ? "#a45cff" : "#ff5566",
        gold: isElite ? 16 : 5,
        xp: isElite ? 28 : 12
    });
}

function spawnAngryKirbyBoss() {
    const difficulty = getDifficulty(game.stage);
    const baseHp = 180;
    const hp = Math.round(
        baseHp *
        difficulty.enemyHp *
        difficulty.bossHp
    );

    game.enemies.push({
        type: "boss",
        name: "憤怒的卡比",
        x: canvas.width / 2,
        y: 85,
        radius: 58,
        speed: 57 * difficulty.enemySpeed,
        maxHealth: hp,
        health: hp,
        contactDamage: Math.round(17 * difficulty.enemyDamage),
        contactCooldownUntil: 0,
        image: images.angryKirbyBoss,
        color: "#ff87c3",
        gold: 120,
        xp: 160
    });

    game.bossSpawned = true;
    addFloatingText(canvas.width / 2, 140, "BOSS：憤怒的卡比！", "#ffcc00", 24);
}

function updateGame(deltaMs, now) {
    if (!game || !game.running || game.paused || game.levelUpPending || game.stageRewardReady) {
        return;
    }

    game.elapsedMs += deltaMs;

    updatePlayer(deltaMs, now);
    updateSpawning(deltaMs);
    updateEnemies(deltaMs, now);
    updateBullets(deltaMs);
    updateParticles(deltaMs);
    updateFloatingTexts(deltaMs);

    if (game.player.ultimateCharge < 100) {
        game.player.ultimateCharge = Math.min(
            100,
            game.player.ultimateCharge + deltaMs * 0.0018
        );
    }

    updateUI();
}

function updatePlayer(deltaMs, now) {
    const player = game.player;
    let moveX = 0;
    let moveY = 0;

    if (keys.up) moveY -= 1;
    if (keys.down) moveY += 1;
    if (keys.left) moveX -= 1;
    if (keys.right) moveX += 1;

    if (moveX !== 0 || moveY !== 0) {
        const length = Math.hypot(moveX, moveY);
        moveX /= length;
        moveY /= length;

        player.facingX = moveX;
        player.facingY = moveY;
    }

    const dashActive = now < player.dashUntil;
    const speed = player.speed * (dashActive ? 2.55 : 1);

    player.x += moveX * speed * deltaMs / 1000;
    player.y += moveY * speed * deltaMs / 1000;

    player.x = clamp(player.x, player.radius, canvas.width - player.radius);
    player.y = clamp(player.y, player.radius, canvas.height - player.radius);

    if (now - player.lastAttackAt >= player.attackIntervalMs) {
        autoFire(now);
    }
}

function updateSpawning(deltaMs) {
    if (game.stageRewardReady || game.bossDefeated) {
        return;
    }

    if (game.stageKills >= KILLS_PER_STAGE) {
        if (stageNeedsBoss() && !game.bossSpawned) {
            spawnAngryKirbyBoss();
            return;
        }

        if (!stageNeedsBoss() || game.bossDefeated) {
            completeStage();
            return;
        }
    }

    if (game.stageKills < KILLS_PER_STAGE) {
        game.spawnTimer += deltaMs;

        const interval = getDifficulty(game.stage).spawnInterval;

        if (game.spawnTimer >= interval) {
            game.spawnTimer = 0;
            spawnEnemy();
        }
    }
}

function updateEnemies(deltaMs, now) {
    const player = game.player;

    for (const enemy of game.enemies) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.hypot(dx, dy) || 1;

        enemy.x += dx / distance * enemy.speed * deltaMs / 1000;
        enemy.y += dy / distance * enemy.speed * deltaMs / 1000;

        if (distance < enemy.radius + player.radius) {
            damagePlayer(enemy, now);
        }
    }
}

function damagePlayer(enemy, now) {
    const player = game.player;

    if (now < player.invulnerableUntil || now < enemy.contactCooldownUntil) {
        return;
    }

    const damage = enemy.contactDamage;

    player.health -= damage;
    player.invulnerableUntil = now + 620;
    enemy.contactCooldownUntil = now + 900;

    createParticles(player.x, player.y, "#ff3344", 14, 170);
    addFloatingText(player.x, player.y - 26, `-${damage}`, "#ff6677", 16);

    if (player.health <= 0) {
        player.health = 0;
        gameOver(false);
    }
}

function autoFire(now) {
    const player = game.player;

    if (game.enemies.length === 0) {
        return;
    }

    const nearest = getNearestEnemy();

    if (!nearest) {
        return;
    }

    player.lastAttackAt = now;

    const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);

    player.facingX = Math.cos(angle);
    player.facingY = Math.sin(angle);

    if (player.weaponType === "pistol") {
        fireBullet(angle, getPlayerDamage(), 520, "#00ffff", "normal");
        return;
    }

    if (player.weaponType === "shotgun") {
        fireShotgun(angle, 5, 0.58, getPlayerDamage() * 0.75, false);
        return;
    }

    if (player.weaponType === "explosive") {
        fireBullet(
            angle,
            getPlayerDamage() * 1.18,
            470,
            "#ff7a00",
            "explosive",
            78
        );
    }
}

function useShotgun(now = performance.now()) {
    if (!game || !game.running || game.paused || game.levelUpPending || game.stageRewardReady) {
        return;
    }

    const player = game.player;
    const nearest = getNearestEnemy();

    if (!nearest) {
        return;
    }

    const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
    player.facingX = Math.cos(angle);
    player.facingY = Math.sin(angle);

    if (player.weaponType === "pistol") {
        fireBullet(angle, getPlayerDamage() * 1.05, 580, "#ffff66", "normal");
        return;
    }

    if (player.weaponType === "shotgun") {
        fireShotgun(angle, 6, 0.72, getPlayerDamage() * 0.92, false);
        return;
    }

    if (now - player.lastExplosiveShotAt < player.explosiveShotCooldownMs) {
        return;
    }

    player.lastExplosiveShotAt = now;
    fireShotgun(angle, 8, 0.68, getPlayerDamage() * 0.88, true);
    createParticles(player.x, player.y, "#ff8c00", 18, 170);
}

function fireShotgun(angle, pelletCount, spread, damage, explosive) {
    for (let i = 0; i < pelletCount; i += 1) {
        const offset = pelletCount === 1
            ? 0
            : ((i / (pelletCount - 1)) - 0.5) * spread;

        fireBullet(
            angle + offset,
            damage,
            explosive ? 420 : 500,
            explosive ? "#ff7700" : "#ffdd66",
            explosive ? "explosive" : "normal",
            explosive ? 70 : 0
        );
    }
}

function fireBullet(angle, damage, speed, color, type = "normal", explosionRadius = 0) {
    const player = game.player;

    game.bullets.push({
        x: player.x + Math.cos(angle) * (player.radius + 4),
        y: player.y + Math.sin(angle) * (player.radius + 4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: type === "explosive" ? 6 : 4,
        damage,
        color,
        type,
        explosionRadius,
        lifeMs: type === "explosive" ? 950 : 1250
    });
}

function useUltimate() {
    if (!game || !game.running || game.paused || game.levelUpPending || game.stageRewardReady) {
        return;
    }

    const player = game.player;

    if (player.ultimateCharge < 100) {
        return;
    }

    player.ultimateCharge = 0;

    const damage = getPlayerDamage() * 4.4;
    const radius = 220;

    createParticles(player.x, player.y, "#ff0055", 52, 270);
    createParticles(player.x, player.y, "#ffcc00", 42, 230);

    const targets = [...game.enemies];

    for (const enemy of targets) {
        const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);

        if (distance <= radius + enemy.radius) {
            dealDamageToEnemy(enemy, damage, "#ffcc00");
        }
    }

    addFloatingText(player.x, player.y - 48, "終極技能！", "#ffcc00", 23);
}

function useDash(now = performance.now()) {
    if (!game || !game.running || game.paused || game.levelUpPending || game.stageRewardReady) {
        return;
    }

    const player = game.player;

    if (now - player.lastDashAt < player.dashCooldownMs) {
        return;
    }

    player.lastDashAt = now;
    player.dashUntil = now + 260;
    player.invulnerableUntil = now + 300;

    createParticles(player.x, player.y, "#00ffcc", 20, 180);
}

function updateBullets(deltaMs) {
    for (let index = game.bullets.length - 1; index >= 0; index -= 1) {
        const bullet = game.bullets[index];

        bullet.x += bullet.vx * deltaMs / 1000;
        bullet.y += bullet.vy * deltaMs / 1000;
        bullet.lifeMs -= deltaMs;

        let hitEnemy = null;

        for (const enemy of game.enemies) {
            const distance = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);

            if (distance < bullet.radius + enemy.radius) {
                hitEnemy = enemy;
                break;
            }
        }

        if (hitEnemy) {
            if (bullet.type === "explosive") {
                explodeBullet(bullet);
            } else {
                dealDamageToEnemy(hitEnemy, bullet.damage, bullet.color);
            }

            game.bullets.splice(index, 1);
            continue;
        }

        const outOfBounds =
            bullet.x < -30 ||
            bullet.x > canvas.width + 30 ||
            bullet.y < -30 ||
            bullet.y > canvas.height + 30;

        if (bullet.lifeMs <= 0 || outOfBounds) {
            if (bullet.type === "explosive") {
                explodeBullet(bullet);
            }

            game.bullets.splice(index, 1);
        }
    }
}

function explodeBullet(bullet) {
    createParticles(bullet.x, bullet.y, "#ff5500", 22, 220);
    createParticles(bullet.x, bullet.y, "#ffcc00", 14, 175);

    const targets = [...game.enemies];

    for (const enemy of targets) {
        const distance = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);

        if (distance <= bullet.explosionRadius + enemy.radius) {
            const falloff = Math.max(0.45, 1 - distance / (bullet.explosionRadius + enemy.radius));
            dealDamageToEnemy(enemy, bullet.damage * falloff, "#ff8800");
        }
    }
}

function dealDamageToEnemy(enemy, rawDamage, color) {
    if (!game.enemies.includes(enemy)) {
        return;
    }

    const damage = Math.max(1, Math.round(rawDamage));
    enemy.health -= damage;

    createParticles(enemy.x, enemy.y, color, 5, 105);
    addFloatingText(enemy.x, enemy.y - enemy.radius, `-${damage}`, color, 13);

    if (enemy.health <= 0) {
        killEnemy(enemy);
    }
}

function killEnemy(enemy) {
    const index = game.enemies.indexOf(enemy);

    if (index === -1) {
        return;
    }

    game.enemies.splice(index, 1);

    createParticles(enemy.x, enemy.y, enemy.color, enemy.type === "boss" ? 48 : 18, enemy.type === "boss" ? 250 : 140);

    game.kills += 1;
    game.gold += enemy.gold;
    gainXp(enemy.xp);

    if (enemy.type === "boss") {
        game.bossDefeated = true;
        addFloatingText(enemy.x, enemy.y - 75, "擊敗憤怒的卡比！", "#ffcc00", 22);
        updateAchievements();
        return;
    }

    game.stageKills += 1;
    updateAchievements();
}

function gainXp(amount) {
    const player = game.player;
    player.xp += amount;

    while (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level += 1;
        player.xpToNext = Math.round(player.xpToNext * 1.22);
        player.maxHealth += 8;
        player.health = Math.min(player.maxHealth, player.health + 22);
        player.baseDamage += 0.8;

        upgradeWeaponIfNeeded();
        requestLevelUp();
    }
}

function upgradeWeaponIfNeeded() {
    const player = game.player;

    if (player.level >= 5 && player.weaponLevel < 2) {
        player.weaponLevel = 2;
        player.weaponType = "shotgun";
        addFloatingText(player.x, player.y - 55, "武器進化：霰彈槍！", "#ffdd66", 19);
    }

    if (player.level >= 10 && player.weaponLevel < 3) {
        player.weaponLevel = 3;
        player.weaponType = "explosive";
        addFloatingText(player.x, player.y - 55, "武器進化：爆裂彈！", "#ff7700", 19);
    }
}

function requestLevelUp() {
    if (game.levelUpPending || game.stageRewardReady) {
        return;
    }

    game.levelUpPending = true;
