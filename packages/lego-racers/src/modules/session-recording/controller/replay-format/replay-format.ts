import type { RaceMenuInput } from '../../../race/index.ts'
import type {
  ReplayFrame,
  ReplayGrant,
  ReplayHeader,
  SessionRecording,
} from '../../types/session-recording.types.ts'
import type { FrameLine } from './replay-format.types.ts'

export const REPLAY_FORMAT = 'lego-racers-session-replay'
export const REPLAY_VERSION = 1

// A frame without a menu key is the common one: it costs a null.
const getMenuLine = (menu: RaceMenuInput | null): FrameLine[3] =>
  menu === null ||
  (!menu.isPausePressed &&
    menu.selectionChange === 0 &&
    !menu.isConfirmPressed &&
    !menu.isConfirmReleased &&
    !menu.isAnyInputPressed)
    ? null
    : menu.isConfirmReleased
      ? [
          menu.isPausePressed,
          menu.selectionChange,
          menu.isConfirmPressed,
          menu.isAnyInputPressed,
          true,
        ]
      : [menu.isPausePressed, menu.selectionChange, menu.isConfirmPressed, menu.isAnyInputPressed]

const getFrameLine = (frame: ReplayFrame): FrameLine => [
  frame.milliseconds,
  [...frame.input.pressedKeyCodes].sort(),
  frame.input.gamepad === null
    ? null
    : [frame.input.gamepad.axes, frame.input.gamepad.pressedButtonIndices],
  getMenuLine(frame.menu),
  frame.grant === null ? null : [frame.grant.kind, frame.grant.level],
]

const getFrame = (line: FrameLine): ReplayFrame => {
  const [milliseconds, keyCodes, gamepad, menu, grant] = line
  const grantValue: ReplayGrant | null =
    grant === null ? null : Object.freeze({ kind: grant[0], level: grant[1] })
  return Object.freeze({
    milliseconds,
    input: Object.freeze({
      pressedKeyCodes: new Set(keyCodes),
      gamepad:
        gamepad === null
          ? null
          : Object.freeze({ axes: gamepad[0], pressedButtonIndices: gamepad[1] }),
    }),
    menu:
      menu === null
        ? null
        : Object.freeze({
            isPausePressed: menu[0],
            selectionChange: menu[1],
            isConfirmPressed: menu[2],
            isConfirmReleased: menu[4] === true,
            isAnyInputPressed: menu[3],
          }),
    grant: grantValue,
  })
}

// JSON lines: the header, then one line per frame.
export const serializeRecording = (recording: SessionRecording): string =>
  `${[JSON.stringify(recording.header), ...recording.frames.map((frame) => JSON.stringify(getFrameLine(frame)))].join('\n')}\n`

export const parseRecording = (text: string): SessionRecording => {
  const [headerText, ...frameTexts] = text.split('\n').filter((line) => line.length > 0)
  if (headerText === undefined) throw new Error('The recording is empty')
  const header = JSON.parse(headerText) as ReplayHeader
  if (header.format !== REPLAY_FORMAT || header.version !== REPLAY_VERSION) {
    throw new Error(`Not a version ${String(REPLAY_VERSION)} ${REPLAY_FORMAT} file`)
  }
  return Object.freeze({
    header,
    frames: frameTexts.map((frameText) => getFrame(JSON.parse(frameText) as FrameLine)),
  })
}
