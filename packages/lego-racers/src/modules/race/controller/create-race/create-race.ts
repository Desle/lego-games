import {
  createComputerTimers,
  createRubberBand,
  getComputerPersonality,
} from '../../../racer-ai/index.ts'
import { createPowerUpWorld, setBrickSoundsEnabled } from '../../../power-ups/index.ts'
import { getRaceModeRacerFlags, getRacerPowerUpAbilities } from '../../../racer-setup/index.ts'
import { createProjectileWorld } from '../../../projectiles/index.ts'
import {
  createCarBody,
  createPlayerController,
  createRacer,
  createRacerSet,
} from '../../../racer/index.ts'
import type { Racer, RacerSet } from '../../../racer/index.ts'
import { drawRandomValue } from '../../../random-table/index.ts'
import type { RandomTablePosition } from '../../../random-table/index.ts'
import { createTrackLogic } from '../../../track-logic/index.ts'
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
import type { RacerSetup } from './create-race.types.ts'

// The laps of a race with one local player (0x004327f0).
const SINGLE_PLAYER_LAP_COUNT = 3
// Race_LoadTrackContent sets it on the demonstration's racer (0x00433a2d).
const DEMONSTRATION_FLAG = 0x800000
// float32 0.05 at 0x004b07f0, the rubber band's bias on a mirrored track (0x00433773).
const MIRRORED_RUBBER_BAND_BIAS = Math.fround(0.05)

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
  const base = createRacer(
    racerDefinition.route === null
      ? carBody
      : placeCarBodyOnRoute(arithmetic, carBody, racerDefinition.route)
  )
  const racer: Racer = Object.freeze({
    ...base,
    lapCount,
    powerUpChances: personality.chances,
    proximityCheckMilliseconds: timers.tauntMilliseconds,
    voiceMilliseconds: timers.voiceMilliseconds,
    flags: getRaceModeRacerFlags(definition.raceModeFlags),
    controllerKind: racerDefinition.controllerKind,
    racePosition: racerIndex + 1,
    voiceBase: racerDefinition.voiceBase,
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

// Race_LoadRaceDescription 0x00431e00 and Race_LoadTrackContent 0x00433480, as far as the simulation is
// concerned: the lap count (0x004327f0), the racers (RacerSet_Setup 0x0043b190), the timers' draws and the
// power-ups (PowerUps_Initialize 0x00457c20), ending in the state Race_RunLoop starts from.
export const createRace = (definition: RaceDefinition): RaceState => {
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
  const racers = setups.map((made, index) =>
    isDemonstration && index === 0
      ? Object.freeze({
          ...convertRacerToComputer(made.racer),
          flags: (made.racer.flags | DEMONSTRATION_FLAG) >>> 0,
        })
      : made.racer
  )
  const afterRacers = setups.at(-1)?.position ?? definition.randomPosition
  const trackLogic = createTrackLogic(
    {
      eventSet: definition.events,
      timerList: definition.timers,
      mainTriggers: definition.mainTriggers,
      environmentTriggers: definition.environmentTriggers,
    },
    definition.arithmetic,
    { table: definition.tables.randomTable, position: afterRacers }
  )
  const racerSet: RacerSet = createRacerSet(
    racers,
    trackLogic.random.position,
    definition.isMirrored ? MIRRORED_RUBBER_BAND_BIAS : 0
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
  return Object.freeze({
    phase: RacePhase.INTRODUCTION,
    phaseMilliseconds: 0,
    isRunning: true,
    finishedRacerCount: 0,
    lapCount,
    isMultiplayer,
    isDemonstration,
    isCountdownSkipped: definition.isCountdownSkipped,
    isPointsRecordPresent: definition.isPointsRecordPresent,
    ghost: definition.ghost,
    musicTuneCount: definition.musicTuneCount,
    tuneIndex: definition.musicTuneCount > 0 ? INTRODUCTION_TUNE_INDEX : null,
    pauseState: 0,
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
      randomPosition: powerUps.world.random.position,
      rubberBand: createRubberBand(racerSet.rubberBand.bias),
    }),
    playerRacerIndices: Object.freeze(playerRacerIndices),
    playerControllers: Object.freeze(playerRacerIndices.map(() => createPlayerController(false))),
    powerUpStep,
    powerUpSetups: Object.freeze(setups.map((made) => made.setup)),
    getGroundPoint: definition.getGroundPoint,
    trackTargets: definition.trackTargets,
    projectileWorld: createProjectileWorld(powerUpStep),
    projectileModelData: definition.projectileModelData,
    trackLogic,
    trackEffects: Object.freeze([]),
    timers: definition.timers,
    mainTriggers: definition.mainTriggers,
    environmentTriggers: definition.environmentTriggers,
    hazards: definition.hazards,
    startPositions: definition.startPositions,
  })
}
