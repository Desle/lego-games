import { loadRandomTable } from '@lego-games/lego-racers/random-table'
import {
  createFrontEnd,
  getFrontEndFrame,
  loadFrontEndResources,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type {
  FrontEndEnvironment,
  FrontEndInput,
  FrontEndState,
  RaceCinemaView,
} from '@lego-games/lego-racers/front-end'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getIsOriginalPresentationAvailable,
  readOriginalFrontEnd,
} from '@lego-games/lego-racers/presentation-trace'
import { getCinemaBonePositions, getDistance, getOriginalFramePositions } from './figure-frames.ts'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from './original-game-files.ts'

const FRAME_MILLISECONDS = 33
const POSITION_TOLERANCE = 0.03
const MENU_OPENED_FRAME = 154
const MATCHED_SHARE = 0.9
// Down and enter open the circuit race screen, two downs and enter the single race screen (scan codes 208 and 28; a key of frame f
// shows in frame f + 1). The circuit screen shows the next race (and its cinema) every two seconds.
const CIRCUIT_KEYS: readonly (readonly [number, FrontEndInput, number])[] = [
  [250, 'down', 208],
  [270, 'accept', 28],
]
const SINGLE_KEYS: readonly (readonly [number, FrontEndInput, number])[] = [
  [240, 'down', 208],
  [250, 'down', 208],
  [270, 'accept', 28],
]
const CIRCUIT_FRAMES = [285, 300, 330, 332, 345, 350, 356, 392, 396, 400, 460, 520, 700]
const SINGLE_FRAMES = [285, 300, 400, 500, 700]

const archive = openJamArchive(readOriginalJam())
const resources = loadFrontEndResources(archive)
const environment: FrontEndEnvironment = {
  controllerCount: 1,
  unlockedCircuitMask: 0x7f,
  randomTable: loadRandomTable(readOriginalExecutable()),
  isEveryPartUnlocked: true,
  playerRacerNames: [],
  standingRows: [],
}

type CinemaFrame = {
  readonly frame: number
  readonly cinemaName: string | null
  readonly originalCount: number
  readonly share: number
  // The original's draws with the colour the port tints the preview's frame with (8 pieces).
  readonly tintedDrawCount: number
}

const getFrameTint = (state: FrontEndState): number | null => {
  for (const command of getFrontEndFrame(state, resources, environment).commands) {
    if (command.kind === 'image' && command.tint !== undefined) return command.tint
  }
  return null
}

const getCinemaView = (state: FrontEndState): RaceCinemaView | null => {
  for (const command of getFrontEndFrame(state, resources, environment).commands) {
    if (command.kind === 'viewport' && command.cinema !== null) return command.cinema
  }
  return null
}

const runScenario = async (
  keys: readonly (readonly [number, FrontEndInput, number])[],
  watchedFrames: readonly number[]
): Promise<readonly CinemaFrame[]> => {
  const lastFrame = Math.max(...watchedFrames)
  const original = await readOriginalFrontEnd({
    name: 'race cinema',
    frames: Array.from({ length: lastFrame + 1 }, (_, frame) => {
      const key = keys.find(([keyFrame]) => keyFrame === frame)
      return { milliseconds: FRAME_MILLISECONDS, scanCodes: key === undefined ? [] : [key[2]] }
    }),
    recordFrames: watchedFrames,
    isRenderRecorded: true,
  })
  let state: FrontEndState = createFrontEnd(resources, environment)
  let steps = 0
  return watchedFrames.map((watchedFrame) => {
    while (steps < watchedFrame - MENU_OPENED_FRAME) {
      steps += 1
      const input =
        keys.find(([keyFrame]) => keyFrame === MENU_OPENED_FRAME + steps - 1)?.[1] ?? null
      state = stepFrontEnd(state, resources, environment, input, FRAME_MILLISECONDS).state
    }
    const view = getCinemaView(state)
    const draws =
      original.renderFrames.find((candidate) => candidate.frame === watchedFrame)?.draws ?? []
    const originalPositions = getOriginalFramePositions(draws)
    const bonePositions = view === null ? [] : getCinemaBonePositions(archive, view)
    const matched = originalPositions.filter((position) =>
      bonePositions.some((bone) => getDistance(bone, position) < POSITION_TOLERANCE)
    )
    const tint = getFrameTint(state)
    return {
      tintedDrawCount:
        tint === null
          ? 0
          : draws.filter((draw) => draw.vertices.some((vertex) => vertex.diffuse === tint)).length,
      frame: watchedFrame,
      cinemaName: view?.cinemaName ?? null,
      originalCount: originalPositions.length,
      share: matched.length / Math.max(1, originalPositions.length),
    }
  })
}

describe.skipIf(!(getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()))(
  'front end race cinema',
  () => {
    it('places the champion of the single race screen like the original over time', async () => {
      // Arrange / Act
      const frames = await runScenario(SINGLE_KEYS, SINGLE_FRAMES)

      // Assert
      expect(Math.min(...frames.map((frame) => frame.share))).toBeGreaterThan(MATCHED_SHARE)
    })

    it('places the champion of the circuit race screen like the original as the races change', async () => {
      // Arrange / Act
      const frames = await runScenario(CIRCUIT_KEYS, CIRCUIT_FRAMES)

      // Assert
      expect(Math.min(...frames.map((frame) => frame.share))).toBeGreaterThan(MATCHED_SHARE)
      expect(Math.min(...frames.map((frame) => frame.tintedDrawCount))).toBeGreaterThanOrEqual(8)
      expect(new Set(frames.map((frame) => frame.cinemaName)).size).toBeGreaterThan(1)
    })
  }
)
