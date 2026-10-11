import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Matrix3 } from '../../../simulation-math/index.ts'
import type { BoundingSphere } from '../racer-collision.types.ts'
import { getBoundingInterval, getBoundingSphere, getSpheresOverlap } from './bounding-sphere.ts'

const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)
// A half turn about z.
const HALF_TURN: Matrix3 = [-1, 0, 0, 0, -1, 0, 0, 0, 1]

const createSphere = (x: number, radius: number): BoundingSphere => ({
  centre: { x, y: 0, z: 0 },
  radius,
})

describe('getBoundingSphere', () => {
  it('carries the model centre through the frame (0x00410d60) and keeps the radius', () => {
    // Arrange
    const frame = { rotation: HALF_TURN, position: { x: 10, y: 20, z: 30 } }

    // Act
    const sphere = getBoundingSphere(arithmetic, frame, { x: 1, y: 2, z: 3 }, 4)

    // Assert
    expect(sphere).toEqual({ centre: { x: 9, y: 18, z: 33 }, radius: 4 })
  })
})

describe('getBoundingInterval', () => {
  it('stores centre minus radius and radius plus centre along x (0x00410f10)', () => {
    // Arrange
    const sphere = { centre: { x: 10, y: 0, z: 0 }, radius: 2.5 }

    // Act
    const interval = getBoundingInterval(arithmetic, sphere)

    // Assert
    expect(interval).toEqual({ minimum: 7.5, maximum: 12.5 })
  })
})

describe('getSpheresOverlap', () => {
  it('is true when the squared distance is below the squared radius sum', () => {
    // Arrange
    const first = createSphere(0, 1)
    const second = createSphere(1.9, 1)

    // Act
    const isOverlapping = getSpheresOverlap(arithmetic, first, second)

    // Assert
    expect(isOverlapping).toBe(true)
  })

  it('is false when the distance equals the radius sum', () => {
    // Arrange
    const first = createSphere(0, 1)
    const second = createSphere(2, 1)

    // Act
    const isOverlapping = getSpheresOverlap(arithmetic, first, second)

    // Assert
    expect(isOverlapping).toBe(false)
  })

  it('treats an unordered squared distance as no overlap (FCOM reports it equal to FLT_MAX)', () => {
    // Arrange
    const first = createSphere(0, 1)
    const second = createSphere(Number.NaN, 1)

    // Act
    const isOverlapping = getSpheresOverlap(arithmetic, first, second)

    // Assert
    expect(isOverlapping).toBe(false)
  })

  it('counts two spheres with the same centre as overlapping', () => {
    // Arrange
    const sphere = createSphere(3, 1)

    // Act
    const isOverlapping = getSpheresOverlap(arithmetic, sphere, sphere)

    // Assert
    expect(isOverlapping).toBe(true)
  })
})
