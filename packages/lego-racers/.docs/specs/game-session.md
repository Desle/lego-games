# Feature: game-session

## Behaviour

Everything between the menus and a single race, headless and free of rendering: the application's `RunRaceSession` (`RaceSession_Run` `0x0042b130`, `RaceSession_Play` `0x0042c330`), the circuit runner (`CircuitRunner_PlayCircuit` `0x0041ed80`), the three game modes (circuit, single race, time trial), the points and standings of a circuit, the race times and the ghost of a time trial, the result the front end reads back (`settings +0x1c`), and what the result writes into the save file.

## User flows

- **Start a session**: the front end builds settings with `createCircuitSettings`, `createSingleRaceSettings`, `createTimeTrialSettings` or `createDemonstrationSettings` and calls `createGameSession(resources, settings)` (`loadGameResources` parses the circuits and the race catalog).
- **Next race**: `startNextRace(session)` answers a `RaceStart` (the race slot, its load screen data, music tunes and a `RaceDefinition` for `createRace`) or `finished`.
- **Run a race**: the host loops `stepRace`, passing each step to `recordRaceStep` (points are awarded as racers are placed), and calls `finishRace` when the race ends.
- **Menus in a race**: `requestCircuitRestart`, `abortSession`, `restartRace`; `endRaceFromMenu` (race module) ends a race held for the menu.
- **Results**: `getCircuitOutcome`, `session.resultScreen`; `applySessionTimesToProfile` and `applyCircuitResultToSave` update the profile and the racer record (best times, beaten ghosts, circuit rank, trophy, unlocked circuit).
- **Without a player**: `playScriptedRace` runs a race with scripted lap line crossings, for servers and tests.

## Invariants

- A circuit has four slots; an empty slot is passed over; a lone player with fewer than 10 points per race run is dropped on the no-place screen (0x19); the runner stops when the player leaves.
- The random table cursor goes from race to race through `session.randomPosition`.
- Best times are recorded only for races with a ghost; the holder named for both records is the racer with the fastest lap, as in `FUN_0043beb0`.
- Pure functions over frozen values; the only effects are the reads of the game files.

## Out of scope

The menus themselves, the pause menu's drawing, the pause-menu restart's exact in-place reset (`FUN_0043a780`), the music playback and the browser storage.
