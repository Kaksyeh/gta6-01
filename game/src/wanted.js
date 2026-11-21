// The wanted level: heat from 0 to 100, shown as 0 to 5 stars. Heat
// decays only after a quiet spell, and the police answer in proportion:
// cars chase the player's ride, foot officers chase the player on foot.
import { CFG } from './config.js';
import { spawnPoliceCar } from './vehicles.js';
import { spawnCop } from './entities.js';

export function createWanted() {
  return {
    heat: 0,
    stars: 0,
    quietFor: 99,
    sirenAt: 0,
  };
}

export function addHeat(G, amount) {
  const w = G.wanted;
  w.heat = Math.min(CFG.wanted.max, w.heat + amount);
  w.quietFor = 0;
  w.stars = Math.min(5, Math.floor(w.heat / CFG.wanted.perStar));
}

export function setHeat(G, value) {
  const w = G.wanted;
  w.heat = Math.max(0, Math.min(CFG.wanted.max, value));
  w.quietFor = 0;
  w.stars = Math.min(5, Math.floor(w.heat / CFG.wanted.perStar));
}

function policeCarCount(G) {
  let n = 0;
  for (const c of G.cars) if (c.kind === 'police' && !c.dead) n++;
  return n;
}

function footCopCount(G) {
  let n = 0;
  for (const p of G.peds) if (p.kind === 'cop' && p.state !== 'dead') n++;
  return n;
}

export function updateWanted(G, dt) {
  const w = G.wanted;
  w.quietFor += dt;

  // Decay: after a quiet spell, one star fades every few seconds. During
  // the Heat Wave survive step the heat is locked at five stars.
  const surviveLock = G.mission && G.mission.def.id === 2 && G.mission.step === 0;
  if (!surviveLock && w.quietFor > CFG.wanted.decayQuiet && w.heat > 0) {
    w.heat = Math.max(0, w.heat - (CFG.wanted.perStar / CFG.wanted.decayPerStar) * dt);
    w.stars = Math.min(5, Math.floor(w.heat / CFG.wanted.perStar));
  }

  if (w.stars > 0 && G.time - w.sirenAt > 6) {
    w.sirenAt = G.time;
    G.audio.siren();
  }

  // Police cars: one per star, up to five.
  const wantCars = Math.min(w.stars, CFG.wanted.maxPoliceCars);
  const haveCars = policeCarCount(G);
  if (haveCars < wantCars) {
    const a = G.rng.range(0, Math.PI * 2);
    const x = G.player.x + Math.cos(a) * CFG.police.spawnDistance;
    const y = G.player.y + Math.sin(a) * CFG.police.spawnDistance;
    const clamped = {
      x: Math.max(40, Math.min(CFG.world.size - 40, x)),
      y: Math.max(40, Math.min(CFG.world.size - 40, y)),
    };
    spawnPoliceCar(G, clamped.x, clamped.y);
  }

  // Foot officers: only at two stars or more, only while the player walks.
  const wantCops = w.stars >= CFG.wanted.footCopMinStars
    ? Math.min(w.stars - 1, CFG.wanted.maxFootCops)
    : 0;
  const haveCops = footCopCount(G);
  if (haveCops < wantCops && G.player.onFoot) {
    const a = G.rng.range(0, Math.PI * 2);
    const x = G.player.x + Math.cos(a) * 260;
    const y = G.player.y + Math.sin(a) * 260;
    spawnCop(G, x, y);
  }
  // Officers hold their ground while the player drives and leave when the
  // player is far away; they also stand down when the heat clears.
  for (const p of G.peds) {
    if (p.kind !== 'cop' || p.state === 'dead') continue;
    const d = Math.hypot(p.x - G.player.x, p.y - G.player.y);
    if ((!G.player.onFoot && d > 900) || w.stars === 0) {
      p.state = 'dead';
      p.deadAt = G.time - 9; // swept up on the next pass
    }
  }
}
