import {
  createFrontEnd,
  getFrontEndFrame,
  loadFrontEndResources,
  NO_FRONT_END_MEMORY,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type { FrontEndState } from '@lego-games/lego-racers/front-end'
import {
  createGameSession,
  loadGameResources,
  startNextRace,
} from '@lego-games/lego-racers/game-session'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { Scene } from 'three'
import type { WebGLRenderer } from 'three'
import { registerViewerExtension } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import {
  createFrontEndRenderer,
  createRaceViewport,
  getDevelopmentJam,
  getRaceDisplay,
  loadRaceAssets,
  runRaceFrames,
  showPortRaceFrame,
} from '../../../track-viewer/index.ts'
import {
  FRAME_MILLISECONDS,
  getEnvironment,
  getExecutable,
  getPlaceFrames,
  getPlayerCars,
  getRaceSettings,
  PLAYER_RACER_INDEX,
} from '../hd-coverage/hd-coverage-harness.ts'
import { createRecordingExtension } from '../hd-coverage/hd-coverage-recorder.ts'
import type { CoverageRecorder } from '../hd-coverage/hd-coverage-recorder.types.ts'
import type { RacePlace } from '../hd-coverage/hd-coverage.types.ts'
import {
  createRemasteredExtension,
  getIsRemasteredRequested,
} from '../remastered-registration/remastered-registration.ts'
import type {
  FrameHandle,
  FrameSample,
  MenuScenarioSubject,
  PerformanceScenarioRun,
  PerformanceTraceGraphics,
  RaceScenarioSubject,
  ScenarioMeasurement,
} from './performance-trace.types.ts'

const MENU_ASPECT_RATIO = 4 / 3
const SETTLE_POLL_MILLISECONDS = 50
const SETTLE_TIMEOUT_MILLISECONDS = 240_000
const BYTES_PER_MEGABYTE = 1024 * 1024
// The race of the HD coverage's places: the time trial track.
const RACE_FOLDER = 'RACEC0R0'

const getGraphics = (): PerformanceTraceGraphics => {
  const graphics: unknown = Reflect.get(window, 'performanceTraceGraphics')
  if (!(graphics instanceof Object))
    throw new Error('The performance trace init script did not run')
  return graphics as PerformanceTraceGraphics
}

const getNextAnimationFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

const getHeapMegabytes = (): number => {
  Reflect.apply(Reflect.get(window, 'gc') ?? (() => undefined), undefined, [])
  const memory: unknown = Reflect.get(performance, 'memory')
  const used: unknown = memory instanceof Object ? Reflect.get(memory, 'usedJSHeapSize') : 0
  return typeof used === 'number' ? used / BYTES_PER_MEGABYTE : 0
}

// Counts what every renderer of the page draws while it is on: the visible objects of each rendered scene, and the renderers.
const createSceneCount = () => {
  let isCounting = false
  let objects = 0
  let renderers = new Set<WebGLRenderer>()
  Scene.prototype.onBeforeRender = (renderer, scene) => {
    if (!isCounting) return
    renderers = new Set(renderers).add(renderer)
    scene.traverseVisible(() => {
      objects += 1
    })
  }
  return {
    setIsCounting: (isOn: boolean) => {
      isCounting = isOn
      if (!isOn) return
      objects = 0
      renderers = new Set()
    },
    getObjects: () => objects,
    getGeometries: () =>
      [...renderers].reduce((total, renderer) => total + renderer.info.memory.geometries, 0),
  }
}

// Waits until every drawing the layer was asked for has a mesh (or failed) and the parse worker has nothing pending.
const waitForModels = async (recorder: CoverageRecorder, graphics: PerformanceTraceGraphics) => {
  const start = performance.now()
  while (
    (recorder.getUnsettledCallIds().length > 0 || graphics.getParseStatistics().pendingCount > 0) &&
    performance.now() - start < SETTLE_TIMEOUT_MILLISECONDS
  ) {
    await new Promise((resolve) => window.setTimeout(resolve, SETTLE_POLL_MILLISECONDS))
  }
}

// The menus' canvas as the race view shows it: 640 × 480 scaled into the biggest 4:3 box of the window.
const createMenuCanvas = (): HTMLCanvasElement => {
  const height = Math.min(window.innerHeight, window.innerWidth / MENU_ASPECT_RATIO)
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 480
  canvas.style.cssText = `position:fixed;left:0;top:0;width:${String(height * MENU_ASPECT_RATIO)}px;height:${String(height)}px;image-rendering:pixelated`
  document.body.appendChild(canvas)
  return canvas
}

// The page of the performance trace (`/?performance-trace`, Classic, or `/?hd&performance-trace`): one scenario per page load,
// from the JAM's download to the measured frames, with the layer registered when the address asks for it.
export const installPerformanceTraceHarness = (search: string) => {
  const sceneCount = createSceneCount()

  const runPerformanceScenario = async (
    run: PerformanceScenarioRun
  ): Promise<ScenarioMeasurement> => {
    const graphics = getGraphics()
    const start = performance.now()
    let recorder: CoverageRecorder | null = null
    if (getIsRemasteredRequested(search)) {
      const recording = createRecordingExtension(await createRemasteredExtension(search))
      registerViewerExtension(recording.extension)
      recorder = recording.recorder
    }
    const jam = await getDevelopmentJam()
    const executable = await getExecutable()
    const archive = openJamArchive(jam)
    const cars = getPlayerCars(archive)
    let firstFrameMilliseconds = 0
    let modelsShownMilliseconds: number | null = null
    let sceneObjects = 0
    let geometries = 0
    let totals = graphics.getTotals()
    let measuredFrames: readonly FrameSample[] = []

    const showFirstFrame = async () => {
      await getNextAnimationFrame()
      firstFrameMilliseconds = performance.now() - start
      if (recorder === null) return
      await waitForModels(recorder, graphics)
      await getNextAnimationFrame()
      modelsShownMilliseconds = performance.now() - start
    }

    const countScene = (draw: () => void) => {
      sceneCount.setIsCounting(true)
      draw()
      sceneCount.setIsCounting(false)
      sceneObjects = sceneCount.getObjects()
      geometries = sceneCount.getGeometries()
      totals = graphics.getTotals()
    }

    const runMenu = async (subject: MenuScenarioSubject) => {
      const resources = loadFrontEndResources(archive)
      const environment = getEnvironment(executable, cars)
      const canvas = createMenuCanvas()
      const renderer = createFrontEndRenderer(canvas, resources, archive)
      let state: FrontEndState = createFrontEnd(
        resources,
        environment,
        subject.firstScreenId ?? undefined,
        { ...NO_FRONT_END_MEMORY, playerCar: cars[0] ?? null }
      )
      const drawState = () =>
        renderer.draw(getFrontEndFrame(state, resources, environment).commands, FRAME_MILLISECONDS)
      const step = () => {
        state = stepFrontEnd(state, resources, environment, null, FRAME_MILLISECONDS).state
        drawState()
      }
      drawState()
      await showFirstFrame()
      for (let index = 0; index < subject.settleSteps; index++) step()
      graphics.resetFrames()
      for (let index = 0; index < run.measuredFrameCount; index++) {
        const handle = graphics.beginFrame()
        if (index === run.measuredFrameCount - 1) countScene(step)
        else step()
        graphics.endFrame(handle)
        await getNextAnimationFrame()
      }
      measuredFrames = await graphics.collectFrames()
      renderer.dispose()
    }

    const runRace = async (subject: RaceScenarioSubject) => {
      const resources = loadGameResources(jam, executable)
      const place: RacePlace = {
        kind: 'race',
        name: 'performance',
        mode: 'single_race',
        raceFolder: RACE_FOLDER,
        racerCount: subject.racerCount,
        localPlayerCount: 1,
        isBestRunShown: false,
        isPlayerSliding: subject.isPlayerSliding,
        powerUpUses: subject.powerUpUses,
        frameCount: subject.measuredFrame + 1,
        recordFrames: [subject.measuredFrame],
      }
      const started = startNextRace(
        createGameSession(resources, getRaceSettings(resources, place, cars))
      )
      if (started.kind !== 'race') throw new Error('The session started no race')
      const assets = loadRaceAssets(
        jam,
        { executable, tunes: new Map() },
        { raceFolder: started.race.folder },
        started.definition
      )
      const display = getRaceDisplay({
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      })
      const container = document.createElement('div')
      document.body.appendChild(container)
      const viewport = createRaceViewport(container, assets, display.stageSize, display.pixelRatio)
      viewport.render()
      await showFirstFrame()
      const frames = getPlaceFrames(place)
      const firstMeasuredFrame = subject.measuredFrame - run.measuredFrameCount + 1
      let handle: FrameHandle | null = null
      graphics.resetFrames()
      // A measured frame runs from the end of the one before it: the race's step, the poses and the render.
      if (firstMeasuredFrame === 0) handle = graphics.beginFrame()
      runRaceFrames(
        assets,
        display.stageSize,
        frames,
        (portFrame) => {
          showPortRaceFrame(viewport, portFrame)
          viewport.animate(portFrame.milliseconds)
          if (portFrame.frame === subject.measuredFrame) countScene(viewport.render)
          else viewport.render()
          if (handle !== null) graphics.endFrame(handle)
          handle =
            portFrame.frame + 1 >= firstMeasuredFrame && portFrame.frame < subject.measuredFrame
              ? graphics.beginFrame()
              : null
        },
        place.powerUpUses.map((use) => ({ ...use, racer: PLAYER_RACER_INDEX }))
      )
      measuredFrames = await graphics.collectFrames()
      viewport.dispose()
      container.remove()
    }

    if (run.subject.kind === 'menu') await runMenu(run.subject)
    else await runRace(run.subject)
    return {
      firstFrameMilliseconds,
      modelsShownMilliseconds,
      frames: measuredFrames,
      sceneObjects,
      geometries,
      totals,
      parse: graphics.getParseStatistics(),
      heapMegabytes: getHeapMegabytes(),
    }
  }
  Object.assign(window, { runPerformanceScenario })
}
