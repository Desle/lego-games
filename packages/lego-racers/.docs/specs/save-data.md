# Feature: save-data

## Behaviour

Reads and writes the player's save file exactly as `LEGORacers.exe` does (`SaveFile_Parse` `0x00442770`, `FUN_00442700`, `FUN_00442840`, `FUN_00442910`): 0x80-byte blocks with a sum byte, a header holding the profile (unlocked circuits, trophies, beaten ghosts, best times, options, input configurations) and one record per saved racer. It also holds the profile and racer updates the front end makes after a race.

## User flows

- **Load**: the viewer's storage adapter hands the bytes of a slot to `parseSaveFile` and gets the profile and the racers.
- **Save**: `serializeSaveFile` returns the bytes; the adapter writes them to the slot (`SaveStorage`).
- **Start a new game**: `createDefaultProfile(languageIndex)` is the profile a fresh game uses.
- **After a time trial**: `recordBestTime` and `markGhostBeaten` update the profile; `recordCircuitRank`, `unlockCircuit` and `setTrophyFlags` apply a circuit result.

## Invariants

- A block whose sum byte differs from the sum of its first 0x7f bytes is corrupt; a file without `LR` first is refused; a file that ends early is truncated.
- A best time is replaced only by a strictly smaller one; a racer's place in a circuit only by a smaller place (1 to 3).
- Parsing and serializing `DEFAULT.LRS` and `QBUILD.LRS` of `LEGO.JAM` gives back their bytes.
- Pure functions over bytes and frozen values; nothing here touches storage except through the `SaveStorage` interface.

## Out of scope

The browser storage adapter (the viewer), the car design bytes' own format (kept opaque), and the meaning of the input configuration codes.
