// SOLMAR — combat.js: bullets and the guards who shoot back. Bullets fly straight,
// die on buildings, and hurt cars, pedestrians, cops and guards. Guards (mission 5)
// stand their ground and fire at the player with deliberately imperfect aim.

import { COMBAT } from './config.js';
import { hitsBuilding } from './city.js';
import { damageCar, addHeat, spawnParticles, dropPickup } from './entities.js';

function bulletHitsCircle(b, x, y, r) {
  const dx = b.x - x;
  const dy = b.y - y;
  return dx * dx + dy * dy < r * r;
}

export function updateBullets(G, dt) {
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life += dt;
    if (b.life >= b.maxLife) {
      b.dead = true;
      continue;
    }
    if (hitsBuilding(G.city, b.x, b.y, 2)) {
      spawnParticles(G, b.x, b.y, { count: 3, color: '#ffd23e', speed: 120, life: 0.25, size: 2 });
      b.dead = true;
      continue;
    }
    // Cars.
    let hit = false;
    for (const car of G.cars) {
      if (car.dead) continue;
      if (bulletHitsCircle(b, car.x, car.y, 26)) {
        damageCar(G, car, b.damage, b.from);
        if (b.from === 'player' && car.kind === 'police') addHeat(G, 6);
        spawnParticles(G, b.x, b.y, { count: 4, color: '#ffd23e', speed: 130, life: 0.3, size: 2 });
        hit = true;
        break;
      }
    }
    if (hit) {
      b.dead = true;
      continue;
    }
    // People: pedestrians, cops and guards.
    const people = [...G.peds, ...G.cops];
    for (const t of people) {
      if (t.state === 'dead' || t.hp <= 0) continue;
      if (bulletHitsCircle(b, t.x, t.y, 12)) {
        t.hp -= b.damage;
        spawnParticles(G, t.x, t.y, { count: 5, color: '#c94f43', speed: 110, life: 0.4, size: 3 });
        if (t.hp <= 0) {
          t.state = 'dead';
          t.stateAt = G.time;
          if (b.from === 'player') {
            if (t.kind === 'cop') {
              addHeat(G, 40);
              dropPickup(G, t.x, t.y, 'cash', 60);
            } else if (t.kind === 'guard') {
              // Guard kills are the mission objective (M5) — they add only a
              // little heat, so the shootout stays a duel with the guards
              // instead of summoning a foot-cop swarm mid-fight. The escape
              // step adds the big heat (80) for the chase.
              addHeat(G, 5);
              dropPickup(G, t.x, t.y, 'cash', 80);
              if (G.mission) G.mission.kills = (G.mission.kills || 0) + 1;
            } else {
              addHeat(G, 22);
              dropPickup(G, t.x, t.y, 'cash', 25);
            }
          }
        } else if (t.kind === 'ped') {
          t.state = 'flee';
          t.stateAt = G.time;
          t.fleeFrom = { x: b.x - b.vx * 0.05, y: b.y - b.vy * 0.05 };
        }
        b.dead = true;
        break;
      }
    }
    if (b.dead) continue;
    // The player, when the bullet is not theirs.
    if (b.from !== 'player' && G.player.onFoot) {
      const p = G.player;
      if (bulletHitsCircle(b, p.x, p.y, 13)) {
        // hurtPlayer lives in entities.js; import it lazily to avoid a cycle.
        G._hurtPlayer(b.damage, b.from === 'guard' ? 'guard' : 'cop');
        spawnParticles(G, p.x, p.y, { count: 4, color: '#e5534b', speed: 100, life: 0.3, size: 3 });
        b.dead = true;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => !b.dead);
}

// Guards hold a position and shoot at the player when close enough.
export function updateGuards(G, dt) {
  const p = G.player;
  for (const g of G.peds) {
    if (g.kind !== 'guard' || g.state === 'dead' || g.hp <= 0) continue;
    const tx = p.onFoot ? p.x : p.car ? p.car.x : p.x;
    const ty = p.onFoot ? p.y : p.car ? p.car.y : p.y;
    const d = Math.hypot(tx - g.x, ty - g.y);
    if (d > 460) continue;
    const want = Math.atan2(ty - g.y, tx - g.x);
    g.angle = want;
    if (G.time - g.shootAt > 1.15) {
      g.shootAt = G.time;
      const spread = (Math.random() - 0.5) * 0.22;
      const a = want + spread;
      G.bullets.push({
        x: g.x + Math.cos(a) * 18,
        y: g.y + Math.sin(a) * 18,
        vx: Math.cos(a) * 780,
        vy: Math.sin(a) * 780,
        life: 0,
        maxLife: 0.6,
        damage: 9,
        from: 'guard',
      });
      G.audio.enemyShot();
      spawnParticles(G, g.x + Math.cos(a) * 20, g.y + Math.sin(a) * 20, { count: 2, color: '#ffd23e', speed: 90, life: 0.2, size: 2 });
    }
  }
}
