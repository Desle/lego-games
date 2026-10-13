import { createTestSession } from '../hazard-fixtures/hazard-fixtures.ts'
import { PERIODIC_LAUNCHER } from './periodic-launcher.ts'

const definition = {
  keyword: 0x43 as const,
  integer: 3,
  name: null,
  secondInteger: 2000,
  secondName: 'ball',
}

const create = (draws: readonly number[] = [0, 0]) => {
  const test = createTestSession({ draws })
  return {
    test,
    loaded: PERIODIC_LAUNCHER.create(definition, { isMirrored: false, session: test.session }),
  }
}

describe('the periodic launcher', () => {
  it('throws on its first update after it begins, drawing twice for the scatter', () => {
    // Arrange
    const { test, loaded } = create()
    const begun = PERIODIC_LAUNCHER.begin(loaded, test.session, null)

    // Act
    const thrown = PERIODIC_LAUNCHER.update(begun, test.session, 33)

    // Assert
    expect(loaded.identifier).toBe(3)
    expect(test.getDrawCount()).toBe(2)
    expect(test.effects).toEqual([
      {
        type: 'hazard.power_up_activated',
        keyword: 0x43,
        activation: 'projectile',
        effectKind: 0,
        racerIndex: null,
        launcher: { position: [0, 0, 0], direction: null, target: [-2, -2, 1], speed: 30 },
      },
    ])
    expect(thrown.data).toMatchObject({ elapsedMilliseconds: 0, modelName: 'ball' })
  })

  it('scatters the target by the low two bits of each draw, less 2 (0x0048c782)', () => {
    // Arrange
    const { test, loaded } = create([7, 0x101])

    // Act
    PERIODIC_LAUNCHER.update(PERIODIC_LAUNCHER.begin(loaded, test.session, null), test.session, 33)

    // Assert
    expect(test.effects[0]).toMatchObject({ launcher: { target: [1, -1, 1] } })
  })

  it('moves a target that would sit right above the start 2 more in x (0x0048c7f6)', () => {
    // Arrange
    const { test, loaded } = create([2, 2])

    // Act
    PERIODIC_LAUNCHER.update(PERIODIC_LAUNCHER.begin(loaded, test.session, null), test.session, 33)

    // Assert
    expect(test.effects[0]).toMatchObject({ launcher: { target: [2, 0, 1] } })
  })

  it('throws again once the period has passed and draws nothing in between', () => {
    // Arrange
    const { test, loaded } = create()
    let current = PERIODIC_LAUNCHER.update(
      PERIODIC_LAUNCHER.begin(loaded, test.session, null),
      test.session,
      33
    )

    // Act
    current = PERIODIC_LAUNCHER.update(current, test.session, 1900)
    const drawsBefore = test.getDrawCount()
    PERIODIC_LAUNCHER.update(current, test.session, 100)

    // Assert
    expect(drawsBefore).toBe(2)
    expect(test.getDrawCount()).toBe(4)
    expect(test.effects).toHaveLength(2)
  })
})
