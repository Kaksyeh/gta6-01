// SOLMAR — Streets of the Sun. main.js: the game loop, the state machine (title,
// playing, paused, dead, busted, mission complete, story complete), the camera,
// save/load wiring, and the debug hook Playwright drives in tests.

import { STEP, WORLD, KEYS, MISSIONS } from './config.js';
import { createRandom, clamp, lerp } from './random.js';
import { generateCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createPlayer, spawnPeds, spawnTraffic, updatePlayer, updatePeds,
  updateTraffic, updateCops, hurtPlayer, spawnParticles,
} from './entities.js';
import {
  spawnParkedCars, updatePlayerCar, updatePoliceCars, collideCars,
  carsHitPeds, pruneCars, tryEnterCar,
} from './vehicles.js';
import { createWanted, updateWanted } from './wanted.js';
import { updateBullets, updateGuards } from './combat.js';
import { startMission, updateMission, missionTarget, missionObjectiveText, nextMissionIndex } from './missions.js';
import { render } from './render.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search);
const CITY_SEED = Number(params.get('seed') || 7);
const SHOT = params.get('shot');

function buildGame(reuse) {
  const city = generateCity(CITY_SEED);
  // Reuse the input listeners and the audio context across new games, so a
  // restart does not stack duplicate listeners or music loops.
  const input = reuse ? reuse.input : createInput(canvas);
  const audio = reuse ? reuse.audio : createAudio();
  const G = {
    city,
    rnd: createRandom(CITY_SEED * 1000 + 7),
    input,
    audio,
    time: 0,
    state: 'title',
    menuIndex: 0,
    player: createPlayer(city),
    cars: [],
    peds: [],
    cops: [],
    bullets: [],
    particles: [],
    skids: [],
    pickups: [],
    wanted: createWanted(),
    mission: null,
    completedMissions: new Set(),
    camera: { x: city.spawn.x, y: city.spawn.y, zoom: 1 },
    events: [],
    shake: 0,
    playStartedAt: 0,
    saveData: loadSave(),
    deathNote: '',
    missionDone: -1,
    missionDoneAt: 0,
    viewW: window.innerWidth,
    viewH: window.innerHeight,
    ctx,
    showcaseObjective: null,
    shotDrive: false,
    shotMode: false,
    pendingMissionAt: 0,
    _titleItems: [],
    _pauseItems: [],
  };
  G.screenToWorld = (sx, sy) => {
    const cam = G.camera;
    return {
      x: cam.x + (sx - G.viewW / 2) / cam.zoom,
      y: cam.y + (sy - G.viewH / 2) / cam.zoom,
    };
  };
  G._hurtPlayer = (amount, source) => hurtPlayer(G, amount, source);
  G._objectiveText = () => missionObjectiveText(G) || G.showcaseObjective || null;
  G._missionTarget = () => missionTarget(G);
  G._nextMissionName = () => {
    const i = nextMissionIndex(G);
    return i >= 0 ? MISSIONS[i].name : null;
  };
  G._autosave = () => {
    writeSave({
      cash: G.player.cash,
      missionIndex: nextMissionIndex(G),
      completed: G.completedMissions.size,
      x: G.player.x,
      y: G.player.y,
      health: G.player.health,
    });
    G.saveData = loadSave();
  };
  spawnParkedCars(G);
  spawnTraffic(G, 26);
  spawnPeds(G, 40);
  return G;
}

let G = buildGame();

// --- save / load ---------------------------------------------------------------

function applySaveData(save) {
  const p = G.player;
  p.cash = save.cash || 0;
  p.health = save.health || 100;
  if (save.x != null && save.y != null) {
    p.x = save.x;
    p.y = save.y;
  }
  G.completedMissions = new Set();
  for (let i = 0; i < (save.completed || 0); i++) G.completedMissions.add(i);
  G.camera.x = p.x;
  G.camera.y = p.y;
}

function newGame() {
  const keepShot = G.shotMode;
  const fresh = buildGame(G);
  fresh.shotMode = keepShot;
  G = fresh;
  window.__solmar = G;
  G.playStartedAt = G.time;
  G.state = 'playing';
  G.pendingMissionAt = G.time + 1.0;
}

function respawn() {
  const p = G.player;
  const hosp = G.city.landmarks.hospital;
  p.health = p.maxHealth;
  p.onFoot = true;
  p.car = null;
  p.x = hosp.x;
  p.y = hosp.y + hosp.h / 2 + 40;
  p.angle = -Math.PI / 2;
  G.wanted = createWanted();
  G.cops = [];
  G.cars = G.cars.filter((c) => c.kind !== 'police');
  G.camera.x = p.x;
  G.camera.y = p.y;
  G.state = 'playing';
  G.playStartedAt = G.time;
  const idx = G.mission ? G.mission.index : nextMissionIndex(G);
  if (idx >= 0 && !G.completedMissions.has(idx)) {
    startMission(G, idx);
  }
}

// --- menus ----------------------------------------------------------------------

function titleItems() {
  return G._titleItems.length ? G._titleItems : ['NEW GAME'];
}

function menuMove(dir) {
  const n = G.state === 'title' ? titleItems().length : G._pauseItems.length || 1;
  G.menuIndex = (G.menuIndex + dir + n) % n;
  G.audio.uiClick();
}

function titleConfirm() {
  const items = titleItems();
  const choice = items[G.menuIndex];
  G.audio.uiClick();
  if (choice && choice.startsWith('CONTINUE') && G.saveData) {
    applySaveData(G.saveData);
    G.state = 'playing';
    G.playStartedAt = G.time;
    const idx = nextMissionIndex(G);
    if (idx >= 0) G.pendingMissionAt = G.time + 1.0;
  } else if (choice === 'HOW TO PLAY') {
    G.state = 'howto';
  } else {
    clearSave();
    newGame();
  }
}

function pauseConfirm() {
  const items = G._pauseItems;
  const choice = items[G.menuIndex];
  G.audio.uiClick();
  if (choice === 'RESUME') {
    G.state = 'playing';
  } else if (choice === 'SAVE GAME') {
    G._autosave();
    G.events.push({ text: 'Game saved.', at: G.time });
  } else if (choice === 'RESTART MISSION') {
    const idx = G.mission ? G.mission.index : nextMissionIndex(G);
    G.state = 'playing';
    if (idx >= 0) startMission(G, idx);
  } else if (choice && choice.startsWith('SOUND')) {
    G.audio.toggleMute();
  } else if (choice === 'QUIT TO TITLE') {
    G._autosave();
    G.state = 'title';
    G.menuIndex = 0;
  }
}

// --- per-state input --------------------------------------------------------------

function handleStateInput() {
  const input = G.input;
  if (input.pressed('KeyM')) G.audio.toggleMute();
  if (G.state === 'title') {
    if (input.pressed('ArrowUp') || input.pressed('KeyW')) menuMove(-1);
    if (input.pressed('ArrowDown') || input.pressed('KeyS')) menuMove(1);
    if (input.pressedAny(KEYS.confirm)) titleConfirm();
    return;
  }
  if (G.state === 'howto') {
    if (input.pressed('Escape') || input.pressedAny(KEYS.confirm)) G.state = 'title';
    return;
  }
  if (G.state === 'paused') {
    if (input.pressed('ArrowUp') || input.pressed('KeyW')) menuMove(-1);
    if (input.pressed('ArrowDown') || input.pressed('KeyS')) menuMove(1);
    if (input.pressedAny(KEYS.confirm)) pauseConfirm();
    if (input.pressed('Escape')) G.state = 'playing';
    return;
  }
  if (G.state === 'dead' || G.state === 'busted') {
    if (input.pressedAny(KEYS.confirm)) {
      G.player.cash = Math.max(0, G.player.cash - (G.state === 'dead' ? 100 : 150));
      respawn();
    }
    return;
  }
  if (G.state === 'missionComplete') {
    if (input.pressedAny(KEYS.confirm)) {
      const next = nextMissionIndex(G);
      G.state = 'playing';
      if (next >= 0) startMission(G, next);
      else G.state = 'storyComplete';
    }
    return;
  }
  if (G.state === 'storyComplete') {
    if (input.pressedAny(KEYS.confirm)) G.state = 'playing';
    return;
  }
  // playing
  if (input.pressed('Escape') || input.pressed('KeyP')) {
    G.state = 'paused';
    G.menuIndex = 0;
    return;
  }
  if (input.pressed('KeyE')) tryEnterCar(G);
  if (input.pressed('KeyQ') && G.player.hasPistol) {
    G.player.weapon = G.player.weapon === 'pistol' ? 'fists' : 'pistol';
    G.audio.uiClick();
  }
}

// --- simulation -------------------------------------------------------------------

function update(dt) {
  G.time += dt;
  // Events older than their window drop out.
  if (G.events.length > 24) G.events.splice(0, G.events.length - 24);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 22);

  if (G.state !== 'playing') return;

  // A pending mission starts itself shortly after play begins.
  if (G.pendingMissionAt && G.time >= G.pendingMissionAt) {
    G.pendingMissionAt = 0;
    const idx = nextMissionIndex(G);
    if (idx >= 0 && !G.mission?.active) startMission(G, idx);
  }

  updatePlayer(G, dt);
  if (G.player.car) updatePlayerCar(G, dt);
  updateTraffic(G, dt);
  updatePoliceCars(G, dt);
  collideCars(G);
  carsHitPeds(G);
  updatePeds(G, dt);
  updateCops(G, dt);
  updateBullets(G, dt);
  updateGuards(G, dt);
  updateWanted(G, dt);
  updateMission(G, dt);
  pruneCars(G);

  // Particles.
  for (const pt of G.particles) {
    pt.life += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 1 - pt.drag * dt;
    pt.vy *= 1 - pt.drag * dt;
  }
  G.particles = G.particles.filter((pt) => pt.life < pt.maxLife);
  for (const s of G.skids) s.life += dt;
  G.skids = G.skids.filter((s) => s.life < 14);

  // Camera: follow the player, look ahead a little, zoom out in a fast car.
  const p = G.player;
  const targetZoom = p.onFoot ? 1.0 : Math.abs(p.car?.speed || 0) > 300 ? 0.78 : 0.85;
  G.camera.zoom = lerp(G.camera.zoom, targetZoom, Math.min(1, dt * 1.5));
  const look = 0.22;
  const tx = p.x + Math.cos(p.angle) * (p.onFoot ? 30 : 70) * look + (p.car ? Math.cos(p.car.angle) * p.car.speed * 0.12 : 0);
  const ty = p.y + Math.sin(p.angle) * (p.onFoot ? 30 : 70) * look + (p.car ? Math.sin(p.car.angle) * p.car.speed * 0.12 : 0);
  G.camera.x = lerp(G.camera.x, tx, Math.min(1, dt * 4));
  G.camera.y = lerp(G.camera.y, ty, Math.min(1, dt * 4));
  const vw = G.viewW / G.camera.zoom / 2;
  const vh = G.viewH / G.camera.zoom / 2;
  G.camera.x = clamp(G.camera.x, vw - 100, WORLD.size - vw + 100);
  G.camera.y = clamp(G.camera.y, vh - 100, WORLD.size - vh + 100);
}

// --- boot -------------------------------------------------------------------------

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  G.viewW = window.innerWidth;
  G.viewH = window.innerHeight;
  canvas.width = Math.floor(G.viewW * dpr);
  canvas.height = Math.floor(G.viewH * dpr);
  canvas.style.width = `${G.viewW}px`;
  canvas.style.height = `${G.viewH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', resize);
window.addEventListener('keydown', () => G.audio.unlock(), { once: false });
canvas.addEventListener('mousedown', () => G.audio.unlock());
resize();

if (SHOT) {
  applyShot(G, SHOT);
}

window.__solmar = G;
window.__solmarReady = false;

let last = performance.now();
let acc = 0;
function frame(now) {
  // Schedule the next frame FIRST: a throw inside update/render must never
  // kill the loop — the game keeps running and the error surfaces in the console.
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  handleStateInput();
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    update(STEP);
    acc -= STEP;
    steps++;
  }
  if (steps === 5) acc = 0;
  render(G);
  G.input.endFrame();
  window.__solmarReady = true;
}
requestAnimationFrame(frame);
