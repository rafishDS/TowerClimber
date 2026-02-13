// INITIALISATION DES ÉLÉMENTS DU DOM
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const overlay = document.getElementById('overlay');

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

// TYPES DE PLATEFORMES
const PLATFORM_TYPES = {
    normal: { color: '#00ffcc', probability: 0.5 },
    super: { color: '#ffff00', probability: 0.2, bounce: true },
    fragile: { color: '#ff8800', probability: 0.15, breakable: true },
    moving: { color: '#aa00ff', probability: 0.15, moves: true }
};

// GESTION DES PLATEFORMES
let platforms = [];

// Fonction pour créer une plateforme à une hauteur Y spécifique
function addPlatform(y) {
    // Déterminer le type de plateforme
    const rand = Math.random();
    let type = 'normal';
    let cumulative = 0;
    
    for (const [key, data] of Object.entries(PLATFORM_TYPES)) {
        cumulative += data.probability;
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
        moveDir: type === 'moving' ? (Math.random() > 0.5 ? 1 : -1) : 0,
        moveSpeed: 1.5,
        originalX: 0
    });
    
    // Stocker la position originale pour les plateformes mobiles
    if (type === 'moving') {
        platforms[platforms.length - 1].originalX = platforms[platforms.length - 1].x;
    }
}

// RESET DE LA PARTIE
function init() {
    // Reset du score et de l'état
    score = 0;
    gameActive = true;
    hasStarted = false;
    isPaused = false;
    scoreElement.innerText = score;
    
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
        moveDir: 0
    });

    // Création des premières plateformes visibles
    for(let i = 2; i < 10; i++) { 
        addPlatform(570 - (i * 110)); 
    }

    // Affichage de l'overlay de lancement
    overlay.style.display = 'block';
    overlay.innerHTML = `<h1>TOWER CLIMBER</h1><p>FLECHES: BOUGER</p><p>ESPACE: PAUSE</p><p><i>SAUTER POUR COMMENCER</i></p>`;
}

// RÉGLAGE DES TOUCHES
const keys = {};
window.onkeydown = (e) => {
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

    // Collisions / augmentation de points
    let currentlyOnGround = false;
    platforms.forEach(p => {
        // +1 point si le joueur passe une plateforme
        if (player.y < p.y && !p.isPassed) {
            p.isPassed = true;
            score++;
            scoreElement.innerText = score;
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
                } else if (p.type === 'fragile') {
                    // Plateforme fragile
                    player.vy = 0;
                    currentlyOnGround = true;
                    p.health--;
                    
                    // Faire clignoter et casser
                    if (p.health <= 0) {
                        setTimeout(() => {
                            platforms = platforms.filter(plat => plat !== p);
                        }, 100);
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

    // Défilement
    if (hasStarted) {
        let scrollSpeed = 1.2;
        platforms.forEach(p => p.y += scrollSpeed);
        player.y += scrollSpeed;

        // Suit le joueur s'il monte trop haut
        if (player.y < canvas.height / 2) {
            let diff = canvas.height / 2 - player.y;
            platforms.forEach(p => p.y += diff);
            player.y += diff;
        }

        // Génération de plateforme en haut (infini)
        if (platforms.length > 0 && platforms[platforms.length - 1].y > 0) {
            addPlatform(platforms[platforms.length - 1].y - 110);
        }
        
        // Suppression des plateformes plus visibles
        platforms = platforms.filter(p => p.y < canvas.height + 100);

        // MENU DU GAME OVER / HIGH SCORE
        if (player.y > canvas.height) {
            gameActive = false;
            
            let highScore = localStorage.getItem('towerHighscore') || 0;
            
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('towerHighscore', highScore);
            }

            overlay.innerHTML = `
                <h1>GAME OVER</h1>
                <p>SCORE: ${score}</p>
                <p style="color: #ffff00;">RECORD: ${highScore}</p> 
                <br>
                <p><i>ESPACE POUR REJOUER</i></p>
            `;
            overlay.style.display = 'block';
        }
    }
}

// RENDU GRAPHIQUE
function draw() {
    // Effacement du canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

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
    
    // Indicateur de pause
    if (isPaused) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
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

console.log('🎮 Tower Climber avec 4 types de plateformes!');
console.log('🔵 Cyan = Normal | 🟡 Jaune = Super (rebond) | 🟠 Orange = Fragile | 🟣 Violet = Mobile');