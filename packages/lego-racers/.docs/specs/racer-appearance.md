# Feature: racer-appearance

## Behaviour

Says what each racer's car is drawn from and sets up the animated figures the vehicle drives, as `RacerSet_SetupRacer` (`0x0043b480`), `Chassis_CreateInstances` (`0x0041e360`), `Driver_CreateInstance` (`0x00420ef0`) and `Vehicle_Setup` (`0x0043d7a0`) do: the champion's car body, the chassis's wheel model with its skeleton and its two animations, the driver's model with the pelvis skeleton and its 18 animations, the driver's seat point, and the wheel and driver figures in the state the set-up leaves them (wheels in animation 0, driver in animation 9, both playing).

## User flows

- Name the files of a computer racer: `getChampionRacerAppearance(databases, driverCode, racerIndex)`. Of a racer with a car built from bricks: `getBuiltRacerAppearance(databases, chassisName, racerIndex)` (the body and the driver come from the car builder).
- Read the animation files and model scales: `loadRacerFigureSources(readFile, appearance, builtDriverScale)`; make the figures: `createRacerFigures(sources)`.

## Invariants

- An unknown driver, champion or chassis stops with `UnknownRacerRecordError`.
- A figure's animation records are the entries of the animation file's keyword `0x2c`, in file order; its bounds multiply the model's scale.
- The wheel figure plays animation 0 and the driver figure animation 9 when the race starts.

## Out of scope

The bounding sphere of a model part (`0x100278c0`, only used while no animation plays), the car body and driver models of cars built from bricks (the car builder), the shadow, the effects emitters.
