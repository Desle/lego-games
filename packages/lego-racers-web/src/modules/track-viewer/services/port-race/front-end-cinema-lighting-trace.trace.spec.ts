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
import { getCinemaFigureColors } from './cinema-colors.ts'
import { getOriginalFigureDraws } from './figure-frames.ts'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from './original-game-files.ts'

const FRAME_MILLISECONDS = 33
const MENU_OPENED_FRAME = 154
const MATCHED_SHARE = 0.9
const COLOR_TOLERANCE = 1
type ScenarioKeys = readonly (readonly [number, FrontEndInput, number])[]
// Two downs and enter open the single race screen; down and enter the circuit race screen, whose third race (frames 392 to
// 452) is the space cinema.
const SINGLE_KEYS: ScenarioKeys = [
  [240, 'down', 208],
  [250, 'down', 208],
  [270, 'accept', 28],
]
const CIRCUIT_KEYS: ScenarioKeys = [
  [250, 'down', 208],
  [270, 'accept', 28],
]
const SINGLE_FRAMES = [300, 400, 700]
// The figure's colours change a little with every frame (its pose moves under the light).
const CONSECUTIVE_FRAMES = Array.from({ length: 11 }, (_, index) => 405 + index)

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

const getCinemaView = (state: FrontEndState): RaceCinemaView | null => {
  for (const command of getFrontEndFrame(state, resources, environment).commands) {
    if (command.kind === 'viewport' && command.cinema !== null) return command.cinema
  }
  return null
}

const getIsNear = (left: number, right: number): boolean =>
  [16, 8, 0].every(
    (shift) => Math.abs(((left >> shift) & 0xff) - ((right >> shift) & 0xff)) <= COLOR_TOLERANCE
  )

const getShares = async (keys: ScenarioKeys, watchedFrames: readonly number[]) => {
  const lastFrame = Math.max(...watchedFrames)
  const original = await readOriginalFrontEnd({
    name: 'race cinema lighting',
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
    const originalColors = new Set(
      getOriginalFigureDraws(draws).flatMap((draw) =>
        draw.vertices.map((vertex) => vertex.diffuse & 0xffffff)
      )
    )
    const portColors = view === null ? new Set<number>() : getCinemaFigureColors(archive, view)
    const matched = [...originalColors].filter((color) =>
      [...portColors].some((portColor) => getIsNear(color, portColor))
    )
    return matched.length / Math.max(1, originalColors.size)
  })
}

describe.skipIf(!(getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()))(
  'front end race cinema lighting',
  () => {
    it('lights the champion like the original (vertex colours of the figure draws)', async () => {
      // Arrange / Act
      const shares = await getShares(SINGLE_KEYS, SINGLE_FRAMES)

      // Assert
      expect(Math.min(...shares)).toBeGreaterThan(MATCHED_SHARE)
    })

    it('follows the figure frame by frame (the colours that change with its pose)', async () => {
      // Arrange / Act
      const shares = await getShares(CIRCUIT_KEYS, CONSECUTIVE_FRAMES)

      // Assert
      expect(Math.min(...shares)).toBeGreaterThan(MATCHED_SHARE)
    })
  }
)
