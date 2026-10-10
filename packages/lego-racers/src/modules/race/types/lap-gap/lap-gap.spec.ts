import { setRacer } from '../../../racer/index.ts'
import type { RacerSet } from '../../../racer/index.ts'
import { createFixtureRacerSet } from '../race-fixtures/race-fixtures.ts'
import { getLapGapMilliseconds } from './lap-gap.ts'

const getRacerSet = (laps: readonly (readonly number[])[], places: readonly number[]): RacerSet => {
  const base = createFixtureRacerSet(2)
  return base.racers.reduce(
    (racerSet, racer, index) =>
      setRacer(
        racerSet,
        index,
        Object.freeze({
          ...racer,
          currentLap: laps[index]?.length ?? 0,
          lapMilliseconds: laps[index] ?? [],
          racePosition: places[index] ?? 0,
        })
      ),
    base
  )
}

describe('getLapGapMilliseconds', () => {
  it('gives the leader no gap', () => {
    // Arrange
    const racerSet = getRacerSet([[1000], [1200]], [1, 2])

    // Act
    const gap = getLapGapMilliseconds(racerSet, 0, 3)

    // Assert
    expect(gap).toBe(0)
  })

  it('is how much slower the racer was over the laps both finished', () => {
    // Arrange
    const racerSet = getRacerSet([[1000], [1200]], [1, 2])

    // Act
    const gap = getLapGapMilliseconds(racerSet, 1, 3)

    // Assert
    expect(gap).toBe(200)
  })

  it('adds the laps the other racer has run beyond that', () => {
    // Arrange
    const racerSet = getRacerSet([[1000, 900], [1200]], [1, 2])

    // Act
    const gap = getLapGapMilliseconds(racerSet, 1, 3)

    // Assert
    expect(gap).toBe(1100)
  })
})
