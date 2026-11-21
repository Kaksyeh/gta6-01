// Rendering: the top-down city, the HUD with health, cash, stars and the
// minimap, and every screen from the title to the story's end. Everything
// is drawn with plain canvas shapes — no image files, no network.
import { CFG } from './config.js';

function drawWorld(G, ctx) {
  const cam = G.camera;
  const vw = G.viewW;
  const vh = G.viewH;
  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const size = CFG.world.size;
  // Water around the island, then the land, then the beach band.
  ctx.fillStyle = '#1e6fa8';
  ctx.fillRect(cam.x - vw / cam.zoom, cam.y - vh / cam.zoom, (vw / cam.zoom) * 2, (vh / cam.zoom) * 2);
  ctx.fillStyle = '#3f6b3a';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#d9c27a';
  ctx.fillRect(0, CFG.world.beachY, size, size - CFG.world.beachY);

  // Roads on the 320-pixel grid.
  ctx.fillStyle = '#33363b';
  const spacing = CFG.world.roadSpacing;
  const halfRoad = CFG.world.roadWidth / 2;
  for (let i = 0; i <= 10; i++) {
    const c = i * spacing;
    ctx.fillRect(0, c - halfRoad, size, CFG.world.roadWidth);
    ctx.fillRect(c - halfRoad, 0, CFG.world.roadWidth, size);
  }
  // Road centre dashes.
  ctx.strokeStyle = '#8a8f96';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const c = i * spacing;
    ctx.moveTo(0, c);
    ctx.lineTo(size, c);
    ctx.moveTo(c, 0);
    ctx.lineTo(c, size);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Park blocks get a few trees.
  ctx.fillStyle = '#2d5a2a';
  const parks = [[1, 1], [7, 3], [3, 6], [8, 7]];
  for (const [bx, by] of parks) {
    const x0 = bx * spacing + halfRoad;
    const y0 = by * spacing + halfRoad;
    for (let i = 0; i < 8; i++) {
      const tx = x0 + ((i * 53) % 220);
      const ty = y0 + ((i * 91) % 220);
      ctx.beginPath();
      ctx.arc(tx, ty, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Buildings are stored top-left, the same as their collision rects.
  for (const b of G.city.buildings) {
    ctx.fillStyle = b.landmark ? '#4a3f35' : '#555b66';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof || '#6e7683';
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
  }
  // Landmark labels.
  ctx.fillStyle = '#e8e4d8';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const L = G.city.landmarks;
  ctx.fillText('SOLMAR PD HQ', L.pdhq.x, L.pdhq.y - 90);
  ctx.fillText('HOSPITAL', L.hospital.x, L.hospital.y - 90);
  ctx.fillText('TOWER', L.tower.x, L.tower.y - 85);
  ctx.fillText('DOCKS', L.docks.x, L.docks.y - 16);
  ctx.fillText('MARINA', L.marina.x, L.marina.y - 16);
  ctx.fillText('GARAGE', L.garage.x, L.garage.y - 16);

  // Mission target: a diamond and a beam of light.
  const target = G._missionTarget();
  if (target && G.state === 'playing') {
    const bob = Math.sin(G.time * 3) * 4;
    const grad = ctx.createLinearGradient(target.x, target.y - 220, target.x, target.y);
    grad.addColorStop(0, 'rgba(255, 215, 0, 0)');
    grad.addColorStop(1, 'rgba(255, 215, 0, 0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(target.x - 14, target.y - 220, 28, 220);
    ctx.save();
    ctx.translate(target.x, target.y + bob);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(-12, -12, 24, 24);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(-12, -12, 24, 24);
    ctx.restore();
  }

  // Pedestrians, guards and officers.
  for (const p of G.peds) {
    if (p.state === 'dead') {
      ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    if (p.kind === 'guard') {
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.kind === 'cop') {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Bullets.
  for (const b of G.bullets) {
    ctx.strokeStyle = b.from === 'player' ? '#ffe066' : '#ff8866';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }

  // Cars.
  for (const car of G.cars) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    if (car.dead) {
      ctx.fillStyle = '#222';
    } else {
      ctx.fillStyle = car.color;
    }
    const l = car.length;
    const w = car.width;
    ctx.beginPath();
    ctx.roundRect(-l / 2, -w / 2, l, w, 6);
    ctx.fill();
    if (!car.dead) {
      ctx.fillStyle = 'rgba(20, 30, 40, 0.75)';
      ctx.fillRect(-l * 0.12, -w / 2 + 3, l * 0.28, w - 6);
      if (car.type === 'police') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-4, -w / 2 + 2, 8, 5);
        ctx.fillStyle = '#ff2222';
        ctx.fillRect(-4, w / 2 - 7, 8, 5);
      }
    }
    ctx.restore();
    // Health bar over a damaged car.
    if (!car.dead && car.hp < car.maxHp) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(car.x - 20, car.y - 26, 40, 5);
      ctx.fillStyle = car.hp > car.maxHp * 0.4 ? '#2ecc71' : '#e74c3c';
      ctx.fillRect(car.x - 20, car.y - 26, 40 * (car.hp / car.maxHp), 5);
    }
    // The player's car gets a white outline.
    if (car === G.player.car && !car.dead) {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-car.length / 2 - 3, -car.width / 2 - 3, car.length + 6, car.width + 6, 8);
      ctx.stroke();
      ctx.restore();
    }
  }

  // The player on foot.
  const p = G.player;
  if (p.onFoot && p.health > 0) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#f5f0e6';
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(6, -3, 12, 6);
    ctx.restore();
  }
  ctx.restore();
}

function drawStars(G, ctx, x, y) {
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  let s = '';
  for (let i = 0; i < 5; i++) s += i < G.wanted.stars ? '★' : '☆';
  ctx.fillStyle = G.wanted.stars > 0 ? '#ffd700' : 'rgba(255,255,255,0.45)';
  ctx.fillText(s, x, y);
}

function drawHUD(G, ctx) {
  const vw = G.viewW;
  const vh = G.viewH;
  // Top-left chip: health, weapon, cash, stars.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.roundRect(12, 12, 300, 108, 10);
  ctx.fill();
  const p = G.player;
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(24, 28, 180, 12);
  ctx.fillStyle = p.health > 40 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(24, 28, 180 * (p.health / 100), 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.ceil(p.health)} HP`, 212, 40);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText(p.hasPistol ? 'PISTOL — mouse to aim, hold click to fire' : 'FISTS — [F] punch', 24, 64);
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 24, 90);
  drawStars(G, ctx, 24, 112);

  // Objective, top-right.
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'right';
  const obj = G._objectiveText();
  const w = ctx.measureText(obj).width + 24;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.roundRect(vw - 12 - w, 12, w, 36, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd700';
  ctx.fillText(obj, vw - 24, 36);

  // Minimap, bottom-left, with the SOLMAR label inside its top-left.
  const mm = 160;
  const mx = 12;
  const my = vh - mm - 12;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(mx, my, mm, mm, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR', mx + 6, my + 14);
  const sc = mm / CFG.world.size;
  ctx.fillStyle = '#3f6b3a';
  ctx.fillRect(mx, my + 18, mm, mm - 18);
  ctx.fillStyle = '#d9c27a';
  ctx.fillRect(mx, my + 18 + (CFG.world.beachY * sc), mm, (CFG.world.size - CFG.world.beachY) * sc);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (const b of G.city.buildings) {
    ctx.fillRect(mx + b.x * sc - 1, my + b.y * sc - 1, 2, 2);
  }
  const target = G._missionTarget();
  if (target && G.state === 'playing') {
    ctx.fillStyle = '#ffd700';
    ctx.save();
    ctx.translate(mx + target.x * sc, my + target.y * sc);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  for (const car of G.cars) {
    if (car.dead) continue;
    ctx.fillStyle = car.type === 'police' ? '#ff4444' : '#7fb3ff';
    ctx.fillRect(mx + car.x * sc - 1, my + car.y * sc - 1, 2, 2);
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(mx + p.x * sc, my + p.y * sc, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Controls hint, bottom-right.
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('WASD move/drive · E enter/exit car · F punch · P pause', vw - 16, vh - 16);

  // Dialogue, bottom-centre.
  if (G.dialogue && G.dialogue.lines.length > 0) {
    const line = G.dialogue.lines[G.dialogue.idx];
    if (line) {
      ctx.font = '16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(line).width + 32;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.beginPath();
      ctx.roundRect(vw / 2 - tw / 2, vh - 64, tw, 34, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(line, vw / 2, vh - 41);
    }
  }
}

function panel(G, ctx, title, lines, foot) {
  const vw = G.viewW;
  const vh = G.viewH;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.fillStyle = 'rgba(10, 12, 16, 0.92)';
  const w = 520;
  const h = 120 + lines.length * 30 + (foot ? 46 : 0);
  ctx.beginPath();
  ctx.roundRect(vw / 2 - w / 2, vh / 2 - h / 2, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, vw / 2, vh / 2 - h / 2 + 56);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, vw / 2, vh / 2 - h / 2 + 96 + i * 30);
  });
  if (foot) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(foot, vw / 2, vh / 2 + h / 2 - 24);
  }
}

function drawTitle(G, ctx) {
  const vw = G.viewW;
  const vh = G.viewH;
  // The city behind the title, dimmed.
  drawWorld(G, ctx);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('SOLMAR', vw / 2, vh / 2 - 120);
  ctx.fillStyle = '#fff';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText('Streets of the Sun', vw / 2, vh / 2 - 78);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('An original open-world crime game. No Rockstar content.', vw / 2, vh / 2 - 46);
  const items = G._titleItems();
  items.forEach((item, i) => {
    const y = vh / 2 + 10 + i * 44;
    if (i === G.titleIndex) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText(`▶ ${item}`, vw / 2, y);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillText(item, vw / 2, y);
    }
  });
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('WASD move · E car · F punch · mouse aim · P pause', vw / 2, vh - 28);
}

function drawHowTo(G, ctx) {
  const vw = G.viewW;
  const vh = G.viewH;
  drawWorld(G, ctx);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 36px system-ui, sans-serif';
  ctx.fillText('HOW TO PLAY', vw / 2, 110);
  const lines = [
    'Milo Reyes is back in Solmar. His brother owes Vera Castellanos, La Reina, five thousand dollars.',
    'Work through five story missions: steal cars, survive the heat, deliver, and settle the debt.',
    '',
    'WASD / arrows — walk and drive',
    'E — steal a parked car / get out',
    'F — punch (on foot)',
    'Mouse — aim the pistol · hold click to fire (after Hot Wheels)',
    'P — pause · M — mute',
    '',
    'Heat brings the police: cars chase your ride, officers chase you on foot.',
    'Get WASTED and you wake at the hospital, one hundred dollars lighter.',
    'Progress saves automatically after every mission.',
  ];
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, vw / 2, 160 + i * 30);
  });
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText('Press Enter to go back', vw / 2, vh - 40);
}

export function render(G) {
  const ctx = G.ctx;
  ctx.clearRect(0, 0, G.viewW, G.viewH);
  if (G.state === 'title') {
    drawTitle(G, ctx);
    return;
  }
  if (G.state === 'howto') {
    drawHowTo(G, ctx);
    return;
  }
  drawWorld(G, ctx);
  drawHUD(G, ctx);
  if (G.state === 'paused') {
    panel(G, ctx, 'PAUSED', ['WASD move · E car · F punch · mouse aim', 'Missions save automatically.'], 'Press P to resume');
  } else if (G.state === 'missionComplete') {
    const m = G.mission;
    panel(G, ctx, 'MISSION COMPLETE', [m.def.name, `Reward: $${m.def.reward.toLocaleString('en-US')}`, m.def.outro], 'Press Enter to continue');
  } else if (G.state === 'storyComplete') {
    panel(G, ctx, 'THE DEBT IS PAID', ['All five missions complete.', `Final cash: $${G.player.cash.toLocaleString('en-US')}`, 'Solmar is yours again, Milo Reyes.'], 'Press Enter for free roam');
  } else if (G.state === 'dead') {
    panel(G, ctx, 'WASTED', ['You wake up at the hospital.', 'You lost $100. The mission restarts.'], 'Press Enter to continue');
  } else if (G.state === 'busted') {
    panel(G, ctx, 'BUSTED', ['The police hauled you in.', 'You lost $100. The mission restarts.'], 'Press Enter to continue');
  }
}
