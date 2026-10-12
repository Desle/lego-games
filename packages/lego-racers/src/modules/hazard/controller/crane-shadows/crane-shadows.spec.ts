import { CRANE } from '../crane/crane.ts'
import {
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import { getCraneShadows } from './crane-shadows.ts'

const createShadowsAt = (lifecycle: number) => {
  const test = createTestSession({
    track: createTestWorld([
      createTestSkeletonInstance('crane', {
        rotation: [0, 1, 0, -1, 0, 0, 0, 0, 1],
        levelSquaredDistances: [360000, 4000000, 8000000],
      }),
    ]),
  })
  const loaded = CRANE.create({ keyword: 0x32 }, { isMirrored: false, session: test.session })
  const instance = { ...loaded, lifecycle, data: { ...loaded.data, bone: [3, 4, 5] as const } }
  return getCraneShadows(
    { instances: [instance] },
    { track: test.session.getWorld('track'), blended: test.session.getWorld('blended') }
  )
}

describe('getCraneShadows', () => {
  it('puts the shadow under the bone the last update found, with the first frame row and the draw distance', () => {
    // Arrange / Act
    const shadows = createShadowsAt(HazardLifecycle.ACTIVE)

    // Assert
    expect(shadows).toEqual([
      {
        bone: { x: 3, y: 4, z: 5 },
        upHint: { x: 0, y: 1, z: 0 },
        maximumSquaredDistance: 360000,
      },
    ])
  })

  it('leaves out a crane that is idle', () => {
    // Arrange / Act
    const shadows = createShadowsAt(HazardLifecycle.IDLE)

    // Assert
    expect(shadows).toEqual([])
  })
})
