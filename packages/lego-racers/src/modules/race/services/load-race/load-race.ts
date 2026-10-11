import { EMPTY_PROJECTILE_MODEL_DATA } from '../../types/projectile-model-data/projectile-model-data.ts'
import { parseCheckpoints } from '../../../checkpoint/index.ts'
import {
  chooseComputerRacerRoute,
  countComputerRacerRouteVariants,
  getComputerRacerRouteFileName,
  parseComputerRacerRoute,
} from '../../../computer-racer-route/index.ts'
import { parseEvents } from '../../../event/index.ts'
import { parseHazards } from '../../../hazard/index.ts'
import { decodeSoundBank } from '../../../audio/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { parsePowerUps } from '../../../power-up/index.ts'
import { createRandomTablePosition, drawRandomValue } from '../../../random-table/index.ts'
import type { RandomTablePosition } from '../../../random-table/index.ts'
import { getFigureBounds, readRacerTables } from '../../../racer/index.ts'
import { createRacerFigures, loadRacerFigureSources } from '../../../racer-appearance/index.ts'
import {
  createCarBodySetup,
  getIsCarBodyFlagged,
  getStartSlot,
} from '../../../racer-setup/index.ts'
import type { BuiltCar } from '../../../racer-setup/index.ts'
import { DEFAULT_SAVE_PATH, getCarWeight, loadSavedCars } from '../../../car-builder/index.ts'
import type { SavedCar } from '../../../car-builder/index.ts'
import { parseRaceDescription } from '../../../race-description/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { parseStartPositions } from '../../../start-position/index.ts'
import { parseTimers } from '../../../timer/index.ts'
import { parseTrackMaterials } from '../../../track-material/index.ts'
import { parseTriggers, TriggerFileKind } from '../../../trigger/index.ts'
import {
  COMPUTER_CONTROLLER,
  PLAYER_CONTROLLER,
} from '../../types/racer-transitions/racer-transitions.ts'
import type { RaceDefinition, RaceRacerDefinition } from '../../types/race.types.ts'
import { getStartFrame } from '../../types/start-frame/start-frame.ts'
import { loadCollisionWorld } from './load-collision-world.ts'
import type { LoadRaceOptions, RouteDraws, RouteDrawer, RouteFiles } from './load-race.types.ts'
import {
  describeAppearances,
  describeRacers,
  getCircuitRacerCodes,
  readRacerDatabases,
} from './load-racers.ts'

const JAM_SEPARATOR = '\\'
const DEFAULT_RACE_FOLDER = 'RACEC0R0'
const DEFAULT_RACER_COUNT = 6
const DEFAULT_LAP_COUNT = 3
// The driver of a car built from bricks is made on `LEG_BOX` (GDB scale 1/64), which sets the scale of his model.
const BUILT_DRIVER_MODEL_SCALE = 0.015625

// The RAB names the text files (.cpf, .sps); the loaders read the binary twin, whose extension ends in b.
const getJamFileName = (name: string): string => `${name.slice(0, -1)}b`.toUpperCase()

// 0x0042d730 → 0x0042dcb0: the front end takes each local player's car from its racer save (`default.lrs` when the player
// has not saved one): the chassis, and the weight and centre offsets of the design on the grid (0x0049c6a0).
const getBuiltCar = (arithmetic: FloatArithmetic, saved: SavedCar): BuiltCar | null => {
  if (saved.design === null) return null
  const { weight, centreOffsetX, centreOffsetY } = getCarWeight(arithmetic, saved.design)
  return Object.freeze({
    chassisName: saved.record.chassisName,
    weight,
    centreOffsetX,
    centreOffsetY,
  })
}

// Race_LoadAiRoutes 0x00433190: each computer racer draws its route variant from the random table.
const loadRoutes = (
  files: RouteFiles,
  kinds: readonly number[],
  isDemonstration: boolean,
  startPosition: RandomTablePosition,
  drawFrom: RouteDrawer
): RouteDraws =>
  kinds.reduce<RouteDraws>(
    (progress, kind, racerIndex) => {
      if (kind !== COMPUTER_CONTROLLER && !isDemonstration) {
        return { ...progress, routes: [...progress.routes, null] }
      }
      const getPath = (name: string): string =>
        `${files.folder}${JAM_SEPARATOR}${name.toUpperCase()}`
      const counts = countComputerRacerRouteVariants(racerIndex, true, (name) =>
        files.getIsPresent(getPath(name))
      )
      let position = progress.position
      const choice = chooseComputerRacerRoute(counts, () => {
        const draw = drawFrom(position)
        position = draw.position
        return draw.value
      })
      if (choice === null) return { routes: [...progress.routes, null], position }
      const name = getComputerRacerRouteFileName(racerIndex, choice.letter, choice.variant, true)
      const route = parseComputerRacerRoute(files.readFile(getPath(name)), files.isMirrored)
      return { routes: [...progress.routes, route], position }
    },
    { routes: [], position: startPosition }
  )

// Race_LoadRaceDescription 0x00431e00 and Race_LoadTrackContent 0x00433480 for a race in the player's own game
// files: LEGO.JAM and LEGORacers.exe. The first race is Royal Knights Raceway, GAMEDATA\RACEC0R0. Racer 0 is
// the player, drives a car built from bricks; the others are the computer racers of the race's circuit, each a
// driver of the driver database with its champion's car on its chassis (RacerSet_Setup 0x0043b190, 0x0043b480).
export const loadRaceDefinition = (
  jam: Uint8Array,
  executable: Uint8Array,
  options: LoadRaceOptions = {}
): RaceDefinition => {
  const folder = options.raceFolder ?? DEFAULT_RACE_FOLDER
  const localPlayerCount = options.localPlayerCount ?? 1
  const isMirrored = options.isMirrored ?? false
  const raceModeFlags = options.raceModeFlags ?? 0
  const archive = openJamArchive(jam)
  const racerCodes = options.racerCodes ?? getCircuitRacerCodes(archive.readFile, folder)
  // 0x0042d730: the settings hold the smaller of the six slots and the circuit's racer count.
  const racerCount = Math.min(options.racerCount ?? DEFAULT_RACER_COUNT, racerCodes.length)
  const readFile = (name: string): Uint8Array =>
    archive.readFile(
      folder.length > 0 ? `GAMEDATA${JAM_SEPARATOR}${folder}${JAM_SEPARATOR}${name}` : name
    )
  const paths = new Set(archive.getFilePaths())
  const getIsPresent = (path: string): boolean => paths.has(`GAMEDATA${JAM_SEPARATOR}${path}`)
  const description = parseRaceDescription(readFile(`${folder}.RAB`), isMirrored)
  const tables = readRacerTables(executable)
  const arithmetic = createFloatArithmetic(options.fpuPrecision ?? RACE_FPU_PRECISION)
  const kinds = Array.from({ length: racerCount }, (_, index) =>
    index < Math.max(1, localPlayerCount) ? PLAYER_CONTROLLER : COMPUTER_CONTROLLER
  )
  const routeDraws = loadRoutes(
    {
      folder,
      isMirrored,
      readFile: (path) => archive.readFile(`GAMEDATA${JAM_SEPARATOR}${path}`),
      getIsPresent,
    },
    kinds,
    localPlayerCount === 0,
    createRandomTablePosition(options.randomPosition ?? 0),
    (position) => drawRandomValue(tables.randomTable, position)
  )
  const readNamed = (name: string | null): Uint8Array | null =>
    name === null ? null : readFile(getJamFileName(name))
  const checkpointBytes = readNamed(description.checkpoints)
  const startPositionBytes = readNamed(description.startPositions)
  const powerUpBytes = readNamed(description.powerUpPlacements)
  const eventBytes = readNamed(description.events)
  const timerBytes = readNamed(description.timers)
  const mainTriggerBytes = readNamed(description.mainTriggers)
  const environmentTriggerBytes = readNamed(description.environmentTriggers)
  const hazardBytes = readNamed(description.hazards)
  const collisionWorld = loadCollisionWorld(
    arithmetic,
    readNamed(description.collisionWorld),
    readFile,
    isMirrored
  )
  const getCollisionObjectIndex = (name: string | null): readonly number[] => {
    const index = name === null ? -1 : collisionWorld.names.indexOf(name)
    return index === -1 ? [] : [index]
  }
  const trackMaterialBytes = readNamed(description.trackMaterials)
  const startPositions =
    startPositionBytes === null
      ? []
      : parseStartPositions(startPositionBytes, isMirrored).startPositions
  const defaultCars = loadSavedCars(archive.readFile, DEFAULT_SAVE_PATH)
  const chosenCars = options.playerCars ?? []
  // A session that chose no car drives the save's racers (the front end loaded at least `default.lrs`).
  const playerCars =
    chosenCars.length > 0
      ? chosenCars
      : defaultCars.flatMap((saved) => {
          const car = getBuiltCar(arithmetic, saved)
          return car === null ? [] : [car]
        })
  const request = {
    arithmetic,
    databases: readRacerDatabases(archive.readFile),
    racerCount,
    localPlayerCount,
    playerCars,
    racerCodes,
    isPlayerChampionCar: options.isPlayerChampionCar ?? false,
  }
  const descriptions = describeRacers(request)
  const appearances = describeAppearances(request)
  const figures = appearances.map((appearance) =>
    createRacerFigures(
      loadRacerFigureSources(archive.readFile, appearance, BUILT_DRIVER_MODEL_SCALE)
    )
  )
  const isMultiplayer = localPlayerCount >= 2
  const racers: readonly RaceRacerDefinition[] = kinds.map((controllerKind, index) => {
    const route = routeDraws.routes[index] ?? null
    const description = descriptions[index]
    const appearance = appearances[index]
    const racerFigures = figures[index]
    if (description === undefined || appearance === undefined || racerFigures === undefined) {
      throw new RangeError(`No description for racer ${String(index)}`)
    }
    return {
      controllerKind,
      carBody: createCarBodySetup(arithmetic, description.car, {
        displayFrame: getStartFrame(
          arithmetic,
          startPositions,
          getStartSlot(index, isMultiplayer),
          route
        ),
        displayBoundingRadius: getFigureBounds(arithmetic, racerFigures.wheels)?.radius ?? 0,
        isRaceModeFlagged: getIsCarBodyFlagged(raceModeFlags),
      }),
      route,
      personalityBytes: description.personalityBytes,
      preferredPowerUpKind: description.preferredPowerUpKind,
      preferredPowerUpLevel: description.preferredPowerUpLevel,
      voiceBase: description.voiceBase,
      appearance,
      figures: racerFigures,
      // A local player's car is the save's racer of its slot (the first when the save has fewer).
      savedCar: index < localPlayerCount ? (defaultCars[index] ?? defaultCars[0] ?? null) : null,
    }
  })
  return Object.freeze({
    arithmetic,
    tables,
    raceModeFlags,
    localPlayerCount,
    multiplayerLapCount: options.multiplayerLapCount ?? DEFAULT_LAP_COUNT,
    isCountdownSkipped: false,
    isMirrored,
    isPointsRecordPresent: options.isPointsRecordPresent ?? false,
    ghost: options.ghost ?? null,
    introductionCameraLimit: options.introductionCameraLimit ?? null,
    musicTuneCount:
      options.musicTuneCount ??
      (description.musicList === null
        ? 0
        : decodeSoundBank(readFile(description.musicList.toUpperCase())).declaredSoundCount),
    racers,
    checkpoints:
      checkpointBytes === null ? [] : parseCheckpoints(checkpointBytes, isMirrored).checkpoints,
    // The collision world's instances in world order (race +0x3a0). 0x004371c0 hands every car the track (race +0x3b0)
    // and the checkpoint object (+0x3b8, when the race names one); the other instances join a car's list while it is
    // in the trigger that names them (0x0045e520).
    collisionObjects: collisionWorld.objects,
    collisionObjectNames: collisionWorld.names,
    carCollisionObjectIndices: [
      ...getCollisionObjectIndex(description.firstCollisionObject),
      ...getCollisionObjectIndex(description.checkpointObject),
    ],
    pointsRecord: options.pointsRecord ?? null,
    isSettingsFlag40Set: options.isSettingsFlag40Set ?? false,
    trackMaterials:
      trackMaterialBytes === null
        ? []
        : parseTrackMaterials(trackMaterialBytes, isMirrored).trackMaterials,
    startPositions,
    powerUps:
      powerUpBytes === null
        ? { bricks: [], enhancementBricks: [], readByteCount: 0 }
        : parsePowerUps(powerUpBytes, isMirrored),
    events: eventBytes === null ? null : parseEvents(eventBytes, isMirrored),
    timers: timerBytes === null ? null : parseTimers(timerBytes),
    mainTriggers:
      mainTriggerBytes === null
        ? null
        : parseTriggers(mainTriggerBytes, TriggerFileKind.MAIN, isMirrored),
    environmentTriggers:
      environmentTriggerBytes === null
        ? null
        : parseTriggers(environmentTriggerBytes, TriggerFileKind.ENVIRONMENT, isMirrored),
    hazards: hazardBytes === null ? null : parseHazards(hazardBytes, isMirrored),
    randomPosition: routeDraws.position,
    getGroundPoint: null,
    trackTargets: [],
    projectileModelData: EMPTY_PROJECTILE_MODEL_DATA,
  })
}
