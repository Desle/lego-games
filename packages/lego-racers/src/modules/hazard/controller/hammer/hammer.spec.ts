import { getSkeletonInstanceWithTime } from '../../../world-animation/index.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import {
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { HAMMER } from './hammer.ts'

const DEFINITION = Object.freeze({
  keyword: HazardKeyword.HAZARD_3E,
  name: 'rkhamm02',
  integer: 53,
  float: 0,
  vector: [30, 12, 14] as const,
})

const createLoaded = () => {
  const test = createTestSession({
    track: createTestWorld([
      getSkeletonInstanceWithTime(createTestSkeletonInstance('rkhamm02'), 0),
    ]),
  })
  const loaded = HAMMER.create(DEFINITION, { isMirrored: false, session: test.session })
  return { test, loaded }
}

describe('the hammer, 0x0048bb00 to 0x0048be70', () => {
  it('loads idle with a box of the file size, a sphere of half the largest dimension and 1 / 20,000 as inverse mass', () => {
    // Arrange
    const { loaded } = createLoaded()

    // Act
    const body = HAMMER.getCollisionBody({ ...loaded, lifecycle: HazardLifecycle.ACTIVE })

    // Assert
    expect(loaded.lifecycle).toBe(HazardLifecycle.IDLE)
    expect(body?.box.dimensions).toEqual({ x: 30, y: 12, z: 14 })
    expect(body?.sphere.radius).toBe(15)
    expect(body?.inverseMass).toBe(Math.fround(1 / 20000))
    expect(body?.linearVelocity).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('has no collision body until it begins, and none again after it ends', () => {
    // Arrange
    const { test, loaded } = createLoaded()

    // Act
    const begun = HAMMER.begin(loaded, test.session, null)
    const ended = HAMMER.end(begun, test.session, null)

    // Assert
    expect(HAMMER.getCollisionBody(loaded)).toBeNull()
    expect(HAMMER.getCollisionBody(begun)).not.toBeNull()
    expect(HAMMER.getCollisionBody(ended)).toBeNull()
  })

  it('moves its body to the pose of the bone chain on every update of an active hammer', () => {
    // Arrange
    const { test, loaded } = createLoaded()
    const begun = HAMMER.begin(loaded, test.session, null)

    // Act
    const updated = HAMMER.update(begun, test.session, 33)

    // Assert
    const body = HAMMER.getCollisionBody(updated)
    expect(body?.box.centre).toEqual(body?.sphere.centre)
    expect(updated.lifecycle).toBe(HazardLifecycle.ACTIVE)
  })
})
