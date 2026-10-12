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
const KEYS: readonly (readonly [number, FrontEndInput, number])[] = [
  [240, 'down', 208],
  [250, 'down', 208],
  [270, 'accept', 28],
]
const WATCHED_FRAMES = [300, 400, 700]

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

describe.skipIf(!(getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()))(
  'front end race cinema lighting',
  () => {
    // eslint-disable-next-line no-restricted-syntax -- the test body is a block of steps
    it('lights the champion like the original (vertex colours of the figure draws)', async () => {
      // Arrange
      const lastFrame = Math.max(...WATCHED_FRAMES)
      const original = await readOriginalFrontEnd({
        name: 'race cinema lighting',
        frames: Array.from({ length: lastFrame + 1 }, (_, frame) => {
          const key = KEYS.find(([keyFrame]) => keyFrame === frame)
          return { milliseconds: FRAME_MILLISECONDS, scanCodes: key === undefined ? [] : [key[2]] }
        }),
        recordFrames: WATCHED_FRAMES,
        isRenderRecorded: true,
      })
      let state: FrontEndState = createFrontEnd(resources, environment)
      let steps = 0

      // Act
      const shares = WATCHED_FRAMES.map((watchedFrame) => {
        while (steps < watchedFrame - MENU_OPENED_FRAME) {
          steps += 1
          const input =
            KEYS.find(([keyFrame]) => keyFrame === MENU_OPENED_FRAME + steps - 1)?.[1] ?? null
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

      // Assert
      expect(Math.min(...shares)).toBeGreaterThan(MATCHED_SHARE)
    })
  }
)
