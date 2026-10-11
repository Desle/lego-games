import { RaceBinding } from '../../../race-input/index.ts'
import {
  createTraceScenario,
  getIdleFrames,
  getSteeringSweepFrames,
  holdBindings,
} from './trace-scenarios.ts'

const LEFT_ARROW_SCAN_CODE = 0xcb
const UP_ARROW_SCAN_CODE = 0xc8

describe('trace scenarios', () => {
  it('holds the DirectInput scan codes of the default bindings', () => {
    // Arrange
    const bindings = [RaceBinding.ACCELERATE, RaceBinding.STEER_POSITIVE]

    // Act
    const frames = holdBindings(2, bindings, 40)

    // Assert
    expect(frames).toEqual([
      { milliseconds: 40, scanCodes: [UP_ARROW_SCAN_CODE, LEFT_ARROW_SCAN_CODE] },
      { milliseconds: 40, scanCodes: [UP_ARROW_SCAN_CODE, LEFT_ARROW_SCAN_CODE] },
    ])
  })

  it('leaves the racers released before the sweep starts to steer', () => {
    // Arrange
    const idleCount = getIdleFrames(175).length

    // Act
    const frames = getSteeringSweepFrames()

    // Assert
    expect(frames.slice(0, idleCount).every((frame) => frame.scanCodes.length === 0)).toBe(true)
    expect(frames.some((frame) => frame.scanCodes.includes(LEFT_ARROW_SCAN_CODE))).toBe(true)
  })

  it('builds a scenario with one local player and the race clock the original uses', () => {
    // Arrange
    const codes = ['KK', 'IL', 'RK']

    // Act
    const scenario = createTraceScenario({
      name: 'example',
      raceFolder: 'RACEC0R0',
      racerCodes: codes,
      frames: getIdleFrames(3),
    })

    // Assert
    expect(scenario.localPlayerCount).toBe(1)
    expect(scenario.racerCount).toBe(3)
    expect(scenario.precision).toBe('auto')
    expect(scenario.frames).toHaveLength(3)
  })
})
