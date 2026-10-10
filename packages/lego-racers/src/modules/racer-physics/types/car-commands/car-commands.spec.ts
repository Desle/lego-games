import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import { CarRigidBodyFlag, createCarRigidBody } from '../car-rigid-body/car-rigid-body.ts'
import {
  addImpulse,
  addScaledImpulse,
  setExtraForce,
  setFlaggedTimer,
  setLeaning,
  setThrottle,
  setTopSpeed,
} from './car-commands.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const CAR = createCarRigidBody(SINGLE, {
  displayFrame: { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z: 0 } },
  displayBoundingRadius: 5,
  mass: 2,
  dimensions: { x: 8, y: 5, z: 6.2 },
})

describe('setThrottle and setTopSpeed', () => {
  it('keep the drag at mass × |throttle| / top speed² (0x004483b0)', () => {
    // Arrange
    const slower = setTopSpeed(SINGLE, CAR, 10)

    // Act
    const forward = setThrottle(SINGLE, slower, 5)
    const reverse = setThrottle(SINGLE, slower, -5)
    const idle = setThrottle(SINGLE, forward, 0)

    // Assert
    expect([forward.drag, reverse.drag, idle.drag]).toEqual([
      0.10000000149011612, 0.10000000149011612, 0,
    ])
  })
})

describe('impulses', () => {
  it('add impulse / mass to the velocity (0x004480c0, 0x00448110)', () => {
    // Arrange
    const impulse = { x: 2, y: 4, z: -6 }

    // Act
    const pushed = addImpulse(SINGLE, CAR, impulse)
    const scaled = addScaledImpulse(SINGLE, CAR, impulse, 3)

    // Assert
    expect(pushed.linearVelocity).toEqual({ x: 1, y: 2, z: -3 })
    expect(scaled.linearVelocity).toEqual({ x: 3, y: 6, z: -9 })
  })
})

describe('flag commands', () => {
  it('set and clear the extra forces, the flagged countdown and the lean', () => {
    // Arrange
    const force = { x: 1, y: 0, z: 0 }

    // Act
    const withForce = setExtraForce(SINGLE, CAR, 'extraForceB', force)
    const withoutForce = setExtraForce(SINGLE, withForce, 'extraForceB', undefined)
    const flagged = setFlaggedTimer(CAR, true)
    const leaning = setLeaning(CAR, 0.7)

    // Assert
    expect(withForce.extraForceB).toEqual({ x: CAR.scaledMass, y: 0, z: 0 })
    expect(withForce.flags).toBe(CarRigidBodyFlag.EXTRA_FORCE_B)
    expect(withoutForce.flags).toBe(0)
    expect([flagged.flaggedTimer, flagged.flags]).toEqual([600, CarRigidBodyFlag.FLAGGED])
    expect([leaning.leanFactor, leaning.flags]).toEqual([0.7, CarRigidBodyFlag.LEANING])
  })
})
