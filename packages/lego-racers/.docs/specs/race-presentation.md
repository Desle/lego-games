# Feature: race-presentation

## Behaviour

Keeps the player's camera, HUD, turbo level and music in step with the race and picks the sounds each frame; also gives every racer's pose.

## User flows

- **Start**: `createRacePresentation(raceState, musicListCount)`.
- **Each frame**: `stepRacePresentation(presentation, step, controls, frameMilliseconds, hudContext)`.
- **Poses**: `getRacerPoses(raceState)`.
- **Points table**: `getPointsTableCommands(raceState, hudContext, racers)` draws a circuit race's points and totals (`0x00440350`); `getRaceGaps` is the time behind a racer (`0x0043cf30`).

## Invariants

- Pure functions of the race step; no DOM, clock or `Math.random`.
- The HUD is drawn only in the countdown, racing and finishing states.

## Out of scope

Cameras for other local players and the camera switch while a racer is warping.
