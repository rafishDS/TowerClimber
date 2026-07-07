// INITIALISATION DES ÉLÉMENTS DU DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const highScoreElement = document.getElementById('highscore');
const overlay = document.getElementById('overlay');
const comboUI = document.getElementById('comboUI');
const comboCountEl = document.getElementById('comboCount');

// Configuration du canvas
canvas.width = 400;
canvas.height = 600;

// VARIABLES DE CONFIGURATION DU JEU
let score = 0;
let gameActive = true;
let hasStarted = false;
let isPaused = false;
const gravity = 0.5;
const jumpStrength = -12;
const superJumpStrength = -22;

// --- DIFFICULTÉ PROGRESSIVE ---
const BASE_SCROLL_SPEED = 1.2;
const MAX_SCROLL_SPEED = 3.6;
let scrollSpeed = BASE_SCROLL_SPEED;

// --- COMBO SYSTEM ---
let combo = 0;
let comboTimer = 0;
const COMBO_WINDOW = 95; // frames avant reset du combo (~1.6s à 60fps)
let floatingTexts = []; // popups "+N COMBO xN" qui montent et fondent

// --- JUICE : PARTICULES / SCREEN SHAKE / TRAIL ---
let particles = [];
let shakeMagnitude = 0;
let shakeDuration = 0;
let playerTrail = [];

// --- SON (Web Audio API, pas de fichiers à charger) ---
let audioCtx = null;
function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
function beep({ freqStart, freqEnd, duration, type = 'square', volume = 0.15 }) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, audioCtx.currentTime);
    if (freqEnd !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), audioCtx.currentTime + duration);
    }
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}
const sounds = {
    jump: () => beep({ freqStart: 300, freqEnd: 500, duration: 0.1 }),
    superJump: () => beep({ freqStart: 400, freqEnd: 900, duration: 0.18, type: 'sawtooth', volume: 0.18 }),
    break: () => beep({ freqStart: 200, freqEnd: 60, duration: 0.15, type: 'triangle' }),
    combo: () => beep({ freqStart: 600, freqEnd: 1100, duration: 0.12, type: 'sine', volume: 0.12 }),
    gameOver: () => beep({ freqStart: 300, freqEnd: 60, duration: 0.5, type: 'sawtooth', volume: 0.2 })
};

// --- THÈMES VISUELS PAR HAUTEUR ATTEINTE ---
const THEMES = [
    { minScore: 0, glow: '#ff0055', accent: '#00ffcc', bg: '#050505' },
    { minScore: 30, glow: '#00ffcc', accent: '#ff0055', bg: '#020a08' },
    { minScore: 70, glow: '#aa00ff', accent: '#ffff00', bg: '#0a0510' },
    { minScore: 120, glow: '#ffaa00', accent: '#ff0055', bg: '#100701' },
    { minScore: 200, glow: '#ffffff', accent: '#00ffcc', bg: '#020202' }
];
let currentThemeIndex = -1;
function applyTheme(forScore) {
    let theme = THEMES[0];
    for (const t of THEMES) {
        if (forScore >= t.minScore) theme = t;
    }
    const idx = THEMES.indexOf(theme);
    if (idx !== currentThemeIndex) {
        currentThemeIndex = idx;
        document.documentElement.style.setProperty('--glow-color', theme.glow);
        document.documentElement.style.setProperty('--accent-color', theme.accent);
        document.body.style.background = theme.bg;
    }
}

// --- LEADERBOARD LOCAL (TOP 5) ---
function getLeaderboard() {
    try {
        return JSON.parse(localStorage.getItem('towerLeaderboard')) || [];
    } catch (e) {
        return [];
    }
}
function saveToLeaderboard(finalScore) {
    const board = getLeaderboard();
    board.push({ score: finalScore, date: new Date().toLocaleDateString() });
    board.sort((a, b) => b.score - a.score);
    const top5 = board.slice(0, 5);
    localStorage.setItem('towerLeaderboard', JSON.stringify(top5));
    return top5;
}
function renderLeaderboard(board, highlightScore) {
    if (board.length === 0) return '<p><i>Aucun score encore</i></p>';
    return board.map((entry, i) => {
        const isNew = entry.score === highlightScore;
        return `<p style="color:${isNew ? '#ffff00' : '#fff'}">${i + 1}. ${entry.score} pts</p>`;
    }).join('');
}

// PROPRIÉTÉS DU JOUEUR
const player = {
    x: 185,
    y: 540,
    width: 30,
    height: 30,
    vx: 0,
    vy: 0,
    grounded: true
};

// TYPES DE PLATEFORMES (probabilités DE BASE, ajustées dynamiquement selon le score)
const PLATFORM_TYPES = {
    normal: { color: '#00ffcc', baseProbability: 0.5 },
    super: { color: '#ffff00', baseProbability: 0.2, bounce: true },
    fragile: { color: '#ff8800', baseProbability: 0.15, breakable: true },
    moving: { color: '#aa00ff', baseProbability: 0.15, moves: true }
};

// Calcule les probabilités ajustées : plus on monte, moins de "normal", plus de "fragile"/"moving"
function getAdjustedProbabilities(currentScore) {
    // Facteur de difficulté entre 0 (début) et 1 (plafonné vers 150 points)
    const difficultyFactor = Math.min(currentScore / 150, 1);

    const normal = PLATFORM_TYPES.normal.baseProbability - 0.30 * difficultyFactor;
    const fragile = PLATFORM_TYPES.fragile.baseProbability + 0.15 * difficultyFactor;
    const moving = PLATFORM_TYPES.moving.baseProbability + 0.15 * difficultyFactor;
    const superP = PLATFORM_TYPES.super.baseProbability;

    return { normal: Math.max(normal, 0.1), super: superP, fragile, moving };
}

// GESTION DES PLATEFORMES
let platforms = [];

// Fonction pour créer une plateforme à une hauteur Y spécifique
function addPlatform(y) {
    const probs = getAdjustedProbabilities(score);
    const rand = Math.random();
    let type = 'normal';
    let cumulative = 0;

    for (const [key, probability] of Object.entries(probs)) {
        cumulative += probability;
        if (rand < cumulative) {
            type = key;
            break;
        }
    }

    const typeData = PLATFORM_TYPES[type];

    platforms.push({
        x: Math.random() * (canvas.width - 70),
        y: y,
        width: 70,
        height: 15,
        type: type,
        color: typeData.color,
        isPassed: false,
        health: type === 'fragile' ? 1 : 999,
        toRemove: false,
        moveDir: type === 'moving' ? (Math.random() > 0.5 ? 1 : -1) : 0,
        moveSpeed: 1.5,
        originalX: 0
    });

    // Stocker la position originale pour les plateformes mobiles
    if (type === 'moving') {
        platforms[platforms.length - 1].originalX = platforms[platforms.length - 1].x;
    }
}

// --- PARTICULES ---
function spawnParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6 - 2,
            life: 1,
            decay: 0.03 + Math.random() * 0.03,
            size: 2 + Math.random() * 3,
            color
        });
    }
}
function updateParticles() {
    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= p.decay;
    });
    particles = particles.filter(p => p.life > 0);
}
function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
}

// --- SCREEN SHAKE ---
function triggerShake(magnitude, duration) {
    shakeMagnitude = magnitude;
    shakeDuration = duration;
}
function updateShake() {
    if (shakeDuration > 0) {
        shakeDuration--;
    } else {
        shakeMagnitude = 0;
    }
}

// --- FLOATING TEXT (popups de combo) ---
function spawnFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, life: 1 });
}
function updateFloatingTexts() {
    floatingTexts.forEach(t => {
        t.y -= 1;
        t.life -= 0.02;
    });
    floatingTexts = floatingTexts.filter(t => t.life > 0);
}
function drawFloatingTexts() {
    ctx.font = '10px "Press Start 2P", monospace';
    floatingTexts.forEach(t => {
        ctx.globalAlpha = Math.max(t.life, 0);
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1;
}

// RESET DE LA PARTIE
function init() {
    // Reset du score et de l'état
    score = 0;
    gameActive = true;
    hasStarted = false;
    isPaused = false;
    scoreElement.innerText = score;
    scrollSpeed = BASE_SCROLL_SPEED;

    combo = 0;
    comboTimer = 0;
    comboUI.classList.add('hidden');

    particles = [];
    floatingTexts = [];
    playerTrail = [];
    shakeMagnitude = 0;
    shakeDuration = 0;

    highScoreElement.innerText = localStorage.getItem('towerHighscore') || 0;
    applyTheme(0);

    // Reset du joueur au centre
    player.x = canvas.width / 2 - 15;
    player.y = 540;
    player.vy = 0;
    player.vx = 0;
    player.grounded = true;

    // Reset des plateformes
    platforms = [];
    // Le sol de départ
    platforms.push({
        x: 0,
        y: 570,
        width: canvas.width,
        height: 30,
        type: 'normal',
        color: PLATFORM_TYPES.normal.color,
        isPassed: true,
        health: 999,
        toRemove: false,
        moveDir: 0
    });

    // La plateforme de départ au centre
    platforms.push({
        x: canvas.width / 2 - 35,
        y: 570 - 110,
        width: 70,
        height: 15,
        type: 'normal',
        color: PLATFORM_TYPES.normal.color,
        isPassed: false,
        health: 999,
        toRemove: false,
        moveDir: 0
    });

    // Création des premières plateformes visibles
    for (let i = 2; i < 10; i++) {
        addPlatform(570 - (i * 110));
    }

    // Affichage de l'overlay de lancement
    overlay.style.display = 'block';
    overlay.innerHTML = `<h1>TOWER CLIMBER</h1><p>FLECHES: BOUGER</p><p>ESPACE: PAUSE</p><p><i>SAUTER POUR COMMENCER</i></p>`;
}

// RÉGLAGE DES TOUCHES
const keys = {};
window.onkeydown = (e) => {
    ensureAudio();

    // Gestion de la pause avec Espace
    if (e.code === 'Space') {
        if (!gameActive) {
            init();
            requestAnimationFrame(loop);
        } else if (hasStarted) {
            isPaused = !isPaused;
            overlay.style.display = isPaused ? 'block' : 'none';
            if (isPaused) {
                overlay.innerHTML = `<h1>PAUSE</h1><p><i>ESPACE POUR REPRENDRE</i></p>`;
            }
        }
        return;
    }

    keys[e.key.toLowerCase()] = true;
    keys[e.code] = true;
};

window.onkeyup = (e) => {
    keys[e.key.toLowerCase()] = false;
    keys[e.code] = false;
};

// PROGRAMME
function update() {
    if (!gameActive || isPaused) return;

    // Déplacement horizontal
    if (keys['arrowleft'] || keys['q'] || keys['a']) player.vx = -6;
    else if (keys['arrowright'] || keys['d']) player.vx = 6;
    else player.vx = 0;

    // Saut
    if ((keys['arrowup'] || keys['z'] || keys['w']) && player.grounded) {
        player.vy = jumpStrength;
        player.grounded = false;
        sounds.jump();
        if (!hasStarted) {
            hasStarted = true;
            overlay.style.display = 'none';
        }
    }

    // Application de la gravité
    if (hasStarted || !player.grounded) {
        player.vy += gravity;
        player.y += player.vy;
        player.x += player.vx;
    }

    // Trail du joueur (pendant la chute, pour donner de la vitesse)
    if (hasStarted) {
        playerTrail.push({ x: player.x, y: player.y, life: 1 });
        if (playerTrail.length > 8) playerTrail.shift();
        playerTrail.forEach(t => t.life -= 0.15);
        playerTrail = playerTrail.filter(t => t.life > 0);
    }

    // Wrap around
    if (player.x + player.width < 0) player.x = canvas.width;
    if (player.x > canvas.width) player.x = -player.width;

    // Mise à jour des plateformes mobiles
    platforms.forEach(p => {
        if (p.moveDir !== 0) {
            p.x += p.moveSpeed * p.moveDir;
            // Inverser la direction si on s'éloigne trop
            if (Math.abs(p.x - p.originalX) > 80) {
                p.moveDir *= -1;
            }
        }
    });

    // Gestion du timer de combo (reset si trop de temps sans nouvelle plateforme passée)
    if (hasStarted) {
        comboTimer++;
        if (comboTimer > COMBO_WINDOW && combo > 0) {
            combo = 0;
            comboUI.classList.add('hidden');
        }
    }

    // Collisions / augmentation de points
    let currentlyOnGround = false;
    platforms.forEach(p => {
        // Points si le joueur passe une plateforme, avec bonus de combo
        if (player.y < p.y && !p.isPassed) {
            p.isPassed = true;

            if (comboTimer <= COMBO_WINDOW) {
                combo++;
            } else {
                combo = 1;
            }
            comboTimer = 0;

            const multiplier = combo >= 10 ? 3 : combo >= 5 ? 2 : 1;
            score += multiplier;
            scoreElement.innerText = score;

            if (combo >= 3) {
                comboUI.classList.remove('hidden');
                comboCountEl.innerText = combo;
                spawnFloatingText(p.x + p.width / 2 - 15, p.y - 5, `+${multiplier} COMBO x${combo}`, '#ffff00');
                if (combo % 5 === 0) sounds.combo();
            }

            applyTheme(score);
        }

        // Atterrissage sur plateforme
        if (player.vy > 0) {
            if (player.x < p.x + p.width && player.x + player.width > p.x &&
                player.y + player.height > p.y && player.y + player.height < p.y + p.height + player.vy) {

                player.y = p.y - player.height;

                // Comportement selon le type
                if (p.type === 'super') {
                    // Rebond automatique
                    player.vy = superJumpStrength;
                    player.grounded = false;
                    sounds.superJump();
                    spawnParticles(p.x + p.width / 2, p.y, p.color, 14);
                } else if (p.type === 'fragile') {
                    // Plateforme fragile
                    player.vy = 0;
                    currentlyOnGround = true;
                    p.health--;

                    // Marquer pour suppression au lieu d'un setTimeout (plus sûr avec le scroll)
                    if (p.health <= 0) {
                        p.toRemove = true;
                        sounds.break();
                        spawnParticles(p.x + p.width / 2, p.y, p.color, 12);
                        triggerShake(2, 6);
                    }
                } else {
                    // Normal ou mobile
                    player.vy = 0;
                    currentlyOnGround = true;
                }
            }
        }
    });
    player.grounded = currentlyOnGround;

    // Suppression différée des plateformes fragiles cassées
    if (platforms.some(p => p.toRemove)) {
        platforms = platforms.filter(p => !p.toRemove);
    }

    // Défilement (vitesse progressive selon le score : plus on monte, plus ça va vite)
    if (hasStarted) {
        scrollSpeed = Math.min(BASE_SCROLL_SPEED + score * 0.01, MAX_SCROLL_SPEED);

        platforms.forEach(p => p.y += scrollSpeed);
        player.y += scrollSpeed;
        playerTrail.forEach(t => t.y += scrollSpeed);
        particles.forEach(p => p.y += scrollSpeed);
        floatingTexts.forEach(t => t.y += scrollSpeed);

        // Suit le joueur s'il monte trop haut
        if (player.y < canvas.height / 2) {
            let diff = canvas.height / 2 - player.y;
            platforms.forEach(p => p.y += diff);
            player.y += diff;
            playerTrail.forEach(t => t.y += diff);
            particles.forEach(p => p.y += diff);
            floatingTexts.forEach(t => t.y += diff);
        }

        // Génération de plateforme en haut (infini)
        if (platforms.length > 0 && platforms[platforms.length - 1].y > 0) {
            addPlatform(platforms[platforms.length - 1].y - 110);
        }

        // Suppression des plateformes plus visibles
        platforms = platforms.filter(p => p.y < canvas.height + 100);

        // MENU DU GAME OVER / HIGH SCORE / LEADERBOARD
        if (player.y > canvas.height) {
            gameActive = false;
            sounds.gameOver();
            triggerShake(6, 15);

            let highScore = localStorage.getItem('towerHighscore') || 0;
            const isNewHighScore = score > highScore;

            if (isNewHighScore) {
                highScore = score;
                localStorage.setItem('towerHighscore', highScore);
            }

            const board = saveToLeaderboard(score);

            overlay.innerHTML = `
                <h1>GAME OVER</h1>
                <p>SCORE: ${score}</p>
                <p style="color: #ffff00;">${isNewHighScore ? 'NOUVEAU RECORD !' : 'RECORD: ' + highScore}</p>
                <br>
                <p style="color:#00ffcc;">TOP 5</p>
                ${renderLeaderboard(board, score)}
                <br>
                <p><i>ESPACE POUR REJOUER</i></p>
            `;
            overlay.style.display = 'block';
        }
    }

    updateParticles();
    updateFloatingTexts();
    updateShake();
}

// RENDU GRAPHIQUE
function draw() {
    ctx.save();

    // Screen shake
    if (shakeMagnitude > 0) {
        const dx = (Math.random() - 0.5) * shakeMagnitude;
        const dy = (Math.random() - 0.5) * shakeMagnitude;
        ctx.translate(dx, dy);
    }

    // Effacement du canvas
    ctx.clearRect(-10, -10, canvas.width + 20, canvas.height + 20);

    // Trail du joueur
    playerTrail.forEach(t => {
        ctx.globalAlpha = Math.max(t.life, 0) * 0.4;
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(t.x, t.y, player.width, player.height);
    });
    ctx.globalAlpha = 1;

    // Dessin des plateformes
    platforms.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.width, p.height);

        // Indicateurs visuels pour les plateformes fragiles
        if (p.type === 'fragile' && p.health < 1) {
            ctx.globalAlpha = 0.5;
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.globalAlpha = 1;

            // Fissures
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x + p.width / 2, p.y);
            ctx.lineTo(p.x + p.width / 2 - 10, p.y + p.height);
            ctx.stroke();
        }
    });

    // Dessin du joueur
    ctx.fillStyle = '#ff0055';
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Yeux du joueur
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x + 8, player.y + 10, 5, 5);
    ctx.fillRect(player.x + 17, player.y + 10, 5, 5);

    // Particules et popups de combo
    drawParticles();
    drawFloatingTexts();

    // Indicateur de pause
    if (isPaused) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.restore();
}

// BOUCLE DE JEU
function loop() {
    update();
    draw();
    if (gameActive) requestAnimationFrame(loop);
}

// Lancement initial
init();
loop();

console.log('🎮 Tower Climber - difficulté progressive, combos, effets et leaderboard local !');
console.log('🔵 Cyan = Normal | 🟡 Jaune = Super (rebond) | 🟠 Orange = Fragile | 🟣 Violet = Mobile');
