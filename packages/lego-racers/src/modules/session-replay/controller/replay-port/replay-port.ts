import { getTraceFields } from '../../../golden-trace/index.ts'
import {
  createRace,
  getRaceStateWithGrants,
  loadRaceDefinition,
  NO_MENU_INPUT,
  NO_RACE_CONTACTS,
  stepRace,
} from '../../../race/index.ts'
import type { LoadRaceOptions, RaceDefinition, RaceMenuInput } from '../../../race/index.ts'
import { PauseMenuMode } from '../../../race/index.ts'
import { getRacerControls } from '../../../race-input/index.ts'
import type { ReplayFrame, SessionRecording } from '../../../session-recording/index.ts'
import { getReplayLoadOptions } from '../../../session-recording/index.ts'
import type { PortReplay } from './replay-port.types.ts'

// The race the recording started, loaded the way the session loaded it (`overrides` change what the comparison with the
// emulator needs: the champion car, no racing tune).
export const loadReplayDefinition = (
  recording: SessionRecording,
  jam: Uint8Array,
  executable: Uint8Array,
  overrides: Partial<LoadRaceOptions> = {}
): RaceDefinition =>
  Object.freeze({
    ...loadRaceDefinition(jam, executable, {
      ...getReplayLoadOptions(recording.header, jam),
      ...overrides,
    }),
    isCountdownSkipped: recording.header.isCountdownSkipped,
  })

const CONFIRM_KEY_CODES: readonly string[] = ['Enter', 'Space']
const CONFIRM_GAMEPAD_BUTTON = 0

const getIsConfirmHeld = (frame: ReplayFrame | undefined): boolean =>
  frame !== undefined &&
  (CONFIRM_KEY_CODES.some((keyCode) => frame.input.pressedKeyCodes.has(keyCode)) ||
    (frame.input.gamepad?.pressedButtonIndices.includes(CONFIRM_GAMEPAD_BUTTON) ?? false))

// The menu keys of a frame with the confirm key going up added (0x00435cc0), which the recordings made before the
// release was recorded lack: the key is up when it was held in the previous frame and is not now; a confirm that is
// not held (the scenario taps it) goes down and up in its frame.
export const getMenuInputWithRelease = (
  frame: ReplayFrame,
  previous: ReplayFrame | undefined
): RaceMenuInput => {
  const menu = frame.menu ?? NO_MENU_INPUT
  const isReleased =
    menu.isConfirmReleased ||
    (getIsConfirmHeld(previous) && !getIsConfirmHeld(frame)) ||
    (menu.isConfirmPressed && !(getIsConfirmHeld(frame) && !getIsConfirmHeld(previous)))
  return isReleased ? Object.freeze({ ...menu, isConfirmReleased: true }) : menu
}

// Steps the port headlessly with exactly what the viewer's race step received, frame by frame, and records the compared
// fields after each frame.
export const replayOnPort = (
  recording: SessionRecording,
  jam: Uint8Array,
  executable: Uint8Array,
  overrides: Partial<LoadRaceOptions> = {}
): PortReplay => {
  let raceState = createRace(loadReplayDefinition(recording, jam, executable, overrides))
  const menuOpenFrames: boolean[] = []
  const frames = recording.frames.map((frame, index) => {
    const granted =
      frame.grant === null
        ? raceState
        : getRaceStateWithGrants(raceState, [{ racer: 0, ...frame.grant }])
    raceState = stepRace(
      granted,
      {
        controls: [getRacerControls(frame.input)],
        contacts: NO_RACE_CONTACTS,
        menu: getMenuInputWithRelease(frame, recording.frames[index - 1]),
      },
      frame.milliseconds
    ).raceState
    menuOpenFrames.push(raceState.pauseMenu.mode !== PauseMenuMode.NONE)
    return {
      frame: index,
      milliseconds: frame.milliseconds,
      fields: getTraceFields(raceState, recording.header.localPlayerCount),
    }
  })
  return { raceState, frames, menuOpenFrames }
}
