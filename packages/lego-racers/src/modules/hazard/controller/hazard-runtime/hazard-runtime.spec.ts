import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardRuntime, HazardStore } from '../../types/hazard-runtime.types.ts'
import {
  createTestRacer,
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import {
  createHazardRuntime,
  fireHazardTrigger,
  forceEndHazards,
  releaseHazardTrigger,
  startHazardSignal,
  startStopHazardSignal,
  stopHazardSignal,
  updateHazards,
} from './hazard-runtime.ts'

const createStore = (runtime: HazardRuntime): HazardStore & { current: () => HazardRuntime } => {
  let current = runtime
  return { get: () => current, set: (next) => void (current = next), current: () => current }
}

const createLoaded = (keywords: readonly number[]) => {
  const test = createTestSession({
    track: createTestWorld([createTestSkeletonInstance('rkhamm02')]),
  })
  const runtime = createHazardRuntime(
    {
      hazards: keywords.map((keyword) => ({ keyword })),
      readByteCount: 0,
    },
    { isMirrored: false, session: test.session }
  )
  return { test, store: createStore(runtime) }
}

const getLifecycles = (store: { current: () => HazardRuntime }): readonly number[] =>
  store.current().instances.map((instance) => instance.lifecycle)

describe('createHazardRuntime', () => {
  it('makes one idle object per definition, in file order, with the identifier its class loads', () => {
    // Arrange
    // Act
    const { store } = createLoaded([HazardKeyword.HAZARD_2A, HazardKeyword.HAZARD_49])

    // Assert
    expect(store.current().instances.map((instance) => instance.identifier)).toEqual([0x32, 0])
    expect(getLifecycles(store)).toEqual([HazardLifecycle.IDLE, HazardLifecycle.IDLE])
  })

  it('is empty for a race without a hazard file', () => {
    // Arrange
    const { session } = createTestSession()

    // Act
    const runtime = createHazardRuntime(null, { isMirrored: false, session })

    // Assert
    expect(runtime.instances).toEqual([])
  })
})

describe('the bus hooks', () => {
  it('begins only the idle hazard whose identifier the signal carries', () => {
    // Arrange
    const { test, store } = createLoaded([HazardKeyword.HAZARD_2A, HazardKeyword.HAZARD_49])

    // Act
    startHazardSignal(store, test.session, 0x32, null)

    // Assert
    expect(getLifecycles(store)).toEqual([HazardLifecycle.ACTIVE, HazardLifecycle.IDLE])
  })

  it('begins on a start-and-stop signal and ends on its stop identifier', () => {
    // Arrange
    const { test, store } = createLoaded([HazardKeyword.HAZARD_2A])
    startHazardSignal(store, test.session, 0x32, null)

    // Act
    startStopHazardSignal(store, test.session, 7, 0x32, null)

    // Assert
    expect(getLifecycles(store)).toEqual([HazardLifecycle.IDLE])
  })

  it('ends an active hazard on a stop signal and leaves the others', () => {
    // Arrange
    const { test, store } = createLoaded([HazardKeyword.HAZARD_2A, HazardKeyword.HAZARD_2A])
    startHazardSignal(store, test.session, 0x32, null)

    // Act
    stopHazardSignal(store, test.session, 0x32)

    // Assert
    expect(getLifecycles(store)).toEqual([HazardLifecycle.IDLE, HazardLifecycle.IDLE])
  })

  it('marks a hazard to end and lets its next update end it', () => {
    // Arrange
    const { test, store } = createLoaded([HazardKeyword.HAZARD_2A])
    startHazardSignal(store, test.session, 0x32, null)

    // Act
    forceEndHazards(store, 0x32)
    const marked = getLifecycles(store)
    updateHazards(store, test.session, 16)

    // Assert
    expect(marked).toEqual([HazardLifecycle.ENDING])
    expect(getLifecycles(store)).toEqual([HazardLifecycle.IDLE])
  })

  it('lets a racer trigger only the hazards that react to racers', () => {
    // Arrange
    const { test, store } = createLoaded([HazardKeyword.HAZARD_2A, HazardKeyword.HAZARD_49])

    // Act
    fireHazardTrigger(store, test.session, 0x32, createTestRacer(0))
    fireHazardTrigger(store, test.session, 0, createTestRacer(2))

    // Assert
    expect(getLifecycles(store)).toEqual([HazardLifecycle.IDLE, HazardLifecycle.ACTIVE])
    expect(test.effects).toMatchObject([
      { type: 'hazard.power_up_activated', activation: 'warp', racerIndex: 2 },
    ])
  })

  it('ends a racer-triggered hazard when the racer releases the trigger', () => {
    // Arrange
    const { test, store } = createLoaded([HazardKeyword.HAZARD_49])
    fireHazardTrigger(store, test.session, 0, createTestRacer(0))

    // Act
    releaseHazardTrigger(store, test.session, 0, createTestRacer(0))

    // Assert
    expect(getLifecycles(store)).toEqual([HazardLifecycle.IDLE])
  })
})
