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
import type { OriginalDraw } from '@lego-games/lego-racers/presentation-trace'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from './original-game-files.ts'

const FRAME_MILLISECONDS = 33
const MENU_OPENED_FRAME = 154
// Down and enter open the circuit race screen, whose third race is the space cinema with the lightning (`MM_FLSH`).
const KEYS: readonly (readonly [number, FrontEndInput, number])[] = [
  [250, 'down', 208],
  [270, 'accept', 28],
]
// The flash is on in cinema frames 14, 19 and 20 (the cinema starts in frame 392): original frames 407, 412 and 413.
const WATCHED_FRAMES = [405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415]
const SKY_TEXTURE_PREFIX = 'e8ce1d'
const MAXIMUM_SKY_VERTICES = 12
const FLASH_RED_BIAS = 64

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

// The red channel of the clipped sky quad: the sum over the vertices of its draws.
const getSkyRed = (draws: readonly OriginalDraw[]): number =>
  draws
    .filter(
      (draw) =>
        draw.textureHash?.startsWith(SKY_TEXTURE_PREFIX) === true &&
        draw.vertices.length <= MAXIMUM_SKY_VERTICES
    )
    .reduce(
      (sum, draw) =>
        sum + draw.vertices.reduce((inner, vertex) => inner + ((vertex.diffuse >> 16) & 0xff), 0),
      0
    )

describe.skipIf(!(getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()))(
  'front end race cinema flash',
  () => {
    // eslint-disable-next-line no-restricted-syntax -- the test body is a block of steps
    it('flashes the sky red in the same frames as the original', async () => {
      // Arrange
      const lastFrame = Math.max(...WATCHED_FRAMES)
      const original = await readOriginalFrontEnd({
        name: 'race cinema flash',
        frames: Array.from({ length: lastFrame + 1 }, (_, frame) => {
          const key = KEYS.find(([keyFrame]) => keyFrame === frame)
          return { milliseconds: FRAME_MILLISECONDS, scanCodes: key === undefined ? [] : [key[2]] }
        }),
        recordFrames: WATCHED_FRAMES,
        isRenderRecorded: true,
      })
      let state: FrontEndState = createFrontEnd(resources, environment)
      let steps = 0
      const skyReds = WATCHED_FRAMES.map((frame) =>
        getSkyRed(original.renderFrames.find((candidate) => candidate.frame === frame)?.draws ?? [])
      )
      const baseline = Math.min(...skyReds)

      // Act
      const results = WATCHED_FRAMES.map((watchedFrame, index) => {
        while (steps < watchedFrame - MENU_OPENED_FRAME) {
          steps += 1
          const input =
            KEYS.find(([keyFrame]) => keyFrame === MENU_OPENED_FRAME + steps - 1)?.[1] ?? null
          state = stepFrontEnd(state, resources, environment, input, FRAME_MILLISECONDS).state
        }
        const view = getCinemaView(state)
        const shifts = view?.colourShifts ?? []
        return {
          frame: watchedFrame,
          isPortFlashed: shifts.some((shift) => (shift.biases[0] ?? 0) === FLASH_RED_BIAS),
          isOriginalFlashed: (skyReds[index] ?? 0) - baseline > FLASH_RED_BIAS,
        }
      })

      // Assert
      expect(
        results.filter((result) => result.isOriginalFlashed).map((result) => result.frame)
      ).toEqual([407, 412, 413])
      expect(results.map((result) => result.isPortFlashed)).toEqual(
        results.map((result) => result.isOriginalFlashed)
      )
    })
  }
)
