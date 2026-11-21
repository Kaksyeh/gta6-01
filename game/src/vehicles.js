// Cars: the player's ride, parked cars to steal, traffic, and police
// pursuit. Steering turns at 4.2 radians per second at low speed and
// scales down above 150 pixels per second, so a car at full tilt holds a
// 64-pixel road through a corner instead of weaving off it.
import { CFG, PALETTE } from './config.js';
import { moveCircle, isOnRoad, isBeach, clampToWorld } from './city.js';
import { makeRng, clamp } from './random.js';
import { damagePerson } from './entities.js';

function makeCar(kind, type, x, y, angle, rng) {
  const spec = CFG.car.types[type];
  return {
    kind,
    type,
    x,
    y,
    angle,
    speed: 0,
    hp: spec.hp,
    maxHp: spec.hp,
    top: spec.top,
    accel: spec.accel,
    length: spec.length,
    width: spec.width,
    color: type === 'sport' ? PALETTE.sportColor : rng.pick(PALETTE.carColors),
    dead: false,
    steer: 0,
    road: null,
    line: 0,
    dir: 1,
    ramCooldown: 0,
  };
}

export function createCars(G) {
  const rng = makeRng(CFG.world.seed + 7);
  const cars = [];
  const spacing = CFG.world.roadSpacing;
  const halfRoad = CFG.world.roadWidth / 2;

  // The Comet GT waits at the Marina.
  cars.push(makeCar('parked', 'sport', 480, 2930, Math.PI / 2, rng));

  // Parked cars along the roads.
  let guard = 0;
  while (cars.filter((c) => c.kind === 'parked').length < 28 && guard++ < 400) {
    const vertical = rng.next() < 0.5;
    const line = Math.floor(rng.next() * 11) * spacing;
    const along = rng.range(80, CFG.world.size - 80);
    const x = vertical ? line + rng.pick([-1, 1]) * (halfRoad - 10) : along;
    const y = vertical ? along : line + rng.pick([-1, 1]) * (halfRoad - 10);
    if (Math.hypot(x - 760, y - 2560) < 120) continue; // keep the spawn clear
    if (Math.hypot(x - 480, y - 2930) < 120) continue; // keep the Comet GT clear
    let clash = false;
    for (const c of cars) {
      if (Math.hypot(c.x - x, c.y - y) < 70) { clash = true; break; }
    }
    if (clash) continue;
    const type = rng.pick(['sedan', 'sedan', 'van', 'hatch', 'sedan']);
    cars.push(makeCar('parked', type, x, y, vertical ? (rng.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng.next() < 0.5 ? 0 : Math.PI), rng));
  }

  // Traffic cars driving the road grid.
  for (let i = 0; i < 13; i++) {
    const vertical = rng.next() < 0.5;
    const line = Math.floor(rng.next() * 11) * spacing;
    const along = rng.range(100, CFG.world.size - 100);
    const car = makeCar('traffic', rng.pick(['sedan', 'van', 'hatch']), vertical ? line : along, vertical ? along : line, vertical ? Math.PI / 2 : 0, rng);
    car.road = vertical ? 'v' : 'h';
    car.line = line;
    car.dir = rng.next() < 0.5 ? 1 : -1;
    car.speed = rng.range(110, 150);
    car.angle = vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    cars.push(car);
  }
  return cars;
}

export function spawnPoliceCar(G, x, y) {
  const rng = G.rng;
  const car = makeCar('police', 'police', x, y, 0, rng);
  car.color = PALETTE.policeColor;
  G.cars.push(car);
  return car;
}

function updateCarPhysics(G, car, dt, accelIn, brakeIn, steerIn) {
  const spec = CFG.car.types[car.type];
  const onRoad = isOnRoad(car.x, car.y);
  const onBeach = isBeach(G.city, car.x, car.y);
  const top = car.top * (onRoad ? 1 : onBeach ? CFG.car.offroadTopFactor : 0.65);
  const accel = car.accel * (onRoad ? 1 : CFG.car.offroadAccelFactor);
  if (accelIn) {
    car.speed = Math.min(top, car.speed + accel * dt);
  } else if (brakeIn) {
    if (car.speed > 0) {
      car.speed = Math.max(0, car.speed - CFG.car.brake * dt);
    } else {
      car.speed = Math.max(-CFG.car.reverseMax, car.speed - accel * 0.6 * dt);
    }
  } else {
    const drag = CFG.car.drag * dt;
    if (car.speed > 0) car.speed = Math.max(0, car.speed - drag);
    else if (car.speed < 0) car.speed = Math.min(0, car.speed + drag);
  }
  const falloff = 1 - 0.5 * clamp((Math.abs(car.speed) - CFG.car.turnFalloffStart) / 300, 0, 1);
  if (Math.abs(car.speed) > 10 && steerIn !== 0) {
    car.angle += steerIn * CFG.car.turnRate * falloff * dt * Math.sign(car.speed);
  }
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const radius = (car.length / 2) * 0.75;
  const moved = moveCircle(G.city, car.x, car.y, dx, dy, radius);
  const impact = Math.abs(car.speed);
  if ((moved.hitX || moved.hitY) && impact > CFG.car.wallDamageMinImpact) {
    car.hp -= impact * CFG.car.wallDamageFactor;
    car.speed *= 0.35;
    G.audio.crash();
  } else if (moved.hitX || moved.hitY) {
    car.speed *= 0.5;
  }
  car.x = moved.x;
  car.y = moved.y;
  const clamped = clampToWorld(car.x, car.y, 20);
  car.x = clamped.x;
  car.y = clamped.y;
  if (car.hp <= 0 && !car.dead) {
    car.dead = true;
    car.speed = 0;
    G.audio.explosion();
    if (G.player.car === car) {
      G.player.car = null;
      G.player.onFoot = true;
      G.player.x = car.x;
      G.player.y = car.y + 30;
      hurtPlayerCar(G, CFG.car.explosionDamage);
    }
  }
}

function hurtPlayerCar(G, dmg) {
  // The explosion of the player's own car hurts the player.
  G.hurtPlayer(dmg, 'explosion');
}

function updateTraffic(G, car, dt) {
  if (car.dead) return;
  const spacing = CFG.world.roadSpacing;
  // Move along the current road.
  if (car.road === 'v') {
    car.y += car.dir * car.speed * dt;
    car.x = car.line;
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (car.y < 40) { car.dir = 1; }
    if (car.y > CFG.world.size - 40) { car.dir = -1; }
    // At an intersection, sometimes turn onto the cross road.
    const near = Math.abs(car.y - Math.round(car.y / spacing) * spacing) < 6;
    if (near && G.rng.next() < 0.02) {
      car.road = 'h';
      car.line = Math.round(car.y / spacing) * spacing;
      car.dir = G.rng.next() < 0.5 ? 1 : -1;
    }
  } else {
    car.x += car.dir * car.speed * dt;
    car.y = car.line;
    car.angle = car.dir > 0 ? 0 : Math.PI;
    if (car.x < 40) { car.dir = 1; }
    if (car.x > CFG.world.size - 40) { car.dir = -1; }
    const near = Math.abs(car.x - Math.round(car.x / spacing) * spacing) < 6;
    if (near && G.rng.next() < 0.02) {
      car.road = 'v';
      car.line = Math.round(car.x / spacing) * spacing;
      car.dir = G.rng.next() < 0.5 ? 1 : -1;
    }
  }
}

function updatePolice(G, car, dt) {
  if (car.dead) return;
  const pl = G.player;
  const tx = pl.x;
  const ty = pl.y;
  const d = Math.hypot(tx - car.x, ty - car.y);
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = clamp(diff * 2, -1, 1);
  const accelIn = d > 70;
  car.ramCooldown -= dt;
  updateCarPhysics(G, car, dt, accelIn, false, steer);
  // Ramming the player's car.
  if (pl.car && !pl.car.dead && car.ramCooldown <= 0) {
    const pd = Math.hypot(pl.car.x - car.x, pl.car.y - car.y);
    if (pd < 46) {
      car.ramCooldown = CFG.police.ramCooldown;
      pl.car.hp -= CFG.police.ramDamage;
      pl.car.speed *= 0.8;
      G.audio.crash();
      if (pl.car.hp <= 0 && !pl.car.dead) {
        const wreck = pl.car;
        wreck.dead = true;
        wreck.speed = 0;
        G.audio.explosion();
        G.player.car = null;
        G.player.onFoot = true;
        G.player.x = wreck.x;
        G.player.y = wreck.y + 30;
        G.hurtPlayer(CFG.car.explosionDamage, 'explosion');
      }
    }
  }
}

export function stealNearestCar(G) {
  const p = G.player;
  let best = null;
  let bestD = CFG.car.enterRange;
  for (const c of G.cars) {
    if (c.dead) continue;
    if (c.kind !== 'parked' && !(c.kind === 'traffic' && Math.abs(c.speed) < 50)) continue;
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d < bestD) { best = c; bestD = d; }
  }
  if (!best) return false;
  const jacked = best.kind === 'traffic';
  best.kind = 'driven';
  p.car = best;
  p.onFoot = false;
  p.angle = best.angle;
  if (jacked) G.addHeat(CFG.car.jackHeat);
  G.audio.pickup();
  return true;
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.kind = 'parked';
  car.speed = 0;
  p.car = null;
  p.onFoot = true;
  const side = Math.PI / 2;
  p.x = car.x + Math.cos(car.angle + side) * 30;
  p.y = car.y + Math.sin(car.angle + side) * 30;
  const clamped = clampToWorld(p.x, p.y, CFG.player.radius + 4);
  p.x = clamped.x;
  p.y = clamped.y;
  p.angle = car.angle;
}

export function updateCars(G, dt) {
  const p = G.player;
  const input = G.input;

  // Entering and exiting cars with E.
  if (input.wasPressed('KeyE') && G.state === 'playing') {
    if (p.onFoot) {
      stealNearestCar(G);
    } else {
      exitCar(G);
    }
  }

  // The player's car.
  if (p.car && !p.onFoot) {
    const car = p.car;
    const steer = (input.isDown('KeyA') || input.isDown('ArrowLeft') ? -1 : 0) +
      (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0);
    updateCarPhysics(G, car, dt,
      input.isDown('KeyW') || input.isDown('ArrowUp'),
      input.isDown('KeyS') || input.isDown('ArrowDown'),
      steer);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
  }

  // Traffic and police.
  for (const car of G.cars) {
    if (car === p.car) continue;
    if (car.kind === 'traffic') updateTraffic(G, car, dt);
    else if (car.kind === 'police') updatePolice(G, car, dt);
  }

  // The player's car running over pedestrians.
  if (p.car && !p.onFoot && Math.abs(p.car.speed) > 30) {
    for (const person of G.peds) {
      if (person.state === 'dead') continue;
      const d = Math.hypot(person.x - p.car.x, person.y - p.car.y);
      if (d < 26) {
        const wasGuard = person.kind === 'guard';
        damagePerson(G, person, 100);
        if (person.kind === 'ped') G.addHeat(CFG.wanted.pedRunOverHeat);
        else if (person.kind === 'cop') G.addHeat(CFG.wanted.copRunOverHeat);
        else if (wasGuard) G.addHeat(CFG.wanted.guardKillHeat);
      }
    }
  }

  // Keep the player's car clear of other cars.
  if (p.car && !p.onFoot) {
    for (const other of G.cars) {
      if (other === p.car || other.dead) continue;
      const d = Math.hypot(other.x - p.car.x, other.y - p.car.y);
      if (d < 40 && d > 0.01) {
        const push = (40 - d) / 2;
        const nx = (p.car.x - other.x) / d;
        const ny = (p.car.y - other.y) / d;
        p.car.x += nx * push;
        p.car.y += ny * push;
        p.car.speed *= 0.96;
      }
    }
  }
}
