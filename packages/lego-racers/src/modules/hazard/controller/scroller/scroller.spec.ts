import { NO_TEXTURE_SCROLL } from '../../../world-animation/index.ts'
import {
  createTestMeshInstance,
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { SCROLLER } from './scroller.ts'

const definition = { keyword: 0x36 as const, name: 'water', firstFloat: 2, secondFloat: -1 }

const createLoaded = () => {
  const test = createTestSession({
    track: createTestWorld(
      [createTestSkeletonInstance('flames')],
      [createTestMeshInstance('water')]
    ),
  })
  const requestedIndices: number[] = []
  const session = {
    ...test.session,
    getTableCosine: (index: number) => {
      requestedIndices.push(index)
      return 0.5
    },
  }
  return {
    test,
    session,
    requestedIndices,
    loaded: SCROLLER.create(definition, { isMirrored: false, session }),
  }
}

describe('the texture scroller', () => {
  it('sets the rates of its mesh instance to the floats times the table value', () => {
    // Arrange
    const { test, session, loaded } = createLoaded()
    const begun = SCROLLER.begin(loaded, session, null)

    // Act
    SCROLLER.update(begun, session, 33)

    // Assert
    expect(test.getWorld('track').meshInstances[0]?.textureScroll).toEqual({
      offsetU: 0,
      offsetV: 0,
      rateU: 65,
      rateV: -32,
    })
    expect(test.getWorld('track').skeletonInstances[0]?.textureScroll).toBe(NO_TEXTURE_SCROLL)
  })

  it('reads the table at the cycle position, a quarter turn behind, counted backwards', () => {
    // Arrange
    const { session, requestedIndices, loaded } = createLoaded()
    const begun = SCROLLER.begin(loaded, session, null)

    // Act
    const halfway = SCROLLER.update(begun, session, 5000)
    SCROLLER.update(halfway, session, 1000)

    // Assert
    expect(requestedIndices).toEqual([(1024 - 256 + 512) & 0x3ff, (1024 - 256 + 614) & 0x3ff])
  })
})
