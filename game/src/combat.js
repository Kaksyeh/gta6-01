// Combat: the pistol, bullets, and guard fire. Bullets die on walls, so
// a shot needs a clear line. Guards shoot back and can hit each other.
import { CFG } from './config.js';
import { circleHitsBuilding } from './city.js';
import { damagePerson, scarePeds } from './entities.js';

export function firePlayerBullet(G) {
  const p = G.player;
  const bx = p.x + Math.cos(p.angle) * 22;
  const by = p.y + Math.sin(p.angle) * 22;
  G.bullets.push({
    x: bx,
    y: by,
    vx: Math.cos(p.angle) * CFG.combat.bulletSpeed,
    vy: Math.sin(p.angle) * CFG.combat.bulletSpeed,
    from: 'player',
    damage: CFG.combat.pistolDamage,
    life: 2,
  });
  G.addHeat(CFG.wanted.shotHeat);
  scarePeds(G, p.x, p.y, CFG.ped.scareRadius);
  G.audio.shot();
}

export function fireEnemyBullet(G, guard) {
  const p = G.player;
  const base = Math.atan2(p.y - guard.y, p.x - guard.x);
  const spread = (Math.random() - 0.5) * 0.14;
  const ang = base + spread;
  G.bullets.push({
    x: guard.x + Math.cos(ang) * 18,
    y: guard.y + Math.sin(ang) * 18,
    vx: Math.cos(ang) * 500,
    vy: Math.sin(ang) * 500,
    from: 'guard',
    damage: CFG.combat.guardDamage,
    life: 2,
  });
}

function updateBullets(G, dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && (b.x < 0 || b.y < 0 || b.x > CFG.world.size || b.y > CFG.world.size)) dead = true;
    if (!dead && circleHitsBuilding(G.city, b.x, b.y, 2)) dead = true;
    if (!dead && b.from === 'player') {
      for (const person of G.peds) {
        if (person.state === 'dead') continue;
        if (Math.hypot(person.x - b.x, person.y - b.y) < person.radius + 4) {
          damagePerson(G, person, b.damage);
          dead = true;
          break;
        }
      }
    }
    if (!dead && b.from === 'guard') {
      const p = G.player;
      if (p.health > 0 && Math.hypot(p.x - b.x, p.y - b.y) < p.radius + 4) {
        G.hurtPlayer(b.damage, 'guard');
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

export function updateCombat(G, dt) {
  G.fireCooldown -= dt;
  const p = G.player;
  if (G.state !== 'playing' || !p.onFoot || !p.hasPistol) {
    updateBullets(G, dt);
    return;
  }
  if (G.input.mouseDown && G.fireCooldown <= 0) {
    G.fireCooldown = CFG.combat.fireInterval;
    firePlayerBullet(G);
  }
  updateBullets(G, dt);
}
