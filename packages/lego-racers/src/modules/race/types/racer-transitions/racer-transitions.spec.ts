import type { Racer } from '../../../racer/index.ts'
import { createFixtureRacer } from '../race-fixtures/race-fixtures.ts'
import {
  convertRacerToComputer,
  enterZoneOne,
  enterZoneTwo,
  enterZoneZero,
  getRacerAfterCheckpointTouch,
  releaseRacerAtStart,
  resetRacerForRace,
} from './racer-transitions.ts'

const getRacer = (): Racer => createFixtureRacer()

const withZones = (current: number, previous: number, beforePrevious: number): Racer =>
  Object.freeze({
    ...getRacer(),
    zoneCurrent: current,
    zonePrevious: previous,
    zoneBeforePrevious: beforePrevious,
  })

describe('racer transitions', () => {
  it('resets a racer for the race: flag 0x2 set, no checkpoint, no lap, zones 0, 2, 1 (0x004374c0)', () => {
    // Arrange
    const racer = Object.freeze({ ...getRacer(), flags: 0x7400, checkpointIndex: 4, lap: 2 })

    // Act
    const reset = resetRacerForRace(racer)

    // Assert
    expect(reset).toMatchObject({
      flags: 0x402,
      checkpointIndex: -1,
      lap: -1,
      lapCrossings: -1,
      zoneCurrent: 0,
      zonePrevious: 2,
      zoneBeforePrevious: 1,
    })
  })

  it('clears flag 0x2 when the race starts (0x00439340)', () => {
    // Arrange
    const racer = Object.freeze({ ...getRacer(), flags: 0x2 })

    // Act
    const released = releaseRacerAtStart(racer)

    // Assert
    expect(released.flags).toBe(0)
  })

  it('counts a lap when the line is crossed from zone 0 after zones 2 and 1 (0x00439ba0)', () => {
    // Arrange
    const racer = Object.freeze({ ...withZones(0, 2, 1), lapCount: 3, lapCrossings: -1 })

    // Act
    const crossedOnce = enterZoneOne(racer, () => 0)
    const crossedTwice = enterZoneOne(
      Object.freeze({ ...crossedOnce, zoneCurrent: 0, zonePrevious: 2, zoneBeforePrevious: 1 }),
      () => 0
    )

    // Assert
    expect(crossedOnce).toMatchObject({ lapCrossings: 0, currentLap: 0, zoneCurrent: 1 })
    expect(crossedTwice).toMatchObject({ lapCrossings: 1, currentLap: 1, zoneCurrent: 1 })
  })

  it('does not count the line when the zones came in another order', () => {
    // Arrange
    const racer = withZones(2, 0, 1)

    // Act
    const entered = enterZoneOne(racer, () => 0)

    // Assert
    expect(entered).toMatchObject({ lapCrossings: -1, zoneCurrent: 1, zonePrevious: 2 })
  })

  it('shows the lap gap for 2,000 ms when a lap starts with a gap to show', () => {
    // Arrange
    const racer = Object.freeze({ ...withZones(0, 2, 1), lapCount: 3, lapCrossings: 0 })

    // Act
    const entered = enterZoneOne(racer, () => 5)

    // Assert
    expect(entered.unidentifiedCountdownD84Milliseconds).toBe(2000)
  })

  it('shifts the zone history on entering zones 0 and 2 and ignores the zone it is in', () => {
    // Arrange
    const racer = withZones(1, 0, 2)

    // Act
    const inZoneTwo = enterZoneTwo(racer)
    const inZoneZero = enterZoneZero(withZones(0, 1, 2))

    // Assert
    expect(inZoneTwo).toMatchObject({ zoneCurrent: 2, zonePrevious: 1, zoneBeforePrevious: 0 })
    expect(inZoneZero).toMatchObject({ zoneCurrent: 0, zonePrevious: 1 })
  })

  it('counts a lap at the start line going forward and takes it back after a backward crossing (0x00439fc0)', () => {
    // Arrange
    const racer = Object.freeze({ ...getRacer(), lap: 0 })

    // Act
    const forward = getRacerAfterCheckpointTouch(racer, 0, true, 1)
    const backward = getRacerAfterCheckpointTouch(forward, 0, true, 0)
    const next = getRacerAfterCheckpointTouch(backward, 1, false, 1)
    const touchedAgain = getRacerAfterCheckpointTouch(next, 1, false, 1)

    // Assert
    expect(forward).toMatchObject({ lap: 1, checkpointIndex: 0, checkpointSide: 1 })
    expect(backward).toMatchObject({ lap: 1, checkpointSide: 0 })
    expect(backward.flags & 0x80000).toBe(0x80000)
    expect(next).toMatchObject({ lap: 0, checkpointIndex: 1 })
    expect(next.flags & 0x80000).toBe(0)
    expect(touchedAgain).toBe(next)
  })

  it('turns a finished player into a computer racer, without a route marked as driverless (0x0043a0e0)', () => {
    // Arrange
    const racer = getRacer()

    // Act
    const converted = convertRacerToComputer(racer)

    // Assert
    expect(converted.controllerKind).toBe(2)
    expect(converted.driver.flags & 0x80).toBe(0x80)
  })
})
