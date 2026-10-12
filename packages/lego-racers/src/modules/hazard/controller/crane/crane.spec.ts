import { getSkeletonInstanceWithTime } from '../../../world-animation/index.ts'
import {
  createTestRacer,
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
  TEST_SKELETON,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { CRANE, CRANE_SIGNAL } from './crane.ts'

const createAt = (time: number) => {
  const test = createTestSession({
    track: createTestWorld([
      getSkeletonInstanceWithTime(createTestSkeletonInstance('crane'), time),
    ]),
  })
  const loaded = CRANE.create({ keyword: 0x32 }, { isMirrored: false, session: test.session })
  return { test, begun: CRANE.begin(loaded, test.session, null) }
}

describe('the crane', () => {
  it('announces its signal once when it is armed and the arm swings through a window', () => {
    // Arrange
    const { test, begun } = createAt(160)

    // Act
    const struck = CRANE.update(begun, test.session, 33)
    const again = CRANE.update(struck, test.session, 33)

    // Assert
    expect(test.calls).toEqual([`startStop ${String(CRANE_SIGNAL)} ${String(CRANE_SIGNAL)}`])
    expect(again.data).toEqual(struck.data)
    expect(struck.data).toMatchObject({ flags: 0 })
  })

  it('arms again in the arming windows', () => {
    // Arrange
    const struck = createAt(10)
    const afterStrike = CRANE.update(struck.begun, struck.test.session, 33)
    const arming = createTestSession({
      track: createTestWorld([
        getSkeletonInstanceWithTime(createTestSkeletonInstance('crane'), 100),
      ]),
    })

    // Act
    const armed = CRANE.update(afterStrike, arming.session, 33)

    // Assert
    expect(afterStrike.data).toMatchObject({ flags: 0 })
    expect(armed.data).toMatchObject({ flags: 2 })
  })

  it('stays quiet outside the windows', () => {
    // Arrange
    const { test, begun } = createAt(40)

    // Act
    const updated = CRANE.update(begun, test.session, 33)

    // Assert
    expect(test.calls).toEqual([])
    expect(updated.data).toMatchObject({ flags: 2 })
  })

  it('spins a racer that touches it and announces signal 0x15', () => {
    // Arrange
    const { test, begun } = createAt(40)

    // Act
    CRANE.touch(begun, test.session, createTestRacer(2))
    CRANE.touch(begun, test.session, createTestRacer(3, 0, { isSpinning: true }))

    // Assert
    expect(test.effects).toEqual([
      {
        type: 'hazard.racer_affected',
        keyword: 0x32,
        racerIndex: 2,
        reaction: 'spun',
        vector: null,
      },
    ])
    expect(test.calls).toEqual(['startStop 21 21'])
  })

  it('registers a sphere of radius 3 on the chain of its fourth bone while it is active', () => {
    // Arrange
    const test = createTestSession({
      track: createTestWorld([
        createTestSkeletonInstance('crane', { skeleton: TEST_SKELETON, position: [100, 0, 0] }),
      ]),
    })
    const loaded = CRANE.create({ keyword: 0x32 }, { isMirrored: false, session: test.session })

    // Act
    const updated = CRANE.update(CRANE.begin(loaded, test.session, null), test.session, 33)

    // Assert
    expect(CRANE.getRegisteredSphere(loaded)).toBeNull()
    expect(CRANE.getRegisteredSphere(updated)).toEqual({ centre: [104, 5, 8], radius: 3 })
  })
})
