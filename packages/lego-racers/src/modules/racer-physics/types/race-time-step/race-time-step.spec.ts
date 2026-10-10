import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { getPhysicsSubSteps, getRaceTimeStep } from './race-time-step.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

describe('getRaceTimeStep', () => {
  it('passes the frame time through when the time scale flag is off', () => {
    // Arrange
    const input = { frameDeltaMilliseconds: 100, isTimeScaled: false }

    // Act
    const timeStep = getRaceTimeStep(SINGLE, input)

    // Assert
    expect(timeStep).toBe(100)
  })

  it('multiplies by 1.75 when settings flag 0x100 is set', () => {
    // Arrange
    const input = { frameDeltaMilliseconds: 100, isTimeScaled: true }

    // Act
    const timeStep = getRaceTimeStep(SINGLE, input)

    // Assert
    expect(timeStep).toBe(175)
  })

  it('truncates the scaled time like _ftol', () => {
    // Arrange: 13 · 1.75 = 22.75.
    const input = { frameDeltaMilliseconds: 13, isTimeScaled: true }

    // Act
    const timeStep = getRaceTimeStep(SINGLE, input)

    // Assert
    expect(timeStep).toBe(22)
  })
})

describe('getPhysicsSubSteps', () => {
  it('splits 100 ms into 40, 40 and 20', () => {
    // Arrange
    const timeStep = 100

    // Act
    const subSteps = getPhysicsSubSteps(timeStep)

    // Assert
    expect(subSteps).toEqual([40, 40, 20])
  })

  it('splits a scaled 175 ms into four 40 ms steps and 15', () => {
    // Arrange
    const timeStep = 175

    // Act
    const subSteps = getPhysicsSubSteps(timeStep)

    // Assert
    expect(subSteps).toEqual([40, 40, 40, 40, 15])
  })

  it('runs exactly 40 ms as one step and 41 ms as 40 and 1', () => {
    // Arrange
    const timeSteps = [40, 41, 80]

    // Act
    const subSteps = timeSteps.map(getPhysicsSubSteps)

    // Assert
    expect(subSteps).toEqual([[40], [40, 1], [40, 40]])
  })

  it('runs no step for 0 ms', () => {
    // Arrange
    const timeStep = 0

    // Act
    const subSteps = getPhysicsSubSteps(timeStep)

    // Assert
    expect(subSteps).toEqual([])
  })
})
