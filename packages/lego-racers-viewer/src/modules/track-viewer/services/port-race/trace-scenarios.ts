import {
  createTraceScenario,
  getIdleFrames,
  getPowerSlideFrames,
  getSteeringSweepFrames,
  holdBindings,
} from '@lego-games/lego-racers/golden-trace'
import type { GoldenTraceScenario, TraceFrameInput } from '@lego-games/lego-racers/golden-trace'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { getCircuitRacerCodes } from '@lego-games/lego-racers/race'
import type { PresentationScenario } from '@lego-games/lego-racers/presentation-trace'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

// The introduction, the countdown and the first seconds of racing (the racers are released at frame 160).
const AUDIO_FRAME_COUNT = 330

const getPresentationScenario = (
  golden: GoldenTraceScenario,
  recordFrames: readonly number[] | null,
  isRenderRecorded: boolean,
  powerUpGrants: NonNullable<PresentationScenario['powerUpGrants']>
): PresentationScenario =>
  Object.freeze({
    name: golden.name,
    raceFolder: golden.raceFolder,
    racerCodes: golden.racerCodes,
    racerCount: golden.racerCount,
    localPlayerCount: golden.localPlayerCount,
    circuitName: golden.circuitName,
    isMirrored: golden.isMirrored,
    frames: golden.frames,
    recordFrames,
    isRenderRecorded,
    powerUpGrants,
  })

const ACCELERATE_FRAME = 175
const USE_FRAME_COUNT = 3

// Idling, the steering sweep, or a drive with a power-up: accelerate from frame 175 and press the use key from the use frame.
const getRequestFrames = (request: TraceScenarioRequest): readonly TraceFrameInput[] => {
  if (request.powerUp !== undefined) {
    const { useFrame, frameCount } = request.powerUp
    return Array.from({ length: frameCount }, (_, frame) => ({
      milliseconds: 33,
      scanCodes:
        holdBindings(1, [
          ...(frame >= ACCELERATE_FRAME ? ['accelerate' as const] : []),
          ...(frame >= useFrame && frame < useFrame + USE_FRAME_COUNT
            ? ['use_power_up' as const]
            : []),
        ])[0]?.scanCodes ?? [],
    }))
  }
  if (request.isPowerSliding === true) return getPowerSlideFrames()
  return request.isSteering === true ? getSteeringSweepFrames() : getIdleFrames(AUDIO_FRAME_COUNT)
}

// The scenario of a race: the circuit's drivers, the player idle through the introduction and the countdown, then
// driving. `recordFrames` are the frames whose draws are recorded.
export const createPresentationScenario = (
  jam: Uint8Array,
  request: TraceScenarioRequest
): PresentationScenario => {
  const archive = openJamArchive(jam)
  const golden = createTraceScenario({
    name: request.name,
    raceFolder: request.raceFolder,
    racerCodes: getCircuitRacerCodes(archive.readFile, request.raceFolder),
    isMirrored: request.isMirrored ?? false,
    frames: getRequestFrames(request),
  })
  return getPresentationScenario(
    golden,
    request.recordFrames ?? null,
    request.isRenderRecorded ?? false,
    request.powerUp === undefined
      ? []
      : [
          {
            frame: request.powerUp.grantFrame,
            racer: 0,
            kind: request.powerUp.kind,
            level: request.powerUp.level,
          },
        ]
  )
}
