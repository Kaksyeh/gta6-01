// SOLMAR — vehicles.js: cars. Arcade driving physics for the player's car, pursuit
// AI for police cars, car-vs-car and car-vs-building collisions, and entering,
// stealing and exiting cars. Traffic's road-following lives in entities.js.

import { CAR_TYPES, WORLD, KEYS, WANTED } from './config.js';
import { clamp, angleDiff } from './random.js';
import { resolveCircle, isOnRoad, randomRoadPoint } from './city.js';
import { damageCar, addHeat, spawnParticles, spawnPed, dropPickup } from './entities.js';

let nextCarId = 1000;

export function makeCar(type, x, y, angle, kind, driver) {
  const t = CAR_TYPES[type];
  return {
    id: nextCarId++,
    kind: kind || 'parked', // parked | traffic | police
    type,
    x, y,
    angle,
    speed: 0,
    steer: 0,
    hp: t.hp,
    maxHp: t.hp,
    color: t.color,
    driver: driver || null, // null | 'traffic' | 'player' | 'police'
    smoking: false,
    dead: false,
    deadAt: 0,
    stuckAt: 0,
    reverseAt: 0,
    // traffic-only fields are set by entities.spawnTraffic
    axis: undefined, dir: 0, lane: 0, line: 0, cruise: 0, turnAt: 0,
  };
}

export function spawnParkedCars(G) {
  for (const spot of G.city.parkedSpots) {
    G.cars.push(makeCar(spot.type, spot.x, spot.y, spot.angle, 'parked', null));
  }
}

export function spawnPoliceCar(G, x, y) {
  const car = makeCar('police', x, y, Math.random() * Math.PI * 2, 'police', 'police');
  G.cars.push(car);
  return car;
}

// --- Entering / exiting ------------------------------------------------------

export function nearestCar(G, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

export function tryEnterCar(G) {
  const p = G.player;
  if (p.onFoot) {
    const car = nearestCar(G, p.x, p.y, 58);
    if (!car) return;
    if (car.driver === 'traffic' || car.kind === 'police') {
      // Yank the driver out. Occupied cars are a crime; parked ones are free.
      const side = { x: car.x - Math.cos(car.angle) * 0, y: car.y };
      const driver = spawnPed(G, car.x - Math.sin(car.angle) * 34, car.y + Math.cos(car.angle) * 34, { kind: 'ped' });
      driver.state = 'flee';
      driver.stateAt = G.time;
      driver.fleeFrom = { x: p.x, y: p.y };
      addHeat(G, WANTED.crime.stealCar);
      G.events.push({ text: car.kind === 'police' ? 'You jacked a police car!' : 'You stole the car!', at: G.time });
      G.audio.horn();
    }
    car.driver = 'player';
    car.kind = car.kind === 'police' ? 'police' : 'player';
    p.car = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    G.audio.uiClick();
  } else {
    // Step out: place the player beside the car and let it roll to a stop.
    const car = p.car;
    const px = car.x - Math.sin(car.angle) * 34;
    const py = car.y + Math.cos(car.angle) * 34;
    const r = resolveCircle(G.city, px, py, 13);
    p.x = r.x;
    p.y = r.y;
    p.angle = car.angle;
    p.onFoot = true;
    p.car = null;
    car.driver = null;
    car.kind = car.kind === 'police' ? 'police' : 'parked';
    car.speed *= 0.3;
    G.audio.uiClick();
  }
}

// --- Player driving -----------------------------------------------------------

function carRadius(car) {
  return CAR_TYPES[car.type].length * 0.42;
}

export function updatePlayerCar(G, dt) {
  const p = G.player;
  const car = p.car;
  if (!car || p.onFoot) return;
  const t = CAR_TYPES[car.type];
  const input = G.input;
  const fwd = input.held(KEYS.up) || G.shotDrive;
  const back = input.held(KEYS.down);
  const left = input.held(KEYS.left);
  const right = input.held(KEYS.right);
  const handbrake = input.held(KEYS.brake);

  if (fwd) car.speed += t.accel * dt;
  if (back) {
    if (car.speed > 20) car.speed -= t.accel * 1.4 * dt;
    else car.speed -= t.accel * 0.55 * dt;
  }
  // Drag and rolling resistance; handbrake kills speed fast and lets the tail out.
  car.speed -= car.speed * (handbrake ? 1.6 : 0.35) * dt;
  if (!fwd && !back) car.speed -= car.speed * 0.5 * dt;
  car.speed = clamp(car.speed, -t.reverse, t.top);

  const steerTarget = (left ? -1 : 0) + (right ? 1 : 0);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
  const speedRatio = clamp(Math.abs(car.speed) / 140, 0, 1);
  // High-speed falloff: a car at full tilt turns less sharply, so it can hold a
  // 64px road through a corner instead of weaving off it into the buildings.
  const highSpeed = 1 - 0.5 * clamp((Math.abs(car.speed) - 150) / 300, 0, 1);
  const turnRate = car.steer * speedRatio * t.grip * highSpeed * (handbrake ? 1.5 : 1) * (car.speed < 0 ? -1 : 1);
  car.angle += turnRate * dt;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = resolveCircle(G.city, nx, ny, carRadius(car));
  const hitWall = Math.hypot(r.x - nx, r.y - ny) > 1;
  car.x = clamp(r.x, 20, WORLD.size - 20);
  car.y = clamp(r.y, 20, WORLD.size - 20);
  if (hitWall) {
    const impact = Math.abs(car.speed);
    if (impact > 90) {
      damageCar(G, car, impact * 0.06, null);
      G.audio.crash(Math.min(1, impact / 400));
      spawnParticles(G, car.x, car.y, { count: 8, color: '#ffd23e', speed: 180, life: 0.4, size: 3 });
      G.shake = Math.min(10, (G.shake || 0) + impact * 0.02);
    }
    car.speed *= -0.25;
  }
  // Off-road drag: grass, parks and sand slow the car.
  if (!isOnRoad(G.city, car.x, car.y)) {
    car.speed -= car.speed * 0.9 * dt;
    if (Math.abs(car.speed) > 120 && Math.random() < 0.4) {
      spawnParticles(G, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, {
        count: 1, color: '#b8a67e', speed: 30, life: 0.7, size: 6, grow: 6,
      });
    }
  }
  // Handbrake skid marks and smoke.
  if (handbrake && Math.abs(car.speed) > 140) {
    const bx = car.x - Math.cos(car.angle) * 22;
    const by = car.y - Math.sin(car.angle) * 22;
    G.skids.push({ x: bx, y: by, angle: car.angle, life: 0 });
    if (G.skids.length > 220) G.skids.shift();
    if (Math.random() < 0.5) {
      spawnParticles(G, bx, by, { count: 1, color: '#888', speed: 20, life: 0.8, size: 6, grow: 8 });
    }
  }
  if (car.smoking && Math.random() < 0.5) {
    spawnParticles(G, car.x + Math.cos(car.angle) * 18, car.y + Math.sin(car.angle) * 18, {
      count: 1, color: '#444', speed: 25, life: 1.1, size: 7, grow: 9,
    });
  }
  // Drive-by shooting from the window.
  if (input.mouse.down && G.time - p.fireAt > 0.22 && p.weapon === 'pistol') {
    p.fireAt = G.time;
    const m = G.screenToWorld(input.mouse.x, input.mouse.y);
    const a = Math.atan2(m.y - car.y, m.x - car.x);
    G.bullets.push({
      x: car.x + Math.cos(a) * 24,
      y: car.y + Math.sin(a) * 24,
      vx: Math.cos(a) * 900,
      vy: Math.sin(a) * 900,
      life: 0,
      maxLife: 0.7,
      damage: 34,
      from: 'player',
    });
    G.audio.shot();
    addHeat(G, 2);
  }
  // The player keeps their own position glued to the car.
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Engine sound follows speed.
  G.audio.engine(Math.abs(car.speed) / t.top, true);
}

// --- Police pursuit -------------------------------------------------------------

export function updatePoliceCars(G, dt) {
  const p = G.player;
  const target = p.onFoot ? p : p.car;
  if (!target) return;
  for (const car of G.cars) {
    if (car.kind !== 'police' || car.dead || car.driver === 'player') continue;
    const t = CAR_TYPES.police;
    const d = Math.hypot(target.x - car.x, target.y - car.y);
    // Lead the target a little using its velocity along its heading.
    const tSpeed = target.speed || 0;
    const tx = target.x + Math.cos(target.angle) * tSpeed * 0.25;
    const ty = target.y + Math.sin(target.angle) * tSpeed * 0.25;
    const want = Math.atan2(ty - car.y, tx - car.x);
    const diff = angleDiff(car.angle, want);
    car.steer = clamp(diff * 2.2, -1, 1);
    // Reverse out if stuck against a wall.
    if (G.time < car.reverseAt) {
      car.speed -= t.accel * dt;
    } else if (d > 70) {
      car.speed += t.accel * dt;
    } else {
      // Ramming speed: keep pushing into the target.
      car.speed += t.accel * 0.7 * dt;
    }
    car.speed -= car.speed * 0.3 * dt;
    car.speed = clamp(car.speed, -t.reverse, t.top);
    const speedRatio = clamp(Math.abs(car.speed) / 140, 0, 1);
    car.angle += car.steer * speedRatio * t.grip * (car.speed < 0 ? -1 : 1) * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const r = resolveCircle(G.city, nx, ny, carRadius(car));
    const hitWall = Math.hypot(r.x - nx, r.y - ny) > 1;
    car.x = clamp(r.x, 20, WORLD.size - 20);
    car.y = clamp(r.y, 20, WORLD.size - 20);
    if (hitWall) {
      car.speed *= -0.2;
      if (Math.abs(car.speed) < 12 && G.time - car.stuckAt > 2) {
        car.stuckAt = G.time;
        car.reverseAt = G.time + 0.9;
      }
    }
    if (car.smoking && Math.random() < 0.4) {
      spawnParticles(G, car.x, car.y, { count: 1, color: '#444', speed: 25, life: 1, size: 7, grow: 9 });
    }
  }
}

// --- Collisions -------------------------------------------------------------------

export function collideCars(G) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.dead) continue;
    const ra = carRadius(a);
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.dead) continue;
      const rb = carRadius(b);
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = ra + rb - 6;
      if (d >= min || d < 0.01) continue;
      const nx = dx / d;
      const ny = dy / d;
      const overlap = (min - d) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;
      // Trade some speed along the impact normal.
      const rel = (b.speed - a.speed) * 0.4;
      a.speed += rel * 0.5;
      b.speed -= rel * 0.5;
      const impact = Math.abs(rel);
      if (impact > 60) {
        damageCar(G, a, impact * 0.08, null);
        damageCar(G, b, impact * 0.08, null);
        if (a.driver === 'player' || b.driver === 'player') {
          G.audio.crash(Math.min(1, impact / 350));
          G.shake = Math.min(9, (G.shake || 0) + impact * 0.02);
          spawnParticles(G, (a.x + b.x) / 2, (a.y + b.y) / 2, { count: 7, color: '#ffd23e', speed: 160, life: 0.35, size: 3 });
        }
      }
    }
  }
}

// Cars (player's and police) running over pedestrians.
export function carsHitPeds(G) {
  const p = G.player;
  for (const ped of G.peds) {
    if (ped.state === 'dead' || ped.state === 'down') continue;
    for (const car of G.cars) {
      if (car.dead || (car.kind !== 'player' && car.kind !== 'police')) continue;
      if (Math.abs(car.speed) < 60) continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < carRadius(car) + 10) {
        ped.state = 'down';
        ped.stateAt = G.time;
        ped.hp -= 40;
        const fling = Math.atan2(ped.y - car.y, ped.x - car.x);
        ped.x += Math.cos(fling) * 26;
        ped.y += Math.sin(fling) * 26;
        spawnParticles(G, ped.x, ped.y, { count: 8, color: '#c94f43', speed: 120, life: 0.5, size: 3 });
        if (car.driver === 'player') {
          if (ped.hp <= 0) {
            ped.state = 'dead';
            addHeat(G, 22);
            dropPickup(G, ped.x, ped.y, 'cash', 30);
          } else {
            addHeat(G, 12);
          }
          G.audio.crash(0.5);
        }
        break;
      }
    }
  }
  // The player's car running down a foot cop hurts the player too (police notice).
  for (const cop of G.cops) {
    if (cop.hp <= 0 || !p.car) continue;
    const d = Math.hypot(cop.x - p.car.x, cop.y - p.car.y);
    if (d < carRadius(p.car) + 10 && Math.abs(p.car.speed) > 60) {
      cop.hp -= 50;
      spawnParticles(G, cop.x, cop.y, { count: 8, color: '#c94f43', speed: 120, life: 0.5, size: 3 });
      if (cop.hp <= 0) {
        cop.gone = true;
        addHeat(G, 40);
        dropPickup(G, cop.x, cop.y, 'cash', 60);
      }
    }
  }
}

// Parked and wrecked cars slowly fade from the street (wrecks stay as scenery).
export function pruneCars(G) {
  const now = G.time;
  G.cars = G.cars.filter((c) => {
    if (!c.dead) return true;
    return now - c.deadAt < 25;
  });
}
