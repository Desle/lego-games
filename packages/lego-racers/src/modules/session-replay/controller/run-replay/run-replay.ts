import { getIsOriginalTraceAvailable, runGoldenTrace } from '../../../golden-trace/index.ts'
import { replayOnPort } from '../replay-port/replay-port.ts'
import { getReplayScenario, getReplayScenarioSplit } from '../replay-scenario/replay-scenario.ts'
import type { SessionRecording } from '../../types/session-replay.types.ts'
import type { ReplayReport } from './run-replay.types.ts'

const getOriginalSkipReason = (supportedFrameCount: number, stopReason: string | null) => {
  if (!getIsOriginalTraceAvailable()) return 'the emulator or the original files are missing'
  return supportedFrameCount === 0
    ? `no frame can be fed to the original (${stopReason ?? ''})`
    : null
}

// Replays a recording on the port, and when the emulator is available on the original too, and compares them.
export const runReplay = async (
  recording: SessionRecording,
  jam: Uint8Array,
  executable: Uint8Array,
  name: string
): Promise<ReplayReport> => {
  const port = replayOnPort(recording, jam, executable)
  const split = getReplayScenarioSplit(recording)
  const skipReason = getOriginalSkipReason(split.supportedFrameCount, split.stopReason)
  const base = {
    frameCount: recording.frames.length,
    portPhase: port.raceState.phase,
    portRandomPosition: port.raceState.racerSet.randomPosition,
  }
  if (skipReason !== null) return { ...base, original: null, originalSkipReason: skipReason }
  const result = await runGoldenTrace(getReplayScenario(recording, jam, name), jam, executable)
  return {
    ...base,
    originalSkipReason: null,
    original: {
      comparedFrameCount: split.supportedFrameCount,
      stopReason: split.stopReason,
      comparison: result.comparison,
      firstDivergence: result.comparison.firstDivergence,
    },
  }
}
