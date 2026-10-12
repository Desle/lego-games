import { REPLAY_FORMAT, REPLAY_VERSION } from '../../../session-recording/index.ts'
import type { ReplayFrame, ReplayHeader } from '../../../session-recording/index.ts'
import { getReplayScenario, getReplayScenarioSplit } from './replay-scenario.ts'

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
  it('stops at the first developer grant', () => {
    // Arrange
    const recording = {
      header: HEADER,
      frames: [getFrame(), getFrame(), getFrame({ grant: { kind: 1, level: 0 } }), getFrame()],
    }

    // Act
    const split = getReplayScenarioSplit(recording)

    // Assert
    expect(split).toMatchObject({
      supportedFrameCount: 2,
      stopReason: 'a developer power-up grant',
    })
  })

  it('feeds a demonstration (no local player) to the original as one with no local player', () => {
    // Arrange
    const header = {
      ...HEADER,
      localPlayerCount: 0,
      raceFolder: 'RACEC0R1',
      racerCodes: ['aa', 'bb'],
    }
    const recording = { header, frames: [getFrame(), getFrame()] }

    // Act
    const split = getReplayScenarioSplit(recording)
    const scenario = getReplayScenario(recording, new Uint8Array(), 'demonstration')

    // Assert
    expect(split.supportedFrameCount).toBe(2)
    expect(scenario.localPlayerCount).toBe(0)
  })

  it('feeds every frame of a plain keyboard session', () => {
    // Arrange
    const recording = { header: HEADER, frames: [getFrame(), getFrame()] }

    // Act
    const split = getReplayScenarioSplit(recording)

    // Assert
    expect(split).toEqual({
      supportedFrameCount: 2,
      stopReason: null,
      controller: 'keyboard',
      menuKeyFrameCount: 0,
      gamepadFrameCount: 0,
    })
  })

  it('feeds pause-menu keys as taps and a gamepad in use as the joystick', () => {
    // Arrange
    const pad = { axes: [-0.4237], pressedButtonIndices: [0, 9] }
    const recording = {
      header: { ...HEADER, racerCodes: ['aa', 'bb'] },
      frames: [
        getFrame({ input: { pressedKeyCodes: new Set(), gamepad: pad } }),
        getFrame({
          input: { pressedKeyCodes: new Set(), gamepad: pad },
          menu: {
            isPausePressed: true,
            selectionChange: 0,
            isConfirmPressed: false,
            isAnyInputPressed: true,
          },
        }),
      ],
    }

    // Act
    const split = getReplayScenarioSplit(recording)
    const scenario = getReplayScenario(recording, new Uint8Array(), 'pad', [])

    // Assert
    expect(split).toMatchObject({
      controller: 'joystick',
      menuKeyFrameCount: 1,
      gamepadFrameCount: 2,
    })
    expect(scenario.frames[1]).toMatchObject({
      tappedScanCodes: [0x01],
      joystick: { axes: [-424, 0], buttonIndices: [0] },
    })
  })

  it('stops where a keyboard drives a gamepad session outside the menu', () => {
    // Arrange
    const pad = { axes: [0.5], pressedButtonIndices: [] }
    const recording = {
      header: HEADER,
      frames: [getFrame({ input: { pressedKeyCodes: new Set(), gamepad: pad } }), getFrame()],
    }

    // Act
    const split = getReplayScenarioSplit(recording)

    // Assert
    expect(split).toMatchObject({
      supportedFrameCount: 1,
      stopReason: 'a keyboard key driving a gamepad session',
    })
  })
})
