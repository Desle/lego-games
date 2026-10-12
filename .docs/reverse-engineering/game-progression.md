# Game progression: from the menus to a race and back

Source: `LEGORacers.exe` (English, 1999-07-22). Every claim comes from decompiled or disassembled code at the address given; anything not proven is marked **hypothesis**. Ports: `packages/lego-racers/src/modules/game-session` (the session), `circuit-standings` (points), `ghost` (the time trial's ghost object), `save-data` (the save file, see [save-data.md](save-data.md)) and the hooks in `race`. Overall map: [game-map.md](game-map.md); the race itself: [race.md](race.md); data: [race-catalog.md](race-catalog.md), [circuit-database.md](circuit-database.md), [champion-database.md](champion-database.md), [ghost.md](ghost.md), [load-screen.md](load-screen.md).

## The application loop

`GameApplication_Run` (`0x0042bc40`): videos, `0x0042be00` (display), then

```c
while (application +0xabc != 0) {           // the "session" object, passed as the game settings block
    GameApplication_RunFrontEnd(app);        // 0x0042bdc0: FrontEnd_Run(app + 0xabc), then 0x00416490
    if (app +0xabc == 0) break;              // the front end clears it to quit the game
    GameApplication_RunRaceSession(app);     // 0x0042bde0: RaceSession_Run(app + 0xabc), then 0x00416490
}
```

`app +0xabc` is the **game settings block** (called `settings` below; its first dword is the "play" flag). `FrontEnd_Run` (`0x0042b1e0`) builds the front end (`0x4dd4` bytes), runs the menus (`0x0042d510`), and when the player starts something calls `FrontEnd_PrepareRaceSettings` (`0x0042d730`) to fill the block. `RaceSession_Run` (`0x0042b130`) builds the session (`0x37b8` bytes: circuit runner at `+4`, race at `+0x98`, ghost at `+0x3400`), `RaceSession_Begin` (`0x0042c280`), `RaceSession_Play` (`0x0042c330`), cleanup (`0x0042c380`).

The port's equivalent: `createGameSession` (Begin) → `startNextRace` / race loop / `finishRace` (Play) → read the result (`session.resultScreen`, `applySessionTimesToProfile`, `applyCircuitResultToSave`).

## The settings block

Offsets of the fields the session code reads or writes (the front end owns the rest; per-racer slots are `0x5c` bytes from `+0x104`):

| Offset                       | Meaning                                                                                                                                                                                                                   | Port (`SessionSettings` / `GameSession`) |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `+0x00`                      | Non-zero: the menus asked for a race. The in-race quit (`0x00435c00`, key 7) clears it                                                                                                                                    | not modelled (`abortSession`)            |
| `+0x18`                      | The JAM archive (null reads text files)                                                                                                                                                                                   | `GameResources.archive`                  |
| `+0x1c` (u16)                | The menu screen the front end opens next: starts 2, or 3 with flag `0x02`; a circuit sets `0x16`..`0x19`; the twelfth beaten ghost `0x1c`                                                                                 | `resultScreen`                           |
| `+0x1e` bit `0x01`           | The best run beat the champion ghost (`Race_RunLoop` end)                                                                                                                                                                 | `isChampionBeaten`                       |
| bit `0x02`                   | Countdown skipped (race `+0x335c`); the garage's test drive. Also result screen 3                                                                                                                                         | `isCountdownSkipped`                     |
| bit `0x04`                   | The profile block copied into `+0xe81` is to be copied back by the front end (`0x0042d0e0`). **Hypothesis**: it keeps the racer records the session may change                                                            | not modelled                             |
| bit `0x08`                   | The player left through the pause menu; the runner stops                                                                                                                                                                  | `isAborted`                              |
| bit `0x10`                   | A race with a ghost ended: the front end records the times (`0x0042e490`)                                                                                                                                                 | `isTimeRecordPending`                    |
| bit `0x20`                   | The pause menu asked to restart the circuit                                                                                                                                                                               | `isRestartRequested`                     |
| bit `0x40`                   | The runner is at slot 0 ("first race")                                                                                                                                                                                    | `getIsFirstRace`                         |
| bit `0x80`                   | A demonstration was interrupted by a key (`0x00435c00`); cleared when the session ends                                                                                                                                    | not modelled                             |
| `+0x20`                      | Race mode flags (power-up abilities `0x01`, `0x02`, `0x40`, `0x80`, time ×1.75 `0x100`; see [power-ups.md](power-ups.md)). Cleared for a circuit and a time trial. Bit `0x20` with circuit `c6` mirrors the final (below) | `raceModeFlags`                          |
| `+0x24`                      | Mode: 0 circuit, 1 single race, 2 time trial                                                                                                                                                                              | `mode`                                   |
| `+0x2c`                      | Laps for two or more local players                                                                                                                                                                                        | `multiplayerLapCount`                    |
| `+0x2d`                      | The circuit key (`c0`..`c6`), 8 bytes                                                                                                                                                                                     | `circuitName`                            |
| `+0x38 + 0x18·i`             | Race slot `i` (0..3): present flag; `+0x3c` the mirror flag (catalog `isFlagged`); `+0x40` the catalog key (8 bytes); `+0x48` the race folder (8 bytes)                                                                   | `raceNames[i]`, `SessionRace`            |
| `+0x98 + 4·i`, `+0xa8 + 4·i` | Best lap of slot `i` and the racer that set it                                                                                                                                                                            | `RaceTimeRecord`                         |
| `+0xb8 + 4·i`, `+0xc8 + 4·i` | Best race time of slot `i` and its racer (always the racer of the best lap, see below)                                                                                                                                    | `RaceTimeRecord`                         |
| `+0xd8`                      | The slot counter of the circuit runner                                                                                                                                                                                    | `raceIndex`                              |
| `+0xdc`, `+0xee`             | `GAMEDATA\<folder>` and `GAMEDATA\COMMON` (the JAM's current directory)                                                                                                                                                   | `race.folder`                            |
| `+0x100`                     | Racer count                                                                                                                                                                                                               | `racerCount`                             |
| `+0x114 + 0x5c·i`            | Racer kind: 0 human, 2 computer                                                                                                                                                                                           | `controllerKind`                         |
| `+0x134 + 0x5c·i`            | Racer name (14 characters)                                                                                                                                                                                                | `playerNames`                            |
| `+0x32c`                     | Local players (0 is a demonstration)                                                                                                                                                                                      | `localPlayerCount`                       |

### How the front end fills it (`FrontEnd_PrepareRaceSettings`, `0x0042d730`)

- Mode 0 or 2: the race mode flags are cleared.
- **Racers**: with fewer local players than `+0x100`, the count becomes the smaller of `+0x100` and the circuit's racer-code count, and slot `i` gets code `i` (kind 2); then the local players overwrite the first slots with their built cars (`FrontEnd_BuildBuiltCarSlot`, `0x0042dcb0`); the count never drops below the number of local players.
- The default count is the profile's **racer count option**, 5 in `DEFAULT.LRS` (`FrontEnd_ApplyProfileOptions`, `0x0042e1f0`, copies it from the profile); the laps for two or more players from the profile's seventh option byte. So a standard race has 5 racers (the player and four drivers) **unless the profile says otherwise**; the demonstration uses 6. (`loadRaceDefinition`'s own default of 6 is the demonstration's.)
- **Demonstration** (no local player; started by the main menu's 60 second idle timer, `MainMenu_Update` `0x00481450`, see [menu-backdrops.md](menu-backdrops.md)): count 6, mode 1, one of the four races of the first circuit `c0` (`random table[++cursor] & 3` indexes `circuit +0x48`), circuit key `c0`.
- **Time trial** (`FUN_00487f90`, mode 2): racer count 0, raised to the local players: the player races alone.
- **Circuit** (`FrontEnd_SelectCircuit`, `0x0047a0e0`): mode 0, the circuit key, and the four slots of the circuit's race table (`circuit +0x48 + 4·number`, filled by `RaceCatalog_Load` from each race's `raceNumber`); an empty slot has no race.
- **Single race / time trial** (`FrontEnd_SelectRace`, `0x00487d40`): the circuit key and slot 0 from the chosen catalog entry.
- **Mirrored final**: with race mode flag `0x20` and circuit key `c6` (string `0x004bec44`), slot 0 gets the mirror flag. **Hypothesis**: the catalog's `rr2` (the final with the flag, no circuit) is the same race reached through a menu path that does not set the flag.
- The settings' random cursor is the global table cursor; the menus advance it (the session takes it as an input).

## The modes

`RaceSession_Play` (`0x0042c330`): mode 0 runs `CircuitRunner_PlayCircuit`; any other mode runs `Race_RunLoop` once and frees the ghost (`0x00422670`). For modes 1 and 2 `FUN_0042c4e0` sets the JAM directory to `GAMEDATA\<folder>` and calls `Race_LoadRaceDescription` (settings, folder, mirror flag, ghost or null; Ghidra shows the ghost and mirror arguments wrongly). Mode 2 first runs `Ghost_Initialize` (`0x00422420`, mirror flag from slot 0).

| Mode           | Races                    | Points record | Ghost | Result screen                                   |
| -------------- | ------------------------ | ------------- | ----- | ----------------------------------------------- |
| circuit (0)    | up to four, one per slot | yes           | no    | `0x16`..`0x19` from the rank, or `2`            |
| single (1)     | the one race             | no            | no    | `2` (`3` for the garage)                        |
| time trial (2) | the one race, repeatable | no            | yes   | `2`, or `0x1c` after the twelfth champion ghost |

## The circuit runner (`CircuitRunner_PlayCircuit`, `0x0041ed80`)

```c
i = 0;
while (i < 4 || (flags & 0x20)) {                       // 0x20: restart requested
    if (!(flags & 0x20)) { if (i == 0) flags |= 0x40; else flags &= ~0x40; }
    else { i = 0; flags &= ~0x20; settings->raceIndex = 0; ResetAll(standings); flags |= 0x40; }
    if (slot[i].present && settings->play) {
        if (flags & 8) return;                          // the player left
        if (localPlayers == 1 && GetTotal(standings, 0) < i * 10) { settings->screen = 0x19; return; }
        folder = "GAMEDATA\" + slot[i].folder; ...
        Race_LoadRaceDescription(race, settings, slot[i].folder, slot[i].mirror, 0);
        race->points = standings;                        // race +0x18
        Race_RunLoop(race); cleanup;
    }
    i++; settings->raceIndex++;
}
if ((flags & 8) || !settings->play) return;
human = first racer with kind 0;  rank = GetRank(standings, human);
settings->screen = {0x16, 0x17, 0x18}[rank] or 0x19;
```

Port: `startNextRace` / `finishRace` (`getCircuitStep`): an empty slot is skipped (the counter still moves), the elimination uses the slot index, the restart flag restarts at slot 0. `circuit-standings` holds the points record.

### The points record (`CircuitRunner +4`, constructor `0x00440220`)

Six `uint32` totals at `+0x10`, six race points at `+0x28`, a results countdown at `+0x40` (400, drawn by `0x00440350`; **not ported**).

| Address      | What it does                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x004402c0` | `AwardPlacePoints(racer, place)`: `racePoints[racer] = table[place]`, `totals[racer] += table[place]`. The table at `0x004b0b58` is **30, 20, 10, 3, 2, 1** |
| `0x004402b0` | Clears the race points (from `Race_UpdateState1` when the countdown starts)                                                                                 |
| `0x00440860` | Clears totals and race points (a circuit restart, and the pause menu's restart in the first race)                                                           |
| `0x004402f0` | The total of a racer                                                                                                                                        |
| `0x00440300` | The rank: the number of other racers with strictly more points (unsigned compare); ties share the better place                                              |

`Race_UpdateState3` and `4` call `AwardPlacePoints(racer +0xe04 (the racer's index), race +0x3330)` for each racer as it is placed, `+0x3330` being the number of racers placed before it (0 for the winner). The port does the same from the `race.racer_finished` events (`recordRaceStep`). Verified in the emulator against these functions (`standings.differential.spec.ts`).

### With the points record, a race lasts longer

`Race_UpdateState5` (`0x00435180`) with `race +0x18` set holds the results for 5,000 ms (`FUN_00440330` counts the display down) before `running = 0`; `Race_UpdateState4` skips the fade-out request. The port's `RaceState.isPointsRecordPresent`.

## What a finishing race hands back

At the end of `Race_RunLoop` (`0x00432540`): `RacerSet_RecordRaceTimes` (`0x0043beb0`, also called by the restart `0x0043a6e0`) writes the slot's times into the settings (`recordRaceTimes`):

- over the human racers (kind 0 in the settings) that finished all their laps (`currentLap >= lapCount`): the fastest single lap (strict `<`) and the lowest total; the racer of the fastest lap is kept;
- a time replaces the stored one when none is stored or it is **not larger**; **both** records name the racer of the fastest lap (`local_c`), also the race-time record, even if another racer had the lower total. The port keeps the quirk;
- if the settings' play flag is set and the race has a ghost, flag `0x10` is set, and flag `0x01` when `Ghost_GetIsChampionBeaten` (`0x004234b0`) says the best run beat the champion.

## The ghost object (time trial, `ghost.md`)

Race session `+0x3400`: three **buffers** (`0x25c0` bytes each, layout in [ghost.md](ghost.md)) and clocks.

| Field                 | Meaning                                                                                                                    | Port (`GhostSession`)                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `+0x0c`               | The **champion** ghost, loaded from `GHOST.GHB` of the race folder                                                         | `championRun`                                                                        |
| `+0x10`               | The **best run** of the session                                                                                            | `bestRun`                                                                            |
| `+0x14`               | The run being **recorded**                                                                                                 | `currentRun`                                                                         |
| `+0x3ac`, `+0x3b0`    | Milliseconds until the next sample; the running clock                                                                      | `sampleTimerMilliseconds`, `elapsedMilliseconds`                                     |
| `+0x3b4` flags        | `0x01` best run shown, `0x02` running, `0x04` binary files, `0x08` champion loaded, `0x10` a run finished, `0x20` mirrored | `isBestRunShown`, `isRunning`, `championRun !== null`, `isRunFinished`, `isMirrored` |
| `+0x25bc` of a buffer | Playback reached its last sample                                                                                           | `isChampionPlaybackFinished`, `isBestPlaybackFinished`                               |

The three leading integers of a GHB (`0x2a`) are the **lap times in milliseconds** of the three laps (the twelve files: 32,266 / 30,015 / 33,066 for Royal Knights Raceway, ...; their sum matches `samples · 250` within a sample). The integer of keyword `0x2b` is 0 in every file (meaning unknown).

| Address      | Function                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x00422420` | `Ghost_Initialize`: three zeroed buffers, clocks 0, mirror flag from slot 0, the ghost car's world loaded from `GAMEDATA\COMMON`                                                                                                                                                                                                                                                                                                                               |
| `0x00422de0` | From `Race_LoadRaceDescription`: loads the champion (flag `0x08` only if it has samples), clock 0, flag `0x02` cleared, the recording cleared, playback flags cleared. The sample timer is **not** reset                                                                                                                                                                                                                                                       |
| `0x00422eb0` | From `Race_UpdateState2` when the race starts: flag `0x02`; flag `0x01` too if a run finished earlier. The ghost's racer is the first local player's (`race +0x6d4`)                                                                                                                                                                                                                                                                                           |
| `0x00422710` | `GhostRecorder_RecordSample(step)`, every `Race_Update` sub-step: with flag `0x02`, `clock += step`; if `step < timer`, `timer -= step`; else `timer = timer - step + 250` and, below 961 samples, a sample: the racer's model frame position `ftol(32·x)` (int16) and the four bytes `ftol(127·q)` of the quaternion from the frame matrix (`0x00449460`); the first sample also stores the float position and quaternion. First sample at the first sub-step |
| `0x004230e0` | From `Race_UpdateState3` when a human finishes: the racer's three lap times go into the recording; if their sum is below the best run's, or there is none, the recording becomes the best run (the buffers swap); flags `&= 0xfc`, `                                                                                                                                                                                                                           | = 0x10` |
| `0x004234b0` | `GetIsChampionBeaten`: with a champion loaded and flag `0x01` or `0x10`, the best run's lap sum is less than the champion's                                                                                                                                                                                                                                                                                                                                    |
| `0x004234f0` | The pause menu's restart: flag `0x02` cleared, clock 0, recording cleared, playback flags cleared                                                                                                                                                                                                                                                                                                                                                              |
| `0x00422960` | Playback: below 240,000 ms, with the clock running, `index = clock / 250`, `t = float(clock % 250) · 0.004f`; positions `int16/32` blended `delta·t + start`, orientation bytes `int8/127` blended by `0x004495e0`, speed `float32(sqrt(dz² + dy² + dx²) · 4 · 1.8)` stored as a float in the model (`+0xb8`); past the last pair `+0x25bc = 1`. With the clock stopped the car sits at the run's start position and quaternion                                |

A ghost race **holds at the menu**: `Race_UpdateState4` with a ghost at 9,501 ms sets `race +0x30c0 = 2` and opens the pause menu (`0x00436010`); the state timer then stands still and `Race_Update` does not run. The menu's answer (`0x00436160`, mode 2) is either "race again" (`Ghost_LoadChampion` and `Race_Restart` `0x004362e0`) or leave (`running = 0`). Port: `RaceState.pauseState`, `endRaceFromMenu` (leave) and `restartRace` (again; **not exact**: the original resets the racers in place with `0x0043a780`, the port loads the race again from its definition with the current random table cursor).

`stepGhostPlayback` is checked against the data (every champion ghost plays from its first sample to its last) but not in the emulator: the original function goes through the Gol frames' virtual methods; the float operations follow the disassembly (`0x00422abc`..`0x00422cde`).

## What the front end does with the result

`FUN_0042cb90` (front end start) runs, in this order:

1. `FrontEnd_RecordSessionTimes` (`0x0042e490`, flag `0x10`): for each of the four slots, the best lap and the best race time go to `Profile_RecordBestTime` (`0x0042f310`) under the race's **position in the catalog** (`RaceCatalog_GetIndex`, `0x00436930`), with the racer's name; two tables of 13 tracks (lap, race), a time kept only if strictly better. Index 13..25 have 13 taken off, so the mirrored second pass (12..23) lands on tracks 12, 0..10, the final (24) on 11 and `rr2` (25) on 12; 26 (`test`) has none. **Quirk, kept** (`getBestTimeTrackIndex`).
2. `FrontEnd_RecordGhostBeaten` (`0x0042e680`, flag `0x01`): the bit of slot 0's catalog index (below 12) in the profile's ghost flags; if it is new and all twelve (`0xfff`) are set, the profile gets trophy flag `0x80` and the result screen becomes `0x1c`.
3. The start screen is `settings +0x1c`.

On the result screens `0x16`, `0x17`, `0x18` (first, second and third place of a circuit) `ResultScreen_ApplyCircuitResult` (`0x004767b0`) updates the save: the racer record keeps place 1, 2 or 3 for the circuit if it is better than before (`0x0042b640`, 2 bits per circuit; checked in the emulator), **first place** also sets the circuit's trophy bit in the profile (`1 << circuit.secondNumber`, `0x00476990`), and **first or second place** unlocks the circuit named by the circuit's `nextName` (`0x004768f0`: bit `1 << index` of the next circuit). Port: `applyCircuitResultToSave`, `applySessionTimesToProfile`.

### What unlocks

| Unlock                                                                              | Condition                                                                                                                                                                                         | Where it is stored                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Circuit `c(n+1)` (c0 → c1 → ... → c6)                                               | Finish circuit `n` first or second                                                                                                                                                                | profile circuit unlock flags (bit `n+1`)             |
| Circuit trophy `n`                                                                  | Finish circuit `n` first                                                                                                                                                                          | profile trophy flags (bit `secondNumber`)            |
| The champion's race beaten (12 of them)                                             | Beat the champion ghost in a time trial on that race (`GAMEDATA\RACEC<c>R<r>\GHOST.GHB`)                                                                                                          | profile ghost flags (bit = catalog index)            |
| "All champions beaten"                                                              | The twelfth ghost: trophy flag `0x80`, menu screen `0x1c`                                                                                                                                         | profile trophy flags                                 |
| Driver parts (**hypothesis**: the `.PCB` body-part catalog, `BodyPartCatalog_Load`) | A part's requirement byte (list at front end `+0x437c`, `+0x158 + k`): below 3 free, `0x80` all champions beaten, else the trophy of circuit `requirement - 3` (`0x00483c60` and its three twins) | profile trophy and ghost flags (`getIsPartUnlocked`) |
| Brick sets of the car builder                                                       | **Hypothesis**: the twelve brick-set tabs of `0x00477290`/`0x0047c320`: four free, eight unlocked by the trophy bits 0..7                                                                         | profile trophy flags                                 |

Which part needs which trophy is in the `.PCB` part catalog and the brick database (`LegoBrickDatabase_Load` `0x0049ee30`); neither is parsed in this branch (the front end's work).

## Where the races come from

A circuit's races are the catalog entries with that `circuitName`, in the slot of their `raceNumber` (four slots; a later entry overwrites an earlier one). `c0`: igp, dfd, mmm, dad (folders `RACEC0R1`, `RACEC1R0`, `RACEC0R3`, `RACEC0R2`); `c1`: tit, rkr, ipp, ama; `c2`: frk, psp, att, aar; `c3` to `c5` run the same twelve folders **mirrored** (catalog flag) in reversed order; `c6`: the final `rr` (`RACEC3R0`) alone. The racers are the circuit's driver codes (CRB), not those of the folder's first catalog entry, so `c3` races `JT GB RH AD PH` on `c0`'s tracks.

`GAMEDATA` holds the 13 race folders, `TEST`, `COMMON` (the databases and the ghost car) and `VOICES`; every one of the 25 races with a circuit loads and runs in the port, mirrored or not (`all-races.spec.ts`: 160 frames of 50 ms through the countdown, the computers advance along their routes).

## Music (per race)

The RAB's `musicList` keyword (`0x30`, always `legomsc`) names a file in the race folder, a sound-bank-style text list (see [audio.md](audio.md)) of `.tun` files; the `.tun` files are streamed from the game folder, not the JAM. Layout of every race's list (`GAMEDATA\RACEC*\LEGOMSC`): 0 `start.tun` (introduction), 1 the track's tune, 2 `lose.tun`, 3 `win.tun`, then the extra tunes of the theme (`knight`, `moat`, `armor` for castle tracks, `cannon`, `parrot`, `hook` for pirate, `whip`, `gold` for adventure, `alien`, `stars`, `meteor` for space; six entries for the adventure tracks, four for `TEST`). The menus have their own list (`MENUDATA\LEGOMSC`, 18 entries: theme, builder, 1st, 2nd, 3rd, circuit1..6, lose, rracer, gencar, rrcar, vvcar, credits twice).

| When                                     | Address      | Tune                                                                                                                                                                                       |
| ---------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The race loads, and a restart            | `0x00434930` | 0, played once                                                                                                                                                                             |
| The countdown ends (`Race_UpdateState2`) | `0x00434b00` | 1, looping. With more than four tunes and **no points record**, `random table[++cursor] % (count - 3)` picks 1, 4, 5 or 6 for the values 0, 1, 2, 3 (**the draw moves the shared cursor**) |
| A human finishes (`Race_UpdateState3`)   | `0x00434c80` | 3 if its race position is 1, else 2, played once                                                                                                                                           |

The tunes only play, and the draw only happens, if the stream for tune 0 was created (race `+0x3320`); the port assumes the music files are there (`RaceDefinition.musicTuneCount`, 0 for none) and reports the tune in the `race.tune_changed` event.

## Load screens

`LoadScreen_Load` (`0x0042f480`, from `Race_LoadRaceDescription`, `loadscrn.lsb` of the race folder with its `LOADSCRN.IDB`): the image name, the point list and the caption string index (`load-screen.md`). `SessionRace.loadScreen` carries the parsed file for every race the session will run, so a viewer can show the right screen before `createRace`.

## The session API (for the front end and a server)

```ts
const resources = loadGameResources(jam, executable)
const settings = createCircuitSettings(resources, {
  circuitName: 'c1',
  racerCount: profile.racerCountOption,
  localPlayerCount: 1,
  playerCars,
  playerNames,
  randomPosition,
})
let session = createGameSession(resources, settings)
for (;;) {
  const next = startNextRace(session) // PlayCircuit's loop: restart, empty slots, elimination
  if (next.kind === 'finished') {
    session = next.session
    break
  }
  let race = createRace(next.definition) // next.race: folder, load screen, music tunes
  let current = next.session
  while (race.isRunning) {
    const step = stepRace(race, inputs, frameMilliseconds) // race.tune_changed events tell which tune to play
    current = recordRaceStep(current, step) // points as racers are placed
    race = step.raceState
  }
  session = finishRace(current, race) // times, ghost result, slot counter, random cursor
}
session.standings // totals and the last race's points
getCircuitOutcome(session) // rank and result screen 0x16..0x19
const times = applySessionTimesToProfile(session, save.profile) // best times, beaten champion
const result = applyCircuitResultToSave(session, save, session.resultScreen, racerRecordIndex)
// serializeSaveFile(result.saveFile) -> SaveStorage.writeSlot(slot, bytes)
```

Single races and time trials use `createSingleRaceSettings` / `createTimeTrialSettings` the same way (`startNextRace` answers one race, then `finished`); a time trial's race stops at the menu (`race.pauseState === 2`): `endRaceFromMenu(race)` leaves, `restartRace(session, race)` starts again.

## What is not ported

- The pause menu itself (`0x00436010`, `0x00436160`) beyond the ghost hold and its answers; the exact in-place restart (`0x0043a780`).
- `0x0045b740` (effects of a finishing racer), the finish-by-object `0x40000`, the cameras and the HUD of the results.
- The brick, part and driver databases behind the garage and the driver license screens.
- The ghost cars' wheel and driver clips (`0x0040dad0` loops clip 12 on the champion's wheels and 13 on the player's copy at the stored speed, `+0xb8`); the cars are drawn in their rest pose.
- The champion-beaten mark of the time trial screen (widget `0x6d`, shown when the race's bit is set in the profile's ghost flags, `0x004881a0`); which image it is is not traced.
- The input configuration records of the profile (see [save-data.md](save-data.md)).

## Headless runs

`playScriptedRace(start, scripts)` runs a race with nobody at the controls while the named racers cross the start line at the given times (the contacts that would do it are not ported). Four circuit races, the elimination, the restart, a time trial against the champion, both result applications and every race of the catalog run in the specs. A race needs only the frame clock: at 100 ms a circuit race of three 30 s laps is about 1,100 frames.

## The ghost cars in the race and the time trial screen

`Race_Render`'s update (`0x00435a00`) runs the playback `0x00422960` once per rendered frame. It draws **two** cars, each only while its run has samples left, both with the one stored orientation on every part:

| Car                                 | Shown while                                         | Parts                                                                                                                                                                                                                                                           |
| ----------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The session's best run (first pass) | flag `0x01` (a run finished earlier in the session) | copies of the **player's own** car (`0x00422eb0` copies the racer's wheels, body and driver frames at `+0x1c`, `+0x300`, `+0x114`/`+0x20c`, and the racer's seat point `+0x64..+0x6c` into `+0x394`); wheel clip 13 looped                                      |
| The champion (second pass)          | flag `0x08` (champion loaded)                       | `GAMEDATA\COMMON\GHOST.WDB`, loaded by `Ghost_Initialize` as "ghost": skeleton instance `ghost2` (the wheels), mesh `ghostb2` (the body), skeleton instance `ghostdr` (the driver); seat point `(-2.1317, 0.01123, 1.608)` (`this+0x3a0`); wheel clip 12 looped |

With the clock stopped (before the start, after the player finished: `0x004230e0` clears flags `0x01` and `0x02`) the cars stand at the run's first position and orientation; running, they follow the interpolated samples. The driver sits at the seat point carried by the car's frame (`getFrameTransformedPoint`). Port: `getGhostCars` (`race-presentation`) steps `stepGhostPlayback` and returns the poses and the race with the playback flags; the viewer draws `GHOST.WDB` and a second copy of the player's car models (`race-viewport`). **Hypothesis**: no transparency (the draw brackets `0x00422960` with `vtable+0xb8(0x7f, 0)` / `+0xbc`, which could be a half alpha; the callee is not traced).

The player's best run is **only kept in memory** for the session (`GhostSession.bestRun`, the buffer at `ghost+0x10`); the original never writes a `.GHB`, and the profile keeps only the times and the beaten bit. Before this fix the viewer never called the playback, so no ghost car was drawn.

The time trial screen (`0x1d`, `TimeTrialScreen_ShowBestTime` `0x004881a0`, swapped every 2,500 ms by `0x00488150`) shows the race's best time from the profile: `Profile_GetBestTime` (`0x0042f290`) at the race's catalog index, the lap table first (text `0x46`) and the race table second (text `0x47`); a time never set shows "NONE" (`0xbe`/`0xbf`) and no time (**hypothesis**: the time widget stays empty). The time is formatted by `0x004246d0` (`formatHudTime`). Port: `getBestTimeWidgets` (**not exact**: the 2,500 ms countdown restarts in the original when the race on show changes). Before this fix the screen always showed "NONE", so a saved record never appeared although `applySessionOutcomeToSave` wrote it.
