import {
  createTraceScenario,
  type GoldenTraceScenario,
  type TraceFrameInput,
} from '../../../golden-trace/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { getCircuitRacerCodes } from '../../../race/index.ts'
import {
  DEFAULT_KEYBOARD_BINDINGS,
  GAMEPAD_BUTTON_BINDINGS,
  getJoystickAxisUnits,
} from '../../../race-input/index.ts'
import type {
  ReplayControllerKind,
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

// The keys the race's menu handlers take (0x00435c00 pause, 0x00427810 up, down, confirm), as DirectInput scan codes.
const PAUSE_SCAN_CODE = 0x01
const MENU_UP_SCAN_CODE = 0xc8 // key code 0x100000c8 of 0x00427810
const MENU_DOWN_SCAN_CODE = 0xd0 // key code 0x100000d0 of 0x00427810
const MENU_CONFIRM_SCAN_CODE = 0x1c // key code 0x1000001c of 0x00427810

const getHeldScanCodes = (frame: ReplayFrame): readonly number[] =>
  [...frame.input.pressedKeyCodes].flatMap((keyCode) => {
    const scanCode = SCAN_CODES_BY_KEY_CODE.get(keyCode)
    return scanCode === undefined ? [] : [scanCode]
  })

// The gamepad buttons the race binds (0x0042e960: buttons 0 to 6 are bindings 2 to 8).
const getBoundButtonIndices = (frame: ReplayFrame): readonly number[] =>
  (frame.input.gamepad?.pressedButtonIndices ?? []).filter(
    (buttonIndex) => buttonIndex < GAMEPAD_BUTTON_BINDINGS.length
  )

const getSteeringUnits = (frame: ReplayFrame): number =>
  getJoystickAxisUnits(frame.input.gamepad?.axes[0] ?? 0)

const getIsGamepadInUse = (frame: ReplayFrame): boolean =>
  getBoundButtonIndices(frame).length > 0 || getSteeringUnits(frame) !== 0

const getController = (recording: SessionRecording): ReplayControllerKind =>
  recording.frames.some(getIsGamepadInUse) ? 'joystick' : 'keyboard'

const getHeaderStopReason = (header: ReplayHeader): string | null => {
  if (header.localPlayerCount > 1) return `${String(header.localPlayerCount)} local players`
  if (header.raceModeFlags !== 0) return 'race mode flags'
  return null
}

// A grant has no feed. A keyboard that drives while the gamepad is the controller has none either: the original's
// controller reads one device (the race ignores the keyboard then), the port reads both.
const getFrameStopReason = (
  frame: ReplayFrame,
  controller: ReplayControllerKind,
  isMenuOpen: boolean
): string | null => {
  if (frame.grant !== null) return 'a developer power-up grant'
  if (controller === 'joystick' && !isMenuOpen && getHeldScanCodes(frame).length > 0) {
    return 'a keyboard key driving a gamepad session'
  }
  return null
}

const getIsMenuOpen = (menuOpenFrames: readonly boolean[], index: number): boolean =>
  menuOpenFrames[index] === true || menuOpenFrames[index - 1] === true

// The menu keys of a frame (a tap each). A key the held-key feed presses in this very frame is not tapped twice.
const getTappedScanCodes = (
  frame: ReplayFrame,
  previous: ReplayFrame | null
): readonly number[] => {
  const { menu } = frame
  if (menu === null) return []
  const alreadyHeld = new Set(previous === null ? [] : getHeldScanCodes(previous))
  const pressedNow = new Set(
    getHeldScanCodes(frame).filter((scanCode) => !alreadyHeld.has(scanCode))
  )
  const wanted = [
    ...(menu.isPausePressed ? [PAUSE_SCAN_CODE] : []),
    ...(menu.selectionChange < 0 ? [MENU_UP_SCAN_CODE] : []),
    ...(menu.selectionChange > 0 ? [MENU_DOWN_SCAN_CODE] : []),
    ...(menu.isConfirmPressed ? [MENU_CONFIRM_SCAN_CODE] : []),
  ]
  return wanted.filter((scanCode) => !pressedNow.has(scanCode))
}

export const getReplayScenarioSplit = (
  recording: SessionRecording,
  menuOpenFrames: readonly boolean[] = []
): ReplayScenarioSplit => {
  const controller = getController(recording)
  const headerReason = getHeaderStopReason(recording.header)
  if (headerReason !== null) {
    return {
      supportedFrameCount: 0,
      stopReason: headerReason,
      controller,
      menuKeyFrameCount: 0,
      gamepadFrameCount: 0,
    }
  }
  const stopIndex = recording.frames.findIndex(
    (frame, index) =>
      getFrameStopReason(frame, controller, getIsMenuOpen(menuOpenFrames, index)) !== null
  )
  const stopFrame = recording.frames[stopIndex]
  const supportedFrames =
    stopFrame === undefined ? recording.frames : recording.frames.slice(0, stopIndex)
  return {
    supportedFrameCount: supportedFrames.length,
    stopReason:
      stopFrame === undefined
        ? null
        : getFrameStopReason(stopFrame, controller, getIsMenuOpen(menuOpenFrames, stopIndex)),
    controller,
    menuKeyFrameCount: supportedFrames.filter(
      (frame, index) => getTappedScanCodes(frame, supportedFrames[index - 1] ?? null).length > 0
    ).length,
    gamepadFrameCount: supportedFrames.filter(getIsGamepadInUse).length,
  }
}

const getTraceFrame = (
  frame: ReplayFrame,
  previous: ReplayFrame | null,
  controller: ReplayControllerKind
): TraceFrameInput => ({
  milliseconds: frame.milliseconds,
  scanCodes: getHeldScanCodes(frame),
  tappedScanCodes: getTappedScanCodes(frame, previous),
  joystick:
    controller === 'joystick'
      ? { axes: [getSteeringUnits(frame), 0], buttonIndices: getBoundButtonIndices(frame) }
      : null,
})

// The golden trace scenario that feeds a recording to the original (the first `supportedFrameCount` frames): the held
// keys, the menu keys, the gamepad as the DirectInput joystick the race reads. It drives the champion car of racer code 0:
// the emulator does not run the car builder.
export const getReplayScenario = (
  recording: SessionRecording,
  jam: Uint8Array,
  name: string,
  menuOpenFrames: readonly boolean[] = []
): GoldenTraceScenario => {
  const { header } = recording
  const racerCodes =
    header.racerCodes ?? getCircuitRacerCodes(openJamArchive(jam).readFile, header.raceFolder)
  const split = getReplayScenarioSplit(recording, menuOpenFrames)
  return Object.freeze({
    ...createTraceScenario({
      name,
      raceFolder: header.raceFolder,
      racerCodes,
      racerCount: header.racerCount,
      localPlayerCount: header.localPlayerCount,
      circuitName: header.circuitName,
      isMirrored: header.isMirrored,
      controller: split.controller,
      frames: recording.frames
        .slice(0, split.supportedFrameCount)
        .map((frame, index) =>
          getTraceFrame(frame, recording.frames[index - 1] ?? null, split.controller)
        ),
    }),
    randomPosition: header.randomPosition,
  })
}
