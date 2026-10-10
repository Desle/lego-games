import { createTestContext, createTestRacerSet } from '../../types/racer-fixtures/racer-fixtures.ts'
import { getRacer, setRacer } from '../../types/racer-state/racer-state.ts'
import type { ForceFeedbackEffect } from '../../types/racer.types.ts'
import { notifyRacerContact } from './notify-racer-contact.ts'

const createFeedback = (change: Partial<ForceFeedbackEffect>): ForceFeedbackEffect => ({
  isPresent: true,
  strength: 7,
  duration: 9,
  phase: 5,
  state: 0,
  elapsed: 11,
  ...change,
})

const notify = (feedback: ForceFeedbackEffect) => {
  const racerSet = createTestRacerSet(1)
  const prepared = setRacer(racerSet, 0, { ...getRacer(racerSet, 0), forceFeedback: feedback })
  return getRacer(notifyRacerContact(createTestContext(), prepared, 0, 16), 0).forceFeedback
}

describe('notifyRacerContact, 0x00422100', () => {
  it('restarts an idle effect with strength 100', () => {
    // Arrange
    const feedback = createFeedback({})

    // Act
    const notified = notify(feedback)

    // Assert
    expect(notified).toEqual({
      isPresent: true,
      strength: 100,
      duration: 100,
      phase: 0,
      state: 2,
      elapsed: 0,
    })
  })

  it('leaves an effect that is already restarting or has no device', () => {
    // Arrange
    const running = createFeedback({ state: 2 })
    const missing = createFeedback({ isPresent: false })

    // Act
    const notifiedRunning = notify(running)
    const notifiedMissing = notify(missing)

    // Assert
    expect(notifiedRunning).toEqual(running)
    expect(notifiedMissing).toEqual(missing)
  })
})
