import {
  createTraceScenario,
  getIdleFrames,
  getSteeringSweepFrames,
} from '@lego-games/lego-racers/golden-trace'
import type { GoldenTraceScenario } from '@lego-games/lego-racers/golden-trace'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { getCircuitRacerCodes } from '@lego-games/lego-racers/race'
import type { PresentationScenario } from '@lego-games/lego-racers/presentation-trace'
import type { TraceScenarioRequest } from './trace-scenarios.types.ts'

// The introduction, the countdown and the first seconds of racing (the racers are released at frame 160).
const AUDIO_FRAME_COUNT = 330

const getPresentationScenario = (
  golden: GoldenTraceScenario,
  recordFrames: readonly number[] | null,
  isRenderRecorded: boolean
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
  })

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
    frames:
      request.isSteering === true ? getSteeringSweepFrames() : getIdleFrames(AUDIO_FRAME_COUNT),
  })
  return getPresentationScenario(
    golden,
    request.recordFrames ?? null,
    request.isRenderRecorded ?? false
  )
}
