import {
  chooseComputerRacerRoute,
  countComputerRacerRouteVariants,
  getComputerRacerRouteFileName,
  getFallbackComputerRacerRouteFileNames,
} from './choose-computer-racer-route.ts'

describe('getComputerRacerRouteFileName', () => {
  it('builds the binary and text names', () => {
    // Arrange
    const racerIndex = 3

    // Act
    const names = [
      getComputerRacerRouteFileName(racerIndex, 'm', 2, true),
      getComputerRacerRouteFileName(racerIndex, 'm', 2, false),
    ]

    // Assert
    expect(names).toEqual(['r3_m_2.rrb', 'r3_m_2.rrf'])
  })
})

describe('countComputerRacerRouteVariants', () => {
  it('counts the variants present from zero upwards for each letter', () => {
    // Arrange
    const present = new Set(['r1_f_0.rrb', 'r1_f_1.rrb', 'r1_f_3.rrb', 'r1_s_0.rrb'])

    // Act
    const counts = countComputerRacerRouteVariants(1, true, (name) => present.has(name))

    // Assert
    expect(counts).toEqual({ f: 2, m: 0, s: 1 })
  })

  it('stops counting a letter at ten', () => {
    // Arrange
    const getIsFilePresent = () => true

    // Act
    const counts = countComputerRacerRouteVariants(0, true, getIsFilePresent)

    // Assert
    expect(counts).toEqual({ f: 10, m: 10, s: 10 })
  })
})

describe('chooseComputerRacerRoute', () => {
  it('maps the random value modulo the total onto the letters in f, m, s order', () => {
    // Arrange
    const counts = { f: 2, m: 3, s: 1 }

    // Act
    const choices = [0, 1, 2, 4, 5, 6].map((value) => chooseComputerRacerRoute(counts, () => value))

    // Assert
    expect(choices).toEqual([
      { letter: 'f', variant: 0 },
      { letter: 'f', variant: 1 },
      { letter: 'm', variant: 0 },
      { letter: 'm', variant: 2 },
      { letter: 's', variant: 0 },
      { letter: 'f', variant: 0 },
    ])
  })

  it('draws no random value when there is no variant', () => {
    // Arrange
    const drawRandomValue = vi.fn(() => 0)

    // Act
    const choice = chooseComputerRacerRoute({ f: 0, m: 0, s: 0 }, drawRandomValue)

    // Assert
    expect(choice).toBeNull()
    expect(drawRandomValue).not.toHaveBeenCalled()
  })
})

describe('getFallbackComputerRacerRouteFileNames', () => {
  it('lists racer 1 variant 0 of each letter', () => {
    // Arrange
    const isJamArchive = true

    // Act
    const names = getFallbackComputerRacerRouteFileNames(isJamArchive)

    // Assert
    expect(names).toEqual(['r1_f_0.rrb', 'r1_m_0.rrb', 'r1_s_0.rrb'])
  })
})
