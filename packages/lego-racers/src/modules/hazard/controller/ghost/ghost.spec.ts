import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import {
  createTestRacer,
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
  TEST_SKELETON,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { GHOST, GHOST_IDENTIFIER } from './ghost.ts'

const create = () => {
  const test = createTestSession({ draws: [250, 17] })
  return {
    test,
    loaded: GHOST.create({ keyword: 0x2b }, { isMirrored: false, session: test.session }),
  }
}

describe('the ghost', () => {
  it('starts its looped sound when it begins and stops it when it ends', () => {
    // Arrange
    const { test, loaded } = create()

    // Act
    const begun = GHOST.begin(loaded, test.session, null)
    const ended = GHOST.end(begun, test.session, null)

    // Assert
    expect(loaded.identifier).toBe(GHOST_IDENTIFIER)
    expect(test.effects).toEqual([
      { type: 'hazard.looped_sound_started', keyword: 0x2b, soundIdentifier: 0xbc4 },
      { type: 'hazard.looped_sound_stopped', keyword: 0x2b },
    ])
    expect(ended.lifecycle).toBe(HazardLifecycle.IDLE)
  })

  it('draws every 500 ms to bend the pitch, the first time at once', () => {
    // Arrange
    const { test, loaded } = create()
    const begun = GHOST.begin(loaded, test.session, null)

    // Act
    const first = GHOST.update(begun, test.session, 33)
    const quiet = GHOST.update(first, test.session, 400)
    const second = GHOST.update(quiet, test.session, 100)

    // Assert
    expect(test.getDrawCount()).toBe(2)
    expect(first.data).toMatchObject({ soundMilliseconds: 0 })
    expect(second.data).toMatchObject({ soundMilliseconds: 0 })
    expect((first.data as { pitchOffset: number }).pitchOffset).toBeCloseTo(
      0.5 * 0.01 * 0.4 * 100,
      5
    )
  })

  it('counts its own time even when idle', () => {
    // Arrange
    const { test, loaded } = create()

    // Act
    const updated = GHOST.update(loaded, test.session, 33)

    // Assert
    expect(updated.data).toMatchObject({ elapsedMilliseconds: 33 })
    expect(test.getDrawCount()).toBe(0)
  })

  it('flings an unshielded racer that touches it and spares a shielded one', () => {
    // Arrange
    const { test, loaded } = create()

    // Act
    GHOST.touch(loaded, test.session, createTestRacer(1, 0))
    GHOST.touch(loaded, test.session, createTestRacer(2, 1))

    // Assert
    expect(test.effects).toEqual([
      {
        type: 'hazard.racer_affected',
        keyword: 0x2b,
        racerIndex: 1,
        reaction: 'flung',
        vector: [0, 0, 150],
      },
    ])
  })

  it('spares a racer that is spinning already or standing still', () => {
    // Arrange
    const { test, loaded } = create()

    // Act
    GHOST.touch(loaded, test.session, createTestRacer(1, 0, { isSpinning: true }))
    GHOST.touch(loaded, test.session, createTestRacer(2, 0, { forwardSpeed: 0 }))

    // Assert
    expect(test.effects).toEqual([])
  })

  it('registers a sphere of the model radius and 8 on its second bone while it is active', () => {
    // Arrange
    const test = createTestSession({
      track: createTestWorld([
        createTestSkeletonInstance('ghostly', {
          skeleton: TEST_SKELETON,
          scale: 2,
          boundsRadius: 5,
        }),
      ]),
    })
    const loaded = GHOST.create({ keyword: 0x2b }, { isMirrored: false, session: test.session })

    // Act
    const begun = GHOST.begin(loaded, test.session, null)
    const updated = GHOST.update(begun, test.session, 33)
    const ending = { ...updated, lifecycle: HazardLifecycle.ENDING }
    const ended = GHOST.end(ending, test.session, null)

    // Assert
    expect(GHOST.getRegisteredSphere(loaded)).toBeNull()
    expect(GHOST.getRegisteredSphere(updated)).toEqual({ centre: [3, 4, 5], radius: 13 })
    expect(GHOST.getRegisteredSphere(ending)).not.toBeNull()
    expect(GHOST.getRegisteredSphere(ended)).toBeNull()
  })
})
