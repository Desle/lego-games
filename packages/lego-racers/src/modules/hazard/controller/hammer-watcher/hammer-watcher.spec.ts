import { getSkeletonInstanceWithTime } from '../../../world-animation/index.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import {
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import {
  HAMMER_STRIKE_SIGNAL,
  HAMMER_WATCHER,
  HAMMER_WATCHER_IDENTIFIER,
} from './hammer-watcher.ts'

const createSessionAt = (time: number) =>
  createTestSession({
    track: createTestWorld([
      getSkeletonInstanceWithTime(createTestSkeletonInstance('rkhamm02'), time),
    ]),
  })

const createBegun = (time: number) => {
  const test = createSessionAt(time)
  const loaded = HAMMER_WATCHER.create(
    { keyword: 0x2a },
    { isMirrored: false, session: test.session }
  )
  return { test, begun: HAMMER_WATCHER.begin(loaded, test.session, null) }
}

describe('the hammer watcher', () => {
  it("loads idle with the identifier the hammer's events announce", () => {
    // Arrange
    const test = createSessionAt(0)

    // Act
    const loaded = HAMMER_WATCHER.create(
      { keyword: 0x2a },
      { isMirrored: false, session: test.session }
    )

    // Assert
    expect(loaded.identifier).toBe(HAMMER_WATCHER_IDENTIFIER)
    expect(loaded.lifecycle).toBe(HazardLifecycle.IDLE)
  })

  it('announces the strike once while the hammer is in the strike window, and disarms', () => {
    // Arrange
    const { test, begun } = createBegun(25)

    // Act
    const struck = HAMMER_WATCHER.update(begun, test.session, 33)
    const again = HAMMER_WATCHER.update(struck, test.session, 33)

    // Assert
    expect(test.calls).toEqual([
      `startStop ${String(HAMMER_STRIKE_SIGNAL)} ${String(HAMMER_STRIKE_SIGNAL)}`,
    ])
    expect(again.data).toEqual(struck.data)
  })

  it('does nothing outside the windows and arms again in the arming window', () => {
    // Arrange
    const { test, begun } = createBegun(25)
    const struck = HAMMER_WATCHER.update(begun, test.session, 33)

    // Act
    const quiet = createTestSession({
      track: createTestWorld([
        getSkeletonInstanceWithTime(createTestSkeletonInstance('rkhamm02'), 10),
      ]),
    })
    const armed = HAMMER_WATCHER.update(struck, quiet.session, 33)
    const strikeAgain = HAMMER_WATCHER.update(armed, test.session, 33)

    // Assert
    expect(quiet.calls).toEqual([])
    expect(strikeAgain.data).not.toEqual(armed.data)
    expect(test.calls).toHaveLength(2)
  })

  it('does nothing while idle', () => {
    // Arrange
    const test = createSessionAt(25)
    const loaded = HAMMER_WATCHER.create(
      { keyword: 0x2a },
      { isMirrored: false, session: test.session }
    )

    // Act
    const updated = HAMMER_WATCHER.update(loaded, test.session, 33)

    // Assert
    expect(updated).toBe(loaded)
    expect(test.calls).toEqual([])
  })
})
