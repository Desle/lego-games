# Architecture

## Design intent

The package mirrors the original game's subsystems, one module per subsystem, so each piece of TypeScript maps back to the code in `LEGORacers.exe` or `GolDP.dll` it was ported from. Addresses and layouts are recorded in `.docs/reverse-engineering/` at the repository root.

## Modules

### `jam-archive`

- Layers: `controller`, `types`
- Public API (`index.ts`): `openJamArchive`, `JamArchiveReadError`, `JamLookupError`, `JamLookupFailure`, and the `JamArchive` types
