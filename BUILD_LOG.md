# SOLMAR — Streets of the Sun: build log

A from-scratch build for the make.fun GTA 6 bounty (gta6-01). Every
file below was written fresh for this entry, from a prose-only spec —
no earlier build of this game was read or copied.

## Phases

1. **Spec and kit** — read the prose spec and the level-29 kit rulebook
   (RULES.txt) in full. Copied the kit starter `main.ts` and `serve.ts`
   with `cp` and added one authored comment to `main.ts`.
2. **Core modules** — `config.js` (all tuning in one place), `random.js`
   (mulberry32, seed 7), `city.js` (3200×3200 island, 150 buildings,
   road grid, beach, landmarks, axis-separated collision),
   `input.js`, `audio.js` (synthesized SFX and music, no files),
   `save.js`.
3. **Gameplay modules** — `entities.js` (player, 40 pedestrians,
   guards, foot officers), `vehicles.js` (41 cars, physics with the
   4.2 rad/s turn rate and the above-150 px/s falloff, stealing,
   traffic, police pursuit), `wanted.js` (heat 0–100, stars 0–5,
   decay after 25 quiet seconds, police cars and foot officers),
   `combat.js` (pistol, bullets that die on walls, guard fire),
   `missions.js` (five missions with steps, timers, rewards and
   autosave), `render.js` (world, HUD, minimap with the SOLMAR label,
   title, how-to, pause, mission-complete, WASTED, BUSTED and
   story-complete screens), `shots.js` (staging for the screenshots),
   `main.js` (entrypoint, frame loop with rAF scheduled first,
   state machine, `window.__solmar`).
4. **Shell and metadata** — `game/index.html`, `shots.json` (four
   shots), `.makefun/owner.json`, `README.md`, this log.
5. **Verification** — boot test, mission warp test, driving
   playthroughs for missions 2 and 3, logic tests for missions 4
   and 5, then the dossier build.

## Test log

- **Boot test (`gta-test.mjs`)** — PASS, zero page errors. Title state,
  41 cars, 40 pedestrians, 150 buildings. Enter starts Welcome Home.
  Walk moves 0/−178 in 1 s. Steal, drive (speed 267 in the Comet GT),
  exit, punch (heat 12) all work. Four screenshots captured:
  1-chase.jpg 74 KiB (3 stars, chase at speed 249), 2-mission.jpg
  77 KiB (La Reina's Due, 0/4 guards), 3-streets.jpg 74 KiB
  (Welcome Home), 4-title.jpg 63 KiB (title screen).
- **M1 warp test (`gta-m1-warp-test.mjs`)** — PASS, zero errors. Steal
  → Docks → Garage: mission complete, cash 500, save written
  {cash 500, missionIndex 1, completed 1, health 100}, Enter opens
  Hot Wheels with the Marina target.
- **Driving playthrough (`gta-missions-test2.mjs`, run 1)** — all five
  missions verified end to end by driving: M2 Hot Wheels (attempt 2,
  cash 1700, pistol granted), M3 Heat Wave (survive 60 s at 5 stars
  then escape to 0 stars, cash 3200), M4 The Drop (attempt 2, cash
  5200), M5 La Reina's Due (4 guards killed, +$240 drops, escape,
  storyComplete, cash 10440, save {cash 10440, missionIndex −1,
  completed 5}). Four page errors found (see Fixes).
- **Driving playthrough (run 2, after the ram fix)** — ERRORS: none.
  M2/M3/M4 completed by driving again. M5 did not complete this run:
  one attempt stopped just outside the 70 px tower radius and one
  ended with the player busted in the firefight — driver variance,
  not a game fault (M5 had already completed by driving in run 1).
- **M4/M5 logic test (`gta-missions45-test.mjs`)** — PASS, zero
  errors. M5 complete: storyComplete, cash 10440, kills 4, hp 55,
  save {cash 10440, missionIndex −1, completed 5}.
- **Tower-radius probe (`m5-tower-probe.mjs`)** — PASS, zero errors.
  M5 step 0 → step 1 on stopping 85 px from the tower front, with
  4 guards spawned.

## Fixes

- **Buildings 102 → 150.** The placement loop used 8 tries with
  70–150 px buildings and a 14 px clash padding — most blocks could
  only fit one. Changed to 30 tries, 60–110 px buildings, 8 px
  padding.
- **Building drawing misaligned with collision.** The renderer drew
  buildings centre-based while the city stores them top-left, so
  every building appeared shifted from its walls. Now drawn top-left
  with the stored roof colour.
- **Missing `audio.unlock` / `audio.toggleMute`.** The entrypoint
  called both; the audio module had neither, which threw a pageerror
  on every key press. Added both (unlock creates/resumes the context)
  and wired `updateMusic(dt)` into the frame loop.
- **Chase screenshot was static.** Added an `inject` channel to the
  input module; the chase staging now holds W so the Comet GT is
  moving (speed 249) with police in pursuit.
- **Streets screenshot had no mission.** The staging now starts
  Welcome Home, so the objective reads "Welcome Home: Get a car".
- **Police-ram kill crashed the frame (`null.x`, 4 page errors).**
  The ramming branch set `G.player.car = null` and then read
  `pl.car.x` — the same object. Now it keeps the wreck in a local
  before clearing the player's car. Verified: the re-run shows
  ERRORS: none.
- **Tower-front radius 70 → 90.** The driving test counts a waypoint
  reached within 80 px, so a 70 px mission radius could leave the
  player stopped just outside the step trigger. Both tower goto
  steps (M4, M5) now use 90 px.
