import {
  advanceWorldAnimation,
  getSkeletonInstanceFlags,
  getSkeletonInstanceTime,
  getSkeletonInstanceWithTime,
  INSTANCE_ANIMATED_FLAG,
  INSTANCE_LOOPING_FLAG,
} from '../../../world-animation/index.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import {
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { PILLAR, PILLAR_IDENTIFIER, PILLAR_LANDED_SIGNAL } from './pillar.ts'

const createTest = (time = 0) =>
  createTestSession({
    track: createTestWorld([
      getSkeletonInstanceWithTime(createTestSkeletonInstance('piltop'), time),
    ]),
  })

describe('the pillar', () => {
  it("stops the pillar's animation when it loads", () => {
    // Arrange
    const test = createTest()

    // Act
    const loaded = PILLAR.create({ keyword: 0x28 }, { isMirrored: false, session: test.session })

    // Assert
    expect(loaded.identifier).toBe(PILLAR_IDENTIFIER)
    const skeleton = test.getWorld('track').skeletonInstances[0]
    expect(
      skeleton === undefined ? 0 : getSkeletonInstanceFlags(skeleton) & INSTANCE_ANIMATED_FLAG
    ).toBe(0)
  })

  it('starts its clip once, without looping, when it begins', () => {
    // Arrange
    const test = createTest(20)
    const loaded = PILLAR.create({ keyword: 0x28 }, { isMirrored: false, session: test.session })

    // Act
    const begun = PILLAR.begin(loaded, test.session, null)

    // Assert
    const skeleton = test.getWorld('track').skeletonInstances[0]
    expect(begun.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(skeleton === undefined ? -1 : getSkeletonInstanceTime(skeleton)).toBe(0)
    expect(skeleton === undefined ? -1 : getSkeletonInstanceFlags(skeleton)).toBe(
      INSTANCE_ANIMATED_FLAG & ~INSTANCE_LOOPING_FLAG
    )
  })

  it('makes its collision object solid and tells the events once the clip passes frame 50', () => {
    // Arrange
    const test = createTest()
    const loaded = PILLAR.create({ keyword: 0x28 }, { isMirrored: false, session: test.session })
    const begun = PILLAR.begin(loaded, test.session, null)

    // Act
    const early = PILLAR.update(begun, test.session, 33)
    test.session.setWorld('track', advanceWorldAnimation(test.getWorld('track'), 104))
    const landed = PILLAR.update(early, test.session, 33)
    const again = PILLAR.update(landed, test.session, 33)

    // Assert
    expect(early).toBe(begun)
    expect(test.calls).toEqual([`startStop ${String(PILLAR_LANDED_SIGNAL)} ${String(PILLAR_LANDED_SIGNAL)}`])
    expect(test.effects).toEqual([
      { type: 'hazard.collision_object_changed', name: 'pilcol', isSolid: true },
    ])
    expect(again).toBe(landed)
  })
})
