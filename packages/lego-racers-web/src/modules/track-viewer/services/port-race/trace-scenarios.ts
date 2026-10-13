import {
  createTraceScenario,
  getIdleFrames,
  getPowerSlideFrames,
  getRouteDrivingFrames,
  getSteeringSweepFrames,
  holdBindings,
} from '@lego-games/lego-racers/golden-trace'
import type { GoldenTraceScenario, TraceFrameInput } from '@lego-games/lego-racers/golden-trace'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { getCircuitRacerCodes, loadRaceDefinition } from '@lego-games/lego-racers/race'
import { RaceBinding } from '@lego-games/lego-racers/race-input'
import { FpuPrecision } from '@lego-games/lego-racers/simulation-math'
import type { PresentationScenario } from '@lego-games/lego-racers/presentation-trace'
import { readOriginalExecutable } from './original-game-files.ts'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

// The introduction, the countdown and the first seconds of racing (the racers are released at frame 160).
const AUDIO_FRAME_COUNT = 330

const getPresentationScenario = (
  golden: GoldenTraceScenario,
  recordFrames: readonly number[] | null,
  isRenderRecorded: boolean,
  isDecalRecorded: boolean,
  powerUpGrants: NonNullable<PresentationScenario['powerUpGrants']>,
  isTimeTrial: boolean
): PresentationScenario =>
  Object.freeze({
    name: golden.name,
    isTimeTrial,
    raceFolder: golden.raceFolder,
    racerCodes: golden.racerCodes,
    racerCount: golden.racerCount,
    localPlayerCount: golden.localPlayerCount,
    circuitName: golden.circuitName,
    isMirrored: golden.isMirrored,
    frames: golden.frames,
    recordFrames,
    isRenderRecorded,
    isDecalRecorded,
    powerUpGrants,
  })

const ACCELERATE_FRAME = 175
const USE_FRAME_COUNT = 3

// The route drive of the golden trace with the use key pressed from the use frame (the barrier's golden trace).
const getRouteDrivenFrames = (
  jam: Uint8Array,
  request: TraceScenarioRequest,
  racerCodes: readonly string[],
  powerUp: NonNullable<TraceScenarioRequest['powerUp']>
): readonly TraceFrameInput[] => {
  const definition = loadRaceDefinition(jam, readOriginalExecutable(), {
    raceFolder: request.raceFolder,
    racerCodes,
    localPlayerCount: 1,
    fpuPrecision: FpuPrecision.SINGLE,
    isPlayerChampionCar: true,
    musicTuneCount: 0,
  })
  const useCodes = holdBindings(1, [RaceBinding.USE_POWER_UP])[0]?.scanCodes ?? []
  return getRouteDrivingFrames(definition, powerUp.frameCount).map((frame, index) =>
    index >= powerUp.useFrame && index < powerUp.useFrame + USE_FRAME_COUNT
      ? { ...frame, scanCodes: [...frame.scanCodes, ...useCodes] }
      : frame
  )
}

// Idling, the steering sweep, or a drive with a power-up: accelerate from frame 175 and press the use key from the use frame.
const getRequestFrames = (
  jam: Uint8Array,
  request: TraceScenarioRequest,
  racerCodes: readonly string[]
): readonly TraceFrameInput[] => {
  if (request.powerUp !== undefined && request.isRouteDriven === true) {
    return getRouteDrivenFrames(jam, request, racerCodes, request.powerUp)
  }
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
  return request.isSteering === true
    ? getSteeringSweepFrames()
    : getIdleFrames(request.frameCount ?? AUDIO_FRAME_COUNT)
}

// The scenario of a race: the circuit's drivers, the player idle through the introduction and the countdown, then
// driving. `recordFrames` are the frames whose draws are recorded.
export const createPresentationScenario = (
  jam: Uint8Array,
  request: TraceScenarioRequest
): PresentationScenario => {
  const archive = openJamArchive(jam)
  const racerCodes =
    request.racerCodes ?? getCircuitRacerCodes(archive.readFile, request.raceFolder)
  const golden = createTraceScenario({
    name: request.name,
    raceFolder: request.raceFolder,
    racerCodes,
    // FUN_00487f90: a time trial has no opponents.
    ...(request.isTimeTrial === true ? { racerCount: 1 } : {}),
    isMirrored: request.isMirrored ?? false,
    ...(request.localPlayerCount === undefined
      ? {}
      : { localPlayerCount: request.localPlayerCount }),
    ...(request.circuitName === undefined ? {} : { circuitName: request.circuitName }),
    frames: getRequestFrames(jam, request, racerCodes),
  })
  const scenario = getPresentationScenario(
    golden,
    request.recordFrames ?? null,
    request.isRenderRecorded ?? false,
    request.isDecalRecorded ?? false,
    request.powerUp === undefined
      ? []
      : (request.powerUp.grantedRacers ?? [0]).map((racer) => ({
          frame: request.powerUp?.grantFrame ?? 0,
          racer,
          kind: request.powerUp?.kind ?? 0,
          level: request.powerUp?.level ?? 0,
        })),
    request.isTimeTrial ?? false
  )
  return Object.freeze({
    ...scenario,
    ...(request.racerFinishes === undefined ? {} : { racerFinishes: request.racerFinishes }),
    ...(request.pointsRecordTotals === undefined
      ? {}
      : { pointsRecordTotals: request.pointsRecordTotals }),
  })
}
