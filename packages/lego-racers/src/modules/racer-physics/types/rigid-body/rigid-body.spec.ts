import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import { createBoxRigidBody, getAngularVelocity, getBoxInertia } from './rigid-body.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const DOUBLE = createFloatArithmetic(FpuPrecision.DOUBLE)

const ORIGIN_FRAME = { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z: 0 } }

describe('getBoxInertia', () => {
  it('computes (b² + c²) · (mass / a) / 12 per axis, as 0x00441260 does', () => {
    // Arrange: X = 13 · 12 / 12, Y = 10 · 6 / 12, Z = 5 · 4 · 0.083333336.
    const dimensions = { x: 1, y: 2, z: 3 }

    // Act
    const single = getBoxInertia(SINGLE, 12, dimensions)
    const double = getBoxInertia(DOUBLE, 12, dimensions)

    // Assert
    const inertiaZ = Math.fround(20 * Math.fround(1 / 12))
    const expected = {
      localInertia: [13, 0, 0, 0, 5, 0, 0, 0, inertiaZ],
      localInverseInertia: [
        Math.fround(1 / 13),
        0,
        0,
        0,
        Math.fround(0.2),
        0,
        0,
        0,
        // 1 / 1.6666667 is 0.59999996 (0x3f199999), one unit below 0.6.
        Math.fround(1 / inertiaZ),
      ],
    }
    expect(single).toEqual(expected)
    expect(double).toEqual(expected)
  })
})

describe('createBoxRigidBody', () => {
  it('starts at rest with the inverse mass and the world inverse inertia of its frame', () => {
    // Arrange
    const definition = { frame: ORIGIN_FRAME, mass: 12, dimensions: { x: 1, y: 2, z: 3 } }

    // Act
    const body = createBoxRigidBody(SINGLE, definition)

    // Assert
    expect(body.mass).toBe(12)
    expect(body.inverseMass).toBe(Math.fround(1 / 12))
    expect(body.worldInverseInertia).toEqual(body.localInverseInertia)
    expect(body.linearVelocity).toEqual({ x: 0, y: 0, z: 0 })
    expect(body.angularMomentum).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('getAngularVelocity', () => {
  it('multiplies the angular momentum as a row vector by the world inverse inertia', () => {
    // Arrange
    const body = {
      ...createBoxRigidBody(SINGLE, {
        frame: ORIGIN_FRAME,
        mass: 1,
        dimensions: { x: 1, y: 1, z: 1 },
      }),
      worldInverseInertia: [1, 2, 3, 4, 5, 6, 7, 8, 9] as const,
      angularMomentum: { x: 1, y: 1, z: 1 },
    }

    // Act
    const angularVelocity = getAngularVelocity(SINGLE, body)

    // Assert
    expect(angularVelocity).toEqual({ x: 12, y: 15, z: 18 })
  })
})
