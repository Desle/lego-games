import {
  BRICK_DATABASE_PATH,
  findBrickPieceByName,
  getCarOrigin,
  getDriverPartBytes,
  loadSavedCars,
  parseBrickDatabase,
  QUICK_BUILD_SAVE_PATH,
} from '@lego-games/lego-racers/car-builder'
import type { SavedCar } from '@lego-games/lego-racers/car-builder'
import {
  createFrontEnd,
  getFrontEndFrame,
  loadFrontEndResources,
  NO_FRONT_END_MEMORY,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type { FrontEndEnvironment, FrontEndState } from '@lego-games/lego-racers/front-end'
import {
  createCircuitSettings,
  createGameSession,
  createSingleRaceSettings,
  createTimeTrialSettings,
  loadGameResources,
  startNextRace,
} from '@lego-games/lego-racers/game-session'
import type { GameResources, SessionSettings } from '@lego-games/lego-racers/game-session'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { IDLE_RACER_CONTROLS, readRacerDatabases } from '@lego-games/lego-racers/race'
import type { RaceDefinition } from '@lego-games/lego-racers/race'
import type { RacerControls } from '@lego-games/lego-racers/racer'
import { loadRandomTable } from '@lego-games/lego-racers/random-table'
import {
  getBuiltRacerAppearance,
  getChampionRacerAppearance,
  getRacerModelFiles,
  loadBuiltDriverScene,
} from '@lego-games/lego-racers/racer-appearance'
import type { RacerAppearance } from '@lego-games/lego-racers/racer-appearance'
import type { RacerDatabases } from '@lego-games/lego-racers/racer-setup'
import { loadModelScene } from '@lego-games/lego-racers/scene'
import { Matrix4, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { DEVELOPMENT_GAME_FILE_ROUTE } from '../../../../shared/development-jam/development-jam-route.ts'
import { registerViewerExtension } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import {
  createFrontEndRenderer,
  createRaceViewport,
  getDevelopmentJam,
  loadRaceAssets,
  runRaceFrames,
  showPortRaceFrame,
} from '../../../track-viewer/index.ts'
import { getLDrawModelIndex, loadLDrawModelText } from '../ldraw-models/ldraw-model-client.ts'
import { CHAMPION_CAR_CODES } from '../ldraw-racer-model/known-racer-models.ts'
import { LDRAW_PICKUP_MAPPINGS } from '../ldraw-pickup/ldraw-pickup-mappings.ts'
import { POWER_UP_OBJECT_MODEL_NAMES } from '../../../../shared/viewer-extensions/effect-model-names.ts'
import { createLDrawCarDocument, getChassisFileName } from '../ldraw-car/ldraw-car-document.ts'
import { getSingleBrickDesign } from '../ldraw-fidelity/fidelity-pairs.ts'
import { getReferencedChassisNames } from '../ldraw-racer-model/ldraw-racer-car.ts'
import { createRemasteredExtension } from '../remastered-registration/remastered-registration.ts'
import type {
  CensusSighting,
  DriverSeatMeasurement,
  DriverSeatSubject,
  FrontEndPlace,
  HdCoveragePlace,
  HdCoveragePlaceResult,
  ModelPartFinding,
  OnScreenPlace,
  PowerUpUse,
  RacePlace,
} from './hd-coverage.types.ts'
import { takeCensus } from './hd-coverage-census.ts'
import { createRecordingExtension } from './hd-coverage-recorder.ts'
import { checkModelParts } from './model-part-check.ts'
import { measureDriverSeat } from './driver-seat-check.ts'
import type { CoverageRecorder } from './hd-coverage-recorder.types.ts'
import { createOnScreenCheck } from './on-screen-check.ts'
import type { FrameDrawer, OnScreenFrame } from './on-screen-check.types.ts'

const EXECUTABLE_NAME = 'LEGORacers.exe'
export const FRAME_MILLISECONDS = 33
const STAGE_SIZE = Object.freeze({ width: 640, height: 480 })
const SETTLE_POLL_MILLISECONDS = 250
const SETTLE_TIMEOUT_MILLISECONDS = 240_000
const EVERY_CIRCUIT_OPEN = 0x7f
const MODEL_VIEW_SIZE = 64
const SLIDING_CONTROLS: RacerControls = Object.freeze({
  ...IDLE_RACER_CONTROLS,
  isAcceleratePressed: true,
  isSteerPositivePressed: true,
  isPowerSlidePressed: true,
})
// The player holds the use key for three frames, starting three frames after the power-up was handed over.
const USE_DELAY_FRAMES = 3
const USE_FRAME_COUNT = 3
export const PLAYER_RACER_INDEX = 0

const getIsUsePressed = (uses: readonly PowerUpUse[], frame: number): boolean =>
  uses.some(
    (use) =>
      frame >= use.frame + USE_DELAY_FRAMES &&
      frame < use.frame + USE_DELAY_FRAMES + USE_FRAME_COUNT
  )

// A race place's frames: the scripted frame time, and the player's controls (sliding, and the use key for its power-ups).
export const getPlaceFrames = (place: RacePlace) =>
  Array.from({ length: place.frameCount }, (_, frame) => ({
    milliseconds: FRAME_MILLISECONDS,
    controls: {
      ...(place.isPlayerSliding ? SLIDING_CONTROLS : IDLE_RACER_CONTROLS),
      isUsePowerUpPressed: getIsUsePressed(place.powerUpUses, frame),
    },
  }))

export const getExecutable = async (): Promise<Uint8Array> => {
  const response = await fetch(`${DEVELOPMENT_GAME_FILE_ROUTE}/${EXECUTABLE_NAME}`)
  return new Uint8Array(await response.arrayBuffer())
}

// The garage cars of the quick-build save that have a design: the player's cars of every place.
export const getPlayerCars = (archive: JamArchive): readonly SavedCar[] =>
  loadSavedCars((path) => archive.readFile(path), QUICK_BUILD_SAVE_PATH).filter(
    (car) => car.design !== null
  )

const waitForSettledDrawings = async (recorder: CoverageRecorder): Promise<void> => {
  const start = performance.now()
  while (
    recorder.getUnsettledCallIds().length > 0 &&
    performance.now() - start < SETTLE_TIMEOUT_MILLISECONDS
  ) {
    await new Promise((resolve) => window.setTimeout(resolve, SETTLE_POLL_MILLISECONDS))
  }
}

// Every render of every WebGL renderer of the page tells the scene it renders (`Scene.onBeforeRender`), so a place that draws a racer
// through a path nobody thought of is seen as well: while a census is on, each rendered scene is counted before it is drawn.
const createRenderCensus = (recorder: CoverageRecorder) => {
  let sightings: CensusSighting[] = []
  let otherSources = new Set<string>()
  let renderCount = 0
  let isTaking = false
  Scene.prototype.onBeforeRender = (_renderer, scene) => {
    if (!isTaking) return
    renderCount += 1
    const census = takeCensus(scene, recorder.getCalls(), recorder.getCallId, CHAMPION_CAR_CODES)
    sightings = [...sightings, ...census.sightings]
    otherSources = new Set([...otherSources, ...census.otherSources])
  }
  return {
    reset: () => {
      sightings = []
      otherSources = new Set()
      renderCount = 0
    },
    setIsTaking: (isOn: boolean) => {
      isTaking = isOn
    },
    getSightings: (): readonly CensusSighting[] => sightings,
    getOtherSources: (): readonly string[] => [...otherSources].sort(),
    getRenderCount: () => renderCount,
  }
}

export const getEnvironment = (
  executable: Uint8Array,
  cars: readonly SavedCar[]
): FrontEndEnvironment => ({
  controllerCount: 0,
  unlockedCircuitMask: EVERY_CIRCUIT_OPEN,
  randomTable: loadRandomTable(executable),
  isEveryPartUnlocked: true,
  playerRacerNames: cars.map((car) => car.record.name),
  standingRows: [],
})

export const getRaceSettings = (
  resources: GameResources,
  place: RacePlace,
  cars: readonly SavedCar[]
): SessionSettings => {
  const entry = resources.catalog.entries.find(
    (candidate) => candidate.firstName.toUpperCase() === place.raceFolder && !candidate.isFlagged
  )
  if (entry === undefined) throw new RangeError(`No race in the folder ${place.raceFolder}`)
  const playerCars = cars.slice(0, place.localPlayerCount)
  const common = {
    racerCount: place.racerCount,
    localPlayerCount: place.localPlayerCount,
    playerSavedCars: playerCars,
    playerNames: playerCars.map((car) => car.record.name),
  }
  if (place.mode === 'circuit')
    return createCircuitSettings(resources, { ...common, circuitName: entry.circuitName })
  if (place.mode === 'time_trial')
    return createTimeTrialSettings(resources, { ...common, raceName: entry.name })
  return createSingleRaceSettings(resources, { ...common, raceName: entry.name })
}

// A time trial after a finished run: the best run plays beside the champion's (here the champion's own run stands in for it).
const getDefinitionWithBestRun = (definition: RaceDefinition): RaceDefinition =>
  definition.ghost === null
    ? definition
    : {
        ...definition,
        ghost: {
          ...definition.ghost,
          bestRun: definition.ghost.championRun,
          isBestRunShown: true,
          isRunFinished: true,
        },
      }

const getRestPose = () => ({ matrix: new Matrix4(), isVisible: true, animationState: null })

// The appearance of the champion who drives the car of a body code.
const getChampionAppearance = (databases: RacerDatabases, code: string): RacerAppearance | null =>
  databases.drivers.drivers
    .map((driver) => getChampionRacerAppearance(databases, driver.name, 0))
    .find((appearance) => appearance.bodyModel?.modelName.toUpperCase() === code) ?? null

// The champion's own driver among those the driver database gives a champion (`bk` has five): the one of his name, else the first.
const getChampionDriverName = (databases: RacerDatabases, championName: string): string => {
  const drivers = databases.drivers.drivers.filter(
    (driver) => driver.championName.toLowerCase() === championName.toLowerCase()
  )
  return (
    drivers.find((driver) => driver.name.toLowerCase() === championName.toLowerCase())?.name ??
    drivers[0]?.name ??
    ''
  )
}

// A car file with the text of the chassis recipes it refers to, as the layer reads it.
const loadCarFileText = async (file: string): Promise<string | null> => {
  const text = await loadLDrawModelText(file)
  if (text === null) return null
  const recipes = await Promise.all(
    getReferencedChassisNames(text).map(async (name) => {
      const recipeFile = getLDrawModelIndex().chassis[name]
      const recipe = recipeFile === undefined ? null : await loadLDrawModelText(recipeFile)
      return recipe === null ? '' : `0 FILE ${getChassisFileName(name)}\n${recipe}`
    })
  )
  return [text, ...recipes].join('\n')
}

export const installHdCoverageHarness = async (search: string) => {
  const { extension, recorder } = createRecordingExtension(await createRemasteredExtension(search))
  registerViewerExtension(extension)
  const census = createRenderCensus(recorder)
  const onScreenCheck = createOnScreenCheck(recorder.getCalls, recorder.getCallId)
  let onScreenFrames: OnScreenFrame[] = []
  let isOnScreenMeasured = false
  const measureOnScreen = (label: string, drawFrame: FrameDrawer) => {
    if (isOnScreenMeasured)
      onScreenFrames = [...onScreenFrames, onScreenCheck.measure(label, drawFrame)]
  }
  const jam = await getDevelopmentJam()
  const executable = await getExecutable()
  const archive = openJamArchive(jam)
  const cars = getPlayerCars(archive)

  const runFrontEnd = async (place: FrontEndPlace) => {
    const resources = loadFrontEndResources(archive)
    const environment = getEnvironment(executable, cars)
    const canvas = document.createElement('canvas')
    canvas.width = STAGE_SIZE.width
    canvas.height = STAGE_SIZE.height
    document.body.appendChild(canvas)
    const renderer = createFrontEndRenderer(canvas, resources, archive)
    const memory = { ...NO_FRONT_END_MEMORY, playerCar: cars[0] ?? null }
    let state: FrontEndState = createFrontEnd(
      resources,
      environment,
      place.firstScreenId ?? undefined,
      memory
    )
    const lastStep = Math.max(...place.recordSteps)
    for (let step = 0; step <= lastStep; step++) {
      if (step > 0) {
        const input = place.inputs[step - 1] ?? null
        state = stepFrontEnd(state, resources, environment, input, FRAME_MILLISECONDS).state
      }
      const { commands } = getFrontEndFrame(state, resources, environment)
      renderer.draw(commands, FRAME_MILLISECONDS)
      if (!place.recordSteps.includes(step)) continue
      await waitForSettledDrawings(recorder)
      census.setIsTaking(true)
      renderer.draw(commands, 0)
      census.setIsTaking(false)
      measureOnScreen(`step ${String(step)}`, () => {
        renderer.draw(commands, 0)
        return canvas
      })
    }
    renderer.dispose()
    canvas.remove()
  }

  const runRace = async (place: RacePlace) => {
    const resources = loadGameResources(jam, executable)
    const started = startNextRace(
      createGameSession(resources, getRaceSettings(resources, place, cars))
    )
    if (started.kind !== 'race') throw new Error(`${place.name} started no race`)
    const definition = place.isBestRunShown
      ? getDefinitionWithBestRun(started.definition)
      : started.definition
    const assets = loadRaceAssets(
      jam,
      { executable, tunes: new Map() },
      { raceFolder: started.race.folder },
      definition
    )
    const container = document.createElement('div')
    document.body.appendChild(container)
    const viewport = createRaceViewport(container, assets, STAGE_SIZE)
    await waitForSettledDrawings(recorder)
    const frames = getPlaceFrames(place)
    const grants = place.powerUpUses.map((use) => ({ ...use, racer: PLAYER_RACER_INDEX }))
    runRaceFrames(
      assets,
      STAGE_SIZE,
      frames,
      (portFrame) => {
        const { frame } = portFrame
        showPortRaceFrame(viewport, portFrame)
        if (!place.recordFrames.includes(frame)) return
        census.setIsTaking(true)
        viewport.render()
        census.setIsTaking(false)
        measureOnScreen(`frame ${String(frame)}`, () => {
          viewport.render()
          const canvas = container.querySelector('canvas')
          if (canvas === null) throw new Error('The race viewport has no canvas')
          return canvas
        })
      },
      grants
    )
    viewport.dispose()
    container.remove()
  }

  // Every car of the models folder, drawn alone by the layer at rest and checked part line by part line against its file.
  const runModelParts = async (): Promise<readonly ModelPartFinding[]> => {
    const databases = readRacerDatabases((path) => archive.readFile(path))
    const renderer = new WebGLRenderer()
    renderer.setSize(MODEL_VIEW_SIZE, MODEL_VIEW_SIZE)
    const camera = new PerspectiveCamera()
    const findings: ModelPartFinding[] = []
    for (const [code, file] of Object.entries(getLDrawModelIndex().cars).sort()) {
      const appearance = getChampionAppearance(databases, code)
      const text = await loadLDrawModelText(file)
      if (appearance === null || text === null) continue
      const drawing = extension.getCarDrawing({
        archive,
        carCode: code,
        design: null,
        wheels: {
          model: loadModelScene(archive, getRacerModelFiles(appearance.wheelModel)),
          modelName: appearance.wheelModel.modelName,
          partBytes: null,
        },
      })
      if (drawing === null) continue
      const scene = new Scene()
      scene.add(drawing.object)
      drawing.applyPose({ body: getRestPose(), wheels: getRestPose(), opacity: 1 })
      await waitForSettledDrawings(recorder)
      census.setIsTaking(true)
      renderer.render(scene, camera)
      census.setIsTaking(false)
      findings.push(...(await checkModelParts(file, text, drawing.object)))
      drawing.dispose()
    }
    renderer.dispose()
    return findings
  }

  // Every champion's driver, and a garage car on every chassis with a recipe (the quick-build save's driver): the original's driver on
  // the seat of the racer's appearance against the layer's, and the LDraw car's steering wheel.
  const runDriverSeats = async (): Promise<readonly DriverSeatMeasurement[]> => {
    const databases = readRacerDatabases((path) => archive.readFile(path))
    const index = getLDrawModelIndex()
    const championSubjects = databases.champions.champions.map(
      async (champion): Promise<DriverSeatSubject | null> => {
        const appearance = getChampionRacerAppearance(
          databases,
          getChampionDriverName(databases, champion.name),
          0
        )
        if (appearance.driverModel === null) return null
        const code = champion.modelName.toUpperCase()
        const file = index.cars[code]
        return {
          racer: code,
          seatPoint: appearance.seatPoint,
          driverModel: loadModelScene(archive, getRacerModelFiles(appearance.driverModel)),
          driverModelName: appearance.driverModel.modelName,
          driverPartBytes: null,
          ldrawCarText: file === undefined ? null : await loadCarFileText(file),
        }
      }
    )
    const database = parseBrickDatabase(archive.readFile(BRICK_DATABASE_PATH))
    const playerCar = cars[0]
    const partBytes = playerCar === undefined ? null : getDriverPartBytes(playerCar.record)
    const designSubjects = Object.entries(index.chassis).map(
      async ([name, file]): Promise<DriverSeatSubject | null> => {
        const piece = findBrickPieceByName(database, name)
        const recipe = await loadLDrawModelText(file)
        if (piece === null || recipe === null || partBytes === null) return null
        const design = getSingleBrickDesign(piece)
        const document = createLDrawCarDocument(
          design,
          getCarOrigin(database, design),
          new Set([name])
        )
        return {
          racer: `design:${name}`,
          seatPoint: getBuiltRacerAppearance(databases, name, 0).seatPoint,
          driverModel: loadBuiltDriverScene(archive, partBytes),
          driverModelName: null,
          driverPartBytes: partBytes,
          ldrawCarText: `${document.text}\n0 FILE ${getChassisFileName(name)}\n${recipe}`,
        }
      }
    )
    const subjects = (await Promise.all([...championSubjects, ...designSubjects])).filter(
      (subject): subject is DriverSeatSubject => subject !== null
    )
    const renderer = new WebGLRenderer()
    renderer.setSize(MODEL_VIEW_SIZE, MODEL_VIEW_SIZE)
    const camera = new PerspectiveCamera()
    const render = (scene: Scene) => {
      census.setIsTaking(true)
      renderer.render(scene, camera)
      census.setIsTaking(false)
    }
    const measurements: DriverSeatMeasurement[] = []
    for (const subject of subjects) {
      const drawing = extension.getDriverDrawing({
        archive,
        driver: {
          model: subject.driverModel,
          modelName: subject.driverModelName,
          partBytes: subject.driverPartBytes,
        },
      })
      measurements.push(...(await measureDriverSeat(subject, drawing, render)))
    }
    renderer.dispose()
    return measurements
  }

  const runOnScreen = async (place: OnScreenPlace): Promise<readonly OnScreenFrame[]> => {
    onScreenFrames = []
    isOnScreenMeasured = true
    try {
      if (place.subject.kind === 'front_end') await runFrontEnd(place.subject)
      else await runRace(place.subject)
      return onScreenFrames
    } finally {
      isOnScreenMeasured = false
    }
  }

  const runHdCoveragePlace = async (place: HdCoveragePlace): Promise<HdCoveragePlaceResult> => {
    recorder.reset()
    census.reset()
    let partFindings: readonly ModelPartFinding[] = []
    let driverSeats: readonly DriverSeatMeasurement[] = []
    let measuredFrames: readonly OnScreenFrame[] = []
    if (place.kind === 'front_end') await runFrontEnd(place)
    else if (place.kind === 'race') await runRace(place)
    else if (place.kind === 'driver_seats') driverSeats = await runDriverSeats()
    else if (place.kind === 'on_screen') measuredFrames = await runOnScreen(place)
    else partFindings = await runModelParts()
    const index = getLDrawModelIndex()
    return {
      name: place.name,
      calls: recorder.getCalls(),
      sightings: census.getSightings(),
      otherSources: census.getOtherSources(),
      renderCount: census.getRenderCount(),
      modelIndex: {
        cars: Object.keys(index.cars),
        chassis: Object.keys(index.chassis),
        effectModels: [
          ...Object.keys(LDRAW_PICKUP_MAPPINGS),
          ...Object.keys(index.powerUps).filter((name) =>
            POWER_UP_OBJECT_MODEL_NAMES.includes(name)
          ),
        ],
      },
      unsettledCallIds: recorder.getUnsettledCallIds(),
      partFindings,
      driverSeats,
      onScreenFrames: measuredFrames,
    }
  }
  Object.assign(window, { runHdCoveragePlace })
}
