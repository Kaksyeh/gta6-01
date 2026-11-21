// People: the player on foot, walking pedestrians, mission guards and
// foot police officers. Guards and officers stand their ground — only
// ordinary pedestrians flee from gunfire.
import { CFG } from './config.js';
import { moveCircle, clampToWorld, isOnRoad } from './city.js';
import { makeRng, clamp } from './random.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    angle: -Math.PI / 2,
    onFoot: true,
    car: null,
    health: CFG.player.health,
    cash: 0,
    hasPistol: false,
    weapon: 'fists',
    radius: CFG.player.radius,
    lastHurtAt: -99,
    punchCooldown: 0,
  };
}

export function hurtPlayer(G, amount, source) {
  const p = G.player;
  if (p.health <= 0) return;
  p.health -= amount;
  p.lastHurtAt = G.time;
  if (p.health <= 0) {
    p.health = 0;
    if (source === 'cop') {
      G.state = 'busted';
      G.audio.wasted();
    } else {
      G.state = 'dead';
      G.audio.wasted();
    }
  }
}

function randomRoadPoint(G, rng) {
  const spacing = CFG.world.roadSpacing;
  const lines = Math.floor(CFG.world.size / spacing);
  if (rng.next() < 0.5) {
    return { x: Math.floor(rng.next() * (lines + 1)) * spacing + rng.range(-16, 16), y: rng.range(40, CFG.world.size - 40) };
  }
  return { x: rng.range(40, CFG.world.size - 40), y: Math.floor(rng.next() * (lines + 1)) * spacing + rng.range(-16, 16) };
}

export function createPeds(G) {
  const rng = makeRng(CFG.world.seed + 31);
  const peds = [];
  for (let i = 0; i < 40; i++) {
    const pt = randomRoadPoint(G, rng);
    peds.push({
      kind: 'ped',
      state: 'walk',
      x: clamp(pt.x, 20, CFG.world.size - 20),
      y: clamp(pt.y, 20, CFG.world.size - 20),
      angle: rng.range(0, Math.PI * 2),
      speed: rng.range(45, 65),
      hp: CFG.ped.hp,
      target: randomRoadPoint(G, rng),
      color: ['#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'][i % 6],
      radius: 10,
      stuckAt: 0,
      lastX: 0,
      lastY: 0,
    });
  }
  return peds;
}

export function spawnGuard(G, x, y) {
  const guard = {
    kind: 'guard',
    state: 'walk',
    x,
    y,
    angle: Math.PI / 2,
    speed: CFG.combat.guardSpeed,
    hp: CFG.combat.guardHp,
    target: null,
    color: '#2c2c34',
    radius: 11,
    fireCooldown: 1,
    stuckAt: 0,
    lastX: x,
    lastY: y,
  };
  G.peds.push(guard);
  return guard;
}

export function spawnCop(G, x, y) {
  const cop = {
    kind: 'cop',
    state: 'chase',
    x,
    y,
    angle: 0,
    speed: 150,
    hp: 50,
    target: null,
    color: '#1f3a5f',
    radius: 11,
    punchCooldown: 0,
    stuckAt: 0,
    lastX: x,
    lastY: y,
  };
  G.peds.push(cop);
  return cop;
}

// A person dies: guards feed the mission kill count and drop cash.
export function damagePerson(G, person, dmg) {
  if (person.state === 'dead') return false;
  person.hp -= dmg;
  if (person.hp > 0) return false;
  person.hp = 0;
  person.state = 'dead';
  person.deadAt = G.time;
  if (person.kind === 'guard') {
    if (G.mission && G.mission.def.id === 4 && G.mission.step === 1) {
      G.mission.kills++;
      G.player.cash += CFG.combat.guardCashDrop;
      G.addHeat(CFG.wanted.guardKillHeat);
    }
  }
  return true;
}

export function scarePeds(G, x, y, radius) {
  for (const p of G.peds) {
    if (p.kind !== 'ped' || p.state === 'dead') continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < radius) {
      p.state = 'flee';
      p.fleeUntil = G.time + 2;
      const away = Math.atan2(p.y - y, p.x - x);
      p.target = { x: p.x + Math.cos(away) * 220, y: p.y + Math.sin(away) * 220 };
      p.speed = CFG.ped.scareSpeed;
    }
  }
}

function movePerson(G, p, dt) {
  if (!p.target) return;
  const dx = p.target.x - p.x;
  const dy = p.target.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 12) {
    p.target = null;
    return;
  }
  const step = (p.speed * dt) / d;
  const moved = moveCircle(G.city, p.x, p.y, dx * step, dy * step, p.radius);
  p.x = moved.x;
  p.y = moved.y;
  if (dx * step !== 0 || dy * step !== 0) {
    p.angle = Math.atan2(dy, dx);
  }
  // Stuck against a wall: pick a new destination.
  if (Math.hypot(p.x - p.lastX, p.y - p.lastY) < 1 && d > 30) {
    p.stuckAt += dt;
    if (p.stuckAt > 2) {
      p.target = null;
      p.stuckAt = 0;
    }
  } else {
    p.stuckAt = 0;
  }
  p.lastX = p.x;
  p.lastY = p.y;
}

function updateWalker(G, p, dt, rng) {
  if (p.state === 'flee' && G.time > p.fleeUntil) {
    p.state = 'walk';
    p.speed = 55;
    p.target = null;
  }
  if (!p.target) {
    p.target = randomRoadPoint(G, rng);
  }
  movePerson(G, p, dt);
}

function updateGuard(G, g, dt) {
  const pl = G.player;
  const d = Math.hypot(pl.x - g.x, pl.y - g.y);
  // Guards stand their ground and fight: they close in slowly and shoot.
  if (d < 350 && d > 60) {
    g.target = { x: pl.x, y: pl.y };
    movePerson(G, g, dt);
  } else if (d <= 60) {
    g.target = null;
  }
  g.angle = Math.atan2(pl.y - g.y, pl.x - g.x);
  g.fireCooldown -= dt;
  if (g.fireCooldown <= 0 && d < CFG.combat.guardRange && pl.health > 0) {
    g.fireCooldown = CFG.combat.guardFireInterval + Math.random() * 0.5;
    G.fireEnemyBullet(g);
    G.audio.enemyShot();
  }
}

function updateCop(G, c, dt) {
  const pl = G.player;
  const d = Math.hypot(pl.x - c.x, pl.y - c.y);
  if (!pl.onFoot) {
    // Foot officers hold their ground while the player drives.
    return;
  }
  if (d < 500) {
    c.target = { x: pl.x, y: pl.y };
    movePerson(G, c, dt);
    c.punchCooldown -= dt;
    if (d < 28 && c.punchCooldown <= 0) {
      c.punchCooldown = 0.9;
      hurtPlayer(G, 5, 'cop');
      G.audio.punch();
    }
  } else {
    c.target = null;
  }
}

export function updatePeds(G, dt) {
  const rng = G.rng;
  let walkers = 0;
  for (const p of G.peds) {
    if (p.state === 'dead') continue;
    if (p.kind === 'ped') {
      walkers++;
      updateWalker(G, p, dt, rng);
    } else if (p.kind === 'guard') {
      updateGuard(G, p, dt);
    } else if (p.kind === 'cop') {
      updateCop(G, p, dt);
    }
  }
  // Clear old bodies and keep the streets populated with walkers.
  const now = G.time;
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const p = G.peds[i];
    if (p.state === 'dead' && now - p.deadAt > 8) {
      G.peds.splice(i, 1);
    }
  }
  if (walkers < 40 && G.state === 'playing') {
    const pt = randomRoadPoint(G, rng);
    if (Math.hypot(pt.x - G.player.x, pt.y - G.player.y) > 400) {
      const ped = {
        kind: 'ped',
        state: 'walk',
        x: pt.x,
        y: pt.y,
        angle: 0,
        speed: rng.range(45, 65),
        hp: CFG.ped.hp,
        target: randomRoadPoint(G, rng),
        color: '#3498db',
        radius: 10,
        stuckAt: 0,
        lastX: pt.x,
        lastY: pt.y,
      };
      G.peds.push(ped);
    }
  }
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (!p.onFoot) return;
  p.punchCooldown -= dt;

  // Movement with the W, A, S, D keys.
  let mx = 0;
  let my = 0;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) my -= 1;
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) my += 1;
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mx -= 1;
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) mx += 1;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    const step = (CFG.player.walkSpeed * dt) / len;
    const moved = moveCircle(G.city, p.x, p.y, mx * step, my * step, p.radius);
    p.x = moved.x;
    p.y = moved.y;
    if (!p.hasPistol) {
      p.angle = Math.atan2(my, mx);
    }
  }
  // With a pistol, the player aims with the mouse.
  if (p.hasPistol) {
    const wx = (input.mouseX - G.viewW / 2) / G.camera.zoom + G.camera.x;
    const wy = (input.mouseY - G.viewH / 2) / G.camera.zoom + G.camera.y;
    p.angle = Math.atan2(wy - p.y, wx - p.x);
  }
  const clamped = clampToWorld(p.x, p.y, CFG.player.radius + 4);
  p.x = clamped.x;
  p.y = clamped.y;

  // Health regenerates after a quiet spell.
  if (G.time - p.lastHurtAt > CFG.player.regenDelay && p.health > 0 && p.health < CFG.player.health) {
    p.health = Math.min(CFG.player.health, p.health + CFG.player.regenRate * dt);
  }

  // Punch with F: nearest person inside range and the facing arc.
  if (input.wasPressed('KeyF') && p.punchCooldown <= 0) {
    p.punchCooldown = 0.45;
    let best = null;
    let bestD = CFG.player.punchRange;
    for (const person of G.peds) {
      if (person.state === 'dead') continue;
      const d = Math.hypot(person.x - p.x, person.y - p.y);
      if (d > bestD) continue;
      const ang = Math.atan2(person.y - p.y, person.x - p.x);
      let diff = ang - p.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > CFG.player.punchArc) continue;
      best = person;
      bestD = d;
    }
    if (best) {
      G.audio.punch();
      damagePerson(G, best, CFG.player.punchDamage);
      if (best.kind === 'ped') G.addHeat(CFG.player.punchHeat);
      else if (best.kind === 'cop') G.addHeat(20);
      else if (best.kind === 'guard') G.addHeat(CFG.wanted.guardKillHeat);
      scarePeds(G, p.x, p.y, 200);
    }
  }
}
