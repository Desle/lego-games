import { createReplayRecorder } from '../replay-recorder/replay-recorder.ts'
import type { ReplayFrame, ReplayHeader } from '../../types/session-recording.types.ts'
import {
  parseRecording,
  REPLAY_FORMAT,
  REPLAY_VERSION,
  serializeRecording,
} from './replay-format.ts'

const HEADER: ReplayHeader = {
  format: REPLAY_FORMAT,
  version: REPLAY_VERSION,
  raceFolder: 'RACEC0R0',
  circuitName: 'c1',
  racerCodes: null,
  racerCount: 6,
  localPlayerCount: 1,
  raceModeFlags: 0,
  randomPosition: 7,
  isMirrored: false,
  multiplayerLapCount: 3,
  isPointsRecordPresent: false,
  isCountdownSkipped: false,
  playerCars: [],
  playerRacers: [],
}

const getFrame = (overrides: Partial<ReplayFrame> = {}): ReplayFrame => ({
  milliseconds: 33,
  input: { pressedKeyCodes: new Set(['ArrowUp', 'ArrowLeft']), gamepad: null },
  menu: null,
  grant: null,
  ...overrides,
})

describe('the session recording format', () => {
  it('reads back what it wrote, frame for frame', () => {
    // Arrange
    const recorder = createReplayRecorder(HEADER)
    recorder.addFrame(getFrame())
    recorder.addFrame(
      getFrame({
        input: {
          pressedKeyCodes: new Set(),
          gamepad: { axes: [0.5, -1], pressedButtonIndices: [2] },
        },
        menu: {
          isPausePressed: true,
          selectionChange: -1,
          isConfirmPressed: false,
          isConfirmReleased: false,
          isAnyInputPressed: true,
        },
        grant: { kind: 3, level: 2 },
      })
    )

    // Act
    const text = serializeRecording(recorder.finish())
    const parsed = parseRecording(text)

    // Assert
    expect(parsed.header).toEqual(HEADER)
    expect(parsed.frames).toEqual(recorder.finish().frames)
    expect(serializeRecording(parsed)).toBe(text)
  })

  it('refuses a file that is not a recording', () => {
    // Arrange
    const text = '{"format":"other","version":1}\n'

    // Act
    const parse = () => parseRecording(text)

    // Assert
    expect(parse).toThrow(/Not a version/)
  })
})
