import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { HazardMotion } from '../projectile-world/projectile-world.types.ts'
import { getCurseTrackFrame } from './curse-frame.ts'

const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)

const createMotion = (overrides: Partial<HazardMotion>): HazardMotion =>
  Object.freeze({
    kind: 'hazard',
    position: { x: 10, y: 20, z: 1 },
    groundNormal: { x: 0, y: 0, z: 1 },
    routeNormal: { x: 1, y: 0, z: 0 },
    landingMilliseconds: 33,
    ...overrides,
  })

describe('getCurseTrackFrame', () => {
  it('raises the floating figure 13 above the ground point along the normal (0x00452ae0)', () => {
    // Arrange
    const motion = createMotion({})

    // Act
    const frame = getCurseTrackFrame(arithmetic, motion)

    // Assert
    expect(frame?.groundPosition).toEqual({ x: 10, y: 20, z: 1 })
    expect(frame?.floatingPosition).toEqual({ x: 10, y: 20, z: 14 })
  })

  it('turns every figure to face along the normal crossed with the route normal, the normal up', () => {
    // Arrange
    const motion = createMotion({ routeNormal: { x: 0, y: 1, z: 0 } })

    // Act
    const frame = getCurseTrackFrame(arithmetic, motion)

    // Assert
    expect(frame?.rotation).toEqual([-1, 0, 0, 0, -1, 0, 0, 0, 1])
  })

  it('has no frame when the landing missed the ground', () => {
    // Arrange
    const motion = createMotion({ groundNormal: null })

    // Act
    const frame = getCurseTrackFrame(arithmetic, motion)

    // Assert
    expect(frame).toBeNull()
  })
})
