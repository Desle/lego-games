import {
  advanceWorldAnimation,
  getSkeletonInstanceFlags,
  INSTANCE_ANIMATED_FLAG,
} from '../../../world-animation/index.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import {
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { GATE, GATE_OPENING_SIGNAL } from './gate.ts'

const definition = {
  keyword: 0x34 as const,
  integer: 9,
  objectName: 'door',
  names: ['left', 'right'],
}

const createLoaded = () => {
  const test = createTestSession({
    track: createTestWorld([
      createTestSkeletonInstance('left'),
      createTestSkeletonInstance('right'),
    ]),
  })
  return { test, loaded: GATE.create(definition, { isMirrored: false, session: test.session }) }
}

const getFlags = (test: ReturnType<typeof createLoaded>['test']) =>
  test.getWorld('track').skeletonInstances.map(getSkeletonInstanceFlags)

describe('the gate', () => {
  it("stops its parts' animation when it loads and takes the file's identifier", () => {
    // Arrange
    // Act
    const { test, loaded } = createLoaded()

    // Assert
    expect(loaded.identifier).toBe(9)
    expect(getFlags(test).map((flags) => flags & INSTANCE_ANIMATED_FLAG)).toEqual([0, 0])
  })

  it("starts the parts' clips without looping, hides them from the world and tells the events", () => {
    // Arrange
    const { test, loaded } = createLoaded()

    // Act
    const begun = GATE.begin(loaded, test.session, null)

    // Assert
    expect(begun.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(test.calls).toEqual([
      `startStop ${String(GATE_OPENING_SIGNAL)} ${String(GATE_OPENING_SIGNAL)}`,
    ])
    expect(
      test.getWorld('track').skeletonInstances.map((part) => part.levelSquaredDistances)
    ).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ])
    expect(getFlags(test).map((flags) => flags & INSTANCE_ANIMATED_FLAG)).toEqual([
      INSTANCE_ANIMATED_FLAG,
      INSTANCE_ANIMATED_FLAG,
    ])
  })

  it('removes the collision object while it is active and ends once every part has finished', () => {
    // Arrange
    const { test, loaded } = createLoaded()
    const begun = GATE.begin(loaded, test.session, null)

    // Act
    const running = GATE.update(begun, test.session, 33)
    test.session.setWorld('track', advanceWorldAnimation(test.getWorld('track'), 700))
    const finished = GATE.update(running, test.session, 33)

    // Assert
    expect(running.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(finished.lifecycle).toBe(HazardLifecycle.IDLE)
    expect(test.effects[0]).toEqual({
      type: 'hazard.collision_object_changed',
      name: 'door',
      isSolid: false,
    })
    expect(getFlags(test).map((flags) => flags & INSTANCE_ANIMATED_FLAG)).toEqual([0, 0])
  })
})
