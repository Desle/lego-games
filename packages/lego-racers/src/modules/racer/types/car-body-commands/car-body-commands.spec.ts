import { CarRigidBodyFlag } from '../../../racer-physics/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { createTestCarBodyWith } from '../racer-fixtures/racer-fixtures.ts'
import type { CarBody } from '../racer.types.ts'
import { addCarBodyImpulse, setCarBodyPush, startCarBodySpin } from './car-body-commands.ts'

const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)
const FORWARD = { x: 0, y: 1, z: 0 }
const BACKWARD = { x: 0, y: -1, z: 0 }

const createScripted = (speedFactor: number, flags = 0): CarBody => ({
  ...createTestCarBodyWith({ heading: FORWARD, flags, groundedWheelCount: 4 }),
  isScripted: true,
  speedFactor,
})

describe('addCarBodyImpulse, slot 8', () => {
  it('adds direction × amount / mass to the velocity of a free body (0x00448110)', () => {
    // Arrange
    const body = createTestCarBodyWith({ inverseMass: 0.5 })

    // Act
    const pushed = addCarBodyImpulse(arithmetic, body, { x: 1, y: 2, z: 3 }, 4)

    // Assert
    expect(pushed.rigidBody.linearVelocity).toEqual({ x: 2, y: 4, z: 6 })
  })

  it('raises the speed factor of a scripted body pushed forward by amount / 240 (0x00429770)', () => {
    // Arrange
    const body = createScripted(1)

    // Act
    const pushed = addCarBodyImpulse(arithmetic, body, FORWARD, 120)

    // Assert
    expect(pushed.speedFactor).toBe(1.5)
  })

  it('lowers it when pushed back, and the cosine term adds 0.25 per unit across the heading', () => {
    // Arrange
    const body = createScripted(1)

    // Act
    const pushedBack = addCarBodyImpulse(arithmetic, body, BACKWARD, 120)
    const pushedSideways = addCarBodyImpulse(arithmetic, body, { x: 1, y: 0, z: 0 }, 120)

    // Assert
    expect(pushedBack.speedFactor).toBe(0.5)
    expect(pushedSideways.speedFactor).toBe(Math.fround(1.55))
  })

  it('clamps the factor to [-0.5, 2.75] and uses 0.3 ± 0.1 while the body spins', () => {
    // Arrange
    const fast = createScripted(2.5)
    const slow = createScripted(-0.4)
    const spinning = createScripted(1, CarRigidBodyFlag.SPINNING)

    // Act
    const clampedFast = addCarBodyImpulse(arithmetic, fast, FORWARD, 240)
    const clampedSlow = addCarBodyImpulse(arithmetic, slow, BACKWARD, 240)
    const spunForward = addCarBodyImpulse(arithmetic, spinning, FORWARD, 240)
    const spunBack = addCarBodyImpulse(arithmetic, spinning, BACKWARD, 240)

    // Assert
    expect(clampedFast.speedFactor).toBe(2.75)
    expect(clampedSlow.speedFactor).toBe(-0.5)
    expect(spunForward.speedFactor).toBe(Math.fround(Math.fround(0.3) + Math.fround(0.1)))
    expect(spunBack.speedFactor).toBe(Math.fround(Math.fround(0.3) - Math.fround(0.1)))
  })
})

describe('startCarBodySpin, slot 9', () => {
  const RATE = Math.fround(0.01)

  it('starts the free body spin (0x00448160)', () => {
    // Arrange
    const body = createTestCarBodyWith({})

    // Act
    const spinning = startCarBodySpin(arithmetic, body, 1, RATE, 0)

    // Assert
    expect(spinning.rigidBody.yawTimer).toBe(628)
  })

  it('gives a scripted body a yaw timer, remembers the rate and slows its route to 0.3 (0x00429c40)', () => {
    // Arrange
    const body = createScripted(1)

    // Act
    const spinning = startCarBodySpin(arithmetic, body, 1, RATE, 0)
    const again = startCarBodySpin(arithmetic, spinning, 2, RATE, 0)

    // Assert
    expect(spinning.rigidBody.yawTimer).toBe(628)
    expect(spinning.rigidBody.flags & CarRigidBodyFlag.SPINNING).toBe(CarRigidBodyFlag.SPINNING)
    expect(spinning.scriptedSpinPeriod).toBe(RATE)
    expect(spinning.speedFactor).toBe(Math.fround(0.3))
    expect(again).toBe(spinning)
  })
})

describe('setCarBodyPush, slots 16 to 19', () => {
  it('sets and releases the extra force of a free body', () => {
    // Arrange
    const body = createTestCarBodyWith({ scaledMass: 2 })

    // Act
    const pushed = setCarBodyPush(arithmetic, body, 'extraForceA', { x: 1, y: 2, z: 3 })
    const released = setCarBodyPush(arithmetic, pushed, 'extraForceA', undefined)

    // Assert
    expect(pushed.rigidBody.extraForceA).toEqual({ x: 2, y: 4, z: 6 })
    expect(pushed.rigidBody.flags & CarRigidBodyFlag.EXTRA_FORCE_A).not.toBe(0)
    expect(released.rigidBody.flags & CarRigidBodyFlag.EXTRA_FORCE_A).toBe(0)
  })

  it('moves the target speed factor of a scripted body by the force along its heading / 300', () => {
    // Arrange
    const body = createScripted(1)

    // Act
    const pushed = setCarBodyPush(arithmetic, body, 'extraForceB', { x: 0, y: 150, z: 0 })
    const released = setCarBodyPush(arithmetic, pushed, 'extraForceB', undefined)

    // Assert
    expect(pushed.targetSpeedFactor).toBe(1.5)
    expect(pushed.rigidBody.flags & 0x40000).toBe(0x40000)
    expect(released.rigidBody.flags & 0x40000).toBe(0)
    expect(released.targetSpeedFactor).toBe(1)
  })
})
