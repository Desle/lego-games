import {
  createComputerTimers,
  createRubberBand,
  getComputerPersonality,
} from '../../../racer-ai/index.ts'
import { createPowerUpWorld, setBrickSoundsEnabled } from '../../../power-ups/index.ts'
import { getRaceModeRacerFlags, getRacerPowerUpAbilities } from '../../../racer-setup/index.ts'
import {
  createProjectileWorld,
  createTrackLineProbe,
  NO_PROBE_SURFACE,
} from '../../../projectiles/index.ts'
import type { GroundQuery } from '../../../power-ups/index.ts'
import {
  createCarBody,
  createPlayerController,
  createRacer,
  createRacerSet,
  createVehicle,
  getVehicleLeanAtReset,
} from '../../../racer/index.ts'
import type { Racer, RacerSet } from '../../../racer/index.ts'
import { drawRandomValue } from '../../../random-table/index.ts'
import type { RandomTablePosition } from '../../../random-table/index.ts'
import { createSkyState } from '../../../sky/index.ts'
import { NO_EMITTER_POOLS } from '../../../emitter/index.ts'
import {
  findSkeletonInstanceIndex,
  getSkeletonInstanceWithFlagsChanged,
  getWorldWithSkeletonInstance,
  INSTANCE_LOOPING_FLAG,
} from '../../../world-animation/index.ts'
import type { SkeletonInstanceRuntime } from '../../../world-animation/index.ts'
import type { Vector3 } from '../../../skeletal-animation/index.ts'
import { createTrackLogic } from '../../../track-logic/index.ts'
import type { TrackLogicState } from '../../../track-logic/index.ts'
import { CLOSED_PAUSE_MENU } from '../../types/pause-menu/pause-menu.ts'
import { createPointsRecord } from '../../types/points-record/points-record.ts'
import { RaceExit } from '../../types/race-exit/race-exit.ts'
import { INTRODUCTION_TUNE_INDEX, RacePhase } from '../../types/race-phase/race-phase.ts'
import type {
  RaceDefinition,
  RaceRacerDefinition,
  RaceRacerPowerUpSetup,
  RaceState,
} from '../../types/race.types.ts'
import {
  convertRacerToComputer,
  PLAYER_CONTROLLER,
  resetRacerForRace,
} from '../../types/racer-transitions/racer-transitions.ts'
import { placeCarBodyOnRoute } from '../../types/scripted-car-body/scripted-car-body.ts'
import { createSurfaceMaterials } from '../../types/surface-materials/surface-materials.ts'
import { createRegistryObjects, getRegistryEntries } from '../registry-objects/registry-objects.ts'
import { createCameraFovEffect } from '../camera-fov-effect/camera-fov-effect.ts'
import { createScreenFader, startScreenFade } from '../../types/screen-fader/screen-fader.ts'
import type { RacerSetup } from './create-race.types.ts'

// Race_LoadTrackContent 0x00433480 starts the fader's first entry with 0x00494eb0 (0x00433525: 500 ms, the flag set so the black
// fades away, no camera; the entry's colour is the reset black of 0x00490530).
const RACE_START_FADE_MILLISECONDS = 500 // 0x0043351e
const RACE_START_FADE_COLOUR = Object.freeze({ red: 0, green: 0, blue: 0 })

// The laps of a race with one local player (0x004327f0).
const SINGLE_PLAYER_LAP_COUNT = 3
// 0x004300d0 (Race_AcquireControllers) calls 0x00430100, which arms each player controller: state bit 0x1 (before the
// start), boost window and accelerate time 0.
const CONTROLLER_BEFORE_START_FLAG = 0x1
// Race_LoadTrackContent sets it on the demonstration's racer (0x00433a2d).
const DEMONSTRATION_FLAG = 0x800000
// float32 0.05 at 0x004b07f0, the rubber band's bias on a mirrored track (0x00433773).
const MIRRORED_RUBBER_BAND_BIAS = Math.fround(0.05)

// 0x0043d7a0 draws `% 2000` for the vehicle's +0x388, the time before the driver may look at another racer.
const VEHICLE_LOOK_MILLISECONDS = 2000

// 0x00436df0 and 0x004371c0 for one racer, then 0x004374c0: the computer racer's chances and its two timers
// (two random table draws, even for a player), the vehicle's animation timer (0x0043d7a0, a third draw), the
// place on the grid, the route placement and the reset.
const createRacerFromDefinition = (
  definition: RaceDefinition,
  racerDefinition: RaceRacerDefinition,
  racerIndex: number,
  lapCount: number,
  position: RandomTablePosition
): RacerSetup => {
  const { arithmetic, tables } = definition
  const personality = getComputerPersonality(arithmetic, racerDefinition.personalityBytes)
  const timers = createComputerTimers(tables.randomTable, position)
  const vehicleDraw = drawRandomValue(tables.randomTable, timers.position)
  const carBody = createCarBody(racerDefinition.carBody)
  const vehicle = createVehicle(
    racerDefinition.figures.driver,
    racerDefinition.appearance.seatPoint,
    vehicleDraw.value % VEHICLE_LOOK_MILLISECONDS,
    racerDefinition.figures.bodyBounds,
    racerDefinition.appearance.wheelMarks
  )
  const base = createRacer(
    racerDefinition.route === null
      ? carBody
      : placeCarBodyOnRoute(arithmetic, carBody, racerDefinition.route),
    racerDefinition.figures.wheels
  )
  const racer: Racer = Object.freeze({
    ...base,
    collisionObjectIndices: definition.carCollisionObjectIndices,
    lapCount,
    powerUpChances: personality.chances,
    proximityCheckMilliseconds: timers.tauntMilliseconds,
    voiceMilliseconds: timers.voiceMilliseconds,
    vehicle: Object.freeze({
      ...vehicle,
      ...getVehicleLeanAtReset(
        arithmetic,
        base.carBody.rigidBody.displayFrame,
        racerDefinition.appearance.seatPoint
      ),
    }),
    flags: getRaceModeRacerFlags(definition.raceModeFlags),
    controllerKind: racerDefinition.controllerKind,
    racePosition: racerIndex + 1,
    voiceBase: racerDefinition.voiceBase,
    engineSoundValue: racerDefinition.engineSoundValue,
  })
  const setup: RaceRacerPowerUpSetup = Object.freeze({
    personality: Object.freeze({
      chances: personality,
      preferredKind: racerDefinition.preferredPowerUpKind,
      preferredLevel: racerDefinition.preferredPowerUpLevel,
    }),
    abilities: getRacerPowerUpAbilities(definition.raceModeFlags),
  })
  return Object.freeze({
    racer: resetRacerForRace(racer),
    setup,
    position: vehicleDraw.position,
  })
}

// The camera follows the track world's skeleton instance named by the race description (RAB keyword 0x49); the
// original's trace shows the instance without the looping flag from the first frame, which is what lets its clip
// finish (0x0040e360). **Hypothesis**: the camera's attachment clears the flag; the writer is not traced.
// The trace shows the mirrored race's camera instance with the y of its velocity and of its clip's velocity at -0:
// the camera takes its clip's (mirrored) velocities. **Hypothesis**: the attachment copies them.
const getMirroredClipVelocity = (
  instance: SkeletonInstanceRuntime,
  isMirrored: boolean
): SkeletonInstanceRuntime => {
  const { clip } = instance
  if (!isMirrored || clip === null) return instance
  const flip = (vector: Vector3): Vector3 =>
    Object.freeze([vector[0], -vector[1], vector[2]] as const)
  return Object.freeze({
    ...instance,
    clip: Object.freeze({
      ...clip,
      velocity: flip(clip.velocity),
      clip: Object.freeze({ ...clip.clip, velocity: flip(clip.clip.velocity) }),
    }),
  })
}

const getTrackLogicWithIntroductionCamera = (
  trackLogic: TrackLogicState,
  name: string | null,
  isMirrored: boolean
): TrackLogicState => {
  const world = trackLogic.worlds.track
  const index = name === null ? -1 : findSkeletonInstanceIndex(world, name)
  const instance = world.skeletonInstances[index]
  return instance === undefined
    ? trackLogic
    : Object.freeze({
        ...trackLogic,
        worlds: Object.freeze({
          ...trackLogic.worlds,
          track: getWorldWithSkeletonInstance(
            world,
            index,
            getMirroredClipVelocity(
              getSkeletonInstanceWithFlagsChanged(instance, 0, INSTANCE_LOOPING_FLAG),
              isMirrored
            )
          ),
        }),
      })
}

const getFoundIntroductionCameraObject = (
  trackLogic: TrackLogicState,
  name: string | null
): string | null =>
  name !== null && findSkeletonInstanceIndex(trackLogic.worlds.track, name) >= 0 ? name : null

// Race_LoadRaceDescription 0x00431e00 and Race_LoadTrackContent 0x00433480, as far as the simulation is
// concerned: the lap count (0x004327f0), the racers (RacerSet_Setup 0x0043b190), the timers' draws and the
// power-ups (PowerUps_Initialize 0x00457c20), ending in the state Race_RunLoop starts from.
// The track world's line query 0x0041f4d0 over the track's collision object, as the hazards and the enhancement bricks
// use it (0x00456360, 0x00439490).
const groundQueries = new WeakMap<RaceDefinition, GroundQuery | null>()

const getTrackGroundQuery = (definition: RaceDefinition): GroundQuery | null => {
  if (definition.getGroundPoint !== null) return definition.getGroundPoint
  const known = groundQueries.get(definition)
  if (known !== undefined) return known
  // The track is the first object of the cars' list, not always the first instance (RACEC0R1 starts with startfin).
  const track = definition.collisionObjects[definition.carCollisionObjectIndices[0] ?? 0]
  const query =
    track === undefined
      ? null
      : ((): GroundQuery => {
          const probe = createTrackLineProbe(
            definition.arithmetic,
            track.volume,
            () => NO_PROBE_SURFACE
          )
          return (start, end, onNormal) => {
            const hit = probe(start, end)
            if (hit !== null) onNormal?.(hit.normal)
            return hit?.point ?? null
          }
        })()
  groundQueries.set(definition, query)
  return query
}

export const createRace = (definition: RaceDefinition): RaceState => {
  const getGroundPoint = getTrackGroundQuery(definition)
  const isMultiplayer = definition.localPlayerCount >= 2
  const isDemonstration = definition.localPlayerCount === 0
  const lapCount = isMultiplayer ? definition.multiplayerLapCount : SINGLE_PLAYER_LAP_COUNT
  const racerDefinitions = definition.racers.map((racerDefinition, index) =>
    isDemonstration && index === 0
      ? Object.freeze({ ...racerDefinition, controllerKind: PLAYER_CONTROLLER })
      : racerDefinition
  )
  const setups = racerDefinitions.reduce<readonly RacerSetup[]>((made, racerDefinition) => {
    const previous = made.at(-1)
    return [
      ...made,
      createRacerFromDefinition(
        definition,
        racerDefinition,
        made.length,
        lapCount,
        previous === undefined ? definition.randomPosition : previous.position
      ),
    ]
  }, [])
  const routes = racerDefinitions.map((racerDefinition) => racerDefinition.route)
  const racers = setups.map((made, index) =>
    isDemonstration && index === 0
      ? Object.freeze({
          ...convertRacerToComputer(definition.arithmetic, made.racer, routes),
          flags: (made.racer.flags | DEMONSTRATION_FLAG) >>> 0,
        })
      : made.racer
  )
  const afterRacers = setups.at(-1)?.position ?? definition.randomPosition
  const loadedTrackLogic = createTrackLogic(
    {
      eventSet: definition.events,
      timerList: definition.timers,
      mainTriggers: definition.mainTriggers,
      environmentTriggers: definition.environmentTriggers,
      hazardList: definition.hazards,
      isMirrored: definition.isMirrored,
      ...(definition.worlds === undefined ? {} : { worlds: definition.worlds }),
      ...(definition.emitters === undefined ? {} : { emitters: definition.emitters }),
    },
    definition.arithmetic,
    { table: definition.tables.randomTable, position: afterRacers }
  )
  const createdTrackLogic = getTrackLogicWithIntroductionCamera(
    loadedTrackLogic,
    definition.introductionCameraObject,
    definition.isMirrored
  )
  // The pools belong to the racer set: vehicles spawn into them as well. The track logic gets them back whenever it
  // runs (changeTrackLogic).
  const trackLogic: TrackLogicState = Object.freeze({
    ...createdTrackLogic,
    emitters: NO_EMITTER_POOLS,
  })
  const racerSet: RacerSet = createRacerSet(
    racers,
    trackLogic.random.position,
    definition.isMirrored ? MIRRORED_RUBBER_BAND_BIAS : 0,
    createdTrackLogic.emitters
  )
  const powerUps = createPowerUpWorld({
    bricks: definition.powerUps.bricks,
    enhancementBricks: definition.powerUps.enhancementBricks,
    raceModeFlags: definition.raceModeFlags,
    isSplitScreen: isMultiplayer,
    racers: racers.map((racer) => ({
      voiceSoundBase: racer.voiceBase,
      voiceCooldownMilliseconds: racer.voiceMilliseconds,
    })),
    random: { table: definition.tables.randomTable, position: racerSet.randomPosition },
  })
  const playerRacerIndices = racerDefinitions.flatMap((racerDefinition, index) =>
    racerDefinition.controllerKind === PLAYER_CONTROLLER ? [index] : []
  )
  const powerUpStep = setBrickSoundsEnabled(powerUps, false)
  const registryObjects = createRegistryObjects(
    definition.mainTriggers,
    definition.environmentTriggers,
    powerUps.world.bricks.length,
    powerUps.world.enhancementBricks.length
  )
  const registryEntries = getRegistryEntries(
    definition.arithmetic,
    {
      arithmetic: definition.arithmetic,
      registryObjects,
      trackLogic,
      powerUpStep,
      projectileWorld: createProjectileWorld(powerUpStep),
      projectileModelData: definition.projectileModelData,
    },
    []
  )
  return Object.freeze({
    phase: RacePhase.INTRODUCTION,
    phaseMilliseconds: 0,
    isRunning: true,
    exit: RaceExit.NONE,
    pauseMenu: CLOSED_PAUSE_MENU,
    pointsRecord:
      definition.pointsRecord ?? (definition.isPointsRecordPresent ? createPointsRecord() : null),
    isSettingsFlag40Set: definition.isSettingsFlag40Set,
    finishedRacerCount: 0,
    lapCount,
    isMultiplayer,
    isDemonstration,
    isCountdownSkipped: definition.isCountdownSkipped,
    ghost: definition.ghost,
    musicTuneCount: definition.musicTuneCount,
    introductionCameraObject: getFoundIntroductionCameraObject(
      createdTrackLogic,
      definition.introductionCameraObject
    ),
    isMirrored: definition.isMirrored,
    tuneIndex: definition.musicTuneCount > 0 ? INTRODUCTION_TUNE_INDEX : null,
    unidentifiedCountdownMilliseconds: 0,
    raceModeFlags: definition.raceModeFlags,
    placements: Object.freeze(racers.map(() => 0)),
    context: Object.freeze({
      arithmetic: definition.arithmetic,
      tables: definition.tables,
      checkpoints: definition.checkpoints,
      collisionObjects: definition.collisionObjects,
      raceLapCount: lapCount,
    }),
    racerSet: Object.freeze({
      ...racerSet,
      registryEntries,
      randomPosition: powerUps.world.random.position,
      rubberBand: createRubberBand(racerSet.rubberBand.bias),
    }),
    routes: Object.freeze(routes),
    playerRacerIndices: Object.freeze(playerRacerIndices),
    playerControllers: Object.freeze(
      playerRacerIndices.map(() =>
        Object.freeze({
          ...createPlayerController(false),
          stateFlags: CONTROLLER_BEFORE_START_FLAG,
        })
      )
    ),
    cameraFovEffects: Object.freeze(playerRacerIndices.map(() => createCameraFovEffect())),
    screenFader: startScreenFade(
      createScreenFader(),
      { milliseconds: RACE_START_FADE_MILLISECONDS, isFadingOut: true, playerIndex: null },
      RACE_START_FADE_COLOUR
    ),
    powerUpStep,
    powerUpSetups: Object.freeze(setups.map((made) => made.setup)),
    getGroundPoint: getGroundPoint,
    trackTargets: definition.trackTargets,
    surfaces: createSurfaceMaterials(
      definition.trackMaterials,
      definition.collisionObjects[definition.carCollisionObjectIndices[1] ?? -1]
    ),
    collisionObjectNames: definition.collisionObjectNames,
    taggedPositionMilliseconds: Object.freeze(
      racers.map(() => Object.freeze(definition.collisionObjects.map(() => 0)))
    ),
    registryObjects,
    projectileWorld: createProjectileWorld(powerUpStep),
    projectileModelData: definition.projectileModelData,
    trackLogic,
    trackEffects: Object.freeze([]),
    timers: definition.timers,
    mainTriggers: definition.mainTriggers,
    environmentTriggers: definition.environmentTriggers,
    hazards: definition.hazards,
    sky:
      definition.sky === undefined
        ? null
        : Object.freeze({
            state: createSkyState(definition.sky.sky),
            background: definition.sky.background,
          }),
    startPositions: definition.startPositions,
  })
}
