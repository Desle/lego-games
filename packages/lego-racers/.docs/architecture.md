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

### `event`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseEvents`, `EventBlockKeyword`, `EventSectionKeyword`, `NO_SIGNAL`, and the `Event` types
- EVB track events (`0x0045efa0` and its thirteen section readers).

### `track-logic`

- Layers: `controller`, `types`
- Public API (`index.ts`): `createTrackLogic`, `runTrackLogic`, `updateTrackLogicFrame`, `tickTrackTimeEntries`, `updateTrackEvents`, `STATIC_TRACK_WORLD`, `TrackEventKind`, `TrackEventState`, and the `TrackLogic` types
- Events, triggers, timers and the signal bus at runtime (`0x00461ef0`, `0x00462580`, `0x00464830`, `0x004648d0`).

### `emitter`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseEmitters`, `EmitterKeyword`, and the `Emitter` types
- EMB particle emitter definitions (`0x00489af0`).

### `sky`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseSky`, `createSkyDome`, `createSkyState`, `advanceSky`, `switchSkySetting`, `getSkyRingColors`, `getSkyVertexColors`, `getSkyPlacement`, `SkyStateError`, `SkyKeyword`, and the `Sky` types
- SKB sky settings (`0x0041c550`), the dome sphere builder (`0x004907f0`), keyframe running (`0x0041ccb0`) and placement (`0x0041d040`). Depends on `simulation-math`.

### `targa`

- Layers: `controller`, `types`
- Public API (`index.ts`): `decodeTarga`, `readTargaHeader`, `InvalidTargaError`, `UnsupportedTargaDepthError`, and the `TargaHeader` types
- `.TGA` images (`GolDP.dll` `0x1002a5e0`, `0x1002ae50`) decoded into the `bitmap` module's `Bitmap`.

### `skeletal-animation`

- Layers: `controller`, `types`
- Public API (`index.ts`): `getSkeletalAnimation`, `getRestPose`, `getSkeletonPose`, `getBoneMatrices`, `getBoneRotation`, `createSkeletonAnimationState`, `advanceSkeletonAnimation`, `samplePosition`, `sampleRotation`, `getBlendedQuaternion`, `getInstancePosition`, `SkeletalAnimationError`, and the pose and state types
- Poses skeletons from animations as the skeleton instance does (`0x10023580`, `0x10023b10`, `0x10024380`, `0x10024540`, `0x10002e30`, `0x1002f450`). Depends on `animation`, `skeleton` and `simulation-math`; free of DOM and rendering libraries.

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

### `racer-collision`

- Layers: `types`
- Public API (`index.ts`): `getBoxOverlap`, `getBoxContact`, `getBoundingSphere`, `getBoundingInterval`, `getSpheresOverlap`, and the `OrientedBox`, `BoxOverlap`, `BoxContact`, `BoundingSphere` and `BoundingInterval` types
- The geometry of car-against-car collisions (`0x00441790`, `0x00441330`, `0x004113d0`, `0x00411b90`): a separating-axis test of two oriented boxes, the contact point, and the bounding spheres of the broad phase. `racer` runs the sweep and the response on top. Depends on `simulation-math`.

### `power-ups`

- Layers: `controller`, `events`, `types`
- Public API (`index.ts`): `createPowerUpWorld`, `updatePowerUps`, `touchPowerUpBricks`, `touchEnhancementBricks`, `setBrickSoundsEnabled`, `usePowerUp`, `activatePowerUp`, `advanceComputerPowerUpUse`, `rollComputerStartTurbo`, `keepPermanentTurbo`, `hitRacerWithProjectile`, `touchHazardEffect`, `endProjectileFlight`, `advancePowerUpEffect`, `updatePowerUpEffects`, `createPowerUpEffects`, `getRacerWithVoiceCooldownAdvanced`, `getRaceModeBrickKind`, `getPowerUpEffectKind`, `BrickKind`, `BrickState`, `EffectState`, `PowerUpEffectKind`, `RaceModeFlag`, `POWER_UP_EFFECT_POOL_SIZES`, `ATTACHMENT_SLOT_COUNT`, the errors, the `PowerUpEvent` union and the world, racer and effect types
- The power-up behaviour (bricks, enhancements, effects); `power-up` is its file format. Pure state transitions that return events for the racer, sound and explosion code. Depends on `simulation-math`, `random-table`, `racer-ai` and `power-up`.

### `projectiles`

- Layers: `controller`, `types`
- Public API (`index.ts`): `updatePowerUpsWithProjectiles`, `updateProjectileEffect`, `touchProjectileFlights`, `touchProjectileHazards`, `touchProjectileExplosions`, `createProjectileWorld`, `createTrackLineProbe`, the flights (`launchFlightAtRacer`, `launchFlightAtPoint`, `launchFlightWithOffset`, `advanceBallisticFlight`, `reflectBallisticFlight`, `touchBallisticFlight`, `getFlightVelocity`, `BallisticFlightState`, `advanceHomingFlight`, `retargetHomingFlight`, `advanceGrappleHook`, `getPointMovedToward`), `getWandBeam`, `getRaySphereHit`, `getMagnetPull`, `getIsWithinMagnetCaptureRange`, `getIsSpeedNearZero`, `getPointMovedAlongRoute`, `getWarpLandingPosition`, the explosions and debris (`createExplosionPool`, `getBlastImpulse`, `ExplosionState`, `createDebrisPool`, `DebrisState`), the collision registry (`getRegistryContacts`, `getSortedRegistryEntries`), the errors, the `ProjectileEvent` union and the world, racer and flight types
- The parts of the power-up effects that move: flights, hooks, beams, pulls, the warp's carry, explosions and debris. Plugs into `power-ups` through its `EffectsUpdater`, and uses its entry points for hits and ends. Takes the track probe, the route and the model data it does not read as typed dependencies. Depends on `power-ups`, `collision`, `random-table` (through `power-ups`) and `simulation-math`.

### `racer`

- Layers: `controller`, `services`, `types`
- Public API (`index.ts`): `stepRacerSet`, `RACER_SET_STEP_DEPENDENCIES_NOT_YET_PORTED`, `applyRacerControls`, `updatePlayerController`, `createPlayerController`, `startRacerPowerSlide`, `stopRacerPowerSlide`, `readRacerTables`, `createCarBody`, `stepRacerRigidBody`, `collideRacers`, `followDriverRoute`, `updateVehicle`, `updatePlayerGuidance`, `notifyRacerContact`, `respondToRacerContact`, `assignDriverRoute`, `createRacer`, `createRacerSet`, the figure and vehicle functions, the car body and driver functions, `rankRacers`, `playRacerVoice`, `getTableCosine`, and the `Racer`, `CarBody`, `RacerDriver`, `RacerControls`, `RacerSet` types
- `RacerSet_Step` (`0x0043c030`) and the player controls. Calls into code not ported yet (rigid body step, AI, power-ups, audio, vehicle effects) are typed dependencies that receive and return the whole racer set. Pass 4 uses `racer-collision` and the registry of `projectiles`. Reuses `racer-ai` (rubber band, progress, taunt, route follower), `random-table` and `checkpoint`; depends on `simulation-math` and `racer-physics`.

### `scene`

- Layers: `controller`, `types`
- Public API (`index.ts`): `loadScene`, `loadModelScene`, `getWorldPaths`, `getRaceWorldPaths`, `getRaceSkyPath`, `getRaceBackgroundWorldPath`, `COMMON_DIRECTORY`, `SceneLinkError`, `ScenePathError`, the render-state enums (`ShadeMode`, `TextureOperation`, `CompareFunction`, `BlendFactor`, `TextureFilter`, `TextureAddressing`), `SceneInstanceKind`, `MissingBitmapReason`, and the `Scene` types
- Links worlds into a renderable scene (`0x10017ac0`, `0x1002e640`) and derives each material's Direct3D state (`0x1000a2c0`). Depends on `jam-archive`, `world`, `texture-database`, `material`, `model`, `bitmap`, `targa`, `skeleton`, `animation` and `skeletal-animation`; free of DOM and rendering libraries.

### `named-record`

- Layers: `controller`, `types`
- Public API (`index.ts`): `readNamedRecords`, `readKeywordBlock`, `findNamedRecord`, `NAMED_RECORD_KEYWORD`, `RECORD_NAME_MAXIMUM_LENGTH`, and the `NamedRecordList` type
- The frame of the five exe database files (`0x00411870`, `0x004119a0`).

### `driver-database`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseDriverDatabase`, `DriverKeyword`, and the `Driver` types
- DDB drivers (`0x004208f0`).

### `champion-database`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseChampionDatabase`, `ChampionKeyword`, and the `Champion` types
- CCB champions (`0x0041d370`).

### `chassis-database`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseChassisDatabase`, `ChassisKeyword`, `ChassisVariantKeyword`, and the `Chassis` types
- CMB chassis (`0x0041db10`).

### `circuit-database`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseCircuitDatabase`, `CircuitKeyword`, `CIRCUIT_RACER_CODE_CAPACITY`, and the `Circuit` types
- CRB circuits (`0x0041f1d0`).

### `race-catalog`

- Layers: `controller`, `types`
- Public API (`index.ts`): `parseRaceCatalog`, `RaceCatalogKeyword`, `UnknownCircuitError`, and the `RaceCatalog` types
- RCB races (`0x004366f0`).

### `racer-setup`

- Layers: `controller`, `types`
- Public API (`index.ts`): `describeChampionRacer`, `describeBuiltRacer`, `createCarBodySetup`, `getSteeringScale`, `getRatingScale`, `setTopSpeedRating`, `BASE_TOP_SPEED`, `getStartSlot`, `getRaceModeRacerFlags`, `getIsCarBodyFlagged`, `getRacerPowerUpAbilities`, `UnknownRacerRecordError`, and the `RacerDescription`, `CarDescription`, `BuiltCar` types
- Cars and drivers of a race (`0x0043b480`, `0x004371c0`); wires `driver-database`, `champion-database`, `chassis-database`, `racer` and `racer-physics`.

### `race`

- Layers: `controller`, `services`, `types`
- Public API (`index.ts`): `stepRace`, `createRace`, `updateRace`, `loadRaceDefinition`, `runHeadlessRace`, `RACE_STEP_DEPENDENCIES`, `IDLE_RACER_CONTROLS`, `NO_RACE_CONTACTS`, `RacePhase`, the phase timings, the racer transitions (`resetRacerForRace`, `releaseRacerAtStart`, `enterZoneZero`, `enterZoneOne`, `enterZoneTwo`, `getRacerAfterCheckpointTouch`, `convertRacerToComputer`), `getRacerAfterWrongWayCheck`, `getRacerAfterTargetGuidance`, `getLapGapMilliseconds`, `placeCarBodyOnRoute`, `stepScriptedCarBody`, `getStartFrame`, `getPlaceholderCarBodyDefinition`, and the `RaceState`, `RaceDefinition`, `RaceInputs`, `RaceEvent`, `RaceContacts` types
- The race itself: `Race_RunLoop` (`0x00432540`) with its five timed states and `Race_Update` (`0x00435220`), wiring `racer`, `racer-ai`, `power-ups`, `random-table`, `racer-physics` and `collision` into one deterministic `stepRace(raceState, inputs, frameMilliseconds) → { raceState, events }`. Free of DOM, clocks and rendering. The `services/` layer loads a race from the player's own `LEGO.JAM` and `LEGORacers.exe` and runs it headless.

### `frame-clock`

- Layers: `controller`
- Public API (`index.ts`): `createFrameClock`, `advanceFrameClock`, `MAXIMUM_FRAME_MILLISECONDS`, `MINIMUM_FRAME_MILLISECONDS`, the `FrameClock` types
- The frame delta of `Application_PumpMessagesAndMeasureFrame` (`0x00416ef0`): whole milliseconds, capped at 100, the under-12 ms sleep as a minimum step. Pure; the caller passes the time.

### `race-input`

- Layers: `controller`, `types`
- Public API (`index.ts`): `getRacerControls`, `DEFAULT_KEYBOARD_BINDINGS`, `GAMEPAD_BUTTON_BINDINGS`, `GAMEPAD_STEERING_AXIS_INDEX`, `RaceBinding`, the snapshot types
- The nine player-controller bindings with the original default keyboard layout (table `0x004b0624`) and the joystick set-up of `0x0042e960`, mapped to `RacerControls`. Depends on `race` and `racer`.

### `race-camera`

- Layers: `controller`, `types`
- Public API (`index.ts`): `createCamera`, `attachCamera`, `setCameraPreset`, `setCameraLookingBehind`, `requestCameraSnap`, `updateCamera`, `getCameraView`, `getCameraRacerView`, `CAMERA_PRESETS`, `CameraMode`, the camera types
- `Camera_Update` (`0x00428540`) chase, cockpit and finish modes and the preset table `0x004b0328`. Pure; the viewer applies the returned eye, forward and up. Depends on `simulation-math` and `racer`.

### `race-hud`

- Layers: `controller`, `types`
- Public API (`index.ts`): `getHudLayout`, `createHudState`, `getHudFrame`, `startHudCountdown`, `finishHud`, `formatHudTime`, `HudFont`, the HUD types
- The HUD layout (`0x004261f0`, `0x00425e90`) and draw routine (`0x004263a0`) as draw commands: countdown, lap rows, place, wrong way, held power-up. Text sizes and image sizes come from the caller.

### `race-audio`

- Layers: `controller`, `types`
- Public API (`index.ts`): `getIntroductionMusic`, `getRacingMusic`, `getFinishMusic`, `RACE_MUSIC_VOLUME`, `getRaceEventSounds`, `getCountdownSound`, `getPowerSlideSound`, `getSoundLocation`, `POWER_UP_SOUND_SITES`, `SoundBankKind`, the audio types
- Which music track and which sound effect the race plays, with the address of each call. Pure; the caller decodes (`audio`) and plays.

### `race-presentation`

- Layers: `controller`, `types`
- Public API (`index.ts`): `createRacePresentation`, `stepRacePresentation`, `getRacerPoses`, the presentation types
- Ties `race` events and state to the player's camera, HUD, music and sounds, and gives each racer's pose. Depends on `race`, `racer`, `race-camera`, `race-hud`, `race-audio`.
