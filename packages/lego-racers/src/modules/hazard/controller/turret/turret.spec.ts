import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import {
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { TURRET } from './turret.ts'

const definition = {
  keyword: 0x40 as const,
  vector: [5, 6, 7] as const,
  integer: 12,
  name: 'turret',
  secondInteger: 4000,
  secondVector: [0, 0, 0] as const,
}

const create = () => {
  const test = createTestSession({
    track: createTestWorld([createTestSkeletonInstance('turret', { position: [100, 200, 300] })]),
  })
  return { test, loaded: TURRET.create(definition, { isMirrored: false, session: test.session }) }
}

describe('the turret', () => {
  it('takes the identifier of the file and fires on its first update after it begins', () => {
    // Arrange
    const { test, loaded } = create()
    const begun = TURRET.begin(loaded, test.session, null)

    // Act
    TURRET.update(begun, test.session, 33)

    // Assert
    expect(loaded.identifier).toBe(12)
    expect(test.effects).toEqual([
      {
        type: 'hazard.power_up_activated',
        keyword: 0x40,
        activation: 'projectile',
        effectKind: 2,
        racerIndex: null,
        // The fixture's cosine table answers 1, so x and y are equal and z is the offset 0.
        launcher: {
          position: [100, 200, 283],
          direction: [0.7071067690849304, 0.7071067690849304, 0],
          target: null,
          speed: null,
        },
      },
    ])
  })

  it('fires again every 0x206c milliseconds and not in between', () => {
    // Arrange
    const { test, loaded } = create()
    let current = TURRET.update(TURRET.begin(loaded, test.session, null), test.session, 33)

    // Act
    for (let step = 0; step < 250; step += 1) current = TURRET.update(current, test.session, 33)
    const afterTwoSecondsOfSteps = test.effects.length
    for (let step = 0; step < 100; step += 1) current = TURRET.update(current, test.session, 33)

    // Assert
    expect(afterTwoSecondsOfSteps).toBe(1)
    expect(test.effects).toHaveLength(2)
  })

  it('does nothing while idle', () => {
    // Arrange
    const { test, loaded } = create()

    // Act
    const updated = TURRET.update(loaded, test.session, 33)

    // Assert
    expect(updated.lifecycle).toBe(HazardLifecycle.IDLE)
    expect(test.effects).toEqual([])
  })
})
