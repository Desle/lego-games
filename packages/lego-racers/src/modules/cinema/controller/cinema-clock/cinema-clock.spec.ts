import type { Cinema } from '../../types/cinema.types.ts'
import {
  CINEMA_CLOCK_START,
  getCinemaClock,
  getIsCinemaFinished,
  getIsCinemaSkippedByKey,
  stepCinemaClock,
} from './cinema-clock.ts'

// CIRCUIT1\CIR1-01: 490 frames at 30 frames per second.
const cinema: Cinema = {
  name: 'cir1-01',
  lengthFrames: 490,
  framesPerSecond: 30,
  objects: [],
  actions: [],
  dummies: [],
  ambientLights: [],
  directionalLights: [],
}

describe('cinema clock', () => {
  it('lands on the same frame in one step as in many steps of the same total', () => {
    // Arrange
    const steps = [33, 17, 50, 1, 99, 33, 40]
    const total = steps.reduce((sum, step) => sum + step, 0)

    // Act
    const stepped = steps.reduce(
      (clock, milliseconds) => stepCinemaClock(clock, cinema, milliseconds),
      CINEMA_CLOCK_START
    )

    // Assert
    expect(stepped).toEqual(getCinemaClock(cinema, total))
  })

  it('stops at the end and keeps the last frame', () => {
    // Arrange
    const before = getCinemaClock(cinema, 16_302)

    // Act
    const ended = stepCinemaClock(before, cinema, 33)
    const after = stepCinemaClock(ended, cinema, 33)

    // Assert
    expect(before).toEqual({ frame: 489, frameMilliseconds: 489_060, isAtEnd: false })
    expect(ended).toEqual({ ...before, isAtEnd: true })
    expect(after).toBe(ended)
  })

  it('finishes in the update after the one that reached the length', () => {
    // Arrange
    const thirtyThreeMillisecondFrames = (count: number) => count * 33

    // Act
    const isFinishedAfter494 = getIsCinemaFinished(cinema, thirtyThreeMillisecondFrames(494))
    const isFinishedAfter495 = getIsCinemaFinished(cinema, thirtyThreeMillisecondFrames(495))

    // Assert
    expect(isFinishedAfter494).toBe(false)
    expect(isFinishedAfter495).toBe(true)
  })

  it('lets a key end the cinema from its thirtieth frame, one second in', () => {
    // Arrange
    const justBefore = 999
    const atOneSecond = 1000

    // Act
    const isSkippedBefore = getIsCinemaSkippedByKey(cinema, justBefore)
    const isSkippedAt = getIsCinemaSkippedByKey(cinema, atOneSecond)

    // Assert
    expect(isSkippedBefore).toBe(false)
    expect(isSkippedAt).toBe(true)
  })
})
