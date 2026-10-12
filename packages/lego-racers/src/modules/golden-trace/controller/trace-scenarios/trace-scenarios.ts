import { DEFAULT_KEYBOARD_BINDINGS, RaceBinding } from '../../../race-input/index.ts'
import type { RaceBindingValue } from '../../../race-input/index.ts'
import type {
  GoldenTraceScenario,
  ScenarioRequest,
  TraceFrameInput,
} from '../../types/golden-trace.types.ts'

// The introduction (about 2,000 ms after the camera) and the countdown (3,000 ms) pass before the racers are released,
// at frame 160. Accelerating within 100 ms of that fires the start boost (0x00430790); the plain scenarios wait longer.
const FRAMES_BEFORE_THROTTLE = 175
const FRAME_MILLISECONDS = 33
const DEFAULT_RACER_COUNT = 6

const getScanCode = (binding: RaceBindingValue): number => {
  const found = DEFAULT_KEYBOARD_BINDINGS.find((candidate) => candidate.binding === binding)
  if (found === undefined) throw new RangeError(`No keyboard binding for ${binding}`)
  return found.bindingCode & 0xff
}

// `count` frames of `milliseconds` with the given bindings held.
export const holdBindings = (
  count: number,
  bindings: readonly RaceBindingValue[],
  milliseconds: number = FRAME_MILLISECONDS
): readonly TraceFrameInput[] =>
  Array.from({ length: count }, () => ({
    milliseconds,
    scanCodes: bindings.map(getScanCode),
  }))

export const createTraceScenario = (request: ScenarioRequest): GoldenTraceScenario =>
  Object.freeze({
    name: request.name,
    raceFolder: request.raceFolder,
    racerCodes: request.racerCodes,
    racerCount: Math.min(request.racerCount ?? DEFAULT_RACER_COUNT, request.racerCodes.length),
    localPlayerCount: 1,
    randomPosition: 0,
    circuitName: request.circuitName ?? 'c1',
    isMirrored: request.isMirrored ?? false,
    precision: request.precision ?? 'auto',
    frames: request.frames,
    powerUpGrants: request.powerUpGrants ?? [],
    controller: request.controller ?? 'keyboard',
  })

export const getIdleFrames = (count: number): readonly TraceFrameInput[] => holdBindings(count, [])

// Full throttle after the start, hard left, hard right, then straight on.
export const getSteeringSweepFrames = (): readonly TraceFrameInput[] => [
  ...getIdleFrames(FRAMES_BEFORE_THROTTLE),
  ...holdBindings(60, [RaceBinding.ACCELERATE]),
  ...holdBindings(90, [RaceBinding.ACCELERATE, RaceBinding.STEER_POSITIVE]),
  ...holdBindings(90, [RaceBinding.ACCELERATE, RaceBinding.STEER_NEGATIVE]),
  ...holdBindings(60, [RaceBinding.ACCELERATE]),
]

// Full throttle, then a power slide to the right and one to the left: the tire smoke runs and the wheels leave marks.
export const getPowerSlideFrames = (): readonly TraceFrameInput[] => [
  ...getIdleFrames(FRAMES_BEFORE_THROTTLE),
  ...holdBindings(60, [RaceBinding.ACCELERATE]),
  ...holdBindings(100, [
    RaceBinding.ACCELERATE,
    RaceBinding.STEER_NEGATIVE,
    RaceBinding.POWER_SLIDE,
  ]),
  ...holdBindings(100, [
    RaceBinding.ACCELERATE,
    RaceBinding.STEER_POSITIVE,
    RaceBinding.POWER_SLIDE,
  ]),
  ...holdBindings(40, [RaceBinding.ACCELERATE]),
]

// Throttle with a weaving steering pattern, as long as the caller wants.
export const getWeavingFrames = (count: number): readonly TraceFrameInput[] => {
  const weave = [
    ...holdBindings(40, [RaceBinding.ACCELERATE]),
    ...holdBindings(25, [RaceBinding.ACCELERATE, RaceBinding.STEER_POSITIVE]),
    ...holdBindings(40, [RaceBinding.ACCELERATE]),
    ...holdBindings(25, [RaceBinding.ACCELERATE, RaceBinding.STEER_NEGATIVE]),
  ]
  return [
    ...getIdleFrames(FRAMES_BEFORE_THROTTLE),
    ...Array.from({ length: count }, (_, index) => weave[index % weave.length] ?? weave[0]),
  ].filter((frame): frame is TraceFrameInput => frame !== undefined)
}
