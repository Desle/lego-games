import { getRacer } from '../../../racer/index.ts'
import { createFixtureRace } from '../race-fixtures/race-fixtures.ts'
import {
  getFlightRacer,
  getRaceRacerSet,
  getRacerSetAfterProjectileEvents,
  NO_RACE_CONTACTS,
} from './race-world.ts'

describe('projectile events on racers', () => {
  it('sets the tumbling flag when a projectile starts a racer tumbling (0x00439570)', () => {
    // Arrange
    const racerSet = getRaceRacerSet(createFixtureRace(), NO_RACE_CONTACTS)

    // Act
    const changed = getRacerSetAfterProjectileEvents(racerSet, [
      { type: 'projectiles.racer_tumbling_started', racer: 1 },
    ])

    // Assert
    expect(getRacer(changed, 1).flags & 0x8).toBe(0x8)
    expect(getRacer(changed, 0).flags & 0x8).toBe(0)
  })

  it('reports no route node for a racer that has touched no checkpoint', () => {
    // Arrange
    const racerSet = getRaceRacerSet(createFixtureRace(), NO_RACE_CONTACTS)

    // Act
    const flightRacer = getFlightRacer(getRacer(racerSet, 0))

    // Assert
    expect(flightRacer.routeNodeIndex).toBeNull()
    expect(flightRacer.isVehiclePresent).toBe(false)
  })
})
