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

### `simulation-math`

- Layers: `types`
- Public API (`index.ts`): `createFloatArithmetic`, `RACE_FPU_PRECISION`, `FpuPrecision`, `getNormalizedVector2`, `getNormalizedVector3`, `getVectorRotatedAroundAxis`, `getSineCosine`, `getMatrixProduct`, `getMatrixInFrame`, `getMatrixFromQuaternion`, `getQuaternionFromMatrix`, `getBlendedQuaternion`, `getFrameAxes`, `getRotationFromFrameAxes`, `IDENTITY_MATRIX3`, `ZERO_VECTOR3`, and the `Vector2`, `Vector3`, `Matrix3`, `Quaternion`, `FloatArithmetic` types
- The race physics' leaf maths. Every function takes a `FloatArithmetic`, the precision policy that rounds x87 intermediates to float32 or keeps them as doubles; `RACE_FPU_PRECISION` picks it in one place.

### `racer-physics`

- Layers: `controller`, `types`
- Public API (`index.ts`): `createBoxRigidBody`, `getBoxInertia`, `getWorldInverseInertia`, `getAngularVelocity`, `addForce`, `addTorqueOfForceAtPoint`, `removeAngularMomentumAlongAxis`, `integrateRigidBody`, `getRaceTimeStep`, `getPhysicsSubSteps`, `MAXIMUM_PHYSICS_SUB_STEP_MILLISECONDS`, `updateRacePhysics`, `stepRaceSubStepNotYetPorted`, and the `RigidBody` types
- Pure state transitions: each function takes frozen plain data and returns new frozen data. Depends on `simulation-math`.
