import { createFixtureRace } from '../race-fixtures/race-fixtures.ts'
import { getRaceRacerSet, NO_RACE_CONTACTS } from '../race-world/race-world.ts'
import {
  getProjectileRegistrySphere,
  getRacerSetWithProjectileRegistry,
} from './projectile-registry.ts'

describe('getRacerSetWithProjectileRegistry', () => {
  it('registers nothing while no effect or explosion is live', () => {
    // Arrange
    const race = createFixtureRace()
    const racerSet = getRaceRacerSet(race, NO_RACE_CONTACTS)

    // Act
    const registered = getRacerSetWithProjectileRegistry(race.context.arithmetic, racerSet)

    // Assert
    expect(registered).toBe(racerSet)
  })
})

describe('getProjectileRegistrySphere', () => {
  it('answers the origin for an effect that has no body', () => {
    // Arrange
    const race = createFixtureRace()
    const racerSet = getRaceRacerSet(race, NO_RACE_CONTACTS)

    // Act
    const sphere = getProjectileRegistrySphere(racerSet, { type: 'effect_flight', effectId: 0 })

    // Assert
    expect(sphere.radius).toBe(0)
  })
})
