import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import { createBoxRigidBody } from '../rigid-body/rigid-body.ts'
import {
  addAngularVelocity,
  addForce,
  addTorqueOfForceAtPoint,
  removeAngularMomentumAgainstForce,
  removeAngularMomentumAlongAxis,
} from './rigid-body-forces.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const createBody = () =>
  createBoxRigidBody(SINGLE, {
    frame: { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z: 0 } },
    mass: 1,
    dimensions: { x: 1, y: 1, z: 1 },
  })

describe('addForce', () => {
  it('accumulates forces', () => {
    // Arrange
    const body = addForce(SINGLE, createBody(), { x: 1, y: 2, z: 3 })

    // Act
    const result = addForce(SINGLE, body, { x: 1, y: -2, z: 0.5 })

    // Assert
    expect(result.force).toEqual({ x: 2, y: 0, z: 3.5 })
  })
})

describe('addTorqueOfForceAtPoint', () => {
  it('adds (point - centre of mass) × force to the torque only', () => {
    // Arrange
    const body = { ...createBody(), worldCentreOfMass: { x: 1, y: 0, z: 0 } }

    // Act
    const result = addTorqueOfForceAtPoint(SINGLE, body, { x: 0, y: 3, z: 0 }, { x: 3, y: 0, z: 0 })

    // Assert
    expect(result.torque).toEqual({ x: 0, y: 0, z: 6 })
    expect(result.force).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('removeAngularMomentumAlongAxis', () => {
  it('subtracts the projection on the axis', () => {
    // Arrange
    const body = { ...createBody(), angularMomentum: { x: 1, y: 2, z: 3 } }

    // Act
    const result = removeAngularMomentumAlongAxis(SINGLE, body, { x: 0, y: 1, z: 0 })

    // Assert
    expect(result.angularMomentum).toEqual({ x: 1, y: 0, z: 3 })
  })
})

describe('removeAngularMomentumAgainstForce', () => {
  it('removes the momentum along normalize(arm × force) only when it points that way (0x00440cb0)', () => {
    // Arrange: arm +x, force +z, so the axis is (arm × force) = -y.
    const withMomentum = (y: number) => ({ ...createBody(), angularMomentum: { x: 1, y, z: 2 } })
    const point = { x: 1, y: 0, z: 0 }
    const force = { x: 0, y: 0, z: 1 }

    // Act
    const along = removeAngularMomentumAgainstForce(SINGLE, withMomentum(-3), force, point)
    const against = removeAngularMomentumAgainstForce(SINGLE, withMomentum(3), force, point)

    // Assert
    expect(along.angularMomentum).toEqual({ x: 1, y: 0, z: 2 })
    expect(against.angularMomentum).toEqual({ x: 1, y: 3, z: 2 })
  })
})

describe('addAngularVelocity', () => {
  it('adds the frame inertia times the rate to the angular momentum (0x00440bd0)', () => {
    // Arrange
    const body = createBody()

    // Act
    const turned = addAngularVelocity(SINGLE, body, { x: 0, y: 0, z: 2 })

    // Assert
    expect(turned.angularMomentum).toEqual({ x: 0, y: 0, z: Math.fround(body.localInertia[8] * 2) })
  })
})
