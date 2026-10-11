import type { MaterialAnimation } from '../../../material-animation/index.ts'
import {
  advanceWorldAnimation,
  EMPTY_WORLD_ANIMATION,
  IDLE_MATERIAL_PLAYBACK,
} from '../../../world-animation/index.ts'
import type { WorldAnimation } from '../../../world-animation/index.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import {
  createTestSession,
  createTestSkeletonInstance,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { SPHINX, SPHINX_EXPLOSION_SIGNAL } from './sphinx.ts'

// A material animation of four entries, each running over 10 frames at one frame per 10 ms.
const definition: MaterialAnimation = Object.freeze({
  materials: [{ materialName: 'boom', value: 0 }],
  entries: [0, 1, 2, 3].map(() => ({
    keyword27Values: [0, 1] as const,
    keyword29Value: 10,
    keyword2aValue: 0.1,
  })),
  readByteCount: 0,
})

const createBlendedWorld = (): WorldAnimation => ({
  ...EMPTY_WORLD_ANIMATION,
  skeletonInstances: [createTestSkeletonInstance('blowup')],
  materialAnimations: [
    {
      name: 'blowup',
      definition,
      entries: [0, 1, 2, 3].map(() => ({
        ...IDLE_MATERIAL_PLAYBACK,
        isPlaying: true,
        isLooping: true,
      })),
    },
  ],
})

const createLoaded = () => {
  const test = createTestSession({ blended: createBlendedWorld() })
  return {
    test,
    loaded: SPHINX.create({ keyword: 0x29 }, { isMirrored: false, session: test.session }),
  }
}

describe('the sphinx', () => {
  it("starts the explosion's one-shot entries, stops the idle ones and tells the events", () => {
    // Arrange
    const { test, loaded } = createLoaded()

    // Act
    const begun = SPHINX.begin(loaded, test.session, null)

    // Assert
    const entries = test.getWorld('blended').materialAnimations[0]?.entries ?? []
    expect(begun.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(entries.map((entry) => [entry.isPlaying, entry.isLooping])).toEqual([
      [false, false],
      [false, false],
      [true, false],
      [true, false],
    ])
    expect(test.calls).toEqual([`start ${String(SPHINX_EXPLOSION_SIGNAL)}`])
    expect(test.effects).toEqual([
      { type: 'hazard.collision_object_changed', name: 'sphinx', isSolid: false },
    ])
  })

  it('ends when the one-shot entry has finished: the signal stops and the explosion is spent', () => {
    // Arrange
    const { test, loaded } = createLoaded()
    const begun = SPHINX.begin(loaded, test.session, null)
    test.session.setWorld('blended', advanceWorldAnimation(test.getWorld('blended'), 500))

    // Act
    const ended = SPHINX.update(begun, test.session, 33)

    // Assert
    expect(ended.lifecycle).toBe(HazardLifecycle.IDLE)
    expect(test.calls).toEqual([
      `start ${String(SPHINX_EXPLOSION_SIGNAL)}`,
      `stop ${String(SPHINX_EXPLOSION_SIGNAL)}`,
    ])
    expect(test.getWorld('blended').skeletonInstances[0]?.levelSquaredDistances).toEqual([
      -1, -1, -1,
    ])
  })

  it('does not explode a second time', () => {
    // Arrange
    const { test, loaded } = createLoaded()
    const begun = SPHINX.begin(loaded, test.session, null)
    test.session.setWorld('blended', advanceWorldAnimation(test.getWorld('blended'), 500))
    const ended = SPHINX.update(begun, test.session, 33)

    // Act
    const again = SPHINX.begin(ended, test.session, null)

    // Assert
    expect(again).toBe(ended)
  })

  it('stays active while the explosion plays', () => {
    // Arrange
    const { test, loaded } = createLoaded()
    const begun = SPHINX.begin(loaded, test.session, null)

    // Act
    const playing = SPHINX.update(begun, test.session, 33)

    // Assert
    expect(playing.lifecycle).toBe(HazardLifecycle.ACTIVE)
  })
})
