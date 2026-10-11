import type { ForceFeedbackEffect } from '../racer.types.ts'
import { getRestartedForceFeedback } from './force-feedback.ts'

const effect: ForceFeedbackEffect = {
  isPresent: true,
  strength: 7,
  duration: 9,
  phase: 5,
  state: 0,
  elapsed: 11,
}

describe('getRestartedForceFeedback', () => {
  it('restarts a present device with the given strength (0x004220e0, 0x00422100, 0x00421f30)', () => {
    // Arrange
    const strength = 150

    // Act
    const restarted = getRestartedForceFeedback(effect, strength)

    // Assert
    expect(restarted).toEqual({
      isPresent: true,
      strength: 150,
      duration: 150,
      phase: 0,
      state: 2,
      elapsed: 0,
    })
  })

  it('leaves a missing device alone', () => {
    // Arrange
    const missing = { ...effect, isPresent: false }

    // Act
    const restarted = getRestartedForceFeedback(missing, 150)

    // Assert
    expect(restarted).toBe(missing)
  })
})
