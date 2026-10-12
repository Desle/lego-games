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
import type { OriginalDraw } from '@lego-games/lego-racers/presentation-trace'
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
// The reaction clip nods fast: a bone moves several centimetres in the 33 ms between two frames.
const REACTION_POSITION_TOLERANCE = 0.08
const YAW_TOLERANCE = 0.02
const CAR_POSITION_TOLERANCE = 0.01
const MENU_OPENED_FRAME = 154
// The keys of the scenarios: down and enter open the circuit race, enter again its racer select, a fourth enter picks the
// racer (scan codes 208, 28, 28, 28 at the first key frame, 20 frames apart). A key of frame f shows in frame f + 1.
const KEYS: readonly (readonly [number, FrontEndInput, number])[] = [
  [250, 'down', 208],
  [270, 'accept', 28],
  [290, 'accept', 28],
  [310, 'accept', 28],
]
// The first frame of the showcase, one just after it, then the driver's idle clips come and go (a clip is 1 to 6 seconds)
// while the turntable turns (a turn is 6.7 seconds).
const WATCHED_FRAMES = [291, 292, 300, 330, 400, 500, 600, 800, 1000]
const MATCHED_SHARE = 0.7
// Picking the racer: his reaction clip (`yes!`) plays; the original leaves the screen in frame 408 (the last showcase
// frame is 407, the next draws are empty), when the clip has ended.
const PICKED_FRAMES = [320, 338, 380, 406]
const ORIGINAL_LEAVE_FRAME = 408

const CAR_POSITION: readonly number[] = [-11.52, -6.767, 0]
const getCarFrame = (draw: OriginalDraw): readonly number[] | null =>
  draw.modelMatrix.length === MATRIX_SIZE && draw.clipMatrix.length === MATRIX_SIZE
    ? multiply(draw.modelMatrix, invert(draw.clipMatrix))
    : null

// A draw of the car: its frame has the scale 1 and the car's position.
const getIsCarDraw = (draw: OriginalDraw): boolean => {
  const frame = getCarFrame(draw)
  return (
    frame !== null &&
    Math.abs(Math.hypot(frame[0] ?? 0, frame[1] ?? 0) - 1) < CAR_POSITION_TOLERANCE &&
    getDistance(frame.slice(12, 15), CAR_POSITION) < CAR_POSITION_TOLERANCE
  )
}

const getOriginalCarYaws = (draws: readonly OriginalDraw[]): readonly number[] =>
  draws.flatMap((draw) => {
    const frame = getCarFrame(draw)
    return frame !== null && getIsCarDraw(draw) ? [Math.atan2(frame[1] ?? 0, frame[0] ?? 1)] : []
  })

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

type ShowcaseFrame = {
  readonly share: number
  readonly yawDifference: number
  readonly carDrawCount: number
}

type ScenarioResult = {
  readonly frames: readonly ShowcaseFrame[]
  // The original frame the port's front end started the race in (its step count plus the frame the menu opened in).
  readonly leaveFrame: number | null
}

// Runs the original and the port through the same keys and compares the showcase at every watched frame.
const runScenario = async (
  keyCount: number,
  watchedFrames: readonly number[],
  lastFrame: number,
  tolerance: number = POSITION_TOLERANCE
): Promise<ScenarioResult> => {
  const keys = KEYS.slice(0, keyCount)
  const scene = loadScene(archive, getMenuWorldPaths('racer') ?? [])
  const original = await readOriginalFrontEnd({
    name: 'racer showcase',
    frames: Array.from({ length: lastFrame + 1 }, (_, frame) => {
      const key = keys.find(([keyFrame]) => keyFrame === frame)
      return { milliseconds: FRAME_MILLISECONDS, scanCodes: key === undefined ? [] : [key[2]] }
    }),
    recordFrames: watchedFrames,
    isRenderRecorded: true,
  })
  let state: FrontEndState = createFrontEnd(resources, environment)
  let steps = 0
  const leave: { frame: number | null } = { frame: null }
  const step = () => {
    steps += 1
    const input = keys.find(([keyFrame]) => keyFrame === MENU_OPENED_FRAME + steps - 1)?.[1] ?? null
    state = stepFrontEnd(state, resources, environment, input, FRAME_MILLISECONDS).state
    if (leave.frame === null && state.outcome === 'race') leave.frame = MENU_OPENED_FRAME + steps
  }
  const frames = watchedFrames.map((watchedFrame) => {
    while (steps < watchedFrame - MENU_OPENED_FRAME) step()
    const figure = getFigure(state, resources, environment)
    const draws =
      original.renderFrames.find((candidate) => candidate.frame === watchedFrame)?.draws ?? []
    const originalPositions = getOriginalFramePositions(draws)
    const bonePositions = figure === null ? [] : getPortBonePositions(archive, figure)
    const matched = originalPositions.filter((position) =>
      bonePositions.some((bone) => getDistance(bone, position) < tolerance)
    )
    const turntable =
      state.showcase === null
        ? null
        : getTurntableState(scene, state.showcase.turntableMilliseconds)
    const portYaw = turntable === null ? 0 : getCarYaw(scene, turntable)
    const yawDifferences = getOriginalCarYaws(draws).map((yaw) =>
      Math.abs(Math.atan2(Math.sin(yaw - portYaw), Math.cos(yaw - portYaw)))
    )
    return {
      share: matched.length / Math.max(1, originalPositions.length),
      yawDifference: Math.max(...yawDifferences, 0),
      carDrawCount: yawDifferences.length,
    }
  })
  while (leave.frame === null && steps < lastFrame - MENU_OPENED_FRAME) step()
  return { frames, leaveFrame: leave.frame }
}

describe.skipIf(!(getIsOriginalGamePresent() && getIsOriginalPresentationAvailable()))(
  'front end racer showcase',
  () => {
    it('matches the original over time', async () => {
      // Arrange / Act
      const result = await runScenario(3, WATCHED_FRAMES, Math.max(...WATCHED_FRAMES))

      // Assert
      expect(Math.min(...result.frames.map((frame) => frame.share))).toBeGreaterThan(MATCHED_SHARE)
      expect(Math.min(...result.frames.map((frame) => frame.carDrawCount))).toBeGreaterThan(0)
      expect(Math.max(...result.frames.map((frame) => frame.yawDifference))).toBeLessThan(
        YAW_TOLERANCE
      )
    })

    it('plays the reaction clip of a picked racer and leaves when it has ended', async () => {
      // Arrange / Act
      const result = await runScenario(
        4,
        PICKED_FRAMES,
        ORIGINAL_LEAVE_FRAME + 10,
        REACTION_POSITION_TOLERANCE
      )

      // Assert
      expect(Math.min(...result.frames.map((frame) => frame.share))).toBeGreaterThan(MATCHED_SHARE)
      expect(result.leaveFrame).not.toBeNull()
      expect(Math.abs((result.leaveFrame ?? 0) - ORIGINAL_LEAVE_FRAME)).toBeLessThanOrEqual(2)
    })
  }
)
