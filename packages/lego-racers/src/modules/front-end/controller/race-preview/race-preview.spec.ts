import {
  advanceRacePreviewClock,
  createRacePreviewClock,
  restartBestTimeClock,
} from './race-preview.ts'

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
    expect(clock).toEqual({
      remainingMilliseconds: 2000,
      cycleCount: 0,
      cinemaMilliseconds: 66,
      bestTimeRemainingMilliseconds: 2434,
      isBestLapShown: true,
    })
  })

  it('swaps the best lap and race times when a frame outlasts the 2,500 ms countdown (0x00488150)', () => {
    // Arrange
    const frames = Array.from({ length: 76 }, () => 33)

    // Act
    const clocks = frames.map((_, index) =>
      frames
        .slice(0, index + 1)
        .reduce(
          (current, frame) => advanceRacePreviewClock(current, frame, false),
          createRacePreviewClock()
        )
    )

    // Assert
    expect(clocks[74]?.isBestLapShown).toBe(true)
    expect(clocks[75]?.isBestLapShown).toBe(false)
    expect(clocks[75]?.bestTimeRemainingMilliseconds).toBe(2500)
  })

  it('shows the lap time first again, with a full countdown, when the race changes (0x00488010)', () => {
    // Arrange
    const swapped = Array.from({ length: 76 }, () => 33).reduce(
      (current, frame) => advanceRacePreviewClock(current, frame, false),
      createRacePreviewClock()
    )

    // Act
    const restarted = restartBestTimeClock(swapped)

    // Assert
    expect(swapped.isBestLapShown).toBe(false)
    expect(restarted.isBestLapShown).toBe(true)
    expect(restarted.bestTimeRemainingMilliseconds).toBe(2500)
    expect(restarted.cinemaMilliseconds).toBe(swapped.cinemaMilliseconds)
  })
})
