// Solmar city generation. A seeded grid city: roads every 320 pixels,
// 150 buildings tucked inside the blocks, a beach along the south edge,
// and six landmarks placed on open ground so every mission target is
// reachable on foot and by car.
import { CFG, PALETTE } from './config.js';
import { makeRng } from './random.js';

const SIZE = CFG.world.size;
const SPACING = CFG.world.roadSpacing;
const HALF_ROAD = CFG.world.roadWidth / 2;

export function buildCity() {
  const rng = makeRng(CFG.world.seed);
  const buildings = [];
  const parks = [
    { bx: 1, by: 1 },
    { bx: 7, by: 3 },
    { bx: 3, by: 6 },
    { bx: 8, by: 7 },
  ];
  const isPark = (bx, by) => parks.some((p) => p.bx === bx && p.by === by);

  // Landmark clear zones: no ordinary building may overlap these.
  const clearZones = [
    { x0: 0, y0: 1780, x1: 320, y1: 2080 }, // docks piers
    { x0: 700, y0: 2480, x1: 920, y1: 2660 }, // garage yard
    { x0: 340, y0: 2880, x1: 680, y1: 3080 }, // marina
    { x0: 1600, y0: 1280, x1: 1920, y1: 1620 }, // tower block
    { x0: 2240, y0: 640, x1: 2560, y1: 980 }, // hospital block
    { x0: 640, y0: 640, x1: 960, y1: 980 }, // PD HQ block
  ];
  const overlapsClear = (x0, y0, x1, y1, pad) =>
    clearZones.some(
      (z) => x0 - pad < z.x1 && x1 + pad > z.x0 && y0 - pad < z.y1 && y1 + pad > z.y0,
    );

  // Landmark buildings, drawn distinctly and named on the map.
  const landmarks = {
    docks: { x: 160, y: 1924, w: 120, h: 60, name: 'DOCKS' },
    garage: { x: 800, y: 2564, w: 140, h: 70, name: 'GARAGE' },
    marina: { x: 480, y: 2960, w: 160, h: 50, name: 'MARINA' },
    tower: { x: 1760, y: 1440, w: 180, h: 140, name: 'TOWER' },
    hospital: { x: 2400, y: 800, w: 200, h: 150, name: 'HOSPITAL' },
    pdhq: { x: 800, y: 800, w: 200, h: 150, name: 'SOLMAR PD' },
  };
  const towerFront = { x: 1760, y: 1556 };
  const hospitalFront = { x: 2400, y: 910 };

  for (const key of ['tower', 'hospital', 'pdhq']) {
    const lm = landmarks[key];
    buildings.push({
      x: lm.x - lm.w / 2,
      y: lm.y - lm.h / 2,
      w: lm.w,
      h: lm.h,
      roof: key === 'tower' ? '#3d4451' : key === 'hospital' ? '#e8e8e8' : '#2c3e50',
      landmark: key,
    });
  }

  // Ordinary buildings, two per block at most, until the count is 150.
  const blockOrder = [];
  for (let by = 0; by < 9; by++) {
    for (let bx = 0; bx < 10; bx++) blockOrder.push({ bx, by });
  }
  // Deterministic shuffle with the seeded rng.
  for (let i = blockOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [blockOrder[i], blockOrder[j]] = [blockOrder[j], blockOrder[i]];
  }
  for (const { bx, by } of blockOrder) {
    if (buildings.length >= 150) break;
    if (isPark(bx, by)) continue;
    const bx0 = bx * SPACING + HALF_ROAD + 20;
    const by0 = by * SPACING + HALF_ROAD + 20;
    const bx1 = (bx + 1) * SPACING - HALF_ROAD - 20;
    const by1 = (by + 1) * SPACING - HALF_ROAD - 20;
    let placed = 0;
    for (let tries = 0; tries < 30 && placed < 2 && buildings.length < 150; tries++) {
      const w = rng.range(60, 110);
      const h = rng.range(50, 90);
      const x = rng.range(bx0, Math.max(bx0 + 1, bx1 - w));
      const y = rng.range(by0, Math.max(by0 + 1, by1 - h));
      if (overlapsClear(x, y, x + w, y + h, 16)) continue;
      let clash = false;
      for (const b of buildings) {
        if (x - 8 < b.x + b.w && x + w + 8 > b.x && y - 8 < b.y + b.h && y + h + 8 > b.y) {
          clash = true;
          break;
        }
      }
      if (clash) continue;
      buildings.push({ x, y, w, h, roof: rng.pick(PALETTE.buildingRoofs), landmark: null });
      placed++;
    }
  }

  const city = {
    size: SIZE,
    buildings,
    parks: parks.map((p) => ({
      x: p.bx * SPACING + HALF_ROAD,
      y: p.by * SPACING + HALF_ROAD,
      w: SPACING - CFG.world.roadWidth,
      h: SPACING - CFG.world.roadWidth,
    })),
    landmarks,
    towerFront,
    hospitalFront,
    beachY: CFG.world.beachY,
  };
  return city;
}

export function isOnRoad(x, y) {
  const rx = ((x % SPACING) + SPACING) % SPACING;
  const ry = ((y % SPACING) + SPACING) % SPACING;
  const near = (v) => v <= HALF_ROAD || v >= SPACING - HALF_ROAD;
  return near(rx) || near(ry);
}

export function isBeach(city, x, y) {
  return y >= city.beachY;
}

function circleHitsRect(x, y, r, b) {
  const cx = Math.max(b.x, Math.min(x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(y, b.y + b.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < r * r;
}

export function circleHitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (circleHitsRect(x, y, r, b)) return b;
  }
  return null;
}

// Move a circle axis by axis, sliding along walls. Returns the new
// position plus which axes were blocked (for impact damage).
export function moveCircle(city, x, y, dx, dy, r) {
  let hitX = false;
  let hitY = false;
  const nx = x + dx;
  if (!circleHitsBuilding(city, nx, y, r)) {
    x = nx;
  } else {
    hitX = true;
  }
  const ny = y + dy;
  if (!circleHitsBuilding(city, x, ny, r)) {
    y = ny;
  } else {
    hitY = true;
  }
  return { x, y, hitX, hitY };
}

export function clampToWorld(x, y, margin) {
  const m = margin || 16;
  return {
    x: Math.max(m, Math.min(SIZE - m, x)),
    y: Math.max(m, Math.min(SIZE - m, y)),
  };
}
