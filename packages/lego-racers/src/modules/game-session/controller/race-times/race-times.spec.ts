import type { RaceTimeRecord } from '../../types/game-session.types.ts'
import { recordRaceTimes } from './race-times.ts'

const NO_RECORD: RaceTimeRecord = {
  bestLapMilliseconds: 0,
  bestLapRacerIndex: 0,
  bestRaceMilliseconds: 0,
  bestRaceRacerIndex: 0,
}

const getRaceWithLaps = (lapMilliseconds: readonly number[], currentLap: number) =>
  [{ lapCount: 3, currentLap, lapMilliseconds }] as const

describe('recordRaceTimes', () => {
  it('keeps the fastest lap and the total of a human who finished all laps', () => {
    // Arrange
    const race = getRaceWithLaps([31000, 29500, 30500, 0, 0], 3)

    // Act
    const record = recordRaceTimes(NO_RECORD, race, [0])

    // Assert
    expect(record).toEqual({
      bestLapMilliseconds: 29500,
      bestLapRacerIndex: 0,
      bestRaceMilliseconds: 91000,
      bestRaceRacerIndex: 0,
    })
  })

  it('ignores a human who has not finished all laps', () => {
    // Arrange
    const unfinished = getRaceWithLaps([31000, 29500, 100, 0, 0], 2)

    // Act
    const record = recordRaceTimes(NO_RECORD, unfinished, [0])

    // Assert
    expect(record).toEqual(NO_RECORD)
  })

  it('replaces a stored time only with one that is not larger', () => {
    // Arrange
    const stored: RaceTimeRecord = {
      bestLapMilliseconds: 29500,
      bestLapRacerIndex: 3,
      bestRaceMilliseconds: 90000,
      bestRaceRacerIndex: 3,
    }

    // Act
    const equalLap = recordRaceTimes(stored, getRaceWithLaps([29500, 31000, 31000, 0, 0], 3), [0])
    const slower = recordRaceTimes(stored, getRaceWithLaps([31000, 31000, 31000, 0, 0], 3), [0])

    // Assert
    expect(equalLap.bestLapMilliseconds).toBe(29500)
    expect(equalLap.bestLapRacerIndex).toBe(0)
    expect(equalLap.bestRaceMilliseconds).toBe(90000)
    expect(equalLap.bestRaceRacerIndex).toBe(3)
    expect(slower).toEqual(stored)
  })
})
