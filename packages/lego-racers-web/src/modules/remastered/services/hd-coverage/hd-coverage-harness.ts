import { loadSavedCars, QUICK_BUILD_SAVE_PATH } from '@lego-games/lego-racers/car-builder'
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
import { getEffectViews, getRacerPoses } from '@lego-games/lego-racers/race-presentation'
import { loadRandomTable } from '@lego-games/lego-racers/random-table'
import {
  getChampionRacerAppearance,
  getRacerModelFiles,
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
} from '../../../track-viewer/index.ts'
import { getLDrawModelIndex, loadLDrawModelText } from '../ldraw-models/ldraw-model-client.ts'
import { CHAMPION_CAR_CODES } from '../ldraw-racer-model/known-racer-models.ts'
import { createRemasteredExtension } from '../remastered-registration/remastered-registration.ts'
import type {
  CensusSighting,
  FrontEndPlace,
  HdCoveragePlace,
  HdCoveragePlaceResult,
  ModelPartFinding,
  RacePlace,
} from './hd-coverage.types.ts'
import { takeCensus } from './hd-coverage-census.ts'
import { createRecordingExtension } from './hd-coverage-recorder.ts'
import { checkModelParts } from './model-part-check.ts'
import type { CoverageRecorder } from './hd-coverage-recorder.types.ts'

const EXECUTABLE_NAME = 'LEGORacers.exe'
const FRAME_MILLISECONDS = 33
const STAGE_SIZE = Object.freeze({ width: 640, height: 480 })
const SETTLE_POLL_MILLISECONDS = 250
const SETTLE_TIMEOUT_MILLISECONDS = 240_000
const EVERY_CIRCUIT_OPEN = 0x7f
const MODEL_VIEW_SIZE = 64

const getExecutable = async (): Promise<Uint8Array> => {
  const response = await fetch(`${DEVELOPMENT_GAME_FILE_ROUTE}/${EXECUTABLE_NAME}`)
  return new Uint8Array(await response.arrayBuffer())
}

// The garage cars of the quick-build save that have a design: the player's cars of every place.
const getPlayerCars = (archive: JamArchive): readonly SavedCar[] =>
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

const getEnvironment = (
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

const getRaceSettings = (
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

export const installHdCoverageHarness = async (search: string) => {
  const { extension, recorder } = createRecordingExtension(await createRemasteredExtension(search))
  registerViewerExtension(extension)
  const census = createRenderCensus(recorder)
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
    const frames = Array.from({ length: place.frameCount }, () => ({
      milliseconds: FRAME_MILLISECONDS,
      controls: IDLE_RACER_CONTROLS,
    }))
    runRaceFrames(assets, STAGE_SIZE, frames, ({ frame, raceState, presentation, ghostCars }) => {
      viewport.update(
        getRacerPoses(raceState),
        presentation.cameraView,
        getEffectViews(raceState),
        presentation.warpView,
        ghostCars,
        presentation.screenFades,
        presentation.fieldOfViewDegrees
      )
      if (!place.recordFrames.includes(frame)) return
      census.setIsTaking(true)
      viewport.render()
      census.setIsTaking(false)
    })
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

  const runHdCoveragePlace = async (place: HdCoveragePlace): Promise<HdCoveragePlaceResult> => {
    recorder.reset()
    census.reset()
    let partFindings: readonly ModelPartFinding[] = []
    if (place.kind === 'front_end') await runFrontEnd(place)
    else if (place.kind === 'race') await runRace(place)
    else partFindings = await runModelParts()
    const index = getLDrawModelIndex()
    return {
      name: place.name,
      calls: recorder.getCalls(),
      sightings: census.getSightings(),
      otherSources: census.getOtherSources(),
      renderCount: census.getRenderCount(),
      modelIndex: { cars: Object.keys(index.cars), chassis: Object.keys(index.chassis) },
      unsettledCallIds: recorder.getUnsettledCallIds(),
      partFindings,
    }
  }
  Object.assign(window, { runHdCoveragePlace })
}
