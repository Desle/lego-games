import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import {
  createTestRacer,
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
  TEST_SKELETON,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { LAVA, LAVA_IDENTIFIER } from './lava.ts'

const create = () => {
  const test = createTestSession({
    track: createTestWorld([
      createTestSkeletonInstance('mmlavbl', {
        skeleton: TEST_SKELETON,
        scale: 2,
        boundsRadius: 30,
        position: [100, 0, 0],
      }),
    ]),
  })
  return {
    test,
    loaded: LAVA.create({ keyword: 0x2c }, { isMirrored: false, session: test.session }),
  }
}

describe('the lava monster', () => {
  it('loops its sound while it is active', () => {
    // Arrange
    const { test, loaded } = create()

    // Act
    const begun = LAVA.begin(loaded, test.session, null)
    const ended = LAVA.end(begun, test.session, null)

    // Assert
    expect(loaded.identifier).toBe(LAVA_IDENTIFIER)
    expect(test.effects).toEqual([{ type: 'hazard.looped_sound_stopped', keyword: 0x2c }])
    expect(ended.lifecycle).toBe(HazardLifecycle.IDLE)
  })

  it('spins a racer that touches it', () => {
    // Arrange
    const { test, loaded } = create()

    // Act
    LAVA.touch(loaded, test.session, createTestRacer(3))

    // Assert
    expect(test.effects).toEqual([
      {
        type: 'hazard.racer_affected',
        keyword: 0x2c,
        racerIndex: 3,
        reaction: 'spun',
        vector: null,
      },
    ])
  })

  it('spares a racer that is spinning already or standing still', () => {
    // Arrange
    const { test, loaded } = create()

    // Act
    LAVA.touch(loaded, test.session, createTestRacer(1, 0, { isSpinning: true }))
    LAVA.touch(loaded, test.session, createTestRacer(2, 0, { forwardSpeed: 0 }))

    // Assert
    expect(test.effects).toEqual([])
  })

  it('registers the model radius on its first bone, scaled and carried by the instance, while it is active', () => {
    // Arrange
    const { test, loaded } = create()

    // Act
    const begun = LAVA.begin(loaded, test.session, null)
    const updated = LAVA.update(begun, test.session, 33)

    // Assert
    expect(LAVA.getRegisteredSphere(loaded)).toBeNull()
    expect(LAVA.getRegisteredSphere(begun)).toEqual({ centre: [0, 0, 0], radius: 30 })
    expect(LAVA.getRegisteredSphere(updated)).toEqual({ centre: [106, 8, 10], radius: 30 })
  })

  it('stays registered until its update runs the End it was asked for', () => {
    // Arrange
    const { test, loaded } = create()
    const ending = { ...LAVA.begin(loaded, test.session, null), lifecycle: HazardLifecycle.ENDING }

    // Act
    const updated = LAVA.update(ending, test.session, 33)

    // Assert
    expect(LAVA.getRegisteredSphere(ending)).not.toBeNull()
    expect(LAVA.getRegisteredSphere(updated)).toBeNull()
  })
})
