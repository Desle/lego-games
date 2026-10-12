import { loadRandomTable } from '@lego-games/lego-racers/random-table'
import {
  createFrontEnd,
  getMenuWorldPaths,
  loadFrontEndResources,
  stepFrontEnd,
} from '@lego-games/lego-racers/front-end'
import type {
  FrontEndEnvironment,
  FrontEndInput,
  FrontEndState,
} from '@lego-games/lego-racers/front-end'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import {
  getIsOriginalPresentationAvailable,
  readOriginalFrontEnd,
} from '@lego-games/lego-racers/presentation-trace'
import { loadScene } from '@lego-games/lego-racers/scene'
import { getCarYaw, getTurntableState } from '../showcase-stage/showcase-stage.ts'
import {
  getDistance,
  getFigure,
  getOriginalFramePositions,
  getPortBonePositions,
  invert,
  MATRIX_SIZE,
  multiply,
} from './figure-frames.ts'
import {
  getIsOriginalGamePresent,
  readOriginalExecutable,
  readOriginalJam,
} from './original-game-files.ts'

const FRAME_MILLISECONDS = 33
const POSITION_TOLERANCE = 0.03
const YAW_TOLERANCE = 0.02
const CAR_POSITION_TOLERANCE = 0.01
const MENU_OPENED_FRAME = 154
// The keys of the scenario: down and enter open the circuit race, enter again its racer select (scan codes 208, 28, 28
// at the first key frame, 20 frames apart). A key of frame f shows in frame f + 1.
const KEY_INPUTS: ReadonlyMap<number, FrontEndInput> = new Map([
  [250, 'down'],
  [270, 'accept'],
  [290, 'accept'],
])
const SCAN_CODES: ReadonlyMap<number, number> = new Map([
  [250, 208],
  [270, 28],
  [290, 28],
])
// The first frame of the showcase, one just after it, then the driver's idle clips come and go (a clip is 1 to 6 seconds)
// while the turntable turns (a turn is 6.7 seconds).
const RECORDED_FRAMES = [291, 292, 300, 330, 400, 500, 600, 800, 1000]
const MATCHED_SHARE = 0.7

const getOriginalCarYaws = (
  draws: readonly {
    readonly modelMatrix: readonly number[]
    readonly clipMatrix: readonly number[]
  }[],
  carPosition: readonly number[]
): readonly number[] =>
  draws.flatMap((draw) => {
    if (draw.modelMatrix.length !== MATRIX_SIZE || draw.clipMatrix.length !== MATRIX_SIZE) return []
    const frame = multiply(draw.modelMatrix, invert(draw.clipMatrix))
    const isCar =
      Math.abs(Math.hypot(frame[0] ?? 0, frame[1] ?? 0) - 1) < CAR_POSITION_TOLERANCE &&
      getDistance(frame.slice(12, 15), carPosition) < CAR_POSITION_TOLERANCE
    return isCar ? [Math.atan2(frame[1] ?? 0, frame[0] ?? 1)] : []
  })

describe.skipIf(!(getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()))(
  'front end racer showcase',
  () => {
    // eslint-disable-next-line no-restricted-syntax -- the describe body is one test, not an expression to return
    it('matches the original over time', async () => {
      // Arrange
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
      const scene = loadScene(archive, getMenuWorldPaths('racer') ?? [])
      const lastFrame = Math.max(...RECORDED_FRAMES)
      const frames = Array.from({ length: lastFrame + 1 }, (_, frame) => {
        const scanCode = SCAN_CODES.get(frame)
        return {
          milliseconds: FRAME_MILLISECONDS,
          scanCodes: scanCode === undefined ? [] : [scanCode],
        }
      })

      // Act
      const original = await readOriginalFrontEnd({
        name: 'racer showcase',
        frames,
        recordFrames: RECORDED_FRAMES,
        isRenderRecorded: true,
      })
      let state: FrontEndState = createFrontEnd(resources, environment)
      let steps = 0
      const results = RECORDED_FRAMES.map((recordedFrame) => {
        while (steps < recordedFrame - MENU_OPENED_FRAME) {
          steps += 1
          const input = KEY_INPUTS.get(MENU_OPENED_FRAME + steps - 1) ?? null
          state = stepFrontEnd(state, resources, environment, input, FRAME_MILLISECONDS).state
        }
        const figure = getFigure(state, resources, environment)
        const draws =
          original.renderFrames.find((candidate) => candidate.frame === recordedFrame)?.draws ?? []
        const originalPositions = getOriginalFramePositions(draws)
        const bonePositions = figure === null ? [] : getPortBonePositions(archive, figure)
        const matched = originalPositions.filter((position) =>
          bonePositions.some((bone) => getDistance(bone, position) < POSITION_TOLERANCE)
        )
        const turntable =
          state.showcase === null
            ? null
            : getTurntableState(scene, state.showcase.turntableMilliseconds)
        const portYaw = turntable === null ? 0 : getCarYaw(scene, turntable)
        const yawDifferences = getOriginalCarYaws(draws, [-11.52, -6.767, 0]).map((yaw) =>
          Math.abs(Math.atan2(Math.sin(yaw - portYaw), Math.cos(yaw - portYaw)))
        )
        return {
          share: matched.length / Math.max(1, originalPositions.length),
          yawDifference: Math.max(...yawDifferences, 0),
          carDrawCount: yawDifferences.length,
        }
      })

      // Assert
      expect(Math.min(...results.map((result) => result.share))).toBeGreaterThan(MATCHED_SHARE)
      expect(Math.min(...results.map((result) => result.carDrawCount))).toBeGreaterThan(0)
      expect(Math.max(...results.map((result) => result.yawDifference))).toBeLessThan(YAW_TOLERANCE)
    })
  }
)
