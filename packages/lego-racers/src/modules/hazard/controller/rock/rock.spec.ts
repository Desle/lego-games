import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import {
  createTestMeshInstance,
  createTestRacer,
  createTestSession,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { ROCK, ROCK_IDENTIFIER, ROCK_SIGNAL } from './rock.ts'

const createLoaded = () => {
  const test = createTestSession({
    track: createTestWorld(
      [],
      [createTestMeshInstance('mmrocof'), createTestMeshInstance('mmrocon')]
    ),
  })
  return {
    test,
    loaded: ROCK.create({ keyword: 0x2e }, { isMirrored: false, session: test.session }),
  }
}

const getDistances = (test: ReturnType<typeof createLoaded>['test']) =>
  test.getWorld('track').meshInstances.map((instance) => instance.levelSquaredDistances)

describe('the rock', () => {
  it('hides the "on" mesh and keeps the "off" mesh at its distances when it loads', () => {
    // Arrange
    // Act
    const { test, loaded } = createLoaded()

    // Assert
    expect(loaded.identifier).toBe(ROCK_IDENTIFIER)
    expect(getDistances(test)).toEqual([
      [100, 200, 300],
      [-1, -1, -1],
    ])
    expect(test.effects).toEqual([
      { type: 'hazard.collision_object_changed', name: 'mmrocc', isSolid: true },
    ])
  })

  it('swaps the meshes on the next update after a shielded racer touches it', () => {
    // Arrange
    const { test, loaded } = createLoaded()
    const begun = ROCK.begin(loaded, test.session, null)

    // Act
    const touched = ROCK.touch(begun, test.session, createTestRacer(0, 1))
    const swapped = ROCK.update(touched, test.session, 33)

    // Assert
    expect(touched.data).toMatchObject({ flag: 0 })
    expect(swapped.data).toMatchObject({ flag: 1 })
    expect(getDistances(test)).toEqual([
      [-1, -1, -1],
      [100, 200, 300],
    ])
    // The loader stopped the signal; the swap starts it.
    expect(test.calls).toEqual([`stop ${String(ROCK_SIGNAL)}`, `start ${String(ROCK_SIGNAL)}`])
  })

  it('ignores a racer without a shield', () => {
    // Arrange
    const { test, loaded } = createLoaded()
    const begun = ROCK.begin(loaded, test.session, null)

    // Act
    const touched = ROCK.touch(begun, test.session, createTestRacer(0, 0))

    // Assert
    expect(touched).toBe(begun)
  })

  it('turns itself off again when it ends', () => {
    // Arrange
    const { test, loaded } = createLoaded()
    const begun = ROCK.begin(loaded, test.session, null)
    ROCK.update(ROCK.touch(begun, test.session, createTestRacer(0, 1)), test.session, 33)

    // Act
    const ended = ROCK.end(begun, test.session, null)

    // Assert
    expect(ended.lifecycle).toBe(HazardLifecycle.IDLE)
    expect(getDistances(test)).toEqual([
      [100, 200, 300],
      [-1, -1, -1],
    ])
  })

  it('registers a sphere of radius 350 at the "off" mesh while it is active', () => {
    // Arrange
    const { test, loaded } = createLoaded()

    // Act
    const begun = ROCK.begin(loaded, test.session, null)

    // Assert
    expect(ROCK.getRegisteredSphere(loaded)).toBeNull()
    expect(ROCK.getRegisteredSphere(begun)).toEqual({ centre: [0, 0, 0], radius: 350 })
  })
})
