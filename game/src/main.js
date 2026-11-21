// SOLMAR — Streets of the Sun. The entrypoint: it builds the game object,
// wires the modules together, runs the frame loop and owns the state
// machine for the title, the overlays and the death respawn.
import { CFG } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { createPlayer, createPeds, updatePlayer, updatePeds, hurtPlayer } from './entities.js';
import { createCars, updateCars } from './vehicles.js';
import { createWanted, addHeat, setHeat, updateWanted } from './wanted.js';
import { fireEnemyBullet, updateCombat } from './combat.js';
import { MISSIONS, startMission, restartMission, updateMission, missionTarget, objectiveText } from './missions.js';
import { render } from './render.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize(G) {
  G.viewW = window.innerWidth;
  G.viewH = window.innerHeight;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

const G = {
  state: 'title',
  time: 0,
  viewW: window.innerWidth,
  viewH: window.innerHeight,
  camera: { x: 760, y: 2560, zoom: CFG.camera.zoomNormal },
  rng: makeRng(CFG.world.seed),
  city: null,
  player: null,
  peds: [],
  cars: [],
  bullets: [],
  wanted: null,
  mission: null,
  completedMissions: new Set(),
  fireCooldown: 0,
  dialogue: null,
  titleIndex: 0,
  save: null,
  input: null,
  audio: null,
  ctx,
};

G.city = buildCity();
G.player = createPlayer(760, 2560);
G.peds = createPeds(G);
G.cars = createCars(G);
G.wanted = createWanted();
G.input = createInput(canvas);
G.audio = createAudio();
G.save = loadSave();

// Cross-module helpers, wired here so no module imports another's loop.
G.addHeat = (n) => addHeat(G, n);
G.setHeat = (v) => setHeat(G, v);
G.hurtPlayer = (dmg, src) => hurtPlayer(G, dmg, src);
G.fireEnemyBullet = (guard) => fireEnemyBullet(G, guard);
G.say = (lines) => {
  G.dialogue = { lines, idx: 0, until: G.time + 2.8 };
};
G._missionTarget = () => missionTarget(G);
G._objectiveText = () => objectiveText(G);
G._titleItems = () => (G.save ? ['CONTINUE', 'NEW GAME', 'HOW TO PLAY'] : ['NEW GAME', 'HOW TO PLAY']);

function applySave(save) {
  const p = G.player;
  p.cash = save.cash;
  p.x = save.x;
  p.y = save.y;
  p.health = save.health;
  p.onFoot = true;
  p.car = null;
  G.completedMissions = new Set();
  for (let i = 0; i < save.completed; i++) G.completedMissions.add(i);
  if (save.completed >= 2) {
    p.hasPistol = true;
    p.weapon = 'pistol';
  }
  if (save.missionIndex >= 0 && save.missionIndex < MISSIONS.length) {
    startMission(G, save.missionIndex);
  } else {
    G.mission = { def: MISSIONS[MISSIONS.length - 1], index: MISSIONS.length - 1, step: 0, active: false, kills: 0, timer: 0, timerMax: 0, stepStarted: true };
  }
  G.camera.x = p.x;
  G.camera.y = p.y;
}

function newGame() {
  clearSave();
  G.save = null;
  const p = G.player;
  p.x = 760;
  p.y = 2560;
  p.angle = -Math.PI / 2;
  p.health = CFG.player.health;
  p.cash = 0;
  p.hasPistol = false;
  p.weapon = 'fists';
  p.onFoot = true;
  p.car = null;
  G.completedMissions = new Set();
  G.wanted.heat = 0;
  G.wanted.stars = 0;
  startMission(G, 0);
  G.camera.x = p.x;
  G.camera.y = p.y;
  G.state = 'playing';
}

function respawn() {
  const p = G.player;
  p.cash = Math.max(0, p.cash - 100);
  p.health = CFG.player.health;
  p.x = 2400;
  p.y = 910;
  p.angle = -Math.PI / 2;
  p.onFoot = true;
  p.car = null;
  G.setHeat(0);
  G.cars = G.cars.filter((c) => c.kind !== 'police');
  G.peds = G.peds.filter((pe) => pe.kind !== 'cop');
  G.bullets = [];
  if (G.mission && G.mission.active) restartMission(G);
  G.camera.x = p.x;
  G.camera.y = p.y;
  G.state = 'playing';
}

function handleGlobalKeys() {
  const input = G.input;
  if (input.wasPressed('KeyM')) {
    G.audio.toggleMute();
  }
  if (G.state === 'title') {
    if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
      const items = G._titleItems();
      G.titleIndex = (G.titleIndex - 1 + items.length) % items.length;
    }
    if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
      const items = G._titleItems();
      G.titleIndex = (G.titleIndex + 1) % items.length;
    }
    if (input.wasPressed('Enter')) {
      const item = G._titleItems()[G.titleIndex];
      if (item === 'CONTINUE') {
        applySave(G.save);
        G.state = 'playing';
      } else if (item === 'NEW GAME') {
        newGame();
      } else if (item === 'HOW TO PLAY') {
        G.state = 'howto';
      }
    }
    return;
  }
  if (G.state === 'howto') {
    if (input.wasPressed('Enter')) G.state = 'title';
    return;
  }
  if (G.state === 'missionComplete') {
    if (input.wasPressed('Enter')) {
      const next = G.mission.index + 1;
      startMission(G, next);
      G.state = 'playing';
    }
    return;
  }
  if (G.state === 'storyComplete') {
    if (input.wasPressed('Enter')) {
      G.state = 'playing';
    }
    return;
  }
  if (G.state === 'dead' || G.state === 'busted') {
    if (input.wasPressed('Enter')) respawn();
    return;
  }
  if (G.state === 'playing') {
    if (input.wasPressed('KeyP')) {
      G.state = 'paused';
      return;
    }
    if (input.wasPressed('Enter') && G.dialogue) {
      G.dialogue.idx++;
      if (G.dialogue.idx >= G.dialogue.lines.length) {
        G.dialogue = null;
      } else {
        G.dialogue.until = G.time + 2.8;
      }
    }
    return;
  }
  if (G.state === 'paused') {
    if (input.wasPressed('KeyP')) G.state = 'playing';
  }
}

function updateCamera(G, dt) {
  if (G.state === 'title' || G.state === 'howto') return;
  const p = G.player;
  const cam = G.camera;
  const k = Math.min(1, 8 * dt);
  cam.x += (p.x - cam.x) * k;
  cam.y += (p.y - cam.y) * k;
  const fast = p.car && Math.abs(p.car.speed) > CFG.camera.fastSpeed;
  const targetZoom = fast ? CFG.camera.zoomFast : CFG.camera.zoomNormal;
  cam.zoom += (targetZoom - cam.zoom) * Math.min(1, 4 * dt);
}

function update(G, dt) {
  updatePlayer(G, dt);
  updateCars(G, dt);
  updatePeds(G, dt);
  updateWanted(G, dt);
  updateCombat(G, dt);
  updateMission(G, dt);
  updateCamera(G, dt);
  if (G.dialogue && G.time > G.dialogue.until) {
    G.dialogue.idx++;
    if (G.dialogue.idx >= G.dialogue.lines.length) {
      G.dialogue = null;
    } else {
      G.dialogue.until = G.time + 2.8;
    }
  }
}

let last = 0;
function frame(t) {
  // The next frame is scheduled first, so a slow frame never stops the loop.
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, Math.max(0, (t - last) / 1000 || 0));
  last = t;
  G.time += dt;
  G.audio.updateMusic(dt);
  handleGlobalKeys();
  if (G.state === 'playing') {
    update(G, dt);
  }
  render(G);
  G.input.endFrame();
}

resize(G);
window.addEventListener('resize', () => resize(G));

// Audio needs a first gesture; resume it on any key or click.
const unlock = () => G.audio.unlock();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// Screenshot staging: ?shot=chase / mission / streets / title.
const shot = new URLSearchParams(window.location.search).get('shot');
if (shot) {
  stageShot(G, shot);
}

window.__solmar = G;
window.__solmarReady = true;
requestAnimationFrame(frame);
