import { createEmitterPool } from '../../../emitter/index.ts'
import type { Emitter } from '../../../emitter/index.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import { createTestSession } from '../hazard-fixtures/hazard-fixtures.ts'
import { SNOWFALL } from './snowfall.ts'

const snow: Emitter = {
  name: 'snow',
  firstTruncatedValue: 100,
  secondTruncatedValue: 0,
  vector: [0, 0, 0],
  points: [[0, 0, 1]],
  firstFloat: 1,
  secondFloat: 1,
  thirdFloat: 0,
  fourthFloat: 0,
  fifthFloat: 1,
  entryIndex: null,
  firstInteger: 500,
  secondInteger: -1,
  thirdInteger: 1,
  linkedName: null,
}

const createLoaded = () => {
  const test = createTestSession({
    emitters: createEmitterPool({
      list: { emitters: [snow], readByteCount: 0 },
      instanceCount: 2,
      animation: null,
    }),
  })
  return {
    test,
    loaded: SNOWFALL.create({ keyword: 0x2f }, { isMirrored: false, session: test.session }),
  }
}

describe('the snowfall', () => {
  it('begins as it loads', () => {
    // Arrange
    // Act
    const { loaded } = createLoaded()

    // Assert
    expect(loaded.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(loaded.data).toMatchObject({ isEnabled: true, emitterHandle: null })
  })

  it('makes a "snow" emitter on its first update and keeps it for a second', () => {
    // Arrange
    const { test, loaded } = createLoaded()

    // Act
    const made = SNOWFALL.update(loaded, test.session, 33)
    const kept = SNOWFALL.update(made, test.session, 900)
    const renewed = SNOWFALL.update(kept, test.session, 101)

    // Assert
    expect(made.data).toMatchObject({ emitterHandle: 0, milliseconds: 0 })
    expect(kept.data).toMatchObject({ emitterHandle: 0, milliseconds: 900 })
    expect(renewed.data).toMatchObject({ emitterHandle: 0, milliseconds: 0 })
    expect(
      test.getEmitters()?.instances.filter((instance) => instance.system.isActive)
    ).toHaveLength(1)
  })

  it('draws once after the racers while the emitter exists', () => {
    // Arrange
    const { test, loaded } = createLoaded()
    const made = SNOWFALL.update(loaded, test.session, 33)

    // Act
    SNOWFALL.updateAfterRacers(loaded, test.session, [])
    SNOWFALL.updateAfterRacers(made, test.session, [])

    // Assert
    expect(test.getDrawCount()).toBe(1)
  })

  it('lets go of its emitter when it ends', () => {
    // Arrange
    const { test, loaded } = createLoaded()
    const made = SNOWFALL.update(loaded, test.session, 33)

    // Act
    const ended = SNOWFALL.end(made, test.session, null)

    // Assert
    expect(ended.lifecycle).toBe(HazardLifecycle.IDLE)
    expect(ended.data).toMatchObject({ emitterHandle: null })
    expect(test.getEmitters()?.handles[0]?.isTaken).toBe(false)
  })
})
