import { advanceFrameClock, createFrameClock } from './advance-frame-clock.ts'

describe('advanceFrameClock', () => {
  it('starts the clock on the first poll without a frame', () => {
    // Arrange
    const clock = createFrameClock()

    // Act
    const advance = advanceFrameClock(clock, 1000.7)

    // Assert
    expect(advance.frameMilliseconds).toBeNull()
    expect(advance.clock.lastMilliseconds).toBe(1000)
  })

  it('returns the whole milliseconds since the last frame', () => {
    // Arrange
    const clock = { lastMilliseconds: 1000 }

    // Act
    const advance = advanceFrameClock(clock, 1016.9)

    // Assert
    expect(advance.frameMilliseconds).toBe(16)
    expect(advance.clock.lastMilliseconds).toBe(1016)
  })

  it('waits when under 12 ms have passed and keeps measuring from the last frame', () => {
    // Arrange
    const clock = { lastMilliseconds: 1000 }

    // Act
    const early = advanceFrameClock(clock, 1011)
    const later = advanceFrameClock(early.clock, 1012)

    // Assert
    expect(early.frameMilliseconds).toBeNull()
    expect(early.clock).toBe(clock)
    expect(later.frameMilliseconds).toBe(12)
  })

  it('caps a long frame at 100 ms', () => {
    // Arrange
    const clock = { lastMilliseconds: 1000 }

    // Act
    const advance = advanceFrameClock(clock, 5000)

    // Assert
    expect(advance.frameMilliseconds).toBe(100)
    expect(advance.clock.lastMilliseconds).toBe(5000)
  })
})
