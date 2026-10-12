import { REPLAY_FORMAT, REPLAY_VERSION } from '../../../session-recording/index.ts'
import type { ReplayFrame, ReplayHeader } from '../../../session-recording/index.ts'
import { getReplayScenarioSplit } from './replay-scenario.ts'

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

describe('the frames the original can be fed', () => {
  it('stops at the first menu key, gamepad frame or grant', () => {
    // Arrange
    const recording = {
      header: HEADER,
      frames: [getFrame(), getFrame(), getFrame({ grant: { kind: 1, level: 0 } }), getFrame()],
    }

    // Act
    const split = getReplayScenarioSplit(recording)

    // Assert
    expect(split).toEqual({ supportedFrameCount: 2, stopReason: 'a developer power-up grant' })
  })

  it('feeds every frame of a plain keyboard session', () => {
    // Arrange
    const recording = { header: HEADER, frames: [getFrame(), getFrame()] }

    // Act
    const split = getReplayScenarioSplit(recording)

    // Assert
    expect(split).toEqual({ supportedFrameCount: 2, stopReason: null })
  })
})
