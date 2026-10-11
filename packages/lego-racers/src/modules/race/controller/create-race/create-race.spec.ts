import { getRacer } from '../../../racer/index.ts'
import { RacePhase } from '../../types/race-phase/race-phase.ts'
import { createFixtureDefinition } from '../race-fixtures/race-fixtures.ts'
import { createRace } from './create-race.ts'

describe('createRace', () => {
  it('starts in the introduction with every racer held and reset for the race', () => {
    // Arrange
    const definition = createFixtureDefinition()

    // Act
    const state = createRace(definition)

    // Assert
    expect(state).toMatchObject({
      phase: RacePhase.INTRODUCTION,
      phaseMilliseconds: 0,
      isRunning: true,
      lapCount: 3,
      isMultiplayer: false,
      isDemonstration: false,
      playerRacerIndices: [0],
    })
    expect(getRacer(state.racerSet, 0)).toMatchObject({ flags: 0x2, lap: -1, controllerKind: 0 })
    expect(getRacer(state.racerSet, 1)).toMatchObject({ flags: 0x2, lap: -1, controllerKind: 2 })
  })

  it('starts every racer without a colour shift, as RacerSet_ResetRacers 0x0043a780 and the race teardown 0x00434000 leave it (0x004400e0)', () => {
    // Arrange
    const definition = createFixtureDefinition()

    // Act
    const state = createRace(definition)

    // Assert
    expect(state.racerSet.racers.map((racer) => racer.colourShift)).toEqual(
      state.racerSet.racers.map(() => null)
    )
  })

  it('draws three table values for each racer, in racer order (0x00436df0, then 0x0043d7a0)', () => {
    // Arrange
    const definition = createFixtureDefinition()

    // Act
    const state = createRace(definition)

    // Assert
    expect(getRacer(state.racerSet, 0).proximityCheckMilliseconds).toBe(1 * 8 + 2000)
    expect(getRacer(state.racerSet, 0).voiceMilliseconds).toBe(2 * 4 + 5000)
    expect(getRacer(state.racerSet, 1).proximityCheckMilliseconds).toBe(4 * 8 + 2000)
    expect(getRacer(state.racerSet, 1).voiceMilliseconds).toBe(5 * 4 + 5000)
  })

  it('gives each racer its place on the grid as the first race position (0x00436df0)', () => {
    // Arrange
    const definition = createFixtureDefinition()

    // Act
    const state = createRace(definition)

    // Assert
    expect(state.racerSet.racers.map((racer) => racer.racePosition)).toEqual([1, 2])
  })

  it('takes the voice base and the race mode flags of the racers from their description', () => {
    // Arrange
    const fixture = createFixtureDefinition()
    const definition = {
      ...fixture,
      raceModeFlags: 0x1 | 0x2 | 0x40 | 0x80,
      racers: fixture.racers.map((racer, index) => ({ ...racer, voiceBase: 1100 + index * 12 })),
    }

    // Act
    const state = createRace(definition)

    // Assert
    expect(getRacer(state.racerSet, 1)).toMatchObject({
      voiceBase: 1112,
      flags: 0x4000000 | 0x8000000 | 0x1000000 | 0x2000000 | 0x2,
    })
    expect(state.powerUpSetups[1]?.abilities).toEqual({
      isAlwaysGrapple: true,
      isAlwaysLevelThree: true,
      isPermanentTurbo: true,
    })
  })

  it('hands the driver preferred power-up to the computer power-up decision', () => {
    // Arrange
    const fixture = createFixtureDefinition()
    const definition = {
      ...fixture,
      racers: fixture.racers.map((racer) => ({
        ...racer,
        preferredPowerUpKind: 'turbo' as const,
        preferredPowerUpLevel: 2,
      })),
    }

    // Act
    const state = createRace(definition)

    // Assert
    expect(state.powerUpSetups[0]?.personality).toMatchObject({
      preferredKind: 'turbo',
      preferredLevel: 2,
    })
  })

  it('uses the multiplayer lap count when two players share the screen', () => {
    // Arrange
    const definition = { ...createFixtureDefinition(), localPlayerCount: 2, multiplayerLapCount: 5 }

    // Act
    const state = createRace(definition)

    // Assert
    expect(state).toMatchObject({ isMultiplayer: true, lapCount: 5 })
  })

  it('makes racer 0 a computer-driven demonstration racer when there are no players', () => {
    // Arrange
    const definition = { ...createFixtureDefinition(), localPlayerCount: 0 }

    // Act
    const state = createRace(definition)

    // Assert
    expect(state.isDemonstration).toBe(true)
    expect(getRacer(state.racerSet, 0).controllerKind).toBe(2)
    expect(getRacer(state.racerSet, 0).flags & 0x800000).toBe(0x800000)
  })

  it('sets the rubber band bias to 0.05 on a mirrored track', () => {
    // Arrange
    const definition = { ...createFixtureDefinition(), isMirrored: true }

    // Act
    const state = createRace(definition)

    // Assert
    expect(state.racerSet.rubberBand.bias).toBe(Math.fround(0.05))
  })
})
