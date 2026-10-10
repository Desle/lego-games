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

  it('draws two table values for each racer, in racer order (0x00436df0)', () => {
    // Arrange
    const definition = createFixtureDefinition()

    // Act
    const state = createRace(definition)

    // Assert
    expect(getRacer(state.racerSet, 0).proximityCheckMilliseconds).toBe(1 * 8 + 2000)
    expect(getRacer(state.racerSet, 0).voiceMilliseconds).toBe(2 * 4 + 5000)
    expect(getRacer(state.racerSet, 1).proximityCheckMilliseconds).toBe(3 * 8 + 2000)
    expect(getRacer(state.racerSet, 1).voiceMilliseconds).toBe(4 * 4 + 5000)
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
