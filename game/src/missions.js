// SOLMAR — missions.js: the story. Five missions that pay off the Reyes Garage debt
// to Vera Castellanos. Each mission is a list of steps; a step is a small job
// (go somewhere, steal a car, survive, deliver on a timer, take out guards, lose
// the cops) with an on-screen objective and a world marker. Dialogue is shown as
// subtitle lines through the event queue.

import { MISSIONS } from './config.js';
import { spawnPed, addHeat } from './entities.js';
import { makeCar } from './vehicles.js';

// Push subtitle lines spaced so the renderer shows them one after another.
export function say(G, lines) {
  if (!lines) return;
  let t = G.time + 0.1;
  for (const line of lines) {
    G.events.push({ text: `${line.who}: "${line.text}"`, at: t });
    t += 4.5;
  }
}

function lm(G, kind) {
  return G.city.landmarks[kind];
}

// The street in front of a landmark building (its centre + half height + margin),
// so a mission target is always reachable by car or on foot.
function front(G, kind) {
  const l = lm(G, kind);
  return { x: l.x, y: l.y + l.h / 2 + 46 };
}

const DEFS = [
  {
    name: 'Welcome Home',
    reward: 500,
    intro: [
      { who: 'Milo', text: 'Five years away. Solmar has not changed a bit.' },
      { who: 'Ray', text: 'Milo! The garage is in hock to La Reina. We need wheels and cash — fast.' },
    ],
    steps: [
      { type: 'enterCar', text: 'Get a car — walk up to one and press E' },
      { type: 'goto', at: (G) => front(G, 'docks'), radius: 70, text: 'Pick up the package at the Docks' },
      { type: 'driveTo', at: (G) => front(G, 'garage'), radius: 70, text: 'Bring the package back to Reyes Garage' },
    ],
    outro: [{ who: 'Ray', text: 'That is the first payment. La Reina does not wait, Milo.' }],
  },
  {
    name: 'Hot Wheels',
    reward: 1200,
    intro: [
      { who: 'Ray', text: 'La Reina wants a Comet GT. There is one parked at the Marina. Take it — quietly.' },
      { who: 'Milo', text: 'Quietly. Sure.' },
    ],
    steps: [
      { type: 'goto', at: (G) => lm(G, 'marina'), radius: 80, text: 'Get to the Solmar Marina' },
      {
        type: 'steal', text: 'Steal the Comet GT — press E beside it',
        onStart(G) {
          let car = G.cars.find((c) => c.type === 'sport' && !c.dead);
          if (!car) {
            const m = lm(G, 'marina');
            car = makeCar('sport', m.x, m.y + 40, 0, 'parked', null);
            G.cars.push(car);
          }
          G.mission.targetCar = car;
        },
      },
      { type: 'driveTo', at: (G) => front(G, 'garage'), radius: 70, text: 'Bring the Comet GT to the garage' },
    ],
    outro: [{ who: 'Ray', text: 'Keep this. Things are about to get loud.' }],
    onComplete(G) {
      G.player.hasPistol = true;
      G.player.weapon = 'pistol';
      G.events.push({ text: 'New weapon: Pistol — aim with the mouse, click to fire, Q to holster', at: G.time });
    },
  },
  {
    name: 'Heat Wave',
    reward: 1500,
    intro: [
      { who: 'Vera', text: 'Milo Reyes. You drive for me now. First, prove you can shake my police.' },
    ],
    steps: [
      {
        type: 'survive', seconds: 60, text: 'Survive the heat — 60 seconds with the PD on you',
        onStart(G) {
          addHeat(G, 60);
        },
      },
      { type: 'escape', text: 'Now disappear — lose the cops completely' },
    ],
    outro: [{ who: 'Vera', text: 'Not bad. You might be worth the trouble after all.' }],
  },
  {
    name: 'The Drop',
    reward: 2000,
    intro: [
      { who: 'Vera', text: 'A package. Northside clinic. The PD knows the route — drive like it.' },
    ],
    steps: [
      { type: 'goto', at: (G) => front(G, 'tower'), radius: 70, text: 'Pick up the package at Castellanos Tower' },
      {
        type: 'deliver', at: (G) => front(G, 'hospital'), radius: 70, seconds: 75,
        text: 'Deliver to Solmar General — 75 seconds',
        onStart(G) {
          addHeat(G, 20);
        },
      },
    ],
    outro: [{ who: 'Vera', text: 'Delivered. Two jobs left on your tab, Milo.' }],
  },
  {
    name: "La Reina's Due",
    reward: 5000,
    intro: [
      { who: 'Vera', text: 'Last job. My guards will test you. Pass, and the garage is yours again.' },
      { who: 'Milo', text: 'Then let us finish this.' },
    ],
    steps: [
      { type: 'goto', at: (G) => front(G, 'tower'), radius: 80, text: 'Go to Castellanos Tower' },
      {
        type: 'kill', count: 4, text: "Deal with Vera's guards",
        onStart(G) {
          const t = lm(G, 'tower');
          for (let i = 0; i < 4; i++) {
            const g = spawnPed(G, t.x - 90 + i * 60, t.y + t.h / 2 + 60 + (i % 2) * 40, {
              kind: 'guard', hp: 60, color: '#5a1f1f',
            });
            g.state = 'walk';
          }
          G.mission.kills = 0;
        },
      },
      {
        type: 'escape', text: 'Get out of there — lose the cops',
        onStart(G) {
          addHeat(G, 80);
        },
      },
    ],
    outro: [
      { who: 'Vera', text: 'The debt is cleared. Solmar is yours, Milo Reyes.' },
      { who: 'Milo', text: 'The city never really lets you go. Good thing I like it here.' },
    ],
  },
];

export function startMission(G, index) {
  const def = DEFS[index];
  if (!def) return;
  G.mission = {
    index,
    def,
    step: 0,
    timer: 0,
    kills: 0,
    targetCar: null,
    active: true,
    failed: false,
    failedAt: 0,
    startedAt: G.time,
  };
  say(G, def.intro);
  startStep(G);
}

function startStep(G) {
  const m = G.mission;
  const step = m.def.steps[m.step];
  if (!step) return;
  m.timer = step.seconds || 0;
  if (step.onStart) step.onStart(G);
  G.events.push({ text: `Mission: ${m.def.name} — ${step.text}`, at: G.time });
}

export function missionTarget(G) {
  const m = G.mission;
  if (!m || !m.active) return null;
  const step = m.def.steps[m.step];
  if (!step) return null;
  if (step.type === 'steal' && m.targetCar) {
    return { x: m.targetCar.x, y: m.targetCar.y, label: 'Comet GT' };
  }
  if (step.at) {
    const p = step.at(G);
    return { x: p.x, y: p.y, label: step.text };
  }
  return null;
}

function stepDone(G) {
  const m = G.mission;
  m.step++;
  if (m.step >= m.def.steps.length) {
    completeMission(G);
  } else {
    startStep(G);
  }
}

function completeMission(G) {
  const m = G.mission;
  const reward = m.def.reward;
  G.player.cash += reward;
  G.audio.missionDone();
  say(G, m.def.outro);
  G.events.push({ text: `Mission complete: ${m.def.name} — +$${reward}`, at: G.time });
  if (m.def.onComplete) m.def.onComplete(G);
  G.completedMissions.add(m.index);
  G.mission.active = false;
  G.missionDone = m.index;
  G.missionDoneAt = G.time;
  G.state = 'missionComplete';
  if (G._autosave) G._autosave();
  // Next mission starts when the player closes the overlay (main.js).
}

function failMission(G, reason) {
  const m = G.mission;
  if (!m || !m.active || m.failed) return;
  m.failed = true;
  m.failedAt = G.time;
  G.audio.missionFail();
  G.events.push({ text: `Mission failed: ${reason} — retrying…`, at: G.time });
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m || !m.active) return;
  if (m.failed) {
    if (G.time - m.failedAt > 2.5) {
      startMission(G, m.index);
    }
    return;
  }
  const step = m.def.steps[m.step];
  if (!step) return;
  const p = G.player;
  const px = p.onFoot ? p.x : p.car ? p.car.x : p.x;
  const py = p.onFoot ? p.y : p.car ? p.car.y : p.y;

  switch (step.type) {
    case 'enterCar': {
      if (!p.onFoot) stepDone(G);
      break;
    }
    case 'goto':
    case 'driveTo': {
      const pt = step.at(G);
      const r = step.radius || 60;
      const dx = px - pt.x;
      const dy = py - pt.y;
      const arrived = step.type === 'driveTo' ? !p.onFoot && dx * dx + dy * dy < r * r : dx * dx + dy * dy < r * r;
      if (arrived) stepDone(G);
      break;
    }
    case 'steal': {
      if (p.car === m.targetCar) stepDone(G);
      else if (!m.targetCar || m.targetCar.dead) failMission(G, 'the Comet GT was destroyed');
      break;
    }
    case 'survive': {
      m.timer -= dt;
      if (m.timer <= 0) stepDone(G);
      break;
    }
    case 'deliver': {
      m.timer -= dt;
      const pt = step.at(G);
      const r = step.radius || 60;
      const dx = px - pt.x;
      const dy = py - pt.y;
      if (dx * dx + dy * dy < r * r) stepDone(G);
      else if (m.timer <= 0) failMission(G, 'the delivery was too slow');
      break;
    }
    case 'kill': {
      if (m.kills >= step.count) stepDone(G);
      break;
    }
    case 'escape': {
      if (G.wanted.stars === 0) stepDone(G);
      break;
    }
    default:
      break;
  }
}

export function missionObjectiveText(G) {
  const m = G.mission;
  if (!m || !m.active) return null;
  const step = m.def.steps[m.step];
  if (!step) return null;
  let text = step.text;
  if (step.type === 'survive' || step.type === 'deliver') {
    text += ` — ${Math.max(0, Math.ceil(m.timer))}s`;
  }
  if (step.type === 'kill') {
    text += ` (${Math.min(m.kills, step.count)}/${step.count})`;
  }
  return `${m.def.name}: ${text}`;
}

export function nextMissionIndex(G) {
  for (let i = 0; i < DEFS.length; i++) {
    if (!G.completedMissions.has(i)) return i;
  }
  return -1;
}

export { MISSIONS };
