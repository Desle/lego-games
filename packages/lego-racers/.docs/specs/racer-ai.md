# Feature: racer-ai

## Behaviour

How computer racers race: they play their recorded route (RRB) back kinematically, with a speed factor that rubber-banding and pushes adjust, a sideways offset and a bounce, and they decide when to use power-ups and when to taunt from their driver's personality and the random table. Details, addresses and the ported / not-ported list are in `.docs/reverse-engineering/ai.md`.

## User flows

- **Follow a route**: `createRouteFollower` (or `resetRouteFollower`) attaches a parsed `ComputerRacerRoute`; `advanceRouteFollower` moves it by a float step and returns the interpolated position, rotation and lateral limits; `startRouteFollowerAtLoop` jumps to the loop point.
- **Control the speed**: `stepComputerSpeedFactor`, `getRampedTargetSpeedFactor`, `getPushedSpeedState`, `getRestoredSpeedState` and `getReleasedSpeedState` move the playback speed toward its target; `getReturnedLateralOffset` and `stepComputerBounce` update the offsets.
- **Rubber-band**: `stepRubberBand` sets every computer racer's target from its progress against the leading player.
- **Decide**: `getComputerPersonality` turns driver bytes into chances; `updatePowerUpUse` and `updateComputerTaunt` advance the timers and draw from the random table; `findNearestRacerInCone` answers their queries.

## Invariants

- Every function is pure: frozen input, frozen output, the random-table position passed in and returned.
- Floats follow the `simulation-math` precision policy and the stores of the disassembly.
- Computer racers produce no control input.

## Out of scope

Moving the follower by a displacement (`0x004a5750`), placing the car frame (`0x0042a290`, `0x0042a570`), contacts, the power-up effects, voices, sounds and driver animations; the RRB parser and the route variant choice (`computer-racer-route`).
