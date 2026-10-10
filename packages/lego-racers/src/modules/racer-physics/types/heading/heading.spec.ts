import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import { CarRigidBodyFlag, createCarRigidBody } from '../car-rigid-body/car-rigid-body.ts'
import { getTableArcCosine, getWithVelocitySplit, updateHeading } from './heading.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const CAR = createCarRigidBody(SINGLE, {
  displayFrame: { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z: 0 } },
  displayBoundingRadius: 5,
  mass: 1,
  dimensions: { x: 8, y: 5, z: 6.2 },
})

describe('getTableArcCosine', () => {
  it('reads the table at 0x004c07ec, including the three entries one unit lower than fround(acos)', () => {
    // Arrange
    const cosines = [-1, 1, 0, -1 + 396 / 511.5]

    // Act
    const angles = cosines.map((cosine) => getTableArcCosine(SINGLE, cosine))

    // Assert
    expect(angles).toEqual([
      Math.fround(Math.PI),
      0,
      Math.fround(Math.acos(-1 + 511 / 511.5)),
      new Float32Array(new Uint32Array([0x3fe63772]).buffer)[0],
    ])
  })
})

describe('getWithVelocitySplit', () => {
  it('splits the velocity along and across the heading and records its length (0x00447330)', () => {
    // Arrange
    const moving = { ...CAR, linearVelocity: { x: 3, y: 4, z: 0 } }

    // Act
    const split = getWithVelocitySplit(SINGLE, moving)

    // Assert
    expect(split.speed).toBe(5)
    expect(split.velocityDirection).toEqual({ x: 0.6000000238418579, y: 0.800000011920929, z: 0 })
    expect(split.forwardSpeed).toBe(3)
    expect(split.forwardVelocity).toEqual({ x: 3, y: 0, z: 0 })
    expect(split.lateralVelocity).toEqual({ x: 0, y: 4, z: 0 })
    expect(split.flags & CarRigidBodyFlag.AT_REST).toBe(0)
  })

  it('marks a body without linear and angular velocity as at rest, its direction along row 0', () => {
    // Arrange
    const still = { ...CAR, velocityDirection: { x: 0, y: 1, z: 0 } }

    // Act
    const split = getWithVelocitySplit(SINGLE, still)

    // Assert
    expect(split.flags & CarRigidBodyFlag.AT_REST).toBe(CarRigidBodyFlag.AT_REST)
    expect(split.velocityDirection).toEqual({ x: 1, y: 0, z: 0 })
    expect(split.speed).toBe(0)
  })
})

describe('updateHeading', () => {
  it('snaps to rotation row 0 when they are within 0.98 of each other (0x00447230)', () => {
    // Arrange
    const near = { ...CAR, heading: { x: 0.99, y: 0.141, z: 0 } }

    // Act
    const updated = updateHeading(SINGLE, near, 40)

    // Assert
    expect(updated.heading).toEqual({ x: 1, y: 0, z: 0 })
  })

  it('turns at most step × 0.0025 radians toward rotation row 0', () => {
    // Arrange
    const sideways = { ...CAR, heading: { x: 0, y: 1, z: 0 } }

    // Act
    const updated = updateHeading(SINGLE, sideways, 40)

    // Assert
    const angle = Math.atan2(updated.heading.y, updated.heading.x)
    expect(angle).toBeCloseTo(Math.PI / 2 - 0.1, 5)
  })
})
