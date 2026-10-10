import { EMPTY_PROJECTILE_MODEL_DATA } from '../../types/projectile-model-data/projectile-model-data.ts'
import { parseCheckpoints } from '../../../checkpoint/index.ts'
import { loadCollisionObject } from '../../../collision/index.ts'
import {
  chooseComputerRacerRoute,
  countComputerRacerRouteVariants,
  getComputerRacerRouteFileName,
  parseComputerRacerRoute,
} from '../../../computer-racer-route/index.ts'
import { parseEvents } from '../../../event/index.ts'
import { parseHazards } from '../../../hazard/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { parsePowerUps } from '../../../power-up/index.ts'
import { createRandomTablePosition, drawRandomValue } from '../../../random-table/index.ts'
import type { RandomTablePosition } from '../../../random-table/index.ts'
import { readRacerTables } from '../../../racer/index.ts'
import { parseRaceDescription } from '../../../race-description/index.ts'
import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import { parseStartPositions } from '../../../start-position/index.ts'
import { parseTimers } from '../../../timer/index.ts'
import { parseTriggers, TriggerFileKind } from '../../../trigger/index.ts'
import {
  COMPUTER_CONTROLLER,
  PLAYER_CONTROLLER,
} from '../../types/racer-transitions/racer-transitions.ts'
import type { RaceDefinition, RaceRacerDefinition } from '../../types/race.types.ts'
import { getPlaceholderCarBodyDefinition } from '../../types/placeholder-car/placeholder-car.ts'
import { getStartFrame } from '../../types/start-frame/start-frame.ts'
import type { LoadRaceOptions, RouteDraws, RouteDrawer, RouteFiles } from './load-race.types.ts'

const JAM_SEPARATOR = '\\'
const DEFAULT_RACE_FOLDER = 'RACEC0R0'
const DEFAULT_RACER_COUNT = 6
const DRIVER_BYTE_COUNT = 6
// 0x0043b480: a custom driver's six personality bytes are all 100.
const CUSTOM_DRIVER_BYTE = 100
const DEFAULT_LAP_COUNT = 3
const NO_ABILITIES = Object.freeze({
  isAlwaysGrapple: false,
  isAlwaysLevelThree: false,
  isPermanentTurbo: false,
})

// The RAB names the text files (.cpf, .sps); the loaders read the binary twin, whose extension ends in b.
const getJamFileName = (name: string): string => `${name.slice(0, -1)}b`.toUpperCase()

// Race_LoadAiRoutes 0x00433190: each computer racer draws its route variant from the random table.
const loadRoutes = (
  files: RouteFiles,
  kinds: readonly number[],
  startPosition: RandomTablePosition,
  drawFrom: RouteDrawer
): RouteDraws =>
  kinds.reduce<RouteDraws>(
    (progress, kind, racerIndex) => {
      if (kind !== COMPUTER_CONTROLLER) return { ...progress, routes: [...progress.routes, null] }
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
      const route = parseComputerRacerRoute(files.readFile(getPath(name)), false)
      return { routes: [...progress.routes, route], position }
    },
    { routes: [], position: startPosition }
  )

// Race_LoadRaceDescription 0x00431e00 and Race_LoadTrackContent 0x00433480 for a race in the player's own game
// files: LEGO.JAM and LEGORacers.exe. The first race is Royal Knights Raceway, GAMEDATA\RACEC0R0. Racer 0 is
// the player, the others are computer racers with a custom driver's personality; the chassis data is not ported,
// so every car is the placeholder of getPlaceholderCarBodyDefinition.
export const loadRaceDefinition = (
  jam: Uint8Array,
  executable: Uint8Array,
  options: LoadRaceOptions = {}
): RaceDefinition => {
  const folder = options.raceFolder ?? DEFAULT_RACE_FOLDER
  const racerCount = options.racerCount ?? DEFAULT_RACER_COUNT
  const archive = openJamArchive(jam)
  const readFile = (name: string): Uint8Array =>
    archive.readFile(
      folder.length > 0 ? `GAMEDATA${JAM_SEPARATOR}${folder}${JAM_SEPARATOR}${name}` : name
    )
  const paths = new Set(archive.getFilePaths())
  const getIsPresent = (path: string): boolean => paths.has(`GAMEDATA${JAM_SEPARATOR}${path}`)
  const description = parseRaceDescription(readFile(`${folder}.RAB`), false)
  const tables = readRacerTables(executable)
  const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
  const kinds = Array.from({ length: racerCount }, (_, index) =>
    index === 0 ? PLAYER_CONTROLLER : COMPUTER_CONTROLLER
  )
  const routeDraws = loadRoutes(
    {
      folder,
      readFile: (path) => archive.readFile(`GAMEDATA${JAM_SEPARATOR}${path}`),
      getIsPresent,
    },
    kinds,
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
  const collisionBytes =
    description.firstCollisionObject === null
      ? null
      : readFile(`${description.firstCollisionObject.toUpperCase()}.BVB`)
  const startPositions =
    startPositionBytes === null ? [] : parseStartPositions(startPositionBytes, false).startPositions
  const racers: readonly RaceRacerDefinition[] = kinds.map((controllerKind, index) => {
    const route = routeDraws.routes[index] ?? null
    return {
      controllerKind,
      carBody: getPlaceholderCarBodyDefinition(
        arithmetic,
        getStartFrame(arithmetic, startPositions, index, route)
      ),
      route,
      personalityBytes: Array.from({ length: DRIVER_BYTE_COUNT }, () => CUSTOM_DRIVER_BYTE),
      abilities: NO_ABILITIES,
    }
  })
  return Object.freeze({
    arithmetic,
    tables,
    raceModeFlags: options.raceModeFlags ?? 0,
    localPlayerCount: options.localPlayerCount ?? 1,
    multiplayerLapCount: DEFAULT_LAP_COUNT,
    isCountdownSkipped: false,
    isMirrored: false,
    racers,
    checkpoints:
      checkpointBytes === null ? [] : parseCheckpoints(checkpointBytes, false).checkpoints,
    collisionObjects:
      collisionBytes === null
        ? []
        : [loadCollisionObject({ bytes: collisionBytes, isMirrored: false, frame: undefined })],
    startPositions,
    powerUps:
      powerUpBytes === null
        ? { bricks: [], enhancementBricks: [], readByteCount: 0 }
        : parsePowerUps(powerUpBytes, false),
    events: eventBytes === null ? null : parseEvents(eventBytes, false),
    timers: timerBytes === null ? null : parseTimers(timerBytes),
    mainTriggers:
      mainTriggerBytes === null
        ? null
        : parseTriggers(mainTriggerBytes, TriggerFileKind.MAIN, false),
    environmentTriggers:
      environmentTriggerBytes === null
        ? null
        : parseTriggers(environmentTriggerBytes, TriggerFileKind.ENVIRONMENT, false),
    hazards: hazardBytes === null ? null : parseHazards(hazardBytes, false),
    randomPosition: routeDraws.position,
    getGroundPoint: null,
    trackTargets: [],
    projectileModelData: EMPTY_PROJECTILE_MODEL_DATA,
  })
}
