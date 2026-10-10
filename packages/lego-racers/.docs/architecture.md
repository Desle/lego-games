# Architecture

## Design intent

The package mirrors the original game's subsystems, one module per subsystem, so each piece of TypeScript maps back to the code in `LEGORacers.exe` or `GolDP.dll` it was ported from. Addresses and layouts are recorded in `.docs/reverse-engineering/` at the repository root.

## Modules

### `bitmap`

- Layers: `controller`, `types`
- Public API (`index.ts`): `decodeBitmap`, `getBitmapColors`, `InvalidBitmapError`, `Bitmap`

### `jam-archive`

- Layers: `controller`, `types`
- Public API (`index.ts`): `openJamArchive`, `JamArchiveReadError`, `JamLookupError`, `JamLookupFailure`, and the `JamArchive` types

### `token-reader`

- Layers: `types`
- Public API (`index.ts`): `createTokenReader`, `BinaryToken`, `TokenReaderFailure`, `TOKEN_READER_FAILURE_MESSAGES`, `TokenReaderError`, `TokenReaderOverflowError`, and the `TokenReader` type
- The Gol engine's shared binary token reader; the `model`, `material` (and `world`) parsers read through it.

### `model`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseModel`, `UnportableModelError`, `ModelCommandKind`, `ModelKeyword`, `ModelCommandKeyword`, `VertexFormat`, and the `Model` types

### `material`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseMaterialLibrary`, `DuplicateMaterialNameError`, `MaterialKeyword`, `AlphaFunctionKeyword`, `BlendFactorKeyword`, `DEFAULT_MATERIAL_FLAGS`, and the `Material` types
