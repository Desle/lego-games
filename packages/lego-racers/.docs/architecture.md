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

### `string-table`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseStringTable`, `getString`, `TruncatedStringTableError`, `StringTableOverreadError`, and the `StringTable` type
- SRF string tables (`0x0044e2c0`).

### `race-description`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseRaceDescription`, `RaceDescriptionKeyword`, and the `RaceDescription` types
- RAB race descriptions (`0x00431e00`): every file a race names.

### `computer-racer-route`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseComputerRacerRoute`, `countComputerRacerRouteVariants`, `chooseComputerRacerRoute`, `getComputerRacerRouteFileName`, `getFallbackComputerRacerRouteFileNames`, `ComputerRacerRouteKeyword`, `ComputerRacerRouteLetter`, and the route types
- RRB computer racer routes (`0x004a4e30`) and the route choice (`0x00433190`).

### `checkpoint`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseCheckpoints`, `assignCheckpointProgress`, `TooManyCheckpointsError`, `UnportableCheckpointsError`, `CheckpointKeyword`, and the `Checkpoint` types
- CPB checkpoints (`0x0041e770`) and their progress (`0x0041e950`).

### `start-position`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseStartPositions`, `StartPositionKeyword`, and the `StartPosition` types
- SPB start grid (`0x0043bc10`).

### `tagged-position`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseTaggedPositions`, `TaggedPositionKeyword`, and the `TaggedPosition` types
- TGB positions with an identifier (`0x0045c3d0`).

### `power-up`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parsePowerUps`, `PowerUpKeyword`, and the power-up types
- PWB power-up brick placements (`0x00458810`).

### `trigger`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseTriggers`, `TriggerFileKind`, `TriggerKeyword`, and the `Trigger` types
- TRB main and environment triggers (`0x00465210`, `0x00463dc0`, `0x00464ff0`).

### `timer`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseTimers`, `resolveTimerSecondValue`, `TimerDivideByZeroError`, `TimerKeyword`, and the `Timer` types
- TIB timers (`0x00464aa0`, `0x00464750`).

### `emitter`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseEmitters`, `EmitterKeyword`, and the `Emitter` types
- EMB particle emitter definitions (`0x00489af0`).

### `sky`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseSky`, `SkyKeyword`, and the `Sky` types
- SKB sky settings (`0x0041c550`).

### `load-screen`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseLoadScreen`, `getLoadScreenPixelPoints`, `LoadScreenKeyword`, and the `LoadScreen` types
- LSB loading screens (`0x0042f480`).

### `track-material`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseTrackMaterials`, `TrackMaterialKeyword`, and the `TrackMaterial` types
- TMB track surface materials (`0x00444030`).

### `ghost`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseGhost`, `TooManyGhostSamplesError`, `GhostKeyword`, and the `Ghost` types
- GHB recorded ghosts (`0x00423160`).

### `hazard`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseHazards`, `HazardKeyword`, `HazardBlockKeyword`, and the `Hazard` types
- HZB hazards (`0x0048a4d0` and twenty class loaders).

## Shared code (`src/shared`)

- `name-table`: the eight-character name table of `GolDP.dll` (`0x10028250`, `0x100282c0`, `0x100283e0`), used by the skeleton, image, font and animation parsers.
- `errors/gol-file-errors.ts`: `DuplicateNameError` and `UnportableFileError`.
- `binary-values`: the 16-bit and 8-bit truncations and the float32 scalings the loaders apply.
- `token-encoding`: builds binary token streams for tests.
- `testing/original-files.ts`: the path to the original `LEGO.JAM` the format specs read (they skip without it); `testing/token-bytes.ts`: float and integer lists and curly bytes on top of `token-encoding`.

### `simulation-math`

- Layers: `types`
- Public API (`index.ts`): `createFloatArithmetic`, `RACE_FPU_PRECISION`, `FpuPrecision`, `getNormalizedVector2`, `getNormalizedVector3`, `getVectorRotatedAroundAxis`, `getSineCosine`, `getMatrixProduct`, `getMatrixInFrame`, `getMatrixFromQuaternion`, `getQuaternionFromMatrix`, `getBlendedQuaternion`, `getFrameAxes`, `getRotationFromFrameAxes`, `IDENTITY_MATRIX3`, `ZERO_VECTOR3`, and the `Vector2`, `Vector3`, `Matrix3`, `Quaternion`, `FloatArithmetic` types
- The race physics' leaf maths. Every function takes a `FloatArithmetic`, the precision policy that rounds x87 intermediates to float32 or keeps them as doubles; `RACE_FPU_PRECISION` picks it in one place.

### `racer-physics`

- Layers: `controller`, `types`
- Public API (`index.ts`): `stepCarRigidBody` (`RigidBody_Step`), `CAR_RIGID_BODY_HOOKS`, `createCarRigidBody`, `setWheelGeometry`, `setHullPoint`, `setLocalCentreOfMass`, the car commands (`setThrottle`, `setTopSpeed`, `addImpulse`, `addScaledImpulse`, `setExtraForce`, `setFlaggedTimer`, `setLeaning`), the pass functions (`applyCarForces`, `probeGround`, `updateHeading`, `advanceToContact`, `respondToContact`, …), `CarRigidBodyFlag`, `TwoPointModeNotPortedError`, `createBoxRigidBody`, the rigid body force helpers, `integrateRigidBody`, `getRaceTimeStep`, `getPhysicsSubSteps`, `updateRacePhysics`, and the `RigidBody` and `CarRigidBody` types
- Pure state transitions: each function takes frozen plain data and returns new frozen data. Depends on `simulation-math` and `collision`.

### `collision`

- Layers: `controller`, `types`
- Public API (`index.ts`): `loadCollisionObject`, `createCollisionVolume`, `getMirroredCollisionVolume`, `getSegmentQueryResult`, `getIsPointInTriangle`, `getTriangleSegmentResult`, `getCollisionMaterialName`, and the `CollisionVolume`, `CollisionObject` and query types
- The race's queries against the world's BSP volumes (`0x00403fa0`, `0x004497f0`, `0x00448b80`) as pure functions over parsed `.BVB` data. Depends on `bsp-volume` and `simulation-math`.

### `random-table`

- Layers: `controller`, `types`
- Public API (`index.ts`): `loadRandomTable`, `getPortableExecutableLayout`, `readPortableExecutableBytes`, `createRandomTable`, `decodeRandomTable`, `createRandomTablePosition`, `getNextRandomTablePosition`, `drawRandomValue`, `drawRandomRemainder`, `drawRandomLowByte`, `drawRandomScaledRange`, the `RANDOM_TABLE_*` constants, `PortableExecutableError`, `InvalidRandomTableError`, `RandomDivisorError`, and the `RandomTable`, `RandomTablePosition`, `RandomDraw`, `PortableExecutable*` types
- The game's only randomness: 1,024 values at `0x004befec`, read from the player's `LEGORacers.exe`, and the global position `0x004c6ee4` as explicit state a server can synchronise.

### `racer-ai`

- Layers: `types`
- Public API (`index.ts`): the route follower (`createRouteFollower`, `resetRouteFollower`, `startRouteFollowerAtLoop`, `advanceRouteFollower`, `setRouteFollowerSpeedFactor`), the sample decoders (`decodeRouteSample`, `getRouteSample*`), the speed code (`stepComputerSpeedFactor`, `getRampedTargetSpeedFactor`, `getReturnedLateralOffset`, `stepComputerBounce`, `getPushedSpeedState`, `getRestoredSpeedState`, `getReleasedSpeedState`, `CAR_BODY_*_FLAG`), rubber-banding (`createRubberBand`, `stepRubberBand`, `getRacerProgress`), personality (`getComputerPersonality`, `getComputerChance`, `PERSONALITY_SCALE`), power-up use (`updatePowerUpUse`, `decidePowerUpUse`, `PowerUpUseDecision`), taunts (`updateComputerTaunt`, `createComputerTimers`), `findNearestRacerInCone`, `getFloatToInteger`, `UnportableRouteError`, and their types
- Computer racers play recorded routes back kinematically; they produce no control input. Depends on `simulation-math`, `random-table` and `computer-racer-route`.

### `racer`

- Layers: `controller`, `services`, `types`
- Public API (`index.ts`): `stepRacerSet`, `RACER_SET_STEP_DEPENDENCIES_NOT_YET_PORTED`, `applyRacerControls`, `updatePlayerController`, `createPlayerController`, `startRacerPowerSlide`, `stopRacerPowerSlide`, `readRacerTables`, `createCarBody`, `stepRacerRigidBody`, `createRacer`, `createRacerSet`, the car body and driver functions, `rankRacers`, `playRacerVoice`, `getTableCosine`, and the `Racer`, `CarBody`, `RacerDriver`, `RacerControls`, `RacerSet` types
- `RacerSet_Step` (`0x0043c030`) and the player controls. Calls into code not ported yet (rigid body step, AI, power-ups, audio, vehicle effects) are typed dependencies that receive and return the whole racer set. Reuses `racer-ai` (rubber band, progress, taunt), `random-table` and `checkpoint`; depends on `simulation-math` and `racer-physics`.

### `scene`

- Layers: `controller`, `types`
- Public API (`index.ts`): `loadScene`, `getWorldPaths`, `getRaceWorldPaths`, `COMMON_DIRECTORY`, `SceneLinkError`, `ScenePathError`, the render-state enums (`ShadeMode`, `TextureOperation`, `CompareFunction`, `BlendFactor`, `TextureFilter`, `TextureAddressing`), `SceneInstanceKind`, `MissingBitmapReason`, and the `Scene` types
- Links worlds into a renderable scene (`0x10017ac0`, `0x1002e640`) and derives each material's Direct3D state (`0x1000a2c0`). Depends on `jam-archive`, `world`, `texture-database`, `material`, `model` and `bitmap`; free of DOM and rendering libraries.
