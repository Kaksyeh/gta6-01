// SOLMAR — render.js: everything the player sees. The sun-soaked city (roads, roofs,
// parks, beach), cars, people, particles, and the HUD: objective, wanted stars, cash,
// health, weapon, speed, and a live minimap. Menus are drawn here too.

import { WORLD, PALETTE, FONT, CAR_TYPES } from './config.js';
import { clamp, lerp } from './random.js';

// --- helpers ------------------------------------------------------------------

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  if (fill) ctx.fill();
  else ctx.stroke();
}

// --- world ----------------------------------------------------------------------

function drawGround(ctx, G, view) {
  const { size, beach } = WORLD;
  // Water everywhere outside the land.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(view.x - 60, view.y - 60, view.w + 120, view.h + 120);
  // Land base: sidewalk tone.
  ctx.fillStyle = PALETTE.sidewalk;
  ctx.fillRect(0, 0, size, beach);
  // Beach.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, beach, size, size - beach);
  // Parks.
  for (const pk of G.city.parks) {
    if (!inView(view, pk.x, pk.y, pk.w, pk.h)) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  }
  // Roads: dark strips on both axes.
  ctx.fillStyle = PALETTE.road;
  for (let x = 0; x <= size; x += 320) {
    ctx.fillRect(x - 32, 0, 64, beach);
  }
  for (let y = 0; y <= beach; y += 320) {
    ctx.fillRect(0, y - 32, size, 64);
  }
  // Road edges.
  ctx.strokeStyle = PALETTE.roadEdge;
  ctx.lineWidth = 2;
  for (let x = 0; x <= size; x += 320) {
    ctx.beginPath();
    ctx.moveTo(x - 32, 0);
    ctx.lineTo(x - 32, beach);
    ctx.moveTo(x + 32, 0);
    ctx.lineTo(x + 32, beach);
    ctx.stroke();
  }
  for (let y = 0; y <= beach; y += 320) {
    ctx.beginPath();
    ctx.moveTo(0, y - 32);
    ctx.lineTo(size, y - 32);
    ctx.moveTo(0, y + 32);
    ctx.lineTo(size, y + 32);
    ctx.stroke();
  }
  // Lane dashes and crosswalks.
  ctx.fillStyle = PALETTE.lane;
  for (let x = 0; x <= size; x += 320) {
    for (let y = 40; y < beach; y += 80) {
      if (((y / 80) | 0) % 2 === 0) ctx.fillRect(x - 2, y, 4, 34);
    }
  }
  for (let y = 0; y <= beach; y += 320) {
    for (let x = 40; x < size; x += 80) {
      if (((x / 80) | 0) % 2 === 0) ctx.fillRect(x, y - 2, 34, 4);
    }
  }
  ctx.fillStyle = PALETTE.crosswalk;
  for (let x = 0; x <= size; x += 320) {
    for (let y = 0; y <= beach; y += 320) {
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(x + i * 9 - 3, y - 30, 6, 12);
        ctx.fillRect(x + i * 9 - 3, y + 18, 6, 12);
        ctx.fillRect(x - 30, y + i * 9 - 3, 12, 6);
        ctx.fillRect(x + 18, y + i * 9 - 3, 12, 6);
      }
    }
  }
  // Water shimmer lines along the beach.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const y = beach + 24 + i * 22;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + Math.sin(G.time * 0.7 + i) * 6);
    ctx.stroke();
  }
}

function inView(view, x, y, w, h) {
  return x + w > view.x - 40 && x < view.x + view.w + 40 && y + h > view.y - 40 && y < view.y + view.h + 40;
}

function drawBuildings(ctx, G, view) {
  for (const b of G.city.buildings) {
    if (!inView(view, b.x, b.y, b.w, b.h)) continue;
    // Long golden-hour shadow to the north-east.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + b.height * 0.5, b.y - b.height * 0.5, b.w, b.h);
    // Roof.
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    // Roof details: AC units and skylights, seeded per building.
    const s = b.seed;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    const n = 2 + (s % 3);
    for (let i = 0; i < n; i++) {
      const ux = b.x + 10 + ((s >> (i * 3)) % Math.max(1, Math.floor(b.w - 30)));
      const uy = b.y + 10 + ((s >> (i * 5 + 1)) % Math.max(1, Math.floor(b.h - 30)));
      ctx.fillRect(ux, uy, 14, 10);
    }
    // Landmark names on the roof.
    if (b.name) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `bold ${Math.max(11, Math.min(15, b.w / 11))}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y + b.h / 2, b.w - 8);
    }
  }
  // Trees.
  for (const t of G.city.trees) {
    if (!inView(view, t.x - 14, t.y - 14, 28, 28)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(t.x + 5, t.y + 6, t.r, t.r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.treeDark;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(t.x - 2, t.y - 2, t.r * 0.65, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCar(ctx, car, time) {
  const t = CAR_TYPES[car.type];
  const L = t.length;
  const Wd = t.width;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, -L / 2 + 4, -Wd / 2 + 5, L, Wd, 8);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#14161a';
  const wy = Wd / 2 - 2;
  ctx.fillRect(-L / 2 + 6, -wy - 4, 12, 6);
  ctx.fillRect(L / 2 - 18, -wy - 4, 12, 6);
  ctx.fillRect(-L / 2 + 6, wy - 2, 12, 6);
  ctx.fillRect(L / 2 - 18, wy - 2, 12, 6);
  // Body.
  ctx.fillStyle = car.dead ? '#3a3a3a' : car.color;
  rr(ctx, -L / 2, -Wd / 2, L, Wd, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  rr(ctx, -L / 2, -Wd / 2, L, Wd, 9);
  ctx.stroke();
  // Windshield + rear window.
  ctx.fillStyle = 'rgba(20,28,38,0.85)';
  rr(ctx, L / 2 - 20, -Wd / 2 + 5, 12, Wd - 10, 3);
  ctx.fill();
  rr(ctx, -L / 2 + 8, -Wd / 2 + 5, 10, Wd - 10, 3);
  ctx.fill();
  // Roof.
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  rr(ctx, -L / 2 + 20, -Wd / 2 + 4, L - 44, Wd - 8, 5);
  ctx.fill();
  // Type dressing.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#20242c';
    for (let i = 0; i < 6; i++) ctx.fillRect(-L / 2 + 16 + i * 6, -2, 3, 4);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 8px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -Wd / 2 + 8);
  }
  if (car.type === 'sport') {
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-L / 2 - 2, -Wd / 2 + 2, 5, Wd - 4); // spoiler
  }
  if (car.kind === 'police') {
    ctx.fillStyle = PALETTE.policeWhite;
    ctx.fillRect(-8, -Wd / 2, 16, Wd);
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 8px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, -Wd / 2 + 8);
    // Flashing light bar.
    const on = Math.floor(time * 3) % 2 === 0;
    ctx.fillStyle = on ? '#ff2e2e' : '#2e6bff';
    ctx.fillRect(-4, -Wd / 2 - 3, 8, 4);
    ctx.fillStyle = on ? '#2e6bff' : '#ff2e2e';
    ctx.fillRect(-4, Wd / 2 - 1, 8, 4);
  }
  // Headlights.
  ctx.fillStyle = 'rgba(255,244,180,0.9)';
  ctx.fillRect(L / 2 - 2, -Wd / 2 + 5, 3, 5);
  ctx.fillRect(L / 2 - 2, Wd / 2 - 10, 3, 5);
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, opts) {
  const o = opts || {};
  ctx.save();
  ctx.translate(x, y);
  if (o.down) {
    // Lying down.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 14, 8, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 7, angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(angle);
  // Body.
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  // Head / shoulders hint.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(4, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Gun or fists forward.
  if (o.armed) {
    ctx.fillStyle = '#222';
    ctx.fillRect(10, -2, 9, 4);
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(11, -4, 2.5, 0, Math.PI * 2);
    ctx.arc(11, 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (o.hp != null && o.hp < o.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - 12, y - 20, 24, 4);
    ctx.fillStyle = o.hp > o.maxHp * 0.4 ? PALETTE.health : PALETTE.healthLow;
    ctx.fillRect(x - 12, y - 20, 24 * clamp(o.hp / o.maxHp, 0, 1), 4);
  }
}

function drawMarker(ctx, G, target) {
  if (!target) return;
  const pulse = 1 + Math.sin(G.time * 4) * 0.15;
  const x = target.x;
  const y = target.y;
  // Ground diamond.
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = PALETTE.marker;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(-9 * pulse, -9 * pulse, 18 * pulse, 18 * pulse);
  ctx.strokeStyle = '#7a5b00';
  ctx.lineWidth = 2;
  ctx.strokeRect(-9 * pulse, -9 * pulse, 18 * pulse, 18 * pulse);
  ctx.restore();
  // Light beam.
  const grad = ctx.createLinearGradient(x, y - 160, x, y);
  grad.addColorStop(0, 'rgba(255,210,62,0)');
  grad.addColorStop(1, 'rgba(255,210,62,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 4, y - 160, 8, 160);
}

// --- HUD ----------------------------------------------------------------------

function drawMinimap(ctx, G) {
  const S = 176;
  const x0 = 16;
  const y0 = G.viewH - S - 16;
  const scale = S / WORLD.size;
  ctx.save();
  ctx.fillStyle = PALETTE.hudPanel;
  rr(ctx, x0 - 6, y0 - 6, S + 12, S + 12, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x0, y0, S, S);
  ctx.clip();
  // Water + land.
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(x0, y0, S, S);
  ctx.fillStyle = '#7d7a6e';
  ctx.fillRect(x0, y0, S, (WORLD.beach / WORLD.size) * S);
  // Roads.
  ctx.strokeStyle = 'rgba(30,32,38,0.9)';
  ctx.lineWidth = 1.5;
  for (let x = 0; x <= WORLD.size; x += 320) {
    ctx.beginPath();
    ctx.moveTo(x0 + x * scale, y0);
    ctx.lineTo(x0 + x * scale, y0 + (WORLD.beach / WORLD.size) * S);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD.beach; y += 320) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + y * scale);
    ctx.lineTo(x0 + S, y0 + y * scale);
    ctx.stroke();
  }
  // Landmarks.
  ctx.fillStyle = '#ffd23e';
  for (const k of Object.keys(G.city.landmarks)) {
    const lm = G.city.landmarks[k];
    ctx.fillRect(x0 + lm.x * scale - 2, y0 + lm.y * scale - 2, 4, 4);
  }
  // Mission target.
  const target = G._missionTarget ? G._missionTarget() : null;
  if (target) {
    ctx.save();
    ctx.translate(x0 + target.x * scale, y0 + target.y * scale);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  // Police (red), traffic (white dots), player (green arrow).
  ctx.fillStyle = '#ff4b4b';
  for (const c of G.cars) {
    if (c.kind === 'police' && !c.dead) {
      ctx.fillRect(x0 + c.x * scale - 2, y0 + c.y * scale - 2, 4, 4);
    }
  }
  const p = G.player;
  ctx.save();
  ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#58c96b';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // Label tucked inside the map's top-left corner, clear of the health panel.
  ctx.fillStyle = 'rgba(12,14,20,0.65)';
  ctx.fillRect(x0 + 4, y0 + 4, 58, 16);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 10px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('SOLMAR', x0 + 9, y0 + 16);
}

function drawHUD(ctx, G) {
  const W = G.viewW;
  const H = G.viewH;
  const p = G.player;
  // Objective panel, top-left.
  const obj = G._objectiveText ? G._objectiveText() : null;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  if (obj) {
    ctx.fillStyle = PALETTE.hudPanel;
    const w = Math.min(430, ctx.measureText(obj).width + 92);
    rr(ctx, 14, 14, w, 44, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.objective;
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText('OBJECTIVE', 26, 31);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(obj, 26, 49);
  }
  // Wanted stars + cash, top-right.
  ctx.fillStyle = PALETTE.hudPanel;
  rr(ctx, W - 218, 14, 204, 62, 8);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    const cx = W - 196 + i * 34;
    const cy = 38;
    if (i < G.wanted.stars) {
      ctx.fillStyle = PALETTE.star;
      star(ctx, cx, cy, 12, true);
    } else {
      ctx.strokeStyle = PALETTE.starEmpty;
      ctx.lineWidth = 2;
      star(ctx, cx, cy, 12, false);
    }
  }
  ctx.fillStyle = PALETTE.cash;
  ctx.font = `bold 17px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, W - 28, 66);
  ctx.textAlign = 'left';
  // Health + weapon, above the minimap.
  const hx = 16;
  const hy = H - 176 - 52;
  ctx.fillStyle = PALETTE.hudPanel;
  rr(ctx, hx - 4, hy - 4, 190, 40, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  rr(ctx, hx + 6, hy + 6, 168, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
  rr(ctx, hx + 6, hy + 6, 168 * clamp(p.health / p.maxHealth, 0, 1), 12, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = `bold 12px ${FONT}`;
  if (p.onFoot) {
    ctx.fillText(p.weapon === 'pistol' ? 'PISTOL  [Q] holster' : 'FISTS  [F] punch', hx + 6, hy + 33);
  } else if (p.car) {
    ctx.fillText(`${CAR_TYPES[p.car.type].name.toUpperCase()}  [E] exit`, hx + 6, hy + 33);
  }
  // Speed, bottom-right, while driving.
  if (!p.onFoot && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.55);
    ctx.fillStyle = PALETTE.hudPanel;
    rr(ctx, W - 150, H - 86, 134, 70, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 30px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, W - 34, H - 44);
    ctx.font = `11px ${FONT}`;
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.fillText('km/h', W - 34, H - 28);
    ctx.textAlign = 'left';
  }
  // Event toast, centre-bottom.
  const ev = latestEvent(G);
  if (ev) {
    ctx.font = `14px ${FONT}`;
    const tw = ctx.measureText(ev.text).width + 28;
    ctx.fillStyle = PALETTE.hudPanel;
    rr(ctx, (W - tw) / 2, H - 64, tw, 34, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(ev.text, W / 2, H - 42);
    ctx.textAlign = 'left';
  }
  // Controls hint, first minute of play.
  if (G.time - G.playStartedAt < 14 && G.state === 'playing') {
    ctx.fillStyle = 'rgba(12,14,20,0.55)';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('WASD move / drive  •  E enter car  •  F punch  •  mouse aim, click shoot  •  Shift run  •  Space handbrake  •  Esc pause', W / 2, 96);
    ctx.textAlign = 'left';
  }
  // Low-health vignette.
  if (p.health < 35 && p.health > 0) {
    const a = 0.25 + 0.15 * Math.sin(G.time * 5);
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    grad.addColorStop(0, 'rgba(229,53,75,0)');
    grad.addColorStop(1, `rgba(229,53,75,${a})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }
  drawMinimap(ctx, G);
}

function latestEvent(G) {
  let best = null;
  for (const e of G.events) {
    if (G.time >= e.at && G.time < e.at + 4.5) {
      if (!best || e.at > best.at) best = e;
    }
  }
  return best;
}

// Off-screen mission marker arrow on the screen edge.
function drawEdgeArrow(ctx, G, target) {
  const cam = G.camera;
  const vw = G.viewW / cam.zoom;
  const vh = G.viewH / cam.zoom;
  const x0 = cam.x - vw / 2;
  const y0 = cam.y - vh / 2;
  if (target.x > x0 && target.x < x0 + vw && target.y > y0 && target.y < y0 + vh) return;
  const cx = clamp(target.x, x0 + 60, x0 + vw - 60);
  const cy = clamp(target.y, y0 + 60, y0 + vh - 60);
  const a = Math.atan2(target.y - cy, target.x - cx);
  const d = Math.hypot(target.x - G.player.x, target.y - G.player.y);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = PALETTE.marker;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -10);
  ctx.lineTo(-8, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = PALETTE.marker;
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(d)}m`, cx, cy + 28);
  ctx.textAlign = 'left';
}

// --- menus ----------------------------------------------------------------------

function panel(ctx, W, H, w, h) {
  ctx.fillStyle = 'rgba(10,12,18,0.82)';
  rr(ctx, (W - w) / 2, (H - h) / 2, w, h, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,62,0.5)';
  ctx.lineWidth = 1.5;
  rr(ctx, (W - w) / 2, (H - h) / 2, w, h, 14);
  ctx.stroke();
}

function menuItems(ctx, G, W, H, items, selected) {
  ctx.textAlign = 'center';
  items.forEach((it, i) => {
    const y = H / 2 - ((items.length - 1) * 22) + i * 44;
    ctx.font = `${i === selected ? 'bold 19px' : '16px'} ${FONT}`;
    ctx.fillStyle = i === selected ? '#ffd23e' : '#e8e4d8';
    ctx.fillText(`${i === selected ? '▶ ' : ''}${it}`, W / 2, y);
  });
  ctx.textAlign = 'left';
}

function drawTitle(ctx, G) {
  const W = G.viewW;
  const H = G.viewH;
  // Sunset gradient sky over the city silhouette.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2b1a3e');
  grad.addColorStop(0.45, '#c94f43');
  grad.addColorStop(0.75, '#e8913f');
  grad.addColorStop(1, '#f2c94c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffdf6b';
  ctx.beginPath();
  ctx.arc(W * 0.72, H * 0.3, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,20,40,0.9)';
  // City skyline.
  const base = H * 0.72;
  for (let i = 0; i < 26; i++) {
    const bw = W / 26;
    const bh = 40 + ((i * 53) % 130);
    ctx.fillRect(i * bw, base - bh, bw - 3, bh + H);
  }
  ctx.fillStyle = 'rgba(10,10,16,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = `bold ${Math.min(96, W / 9)}px ${FONT}`;
  ctx.fillText('SOLMAR', W / 2, H * 0.3);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = `${Math.min(26, W / 34)}px ${FONT}`;
  ctx.fillText('S T R E E T S   O F   T H E   S U N', W / 2, H * 0.3 + 44);
  ctx.font = `15px ${FONT}`;
  ctx.fillStyle = '#d8d2c2';
  ctx.fillText('Five years away. One debt to pay. A whole city to take back.', W / 2, H * 0.3 + 84);
  const items = [];
  if (G.saveData) items.push(`CONTINUE — $${G.saveData.cash}  •  ${G.saveData.completed || 0}/5 missions done`);
  items.push('NEW GAME');
  items.push('HOW TO PLAY');
  G._titleItems = items;
  menuItems(ctx, G, W, H + 120, items, G.menuIndex);
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = '#b9b4a4';
  ctx.fillText('WASD move & drive  •  E enter / steal a car  •  F punch  •  mouse aim, click to shoot  •  Esc pause', W / 2, H - 36);
  ctx.textAlign = 'left';
}

function drawHowTo(ctx, G) {
  const W = G.viewW;
  const H = G.viewH;
  ctx.fillStyle = 'rgba(8,10,16,0.9)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = `bold 34px ${FONT}`;
  ctx.fillText('HOW TO PLAY', W / 2, H * 0.2);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = `16px ${FONT}`;
  const lines = [
    'Move on foot with WASD (Shift to run). Aim with the mouse.',
    'Walk up to a car and press E to get in — if it has a driver, you steal it,',
    'and the Solmar PD notices. Drive with WASD, Space is the handbrake.',
    'Punch with F. Once you own a pistol, click to shoot, Q to holster it.',
    'Crimes raise your wanted level: stars bring police cars and foot cops.',
    'Stay quiet and the heat cools off. Get caught with no health and you are',
    'BUSTED; die and you are WASTED — either way you wake up at Solmar General.',
    'Follow the yellow marker to work through the five story missions.',
    'The game saves after every mission, and from the pause menu (Esc).',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.2 + 44 + i * 28));
  ctx.fillStyle = '#ffd23e';
  ctx.font = `bold 17px ${FONT}`;
  ctx.fillText('Press Esc to go back', W / 2, H * 0.2 + 44 + lines.length * 28 + 30);
  ctx.textAlign = 'left';
}

function drawPause(ctx, G) {
  const W = G.viewW;
  const H = G.viewH;
  ctx.fillStyle = 'rgba(8,10,16,0.6)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W, H, 420, 320);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = `bold 32px ${FONT}`;
  ctx.fillText('PAUSED', W / 2, H / 2 - 118);
  ctx.textAlign = 'left';
  const items = ['RESUME', 'SAVE GAME', 'RESTART MISSION', G.audio.muted ? 'SOUND: OFF' : 'SOUND: ON', 'QUIT TO TITLE'];
  G._pauseItems = items;
  menuItems(ctx, G, W, H + 40, items, G.menuIndex);
}

function drawBigWord(ctx, G, word, color, sub) {
  const W = G.viewW;
  const H = G.viewH;
  ctx.fillStyle = 'rgba(8,10,16,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.min(110, W / 7)}px ${FONT}`;
  ctx.fillText(word, W / 2, H * 0.42);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = `17px ${FONT}`;
  ctx.fillText(sub, W / 2, H * 0.42 + 44);
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillStyle = '#ffd23e';
  ctx.fillText('Press ENTER to continue', W / 2, H * 0.42 + 92);
  ctx.textAlign = 'left';
}

function drawMissionComplete(ctx, G) {
  const W = G.viewW;
  const H = G.viewH;
  ctx.fillStyle = 'rgba(8,10,16,0.6)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W, H, 520, 260);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.font = `bold 30px ${FONT}`;
  ctx.fillText('MISSION COMPLETE', W / 2, H / 2 - 58);
  ctx.fillStyle = '#f4f1e6';
  ctx.font = `19px ${FONT}`;
  const def = G.mission && G.mission.def;
  ctx.fillText(def ? def.name : '', W / 2, H / 2 - 18);
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillStyle = '#7ddb8a';
  ctx.fillText(`+$${def ? def.reward : 0}`, W / 2, H / 2 + 22);
  ctx.font = `15px ${FONT}`;
  ctx.fillStyle = '#d8d2c2';
  const next = G._nextMissionName ? G._nextMissionName() : null;
  ctx.fillText(next ? `Next: ${next}` : 'All missions complete — Solmar is yours.', W / 2, H / 2 + 56);
  ctx.fillStyle = '#ffd23e';
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText('Press ENTER to continue', W / 2, H / 2 + 92);
  ctx.textAlign = 'left';
}

// --- main render ---------------------------------------------------------------

export function render(G) {
  const ctx = G.ctx;
  const W = G.viewW;
  const H = G.viewH;
  ctx.clearRect(0, 0, W, H);

  if (G.state === 'title') {
    drawTitle(ctx, G);
    return;
  }
  if (G.state === 'howto') {
    drawHowTo(ctx, G);
    return;
  }

  // Camera transform with shake.
  const cam = G.camera;
  const shakeX = (Math.random() - 0.5) * (G.shake || 0);
  const shakeY = (Math.random() - 0.5) * (G.shake || 0);
  ctx.save();
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + W / (2 * cam.zoom) + shakeX, -cam.y + H / (2 * cam.zoom) + shakeY);
  const view = {
    x: cam.x - W / (2 * cam.zoom) - 40,
    y: cam.y - H / (2 * cam.zoom) - 40,
    w: W / cam.zoom + 80,
    h: H / cam.zoom + 80,
  };
  drawGround(ctx, G, view);
  drawBuildings(ctx, G, view);
  // Skid marks.
  ctx.strokeStyle = 'rgba(20,20,22,0.5)';
  ctx.lineWidth = 5;
  for (const s of G.skids) {
    if (!inView(view, s.x - 8, s.y - 8, 16, 16)) continue;
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 10, s.y - Math.sin(s.angle) * 10);
    ctx.lineTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10);
    ctx.stroke();
  }
  // Pickups.
  for (const pk of G.pickups) {
    if (!inView(view, pk.x - 12, pk.y - 12, 24, 24)) continue;
    const bob = Math.sin(G.time * 3 + pk.x) * 2;
    ctx.fillStyle = pk.kind === 'cash' ? '#7ddb8a' : '#ff6b6b';
    ctx.beginPath();
    ctx.arc(pk.x, pk.y + bob, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0c0e14';
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'cash' ? '$' : '+', pk.x, pk.y + bob + 4);
    ctx.textAlign = 'left';
  }
  // Cars.
  for (const car of G.cars) {
    if (car.dead && G.time - car.deadAt > 25) continue;
    if (!inView(view, car.x - 60, car.y - 60, 120, 120)) continue;
    drawCar(ctx, car, G.time);
  }
  // People.
  for (const ped of G.peds) {
    if (ped.state === 'dead' && G.time - ped.stateAt > 20) continue;
    if (!inView(view, ped.x - 20, ped.y - 20, 40, 40)) continue;
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, {
      down: ped.state === 'down' || ped.state === 'dead',
      armed: ped.kind === 'guard',
      hp: ped.hp,
      maxHp: ped.maxHp,
    });
  }
  for (const cop of G.cops) {
    if (cop.hp <= 0) continue;
    if (!inView(view, cop.x - 20, cop.y - 20, 40, 40)) continue;
    drawPerson(ctx, cop.x, cop.y, cop.angle, '#20242c', { hp: cop.hp, maxHp: cop.maxHp });
  }
  // Player.
  const p = G.player;
  if (p.onFoot && p.health > 0) {
    drawPerson(ctx, p.x, p.y, p.angle, PALETTE.player, {
      armed: p.weapon === 'pistol',
    });
    // Player ring so they are easy to find.
    ctx.strokeStyle = 'rgba(242,201,76,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 17 + Math.sin(G.time * 4) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Bullets.
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 2;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Particles.
  for (const pt of G.particles) {
    const a = 1 - pt.life / pt.maxLife;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (1 + (pt.grow || 0) * pt.life * 0.2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Mission marker + edge arrow.
  const target = G._missionTarget ? G._missionTarget() : null;
  if (target) {
    drawMarker(ctx, G, target);
  }
  ctx.restore();

  // Golden-hour wash over the whole scene.
  const warm = ctx.createLinearGradient(0, 0, W, H);
  warm.addColorStop(0, 'rgba(255,170,80,0.05)');
  warm.addColorStop(1, 'rgba(255,120,60,0.08)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);

  if (target) drawEdgeArrow(ctx, G, target);
  drawHUD(ctx, G);

  if (G.state === 'paused') drawPause(ctx, G);
  if (G.state === 'dead') drawBigWord(ctx, G, 'WASTED', '#e5534b', G.deathNote || 'You woke up at Solmar General, $100 lighter.');
  if (G.state === 'busted') drawBigWord(ctx, G, 'BUSTED', '#5a8fd6', 'The PD impounded your ride. You lost $150.');
  if (G.state === 'missionComplete') drawMissionComplete(ctx, G);
  if (G.state === 'storyComplete') {
    drawBigWord(ctx, G, 'THE DEBT IS PAID', '#ffd23e', 'All five missions done — Solmar is yours. Free roam continues. Press ENTER.');
  }
}
