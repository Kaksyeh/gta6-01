// Screenshot staging: each shot in shots.json loads the game with a
// ?shot= name and this module arranges a real scene — a police chase, a
// mission moment, a street, the title — then the game runs on its own.
import { startMission } from './missions.js';
import { stealNearestCar } from './vehicles.js';

export function stageShot(G, name) {
  if (name === 'chase') {
    // Milo in the Comet GT with three stars of heat and pursuit behind him.
    G.state = 'playing';
    startMission(G, 1);
    const gt = G.cars.find((c) => c.type === 'sport');
    gt.x = 1600;
    gt.y = 1280;
    gt.angle = 0;
    G.player.x = 1600;
    G.player.y = 1280;
    stealNearestCar(G);
    G.player.cash = 1700;
    G.setHeat(60);
    G.camera.x = 1600;
    G.camera.y = 1280;
    // Hold the accelerator so the chase is actually moving in the shot.
    G.input.inject.KeyW = true;
    return;
  }
  if (name === 'mission') {
    // La Reina's guards at the tower, Milo on foot with a pistol.
    G.state = 'playing';
    G.player.hasPistol = true;
    G.player.weapon = 'pistol';
    G.player.cash = 5200;
    startMission(G, 4);
    G.player.x = 1760;
    G.player.y = 1620;
    G.player.angle = -Math.PI / 2;
    G.camera.x = 1760;
    G.camera.y = 1560;
    return;
  }
  if (name === 'streets') {
    // A busy intersection: traffic, pedestrians, parked cars.
    G.state = 'playing';
    startMission(G, 0);
    G.player.x = 1280;
    G.player.y = 1280;
    G.player.angle = 0;
    G.player.cash = 500;
    G.camera.x = 1280;
    G.camera.y = 1280;
    return;
  }
  if (name === 'title') {
    G.state = 'title';
    G.camera.x = 1600;
    G.camera.y = 1600;
    return;
  }
}
