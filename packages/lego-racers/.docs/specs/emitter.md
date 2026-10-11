# Feature: emitter

## Behaviour

Parses an `.EMB` emitter file (`COMMON\EMITTER.EMB` and each race's `RACECxRy.EMB`, both named by race description keyword `0x3a`) exactly as `Emitters_Load` (`LEGORacers.exe` `0x00489af0`) and its block reader `0x0048a130` do: every named emitter with its values, vector, point list and linked name.

## User flows

- **Parse emitters**: the race passes the file's bytes to `parseEmitters` and gets the emitters in file order and `readByteCount`.

- **Run the emitters**: `createEmitterPool`, `spawnEmitter`, `releaseEmitter`, the setters and `updateEmitterPool` (Emitters_Update, with its random table draws) keep a pool of emitters and their particles.

## Invariants

- The file is `0x27 [ count ] {`, then for a non-zero count count blocks `0x27 "name" { keywords }` and `}`; for a count of zero the final curly is never read.
- Names and the linked name are at most 8 characters. Keywords `0x28` and `0x29` read a float truncated toward zero (`_ftol`), `0x29` and `0x35` keep the low byte, `0x2b` reads `[ count ] {` count points `}`. Any other keyword is a syntax error.
- Absent values keep the reset values of `0x0048a0e0` (1.0 for `0x2c` and `0x2d`, -1 for `0x30`, zero otherwise; no entry index or linked name).

## Out of scope

Drawing the particles (their sprite materials) and the vehicles' and power-ups' own spawns.
