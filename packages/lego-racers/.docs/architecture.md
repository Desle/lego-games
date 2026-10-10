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

### `texture-database`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseTextureDatabase`, `TextureDatabaseKeyword`, `TEXTURE_LOADED_FLAG`, and the `TextureDatabase` types
- `.TDB` texture databases (`GolDP.dll` `0x1002b5a0`).

### `image-database`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseImageDatabase`, `ImageDatabaseKeyword`, `IMAGE_KEYWORD_2B_FLAG`, `IMAGE_KEYWORD_2B_EXTRA_FLAG`, and the `ImageDatabase` types
- `.IDB` image databases (`GolDP.dll` `0x10023060`).

### `font-database`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseFontDatabase`, `FontDatabaseKeyword`, `FONT_CHARACTER_CAPACITY`, `FONT_KEYWORD_2A_FLAG`, `FONT_KEYWORD_2A_EXTRA_FLAG`, and the `FontDatabase` types
- `.FDB` font databases (`GolDP.dll` `0x1001d8f0`).

### `skeleton`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseSkeleton`, `SkeletonKeyword`, and the `Skeleton` types
- `.SDB` skeletons (`GolDP.dll` `0x10029a20`).

### `bsp-tree`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseBspTree`, `BspTreeKeyword`, `BspTreeNodeKind`, `NO_NODE_INDEX`, and the `BspTree` types
- `.BDB` BSP trees (`GolDP.dll` `0x1001ae50`).

### `bsp-volume`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseBspVolume`, `BspVolumeKeyword`, `CHILD_FFFF_INDEX`, `CHILD_FFFE_INDEX`, and the `BspVolume` types
- `.BVB` BSP volumes (`GolDP.dll` `0x1001b800`).

### `animation`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseAnimation`, `AnimationKeyword`, `KEYWORD_31_DEFAULT_FOURTH_VALUE`, and the `Animation` types
- `.ADB` animations (`GolDP.dll` `0x100188e0`).

### `material-animation`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseMaterialAnimation`, `MaterialAnimationKeyword`, the entry defaults, and the `MaterialAnimation` types
- `.MAB` material animations (`GolDP.dll` `0x100258f0`).

## Shared code (`src/shared`)

- `name-table`: the eight-character name table of `GolDP.dll` (`0x10028250`, `0x100282c0`, `0x100283e0`), used by the skeleton, image, font and animation parsers.
- `errors/gol-file-errors.ts`: `DuplicateNameError` and `UnportableFileError`.
- `binary-values`: the 16-bit and 8-bit truncations and the float32 scalings the loaders apply.
- `token-encoding`: builds binary token streams for tests.

### `simulation-math`

- Layers: `types`
- Public API (`index.ts`): `createFloatArithmetic`, `RACE_FPU_PRECISION`, `FpuPrecision`, `getNormalizedVector2`, `getNormalizedVector3`, `getVectorRotatedAroundAxis`, `getSineCosine`, `getMatrixProduct`, `getMatrixInFrame`, `getMatrixFromQuaternion`, `getQuaternionFromMatrix`, `getBlendedQuaternion`, `getFrameAxes`, `getRotationFromFrameAxes`, `IDENTITY_MATRIX3`, `ZERO_VECTOR3`, and the `Vector2`, `Vector3`, `Matrix3`, `Quaternion`, `FloatArithmetic` types
- The race physics' leaf maths. Every function takes a `FloatArithmetic`, the precision policy that rounds x87 intermediates to float32 or keeps them as doubles; `RACE_FPU_PRECISION` picks it in one place.

### `racer-physics`

- Layers: `controller`, `types`
- Public API (`index.ts`): `createBoxRigidBody`, `getBoxInertia`, `getWorldInverseInertia`, `getAngularVelocity`, `addForce`, `addTorqueOfForceAtPoint`, `removeAngularMomentumAlongAxis`, `integrateRigidBody`, `getRaceTimeStep`, `getPhysicsSubSteps`, `MAXIMUM_PHYSICS_SUB_STEP_MILLISECONDS`, `updateRacePhysics`, `stepRaceSubStepNotYetPorted`, and the `RigidBody` types
- Pure state transitions: each function takes frozen plain data and returns new frozen data. Depends on `simulation-math`.
