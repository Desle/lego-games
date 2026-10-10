import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import { CarRigidBodyFlag, createCarRigidBody } from '../car-rigid-body/car-rigid-body.ts'
import { applyCarForces, endDrift, setYawRate } from './car-forces.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const CAR = createCarRigidBody(SINGLE, {
  displayFrame: { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z: 0 } },
  displayBoundingRadius: 5,
  mass: 1000,
  dimensions: { x: 8, y: 5, z: 6.2 },
})

describe('setYawRate', () => {
  it('replaces the angular momentum about row 2 with inertia × rate and starts the yaw timer (0x00445c30)', () => {
    // Arrange
    const spinning = { ...CAR, angularMomentum: { x: 1, y: 2, z: 3 } }

    // Act
    const turned = setYawRate(SINGLE, spinning, 0.5, 200)

    // Assert
    expect(turned.angularMomentum).toEqual({
      x: 1,
      y: 2,
      z: Math.fround(0.5 * CAR.localInertia[8]),
    })
    expect(turned.yawTimer).toBe(200)
  })
})

describe('applyCarForces', () => {
  it('pulls an airborne car down with four times its weight and steers by the turn radius', () => {
    // Arrange
    const airborne = { ...CAR, turnRadius: 50, forwardSpeed: 0.5 }

    // Act
    const pushed = applyCarForces(SINGLE, airborne)

    // Assert
    const weight = Math.fround(-39 * CAR.scaledMass)
    expect(pushed.weight).toBe(weight)
    expect(pushed.force).toEqual({ x: 0, y: 0, z: Math.fround(weight * 4) })
    expect(pushed.yawTimer).toBe(200)
    expect(pushed.angularMomentum.z).toBe(Math.fround(Math.fround(0.5 / 50) * CAR.localInertia[8]))
  })

  it('throttles along the heading in the air, but never upward harder than gravity', () => {
    // Arrange
    const climbing = { ...CAR, throttle: 1e9, heading: { x: 0, y: 0, z: 1 } }

    // Act
    const pushed = applyCarForces(SINGLE, climbing)

    // Assert
    const weight = Math.fround(-39 * CAR.scaledMass)
    expect(pushed.force.z).toBe(Math.fround(Math.fround(weight * 4) + -weight))
  })

  it('ends a drift whose velocity points behind the car (0x00448070)', () => {
    // Arrange
    const drifting = {
      ...CAR,
      flags: CarRigidBodyFlag.DRIFTING,
      velocityDirection: { x: -1, y: 0, z: 0 },
      driftThreshold: 0.5,
    }

    // Act
    const pushed = applyCarForces(SINGLE, drifting)

    // Assert
    expect(pushed.flags & CarRigidBodyFlag.DRIFTING).toBe(0)
    expect(pushed.driftThreshold).toBe(-1)
    expect(endDrift(drifting).driftMaximumAngle).toBe(Math.fround(Math.PI))
  })
})
