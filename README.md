# SOLMAR — Streets of the Sun

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/Kaksyeh/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/Kaksyeh/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D top-down open-world crime game, built for the
[make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01). No Rockstar
content, no assets from any other game — every line of code, every
sprite shape and every sound is made here, with plain JavaScript and
the HTML canvas. It runs from static files in a desktop browser with
no network requests.

## The story

Milo Reyes is back in Solmar. His brother owes Vera Castellanos —
La Reina — five thousand dollars, and she is done waiting. Work
through five story missions with Ray as your fixer: steal a car, take
the pink Comet GT from the Marina, survive the heat when Solmar PD
comes down on you, run a timed drop to the hospital, and finally
settle the debt at the tower.

## How to play

Open `game/index.html` (or serve the `game/` folder) and press Enter.

| Key | Action |
| --- | --- |
| WASD / arrows | Walk, and drive when in a car |
| E | Steal a parked car / get out |
| F | Punch (on foot) |
| Mouse | Aim the pistol (after Hot Wheels) — hold click to fire |
| P | Pause |
| M | Mute |

## The city

Solmar is a 3200×3200 island city on a fixed seed: 150 buildings, a
road grid, a beach along the south edge, and six landmarks — Solmar PD
HQ, the hospital, the tower, the Docks, the Marina and the Garage.
Forty pedestrians walk the streets, thirteen traffic cars drive the
grid, and twenty-eight parked cars wait to be taken. The Comet GT,
the fastest car in the city, sits at the Marina.

## Wanted

Heat runs 0–100 and shows as 0–5 stars. Punching, shooting, jacking
a moving car and running people over all add heat. After a quiet
spell it fades, one star at a time. Police cars chase your ride and
ram it; at two stars or more, foot officers chase you on foot and
will arrest you if they catch you. Get WASTED and you wake at the
hospital, one hundred dollars lighter, with the mission restarted.

## Progress

Missions save automatically after each one. The title screen offers
CONTINUE when a save exists. Nothing leaves the browser: the save
lives in `localStorage`.

## Structure

- `game/index.html` — the shell, a canvas and one module script.
- `game/src/config.js` — every tuning number, in one place.
- `game/src/random.js` — the seeded random generator and helpers.
- `game/src/city.js` — the island, roads, buildings and collision.
- `game/src/input.js` — keyboard and mouse state.
- `game/src/audio.js` — synthesized sound effects and music.
- `game/src/save.js` — the localStorage save.
- `game/src/entities.js` — the player, pedestrians, guards, officers.
- `game/src/vehicles.js` — car physics, stealing, traffic, pursuit.
- `game/src/wanted.js` — heat, stars, police response.
- `game/src/combat.js` — the pistol, bullets, guard fire.
- `game/src/missions.js` — the five-mission story arc.
- `game/src/render.js` — the world, HUD, minimap and screens.
- `game/src/shots.js` — staging for the four screenshots.
- `game/src/main.js` — the entrypoint and the frame loop.
- `shots.json` — the four screenshots.
- `screenshots/` — real renders of the running game.
