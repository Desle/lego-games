import {
  awardPlacePoints,
  createCircuitStandings,
  getCircuitResultScreen,
  getCircuitResultScreenNumber,
  getIsRacerEliminated,
  getStandingRank,
  getStandingTotal,
  resetRacePoints,
  resetStandings,
} from './standings.ts'

const getStandingsAfterPlaces = (places: readonly number[]) =>
  places.reduce(
    (standings, place, racerIndex) => awardPlacePoints(standings, racerIndex, place),
    createCircuitStandings()
  )

describe('circuit standings', () => {
  it('gives 30, 20, 10, 3, 2 and 1 points for the six places', () => {
    // Arrange
    const places = [0, 1, 2, 3, 4, 5]

    // Act
    const standings = getStandingsAfterPlaces(places)

    // Assert
    expect(standings.totals).toEqual([30, 20, 10, 3, 2, 1])
    expect(standings.racePoints).toEqual([30, 20, 10, 3, 2, 1])
  })

  it('adds the points of every race to the total and keeps the last race apart', () => {
    // Arrange
    const first = getStandingsAfterPlaces([1, 0, 2, 3, 4, 5])

    // Act
    const second = resetRacePoints(first)
    const third = awardPlacePoints(second, 0, 0)

    // Assert
    expect(second.racePoints).toEqual([0, 0, 0, 0, 0, 0])
    expect(third.totals[0]).toBe(50)
    expect(third.racePoints[0]).toBe(30)
    expect(getStandingTotal(third, 1)).toBe(30)
  })

  it('ranks a racer by how many others have more points, ties sharing a place', () => {
    // Arrange
    const standings = getStandingsAfterPlaces([2, 0, 0, 3, 4, 5])

    // Act
    const ranks = [0, 1, 2, 3, 4, 5].map((racer) => getStandingRank(standings, racer))

    // Assert
    expect(ranks).toEqual([2, 0, 0, 3, 4, 5])
  })

  it('clears everything on a restart', () => {
    // Arrange
    const standings = getStandingsAfterPlaces([0, 1, 2, 3, 4, 5])

    // Act
    const restarted = resetStandings()

    // Assert
    expect(standings).not.toEqual(restarted)
    expect(restarted).toEqual(createCircuitStandings())
  })

  it('refuses a seventh racer and a seventh place', () => {
    // Arrange
    const standings = createCircuitStandings()

    // Act
    const racer = () => awardPlacePoints(standings, 6, 0)
    const place = () => awardPlacePoints(standings, 0, 6)

    // Assert
    expect(racer).toThrow(RangeError)
    expect(place).toThrow(RangeError)
  })

  it('shows the trophy screens for the first three ranks and no place after', () => {
    // Arrange
    const ranks = [0, 1, 2, 3, 5]

    // Act
    const screens = ranks.map((rank) => getCircuitResultScreenNumber(getCircuitResultScreen(rank)))

    // Assert
    expect(screens).toEqual([0x16, 0x17, 0x18, 0x19, 0x19])
  })

  it('drops a lone player below 10 points per race already run', () => {
    // Arrange
    const standings = getStandingsAfterPlaces([3, 0, 1, 2, 4, 5])

    // Act
    const eliminated = [0, 1, 2].map((raceIndex) => getIsRacerEliminated(standings, 1, raceIndex))
    const isEliminatedWithFriend = getIsRacerEliminated(standings, 2, 2)

    // Assert
    expect(getStandingTotal(standings, 0)).toBe(3)
    expect(eliminated).toEqual([false, true, true])
    expect(isEliminatedWithFriend).toBe(false)
  })
})
