// The five story missions. Each mission is a list of steps; a step is a
// place to reach, a thing to do, a timer to beat, or a count to reach.
// Completing a mission pays its reward, writes the save, and opens the
// next one. The fifth ends the story.
import { CFG } from './config.js';
import { spawnGuard } from './entities.js';
import { writeSave } from './save.js';

export const MISSIONS = [
  {
    id: 0,
    name: 'Welcome Home',
    intro: [
      'Ray: Milo. You made it back to Solmar.',
      'Ray: Your brother owes La Reina five thousand. Start by getting wheels.',
    ],
    outro: 'Ray: Good. Five hundred in your pocket. Now go see about a faster car.',
    reward: CFG.missions.m1Reward,
    steps: [
      { text: 'Get a car', kind: 'car' },
      { text: 'Drive to the Docks', kind: 'goto', target: { x: 160, y: 1924 }, radius: 70 },
      { text: 'Drive to the Garage', kind: 'goto', target: { x: 800, y: 2564 }, radius: 70 },
    ],
  },
  {
    id: 1,
    name: 'Hot Wheels',
    intro: [
      'Ray: La Reina keeps a pink Comet GT down at the Marina. Bring it to the Garage.',
      'Ray: And keep it quiet. The owner will not miss it till morning.',
    ],
    outro: 'Ray: The Comet is yours now, and so is this pistol. You will need both.',
    reward: CFG.missions.m2Reward,
    onComplete: (G) => {
      G.player.hasPistol = true;
      G.player.weapon = 'pistol';
    },
    steps: [
      { text: 'Go to the Marina', kind: 'goto', target: { x: 480, y: 2960 }, radius: 80 },
      { text: 'Steal the Comet GT', kind: 'sport' },
      { text: 'Take it to the Garage', kind: 'goto', target: { x: 800, y: 2564 }, radius: 70 },
    ],
  },
  {
    id: 2,
    name: 'Heat Wave',
    intro: [
      'Ray: The Marina job made the news. Solmar PD is all over you.',
      'Ray: Survive the heat, then lose it. Do not get caught.',
    ],
    outro: 'Ray: Clean. The heat is off you — for now.',
    reward: CFG.missions.m3Reward,
    steps: [
      {
        text: 'Survive the heat',
        kind: 'timer',
        timer: CFG.missions.m3Survive,
        onStart: (G) => G.setHeat(CFG.wanted.max),
      },
      { text: 'Lose the heat', kind: 'stars0' },
    ],
  },
  {
    id: 3,
    name: 'The Drop',
    intro: [
      'Ray: A package for the hospital. Seventy-five seconds, no excuses.',
      'Ray: The tower first, then the hospital. Move.',
    ],
    outro: 'Ray: Delivered. La Reina is watching, Milo. Keep it clean.',
    reward: CFG.missions.m4Reward,
    steps: [
      { text: 'Go to the tower', kind: 'goto', target: { x: 1760, y: 1556 }, radius: 90 },
      {
        text: 'Deliver to the hospital',
        kind: 'goto',
        target: { x: 2400, y: 910 },
        radius: 70,
        timer: CFG.missions.m4Timer,
        timerFail: true,
        onStart: (G) => G.addHeat(CFG.missions.m4DeliverHeat),
      },
    ],
  },
  {
    id: 4,
    name: "La Reina's Due",
    intro: [
      'Vera Castellanos: Milo Reyes. You owe me five thousand, and I am done waiting.',
      'Vera: My guards are at the tower. Come and settle it.',
    ],
    outro: 'The debt is paid. Solmar is yours again, Milo Reyes.',
    reward: CFG.missions.m5Reward,
    steps: [
      { text: 'Go to the tower', kind: 'goto', target: { x: 1760, y: 1556 }, radius: 90 },
      {
        text: "Take down La Reina's guards",
        kind: 'kills',
        count: CFG.missions.m5Guards,
        onStart: (G) => {
          const spots = [
            { x: 1700, y: 1530 },
            { x: 1820, y: 1530 },
            { x: 1730, y: 1590 },
            { x: 1790, y: 1590 },
          ];
          for (const s of spots) spawnGuard(G, s.x, s.y);
        },
      },
      {
        text: 'Lose the heat',
        kind: 'stars0',
        onStart: (G) => G.setHeat(CFG.missions.m5EscapeHeat),
      },
    ],
  },
];

export function startMission(G, index) {
  const def = MISSIONS[index];
  G.mission = {
    def,
    index,
    step: 0,
    active: true,
    kills: 0,
    timer: 0,
    timerMax: 0,
    stepStarted: false,
  };
  enterStep(G);
  G.say(def.intro);
}

function enterStep(G) {
  const m = G.mission;
  const step = m.def.steps[m.step];
  m.stepStarted = true;
  m.timer = step.timer || 0;
  m.timerMax = step.timer || 0;
  if (step.onStart) step.onStart(G);
}

function advanceStep(G) {
  const m = G.mission;
  m.step++;
  if (m.step >= m.def.steps.length) {
    completeMission(G);
    return;
  }
  enterStep(G);
}

export function restartMission(G) {
  const index = G.mission ? G.mission.index : 0;
  startMission(G, index);
}

function completeMission(G) {
  const m = G.mission;
  const def = m.def;
  G.player.cash += def.reward;
  G.completedMissions.add(m.index);
  if (def.onComplete) def.onComplete(G);
  m.active = false;
  G.audio.missionDone();
  G.say([def.outro]);
  const save = {
    cash: G.player.cash,
    missionIndex: m.index + 1 < MISSIONS.length ? m.index + 1 : -1,
    completed: G.completedMissions.size,
    x: Math.round(G.player.x * 100) / 100,
    y: Math.round(G.player.y * 100) / 100,
    health: Math.round(G.player.health),
    savedAt: Date.now(),
  };
  writeSave(save);
  G.state = m.index === MISSIONS.length - 1 ? 'storyComplete' : 'missionComplete';
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m || !m.active || G.state !== 'playing') return;
  const step = m.def.steps[m.step];
  if (!step) return;
  const p = G.player;

  if (step.kind === 'car') {
    if (p.car) advanceStep(G);
    return;
  }
  if (step.kind === 'sport') {
    if (p.car && p.car.type === 'sport') advanceStep(G);
    return;
  }
  if (step.kind === 'goto') {
    const d = Math.hypot(p.x - step.target.x, p.y - step.target.y);
    if (step.timer) {
      m.timer -= dt;
      if (m.timer <= 0) {
        restartMission(G);
        return;
      }
    }
    if (d <= step.radius) advanceStep(G);
    return;
  }
  if (step.kind === 'timer') {
    m.timer -= dt;
    if (m.timer <= 0) advanceStep(G);
    return;
  }
  if (step.kind === 'kills') {
    if (m.kills >= step.count) advanceStep(G);
    return;
  }
  if (step.kind === 'stars0') {
    if (G.wanted.stars === 0) advanceStep(G);
    return;
  }
}

export function missionTarget(G) {
  const m = G.mission;
  if (!m || !m.active) return null;
  const step = m.def.steps[m.step];
  if (!step) return null;
  if (step.kind === 'goto') return { x: step.target.x, y: step.target.y };
  if (step.kind === 'sport') {
    const gt = G.cars.find((c) => c.type === 'sport' && !c.dead);
    return gt ? { x: gt.x, y: gt.y } : null;
  }
  return null;
}

export function objectiveText(G) {
  const m = G.mission;
  if (!m || !m.active) return 'Free roam — Solmar is yours';
  const step = m.def.steps[m.step];
  if (!step) return m.def.name;
  let text = `${m.def.name}: ${step.text}`;
  if (step.timer && m.timer > 0) {
    text += ` — ${Math.ceil(m.timer)}s`;
  }
  if (step.kind === 'kills') {
    text += ` — ${m.kills}/${step.count}`;
  }
  return text;
}
