// SOLMAR — city.js: the city of Solmar, generated once from a seed. A 3200x3200 px
// grid city: roads every 320 px, blocks of buildings, parks and parking lots, a beach
// along the south edge, and six named landmarks the story uses. Everything is
// deterministic for a seed, so screenshots are repeatable.

import { WORLD, PALETTE } from './config.js';
import { createRandom, range, int, pick, chance } from './random.js';

const GRID = WORLD.block; // 320
const HALF_ROAD = WORLD.road / 2; // 32

// Landmark blocks, keyed by "bx,by" (block column,row). Each gets a named building.
const LANDMARKS = {
  '2,7': { name: 'Reyes Garage', kind: 'garage', color: '#c96f4a' },
  '0,5': { name: 'Solmar Docks', kind: 'docks', color: '#7d8a99' },
  '8,1': { name: 'Castellanos Tower', kind: 'tower', color: '#2b3242' },
  '5,3': { name: 'Solmar General', kind: 'hospital', color: '#e8e4d8' },
  '7,5': { name: 'Solmar PD HQ', kind: 'police', color: '#3a4a6b' },
};

export function generateCity(seed) {
  const rnd = createRandom(seed);
  const buildings = [];
  const parks = [];
  const trees = [];
  const parkedSpots = [];
  const landmarks = {};

  const cols = Math.floor(WORLD.size / GRID); // 10
  const rows = Math.floor(WORLD.beach / GRID); // 9 (roads stop at the beach)

  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const key = `${bx},${by}`;
      const x0 = bx * GRID + HALF_ROAD + 10;
      const y0 = by * GRID + HALF_ROAD + 10;
      const w = GRID - WORLD.road - 20;
      const h = GRID - WORLD.road - 20;

      if (LANDMARKS[key]) {
        const lm = LANDMARKS[key];
        const b = {
          x: x0, y: y0, w, h,
          color: lm.color, height: lm.kind === 'tower' ? 30 : 14,
          kind: lm.kind, name: lm.name, seed: int(rnd, 0, 99999),
        };
        buildings.push(b);
        landmarks[lm.kind] = { x: x0 + w / 2, y: y0 + h / 2, w, h, building: b, name: lm.name };
        // A couple of trees and a parked car by each landmark.
        trees.push({ x: x0 + 14, y: y0 + 14, r: 9 });
        trees.push({ x: x0 + w - 14, y: y0 + h - 14, r: 9 });
        continue;
      }

      const roll = rnd();
      if (roll < 0.12) {
        // Park: grass, trees, a path.
        parks.push({ x: x0, y: y0, w, h });
        const n = int(rnd, 5, 9);
        for (let i = 0; i < n; i++) {
          trees.push({ x: range(rnd, x0 + 16, x0 + w - 16), y: range(rnd, y0 + 16, y0 + h - 16), r: range(rnd, 7, 12) });
        }
        continue;
      }
      if (roll < 0.22) {
        // Parking lot: flat asphalt with parked cars.
        const n = int(rnd, 3, 6);
        for (let i = 0; i < n; i++) {
          const px = x0 + 30 + (i % 3) * 70;
          const py = y0 + 40 + Math.floor(i / 3) * 90;
          parkedSpots.push({ x: px, y: py, angle: chance(rnd, 0.5) ? 0 : Math.PI, type: pick(rnd, ['sedan', 'sedan', 'taxi', 'van']) });
        }
        trees.push({ x: x0 + 12, y: y0 + 12, r: 8 });
        continue;
      }

      // Built block: one big building, or two to four smaller ones.
      const count = chance(rnd, 0.55) ? 1 : int(rnd, 2, 4);
      for (let i = 0; i < count; i++) {
        let bw, bh, bx0, by0;
        if (count === 1) {
          bw = range(rnd, w * 0.55, w * 0.9);
          bh = range(rnd, h * 0.55, h * 0.9);
          bx0 = x0 + (w - bw) / 2;
          by0 = y0 + (h - bh) / 2;
        } else {
          bw = range(rnd, 52, 96);
          bh = range(rnd, 52, 96);
          bx0 = x0 + 8 + (i % 2) * (w / 2);
          by0 = y0 + 8 + Math.floor(i / 2) * (h / 2);
          bw = Math.min(bw, w / 2 - 16);
          bh = Math.min(bh, h / 2 - 16);
        }
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          color: pick(rnd, PALETTE.buildingRoof),
          height: range(rnd, 8, 26),
          kind: 'house', name: null, seed: int(rnd, 0, 99999),
        });
      }
      // Street trees on the block corners.
      if (chance(rnd, 0.7)) trees.push({ x: x0 + 8, y: y0 + h - 8, r: 8 });
      if (chance(rnd, 0.5)) trees.push({ x: x0 + w - 8, y: y0 + 8, r: 8 });
    }
  }

  // Marina on the beach: piers, boats, and the Comet GT's home.
  landmarks.marina = { x: 480, y: 2960, w: 320, h: 180, name: 'Solmar Marina' };
  parkedSpots.push({ x: 430, y: 2930, angle: 0, type: 'sport' });

  // Player spawn: in front of Reyes Garage, facing the road.
  const garage = landmarks.garage;
  const spawn = { x: garage.x, y: garage.y + garage.h + 46, angle: -Math.PI / 2 };

  return {
    seed,
    size: WORLD.size,
    buildings,
    parks,
    trees,
    parkedSpots,
    landmarks,
    spawn,
  };
}

// --- Queries ---------------------------------------------------------------

// True when the point is on a road (within half the road width of a centreline).
export function isOnRoad(city, x, y) {
  const gx = x % GRID;
  const gy = y % GRID;
  return gx < HALF_ROAD || gx > GRID - HALF_ROAD || gy < HALF_ROAD || gy > GRID - HALF_ROAD;
}

// The building containing the point, or null.
export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Push a circle (x, y, radius) out of every building it overlaps. Returns a new point.
export function resolveCircle(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        y = cy + (dy / d) * r;
      } else {
        // Centre inside the building: push out along the smallest penetration.
        const left = x - b.x;
        const right = b.x + b.w - x;
        const top = y - b.y;
        const bottom = b.y + b.h - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - r;
        else if (m === right) x = b.x + b.w + r;
        else if (m === top) y = b.y - r;
        else y = b.y + b.h + r;
      }
    }
  }
  return { x, y };
}

// True when the circle overlaps any building.
export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// A random point on a road centreline.
export function randomRoadPoint(rnd) {
  const vertical = rnd() < 0.5;
  const line = int(rnd, 0, 9) * GRID;
  const along = range(rnd, 80, WORLD.size - 80);
  return vertical ? { x: line, y: along } : { x: along, y: Math.min(line, WORLD.beach - 40) };
}

// A random point on a sidewalk (just off a road).
export function randomSidewalkPoint(rnd) {
  const p = randomRoadPoint(rnd);
  const off = 46;
  if (rnd() < 0.5) p.x += chance(rnd, 0.5) ? off : -off;
  else p.y += chance(rnd, 0.5) ? off : -off;
  p.x = Math.max(40, Math.min(WORLD.size - 40, p.x));
  p.y = Math.max(40, Math.min(WORLD.beach - 20, p.y));
  return p;
}

// The road axis at a point: 'h', 'v', or null when off-road (e.g. inside a block).
export function roadAxisAt(x, y) {
  const gx = x % GRID;
  const gy = y % GRID;
  const onV = gx < HALF_ROAD || gx > GRID - HALF_ROAD;
  const onH = gy < HALF_ROAD || gy > GRID - HALF_ROAD;
  if (onV && !onH) return 'v';
  if (onH && !onV) return 'h';
  if (onV && onH) return 'hv'; // intersection
  return null;
}
