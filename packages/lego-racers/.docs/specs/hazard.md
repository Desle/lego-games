# Feature: hazard

## Behaviour

Parses a race's `.HZB` hazard list exactly as `Hazards_Load` (`LEGORacers.exe` `0x0048a4d0`) does: each entry's keyword picks one of twenty hazard classes, and that class's loader (its vtable slot `+0x10`) reads the rest — nothing for twelve classes, a block of values for the others.

## User flows

- **Parse hazards**: the race passes the bytes of `HAZARDS.HZB` and its mirror flag (race set-up structure `+0x40`) to `parseHazards` and gets the hazards in file order, each with its keyword and the values its class reads, and `readByteCount`.

## Invariants

- The file is `0x27 [ count ]`, and for a non-zero count `{ hazard * count }`; with a count of zero the final curly is never read.
- Keywords `0x28`..`0x30`, `0x32`, `0x3f` and `0x49` read nothing; `0x33`, `0x34`, `0x36`, `0x3d`, `0x3e`, `0x40`, `0x43` and `0x48` read the layouts in `.docs/reverse-engineering/hazard.md`. An unknown keyword inside a block is a syntax error.
- `0x3a` stores its float squared; a mirrored track negates the y of the `0x33` vectors, of the `0x3d` points and of the `0x40` `0x37` vector.
- A hazard keyword without a class, a fifth name in a `0x34` hazard and a `0x3d` hazard that reaches the end of the file throw `UnportableFileError`, where the original calls through a null object, overruns its stack or loops forever.

- **Run the hazards**: `createHazardRuntime` makes one object per definition (class loaders may draw and change the worlds); `updateHazards`, `updateHazardsAfterRacers`, the bus walks (`startHazardSignal`, `startStopHazardSignal`, `stopHazardSignal`, `forceEndHazards`, the racer-trigger walks) and `touchHazard` run them against a session that the track logic supplies.

## Out of scope

The skeleton poses of hazard instances, the collision registry callbacks and sounds (see `.docs/reverse-engineering/hazards-and-emitters.md`).
