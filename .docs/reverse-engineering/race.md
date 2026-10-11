# The race: `Race_RunLoop`, `Race_Update` and the five timed states

Source: `LEGORacers.exe` (English, 1999-07-22). Every rule comes from decompiled code and, for float code, the disassembly. Anything not proven is marked **hypothesis**. The port is `packages/lego-racers/src/modules/race`; names are in `reverse-engineering/names/LEGORacers.exe.txt`. The pieces it wires are in [racer.md](racer.md), [ai.md](ai.md), [power-ups.md](power-ups.md), [physics.md](physics.md), [collision.md](collision.md), [random-table.md](random-table.md) and the race-data pages. The overall map is [game-map.md](game-map.md).

## Entry points

| Address                      | Name                           | What it does                                                                                                                                 |
| ---------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x004316e0`                 | `Race_Constructor`             | The race object, `0x3368` bytes, vtable `0x004b07f4`; `0x00431bd0` (`Race_ResetFields`) zeroes it                                            |
| `0x00431e00`                 | `Race_LoadRaceDescription`     | Reads the RAB, then `0x004327f0`, loads the worlds (`0x00432e20`), `Race_LoadTrackContent`, `Race_AcquireControllers`; sets state 1, timer 0 |
| `0x004327f0`                 | `Race_SetupFromSettings`       | Laps, multiplayer and demonstration flags (below)                                                                                            |
| `0x00433480`                 | `Race_LoadTrackContent`        | Loads checkpoints, routes, start grid, racers, sky, events, hazards, triggers, timers, HUDs and power-ups, in that order                     |
| `0x00432540`                 | `Race_RunLoop`                 | Per frame: timer, state function, `Update`, render                                                                                           |
| `0x00435220`                 | `Race_Update` (vtable `+0x30`) | The frame's simulation                                                                                                                       |
| `0x004349a0` .. `0x00435180` | `Race_UpdateState1` .. `5`     | The five timed states                                                                                                                        |

### Setup (`0x004327f0`)

- Local players `settings +0x32c` below 2: `race +0x3354` = 0 and laps `+0x3348` = 3; otherwise `+0x3354` = 1 and laps = `settings +0x2c`.
- Local players 0: it becomes 1, racer 0's kind (`settings +0x114`) becomes 0 and `+0x3350` = 1 (demonstration). `Race_LoadTrackContent` then runs `0x0043a0e0` on racer 0 and sets its flag `0x800000`.
- `settings +0x1e & 2`: `+0x335c` = 1 (countdown skipped).
- The mirror flag (`Race_LoadTrackContent`'s argument) sets the rubber band bias `+0x64c` to 0.05 (`0x004b07f0`).

### Start-up order in `Race_LoadTrackContent`, as far as the random table cursor goes

Computer routes (`Race_LoadAiRoutes`, one draw per computer racer, ported by `computer-racer-route`) → `RacerSet_Setup` (`0x0043b190`: per racer `0x00436df0` draws the taunt and voice timers, ported by `racer-ai`, then `0x0043d7a0` a third value) → timers (`Timers_Load`: one draw per randomised timer) → power-ups (`PowerUps_Initialize`: the wand draws). Loaders that are not ported (emitters, events, hazards, sky) may draw as well; their draws are unknown. The cursor at race start also depends on the menus (game-map.md): `RaceDefinition.randomPosition` is an input.

## Race state field table

| Race offset                       | Port field (`RaceState`)                                   | Meaning                                                                              |
| --------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `+0x04`                           | (`RaceDefinition`)                                         | Game settings                                                                        |
| `+0x258`, stride `0x74`           | `playerControllers`                                        | Player controllers (racer module)                                                    |
| `+0x334c`                         | `unidentifiedCountdownMilliseconds`                        | Counted down by `Race_Update`, 1,000 when the step exceeds it; no reader found       |
| `+0x3bc`                          | `racerSet`                                                 | Racers, rubber band, random position                                                 |
| `+0x6d4`                          | `playerRacerIndices`                                       | The racer each local player drives                                                   |
| `+0x6dc`                          | `powerUpStep`                                              | The power-ups                                                                        |
| `+0x2080/+0x2128/+0x213c/+0x2148` | `mainTriggers`, `environmentTriggers`, `timers`, `hazards` | Loaded and kept; per-frame logic not ported                                          |
| `+0x27f4`                         | `context.checkpoints`                                      | Checkpoints                                                                          |
| `+0x3328`                         | `phase`                                                    | State 1..5                                                                           |
| `+0x332c`                         | `phaseMilliseconds`                                        | Milliseconds in the state (unscaled frame time)                                      |
| `+0x3330`                         | `finishedRacerCount`                                       | Places given so far                                                                  |
| `+0x3334`                         | `isRunning`                                                | The loop runs while non-zero                                                         |
| `+0x3348` (byte)                  | `lapCount`                                                 | Laps to race                                                                         |
| `+0x3350`                         | `isDemonstration`                                          | Racer 0 driven by the computer                                                       |
| `+0x3354`                         | `isMultiplayer`                                            | Two or more local players                                                            |
| `+0x335c`                         | `isCountdownSkipped`                                       | Countdown skipped                                                                    |
| `+0x30c0`                         | not modelled                                               | Pause/menu state; when non-zero `Race_Update` runs only in cases `0x00436160` allows |
| `settings +0x15e + 0x5c·i`        | `placements`                                               | Final place of racer `i`                                                             |
| `settings +0x20`                  | `raceModeFlags`                                            | Bit `0x100`: time ×1.75; the rest is read by power-ups                               |

## The state machine

`Race_RunLoop` (`0x00432540`) starts with running = 1, state 1, timer 0. Each frame that is not paused (`application +0x82c`): if `+0x30c0` is 0, `timer += frameDelta` (`application +0x824`, **unscaled**); the state function; `Race_Update`; render. After the state function sets running to 0 the loop ends, after that frame's `Race_Update`.

| State | Function     | Name         | Leaves when                                                    | On leaving                                                                                                                                                                             |
| ----- | ------------ | ------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | `0x004349a0` | introduction | `timer >= 2000` and the intro camera is done                   | timer 0, state 2; each local player's racer: `0x004393d0` sets flag `0x400`; camera, HUD, force feedback; then state 2's function runs in the same frame                               |
| 2     | `0x00434b00` | countdown    | `timer >= 3000`, or `+0x335c`                                  | timer 0, state 3; `0x0043ccb0` releases every racer (`0x00439340`); `0x00430710` releases each player controller; `0x0045b900` enables brick sounds; places 0; state 3's function runs |
| 3     | `0x00434c80` | racing       | a human racer finishes (below)                                 | timer 0 (9000 with `+0x335c`), state 4; `0x00430760` disables that player's controller; state 4's function runs                                                                        |
| 4     | `0x00434eb0` | finishing    | `timer >= 10000` (ghost: 9501 pauses)                          | unplaced racers get the next places in racer order; `placements[i]` = each racer's place; timer 0, state 5; state 5's function runs                                                    |
| 5     | `0x00435180` | results      | at once (without the points record `race +0x18`; with it, 5 s) | timer 0; running = 0                                                                                                                                                                   |

- **Placing** (states 3 and 4): a racer whose `currentLap` (`+0xce4`) reaches `+0x3348` and whose flag `0x1000` is clear gets flag `0x1000`, `+0x3330 += 1` and `0x0043a210(racer, +0x3330)`. In state 3 only a racer that is not a computer (or racer 0 in a demonstration) ends the state; computers are just placed. In state 4 a finishing human also gets `0x00430760`.
- **Releasing a racer** (`0x00439340`): flag `0x2` cleared, a scripted car body released (`+0x748` = 0), zone history 0, 2, 1; a computer draws one low byte and, below its turbo chance, starts a level-0 turbo.
- **Releasing a player controller** (`0x00430710`): `stateFlags &= ~1`; a held start boost fires `0x0045b1e0` (level 1 above 59 ms, else 0) and clears; otherwise, when not accelerating, the boost window is 100 ms.
- **Disabling a player controller** (`0x00430760`): `stateFlags |= 2`; `0x0043a0e0` makes the racer a computer (`+0xd08` = 2; without a route `0x0043d070` is asked and driver flag `0x80` is set if it finds none); a power sliding racer runs `0x00439870`.

## `Race_Update` (`0x00435220`)

Skipped when `+0x30c0` is non-zero unless `+0x30a0 == 2` and `0x00436160` leaves `+0x30c0 != 3`. Otherwise, with `dt = frameDelta`, or `_ftol(dt · 1.75f)` when `settings +0x20 & 0x100`:

1. `+0x334c` counts down (1,000 when `dt` exceeds it).
2. World animations `0x00416090` (three worlds), `PowerUps_Update(dt)`, tagged positions `0x0045e470`, trigger and environment-trigger updates (vtable `+8`), emitters ×2, `0x00493a20`, `Events_Update`, `Hazards_Update`, `Timers_Update`, `0x00494f60`, `race +0xc` slot `+0x34`.
3. Unless a demonstration: for each local player `0x00421e30` (force feedback) and `PlayerController_Update(dt)`.
4. Sub-steps of at most 40 ms: `RacerSet_Step`, `Camera_Update` per player, `GhostRecorder_RecordSample`.
5. `0x00492870`, `0x0048ae00` (hazards against the camera), `Sky_Update`; states 2..4: the HUDs (`0x004351f0`).

## Lap counting, checkpoints and the wrong-way warning

- **Zones** (`0x00464680`, the main triggers' callback; `trigger.firstInteger` = 0, 1 or 2): `0x00439b70` zone 0, `0x00439ba0` zone 1 (the start line), `0x00439c40` zone 2. The racer keeps the last three zones (`+0xd0c`, `+0xd10`, `+0xd14`), reset to 0, 2, 1. Entering zone 1 from zone 0 with 2 and 1 before it counts a crossing (`+0xce8 += 1`); a crossing above `+0xce4` starts the next lap (`+0xce4 += 1`) and, when `0x0043cda0` gives a non-zero gap and the lap is below the lap count, `+0xd84` = 2,000. Every function ends by shifting the history.
- **Checkpoints** (`0x00439fc0`, called by the car body's contact filter `0x0042a830` for a digit-named collision object): side = the contact vector (`+0x24`) against the checkpoint plane normal is not below 0. Unchanged checkpoint and side: nothing. At the start line (progress 0): side 0 sets flag `0x80000` and zone history 0, 2, 2; side 1 adds a lap (`+0xd18`) unless `0x80000` is set, which it clears. At another checkpoint, `0x80000` set: lap − 1 and cleared. Then `+0xcc4`, `+0xcc8` = checkpoint, side.
- **Finish by object** (`0x0042a830`): touching a collision object flagged `0x40000` by `0x00435e70` sets `+0xce4` = `+0xce0` (lap count). Not ported.
- **Wrong way** (`0x00439cf0`, players only): with a checkpoint and not warping (flag `0x10` clears `0x6000`): the timer `+0xd78` counts down, clearing `0x4000` at 0. The car points along the checkpoint's plane normal when `(dz·nz + dy·ny) + dx·nx > 0.2` (`0x004b02e0`), `d` = car body `+0x168`, tested once if any of the four links is not `0xff` (the code fetches each link but reloads the racer's own checkpoint). Flag `0x2000` (pending) + facing right: clear, timer 0. Pending + wrong: at timer 0 → flag `0x4000`. Neither flag + wrong: `0x2000`, timer 500. `0x4000` + wrong: timer 500. Computers: timer 0 and `0x6000` cleared (`0x004377f0`).
- **Guidance** (`0x00439ea0`): flags `0x10000`/`0x20000` cleared; with `0x8000` set (`0x00439e60` stores a target at `+0xdf8`), when the normalized direction to it has dot below 0.5 with the heading, the sign of `0·dz + (0 − hx)·dy + (hy − 0)·dx` picks `0x20000` (≤ 0) or `0x10000`. Nothing in the race module sets `0x8000`, so the target is null.

## Scripted car body (`0x00429d40`, `0x0042a670`, `0x0042a570`, `0x0042a290`)

A computer racer's car body (`+0x744` = 1) is placed on its route by `0x0042a670` (follower reset, frame = route start; `+0x748` = 1 holds it) and moved by `0x00429d40`: ramped target (flag `0x10000`), speed factor toward the target, `0x004a5320` with the float step, sideways offset back to 0, bounce, then `0x0042a290` (rotation = follower quaternion → matrix), `0x0042a570` (position = follower + row 1 · offset, z = `((z − 0x7c4) + 0x7e4 + bounce) + 0x658`, stored; row 1 term stored; contact state → `+0x36c`; heading = row 0; world inverse inertia), velocity = `store(inverse step · store(new − old))`, `0x00447330`, rigid body frame = display frame. The follower constructor (`0x004a5190`) sets the speed factor (`+0x778`) to 1.0.

## Ported / not ported (exact)

Ported (`race`): `Race_RunLoop` (state timer and dispatch); `Race_UpdateState1` .. `5` without cameras, HUD, sounds, ghost and the points record; `Race_Update` items 1, 3 and 4 above (animations, tagged positions, triggers, events, hazards, timers, emitters, sky and HUD not); `0x0043ccb0` and `0x00439340`; `0x004374c0` (racer fields); `0x00430710`, `0x00430760`; `0x0043a0e0`; `0x00439b70`, `0x00439ba0`, `0x00439c40`; `0x00439fc0`; `0x00439cf0`, `0x00439ea0`; `0x0043cda0` (with racer set `+0x178` null); `0x0042a670`, `0x0042a570`, `0x0042a290` (default branches), `0x00429d40` (one pass without contacts); `0x004327f0` and the racer, power-up and timer parts of `Race_LoadTrackContent`; the racer-side effects of power-up events named in `power-ups` (shield, curse, warp, magnet flags); the loader for a race from `LEGO.JAM`.

Wired from `main` (not re-ported): `RacerSet_Step` (`racer`) with `stepRacerRigidBody` (the real rigid body step against `COLLIDE.BVB`), `racer-ai` (rubber band, personality, taunt timers, route follower, speed code, power-up decision), `power-ups` (`updatePowerUps`, `touch*Bricks`, `usePowerUp`, `activatePowerUp`, `advanceComputerPowerUpUse`, `rollComputerStartTurbo`, `keepPermanentTurbo`), `random-table`, the player controller.

Stubs (state unchanged), listed as the dependencies they fill:

- `followDriverRoute` (`0x004203b0`), `updateVehicle` (`0x0043e070`, **it moves the random cursor**, so the cursor drifts from the original once racers run), `endCarBodyEffect` (`0x004397b0`), `endTimedEffect` (`0x00439b00`), `tauntNearestRacer` (`0x00439c90`), `notifyRacerContact` (`0x00422100`), and the audio ones (`updateEngineSound`, `updateRacerSounds`, `updateNearestRacerSound`, `endPowerSlideEffects`).
- `collideRacers` (pass 4, `0x0043d180`): racer-against-racer collisions and the registry's sphere overlap tests are not ported; it only delivers the frame's `RaceContacts`. Hence a race has no lap, checkpoint or brick progress unless the caller delivers contacts: **the headless run shows no checkpoint or lap progress.**
- The car body's contact filter `0x0042a830` and `0x0042a900` inside `RigidBody_Step` (checkpoint touches, the `0x40000` finish objects, surface values).
- The contact loop of the scripted car body (`RigidBody_AdvanceToContact`, `0x0042a220`), flag `0x8` (`0x0042a100`) and the tilts and spins of `0x0042a290`.
- Race state 1's intro camera hold (`race +0x3ac`), the pause menu itself (`+0x30c0`, `0x00436010`, `0x00436160`; only the ghost race's hold at 9,501 ms is ported), `0x0045b740` (effects of a finishing racer), the race-wide animation, trigger, event, hazard, timer and emitter updates. The ghost (`race +0x3364`), the points record (`race +0x18`: the 5 s results state), the racing and finishing tunes and the mirror flag of the loader are ported: see [game-progression.md](game-progression.md).
- Racer set-up from the databases is ported (see [racer-setup.md](racer-setup.md)): cars from `GAMEDATA\COMMON` (driver, champion, chassis), the circuit's racer codes, personalities, voices, preferred power-ups, race-mode flags, the start slot (no offset from `0x00429210`; with two or more players racer 0 takes slot 2) and the collision objects (`+0x3b0` and the checkpoint object `+0x3b8`). Still open: the car builder and `LEB` (a built car's weight; `loadRaceDefinition` takes it as input), the model's bounding radius (the port uses 5), the ghost grid slots, and the checkpoint object in the collision list (needs the contact filter `0x0042a830`).
- Loaders that draw from the random table (emitters, events, hazards, sky) are not modelled.

## Headless run (Royal Knights Raceway, 300 frames of 33 ms, no input)

- 6 racers: racer 0 the player, racers 1..5 computers with routes `R1_F_x`, `R2_M_x`, `R3_M_x`, `R4_S_x`, `R5_S_x` picked by the table.
- The race is in the racing state (`phaseMilliseconds` 4,884 after 9,900 ms; the countdown ended at 5,000 ms). The computers have advanced about 4.9 s along their routes (samples 26..30), about 350 to 380 units in y (from y 194..211 to 563..581); the player rests at its slot (z 1.2) with four wheels down (it is placed at its start slot, so it does not visibly fall).
- Two runs give identical state (`runHeadlessRace.spec.ts`).
