/* =====================================================================
   TOWER CLIMBER — version navigateur (clavier uniquement)
   Canvas 2D + JS vanilla. Touches modifiables dans les paramètres.
   Sauvegarde : localStorage.
   ===================================================================== */
(() => {
'use strict';

const W = 480, H = 720;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => Math.floor(n).toLocaleString('fr-FR');

/* ------------------------------------------------------------------ */
/*  DONNÉES                                                           */
/* ------------------------------------------------------------------ */
const DEFAULT_KEYS = {
  left:  ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  start: ['Space', 'ArrowUp'],
  pause: ['Escape', 'KeyP'],
  prev:  ['PageUp', 'KeyQ'],
  next:  ['PageDown', 'KeyE'],
};
const ACTIONS = [
  ['left', 'Aller à gauche'], ['right', 'Aller à droite'],
  ['start', 'Démarrer / Valider'], ['pause', 'Pause / Retour'],
  ['prev', 'Page précédente'], ['next', 'Page suivante'],
];

const MODES = {
  normal:   { name: 'ASCENSION',        desc: 'Monte sans fin',                    timed: 0 },
  hcFragile:{ name: 'HARDCORE FRAGILE', desc: 'Que des plateformes fragiles',      timed: 0 },
  hcMoving: { name: 'HARDCORE MOBILE',  desc: 'Que des plateformes mobiles',       timed: 0 },
  hcMixed:  { name: 'HARDCORE MIXTE',   desc: 'Fragiles + mobiles, bon courage',   timed: 0 },
  chrono:   { name: 'CHRONO 60S',       desc: 'Meilleur score en 1 minute',        timed: 60 },
  rush:     { name: 'CHASSE AUX PIÈCES',desc: 'Un max de pièces en 1 min (dispo toutes les 2 h)', timed: 60 },
};
const RUSH_COOLDOWN = 2 * 3600 * 1000;

const ITEMS = [
  // skins
  { id: 'skin_default', cat: 'skin', name: 'Cyan', price: 0 },
  { id: 'skin_pink', cat: 'skin', name: 'Rose', price: 150 },
  { id: 'skin_green', cat: 'skin', name: 'Vert', price: 150 },
  { id: 'skin_orange', cat: 'skin', name: 'Orange', price: 150 },
  { id: 'skin_neon', cat: 'skin', name: 'Néon', price: 900 },
  { id: 'skin_ice', cat: 'skin', name: 'Glace', price: 900 },
  { id: 'skin_lava', cat: 'skin', name: 'Lave', price: 1000 },
  { id: 'skin_camo', cat: 'skin', name: 'Camouflage', price: 700 },
  { id: 'skin_gold', cat: 'skin', name: 'Or', price: 1200 },
  { id: 'skin_chrome', cat: 'skin', name: 'Chrome', price: 1800 },
  { id: 'skin_liquidgold', cat: 'skin', name: 'Or liquide', price: 2000 },
  { id: 'skin_holo', cat: 'skin', name: 'Holo', price: 2500 },
  { id: 'skin_rainbow', cat: 'skin', name: 'Arc-en-ciel', price: 3000 },
  { id: 'skin_cloud', cat: 'skin', name: 'Nuage', price: 0, ach: 'z1', desc: 'Succès : atteindre les nuages' },
  { id: 'skin_atmo', cat: 'skin', name: 'Atmosphère', price: 0, ach: 'z2', desc: 'Succès : atteindre l\'atmosphère' },
  { id: 'skin_space', cat: 'skin', name: 'Espace', price: 0, ach: 'z3', desc: 'Succès : atteindre l\'espace' },
  { id: 'skin_planet', cat: 'skin', name: 'Planète', price: 0, ach: 'z4', desc: 'Succès : atteindre la planète' },
  // accessoires
  { id: 'acc_none', cat: 'acc', name: 'Aucun', price: 0 },
  { id: 'acc_cap', cat: 'acc', name: 'Casquette', price: 300 },
  { id: 'acc_glasses', cat: 'acc', name: 'Lunettes', price: 450 },
  { id: 'acc_crown', cat: 'acc', name: 'Couronne', price: 900 },
  // traînées
  { id: 'trail_default', cat: 'trail', name: 'Classique', price: 0 },
  { id: 'trail_sparkle', cat: 'trail', name: 'Étincelles', price: 700 },
  { id: 'trail_rainbow', cat: 'trail', name: 'Arc-en-ciel', price: 1500 },
  // thèmes de plateformes
  { id: 'theme_default', cat: 'theme', name: 'Néon', price: 0 },
  { id: 'theme_pastel', cat: 'theme', name: 'Pastel', price: 800 },
  { id: 'theme_mono', cat: 'theme', name: 'Monochrome', price: 800 },
  // formes
  { id: 'shape_square', cat: 'shape', name: 'Carré', price: 0 },
  { id: 'shape_circle', cat: 'shape', name: 'Rond', price: 400 },
  { id: 'shape_triangle', cat: 'shape', name: 'Triangle', price: 600 },
  { id: 'shape_diamond', cat: 'shape', name: 'Diamant', price: 800 },
];
const CATS = [['skin', 'SKINS'], ['acc', 'ACCESSOIRES'], ['trail', 'TRAÎNÉES'], ['theme', 'THÈMES'], ['shape', 'FORMES']];
const EQ_KEY = { skin: 'skin', acc: 'acc', trail: 'trail', theme: 'theme', shape: 'shape' };
const LIFE_PRICE = 200;
const itemById = id => ITEMS.find(i => i.id === id);

/* ------------------------------------------------------------------ */
/*  SAUVEGARDE                                                        */
/* ------------------------------------------------------------------ */
const SAVE_KEY = 'towerclimber_web_v2';
const defStats = () => ({ games: 0, jumps: 0, totalScore: 0, totalHeight: 0, playTime: 0, coinsEarned: 0,
  superBounces: 0, fragileBroken: 0, windSurvived: 0, continues: 0, ice: 0, conveyor: 0,
  bestHeight: 0, bestScore: 0, zoneReached: 0 });
const defSave = () => ({
  coins: 0, lives: 0,
  owned: ['skin_default', 'acc_none', 'trail_default', 'theme_default', 'shape_square'],
  eq: { skin: 'skin_default', acc: 'acc_none', trail: 'trail_default', theme: 'theme_default', shape: 'shape_square' },
  seen: [], hi: {}, top: {}, stats: defStats(), ach: [], rush: 0,
  settings: { sens: 5, sound: true },
  keys: JSON.parse(JSON.stringify(DEFAULT_KEYS)), labels: {},
});
let save = defSave();
function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (raw) {
      const d = defSave();
      save = Object.assign(d, raw);
      save.eq = Object.assign(d.eq, raw.eq || {});
      save.stats = Object.assign(defStats(), raw.stats || {});
      save.settings = Object.assign(d.settings, raw.settings || {});
      save.keys = Object.assign(JSON.parse(JSON.stringify(DEFAULT_KEYS)), raw.keys || {});
      save.labels = raw.labels || {};
    }
  } catch (e) { save = defSave(); }
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
loadSave();

/* ------------------------------------------------------------------ */
/*  SUCCÈS                                                            */
/* ------------------------------------------------------------------ */
const ACH = [];
const addAch = (id, name, desc, goal, get) => ACH.push({ id, name, desc, goal, get });
[100, 500, 1000, 2500, 5000, 10000].forEach(n => addAch('sc' + n, 'Score ' + fmt(n), `Atteins ${fmt(n)} points en une partie`, n, s => s.bestScore));
addAch('z1', 'Dans les nuages', 'Atteins la zone des nuages', 1, s => s.zoneReached >= 1 ? 1 : 0);
addAch('z2', 'Haute altitude', 'Atteins l\'atmosphère', 1, s => s.zoneReached >= 2 ? 1 : 0);
addAch('z3', 'Cosmonaute', 'Atteins l\'espace', 1, s => s.zoneReached >= 3 ? 1 : 0);
addAch('z4', 'Conquérant', 'Atteins la planète', 1, s => s.zoneReached >= 4 ? 1 : 0);
[5000, 20000, 50000, 100000, 250000].forEach(n => addAch('tot' + n, 'Total ' + fmt(n), `Cumule ${fmt(n)} points au total`, n, s => s.totalScore));
const countOwned = cat => ITEMS.filter(i => i.cat === cat).filter(i => save.owned.includes(i.id)).length;
const countCat = cat => ITEMS.filter(i => i.cat === cat).length;
[['skin', 'Collectionneur de skins', 'Possède tous les skins'], ['acc', 'Accessoiriste', 'Possède tous les accessoires'],
 ['theme', 'Décorateur', 'Possède tous les thèmes'], ['shape', 'Géomètre', 'Possède toutes les formes']].forEach(([c, n, d]) =>
  addAch('col_' + c, n, d, countCat(c), () => countOwned(c)));
[500, 2000, 5000, 10000].forEach(n => addAch('coin' + n, 'Riche ' + fmt(n), `Gagne ${fmt(n)} pièces au total`, n, s => s.coinsEarned));
[50, 200].forEach(n => addAch('sb' + n, 'Trampoline ' + n, `Rebondis ${n} fois sur une plateforme jaune`, n, s => s.superBounces));
[30, 100].forEach(n => addAch('fr' + n, 'Casseur ' + n, `Casse ${n} plateformes fragiles`, n, s => s.fragileBroken));
addAch('wind10', 'Contre vents', 'Survis à 10 zones de vent', 10, s => s.windSurvived);
addAch('cont5', 'Increvable', 'Utilise 5 vies', 5, s => s.continues);
[100, 1000].forEach(n => addAch('ice' + n, 'Patineur ' + n, `Atterris sur ${fmt(n)} plateformes de glace`, n, s => s.ice));
[100, 1000].forEach(n => addAch('cv' + n, 'Tapis roulant ' + n, `Atterris sur ${fmt(n)} tapis roulants`, n, s => s.conveyor));
[5000, 20000].forEach(n => addAch('h' + n, 'Hauteur ' + fmt(n), `Grimpe ${fmt(n)} de hauteur en une partie`, n, s => s.bestHeight));

function checkAch() {
  const fresh = [];
  for (const a of ACH) {
    if (save.ach.includes(a.id)) continue;
    if (a.get(save.stats) >= a.goal) {
      save.ach.push(a.id); fresh.push(a);
      const sk = ITEMS.find(i => i.ach === a.id);
      if (sk && !save.owned.includes(sk.id)) save.owned.push(sk.id);
    }
  }
  return fresh;
}

/* ------------------------------------------------------------------ */
/*  TOUCHES                                                           */
/* ------------------------------------------------------------------ */
const held = new Set();
const is = (act, code) => save.keys[act].includes(code);
const anyHeld = act => save.keys[act].some(c => c && held.has(c));
let layoutMap = null;
if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
  navigator.keyboard.getLayoutMap().then(m => { layoutMap = m; refreshAll(); }).catch(() => {});
}
function keyLabel(code) {
  if (!code) return '—';
  if (save.labels[code]) return save.labels[code];
  const fixed = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Space: 'ESPACE', Escape: 'ÉCHAP',
    Enter: 'ENTRÉE', PageUp: 'PGUP', PageDown: 'PGDN', ShiftLeft: 'MAJ G', ShiftRight: 'MAJ D', ControlLeft: 'CTRL G',
    ControlRight: 'CTRL D', Tab: 'TAB', Backspace: 'RETOUR', NumpadEnter: 'ENTRÉE' };
  if (fixed[code]) return fixed[code];
  if (layoutMap && layoutMap.get(code)) return layoutMap.get(code).toUpperCase();
  return code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'PAV.');
}
const labels = act => save.keys[act].filter(Boolean).map(keyLabel);
const mainLabel = act => labels(act)[0] || '—';

/* ------------------------------------------------------------------ */
/*  SON                                                               */
/* ------------------------------------------------------------------ */
let ac = null;
function audioInit() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (ac && ac.state === 'suspended') ac.resume();
}
function beep(type, f0, f1, dur, vol = 0.07, delay = 0) {
  if (!save.settings.sound || !ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.03);
}
const SND = {
  jump: () => beep('square', 320, 640, .12),
  superJump: () => beep('sawtooth', 200, 1000, .3, .1),
  brk: () => beep('sawtooth', 260, 50, .25),
  coin: () => { beep('square', 880, 880, .07); beep('square', 1320, 1320, .1, .06, .07); },
  over: () => { beep('triangle', 440, 110, .7, .12); },
  click: () => beep('square', 520, 520, .05, .04),
  ok: () => [523, 659, 784, 1047].forEach((f, i) => beep('square', f, f, .12, .05, i * .09)),
  ice: () => beep('sine', 1200, 800, .1, .05),
  wind: () => beep('triangle', 150, 300, .6, .05),
};

/* ------------------------------------------------------------------ */
/*  PIXEL ICONS                                                       */
/* ------------------------------------------------------------------ */
const ICON = {
  coin: { rows: ['..bbbb..', '.byyyyb.', 'byyYYyyb', 'byyYyyyb', 'byyYyyyb', 'byyYYyyb', '.byyyyb.', '..bbbb..'],
    pal: { b: '#b8860b', y: '#ffd400', Y: '#fff3a0' } },
  heart: { rows: ['.rr..rr.', 'rRRrrrrr', 'rRrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rrrr..', '...rr...'], pal: { r: '#ff0055', R: '#ffb3c9' } },
  gear: { rows: ['...xxx...', '.x.xxx.x.', '.xxxxxxx.', 'xxxx.xxxx', 'xxx...xxx', 'xxxx.xxxx', '.xxxxxxx.', '.x.xxx.x.', '...xxx...'], pal: { x: '#ffffff' } },
  lock: { rows: ['..xxxx..', '.x....x.', '.x....x.', 'xxxxxxxx', 'xxx..xxx', 'xxx..xxx', 'xxxxxxxx'], pal: { x: '#ffffff' } },
};
function pixSVG(name) {
  const ic = ICON[name]; const h = ic.rows.length, w = ic.rows[0].length; let r = '';
  ic.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ic.pal[ch]) r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${ic.pal[ch]}"/>`; }));
  return `<svg viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">${r}</svg>`;
}
function pixCanvas(name) {
  const ic = ICON[name]; const c = document.createElement('canvas'); c.width = ic.rows[0].length; c.height = ic.rows.length;
  const x = c.getContext('2d');
  ic.rows.forEach((row, y) => [...row].forEach((ch, i) => { if (ic.pal[ch]) { x.fillStyle = ic.pal[ch]; x.fillRect(i, y, 1, 1); } }));
  return c;
}
const coinImg = pixCanvas('coin');

/* ------------------------------------------------------------------ */
/*  DESSIN : joueur                                                   */
/* ------------------------------------------------------------------ */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f > 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
const BASE = { skin_default: '#00ffcc', skin_pink: '#ff5fb0', skin_green: '#66ff33', skin_orange: '#ff9a1a', skin_neon: '#ff00ff',
  skin_ice: '#a8e8ff', skin_lava: '#ff4400', skin_camo: '#4a6b2c', skin_gold: '#ffcc00', skin_chrome: '#c9ced6', skin_liquidgold: '#ffbb00',
  skin_holo: '#9fd8ff', skin_rainbow: '#ff00aa', skin_cloud: '#ffffff', skin_atmo: '#4aa3ff', skin_space: '#2a1a6e', skin_planet: '#e0762b' };
function baseColor(skin, t) {
  if (skin === 'skin_rainbow') return `hsl(${(t * 120) % 360},100%,55%)`;
  if (skin === 'skin_holo') return `hsl(${(t * 60 + 180) % 360},90%,70%)`;
  return BASE[skin] || '#00ffcc';
}
function shapePath(c, shape, r) {
  c.beginPath();
  if (shape === 'shape_circle') { c.arc(0, 0, r, 0, Math.PI * 2); }
  else if (shape === 'shape_triangle') { c.moveTo(0, -r); c.lineTo(r, r); c.lineTo(-r, r); c.closePath(); }
  else if (shape === 'shape_diamond') { c.moveTo(0, -r); c.lineTo(r, 0); c.lineTo(0, r); c.lineTo(-r, 0); c.closePath(); }
  else {
    const n = r * 0.24;
    c.moveTo(-r + n, -r); c.lineTo(r - n, -r); c.lineTo(r - n, -r + n); c.lineTo(r, -r + n); c.lineTo(r, r - n); c.lineTo(r - n, r - n);
    c.lineTo(r - n, r); c.lineTo(-r + n, r); c.lineTo(-r + n, r - n); c.lineTo(-r, r - n); c.lineTo(-r, -r + n); c.lineTo(-r + n, -r + n); c.closePath();
  }
}
function skinFill(c, skin, r, t) {
  const lin = stops => { const g = c.createLinearGradient(-r, -r, r, r); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
  switch (skin) {
    case 'skin_gold': return lin(['#fff2a8', '#ffcc00', '#b8860b']);
    case 'skin_chrome': return lin(['#ffffff', '#8c95a3', '#e8ecf2', '#5d6673']);
    case 'skin_liquidgold': return lin(['#ffe27a', '#ffb800', '#c98a00']);
    case 'skin_lava': return lin(['#ffdd00', '#ff4400', '#7a0a00']);
    case 'skin_neon': return '#14002a';
    case 'skin_camo': return '#4a6b2c';
    case 'skin_ice': return lin(['#ffffff', '#a8e8ff', '#5fb4e8']);
    case 'skin_cloud': return lin(['#ffffff', '#dfeaff']);
    case 'skin_atmo': return lin(['#bde0ff', '#3b82f6', '#13236b']);
    case 'skin_space': return lin(['#0b0630', '#2a1a6e', '#4a1e8c']);
    case 'skin_planet': return lin(['#ffb15e', '#e0762b', '#7a2f10']);
    case 'skin_holo': { const g = c.createLinearGradient(-r, -r, r, r); const h = t * 60;
      [0, .33, .66, 1].forEach((s, i) => g.addColorStop(s, `hsl(${(h + i * 70) % 360},90%,72%)`)); return g; }
    default: return baseColor(skin, t);
  }
}
function skinDeco(c, skin, r, t) {
  c.save();
  const sq = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const u = r / 15;
  if (skin === 'skin_chrome' || skin === 'skin_gold' || skin === 'skin_liquidgold') {
    const off = ((t * 30) % (r * 5)) - r * 2.5;
    c.fillStyle = 'rgba(255,255,255,.55)'; c.save(); c.rotate(-0.6); c.fillRect(off, -r * 2, r * .45, r * 4); c.restore();
  } else if (skin === 'skin_lava') {
    for (let i = 0; i < 4; i++) { const x = Math.sin(t * 1.5 + i * 2) * r * .6, y = Math.cos(t * 1.1 + i * 3) * r * .6;
      c.fillStyle = i % 2 ? '#ffee55' : '#ff7700'; c.beginPath(); c.arc(x, y, u * 3.5, 0, 7); c.fill(); }
  } else if (skin === 'skin_camo') {
    [[-8, -8, 9, 6, '#2c4318'], [3, -2, 10, 7, '#8a7a4a'], [-10, 4, 8, 6, '#8a7a4a'], [2, 8, 9, 5, '#2c4318'], [-3, -14, 6, 5, '#2c4318']]
      .forEach(([x, y, w, h, col]) => sq(x * u, y * u, w * u, h * u, col));
  } else if (skin === 'skin_ice') {
    [[-9, -9], [5, -5], [-4, 4], [8, 8], [-11, 9]].forEach(([x, y], i) => sq(x * u, y * u, 3 * u, 3 * u, i % 2 ? '#fff' : '#d9f6ff'));
  } else if (skin === 'skin_space') {
    for (let i = 0; i < 7; i++) { const x = ((i * 53) % 28 - 14) * u, y = ((i * 31) % 26 - 13) * u;
      sq(x, y, 2 * u, 2 * u, (Math.sin(t * 4 + i) > 0) ? '#fff' : '#8a7aff'); }
  } else if (skin === 'skin_planet') {
    sq(-r, -3 * u, 2 * r, 4 * u, 'rgba(120,40,10,.45)'); sq(-r, 6 * u, 2 * r, 2.5 * u, 'rgba(255,230,160,.4)');
  } else if (skin === 'skin_atmo') {
    sq(-r, -r, 2 * r, 3 * u, 'rgba(255,255,255,.35)');
  } else if (skin === 'skin_cloud') {
    sq(-r, 6 * u, 2 * r, 9 * u, 'rgba(160,190,230,.45)');
  }
  c.restore();
}
function skinEdge(skin, t) {
  if (skin === 'skin_neon') return '#ff00ff';
  if (skin === 'skin_space') return '#8a7aff';
  if (skin === 'skin_cloud') return '#9db8e0';
  if (skin === 'skin_chrome') return '#4d5561';
  return shade(baseColor(skin, t).startsWith('#') ? baseColor(skin, t) : '#888888', -.5);
}
/* opts : cx, cy, r (demi-taille), sx, sy, blink, look(-1..1) */
function drawPlayer(c, cfg, t, o) {
  const r = o.r || 15, u = r / 15;
  c.save();
  c.translate(o.cx, o.cy);
  c.scale(o.sx || 1, o.sy || 1);
  const shape = cfg.shape, skin = cfg.skin;
  if (skin === 'skin_neon') { c.shadowColor = '#ff00ff'; c.shadowBlur = 12 * u; }
  shapePath(c, shape, r);
  c.fillStyle = skinFill(c, skin, r, t); c.fill();
  c.shadowBlur = 0;
  c.save(); shapePath(c, shape, r); c.clip(); skinDeco(c, skin, r, t); c.restore();
  shapePath(c, shape, r);
  c.lineWidth = Math.max(1, 2 * u);
  c.strokeStyle = skinEdge(skin, t); c.stroke();
  // yeux
  const tri = shape === 'shape_triangle';
  const ey = tri ? 6 * u : -3 * u, ex = (tri ? 5 : 6) * u;
  const dark = skin === 'skin_space' || skin === 'skin_neon' || skin === 'skin_atmo';
  if (!o.blink) {
    [-ex, ex].forEach(x => {
      c.fillStyle = '#fff'; c.fillRect(x - 2.5 * u, ey - 3 * u, 5 * u, 6 * u);
      c.fillStyle = dark ? '#00ffcc' : '#000'; c.fillRect(x - 1.2 * u + (o.look || 0) * 1.3 * u, ey - 1 * u, 2.6 * u, 3 * u);
    });
  } else {
    c.fillStyle = dark ? '#fff' : '#000';
    [-ex, ex].forEach(x => c.fillRect(x - 2.5 * u, ey, 5 * u, 1.5 * u));
  }
  // accessoires
  const topY = (shape === 'shape_triangle' || shape === 'shape_diamond') ? -r * 0.35 : -r;
  if (cfg.acc === 'acc_cap') {
    c.fillStyle = '#d62828'; c.fillRect(-r * .75, topY - 7 * u, r * 1.5, 9 * u);
    c.fillStyle = '#9d0208'; c.fillRect(-r * .1, topY + 0.5 * u, r * 1.3, 3.5 * u);
    c.fillStyle = '#fff'; c.fillRect(-1.5 * u, topY - 5 * u, 3 * u, 3 * u);
  } else if (cfg.acc === 'acc_glasses') {
    c.fillStyle = '#0b0b14'; c.fillRect(-ex - 4.5 * u, ey - 4 * u, 9 * u, 8 * u); c.fillRect(ex - 4.5 * u, ey - 4 * u, 9 * u, 8 * u);
    c.fillRect(-ex, ey - 1.5 * u, 2 * ex, 2.5 * u);
    c.fillStyle = '#00ffcc'; c.fillRect(-ex - 3 * u, ey - 3 * u, 3 * u, 2 * u); c.fillRect(ex - 3 * u, ey - 3 * u, 3 * u, 2 * u);
  } else if (cfg.acc === 'acc_crown') {
    c.fillStyle = '#ffd400'; c.beginPath();
    const b = topY + 2 * u, tp = topY - 9 * u;
    c.moveTo(-9 * u, b); c.lineTo(-9 * u, tp); c.lineTo(-4.5 * u, b - 4 * u); c.lineTo(0, tp - 2 * u);
    c.lineTo(4.5 * u, b - 4 * u); c.lineTo(9 * u, tp); c.lineTo(9 * u, b); c.closePath(); c.fill();
    c.fillStyle = '#b8860b'; c.fillRect(-9 * u, b - 2 * u, 18 * u, 2.5 * u);
    c.fillStyle = '#ff0055'; c.fillRect(-1.2 * u, b - 6 * u, 2.4 * u, 2.4 * u);
  }
  c.restore();
}

/* petites icônes pour boutiques / casier */
function swatch(item, size = 48, animate = false) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const draw = t => {
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, size, size);
    const cfg = { skin: save.eq.skin, acc: 'acc_none', shape: save.eq.shape };
    const r = size * 0.28, cx = size / 2, cy = size / 2 + (item.cat === 'acc' ? size * .06 : 0);
    if (item.cat === 'skin') { cfg.skin = item.id; drawPlayer(c, cfg, t, { cx, cy, r }); }
    else if (item.cat === 'acc') { cfg.acc = item.id; drawPlayer(c, cfg, t, { cx, cy, r }); }
    else if (item.cat === 'shape') { cfg.shape = item.id; drawPlayer(c, cfg, t, { cx, cy, r }); }
    else if (item.cat === 'trail') {
      for (let i = 4; i >= 1; i--) {
        const col = item.id === 'trail_rainbow' ? `hsl(${(i * 60 + t * 80) % 360},100%,55%)` : baseColor(save.eq.skin, t);
        c.globalAlpha = .12 + (4 - i) * .06; c.fillStyle = col;
        if (item.id === 'trail_sparkle') { c.fillStyle = i % 2 ? '#fff' : '#ffee55'; c.globalAlpha = .9; c.fillRect(cx - r + i * 3, cy + r + i * 2 + 1, 3, 3); c.fillRect(cx + r - i * 4, cy + r + i * 3, 2, 2); }
        else c.fillRect(cx - r * .8, cy - r * .8 + i * 5, r * 1.6, r * 1.6);
      }
      c.globalAlpha = 1; drawPlayer(c, cfg, t, { cx, cy: cy - size * .12, r: r * .8 });
    } else if (item.cat === 'theme') {
      const pal = PAL[item.id === 'theme_pastel' ? 'pastel' : item.id === 'theme_mono' ? 'mono' : 'default'];
      [['normal', 6], ['super', 18], ['fragile', 30], ['moving', 42]].forEach(([k, y], i) => {
        c.fillStyle = pal[k]; c.fillRect(size * .12 + (i % 2) * size * .12, y * size / 48, size * .52, size * .1);
      });
    } else if (item.cat === 'life') {
      c.drawImage(pixCanvas('heart'), size * .1, size * .15, size * .8, size * .7);
    }
  };
  draw(0.6);
  if (animate) anims.push({ cv, draw });
  return cv;
}
const anims = [];

/* ------------------------------------------------------------------ */
/*  DESSIN : plateformes                                              */
/* ------------------------------------------------------------------ */
const PAL = {
  default: { normal: '#00ffcc', super: '#ffee00', fragile: '#ff8c1a', moving: '#b44dff', ice: '#8fe3ff', conv: '#b0b0b8' },
  pastel:  { normal: '#8ff0d6', super: '#fff3a0', fragile: '#ffc59a', moving: '#d3b0ff', ice: '#cdf3ff', conv: '#d6d6dc' },
  mono:    { normal: '#ffffff', super: '#e0e0e0', fragile: '#9a9a9a', moving: '#c8c8c8', ice: '#f0f0f0', conv: '#777777' },
};
const themeKey = () => save.eq.theme === 'theme_pastel' ? 'pastel' : save.eq.theme === 'theme_mono' ? 'mono' : 'default';
function pr(c, x, y, w, h, n) { // rectangle à coins pixel
  c.beginPath();
  c.moveTo(x + n, y); c.lineTo(x + w - n, y); c.lineTo(x + w - n, y + n); c.lineTo(x + w, y + n); c.lineTo(x + w, y + h - n);
  c.lineTo(x + w - n, y + h - n); c.lineTo(x + w - n, y + h); c.lineTo(x + n, y + h); c.lineTo(x + n, y + h - n);
  c.lineTo(x, y + h - n); c.lineTo(x, y + n); c.lineTo(x + n, y + n); c.closePath();
}
function drawPlat(c, p, sy, t) {
  const pal = PAL[themeKey()];
  const col = pal[p.type];
  let h = 15, y = sy;
  if (p.type === 'super' && p.sq > 0) h = 15 - 8 * Math.sin(p.sq / 12 * Math.PI);
  if (p.broken) { y += p.fy; c.globalAlpha = clamp(1 - p.fy / 260, 0, 1); }
  const x = p.x - p.w / 2;
  c.fillStyle = shade(col, -.5); pr(c, x, y, p.w, h, 3); c.fill();
  c.fillStyle = col; pr(c, x, y, p.w, h - 3, 3); c.fill();
  c.fillStyle = shade(col, .5); c.fillRect(x + 4, y + 1, p.w - 8, 3);
  c.fillStyle = shade(col, -.55);
  if (p.type === 'super') {
    for (let i = 0; i < 3; i++) { const cx = x + 17 + i * 18, cy = y + 6; c.fillRect(cx - 3, cy, 6, 2); c.fillRect(cx - 1, cy - 2, 2, 2); }
    if (p.sq <= 0) { c.fillRect(x + 8, y + h, 4, 2); c.fillRect(x + p.w - 12, y + h, 4, 2); }
  } else if (p.type === 'fragile') {
    c.fillRect(x + 20, y + 3, 2, 8); c.fillRect(x + 22, y + 7, 3, 2); c.fillRect(x + 46, y + 4, 2, 7); c.fillRect(x + 43, y + 8, 3, 2);
  } else if (p.type === 'moving') {
    c.fillRect(x + 6, y + 6, 4, 2); c.fillRect(x + 8, y + 4, 2, 6);
    c.fillRect(x + p.w - 10, y + 6, 4, 2); c.fillRect(x + p.w - 10, y + 4, 2, 6);
  } else if (p.type === 'ice') {
    c.fillStyle = '#fff'; c.fillRect(x + 10, y + 5, 3, 3); c.fillRect(x + 30, y + 7, 2, 2); c.fillRect(x + 52, y + 5, 3, 3);
  } else if (p.type === 'conv') {
    c.save(); pr(c, x, y, p.w, h - 3, 3); c.clip();
    const off = (t * 24 * p.dir) % 12;
    c.fillStyle = shade(col, -.45);
    for (let i = -1; i < p.w / 12 + 1; i++) {
      const cx = x + i * 12 + off; const d = p.dir;
      c.fillRect(cx, y + 4, 2, 6); c.fillRect(cx + d * 2, y + 6, 2, 2); c.fillRect(cx + d * 2 - (d > 0 ? 0 : 0), y + 4, 2, 2);
    }
    c.restore();
  }
  c.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/*  DESSIN : arrière-plans                                            */
/* ------------------------------------------------------------------ */
function zoneAt(h) {
  if (h < 2000) return 0;
  if (h < 10000) return 1;
  if (h < 20000) return 2;
  if (h < 40000) return 3;
  return (Math.floor((h - 40000) / 20000) % 2 === 0) ? 4 : 3;
}
const ZONE_RANK = h => h >= 40000 ? 4 : h >= 20000 ? 3 : h >= 10000 ? 2 : h >= 2000 ? 1 : 0;
// générateurs déterministes
let seed = 7; const srnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const BUILDINGS = [], WINDOWS = [], CLOUDS = [], STARS = [];
(function initBg() {
  seed = 7;
  for (let layer = 0; layer < 2; layer++) {
    let x = -10;
    while (x < W + 10) {
      const w = 40 + srnd() * 50, h = 90 + srnd() * (layer ? 120 : 190);
      BUILDINGS.push({ x, w, h, layer });
      if (layer === 1) {
        for (let wy = 14; wy < h - 10; wy += 16) for (let wx = 8; wx < w - 10; wx += 14)
          if (srnd() < .55) WINDOWS.push({ b: BUILDINGS.length - 1, x: wx, y: wy, id: WINDOWS.length });
      }
      x += w + (layer ? 4 : 0);
    }
  }
  for (let i = 0; i < 9; i++) CLOUDS.push({ x: srnd() * (W + 200), y: srnd() * H, s: .8 + srnd() * 1.4, v: 3 + srnd() * 5 });
  for (let i = 0; i < 90; i++) STARS.push({ x: srnd() * W, y: srnd() * H, s: srnd() < .2 ? 3 : 2, tw: srnd() * 6, d: .3 + srnd() * .7 });
})();
function skyGrad(c, a, b, d) { const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); if (d) g.addColorStop(.5, d); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, W, H); }
function drawZone(c, z, t, camY, alpha) {
  c.save(); c.globalAlpha = alpha;
  const sink = (camY * 0.05) % 2000;
  if (z === 0) {
    skyGrad(c, '#0e0c40', '#4d2a7a', '#2a1a6a');
    for (const b of BUILDINGS) {
      const sy = H - b.h + sink * (b.layer ? 1 : .6) + (b.layer ? 0 : 30);
      c.fillStyle = b.layer ? '#150f40' : '#211a5c'; c.fillRect(b.x, sy, b.w, H - sy + 400);
    }
    const bl = BUILDINGS.filter(b => b.layer === 1);
    for (const w of WINDOWS) {
      const b = BUILDINGS[w.b]; const sy = H - b.h + sink;
      const off = ((w.id * 9301 + Math.floor(t * 1.5) * 49297) % 233280) / 233280 < 0.1;
      c.fillStyle = off ? '#2a2060' : (w.id % 3 === 0 ? '#ffd86b' : '#ffeaa0');
      c.fillRect(b.x + w.x, sy + w.y, 6, 8);
    }
  } else if (z === 1) {
    skyGrad(c, '#2a4aa0', '#8cbdf2');
    c.fillStyle = 'rgba(255,255,255,.7)';
    for (const k of CLOUDS) {
      const x = ((k.x + t * k.v) % (W + 240)) - 120, y = ((k.y + sink * (k.s)) % (H + 80)) - 40;
      cloudShape(c, x, y, k.s);
    }
  } else if (z === 2) {
    skyGrad(c, '#0b0b3a', '#3b7ad0', '#1a2a7a');
    c.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 8; i++) c.fillRect(0, ((i * 97 + sink * 2) % H), W, 3);
    stars(c, t, sink, .5);
  } else if (z === 3) {
    skyGrad(c, '#03030f', '#160a3a');
    c.fillStyle = 'rgba(120,60,200,.12)'; c.beginPath(); c.arc(120, ((200 + sink) % H), 120, 0, 7); c.fill();
    c.fillStyle = 'rgba(0,200,255,.07)'; c.beginPath(); c.arc(380, ((460 + sink * 1.4) % H), 150, 0, 7); c.fill();
    stars(c, t, sink, 1);
  } else {
    skyGrad(c, '#04030f', '#1b0d3a');
    stars(c, t, sink, .8);
    const py = 560 + Math.min(sink * 0.8, 300), px = 330;
    c.fillStyle = '#e0762b'; c.beginPath(); c.arc(px, py, 150, 0, 7); c.fill();
    c.fillStyle = 'rgba(120,40,10,.45)'; c.fillRect(px - 150, py - 40, 300, 26); c.fillRect(px - 130, py + 30, 260, 18);
    c.fillStyle = 'rgba(255,230,160,.25)'; c.fillRect(px - 148, py - 80, 296, 12);
    c.strokeStyle = 'rgba(255,220,160,.5)'; c.lineWidth = 6; c.beginPath(); c.ellipse(px, py, 230, 40, -0.35, 0, 7); c.stroke();
    c.fillStyle = 'rgba(0,0,20,.35)'; c.beginPath(); c.arc(px + 40, py + 30, 150, 0, 7); c.arc(px, py, 150, 0, 7, true); c.fill('evenodd');
  }
  c.restore();
}
function cloudShape(c, x, y, s) {
  const u = 8 * s;
  c.fillRect(x, y + u, u * 7, u * 2); c.fillRect(x + u, y, u * 3, u * 2); c.fillRect(x + u * 3.5, y - u, u * 3, u * 3); c.fillRect(x + u * 5.5, y + u * .2, u * 2, u * 2);
}
function stars(c, t, sink, k) {
  for (const s of STARS) {
    const y = (s.y + sink * s.d * 2) % H; const a = .4 + .6 * Math.abs(Math.sin(t * 1.5 + s.tw));
    c.fillStyle = `rgba(255,255,255,${a * k})`; c.fillRect(s.x, y, s.s, s.s);
  }
}
/* fond des menus : étoiles qui tombent */
const MENUSTARS = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() < .25 ? 4 : 2, v: .3 + Math.random() * 1.2, tw: Math.random() * 6,
  col: ['#ffffff', '#00ffcc', '#ffff00', '#ff77aa'][Math.floor(Math.random() * 4)] }));
function drawMenuBg(c, t) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0a30'); g.addColorStop(.6, '#241a73'); g.addColorStop(1, '#3d1973');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (const s of MENUSTARS) {
    s.y += s.v; s.x -= s.v * .25; if (s.y > H + 8) { s.y = -8; s.x = Math.random() * W; } if (s.x < -8) s.x = W + 4;
    const a = .35 + .65 * Math.abs(Math.sin(t * 2 + s.tw));
    c.globalAlpha = a; c.fillStyle = s.col;
    c.fillRect(s.x | 0, s.y | 0, s.s, s.s);
    if (s.s === 4) { c.fillRect((s.x | 0) - 2, (s.y | 0) + 1, 8, 2); c.fillRect((s.x | 0) + 1, (s.y | 0) - 2, 2, 8); }
  }
  c.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/*  JEU                                                               */
/* ------------------------------------------------------------------ */
const canvas = $('#game'); const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
let G = null;          // partie en cours
let running = false;   // une partie est chargée
let paused = false;
let lastMode = 'normal';

function newRun(mode) {
  const g = {
    mode, frames: 0, t: 0, waiting: true, dead: false, over: false, usedRevive: false,
    plats: [], coinsArr: [], parts: [], trail: [],
    px: W / 2, py: 0, vx: 0, vy: 0, camY: 0, bgY: 0, startPy: 0, height: 0, hScore: 0, score: 0, coins: 0,
    combo: 0, lastLand: -999, timeLeft: MODES[mode].timed, wind: 0, windEndH: 0, windBucket: -1,
    iceT: 0, convT: 0, convDir: 0, sq: 0, genY: 150, zone: 0, prevZone: 0, zoneFade: 0, rank: 0,
    prevHi: save.hi[mode] || 0, runStats: { superBounces: 0, ice: 0, conveyor: 0, fragile: 0, wind: 0, jumps: 0, continues: 0 },
    shake: 0,
  };
  g.plats.push({ x: W / 2, y: 150, w: 70, h: 15, type: 'normal', ox: W / 2, ph: 0, sq: 0 });
  g.py = 150 + 15; g.startPy = g.py;
  generate(g);
  return g;
}
function pickType(g) {
  const m = g.mode, d = Math.min(g.score / 150, 1);
  if (m === 'hcFragile') return 'fragile';
  if (m === 'hcMoving') return 'moving';
  if (m === 'hcMixed') return Math.random() < .5 ? 'fragile' : 'moving';
  const w = { normal: Math.max(.34 - .2 * d, .08), super: .15, fragile: .13 + .13 * d, moving: .13 + .13 * d, ice: .08, conv: .08 };
  let sum = 0; for (const k in w) sum += w[k];
  let r = Math.random() * sum;
  for (const k in w) { if ((r -= w[k]) <= 0) return k; }
  return 'normal';
}
function generate(g) {
  while (g.genY < g.camY + H + 320) {
    g.genY += 110;
    const type = pickType(g);
    const x = rnd(50, W - 50);
    const p = { x, y: g.genY, w: 70, h: 15, type, ox: clamp(x, 100, W - 100), ph: rnd(0, 6.28), sq: 0, dir: Math.random() < .5 ? -1 : 1 };
    if (type === 'moving') p.x = p.ox;
    g.plats.push(p);
    const chance = g.mode === 'rush' ? .7 : .12;
    if (Math.random() < chance && type !== 'super') g.coinsArr.push({ p, x: p.x, y: g.genY + 32, v: Math.floor(rnd(3, 9)), ph: rnd(0, 6) });
  }
}
function spawn(g, x, y, n, col, o = {}) {
  for (let i = 0; i < n; i++) g.parts.push({ x, y, vx: rnd(-1, 1) * (o.sp || 2), vy: rnd(-.5, 1.5) * (o.sp || 2) + (o.up || 0), life: rnd(.6, 1) * (o.life || 30), max: o.life || 30, col: Array.isArray(col) ? col[i % col.length] : col, s: o.s || 3, g: o.g === undefined ? .08 : o.g });
}
function beginRun() {
  if (!G.waiting) return;
  G.waiting = false; G.vy = 12; G.runStats.jumps++; SND.jump();
  $('#hudStart').classList.add('hidden');
}
const speedPx = () => 3 + save.settings.sens * 0.55;

function step() {
  const g = G; g.frames++; g.t += 1 / 60;
  stepParts(g);
  if (g.sq > 0) g.sq = Math.max(0, g.sq - .08);
  for (const p of g.plats) {
    if (p.sq > 0) p.sq--;
    if (p.broken) { p.fy += 4 + p.fy * .06; }
  }
  if (g.waiting) { g.bgY += (g.camY - g.bgY) * .05; return; }
  const ms = MODES[g.mode];
  if (ms.timed) { g.timeLeft -= 1 / 60; if (g.timeLeft <= 0) { g.timeLeft = 0; endRun(true); return; } }
  save.stats.playTime += 1 / 60;

  // entrées
  const dir = (anyHeld('right') ? 1 : 0) - (anyHeld('left') ? 1 : 0);
  const target = dir * speedPx();
  if (g.iceT > 0) { g.vx += (target - g.vx) * .045; g.iceT--; } else g.vx = target;
  let push = 0;
  if (g.convT > 0) { push = g.convDir * 1.2; g.convT--; }
  // vent
  const bucket = Math.floor(g.height / 500);
  if (bucket !== g.windBucket) {
    g.windBucket = bucket;
    if (g.wind === 0 && bucket > 0 && Math.random() < .01) { g.wind = Math.random() < .5 ? -1.4 : 1.4; g.windEndH = g.height + rnd(120, 220); SND.wind(); }
  }
  if (g.wind !== 0 && g.height > g.windEndH) { g.wind = 0; g.runStats.wind++; }
  g.px += g.vx + push + g.wind;
  if (g.px < 0) g.px += W; if (g.px > W) g.px -= W;
  const prevBottom = g.py - 15;
  g.vy -= .5; g.py += g.vy;

  // plateformes mobiles
  for (const p of g.plats) if (p.type === 'moving') p.x = p.ox + Math.sin(g.frames * .025 + p.ph) * 80;
  for (const c of g.coinsArr) { if (c.p.type === 'moving') c.x = c.p.x; }

  // atterrissage
  if (g.vy < 0) {
    const bottom = g.py - 15;
    for (const p of g.plats) {
      if (p.broken) continue;
      if (prevBottom >= p.y - 1 && bottom <= p.y && Math.abs(g.px - p.x) < p.w / 2 + 12) { land(g, p); break; }
    }
  }
  // pièces
  for (let i = g.coinsArr.length - 1; i >= 0; i--) {
    const c = g.coinsArr[i];
    if (Math.abs(g.px - c.x) < 24 && Math.abs(g.py - c.y) < 26) {
      g.coinsArr.splice(i, 1); g.coins += c.v; save.coins += c.v; save.stats.coinsEarned += c.v;
      if (g.mode === 'rush') g.score += c.v;
      SND.coin(); spawn(g, c.x, c.y, 8, ['#ffd400', '#fff3a0'], { sp: 2.4, life: 24, s: 3, g: .04 });
    }
  }
  // hauteur / score
  const h = g.py - g.startPy;
  if (h > g.height) {
    const dh = h - g.height; g.height = h;
    if (g.mode !== 'rush') { const mult = g.combo >= 10 ? 3 : g.combo >= 5 ? 2 : 1; g.hScore += dh * .1 * mult; g.score = Math.floor(g.hScore); }
  }
  // caméra
  const speed = Math.min(1.2 + g.score * .0035, 2.3);
  g.camY += speed;
  if (g.py > g.camY + H * .55) g.camY = g.py - H * .55;
  g.bgY += (g.camY - g.bgY) * .05;
  // zones
  const z = zoneAt(g.height);
  if (z !== g.zone) { g.prevZone = g.zone; g.zone = z; g.zoneFade = 1; }
  if (g.zoneFade > 0) g.zoneFade = Math.max(0, g.zoneFade - 1 / 90);
  g.rank = ZONE_RANK(g.height);
  if (g.rank > save.stats.zoneReached) save.stats.zoneReached = g.rank;
  // trainée
  g.trail.push({ x: g.px, y: g.py }); if (g.trail.length > 8) g.trail.shift();
  if (save.eq.trail === 'trail_sparkle' && g.frames % 2 === 0) spawn(g, g.px + rnd(-10, 10), g.py - 10, 1, ['#fff', '#ffee55', '#00ffcc'], { sp: .8, life: 26, s: 3, g: .02 });
  // génération & nettoyage
  generate(g);
  g.plats = g.plats.filter(p => p.y > g.camY - 120 && !(p.broken && p.fy > 300));
  g.coinsArr = g.coinsArr.filter(c => c.y > g.camY - 60);
  if (g.frames % 18 === 0) for (const p of g.plats) if (p.type === 'ice' && p.y > g.camY && p.y < g.camY + H) spawn(g, p.x + rnd(-30, 30), p.y + 6, 1, '#fff', { sp: .5, up: -.3, life: 40, s: 2, g: -.01 });
  // mort
  if (g.py < g.camY - 30) die();
}
function land(g, p) {
  g.py = p.y + 15; g.vy = 12; g.sq = 1; g.runStats.jumps++;
  if (g.frames - g.lastLand <= 95) g.combo++; else g.combo = 1;
  g.lastLand = g.frames;
  let snd = SND.jump;
  switch (p.type) {
    case 'super': g.vy = 22 + Math.min(g.height / 3000, 1) * 10; p.sq = 12; g.runStats.superBounces++; snd = SND.superJump;
      spawn(g, p.x, p.y, 12, ['#ffee00', '#fff'], { sp: 3, up: 1, life: 26 }); break;
    case 'fragile': p.broken = true; p.fy = 0; g.runStats.fragile++; snd = SND.brk;
      spawn(g, p.x, p.y, 10, '#ff8c1a', { sp: 3, life: 30 }); break;
    case 'ice': g.iceT = 60; g.runStats.ice++; snd = SND.ice; break;
    case 'conv': g.convT = 30; g.convDir = p.dir; g.runStats.conveyor++; break;
  }
  snd();
}
function stepParts(g) {
  for (let i = g.parts.length - 1; i >= 0; i--) {
    const p = g.parts[i]; p.x += p.vx; p.y += p.vy; p.vy -= p.g; p.life--;
    if (p.life <= 0) g.parts.splice(i, 1);
  }
}

/* ---- Fin de partie ---- */
function die() {
  const g = G;
  g.dead = true; SND.over();
  if (!g.usedRevive && save.lives > 0 && !MODES[g.mode].timed) { openCont(); return; }
  endRun(false);
}
function useLife() {
  const g = G; save.lives--; g.usedRevive = true; g.runStats.continues++; save.stats.continues++; persist();
  const y = g.camY + H * .35;
  g.plats = g.plats.filter(p => Math.abs(p.y - y) > 70);
  g.plats.push({ x: W / 2, y, w: 70, h: 15, type: 'normal', ox: W / 2, ph: 0, sq: 0 });
  g.px = W / 2; g.py = y + 15; g.vx = 0; g.vy = 0; g.dead = false; g.waiting = true; g.combo = 0; g.trail = []; g.wind = 0; g.iceT = 0; g.convT = 0;
  g.hScore = g.score; g.height = Math.max(g.height, g.py - g.startPy);
  $('#hudStart').classList.remove('hidden');
}
function endRun(timeUp) {
  const g = G; if (g.over) return; g.over = true;
  if (!timeUp) { /* son déjà joué */ } else SND.over();
  const mode = g.mode, rs = g.runStats, S = save.stats;
  S.games++; S.jumps += rs.jumps; S.totalHeight += Math.floor(g.height);
  S.superBounces += rs.superBounces; S.fragileBroken += rs.fragile; S.windSurvived += rs.wind; S.ice += rs.ice; S.conveyor += rs.conveyor;
  if (mode !== 'rush') { S.totalScore += g.score; S.bestScore = Math.max(S.bestScore, g.score); }
  S.bestHeight = Math.max(S.bestHeight, Math.floor(g.height));
  // records
  const prev = save.hi[mode] || 0;
  const isHi = g.score > prev;
  if (isHi) save.hi[mode] = g.score;
  const top = (save.top[mode] || []).slice();
  let inTop = false, rank = -1;
  if (g.score > 0) {
    top.push(g.score); top.sort((a, b) => b - a);
    rank = top.indexOf(g.score);
    if (rank >= 0 && rank < 5) inTop = true;
    top.length = Math.min(top.length, 5);
  }
  save.top[mode] = top;
  let bonus = 0, bonusTxt = [];
  if (g.score >= 10) {
    if (isHi) { bonus += 100; bonusTxt.push('NOUVEAU RECORD  +100'); }
    else if (inTop) { bonus += 40; bonusTxt.push('ENTRÉE DANS LE TOP 5  +40'); }
  }
  save.coins += bonus; S.coinsEarned += bonus;
  const fresh = checkAch();
  persist();
  g.result = { isHi, inTop, rank, bonus, bonusTxt, fresh, top, timeUp };
  running = true; paused = true;
  openOver();
}

/* ------------------------------------------------------------------ */
/*  RENDU                                                             */
/* ------------------------------------------------------------------ */
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!G) { drawMenuBg(ctx, t); return; }
  const g = G;
  if (g.zoneFade > 0) { drawZone(ctx, g.prevZone, t, g.bgY, 1); drawZone(ctx, g.zone, t, g.bgY, 1 - g.zoneFade); }
  else drawZone(ctx, g.zone, t, g.bgY, 1);
  if (g.shake > 0) g.shake--;
  const sY = y => H - (y - g.camY);
  // plateformes
  for (const p of g.plats) {
    const sy = sY(p.y); if (sy < -30 || sy > H + 30) continue;
    drawPlat(ctx, p, sy, t);
  }
  // pièces
  for (const c of g.coinsArr) {
    const sy = sY(c.y) + Math.sin(t * 4 + c.ph) * 3; if (sy < -20 || sy > H + 20) continue;
    ctx.drawImage(coinImg, (c.x - 10) | 0, (sy - 10) | 0, 20, 20);
  }
  // traînée
  const eq = save.eq;
  if (!g.waiting || g.frames > 0) {
    g.trail.forEach((q, i) => {
      const a = (i + 1) / 10 * .45, r = 7 + i * .9;
      ctx.globalAlpha = a;
      ctx.fillStyle = eq.trail === 'trail_rainbow' ? `hsl(${(i * 40 + t * 120) % 360},100%,55%)` : (eq.trail === 'trail_sparkle' ? 'rgba(255,255,255,0)' : baseColor(eq.skin, t));
      ctx.fillRect((q.x - r) | 0, (sY(q.y) - r) | 0, r * 2, r * 2);
    });
    ctx.globalAlpha = 1;
  }
  // joueur
  const sq = g.sq, stretch = clamp(g.vy * .008, -.1, .25);
  const cfg = { skin: eq.skin, acc: eq.acc, shape: eq.shape };
  const blink = (g.frames % 190) < 8;
  const look = g.vx > .5 ? 1 : g.vx < -.5 ? -1 : 0;
  if (!(g.dead)) {
    const px = g.px, py = sY(g.py);
    drawPlayer(ctx, cfg, t, { cx: px, cy: py, r: 15, sx: 1 + .28 * sq - stretch * .5, sy: 1 - .28 * sq + stretch, blink, look });
    if (px < 20) drawPlayer(ctx, cfg, t, { cx: px + W, cy: py, r: 15, blink, look });
    if (px > W - 20) drawPlayer(ctx, cfg, t, { cx: px - W, cy: py, r: 15, blink, look });
  }
  // particules
  for (const p of g.parts) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.col;
    ctx.fillRect((p.x - p.s / 2) | 0, (sY(p.y) - p.s / 2) | 0, p.s, p.s);
  }
  ctx.globalAlpha = 1;
}

/* ---- HUD ---- */
const hudCache = {};
function setText(sel, v, html) {
  if (hudCache[sel] === v) return; hudCache[sel] = v;
  const e = $(sel); if (html) e.innerHTML = v; else e.textContent = v;
}
function updateHud() {
  if (!G || !running) return;
  const g = G, ms = MODES[g.mode];
  setText('#hudScore', fmt(g.score));
  setText('#hudCoins', `${pixSVG('coin')}<span>${fmt(g.coins)}</span>`, true);
  setText('#hudTimer', ms.timed ? Math.ceil(g.timeLeft) + 's' : '');
  const mult = g.combo >= 10 ? 3 : g.combo >= 5 ? 2 : 1;
  setText('#hudCombo', g.mode !== 'rush' && g.combo >= 5 ? `COMBO x${mult}` : '');
  setText('#hudRecord', g.prevHi ? 'RECORD ' + fmt(g.prevHi) : '');
  setText('#hudWind', g.wind ? (g.wind > 0 ? '→ VENT →' : '← VENT ←') : '');
  setText('#hudPause', `${mainLabel('pause')} : PAUSE`);
}

/* ------------------------------------------------------------------ */
/*  ÉCRANS & NAVIGATION                                               */
/* ------------------------------------------------------------------ */
const stack = ['hub'];
let page = 1;
const PAGES = ['SUCCÈS', 'ACCUEIL', 'CASIER', 'BOUTIQUE'];
let lockerCat = 'skin', shopFilter = 'all';
const BACK = {};

function layerEl(id) { return $('#' + id); }
function syncLayers() {
  $$('.screen').forEach(e => e.classList.toggle('on', stack.includes(e.id)));
  $('#hud').classList.toggle('hidden', !(running && G));
  if (!stack.length) { /* en jeu */ }
}
function show(id) { stack.push(id); syncLayers(); focusDefault(); }
function hide() { stack.pop(); syncLayers(); focusDefault(); }
function go(id) { stack.length = 0; stack.push(id); syncLayers(); focusDefault(); }
function focusables() {
  const top = stack[stack.length - 1]; if (!top) return [];
  return $$('button:not(:disabled),[data-f]', layerEl(top)).filter(e => e.getClientRects().length);
}
function focusDefault() {
  setTimeout(() => {
    const top = stack[stack.length - 1]; if (!top) return;
    const el = $('[data-default]:not(:disabled)', layerEl(top)) || focusables()[0];
    if (el) el.focus({ preventScroll: true });
  }, 0);
}
function moveFocus(dx, dy) {
  const list = focusables(); const cur = document.activeElement;
  if (!list.includes(cur)) { if (list[0]) list[0].focus(); return; }
  const cr = cur.getBoundingClientRect(), cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
  let best = null, bs = 1e9;
  for (const e of list) {
    if (e === cur) continue; const r = e.getBoundingClientRect();
    const ex = r.left + r.width / 2 - cx, ey = r.top + r.height / 2 - cy;
    const along = ex * dx + ey * dy; if (along <= 2) continue;
    const perp = Math.abs(ex * dy) + Math.abs(ey * dx);
    const sc = along + perp * 2.2; if (sc < bs) { bs = sc; best = e; }
  }
  if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest' }); SND.click(); }
  else if (dy) { const sc = cur.closest('.scroll'); if (sc) sc.scrollBy(0, dy * 90); }
}

/* ---------- Hub ---------- */
function coinsHTML() { return `<span>${pixSVG('coin')}${fmt(save.coins)}</span><span>${pixSVG('heart')}${save.lives}</span>`; }
function renderHub() {
  $('#hubCoins').innerHTML = coinsHTML();
  $('#btnSettings').innerHTML = pixSVG('gear');
  $('#pageTitle').textContent = '◂ ' + PAGES[page] + ' ▸';
  $('#dots').innerHTML = PAGES.map((_, i) => `<i class="${i === page ? 'on' : ''}" data-p="${i}"></i>`).join('');
  $$('#dots i').forEach(d => d.onclick = () => setPage(+d.dataset.p));
  $('#hubHint').innerHTML = `${labels('prev').join('/')} · ${labels('next').join('/')} : CHANGER DE PAGE<br>FLÈCHES : NAVIGUER · ENTRÉE : VALIDER`;
  anims.length = 0;
  const body = $('#pageBody'); body.innerHTML = '';
  [renderAch, renderHome, renderLocker, renderShop][page](body);
}
function setPage(p) {
  page = (p + PAGES.length) % PAGES.length; SND.click(); renderHub(); $('#pageBody').scrollTop = 0; focusDefault();
}
function refreshAll() { if (stack.includes('hub')) renderHub(); if (stack.includes('settings')) renderSettings(); }

function renderAch(body) {
  const done = save.ach.length, tot = ACH.length;
  const S = save.stats;
  body.innerHTML = `
    <div class="pct" data-f tabindex="-1">${Math.round(done / tot * 100)}% COMPLÉTÉ<div class="bar"><i style="width:${done / tot * 100}%"></i></div><div class="sub">${done} / ${tot} succès</div></div>
    <div class="card" data-f tabindex="-1"><div class="statgrid">
      <span>Parties</span><b>${fmt(S.games)}</b><span>Sauts</span><b>${fmt(S.jumps)}</b>
      <span>Score total</span><b>${fmt(S.totalScore)}</b><span>Hauteur totale</span><b>${fmt(S.totalHeight)}</b>
      <span>Record hauteur</span><b>${fmt(S.bestHeight)}</b><span>Pièces gagnées</span><b>${fmt(S.coinsEarned)}</b>
      <span>Temps de jeu</span><b>${Math.floor(S.playTime / 60)} min</b></div></div>` +
    ACH.map(a => {
      const v = Math.min(a.get(save.stats), a.goal), ok = save.ach.includes(a.id);
      return `<div class="row ${ok ? 'done' : ''}" data-f tabindex="-1"><div class="nm">${ok ? '★ ' : ''}${a.name}</div><small>${a.desc}</small>
        <div class="bar"><i style="width:${v / a.goal * 100}%"></i></div><small>${fmt(v)} / ${fmt(a.goal)}</small></div>`;
    }).join('');
}

function renderHome(body) {
  body.innerHTML = `<div class="home">
    <div class="logo">TOWER<br><em>CLIMBER</em></div>
    <canvas id="homeChar" width="96" height="96"></canvas>
    <button class="btn big" id="btnPlay" data-default>JOUER</button>
    <div class="record">RECORD  ${fmt(save.hi.normal || 0)}</div>
    <div class="sub">${labels('left').join('/')} · ${labels('right').join('/')} : BOUGER<br>${labels('pause').join('/')} : PAUSE</div>
  </div>`;
  $('#btnPlay').onclick = () => { SND.click(); openModes(); };
  const cv = $('#homeChar'), c = cv.getContext('2d');
  anims.push({ cv, draw: t => { c.clearRect(0, 0, 96, 96); drawPlayer(c, { skin: save.eq.skin, acc: save.eq.acc, shape: save.eq.shape }, t, { cx: 48, cy: 52, r: 30, blink: (t * 60 | 0) % 190 < 8 }); } });
}

function ownedItem(id) { return save.owned.includes(id); }
function renderLocker(body) {
  const cfgp = '<div class="preview"><canvas id="lkPrev" width="96" height="96"></canvas></div>';
  const tabs = `<div class="tabs">${CATS.map(([k, n]) => `<button class="tab ${k === lockerCat ? 'on' : ''}" data-cat="${k}">${n}</button>`).join('')}</div>`;
  const items = ITEMS.filter(i => i.cat === lockerCat);
  body.innerHTML = cfgp + tabs + `<div class="grid">${items.map(i => {
    const own = ownedItem(i.id), eq = save.eq[EQ_KEY[i.cat]] === i.id;
    return `<button class="item ${eq ? 'eq' : ''} ${own ? '' : 'lock'}" data-id="${i.id}"><span class="cv"></span><span>${i.name}</span><span class="pr">${eq ? 'ÉQUIPÉ' : own ? 'POSSÉDÉ' : (i.ach ? pixSVG('lock') + 'SUCCÈS' : pixSVG('lock') + fmt(i.price))}</span></button>`;
  }).join('')}</div>`;
  $$('.item', body).forEach(b => {
    const it = itemById(b.dataset.id); b.querySelector('.cv').replaceWith(swatch(it, 48, true));
    b.onclick = () => {
      if (!ownedItem(it.id)) { SND.click(); if (it.ach) openInfo(it); else openItem(it); return; }
      save.eq[EQ_KEY[it.cat]] = it.id; persist(); SND.ok(); const y = body.scrollTop; renderHub(); $('#pageBody').scrollTop = y; focusItem(it.id);
    };
  });
  $$('.tab', body).forEach(b => b.onclick = () => { lockerCat = b.dataset.cat; SND.click(); renderHub(); focusTab('[data-cat="' + lockerCat + '"]'); });
  const cv = $('#lkPrev'), c = cv.getContext('2d');
  anims.push({ cv, draw: t => { c.clearRect(0, 0, 96, 96); drawPlayer(c, { skin: save.eq.skin, acc: save.eq.acc, shape: save.eq.shape }, t, { cx: 48, cy: 52, r: 30, blink: (t * 60 | 0) % 190 < 8 }); } });
}
function focusItem(id) { setTimeout(() => { const e = $(`.item[data-id="${id}"]`); if (e) e.focus({ preventScroll: true }); }, 0); }
function focusTab(sel) { setTimeout(() => { const e = $(sel); if (e) e.focus({ preventScroll: true }); }, 0); }

const SHOP_F = [['all', 'TOUT'], ['skin', 'SKINS'], ['acc', 'ACCESSOIRES'], ['trail', 'TRAÎNÉES'], ['theme', 'THÈMES'], ['shape', 'FORMES'], ['life', 'VIES']];
function renderShop(body) {
  const tabs = `<div class="tabs">${SHOP_F.map(([k, n]) => `<button class="tab ${k === shopFilter ? 'on' : ''}" data-f2="${k}">${n}</button>`).join('')}</div>`;
  let list = ITEMS.filter(i => i.price > 0 || i.ach);
  if (shopFilter !== 'all') list = list.filter(i => i.cat === shopFilter);
  const life = { id: 'life', cat: 'life', name: 'Vie +1', price: LIFE_PRICE, desc: 'Une seconde chance par partie' };
  if (shopFilter === 'all' || shopFilter === 'life') list = shopFilter === 'life' ? [life] : [life, ...list];
  body.innerHTML = tabs + `<div class="grid">${list.map(i => {
    const own = i.cat !== 'life' && ownedItem(i.id), isNew = !own && !save.seen.includes(i.id) && !i.ach;
    return `<button class="item ${own ? 'eq' : ''}" data-id="${i.id}">${isNew ? '<b class="badge">NEW</b>' : ''}<span class="cv"></span><span>${i.name}</span>
      <span class="pr">${own ? 'POSSÉDÉ' : i.ach ? pixSVG('lock') + 'SUCCÈS' : pixSVG('coin') + fmt(i.price)}</span></button>`;
  }).join('')}</div>`;
  $$('.item', body).forEach(b => {
    const it = b.dataset.id === 'life' ? life : itemById(b.dataset.id);
    b.querySelector('.cv').replaceWith(swatch(it, 48, true));
    b.onclick = () => { SND.click(); if (it.ach) openInfo(it); else openItem(it); };
  });
  $$('.tab', body).forEach(b => b.onclick = () => { shopFilter = b.dataset.f2; SND.click(); renderHub(); focusTab('[data-f2="' + shopFilter + '"]'); });
}

/* ---------- Popups (boutique) ---------- */
function openInfo(it) {
  const el = $('#popup');
  el.innerHTML = `<div class="stack"><div class="panel"><div class="title" style="font-size:1em">${it.name}</div><div class="preview"></div>
    <div class="sub">${it.desc || ''}</div></div><button class="btn alt" id="pClose" data-default>RETOUR</button></div>`;
  $('.preview', el).appendChild(swatch(it, 96, true));
  $('#pClose').onclick = closePopup; BACK.popup = closePopup; show('popup');
}
function openItem(it) {
  if (!save.seen.includes(it.id)) { save.seen.push(it.id); persist(); }
  const el = $('#popup'); let confirming = false;
  const draw = () => {
    const own = it.cat !== 'life' && ownedItem(it.id), can = save.coins >= it.price;
    el.innerHTML = `<div class="stack"><div class="panel"><div class="title" style="font-size:1em">${it.name}</div><div class="preview"></div>
      <div class="sub">${it.desc || catDesc(it.cat)}</div>
      <div class="sub gold">${own ? 'DÉJÀ POSSÉDÉ' : confirming ? `DÉPENSER ${fmt(it.price)} PIÈCES ?` : `PRIX : ${fmt(it.price)}  (TU AS ${fmt(save.coins)})`}</div></div>
      ${own ? '' : confirming
        ? '<button class="btn" id="pYes" data-default>OUI, ACHETER</button><button class="btn alt" id="pNo">NON</button>'
        : `<button class="btn" id="pBuy" data-default ${can ? '' : 'disabled'}>${can ? 'ACHETER' : 'PAS ASSEZ DE PIÈCES'}</button><button class="btn alt" id="pClose">RETOUR</button>`}
      ${own ? '<button class="btn alt" id="pClose" data-default>RETOUR</button>' : ''}</div>`;
    $('.preview', el).appendChild(swatch(it, 96, true));
    const b = id => $(id, el);
    if (b('#pBuy')) b('#pBuy').onclick = () => { SND.click(); confirming = true; draw(); focusDefault(); };
    if (b('#pNo')) b('#pNo').onclick = () => { confirming = false; draw(); focusDefault(); };
    if (b('#pYes')) b('#pYes').onclick = () => {
      if (save.coins < it.price) return;
      save.coins -= it.price;
      if (it.cat === 'life') save.lives++; else { save.owned.push(it.id); save.eq[EQ_KEY[it.cat]] = it.id; }
      checkAch(); persist(); SND.ok(); closePopup();
    };
    if (b('#pClose')) b('#pClose').onclick = closePopup;
  };
  BACK.popup = () => { if (confirming) { confirming = false; draw(); focusDefault(); } else closePopup(); };
  draw(); show('popup');
}
const catDesc = c => ({ skin: 'Change ton apparence', acc: 'Un accessoire pour ton personnage', trail: 'Un effet derrière toi', theme: 'Change le style des plateformes', shape: 'Change la forme de ton personnage', life: 'Une seconde chance par partie' }[c] || '');
function closePopup() { hide(); renderHub(); }

/* ---------- Modes ---------- */
let modesTimer = null;
function openModes() {
  const el = $('#modes');
  const cd = Math.max(0, RUSH_COOLDOWN - (Date.now() - save.rush));
  el.innerHTML = `<div class="title" style="margin-top:.6em">CHOISIS UN MODE</div><div class="modelist">${Object.entries(MODES).map(([k, m]) => {
    const locked = k === 'rush' && cd > 0;
    return `<button class="modebtn" data-m="${k}" ${locked ? 'disabled' : ''} ${k === 'normal' ? 'data-default' : ''}>${m.name}<small>${m.desc}</small>
      <span class="rec">${k === 'rush' && locked ? 'DISPO DANS ' + fmtCd(cd) : 'RECORD ' + fmt(save.hi[k] || 0)}</span></button>`;
  }).join('')}</div><button class="btn alt" id="mBack" style="width:60%;margin-top:.7em">RETOUR</button>`;
  $$('.modebtn', el).forEach(b => b.onclick = () => { SND.click(); startGame(b.dataset.m); });
  $('#mBack').onclick = BACK.modes = () => { clearInterval(modesTimer); go('hub'); renderHub(); };
  BACK.modes = $('#mBack').onclick;
  go('modes');
  clearInterval(modesTimer);
  modesTimer = setInterval(() => { if (stack[stack.length - 1] !== 'modes') { clearInterval(modesTimer); return; }
    const b = $('.modebtn[data-m="rush"] .rec'); const c = Math.max(0, RUSH_COOLDOWN - (Date.now() - save.rush));
    if (b && c > 0) b.textContent = 'DISPO DANS ' + fmtCd(c); else if (c <= 0 && $('.modebtn[data-m="rush"]').disabled) openModes(); }, 1000);
}
function fmtCd(ms) { const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return `${h}h${String(m).padStart(2, '0')}m${String(s % 60).padStart(2, '0')}`; }

/* ---------- Démarrage ---------- */
function startGame(mode) {
  clearInterval(modesTimer);
  if (mode === 'rush') { if (Date.now() - save.rush < RUSH_COOLDOWN) return; save.rush = Date.now(); persist(); }
  lastMode = mode; G = newRun(mode); running = true; paused = false;
  Object.keys(hudCache).forEach(k => delete hudCache[k]);
  stack.length = 0; syncLayers();
  $('#hudStart').innerHTML = `APPUIE SUR<br><b>${mainLabel('left')}</b> <b>${mainLabel('right')}</b> OU <b>${mainLabel('start')}</b><br>POUR COMMENCER`;
  $('#hudStart').classList.remove('hidden');
  if (document.activeElement) document.activeElement.blur();
}
function quitToHub() {
  running = false; paused = false; G = null; go('hub'); renderHub();
}

/* ---------- Pause ---------- */
function openPause() {
  if (!running || !G || G.over || G.dead) return;
  paused = true;
  $('#pause').innerHTML = `<div class="title">PAUSE</div><div class="stack">
    <button class="btn" id="paResume" data-default>REPRENDRE</button>
    <button class="btn alt" id="paSet">PARAMÈTRES</button>
    <button class="btn danger" id="paQuit">QUITTER LA PARTIE</button></div>`;
  $('#paResume').onclick = BACK.pause = resume;
  $('#paSet').onclick = () => { SND.click(); openSettings(); };
  $('#paQuit').onclick = () => { SND.click(); quitToHub(); };
  show('pause');
}
function resume() { paused = false; held.clear(); stack.length = 0; syncLayers(); if (document.activeElement) document.activeElement.blur(); }

/* ---------- Continuer ---------- */
function openCont() {
  paused = true;
  $('#cont').innerHTML = `<div class="title">CONTINUER ?</div><div class="stack"><div class="panel"><div class="sub">SCORE : ${fmt(G.score)}</div>
    <div class="sub" style="display:flex;justify-content:center;gap:.5em;align-items:center">${pixSVG('heart').replace('<svg', '<svg width="24" height="22"')} x ${save.lives}</div>
    <div class="sub">UNE SEULE FOIS PAR PARTIE</div></div>
    <button class="btn" id="coYes" data-default>UTILISER UNE VIE</button><button class="btn alt" id="coNo">NON MERCI</button></div>`;
  $('#coYes').onclick = () => { SND.ok(); useLife(); paused = false; held.clear(); stack.length = 0; syncLayers(); document.activeElement.blur(); };
  $('#coNo').onclick = BACK.cont = () => { stack.length = 0; endRun(false); };
  show('cont');
}

/* ---------- Game over ---------- */
function openOver() {
  const g = G, r = g.result, ms = MODES[g.mode];
  $('#over').innerHTML = `<div class="title" style="margin-bottom:.2em">${r.timeUp ? 'TEMPS ÉCOULÉ' : 'GAME OVER'}</div>
    <div class="stack" style="width:88%"><div class="panel">
      <div class="sub">${ms.name}</div>
      <div class="big">${fmt(g.score)}</div>
      <div class="sub">${g.mode === 'rush' ? 'PIÈCES' : 'POINTS'} · HAUTEUR ${fmt(g.height)}</div>
      <div class="sub gold">+${fmt(g.coins)} PIÈCES RAMASSÉES</div>
      ${r.bonusTxt.map(t => `<div class="sub good">${t}</div>`).join('')}
      <div class="top5">${r.top.map((v, i) => `<div class="${i === r.rank && r.inTop ? 'me' : ''}"><span>${i + 1}.</span><span>${fmt(v)}</span></div>`).join('') || '<div><span>—</span></div>'}</div>
      ${r.fresh.map(a => `<div class="ach">★ SUCCÈS : ${a.name}</div>`).join('')}
    </div>
    <button class="btn" id="ovRetry" data-default ${g.mode === 'rush' ? 'disabled' : ''}>REJOUER</button>
    <div class="row2"><button class="btn alt" id="ovModes" style="flex:1">MODES</button><button class="btn alt" id="ovHub" style="flex:1">MENU</button></div></div>`;
  $('#ovRetry').onclick = () => { SND.click(); startGame(g.mode); };
  $('#ovModes').onclick = () => { SND.click(); running = false; G = null; openModes(); };
  $('#ovHub').onclick = BACK.over = () => { SND.click(); quitToHub(); };
  if (g.mode === 'rush') { $('#ovRetry').removeAttribute('data-default'); $('#ovHub').setAttribute('data-default', ''); }
  stack.length = 0; show('over');
}

/* ---------- Paramètres ---------- */
let rebind = null; // {act, slot, btn}
function openSettings() {
  BACK.settings = () => { rebind = null; hide(); if (stack.includes('hub')) renderHub(); };
  renderSettings(); show('settings');
}
function renderSettings() {
  const s = save.settings;
  const el = $('#settings');
  el.innerHTML = `<div class="title" style="margin-bottom:.5em">PARAMÈTRES</div><div class="scroll">
    <div class="setrow"><span>SENSIBILITÉ</span><button class="btn small alt" id="sMinus">-</button><b>${s.sens}</b><button class="btn small alt" id="sPlus">+</button></div>
    <div class="setrow"><span>SON</span><button class="btn small ${s.sound ? '' : 'danger'}" id="sSound">${s.sound ? 'OUI' : 'NON'}</button></div>
    <div class="sub" style="text-align:left;margin-top:.6em">TOUCHES (CLIQUE OU ENTRÉE, PUIS APPUIE SUR LA NOUVELLE TOUCHE · RETOUR ARR. = EFFACER)</div>
    <div class="keys">${ACTIONS.map(([a, n]) => `<div class="keyrow"><span>${n}</span>
      <button class="keybtn" data-a="${a}" data-s="0">${keyLabel(save.keys[a][0])}</button>
      <button class="keybtn" data-a="${a}" data-s="1">${keyLabel(save.keys[a][1])}</button></div>`).join('')}</div>
    <div class="stack" style="width:100%;margin:.6em 0">
      <button class="btn small alt" id="sResetK" style="width:100%">RÉINITIALISER LES TOUCHES</button>
      <button class="btn small danger" id="sResetS" style="width:100%">EFFACER TOUTES LES DONNÉES</button></div></div>
    <button class="btn" id="sBack" style="width:70%;margin-top:.6em" data-default>RETOUR</button>`;
  $('#sMinus').onclick = () => { s.sens = Math.max(1, s.sens - 1); persist(); SND.click(); renderSettings(); focusTab('#sMinus'); };
  $('#sPlus').onclick = () => { s.sens = Math.min(10, s.sens + 1); persist(); SND.click(); renderSettings(); focusTab('#sPlus'); };
  $('#sSound').onclick = () => { s.sound = !s.sound; persist(); audioInit(); SND.click(); renderSettings(); focusTab('#sSound'); };
  $$('.keybtn', el).forEach(b => b.onclick = () => {
    rebind = { act: b.dataset.a, slot: +b.dataset.s, btn: b };
    b.classList.add('wait'); b.textContent = 'APPUIE...';
  });
  $('#sResetK').onclick = () => { save.keys = JSON.parse(JSON.stringify(DEFAULT_KEYS)); save.labels = {}; persist(); SND.ok(); renderSettings(); focusTab('#sResetK'); };
  let armed = false;
  $('#sResetS').onclick = () => {
    if (!armed) { armed = true; $('#sResetS').textContent = 'SÛR ? REAPPUIE'; return; }
    save = defSave(); persist(); SND.ok(); BACK.settings(); if (!stack.includes('hub') && running) quitToHub(); else renderHub();
  };
  $('#sBack').onclick = BACK.settings;
}
function finishRebind(e) {
  const { act, slot } = rebind; rebind = null;
  const c = e.code;
  if (c === 'Escape' || c === 'Tab' || c === 'MetaLeft' || c === 'MetaRight') { renderSettings(); focusTab(`.keybtn[data-a="${act}"][data-s="${slot}"]`); return; }
  const arr = save.keys[act];
  if (c === 'Backspace' || c === 'Delete') { if (arr.filter(Boolean).length > 1 || slot === 1) arr[slot] = ''; }
  else {
    for (const a in save.keys) save.keys[a] = save.keys[a].map(k => k === c ? '' : k); // pas de doublon
    const arr2 = save.keys[act]; while (arr2.length < 2) arr2.push('');
    arr2[slot] = c;
    if (e.key && e.key.length === 1) save.labels[c] = e.key.toUpperCase(); else delete save.labels[c];
    // une action ne peut pas rester sans touche
    for (const a in save.keys) if (!save.keys[a].some(Boolean)) save.keys[a] = JSON.parse(JSON.stringify(DEFAULT_KEYS))[a].filter(k => !Object.values(save.keys).flat().includes(k)).slice(0, 1).concat(['']);
  }
  persist(); SND.ok(); renderSettings(); focusTab(`.keybtn[data-a="${act}"][data-s="${slot}"]`);
}

/* ------------------------------------------------------------------ */
/*  ENTRÉES CLAVIER                                                   */
/* ------------------------------------------------------------------ */
const NAV = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'PageUp', 'PageDown', 'Tab']);
addEventListener('keydown', e => {
  audioInit();
  if (rebind) { e.preventDefault(); if (!e.repeat) finishRebind(e); return; }
  const c = e.code;
  const bound = Object.values(save.keys).some(a => a.includes(c));
  if (bound || NAV.has(c)) e.preventDefault();
  held.add(c);
  if (running && G && stack.length === 0) { playKey(e); return; }
  menuKey(e);
});
addEventListener('keyup', e => { held.delete(e.code); if (NAV.has(e.code)) e.preventDefault(); });
addEventListener('blur', () => { held.clear(); if (running && G && stack.length === 0 && !G.waiting) openPause(); });

function playKey(e) {
  const c = e.code;
  if (is('pause', c)) { if (!e.repeat) openPause(); return; }
  if (G.waiting && !e.repeat && (is('left', c) || is('right', c) || is('start', c))) beginRun();
}
function menuKey(e) {
  const c = e.code, top = stack[stack.length - 1];
  const arrow = c.startsWith('Arrow');
  if (c === 'ArrowUp') moveFocus(0, -1);
  else if (c === 'ArrowDown') moveFocus(0, 1);
  else if (c === 'ArrowLeft') moveFocus(-1, 0);
  else if (c === 'ArrowRight') moveFocus(1, 0);
  else if (top === 'hub' && is('prev', c)) setPage(page - 1);
  else if (top === 'hub' && is('next', c)) setPage(page + 1);
  else if (is('pause', c) || c === 'Backspace') { if (e.repeat) return; if (top === 'pause') resume(); else if (BACK[top]) BACK[top](); else if (top === 'hub' && c !== 'Backspace') {} }
  else if (is('left', c)) moveFocus(-1, 0);
  else if (is('right', c)) moveFocus(1, 0);
  else if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space' || (is('start', c) && !arrow)) {
    if (e.repeat) return;
    const cur = document.activeElement;
    if (cur && focusables().includes(cur) && cur.click) cur.click(); else { const d = $('[data-default]', layerEl(top)); if (d) d.click(); }
  }
}
window.addEventListener('wheel', () => {}, { passive: true });

/* ------------------------------------------------------------------ */
/*  BOUCLE                                                            */
/* ------------------------------------------------------------------ */
let last = performance.now(), acc = 0, animAcc = 0;
function frame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (running && G && !paused && !G.over) {
    acc += dt; let n = 0;
    while (acc >= 1 / 60 && n < 5) { step(); acc -= 1 / 60; n++; if (!running || !G || G.over || G.dead) { acc = 0; break; } }
    if (n === 5) acc = 0;
  }
  render(now / 1000);
  updateHud();
  animAcc += dt;
  if (animAcc > 1 / 20) { animAcc = 0; for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i]; if (!a.cv.isConnected) { if (!stack.length || true) {} } else a.draw(now / 1000); } }
  requestAnimationFrame(frame);
}
$('#btnSettings').onclick = () => { SND.click(); openSettings(); };
BACK.hub = null;
addEventListener('resize', fit);
function fit() { const a = $('#app'); a.style.fontSize = (a.clientHeight / 720 * 16) + 'px'; }
fit();
renderHub(); syncLayers(); focusDefault();
requestAnimationFrame(frame);

// accès pour debug / tests
window.__TC = { get G() { return G; }, save: () => save, startGame };
})();
