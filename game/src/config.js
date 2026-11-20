// SOLMAR — Streets of the Sun. config.js: every tuning number and colour in one place.
// The world is a fixed 3200x3200 px city on a 320 px road grid; the renderer scales the
// camera view to the window, so no rule below depends on the screen size.

export const WORLD = {
  size: 3200,
  block: 320, // distance between road centrelines
  road: 64, // road width in px (32 each side of the centreline)
  beach: 2880, // y above this is sand (walkable), water lies beyond the south edge
};

export const STEP = 1 / 60; // fixed simulation step, seconds

export const PLAYER = {
  radius: 13,
  walk: 175,
  run: 265,
  health: 100,
  punchRange: 34,
  punchDamage: 25,
  punchCooldown: 0.45,
  fireCooldown: 0.22,
  regenDelay: 8, // seconds without damage before health starts coming back
  regenRate: 6, // hp per second
};

export const CAR_TYPES = {
  sedan: { length: 64, width: 30, accel: 340, top: 330, reverse: 130, grip: 3.4, hp: 100, color: '#c94f43', name: 'Sedan' },
  taxi: { length: 64, width: 30, accel: 330, top: 320, reverse: 130, grip: 3.4, hp: 100, color: '#e8b93c', name: 'Taxi' },
  van: { length: 76, width: 32, accel: 260, top: 260, reverse: 110, grip: 3.0, hp: 140, color: '#7d8a99', name: 'Van' },
  truck: { length: 92, width: 34, accel: 220, top: 230, reverse: 100, grip: 2.6, hp: 180, color: '#5a7d4f', name: 'Truck' },
  sport: { length: 62, width: 29, accel: 520, top: 460, reverse: 150, grip: 4.2, hp: 100, color: '#d92662', name: 'Comet GT' },
  police: { length: 66, width: 30, accel: 430, top: 400, reverse: 140, grip: 3.9, hp: 120, color: '#20242c', name: 'Interceptor' },
};

export const TRAFFIC = {
  count: 26, // ambient traffic cars
  speed: 120, // cruise speed px/s
  speedJitter: 35,
  turnChance: 0.22, // chance to turn at an intersection
};

export const PEDS = {
  count: 40,
  walk: 55,
  run: 150,
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 25, // seconds quiet before stars start falling
  decayInterval: 6, // seconds per star lost while quiet
  // police cars on the street per star level (index = stars)
  carsPerStar: [0, 1, 2, 3, 4, 5],
  footCopsPerStar: [0, 0, 0, 2, 3, 4],
  spawnDistance: 620, // police spawn this far from the player, on a road
  despawnDistance: 1400,
  // heat added by crimes (heat 0..100, stars = floor(heat/20) capped)
  crime: { stealCar: 22, punchPed: 12, killPed: 22, killCop: 40, shoot: 6, crashCop: 15 },
};

export const COMBAT = {
  bulletSpeed: 900,
  bulletDamage: 34,
  bulletRange: 620,
  guardHealth: 60,
  copHealth: 50,
  pedHealth: 30,
};

export const MISSIONS = [
  { id: 'm1', name: 'Welcome Home', reward: 500 },
  { id: 'm2', name: 'Hot Wheels', reward: 1200 },
  { id: 'm3', name: 'Heat Wave', reward: 1500 },
  { id: 'm4', name: 'The Drop', reward: 2000 },
  { id: 'm5', name: "La Reina's Due", reward: 5000 },
];

export const PALETTE = {
  water: '#2e7d9e',
  deepWater: '#256b8c',
  sand: '#e6d3a3',
  grass: '#5f9150',
  park: '#548a49',
  sidewalk: '#9a917e',
  road: '#33373e',
  roadEdge: '#454a53',
  lane: '#c8b96a',
  crosswalk: '#d8d4c8',
  buildingRoof: ['#c96f4a', '#e8dcc0', '#4a9e8f', '#e07856', '#d9c08a', '#7d6a9e', '#b0593f', '#8fae6b'],
  buildingEdge: '#2b2b2b',
  tree: '#3f7a37',
  treeDark: '#2f5c2a',
  player: '#f2c94c',
  playerDark: '#b8952e',
  police: '#20242c',
  policeWhite: '#e8e8e8',
  hudPanel: 'rgba(12, 14, 20, 0.72)',
  hudText: '#f4f1e6',
  hudMuted: '#b9b4a4',
  star: '#ffd23e',
  starEmpty: 'rgba(255,255,255,0.25)',
  health: '#58c96b',
  healthLow: '#e5534b',
  cash: '#7ddb8a',
  marker: '#ffd23e',
  objective: '#ffd23e',
  damage: 'rgba(229, 83, 75, 0.35)',
  night: 'rgba(20, 24, 60, 0.12)',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export const SAVE_KEY = 'solmar.save.v1';

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  punch: ['KeyF'],
  brake: ['Space'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  confirm: ['Enter', 'NumpadEnter'],
};
