import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { stepRaceSubStepNotYetPorted, updateRacePhysics } from './update-race-physics.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

describe('updateRacePhysics', () => {
  it('runs one physics sub-step per piece of the scaled frame time, in order', () => {
    // Arrange
    const recordSubStep = (steps: readonly number[], step: number): readonly number[] => [
      ...steps,
      step,
    ]

    // Act
    const steps = updateRacePhysics(
      SINGLE,
      [],
      { frameDeltaMilliseconds: 100, isTimeScaled: true },
      recordSubStep
    )

    // Assert
    expect(steps).toEqual([40, 40, 40, 40, 15])
  })

  it('leaves the state unchanged with the not yet ported sub-step', () => {
    // Arrange
    const state = { racers: [] }

    // Act
    const result = updateRacePhysics(
      SINGLE,
      state,
      { frameDeltaMilliseconds: 30, isTimeScaled: false },
      stepRaceSubStepNotYetPorted
    )

    // Assert
    expect(result).toBe(state)
  })
})
