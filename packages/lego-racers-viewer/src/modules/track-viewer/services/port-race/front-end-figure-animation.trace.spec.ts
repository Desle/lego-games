import { createRandomTable } from '@lego-games/lego-racers/random-table'
import {
  createFrontEnd,
  loadFrontEndResources,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type { FrontEndEnvironment, FrontEndState } from '@lego-games/lego-racers/front-end'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getIsOriginalPresentationAvailable,
  readOriginalFrontEnd,
} from '@lego-games/lego-racers/presentation-trace'
import {
  getDistance,
  getFigure,
  getOriginalFramePositions,
  getPortBonePositions,
} from './figure-frames.ts'
import { getIsOriginalGamePresent, readOriginalJam } from './original-game-files.ts'

const FRAME_MILLISECONDS = 33
const POSITION_TOLERANCE = 0.03
// The original's main menu opens at this frame of the scenario (the port's first step is the frame after it).
const MENU_OPENED_FRAME = 154
// During `start` (300, 500), the loop of `begin` (900), the blend and `wait` of the 30 second timer (1100, 1250: the
// tap on the glass sounds at frame 208 of `wait`) and after it (1400).
const RECORDED_FRAMES = [300, 500, 900, 1100, 1250, 1400]
const MATCHED_SHARE = 0.7
// The last frame the original still shows the figure, and one after it has left the menu for the demonstration race.
const LAST_FIGURE_FRAME = 1900
const DEMONSTRATION_FRAME = 2100

describe.skipIf(!(getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()))(
  'front end figure animation',
  () => {
    // eslint-disable-next-line no-restricted-syntax -- the describe body is one test, not an expression to return
    it('matches the original over time', async () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const resources = loadFrontEndResources(archive)
      const environment: FrontEndEnvironment = {
        controllerCount: 1,
        unlockedCircuitMask: 0x7f,
        randomTable: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
        isEveryPartUnlocked: true,
        playerRacerNames: [],
        standingRows: [],
      }
      const frames = Array.from({ length: DEMONSTRATION_FRAME + 1 }, () => ({
        milliseconds: FRAME_MILLISECONDS,
        scanCodes: [] as number[],
      }))

      // Act
      const original = await readOriginalFrontEnd({
        name: 'figure animation',
        frames,
        recordFrames: [...RECORDED_FRAMES, LAST_FIGURE_FRAME, DEMONSTRATION_FRAME],
        isRenderRecorded: true,
      })
      let state: FrontEndState = createFrontEnd(resources, environment)
      let steps = 0
      const shares = RECORDED_FRAMES.map((recordedFrame) => {
        while (steps < recordedFrame - MENU_OPENED_FRAME) {
          state = stepFrontEnd(state, resources, environment, null, FRAME_MILLISECONDS).state
          steps += 1
        }
        const figure = getFigure(state, resources, environment)
        const draws =
          original.renderFrames.find((candidate) => candidate.frame === recordedFrame)?.draws ?? []
        const originalPositions = getOriginalFramePositions(draws)
        const bonePositions = figure === null ? [] : getPortBonePositions(archive, figure)
        const matched = originalPositions.filter((position) =>
          bonePositions.some((bone) => getDistance(bone, position) < POSITION_TOLERANCE)
        )
        return matched.length / originalPositions.length
      })
      const figureFrameCounts = [LAST_FIGURE_FRAME, DEMONSTRATION_FRAME].map(
        (recordedFrame) =>
          getOriginalFramePositions(
            original.renderFrames.find((candidate) => candidate.frame === recordedFrame)?.draws ??
              []
          ).length
      )

      // Assert
      expect(Math.min(...shares)).toBeGreaterThan(MATCHED_SHARE)
      expect(figureFrameCounts[0]).toBeGreaterThan(0)
      expect(figureFrameCounts[1]).toBe(0)
    })
  }
)
