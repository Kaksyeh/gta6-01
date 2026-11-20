// SOLMAR — entities.js: the living city. The player on foot, pedestrians, ambient
// traffic and police on foot. Car physics lives in vehicles.js; this module moves
// people and traffic cars along the roads.

import { PLAYER, TRAFFIC, PEDS, WORLD, KEYS, COMBAT } from './config.js';
import { clamp, dist2, angleTo, angleDiff, chance } from './random.js';
import { resolveCircle, randomRoadPoint, randomSidewalkPoint, roadAxisAt } from './city.js';

let nextId = 1;

export function createPlayer(city) {
  return {
    x: city.spawn.x,
    y: city.spawn.y,
    angle: city.spawn.angle,
    speed: 0,
    health: PLAYER.health,
    maxHealth: PLAYER.health,
    onFoot: true,
    car: null,
    weapon: 'fists',
    ammo: 0,
    cash: 0,
    lastDamageAt: -99,
    punchAt: -99,
    fireAt: -99,
    moving: false,
    running: false,
  };
}

export function spawnParticles(G, x, y, opts) {
  const n = opts.count || 8;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (opts.speed || 120) * (0.4 + Math.random() * 0.8);
    G.particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0,
      maxLife: (opts.life || 0.5) * (0.6 + Math.random() * 0.8),
      size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
      color: opts.color || '#ffffff',
      drag: opts.drag || 2.5,
      grow: opts.grow || 0,
    });
  }
  if (G.particles.length > 400) G.particles.splice(0, G.particles.length - 400);
}

export function addSkid(G, x, y, angle) {
  G.skids.push({ x, y, angle, life: 0 });
  if (G.skids.length > 220) G.skids.shift();
}

export function dropPickup(G, x, y, kind, amount) {
  G.pickups.push({ x, y, kind, amount, bornAt: G.time });
}

// --- Pedestrians ------------------------------------------------------------

const PED_COLORS = ['#e07856', '#4a9e8f', '#7d6a9e', '#c9a24a', '#5a7d4f', '#8a6d5a', '#6b7fa3', '#b0593f'];

export function spawnPed(G, x, y, opts) {
  const o = opts || {};
  const p = {
    id: nextId++,
    kind: o.kind || 'ped',
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: 0,
    hp: o.hp || COMBAT.pedHealth,
    maxHp: o.hp || COMBAT.pedHealth,
    state: 'walk', // walk | flee | down | dead
    stateAt: G.time,
    target: null,
    color: o.color || PED_COLORS[Math.floor(Math.random() * PED_COLORS.length)],
    fleeFrom: null,
    shootAt: -99,
  };
  G.peds.push(p);
  return p;
}

export function spawnPeds(G, count) {
  for (let i = 0; i < count; i++) {
    const pt = randomSidewalkPoint(G.rnd);
    spawnPed(G, pt.x, pt.y);
  }
}

function pickWalkTarget(G, p) {
  const pt = randomSidewalkPoint(G.rnd);
  p.target = pt;
}

export function updatePeds(G, dt) {
  for (const p of G.peds) {
    if (p.state === 'dead') continue;
    if (p.state === 'down') {
      if (G.time - p.stateAt > 4) {
        p.state = 'walk';
        p.stateAt = G.time;
        p.target = null;
      }
      continue;
    }
    if (p.state === 'flee') {
      // Run away from the threat for a few seconds, then calm down.
      if (p.fleeFrom && G.time - p.stateAt < 3.5) {
        const a = angleTo(p.fleeFrom.x, p.fleeFrom.y, p.x, p.y);
        p.angle = a;
        p.speed = PEDS.run;
        p.x += Math.cos(a) * p.speed * dt;
        p.y += Math.sin(a) * p.speed * dt;
        const r = resolveCircle(G.city, p.x, p.y, 10);
        p.x = r.x;
        p.y = r.y;
        p.x = clamp(p.x, 20, WORLD.size - 20);
        p.y = clamp(p.y, 20, WORLD.size - 20);
        continue;
      }
      p.state = 'walk';
      p.stateAt = G.time;
      p.target = null;
    }
    // Walk: stroll between sidewalk points.
    if (!p.target) pickWalkTarget(G, p);
    const dx = p.target.x - p.x;
    const dy = p.target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      p.target = null;
      p.speed = 0;
      continue;
    }
    const want = Math.atan2(dy, dx);
    p.angle += angleDiff(p.angle, want) * Math.min(1, dt * 6);
    p.speed = PEDS.walk;
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    const r = resolveCircle(G.city, p.x, p.y, 10);
    p.x = r.x;
    p.y = r.y;
  }
  // Prune the long-dead.
  if (G.peds.length > 90) {
    G.peds = G.peds.filter((p) => p.state !== 'dead' || G.time - p.stateAt < 20);
  }
}

// Peds near a gunshot or a speeding car run away. Guards and cops are armed
// and stand their ground — they do not flee (a fleeing guard made M5's kill
// step unplayable: every shot sent the guards sprinting away at 150px/s,
// faster than a bullet's lead could track, so the shootout could never end).
export function scarePeds(G, x, y, radius) {
  for (const p of G.peds) {
    if (p.state === 'dead' || p.state === 'down') continue;
    if (p.kind !== 'ped') continue;
    if (dist2(p.x, p.y, x, y) < radius * radius) {
      p.state = 'flee';
      p.stateAt = G.time;
      p.fleeFrom = { x, y };
    }
  }
}

// --- Traffic -----------------------------------------------------------------

export function spawnTraffic(G, count) {
  const types = ['sedan', 'sedan', 'taxi', 'taxi', 'van', 'truck'];
  for (let i = 0; i < count; i++) {
    const pt = randomRoadPoint(G.rnd);
    // randomRoadPoint puts the line coordinate exactly on a grid line.
    const axis = pt.x % 320 === 0 ? 'v' : 'h';
    // Lane offset for right-hand traffic, from the axis and direction.
    const dir = chance(G.rnd, 0.5) ? 1 : -1;
    const lane = laneOffset(axis, dir);
    const car = {
      id: nextId++,
      kind: 'traffic',
      type: types[Math.floor(G.rnd() * types.length)],
      x: axis === 'v' ? pt.x + lane : pt.x,
      y: axis === 'h' ? pt.y + lane : pt.y,
      angle: axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI,
      speed: 0,
      cruise: TRAFFIC.speed + (G.rnd() - 0.5) * 2 * TRAFFIC.speedJitter,
      steer: 0,
      hp: 100,
      maxHp: 100,
      driver: 'traffic',
      axis,
      dir,
      lane,
      line: axis === 'v' ? pt.x : pt.y,
      turnAt: 0,
      smoking: false,
      dead: false,
    };
    // Snap the cross-axis onto its road line + lane.
    if (axis === 'v') car.x = Math.round(car.x / 320) * 320 + lane;
    else car.y = Math.round(car.y / 320) * 320 + lane;
    G.cars.push(car);
  }
}

// Right-hand-traffic lane offset (+10 / -10 px) for a road axis and direction.
export function laneOffset(axis, dir) {
  if (axis === 'h') return dir > 0 ? 10 : -10;
  return dir > 0 ? -10 : 10;
}

function carAhead(G, car, range) {
  let best = null;
  let bestD = range;
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    if (o.axis !== car.axis || o.dir !== car.dir) continue;
    if (Math.abs(o.line - car.line) > 30) continue;
    const along = car.axis === 'h' ? o.x - car.x : o.y - car.y;
    const ahead = along * car.dir;
    if (ahead > 0 && ahead < bestD) {
      best = o;
      bestD = ahead;
    }
  }
  return best;
}

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.kind !== 'traffic' || car.dead) continue;
    // Cruise, slowing for the car ahead.
    let target = car.cruise;
    const ahead = carAhead(G, car, 95);
    if (ahead) target = Math.min(target, Math.max(0, ahead.speed - 20));
    // Do not rear-end the player's car.
    const pc = G.player.car;
    if (pc && !pc.dead && pc.axis === undefined) {
      const d = Math.hypot(pc.x - car.x, pc.y - car.y);
      if (d < 80) {
        const along = car.axis === 'h' ? (pc.x - car.x) * car.dir : (pc.y - car.y) * car.dir;
        if (along > 0) target = 0;
      }
    }
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    // Move along the road.
    if (car.axis === 'h') car.x += car.dir * car.speed * dt;
    else car.y += car.dir * car.speed * dt;
    // Face the direction of travel.
    const wantAngle = car.axis === 'h' ? (car.dir > 0 ? 0 : Math.PI) : car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.angle += angleDiff(car.angle, wantAngle) * Math.min(1, dt * 8);

    const alongPos = car.axis === 'h' ? car.x : car.y;
    const gridPos = ((alongPos % 320) + 320) % 320;
    const nearLine = gridPos < 14 || gridPos > 306;
    // At an intersection, sometimes turn onto the crossing road.
    if (nearLine && G.time - car.turnAt > 2 && chance(G.rnd, TRAFFIC.turnChance)) {
      const newAxis = car.axis === 'h' ? 'v' : 'h';
      const newDir = chance(G.rnd, 0.5) ? 1 : -1;
      const line = Math.round(alongPos / 320) * 320;
      // Do not turn onto the beach roads (none south of 2880) or off the map.
      if (newAxis === 'h' && line >= WORLD.beach) {
        // stay straight
      } else {
        car.axis = newAxis;
        car.dir = newDir;
        car.lane = laneOffset(newAxis, newDir);
        car.line = line;
        car.turnAt = G.time;
        if (newAxis === 'h') car.y = line + car.lane;
        else car.x = line + car.lane;
      }
    }
    // World edge: turn around.
    if (alongPos < 80 || alongPos > WORLD.size - 80 || (car.axis === 'v' && alongPos > WORLD.beach - 60)) {
      car.dir *= -1;
      car.lane = laneOffset(car.axis, car.dir);
      car.turnAt = G.time;
      if (car.axis === 'h') car.y = car.line + car.lane;
      else car.x = car.line + car.lane;
      // Nudge back inside.
      if (car.axis === 'h') car.x = clamp(car.x, 90, WORLD.size - 90);
      else car.y = clamp(car.y, 90, WORLD.beach - 70);
    }
    // Keep the cross-axis glued to its lane.
    if (car.axis === 'h') car.y = car.line + car.lane;
    else car.x = car.line + car.lane;
  }
}

// --- Police on foot ----------------------------------------------------------

export function updateCops(G, dt) {
  for (const cop of G.cops) {
    if (cop.hp <= 0) continue;
    const p = G.player;
    const target = p.onFoot ? p : p.car;
    if (!target) continue;
    const d = Math.hypot(target.x - cop.x, target.y - cop.y);
    if (d > 900) {
      // Too far: the cop gives up and despawns (the wanted module replaces him).
      cop.hp = 0;
      cop.gone = true;
      continue;
    }
    // Foot cops engage the player on foot only. Against a car they are
    // outmatched: they hold their ground instead of throwing themselves under
    // the wheels (which fed the player +40 heat per run-over cop and let four
    // of them beat a parked car to death at ~22 dps while the player waited
    // out the wanted level — the escape step could never go quiet).
    if (!p.onFoot) continue;
    const want = angleTo(cop.x, cop.y, target.x, target.y);
    cop.angle += angleDiff(cop.angle, want) * Math.min(1, dt * 6);
    const speed = 150;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    const r = resolveCircle(G.city, cop.x, cop.y, 10);
    cop.x = r.x;
    cop.y = r.y;
    if (d < 30 && G.time - cop.punchAt > 0.9) {
      cop.punchAt = G.time;
      hurtPlayer(G, 8, 'cop');
      spawnParticles(G, p.x, p.y, { count: 4, color: '#e5534b', speed: 90, life: 0.3, size: 3 });
    }
  }
  G.cops = G.cops.filter((c) => !c.gone);
}

// --- Player -------------------------------------------------------------------

export function hurtPlayer(G, amount, source) {
  const p = G.player;
  if (p.health <= 0) return;
  p.health -= amount;
  p.lastDamageAt = G.time;
  G.shake = Math.min(10, (G.shake || 0) + amount * 0.15);
  spawnParticles(G, p.x, p.y, { count: 6, color: '#e5534b', speed: 110, life: 0.4, size: 3 });
  if (p.health <= 0) {
    p.health = 0;
    if (source === 'cop' || (G.wanted.stars > 0 && source === 'police')) {
      G.state = 'busted';
    } else {
      G.state = 'dead';
    }
    G.audio.explosion();
  }
}

export function damageCar(G, car, amount, from) {
  if (!car || car.dead) return;
  car.hp -= amount;
  if (car.hp <= 0) {
    car.hp = 0;
    car.dead = true;
    car.deadAt = G.time;
    spawnParticles(G, car.x, car.y, { count: 26, color: '#ff7a2f', speed: 260, life: 0.8, size: 5 });
    spawnParticles(G, car.x, car.y, { count: 18, color: '#555', speed: 90, life: 1.4, size: 7 });
    G.audio.explosion();
    G.shake = 14;
    if (car.kind === 'police' && from === 'player') {
      // Blowing up a police car is a serious crime.
      addHeat(G, 30);
    }
    if (G.player.car === car) {
      // The player's ride just blew up under them.
      G.player.car = null;
      G.player.onFoot = true;
      G.player.x = car.x + 40;
      G.player.y = car.y;
      hurtPlayer(G, 15, 'explosion');
    }
  } else if (car.hp < 40) {
    car.smoking = true;
  }
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (!p.onFoot) return;
  // Health regen after a quiet spell.
  if (p.health > 0 && p.health < p.maxHealth && G.time - p.lastDamageAt > PLAYER.regenDelay) {
    p.health = Math.min(p.maxHealth, p.health + PLAYER.regenRate * dt);
  }
  // Movement.
  let mx = 0;
  let my = 0;
  if (input.held(KEYS.up)) my -= 1;
  if (input.held(KEYS.down)) my += 1;
  if (input.held(KEYS.left)) mx -= 1;
  if (input.held(KEYS.right)) mx += 1;
  const moving = mx !== 0 || my !== 0;
  p.moving = moving;
  p.running = moving && input.held(KEYS.run);
  const speed = p.running ? PLAYER.run : PLAYER.walk;
  if (moving) {
    const len = Math.hypot(mx, my);
    const vx = (mx / len) * speed;
    const vy = (my / len) * speed;
    p.x += vx * dt;
    p.y += vy * dt;
    p.speed = speed;
    // Face where we walk — unless we are aiming with the mouse.
    if (!input.mouse.down && p.weapon === 'fists') {
      p.angle = Math.atan2(vy, vx);
    }
  } else {
    p.speed = 0;
  }
  // Aim with the mouse whenever the pistol is out.
  if (p.weapon === 'pistol') {
    const m = G.screenToWorld(input.mouse.x, input.mouse.y);
    p.angle = angleTo(p.x, p.y, m.x, m.y);
  }
  // Keep out of buildings and inside the world.
  const r = resolveCircle(G.city, p.x, p.y, PLAYER.radius);
  p.x = clamp(r.x, 16, WORLD.size - 16);
  p.y = clamp(r.y, 16, WORLD.size - 16);
  // Punch.
  if (input.pressed('KeyF') && G.time - p.punchAt > PLAYER.punchCooldown) {
    p.punchAt = G.time;
    G.audio.punch();
    const reach = PLAYER.punchRange + 14;
    const targets = [...G.peds, ...G.cops];
    for (const t of targets) {
      if (t.state === 'dead' || t.hp <= 0) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d < reach && Math.abs(angleDiff(p.angle, angleTo(p.x, p.y, t.x, t.y))) < 1.1) {
        t.hp -= PLAYER.punchDamage;
        t.x += Math.cos(p.angle) * 14;
        t.y += Math.sin(p.angle) * 14;
        spawnParticles(G, t.x, t.y, { count: 5, color: '#ffd23e', speed: 120, life: 0.3, size: 3 });
        if (t.hp <= 0) {
          t.state = 'dead';
          t.stateAt = G.time;
          if (t.kind === 'cop') {
            addHeat(G, 40);
            dropPickup(G, t.x, t.y, 'cash', 60);
            G.events.push({ text: 'You took down a cop — the heat is on!', at: G.time });
          } else {
            addHeat(G, 22);
            dropPickup(G, t.x, t.y, 'cash', 25);
          }
        } else if (t.kind === 'ped') {
          t.state = 'flee';
          t.stateAt = G.time;
          t.fleeFrom = { x: p.x, y: p.y };
          addHeat(G, 12);
        }
        break;
      }
    }
  }
  // Shoot.
  if (p.weapon === 'pistol' && input.mouse.down && G.time - p.fireAt > PLAYER.fireCooldown) {
    p.fireAt = G.time;
    const m = G.screenToWorld(input.mouse.x, input.mouse.y);
    const a = angleTo(p.x, p.y, m.x, m.y);
    G.bullets.push({
      x: p.x + Math.cos(a) * 18,
      y: p.y + Math.sin(a) * 18,
      vx: Math.cos(a) * COMBAT.bulletSpeed,
      vy: Math.sin(a) * COMBAT.bulletSpeed,
      life: 0,
      maxLife: COMBAT.bulletRange / COMBAT.bulletSpeed,
      damage: COMBAT.bulletDamage,
      from: 'player',
    });
    G.audio.shot();
    // Firing a shot is noisy (1 heat): a sustained firefight must not max
    // the wanted level on its own — M5's kill step needs ~10–20 shots, and
    // at 2 heat/shot the gunfire alone summoned a 5-star foot-cop swarm that
    // killed the player mid-fight. The crimes (kills) carry the heat.
    addHeat(G, 1);
    scarePeds(G, p.x, p.y, 260);
    G.shake = Math.min(6, (G.shake || 0) + 1.5);
  }
  // Pick up cash / health on the ground.
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    if (dist2(p.x, p.y, pk.x, pk.y) < 30 * 30) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        p.cash += pk.amount;
        G.events.push({ text: `+$${pk.amount}`, at: G.time });
      } else {
        p.health = Math.min(p.maxHealth, p.health + 40);
        G.events.push({ text: '+40 health', at: G.time });
      }
      G.audio.pickup();
    }
  }
  G.pickups = G.pickups.filter((pk) => !pk.taken && G.time - pk.bornAt < 60);
}

// --- Wanted heat (kept here so entities and vehicles share it) ----------------

export function addHeat(G, amount) {
  const w = G.wanted;
  w.heat = clamp(w.heat + amount, 0, 100);
  w.quietAt = G.time;
  const stars = Math.min(5, Math.floor(w.heat / 20));
  if (stars > w.stars) {
    w.stars = stars;
    G.events.push({ text: `Wanted level ${stars} — the Solmar PD is on you!`, at: G.time });
  }
}
