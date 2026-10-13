import { getRaceGaps } from './get-race-gaps.ts'
import type { RaceGapRacer } from './get-race-gaps.types.ts'

const getRacer = (currentLap: number, lapMilliseconds: readonly number[]): RaceGapRacer => ({
  currentLap,
  lapMilliseconds,
  racePosition: 4,
})

describe('race gaps', () => {
  it('gives each racer its time behind the given racer, and a still racing one its position plus the bias', () => {
    // Arrange
    const racers = [getRacer(3, [10, 10, 10]), getRacer(3, [12, 10, 10]), getRacer(1, [0, 0, 0])]

    // Act
    const gaps = getRaceGaps(racers, 3, 0)

    // Assert
    expect(gaps.slice(0, 3)).toEqual([
      { racerIndex: 0, gapMilliseconds: 0, isSet: true },
      { racerIndex: 1, gapMilliseconds: 2, isSet: true },
      { racerIndex: 2, gapMilliseconds: 0x7ffffffd, isSet: true },
    ])
    expect(gaps).toHaveLength(6)
  })

  it('clears the racers entries while the given racer is still on its laps', () => {
    // Arrange
    const racers = [getRacer(2, [10, 10, 10]), getRacer(3, [12, 10, 10])]

    // Act
    const gaps = getRaceGaps(racers, 3, 0)

    // Assert
    expect(gaps.every((gap) => gap.racerIndex === null && !gap.isSet)).toBe(true)
  })
})
