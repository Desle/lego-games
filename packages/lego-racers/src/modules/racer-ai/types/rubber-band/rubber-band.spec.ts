import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { CAR_BODY_PUSHED_FLAG } from '../computer-speed/computer-speed.ts'
import { createRubberBand, getRacerProgress, stepRubberBand } from './rubber-band.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const SPEED = Object.freeze({
  flags: 0,
  speedFactor: 1,
  targetSpeedFactor: 1,
  defaultTargetSpeedFactor: 1,
})
const createRacer = (isComputer: boolean, lap: number, checkpointProgress: number | null) =>
  Object.freeze({ isComputer, isExempt: false, lap, checkpointProgress, speed: SPEED })

describe('stepRubberBand', () => {
  it('only counts down during the first 15,000 ms', () => {
    // Arrange
    const rubberBand = createRubberBand(0)

    // Act
    const step = stepRubberBand(SINGLE, rubberBand, [createRacer(false, 0, 0.5)], 15000)

    // Assert
    expect(step.rubberBand.countdownMilliseconds).toBe(0)
    expect(step.speeds).toEqual([SPEED])
  })

  it('slows racers ahead of the leading player and speeds up racers behind, skipping racer 0', () => {
    // Arrange
    const rubberBand = { countdownMilliseconds: 0, bias: Math.fround(0.05) }
    const racers = [
      createRacer(true, 9, 0.9),
      createRacer(false, 1, 0.5),
      createRacer(true, 2, 0.1),
      createRacer(true, 0, 0.9),
      { ...createRacer(true, 0, 0.1), speed: { ...SPEED, flags: CAR_BODY_PUSHED_FLAG } },
    ]

    // Act
    const step = stepRubberBand(SINGLE, rubberBand, racers, 16)

    // Assert
    const ahead = Math.fround(Math.fround(1 - Math.fround(0.05)) + Math.fround(0.05))
    const behind = Math.fround(Math.fround(Math.fround(0.05) + Math.fround(0.05)) + 1)
    expect(step.speeds[0]).toBe(SPEED)
    expect(step.speeds[1]).toBe(SPEED)
    expect(step.speeds[2]).toEqual({
      ...SPEED,
      targetSpeedFactor: ahead,
      defaultTargetSpeedFactor: ahead,
    })
    expect(step.speeds[3]).toEqual({
      ...SPEED,
      targetSpeedFactor: behind,
      defaultTargetSpeedFactor: behind,
    })
    expect(step.speeds[4]?.targetSpeedFactor).toBe(1)
    expect(step.speeds[4]?.defaultTargetSpeedFactor).toBe(behind)
  })

  it('resets every target to 1.0 when no player has progress above -1', () => {
    // Arrange
    const rubberBand = { countdownMilliseconds: 0, bias: 0 }
    const changed = { ...SPEED, targetSpeedFactor: 2, defaultTargetSpeedFactor: 2 }
    const racers = [{ ...createRacer(true, 0, 0.5), speed: changed }]

    // Act
    const step = stepRubberBand(SINGLE, rubberBand, racers, 16)

    // Assert
    expect(step.speeds[0]).toEqual(SPEED)
  })

  it('measures progress as lap plus checkpoint progress, 0 without a checkpoint', () => {
    // Arrange
    const lap = 2

    // Act
    const progress = getRacerProgress(SINGLE, lap, 0.25)
    const none = getRacerProgress(SINGLE, lap, null)

    // Assert
    expect(progress).toBe(2.25)
    expect(none).toBe(0)
  })
})
