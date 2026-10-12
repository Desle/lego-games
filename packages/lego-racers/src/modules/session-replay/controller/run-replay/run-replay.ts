import {
  compareWithOriginal,
  getIsOriginalTraceAvailable,
  readOriginalTrace,
} from '../../../golden-trace/index.ts'
import { replayOnPort } from '../replay-port/replay-port.ts'
import { getReplayScenario, getReplayScenarioSplit } from '../replay-scenario/replay-scenario.ts'
import type { SessionRecording } from '../../../session-recording/index.ts'
import type { ReplayReport } from './run-replay.types.ts'

// The emulator has no sound device (no racing tune draw) and does not run the car builder (the champion car drives).
const ORIGINAL_COMPARISON_OPTIONS = Object.freeze({ isPlayerChampionCar: true, musicTuneCount: 0 })

const getOriginalSkipReason = (supportedFrameCount: number, stopReason: string | null) => {
  if (!getIsOriginalTraceAvailable()) return 'the emulator or the original files are missing'
  return supportedFrameCount === 0
    ? `no frame can be fed to the original (${stopReason ?? ''})`
    : null
}

const getCarNote = (recording: SessionRecording): string => {
  const [car] = recording.header.playerCars
  return car === undefined
    ? 'champion car on both sides'
    : `champion car on both sides; the built car (${car.chassisName}, weight ${String(car.weight)}) is not run by the emulator: ` +
        'its models come from the front end object (FrontEnd_BuildBuiltCarSlot 0x0042dcb0)'
}

// Replays a recording on the port, and when the emulator is available on the original too, and compares them.
export const runReplay = async (
  recording: SessionRecording,
  jam: Uint8Array,
  executable: Uint8Array,
  name: string
): Promise<ReplayReport> => {
  const recorded = replayOnPort(recording, jam, executable)
  const compared = replayOnPort(recording, jam, executable, ORIGINAL_COMPARISON_OPTIONS)
  const split = getReplayScenarioSplit(recording, compared.menuOpenFrames)
  const skipReason = getOriginalSkipReason(split.supportedFrameCount, split.stopReason)
  const base = {
    frameCount: recording.frames.length,
    portPhase: recorded.raceState.phase,
    portRandomPosition: recorded.raceState.racerSet.randomPosition,
  }
  if (skipReason !== null) return { ...base, original: null, originalSkipReason: skipReason }
  const trace = await readOriginalTrace(
    getReplayScenario(recording, jam, name, compared.menuOpenFrames)
  )
  const comparison = compareWithOriginal(trace.frames, compared.frames)
  return {
    ...base,
    originalSkipReason: null,
    original: {
      comparedFrameCount: split.supportedFrameCount,
      stopReason: split.stopReason,
      comparison,
      firstDivergence: comparison.firstDivergence,
      controller: split.controller,
      menuKeyFrameCount: split.menuKeyFrameCount,
      gamepadFrameCount: split.gamepadFrameCount,
      carNote: getCarNote(recording),
    },
  }
}
