# Feature: racer

## Behaviour

One racer's update for a physics sub-step, `RacerSet_Step` (`0x0043c030`), and the player's controls that feed it (`PlayerController_Update`, `0x00430530`). It ports the racer's state as plain data (`Racer_Constructor` `0x00436990`), the driver that turns steering and throttle into car body commands, the car body's own update around its rigid body (`CarBody_Update`, `0x004293f0`), the racer timers and the race ranking; the rubber band, race progress and taunts come from `racer-ai`. Addresses, the racer field table and what is not ported are in `.docs/reverse-engineering/racer.md`.

## User flows

- **Read the tables**: `readRacerTables` takes the bytes of the player's `LEGORacers.exe` and returns the random table (`0x004befec`, through `random-table`) and the cosine table (`0x004bf7ec`) the racer code reads.
- **Who uses the controls**: only player racers. Computer racers replay their route kinematically (car body `+0x744`, `racer-ai`).
- **Create racers**: `createCarBody` (around a `racer-physics` `CarRigidBody`, which holds every car body field up to `+0x6e0`, and the attach values), `createRacer` and `createRacerSet` return the state as the constructors leave it.
- **Apply the player's controls**: once per frame, `applyRacerControls` turns a `RacerControls` snapshot (nine bindings, two axes) into the press and release handlers of the player controller, and `updatePlayerController` moves the steering, the throttle and the power slide into the racer's driver.
- **Step the racers**: per sub-step, `stepRacerSet` runs the nine passes of `RacerSet_Step`. Everything it calls that is not ported yet is a typed dependency in `RacerSetStepDependencies`; `RACER_SET_STEP_DEPENDENCIES_NOT_YET_PORTED` leaves the state unchanged for each of them, except `stepRigidBody`, which is `stepRacerRigidBody`: `racer-physics`'s `stepCarRigidBody` against `RacerSetContext.collisionObjects`.

## Invariants

- Every function is pure: frozen plain data in, new frozen data out; no clock, DOM, rendering or `Math.random`.
- Randomness only comes from the game's random table through `RacerSet.randomPosition` (the global `0x004c6ee4`, `random-table`), in the original's draw order; every dependency receives and returns the whole racer set so it can draw too.
- Float rules come from the disassembly and go through `FloatArithmetic` (`simulation-math`): every x87 store is a `storeFloat`, every comparison uses the x87 unordered rules.
- Sound, visual effects, the camera and the HUD are never simulated here; they are dependencies.

## Out of scope

The car body's overrides of the rigid body's slots `+0x0c` and `+0x10` (`0x0042a830`, `0x0042a900`, surface and checkpoint handling inside `RigidBody_Step`), the computer racers' route step (`0x00429d40`, built from `racer-ai`), route following (`0x004203b0`), racer-against-racer collisions (pass 4), `Vehicle_Update` (`0x0043e070`), the computer racers' power-up and proximity logic, the player's wrong-way guidance (`0x00439cf0`, `0x00439ea0`), power-ups, sounds, cameras and the HUD. Checkpoints come from the `checkpoint` module.
