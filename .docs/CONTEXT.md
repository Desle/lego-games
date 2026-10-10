# Context

What this project is, in the business's own words. Agents read this before writing a
feature; names in code should match the terms used here.

## Problem

An exact TypeScript port of LEGO Racers (High Voltage Software, 1999), recovered by reverse engineering `LEGORacers.exe` and `GolDP.dll`, not imitated. It runs in the browser using the player's own original game files, and its race simulation is deterministic so a server can later host multiplayer races. Other classic LEGO PC games follow later.

## Inputs

The player's original LEGO Racers files: `LEGO.JAM` (all game data), `*.tun` (music), `*.avi` (videos).

## Outputs

The game, rendered in the browser. Later, a multiplayer race server.

## Never

Never commit or redistribute the original game files or raw decompiler output. Never write gameplay behaviour from guesses: every behaviour traces back to an address in the original binaries (`.docs/reverse-engineering/`).

## Glossary

- **JAM archive**: `LEGO.JAM`, the single archive holding the game's data files in a directory tree.
- **Tune**: a `.tun` music file (ALP-ADPCM).
- **Gol engine**: the engine in `GolDP.dll` that `LEGORacers.exe` loads through `GolEntry`/`GolExit`.

## Related

- Original game files are kept locally in `original-files/` (gitignored).
- The Ghidra project lives in `reverse-engineering/ghidra/` (gitignored); its scripts in `reverse-engineering/scripts/`.
