// SOLMAR — shots.js: deterministic screenshot scenes for the entry's screenshots.
// The page reads ?shot=<name>&seed=<n> and this module stages the scene before the
// first frame: where the player stands, what they drive, how hot the wanted level
// is, and which mission is on the HUD. The game then runs live from there.

import { CAR_TYPES } from './config.js';
import { startMission, missionObjectiveText } from './missions.js';
import { addHeat, spawnPed } from './entities.js';
import { makeCar, spawnPoliceCar } from './vehicles.js';

function findCar(G, type) {
  return G.cars.find((c) => c.type === type && !c.dead);
}

function putPlayerInCar(G, car, speed) {
  const p = G.player;
  car.driver = 'player';
  car.kind = car.kind === 'police' ? 'police' : 'player';
  car.speed = speed;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
}

export function applyShot(G, shot) {
  const p = G.player;
  G.playStartedAt = G.time - 30; // hide the controls hint
  G.shotMode = true;

  if (shot === 'title') {
    G.state = 'title';
    return;
  }

  G.state = 'playing';

  if (shot === 'streets') {
    // On foot at a busy downtown intersection: traffic rolling past, pedestrians
    // on the sidewalks, a parked sedan waiting to be borrowed.
    p.x = 1560;
    p.y = 1540;
    p.angle = 0;
    const sedan = findCar(G, 'sedan');
    if (sedan) {
      sedan.x = 1470;
      sedan.y = 1610;
      sedan.angle = 0;
    }
    spawnPed(G, 1620, 1500);
    spawnPed(G, 1500, 1470);
    G.showcaseObjective = 'Free roam — steal a car, lose the cops, run the story';
    return;
  }

  if (shot === 'mission') {
    // On foot at the Marina, one star on the board, the Comet GT waiting to be stolen.
    const m = G.city.landmarks.marina;
    p.x = m.x - 60;
    p.y = m.y - 40;
    p.angle = 0;
    startMission(G, 1);
    G.mission.step = 1;
    const car = findCar(G, 'sport');
    if (car) {
      car.x = m.x + 40;
      car.y = m.y + 20;
      G.mission.targetCar = car;
    }
    addHeat(G, 20);
    const cop = spawnPoliceCar(G, p.x - 320, p.y + 120);
    cop.speed = 200;
    cop.angle = 0;
    // A few onlookers by the boats.
    spawnPed(G, m.x + 120, m.y - 60);
    spawnPed(G, m.x + 180, m.y + 30);
    return;
  }

  if (shot === 'chase') {
    // The cover: a three-star police chase in the Comet GT, mission clock running.
    let car = findCar(G, 'sport');
    car.x = 1500;
    car.y = 1600;
    car.angle = 0;
    car.axis = undefined;
    putPlayerInCar(G, car, 380);
    G.shotDrive = true;
    startMission(G, 2); // its first step adds the 3-star heat itself
    G.mission.timer = 47;
    // Three interceptors in pursuit, staggered behind and beside the player.
    const spots = [
      { x: 1180, y: 1600, angle: 0 },
      { x: 1300, y: 1690, angle: 0 },
      { x: 1420, y: 1510, angle: 0 },
    ];
    for (const s of spots) {
      const pc = spawnPoliceCar(G, s.x, s.y);
      pc.angle = s.angle;
      pc.speed = 330;
    }
    // Traffic to weave through.
    const t1 = findCar(G, 'taxi');
    if (t1) {
      t1.x = 1900;
      t1.y = 1610;
      t1.axis = 'h';
      t1.dir = 1;
      t1.line = 1600;
      t1.lane = 10;
      t1.speed = 130;
    }
    return;
  }

  // Unknown shot name: plain free roam.
  G.showcaseObjective = 'Free roam — steal a car, lose the cops, run the story';
}

export { missionObjectiveText };
