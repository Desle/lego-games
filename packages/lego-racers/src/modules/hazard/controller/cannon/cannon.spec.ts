import { BallisticFlightState } from '../../../projectiles/index.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import { createTestSession } from '../hazard-fixtures/hazard-fixtures.ts'
import { CANNON, CANNON_BATTERY, CANNON_FIRED_SIGNAL, CANNON_LANDED_SIGNAL } from './cannon.ts'

const block = {
  firstVector: [0, 0, 100] as const,
  secondVector: [300, 0, 0] as const,
  thirdVector: [10, 20, 30] as const,
  squaredFloat: 25,
  integer: 40,
}

const createCannon = (draws: readonly number[] = []) => {
  const test = createTestSession({ draws })
  const loaded = CANNON.create(
    { keyword: 0x33, ...block },
    { isMirrored: false, session: test.session }
  )
  return { test, loaded }
}

describe('the cannon', () => {
  it('fires the ball when a signal with its number comes from near enough', () => {
    // Arrange
    const { test, loaded } = createCannon()

    // Act
    const near = CANNON.onSignalStarted(loaded, test.session, 40, [12, 20, 30])
    const far = CANNON.onSignalStarted(loaded, test.session, 40, [100, 20, 30])
    const other = CANNON.onSignalStarted(loaded, test.session, 41, null)

    // Assert
    expect(near.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(near.data).toMatchObject({ flight: { state: BallisticFlightState.FLYING } })
    expect(far).toBe(loaded)
    expect(other).toBe(loaded)
    expect(test.calls).toEqual([
      `startStop ${String(CANNON_FIRED_SIGNAL)} ${String(CANNON_FIRED_SIGNAL)}`,
    ])
  })

  it('fires for a signal without a position and ignores a signal while it is busy', () => {
    // Arrange
    const { test, loaded } = createCannon()
    const busy = CANNON.onSignalStarted(loaded, test.session, 40, null)

    // Act
    const again = CANNON.onSignalStarted(busy, test.session, 40, null)

    // Assert
    expect(busy.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(again).toBe(busy)
    expect(test.calls).toHaveLength(1)
  })

  it('starts an explosion where the ball lands, tells the events and goes idle', () => {
    // Arrange
    const landing = { point: { x: 290, y: 1, z: 2 }, normal: { x: 0, y: 0, z: 1 } }
    const test = createTestSession({ probe: () => landing })
    const loaded = CANNON.create(
      { keyword: 0x33, ...block },
      { isMirrored: false, session: test.session }
    )
    const fired = CANNON.begin(loaded, test.session, null)

    // Act
    const landed = CANNON.update(fired, test.session, 100)

    // Assert
    expect(landed.lifecycle).toBe(HazardLifecycle.IDLE)
    expect(test.effects).toEqual([
      { type: 'hazard.explosion_started', keyword: 0x33, position: [290, 1, 2] },
    ])
    expect(test.calls).toContain(
      `startStop ${String(CANNON_LANDED_SIGNAL)} ${String(CANNON_LANDED_SIGNAL)}`
    )
  })

  it('flies on while nothing is hit', () => {
    // Arrange
    const { test, loaded } = createCannon()
    const fired = CANNON.begin(loaded, test.session, null)

    // Act
    const flying = CANNON.update(fired, test.session, 100)

    // Assert
    expect(flying.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(flying.data).toMatchObject({ flight: { elapsedMilliseconds: 100 } })
    expect(test.effects).toEqual([])
  })
})

describe('the cannon battery', () => {
  it('draws the point it fires from and the point it aims at, and announces their signals', () => {
    // Arrange
    const test = createTestSession({ draws: [3, 5] })
    const loaded = CANNON_BATTERY.create(
      {
        keyword: 0x3d,
        points: [
          { position: [1, 1, 1], integer: 10 },
          { position: [2, 2, 2], integer: 11 },
        ],
        secondPoints: [
          { position: [5, 5, 5], integer: 20 },
          { position: [6, 6, 6], integer: 21 },
          { position: [7, 7, 7], integer: 22 },
        ],
        block: { ...block, firstVector: null, secondVector: null },
      },
      { isMirrored: false, session: test.session }
    )

    // Act
    const begun = CANNON_BATTERY.begin(loaded, test.session, null)
    const ended = CANNON_BATTERY.end(begun, test.session, null)

    // Assert
    expect(begun.data).toMatchObject({
      position: [2, 2, 2],
      target: [7, 7, 7],
      firstChoice: 1,
      secondChoice: 2,
    })
    expect(test.calls).toEqual(['startStop 11 11', 'startStop 6 6', 'startStop 22 22'])
    expect(ended.lifecycle).toBe(HazardLifecycle.IDLE)
  })
})
