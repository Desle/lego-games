import { getSkeletonInstanceWithTime } from '../../../world-animation/index.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import {
  createTestRacer,
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { CAPTURE } from './capture.ts'

const definition = {
  keyword: 0x48 as const,
  integer: 5,
  name: 'trap',
  vector: [0, 100, 200] as const,
}

const createBegun = (time: number) => {
  const test = createTestSession({
    track: createTestWorld([getSkeletonInstanceWithTime(createTestSkeletonInstance('trap'), time)]),
  })
  const loaded = CAPTURE.create(definition, { isMirrored: false, session: test.session })
  return { test, begun: CAPTURE.begin(loaded, test.session, null) }
}

describe('the capture hazard', () => {
  it('holds the first unshielded racer that touches it', () => {
    // Arrange
    const { test, begun } = createBegun(10)

    // Act
    const held = CAPTURE.touch(begun, test.session, createTestRacer(2))
    const other = CAPTURE.touch(held, test.session, createTestRacer(3))

    // Assert
    expect(held.data).toMatchObject({
      capturedRacer: 2,
      holdMilliseconds: 500,
      phase: 1,
      phaseMilliseconds: 1000,
    })
    expect(other).toBe(held)
    expect(test.effects).toEqual([
      { type: 'hazard.racer_affected', keyword: 0x48, racerIndex: 2, reaction: 'captured' },
    ])
  })

  it('does not hold a shielded racer or anyone while its clip is in the release window', () => {
    // Arrange
    const { test, begun } = createBegun(10)
    const inside = createBegun(150)

    // Act
    const shielded = CAPTURE.touch(begun, test.session, createTestRacer(0, 1))
    const released = CAPTURE.touch(inside.begun, inside.test.session, createTestRacer(0))

    // Assert
    expect(shielded).toBe(begun)
    expect(released).toBe(inside.begun)
  })

  it('lets the racer go after 500 ms, rests, and is ready again', () => {
    // Arrange
    const { test, begun } = createBegun(10)
    const held = CAPTURE.touch(begun, test.session, createTestRacer(2))

    // Act
    const holding = CAPTURE.update(held, test.session, 400)
    const released = CAPTURE.update(holding, test.session, 100)

    // Assert
    expect(holding.data).toMatchObject({ capturedRacer: 2, holdMilliseconds: 100 })
    expect(released.data).toMatchObject({ capturedRacer: null, holdMilliseconds: 0, phase: 0 })
    expect(test.effects[1]).toMatchObject({ reaction: 'released', racerIndex: 2 })
  })

  it('lets go of its racer when it ends', () => {
    // Arrange
    const { test, begun } = createBegun(10)
    const held = CAPTURE.touch(begun, test.session, createTestRacer(2))

    // Act
    const ended = CAPTURE.end(held, test.session, null)

    // Assert
    expect(ended.lifecycle).toBe(HazardLifecycle.IDLE)
    expect(ended.data).toMatchObject({ capturedRacer: null })
  })
})
