import { advanceRacePreviewClock, createRacePreviewClock } from './race-preview.ts'

describe('advanceRacePreviewClock', () => {
  it('switches to the next race every 61 frames of 33 ms and restarts the cinema', () => {
    // Arrange
    const frames = Array.from({ length: 61 }, () => 33)

    // Act
    const clock = frames.reduce(
      (current, frame) => advanceRacePreviewClock(current, frame, true),
      createRacePreviewClock()
    )

    // Assert
    expect(clock.cycleCount).toBe(1)
    expect(clock.cinemaMilliseconds).toBe(0)
    expect(clock.remainingMilliseconds).toBe(2000)
  })

  it('advances only the cinema when the screen does not cycle', () => {
    // Arrange
    const start = createRacePreviewClock()

    // Act
    const clock = advanceRacePreviewClock(advanceRacePreviewClock(start, 33, false), 33, false)

    // Assert
    expect(clock).toEqual({ remainingMilliseconds: 2000, cycleCount: 0, cinemaMilliseconds: 66 })
  })
})
