import { createRandomTable } from '../../../random-table/index.ts'
import { createComputerTimers, updateComputerTaunt } from './computer-taunt.ts'

const TABLE = createRandomTable(Array.from({ length: 1024 }, (_, index) => index))

describe('computer timers', () => {
  it('draws the taunt timer (value * 8 + 2000) before the voice timer (value * 4 + 5000)', () => {
    // Arrange
    const position = 9

    // Act
    const timers = createComputerTimers(TABLE, position)

    // Assert
    expect(timers).toEqual({ position: 11, tauntMilliseconds: 2080, voiceMilliseconds: 5044 })
  })

  it('taunts when the timer runs out with a racer near ahead, else waits 2,000 ms', () => {
    // Arrange
    const position = 0

    // Act
    const counting = updateComputerTaunt(TABLE, position, 100, 40, true, true)
    const taunting = updateComputerTaunt(TABLE, position, 30, 40, true, true)
    const alone = updateComputerTaunt(TABLE, position, 30, 40, true, false)

    // Assert
    expect(counting).toEqual({ position: 0, tauntMilliseconds: 60, isTaunting: false })
    expect(taunting).toEqual({ position: 1, tauntMilliseconds: 2008, isTaunting: true })
    expect(alone).toEqual({ position: 0, tauntMilliseconds: 2000, isTaunting: false })
  })
})
