# Feature: race

## Behaviour

The race itself, the spine that ties the other modules together: `Race_RunLoop` (`0x00432540`) with its five timed states (introduction, countdown, racing, finishing, results) and `Race_Update` (`0x00435220`), which splits the frame into physics sub-steps and runs `RacerSet_Step` with the real `racer`, `racer-ai`, `power-ups`, `random-table`, `racer-physics` and `collision` code wired in. The whole race is one deterministic function, `stepRace(raceState, inputs, frameMilliseconds) → { raceState, events }`. Addresses, the race state field table, the state machine and the exact ported and not-ported lists are in `.docs/reverse-engineering/race.md`.

## User flows

- **Set up a race**: `loadRaceDefinition(jam, executable)` reads a race (default Royal Knights Raceway, `GAMEDATA\RACEC0R0`) from the player's own `LEGO.JAM` and `LEGORacers.exe` into a `RaceDefinition`; `createRace(definition)` builds the `RaceState` as `Race_LoadRaceDescription` and `Race_LoadTrackContent` leave it (racers, lap count, power-ups, timers' random draws).
- **Step a frame**: `stepRace(state, { controls, contacts }, frameMilliseconds)` applies the players' controls, advances the state timer, runs the state's function (state changes, finishing, placing) and `Race_Update`, and returns the new state with the events of the frame (`race.phase_changed`, `race.controls_enabled`, `race.racer_finished`, `race.ended`, `race.power_up`).
- **Deliver contacts**: the checkpoint touches, zone crossings and brick contacts that the collision registry and the car body's contact filter would report are not ported; the caller passes them in `contacts` and they are applied in the frame's first sub-step.
- **Run headless**: `runHeadlessRace(definition, { frameCount, frameMilliseconds })` steps a race without input and reports every racer's position, route progress and grounded wheels.

## Invariants

- Every function is pure: frozen plain data in, new frozen data out; no DOM, rendering, clock or `Math.random`. The same definition and inputs give the same state.
- The random table position lives in one place, `RacerSet.randomPosition`; the power-ups' own copy is synchronised before and after every power-up call.
- The state timer counts the unscaled frame milliseconds; the simulation gets the (possibly 1.75× scaled) time step, split into sub-steps of at most 40 ms.
- Float rules come from the disassembly through `FloatArithmetic`.

## Out of scope

Rendering, cameras, the HUD, sound, the ghost, the pause menu (race `+0x30c0`), the championship points record (race `+0x18`), the event, hazard, timer, trigger and emitter updates, the collision registry (racer-against-racer collisions and zone overlap tests), `Vehicle_Update`, the chassis, driver and champion databases (the car is a placeholder), and the checkpoint contact filter inside `RigidBody_Step`.
