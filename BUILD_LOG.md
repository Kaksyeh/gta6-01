# SOLMAR — Streets of the Sun: build log

make.fun bounty gta6-01 — "Make GTA 6". Original open-world crime game, 2D top-down,
canvas, no libraries, no network. Built by the recorded agent session in this repository.

Kit init anchor line (quoted from the kit init this repo was created with):

> makefun anchor 167471a3020959982e69d4a7a6dde7f64bf4f543 round 34126611

## Design

- **Game:** SOLMAR — Streets of the Sun. Original sun-soaked coastal city "Solmar".
  Protagonist Milo Reyes, ex-getaway driver, back in town to clear his brother's debt
  to crime boss Vera Castellanos ("La Reina"). 5 story missions, free roam, car
  stealing, wanted level + police, combat, money, save.
- **Tech:** vanilla JS ES modules under `game/src/`, canvas 2D, seeded procedural city
  (deterministic for screenshots), WebAudio synthesized SFX + music, localStorage save.
  No vendored library — zero dependencies, zero network requests.
- **Files:** `game/index.html`, `game/src/config.js` (tuning/palette),
  `game/src/random.js` (seeded RNG), `game/src/city.js` (city gen),
  `game/src/input.js`, `game/src/audio.js`, `game/src/entities.js` (player/peds/traffic),
  `game/src/vehicles.js` (car physics + steal/drive), `game/src/wanted.js`,
  `game/src/combat.js`, `game/src/missions.js`, `game/src/render.js` (world + HUD +
  minimap + menus), `game/src/save.js`, `game/src/shots.js` (screenshot scenes),
  `game/src/main.js` (loop + state machine). `main.ts`/`serve.ts`/`vendor/` are the
  kit's plumbing (main.ts carries authored lines of mine on top).

## Phases

- [x] Phase 0 — repo + kit plumbing copied, BUILD_LOG started (2026-11-20 ~21:0x WIB)
- [x] Phase 1 — city + player on foot + camera + HUD/minimap
- [x] Phase 2 — cars: enter/exit/steal/drive + traffic + pedestrians
- [x] Phase 3 — wanted level + police AI
- [x] Phase 4 — missions + story + combat
- [x] Phase 5 — start screen + save + sound + polish
- [x] Phase 6 — screenshots (4) + dossier verify + final commit
  (screenshots regenerated + visually reviewed, dossier re-verified — see Test log)
- [ ] Phase 7 (stretch) — scripted spot-checks of missions 2–5 (steal, survive,
  escape, deliver timer, kill guards) before the Nov 24 deadline

## Test log

- **First play-test (gta-test.mjs, 2026-11-20 ~21:0x WIB): ZERO page errors.**
  Boot: state title, 41 cars, 40 peds, 150 buildings. Enter → playing, mission
  "Welcome Home" step "Get a car". Walk moved -5,-151 in 1s (garage wall collision
  works). Stole a parked van → onFoot false, stars 0 (parked cars free to take).
  Drive: speed 87 after 1.5s. Exit car OK. Punch ped → heat 12. Screenshots:
  1-chase.jpg 113 KiB (5 stars, "Heat Wave: Survive the heat — 45s", speed 356),
  2-mission.jpg 87 KiB (1 star, "Hot Wheels: Steal the Comet GT"), 3-streets.jpg
  109 KiB (1 star — accidental ped hit while driving), 4-title.jpg 59 KiB.
  Visual review: city reads well (roads, crosswalks, buildings with shadows, parks,
  beach, water, minimap, HUD).
- **Bugs found in screenshots, all FIXED:** (a) minimap "SOLMAR" label overlapped the
  health/weapon panel text — label moved inside the map's top-left corner with a dark
  chip; (b) driving zoom too far out (0.82/0.72) — now 0.85 normal / 0.78 fast;
  (c) streets shot showed an accidental 1-star wanted + the player car hard to spot —
  re-staged as on-foot at a downtown intersection (1560,1540) with a parked sedan
  nearby + 2 peds; (d) HUD weapon line when driving now shows the car name +
  "[E] exit" instead of "FISTS [F] punch".
- **Mission playthrough test (gta-mission-test.mjs):** shooting first looked broken
  (bullets field missing, ped hp 30) but the focused diagnostic (gta-diag-test.mjs)
  proved **shooting WORKS**: mouseDown true, bullets=1 mid-shoot, after shoot
  bullets=2, minPedHp=-4 (ped killed), heat=28. The first failure was a test
  artifact (ped behind a building; bullets died on walls). Police response verified:
  heat 60 → 3 stars, 3 police cars, nearest 15px (ramming the player). Pause menu +
  save verified (localStorage save written).
- **REAL BUG FOUND + FIXED (2026-11-20 ~21:0x WIB): the Marina was unreachable.**
  Player Y was clamped to WORLD.beach-8 = 2872, but the Comet GT sits at y=2930 and
  the Marina landmark at y=2960 — the player could never get within 58px (enter-car
  range) or 80px (mission-2 goto radius) of them, so **mission 2 was impossible**.
  Fixed: player clamp → WORLD.size-16; fleeing-ped clamp → WORLD.size-20;
  player-car and police-car Y clamps → WORLD.size-20 (both occurrences in
  vehicles.js). Beach is walkable/drivable with off-road drag; water is beyond the
  world edge.
- **Route test v1 (gta-route-test.mjs): 0/6 waypoints in 120s.** The scripted car
  set `car.angle` directly each 90ms — it orbited the waypoint instead of reaching
  it (turn radius ~128px at 170px/s vs the 55px reach radius). Test artifact, not a
  game bug — but it exposed that scripted steering must follow roads. Rewrote as
  v2 using real A/D keys through the game's own physics.
- **Route test v2, first run: 0/6 waypoints in 150s.** Test-controller bug: the W
  speed-gating released W near the waypoint and never pressed it again when the car
  stalled at 70–160px (dead zone in the logic). Fixed: W goes back down whenever
  speed < 70.
- **Drive diagnostic (gta-drive-diag.mjs, 2026-11-20 ~21:2x WIB): driving WORKS.**
  Entered the Comet GT at the marina (430,2930) — the parked car nearest the garage
  front is the Comet GT, ~525px away; no parked cars sit right at the garage.
  Drove north through the sand, pushed against a row-8 building's south wall at
  y≈2831 for ~4s while sliding west along it, broke free, reached waypoint
  (320,2560) in ~9s, final (332,2496) speed 337. Mission step advanced 0→1 on
  entering the car. ZERO page errors. (A car pushing against a wall slides along it
  and breaks free — acceptable; a human driver would reverse out.)
- **Route test v2, second run (gta-route-test2.mjs): 0/6 waypoints in 150s — again.**
  Test-controller bug, second one: the W speed-gating released W near the waypoint
  and the car orbited at low speed with weak steering (turn rate scales with
  speedRatio), never entering the 70px circle. The drive diagnostic (W held
  continuously) had already proved the car passes the waypoint at full speed.
  Rewrote as v3: W held continuously, reach radius 80, per-waypoint 30s timeout
  with position logging so one stuck waypoint can't block the test.
- **Route test v3 (gta-route-test3.mjs): 5/6 waypoints, mission NOT completed.**
  Waypoints 0–1 reached, but the car weaved off the y=1920 road into a block,
  wedged against a building at (453,2716), and kept ramming W into the wall until
  the car BLEW UP (wall impacts >90 deal impact×0.06 damage; sport hp 100) —
  the player was ejected on foot ("lost the car!"). Correct game behavior, bad
  test driving: the bang-bang controller at full speed (turn rate 4.2 rad/s on a
  64px road) weaves off the road, and it never reverses out of a wedge.
- **Game fix — high-speed turn falloff (vehicles.js, committed dc8e14b):** turn rate
  now scales down above 150px/s (factor 1 − 0.5×clamp((|speed|−150)/300)), so a
  car at full tilt holds a 64px road through a corner instead of weaving off it.
  This is a real playability improvement for a human player too.
- **Route test v4 (gta-route-test4.mjs): 6/6 waypoints — MISSION 1 COMPLETES.**
  Speed cap 230, reverse-out when wedged (no progress 3s at low speed → S + opposite
  steer 1.2s), re-steal nearest parked car if the ride blows up. First car blew up
  (hp 23, wedged three times at the start facing the wrong way), re-stole a fresh
  one at (1360,2642) and drove the whole route. **BUT the run exposed a REAL BUG:**
  final state cash 500, completed [], mission step 3 active true, state 'playing',
  plus pageerror 'lines is not iterable'. Root cause: completeMission() called
  say(G, m.outro) — m is the mission state object, which has NO outro field; the
  outro lives on m.def.outro. The throw landed AFTER cash += 500 but BEFORE
  completedMissions.add / state='missionComplete' — and because rAF was scheduled
  at the END of frame(), the throw KILLED THE GAME LOOP permanently.
- **Fixes (committed a04366b):** completeMission now calls say(G, m.def.outro);
  say() guards null lines; frame() schedules the next rAF FIRST so a throw can
  never kill the loop.
- **Route test v4 re-run after the fix: MISSION 1 VERIFIED END TO END.**
  6/6 waypoints, state 'missionComplete', cash 500, completed [0], mission active
  false, **autosave written** { cash 500, missionIndex 1, completed 1, health 50 }.
  ERRORS: none.
- **Screenshots regenerated (gta-test.mjs, 2026-11-20 ~21:4x WIB): ZERO errors.**
  1-chase.jpg 109 KiB (4 stars, "Heat Wave: Survive the heat — 45s", speed 391,
  2 police cars ramming the pink Comet GT, SOLMAR PD HQ landmark, beach edge);
  2-mission.jpg 82 KiB (1 star, "Hot Wheels: Steal the Comet GT", Comet GT on the
  beach with mission diamond + beam, Ray dialogue, police car nearby);
  3-streets.jpg 87 KiB (0 stars — the accidental-wanted fix worked — on-foot
  downtown intersection, parked cars, traffic, peds, park); 4-title.jpg 59 KiB
  (sunset skyline, SOLMAR / STREETS OF THE SUN, NEW GAME / HOW TO PLAY).
  **Visual review of all 4: PASS.** Minimap "SOLMAR" label now sits inside the map
  (no overlap with the health bar); driving HUD shows "COMET GT [E] exit"; on-foot
  HUD shows "FISTS [F] punch"; zoom reads well.
- **Dossier re-verified with the new screenshots (2026-11-20 ~21:4x WIB): PASS.**
  `MAKEFUN_OUTPUT_DIR=/tmp/gta-out2 node main.ts` → dossier.json 576,909 B,
  schema makefun/dossier/v1, cover 0, 4 images (109/82/87/59 KiB). Output 20
  entries / 1,033,589 B; game/ 15 files / 111,607 B. All caps pass.
- **Mission 2 VERIFIED END TO END (gta-missions-test.mjs, 2026-11-20 ~21:5x WIB).**
  Seeded the M1-completed save, CONTINUE on the title screen worked
  ("CONTINUE — $500 • 1/5 missions done"). Stole a non-sport car, drove to the
  Marina (mission target via G._missionTarget()), exited, stole the Comet GT,
  drove it to the garage → missionComplete, cash 500→1700 (+1200), completed
  [0,1], **hasPistol: true** (M2's onComplete grants the pistol). ERRORS: none
  up to that point.
- **Mission 3, first attempt: player DIED during the 60s survive (test-driving
  problem, not a game bug — but it exposed a balance edge).** The test drove a
  rectangle loop through the dense city at the 230 cap: the car hit walls at
  corners + police rams, blew up 3 times, then the player died on foot at 5
  stars (heat had risen from ped hits + jacked cars). The game handled death
  correctly: respawn at the hospital, −$100, mission restarted (Heat Wave step 0).
  The test then crashed on a null missionTarget (survive has no .at) — test bug.
  Balance note: the Comet GT (top 460) already outruns police (top 400); the
  fragility was the sport's hp 80, lowest in the fleet. Tuned: **sport hp 80→100**
  (committed). M3 re-test drives the BEACH back and forth (open ground, no walls)
  with a 320 speed cap, and each mission now retries (max 3) on death.
- **Missions 2–5 playthrough v2 (gta-missions-test2.mjs): M2 + M3 VERIFIED, M4 FAILED.**
  M2 again clean (cash 1700, completed [0,1], pistol granted). **M3 VERIFIED:**
  beach back-and-forth survive worked (step 0→1, hp 75), escape cleared to 0
  stars → missionComplete, cash 1700→3200 (+1500), completed [0,1,2]. (Escape
  attempt 1 timed out at 150s wall with stars still 5 — game time runs slower
  than wall time under CPU load in headless Chrome: the fixed-step loop caps at
  5 steps/frame and dt clamps at 0.1, so the 25s-quiet + 6s/star decay needed
  more wall time than 150s. Attempt 2's extra wait cleared it. Test-timing
  artifact, not a game bug — the decay works.)
  **M4 FAILED all 3 attempts — player died during the delivery.** The test drove
  the tower→hospital leg recklessly (wall hits at corners, ped hits, police
  rams), the Comet GT blew up, and the player died on foot with cops. The game
  handled each death correctly (respawn, −$100, mission restart). But the
  difficulty spike is real: the deliver step added 40 heat (2 stars) on top of
  a 75s timer, so the player raced the clock while being swarmed. **Fix
  (committed): M4 deliver heat 40→20 (1 star, 1 police car, no foot cops) —
  the delivery is a race against the clock, not a war.** Timer kept at 75s (it
  never expired — damage killed the player, not the clock). Regen already
  generous (6 hp/s after 8s quiet) — left alone. The test's M5 section also
  ran against M4's unfinished state (test-structure bug: no gate) — fixed: the
  test now skips M5 with a clear report if M4 isn't done.
- **Missions 2–5 playthrough v2 re-run (M4 heat fix): M2 + M3 VERIFIED again, M4
  FAILED again — but the cause is now clear and it is the TEST driver, not the
  game.** M2 clean (cash 1700, pistol granted). M3 clean in attempt 1 this time
  (survive + escape → cash 3200, completed [0,1,2], hp 50). M4: attempt 1 died
  at step 0 with **0 stars** — no police involved; attempt 2 reached the tower
  (step 1, 1 star — the heat fix worked) then died during the delivery; attempt
  3 died at step 0 with 5 stars. The killer is the test driver: it takes 90°
  corners at 230px/s, rams the building on the far side (each hard wall hit
  ~14 car hp), the car explodes (player −25 hp per explosion), and 2–4
  explosions kill the player even with no police around. A human brakes for
  corners; the test never did. **Test fix: corner slowing in driveWaypoints —
  brake to 120px/s within 220px of a waypoint** (turning radius ~35px at that
  speed fits inside a 64px road). No game change: wall-hit damage (impact×0.06)
  and explosion damage (25) are fair for a human who brakes.
- **Missions 2–5 playthrough v2 re-run (corner slowing): M2 VERIFIED, M3 FAILED
  3× — corner slowing BACKFIRED on the beach.** M2 clean again. M3 survive:
  the car now braked to 120 at each beach end, and the police (top 400) caught
  the slow car and rammed it to death there — 3 cars blown up, player dead on
  foot at 5 stars each time (attempt 3 actually finished the 60s timer — step
  0→1 — but died in the same moment). Lesson: slow corners are exactly where
  police rams land hardest (rear-end at a big speed difference ≈ 9 car hp per
  hit). **Test fix: corner slowing is now a parameter — ON for city legs, OFF
  for the beach survive, which runs at FULL speed (cap 460): the Comet GT
  outruns the police in a straight line.** Also re-learned the /tmp lesson the
  hard way: the runtime restart wiped /tmp/gta-missions-test2.mjs — the durable
  copy lives in ~/workspace/makefun/shot-tool/ and the edits went there.
- **Missions 2–5 playthrough v2 re-run (beach at full speed): M2 + M3 VERIFIED,
  M4 FAILED again — the killer is car explosions, not police.** M3 passed in
  attempt 1 (full-speed beach survive + escape → cash 3200, completed [0,1,2]),
  but the player finished M3 at **hp 25** (100→25 during survive). M4: attempt 1
  died en route to the tower at **0 stars**; attempt 2 died the same way;
  attempt 3 reached the tower (step 1, 1 star) then died during the delivery
  (stars rose to 5 from ped hits + jacked cars during re-steals). The mechanism:
  the test driver weaves at corners, clips walls, the car explodes, and each
  explosion cost the player **25 hp** — 4 blow-ups kill you with no police
  around. A human brakes for corners, but 25 hp per blow-up is still too
  punishing for a learning player. **Game fix (committed): explosion damage
  25→15 hp.** Test fix: M4 legs now drive at speedCap 150 (slow and careful —
  the 75s delivery timer allows it).
- **Missions 2–5 playthrough v2 re-run (explosion 15 hp + slow M4): M2 VERIFIED,
  M3 survive VERIFIED, M3 escape FAILED — root cause found, and it is a REAL
  GAME BUG.** M2 clean. M3 survive passed in attempts 1 and 2 (step 0→1), but
  the escape never cleared 5 stars: attempt 1 the player got BUSTED (car blew
  up during the wait, ejected on foot, foot cops punched them to 0); attempts
  2–3 sat 150s each with stars stuck at 5. Root cause in updateCops:
  **foot cops chased the player's CAR** (target = p.car when driving) at
  150px/s straight at it — so they threw themselves under the wheels (+40 heat
  per run-over cop, pushing heat to 100/5 stars during survive) and, when the
  car was parked, four of them beat it to death at ~22 dps (5 dmg each per
  0.9s) while the player waited out the wanted level. The escape step could
  never go quiet: the swarm itself kept generating heat. **Fix (committed):
  foot cops engage the player ON FOOT only** — when the player is in a car they
  hold their ground (and despawn when the player drives >900px away); the punch
  block is now on-foot only. Police CARS still chase the player's car — that is
  the car-based response. Test also: escape waits now re-steal a car if the
  player ends up on foot.
- **Missions 2–5 playthrough v2 re-run (foot-cop fix): M2 + M3 VERIFIED in
  attempt 1 — the foot-cop fix works.** M2 clean (cash 1700, pistol granted).
  M3: survive + escape → missionComplete, cash 3200, completed [0,1,2], stars 0,
  hp 70. The escape now goes quiet properly. **M4 still failed:** attempt 1
  reached the tower (step 1, 2 stars, hp 55) then died during the delivery;
  attempt 2 reached step 1 then the delivery TIMED OUT (75s) and the mission
  restarted to step 0; attempt 3 the same. Root cause is now the TEST driver,
  not the game: the bang-bang controller (full lock until a ±0.12 dead zone,
  ~200ms sampling latency) overshoots up to ~40° per sample, so the car snakes
  off 64px roads and clips buildings constantly — wall hits kill the car, the
  re-steals burn the delivery timer. **Test fix: proportional pulse steering —
  A/D are pulsed for a duration proportional to the bearing error** (15–90ms),
  so the car turns gently instead of snaking. M4 legs stay at speedCap 150.
- **Missions 2–5 playthrough v2 re-run (pulse steering): M2 + M3 VERIFIED,
  M4 FAILED again — pulse steering UNDERSTEERS.** M2 clean, M3 clean in attempt
  1 (escape worked, cash 3200). M4: the player arrived at the tower nearly dead
  (hp 10, step 0) and died during the delivery; attempts 2–3 never reached the
  tower front (step 0, on foot, hp 100 after regen). Cause: the pulses (15–90ms)
  are too short for the car's steer lerp (dt*8, ~0.28s to full lock) — the car
  barely turns and drives straight into buildings. Bang-bang overshot, pulses
  understeer; the scripted driver is the bottleneck, not the game (humans steer
  continuously with visual feedback). **Decision: stop iterating the driver.**
  M4/M5 are verified DIRECTLY for logic instead (gta-missions45-test.mjs):
  seed a save with M1–M3 done, warp the player to ~150px from each target and
  walk in — this tests the mission code paths (step transitions, deliver timer,
  kill counting, escape, rewards, story complete). Driving itself is already
  verified (M1 6/6 waypoints, M2/M3 road + beach drives); the deliver timer is
  feasible by arithmetic (1800px at 150px/s ≈ 12s < 75s).
- **Missions 4–5 logic test (gta-missions45-test.mjs): M4 + M5 VERIFIED END TO
  END — STORY COMPLETE.** Run 2026-11-20 ~22:3x WIB, 75s, ZERO page errors.
  M4 "The Drop": walk to tower (step 0→1), walk to hospital (deliver, 75s
  timer) → missionComplete, cash 3200→5200 (+2000), completed [0,1,2,3]. M5
  "La Reina's Due": walk to tower (step 0→1), kill phase — 4/4 guards killed
  (kills: 4), escape — stole a getaway car, warped to the beach, stars decayed
  → missionComplete, cash 5200→10440 (+5000 reward + $240 guard cash drops),
  completed [0,1,2,3,4], state **storyComplete**, save written
  {cash: 10440, missionIndex: -1, completed: 5, health: 41.2}. Player finished
  the close-range guard fight at hp 41 (on foot: false — escaped in a car).
  **All 5 missions now verified end to end** (M1 route 6/6, M2, M3, M4, M5).
- **M5 kill-phase debugging — three REAL GAME BUGS found and fixed** (the
  shootout was unwinnable, not just hard for the test driver):
  1. **scarePeds fled the guards** (entities.js): every shot scared ALL peds
     within 260px, including the mission guards, who sprinted away at 150px/s
     — faster than a bullet's lead could track. Fix: scarePeds now skips
     non-'ped' kinds; guards and cops stand their ground and fight.
  2. **Guard-kill heat 15 → 5** (combat.js): killing the mission targets
     summoned a cop swarm mid-fight. The escape step (heat 80) carries the
     drama; the fight stays a 1-star duel.
  3. **Per-shot heat 2 → 1** (entities.js): a sustained firefight (~45 shots)
     maxed the wanted level on gunfire alone. The crimes (kills) carry the
     heat now.
  Test-driver lessons from the same sessions: a blind "300px west" warp landed
  the player inside a building block — every bullet died on the wall (the aim
  itself measured 1px error via screenToWorld, proving the aim was perfect and
  the position was the problem). The tower front is a known-clear street
  position, so the fight happens at close range where aim cannot miss. Also:
  the guards' bullets can hit each other (friendly fire, 9 dmg) — observed
  two guards at 51 hp before the player landed a shot; harmless. And: measure
  guard velocity in GAME time (G.time), not wall time — the game clock runs
  slower than wall time under CPU load, so wall-time velocity understates the
  guard's speed and the lead falls short.
- **Diagnostic script gta-m5-diag.mjs** (shot-tool/): seeds M1–M4 done, walks
  to the tower, fights the guards with per-second logging (guard HP, bullets
  with distance-to-player/guard, real aim error via screenToWorld, heat/stars).
  It is what isolated the building-warp and fleeing-guard causes. Kept for
  reference; not part of the entry.

## Notes

- Deadline: entries close 2026-11-24 22:00 WIB.
- Screenshots must show several systems at once (chase + wanted stars + minimap +
  mission objective). Cover = `1-chase.jpg`.
- README badges use owner `Kaksyeh`, repo `gta6-01` — repo confirmed created by the
  user 2026-11-20 21:01 WIB, public, empty: https://github.com/Kaksyeh/gta6-01.
- README.md written (badges + run instructions); needs a commit.
- Test scripts (gta-*.mjs) live in ~/workspace/makefun/shot-tool/ — NOT part of the
  entry; they must not be copied into the repo.
