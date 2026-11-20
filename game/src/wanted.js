// SOLMAR — wanted.js: the wanted level. Crimes add heat (0–100); stars are
// floor(heat / 20), capped at 5. While the player keeps quiet the heat cools and
// stars fall one at a time. Police cars and foot cops spawn to match the level and
// despawn when they fall too far behind or the heat dies.

import { WANTED, WORLD, COMBAT } from './config.js';
import { clamp } from './random.js';
import { randomRoadPoint, randomSidewalkPoint } from './city.js';
import { spawnPoliceCar } from './vehicles.js';

export function createWanted() {
  return { stars: 0, heat: 0, quietAt: 0, decayAt: 0 };
}

function policeCars(G) {
  return G.cars.filter((c) => c.kind === 'police' && !c.dead && c.driver !== 'player');
}

function spawnSpotNear(G, minD, maxD) {
  for (let i = 0; i < 10; i++) {
    const pt = randomRoadPoint(G.rnd);
    const d = Math.hypot(pt.x - G.player.x, pt.y - G.player.y);
    if (d >= minD && d <= maxD) return pt;
  }
  return null;
}

export function updateWanted(G, dt) {
  const w = G.wanted;
  // Recompute stars from heat (heat only ever rises via addHeat).
  const stars = Math.min(WANTED.maxStars, Math.floor(w.heat / 20));
  if (stars !== w.stars) w.stars = stars;

  // Cooling off: after a quiet spell, lose one star every few seconds.
  if (w.stars > 0 && G.time - w.quietAt > WANTED.decayDelay) {
    if (G.time - w.decayAt > WANTED.decayInterval) {
      w.decayAt = G.time;
      w.heat = Math.max(0, w.heat - 20);
      w.stars = Math.min(WANTED.maxStars, Math.floor(w.heat / 20));
      if (w.stars === 0) {
        G.events.push({ text: 'You lost the cops. The heat is off — for now.', at: G.time });
      }
    }
  }

  // Police cars to match the level.
  const wantCars = WANTED.carsPerStar[w.stars];
  const have = policeCars(G);
  if (have.length < wantCars) {
    const spot = spawnSpotNear(G, 500, 800);
    if (spot) spawnPoliceCar(G, spot.x, spot.y);
  }
  // Despawn police cars that fell far behind (not the player's own ride).
  for (const car of have) {
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    if (d > WANTED.despawnDistance) {
      car.dead = true;
      car.deadAt = G.time - 30; // pruned on the next pass
    }
  }

  // Foot cops to match the level.
  const wantCops = WANTED.footCopsPerStar[w.stars];
  const liveCops = G.cops.filter((c) => c.hp > 0);
  if (liveCops.length < wantCops) {
    const pt = randomSidewalkPoint(G.rnd);
    const d = Math.hypot(pt.x - G.player.x, pt.y - G.player.y);
    if (d > 200 && d < 700) {
      G.cops.push({
        id: 9000 + Math.floor(Math.random() * 8999),
        kind: 'cop',
        x: pt.x, y: pt.y,
        angle: 0,
        hp: COMBAT.copHealth,
        maxHp: COMBAT.copHealth,
        punchAt: -99,
        color: '#20242c',
        state: 'walk',
        stateAt: G.time,
      });
    }
  }
  // When the heat dies, the remaining foot cops walk off.
  if (w.stars === 0) {
    G.cops = G.cops.filter((c) => c.hp > 0 && Math.hypot(c.x - G.player.x, c.y - G.player.y) < 500);
  }

  // Siren loudness follows the nearest police car.
  let nearest = 1;
  for (const car of have) {
    const d = Math.hypot(car.x - G.player.x, car.y - G.player.y);
    nearest = Math.min(nearest, clamp(d / 900, 0, 1));
  }
  G.audio.siren(nearest, w.stars > 0);
}
