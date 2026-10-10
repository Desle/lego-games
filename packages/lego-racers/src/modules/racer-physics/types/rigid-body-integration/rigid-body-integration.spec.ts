import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import { createBoxRigidBody } from '../rigid-body/rigid-body.ts'
import { addForce, addTorqueOfForceAtPoint } from '../rigid-body-forces/rigid-body-forces.ts'
import { integrateRigidBody } from './rigid-body-integration.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const DOUBLE = createFloatArithmetic(FpuPrecision.DOUBLE)

const getFloatFromBits = (bits: number): number =>
  new Float32Array(new Uint32Array([bits]).buffer)[0] ?? Number.NaN

const createBody = (mass: number) =>
  createBoxRigidBody(SINGLE, {
    frame: { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z: 0 } },
    mass,
    dimensions: { x: 1, y: 1, z: 1 },
  })

describe('integrateRigidBody', () => {
  it('moves by v·dt + (dt / 2)·Δv with Δv = F·dt / m, then adds Δv', () => {
    // Arrange: Δv = 4 · 10 · 0.5 = 20 and -6 · 10 · 0.5 = -30.
    const body = addForce(SINGLE, createBody(2), { x: 4, y: -6, z: 0 })

    // Act
    const result = integrateRigidBody(SINGLE, body, 10)

    // Assert
    expect(result.frame.position).toEqual({ x: 100, y: -150, z: 0 })
    expect(result.linearVelocity).toEqual({ x: 20, y: -30, z: 0 })
    expect(result.force).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('zeroes speeds under 0.0001 when no force acts, after moving with them', () => {
    // Arrange
    const slowSpeed = Math.fround(0.00005)
    const body = { ...createBody(1), linearVelocity: { x: slowSpeed, y: 0.5, z: -slowSpeed } }

    // Act
    const result = integrateRigidBody(SINGLE, body, 10)

    // Assert
    expect(result.linearVelocity).toEqual({ x: 0, y: 0.5, z: 0 })
    expect(result.frame.position.x).toBe(Math.fround(slowSpeed * 10))
    expect(result.frame.position.y).toBe(5)
  })

  it('keeps slow speeds while any force acts', () => {
    // Arrange
    const slowSpeed = Math.fround(0.00005)
    const body = addForce(
      SINGLE,
      { ...createBody(1), linearVelocity: { x: slowSpeed, y: 0, z: 0 } },
      { x: 0, y: 2, z: 0 }
    )

    // Act
    const result = integrateRigidBody(SINGLE, body, 10)

    // Assert
    expect(result.linearVelocity.x).toBe(slowSpeed)
  })

  it('turns the frame by the angular velocity of the step and re-orthonormalizes it', () => {
    // Arrange: ω_z = 2^-5 · 0.5 = 2^-6, so the step turns by 0.125; row 0 becomes (1, 0.125, 0) normalized.
    const body = {
      ...createBody(1),
      worldInverseInertia: [1, 0, 0, 0, 1, 0, 0, 0, 0.5] as const,
      angularMomentum: { x: 0, y: 0, z: 2 ** -5 },
    }

    // Act
    const single = integrateRigidBody(SINGLE, body, 8)
    const double = integrateRigidBody(DOUBLE, body, 8)

    // Assert
    const cosine = getFloatFromBits(0x3f7e05ec)
    const sine = getFloatFromBits(0x3dfe05ec)
    const expected = [cosine, sine, 0, -sine, cosine, 0, 0, 0, 1]
    expect(single.frame.rotation).toEqual(expected)
    expect(double.frame.rotation).toEqual(expected)
    expect(single.angularVelocity).toEqual({ x: 0, y: 0, z: 2 ** -6 })
    expect(single.angularMomentum).toEqual({ x: 0, y: 0, z: 2 ** -5 })
  })

  it('stops the rotation when no torque acts and the step turns less than √0.0006', () => {
    // Arrange: the step turns by 2^-6, and 2^-12 < 0.0006.
    const body = {
      ...createBody(1),
      worldInverseInertia: [1, 0, 0, 0, 1, 0, 0, 0, 0.5] as const,
      angularMomentum: { x: 0, y: 0, z: 2 ** -5 },
    }

    // Act
    const result = integrateRigidBody(SINGLE, body, 1)

    // Assert
    expect(result.angularVelocity).toEqual({ x: 0, y: 0, z: 0 })
    expect(result.angularMomentum).toEqual({ x: 0, y: 0, z: 0 })
  })

  it('adds torque · dt to the angular momentum and clears the torque', () => {
    // Arrange: force (0, 1, 0) at (1, 0, 0) gives torque (0, 0, 1).
    const body = addTorqueOfForceAtPoint(
      SINGLE,
      createBody(1),
      { x: 0, y: 1, z: 0 },
      { x: 1, y: 0, z: 0 }
    )

    // Act
    const result = integrateRigidBody(SINGLE, body, 10)

    // Assert
    expect(result.angularMomentum).toEqual({ x: 0, y: 0, z: 10 })
    expect(result.torque).toEqual({ x: 0, y: 0, z: 0 })
    expect(result.frame.rotation).toEqual(IDENTITY_MATRIX3)
  })
})
