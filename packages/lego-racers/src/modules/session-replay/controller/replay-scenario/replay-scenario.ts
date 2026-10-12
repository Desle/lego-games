import {
  createTraceScenario,
  type GoldenTraceScenario,
  type TraceFrameInput,
} from '../../../golden-trace/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { getCircuitRacerCodes } from '../../../race/index.ts'
import { DEFAULT_KEYBOARD_BINDINGS } from '../../../race-input/index.ts'
import type {
  ReplayFrame,
  ReplayHeader,
  ReplayScenarioSplit,
  SessionRecording,
} from '../../../session-recording/index.ts'

const SCAN_CODE_MASK = 0xff

const SCAN_CODES_BY_KEY_CODE: ReadonlyMap<string, number> = new Map(
  DEFAULT_KEYBOARD_BINDINGS.map((binding) => [
    binding.keyCode,
    binding.bindingCode & SCAN_CODE_MASK,
  ])
)

// The emulator is fed what the game's own input manager gets: DirectInput keyboard scan codes, one local player, the
// default settings. A gamepad, a menu key or a developer grant has no such feed.
const getFrameStopReason = (frame: ReplayFrame): string | null => {
  if (frame.input.gamepad !== null) return 'a gamepad frame'
  if (frame.menu !== null) return 'a menu key'
  if (frame.grant !== null) return 'a developer power-up grant'
  return null
}

const getHeaderStopReason = (header: ReplayHeader): string | null => {
  if (header.localPlayerCount !== 1) return `${String(header.localPlayerCount)} local players`
  if (header.raceModeFlags !== 0) return 'race mode flags'
  return null
}

export const getReplayScenarioSplit = (recording: SessionRecording): ReplayScenarioSplit => {
  const headerReason = getHeaderStopReason(recording.header)
  if (headerReason !== null) return { supportedFrameCount: 0, stopReason: headerReason }
  const stopIndex = recording.frames.findIndex((frame) => getFrameStopReason(frame) !== null)
  const stopFrame = recording.frames[stopIndex]
  return stopFrame === undefined
    ? { supportedFrameCount: recording.frames.length, stopReason: null }
    : { supportedFrameCount: stopIndex, stopReason: getFrameStopReason(stopFrame) }
}

const getTraceFrame = (frame: ReplayFrame): TraceFrameInput => ({
  milliseconds: frame.milliseconds,
  scanCodes: [...frame.input.pressedKeyCodes].flatMap((keyCode) => {
    const scanCode = SCAN_CODES_BY_KEY_CODE.get(keyCode)
    return scanCode === undefined ? [] : [scanCode]
  }),
})

// The golden trace scenario that feeds a recording to the original and the port (the first `supportedFrameCount` frames).
// Both sides drive the champion car of racer code 0: the emulator does not run the car builder.
export const getReplayScenario = (
  recording: SessionRecording,
  jam: Uint8Array,
  name: string
): GoldenTraceScenario => {
  const { header } = recording
  const racerCodes =
    header.racerCodes ?? getCircuitRacerCodes(openJamArchive(jam).readFile, header.raceFolder)
  const { supportedFrameCount } = getReplayScenarioSplit(recording)
  return Object.freeze({
    ...createTraceScenario({
      name,
      raceFolder: header.raceFolder,
      racerCodes,
      racerCount: header.racerCount,
      circuitName: header.circuitName,
      isMirrored: header.isMirrored,
      frames: recording.frames.slice(0, supportedFrameCount).map(getTraceFrame),
    }),
    randomPosition: header.randomPosition,
  })
}
