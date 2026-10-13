import { createEmitterPool } from '../../../emitter/index.ts'
import type { Emitter } from '../../../emitter/index.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import {
  createTestRacer,
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
  TEST_SKELETON,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { LAVA, LAVA_IDENTIFIER, LAVA_SIGNAL } from './lava.ts'

const lavaSmoke: Emitter = {
  name: 'lavasmk',
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
  secondInteger: 300,
  thirdInteger: 1,
  linkedName: null,
}

const create = (timeInFrames = 0, isMirrored = false) => {
  const instance = createTestSkeletonInstance('mmlavbl', {
    skeleton: TEST_SKELETON,
    scale: 2,
    boundsRadius: 30,
    position: [100, 0, 0],
  })
  const test = createTestSession({
    track: createTestWorld([
      instance.clip === null
        ? instance
        : {
            ...instance,
            clip: { ...instance.clip, clip: { ...instance.clip.clip, timeInFrames } },
          },
    ]),
    emitters: createEmitterPool({
      list: { emitters: [lavaSmoke], readByteCount: 0 },
      instanceCount: 4,
      animation: null,
    }),
  })
  return {
    test,
    loaded: LAVA.create({ keyword: 0x2c }, { isMirrored, session: test.session }),
  }
}

const getActiveEmitterPositions = (test: ReturnType<typeof create>['test']) =>
  (test.session.getEmitters()?.instances ?? [])
    .filter((instance) => instance.system.isActive)
    .map((instance) => instance.position)

describe('the lava monster', () => {
  it('begins without a sound (0x0048d980) and ends idle', () => {
    // Arrange
    const { test, loaded } = create()

    // Act
    const begun = LAVA.begin(loaded, test.session, null)
    const ended = LAVA.end(begun, test.session, null)

    // Assert
    expect(loaded.identifier).toBe(LAVA_IDENTIFIER)
    expect(test.effects).toEqual([])
    expect(ended.lifecycle).toBe(HazardLifecycle.IDLE)
  })

  it('spills smoke at the vent whose window holds the clip time, then waits 800 ms (0x0048dac8)', () => {
    // Arrange
    const { test, loaded } = create(70)
    const begun = LAVA.begin(loaded, test.session, null)

    // Act
    const spilled = LAVA.update(begun, test.session, 33)
    const waiting = LAVA.update(spilled, test.session, 33)

    // Assert
    expect(spilled.data).toMatchObject({ smokeMilliseconds: 800 })
    expect(waiting.data).toMatchObject({ smokeMilliseconds: 767 })
    expect(getActiveEmitterPositions(test)).toEqual([{ x: 605, y: -500, z: 19 }])
  })

  it('puts the vents on the other side of a mirrored track (+0x58)', () => {
    // Arrange
    const { test, loaded } = create(70, true)

    // Act
    LAVA.update(LAVA.begin(loaded, test.session, null), test.session, 33)

    // Assert
    expect(getActiveEmitterPositions(test)).toEqual([{ x: 605, y: 500, z: 19 }])
  })

  it('announces signal 0x2b and takes the sound 0xbba just after it rises at a vent (0x0048dc15)', () => {
    // Arrange
    const { test, loaded } = create(90)

    // Act
    const risen = LAVA.update(LAVA.begin(loaded, test.session, null), test.session, 33)
    const ended = LAVA.end(risen, test.session, null)

    // Assert
    expect(test.calls).toEqual([`startStop ${String(LAVA_SIGNAL)} ${String(LAVA_SIGNAL)}`])
    expect(risen.data).toMatchObject({ signalMilliseconds: 400, isSoundHeld: true })
    expect(test.effects).toEqual([
      { type: 'hazard.looped_sound_started', keyword: 0x2c, soundIdentifier: 0xbba },
      { type: 'hazard.looped_sound_stopped', keyword: 0x2c },
    ])
    expect(ended.data).toMatchObject({ isSoundHeld: false })
  })

  it('announces the signal again only after 400 ms', () => {
    // Arrange
    const { test, loaded } = create(64)
    const signalled = LAVA.update(LAVA.begin(loaded, test.session, null), test.session, 33)

    // Act
    const waiting = LAVA.update(signalled, test.session, 33)

    // Assert
    expect(test.calls).toHaveLength(1)
    expect(waiting.data).toMatchObject({ signalMilliseconds: 367 })
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
