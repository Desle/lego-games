# Feature: racer-setup

## Behaviour

Turns a driver, champion and chassis, or a car built from bricks, into what a racer starts a race with, as `RacerSet_SetupRacer` (`0x0043b480`) and `Racer_AttachCarBody` (`0x004371c0`) do: the car rigid body, the three rating scales, the personality, the voice base and the start slot.

## User flows

- Describe a racer: `describeChampionRacer` or `describeBuiltRacer`. Build its car: `createCarBodySetup(arithmetic, car, { displayFrame, displayBoundingRadius, isRaceModeFlagged })`. Place it: `getStartSlot`. Read the race mode: `getRaceModeRacerFlags`, `getRacerPowerUpAbilities`.

## Invariants

- An unknown driver, champion or chassis stops with `UnknownRacerRecordError`; a built car adds its weight to the mass and `ftol(weight * 0.05)` rating points; the attach adds no offset to the start position.

## Out of scope

The car builder and brick database that compute a built car's weight, the model's bounding radius, the ghost grid slots.
