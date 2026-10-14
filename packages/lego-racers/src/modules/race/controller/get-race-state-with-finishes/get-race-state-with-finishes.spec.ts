import { createFixtureRacerSet } from '../../types/race-fixtures/race-fixtures.ts'
import type { RaceState } from '../../types/race.types.ts'
import { getRaceStateWithFinishes } from './get-race-state-with-finishes.ts'

describe('scripted finishes', () => {
  it('puts the racer on the last lap with the given lap times and leaves the others', () => {
    // Arrange
    const raceState = { lapCount: 3, racerSet: createFixtureRacerSet(2) } as unknown as RaceState

    // Act
    const finished = getRaceStateWithFinishes(raceState, [
      { frame: 0, racer: 1, lapMilliseconds: [30_000, 31_000] },
    ])

    // Assert
    expect(finished.racerSet.racers[1]?.currentLap).toBe(3)
    expect(finished.racerSet.racers[1]?.lapMilliseconds.slice(0, 3)).toEqual([30_000, 31_000, 0])
    expect(finished.racerSet.racers[0]).toBe(raceState.racerSet.racers[0])
  })
})
