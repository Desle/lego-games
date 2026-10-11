import { CarRigidBodyFlag } from '../../../racer-physics/index.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { createTestCarBodyWith } from '../racer-fixtures/racer-fixtures.ts'
import type { CarBody } from '../racer.types.ts'
import {
  addCarBodyImpulse,
  clearCarBodyTwoPointMode,
  setCarBodyPush,
  setCarBodyTwoPointMode,
  startCarBodyBoost,
  startCarBodyFlip,
  startCarBodySpin,
} from './car-body-commands.ts'

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

describe('the flip and the two-point mode', () => {
  it('starts a scripted body flipping with the opposite rate and the timer (0x00429cf0)', () => {
    // Arrange
    const body = createScripted(1)

    // Act
    const flipping = startCarBodyFlip(arithmetic, body, Math.fround(0.0015), 150)
    const again = startCarBodyFlip(arithmetic, flipping, 0.5, 20)

    // Assert
    expect(flipping.flipRate).toBe(Math.fround(-0.0015))
    expect(flipping.flipAngle).toBe(0)
    expect(flipping.rigidBody.pitchTimer).toBe(150)
    expect(again).toBe(flipping)
  })

  it('starts a free body pitching about its second axis unless the roll timer runs (0x00445bb0)', () => {
    // Arrange
    const body = createTestCarBodyWith({ inverseMass: 1 })
    const rolling = createTestCarBodyWith({ rollTimer: 10 })

    // Act
    const pitching = startCarBodyFlip(arithmetic, body, 0.0015, 150)
    const unchanged = startCarBodyFlip(arithmetic, rolling, 0.0015, 150)

    // Assert
    expect(pitching.rigidBody.pitchTimer).toBe(150)
    expect(unchanged.rigidBody.pitchTimer).toBe(0)
  })

  it('puts a scripted body in two-point mode with a flip and the targets 6 and 3 (0x00429b40)', () => {
    // Arrange
    const body = createScripted(1)

    // Act
    const twoPoint = setCarBodyTwoPointMode(arithmetic, body)
    const again = setCarBodyTwoPointMode(arithmetic, twoPoint)

    // Assert
    expect(twoPoint.rigidBody.flags & CarRigidBodyFlag.TWO_POINT).toBe(CarRigidBodyFlag.TWO_POINT)
    expect(twoPoint.rigidBody.pitchTimer).toBe(250)
    expect(twoPoint.flipRate).toBe(Math.fround(0.003))
    expect(twoPoint.rigidBody.twoPointTargetHeight).toBe(6)
    expect(twoPoint.rigidBody.twoPointHeightRate).toBe(3)
    expect(again).toBe(twoPoint)
  })

  it('puts a free body in two-point mode and sets the points (0x00448660), and takes it out (0x00448730)', () => {
    // Arrange
    const body = createTestCarBodyWith({ twoPointHeight: 2, twoPointTilt: 1, trackWidth: 2 })

    // Act
    const twoPoint = setCarBodyTwoPointMode(arithmetic, body)
    const released = clearCarBodyTwoPointMode(twoPoint)

    // Assert
    expect(twoPoint.rigidBody.flags & CarRigidBodyFlag.TWO_POINT).toBe(CarRigidBodyFlag.TWO_POINT)
    expect(twoPoint.rigidBody.twoPointHeight).toBe(0)
    expect(twoPoint.rigidBody.twoPointTilt).toBe(0)
    expect(twoPoint.rigidBody.pitchTimer).toBe(150)
    expect(released.rigidBody.flags & CarRigidBodyFlag.TWO_POINT).toBe(0)
  })

  it('lets a scripted body fall back with a target of 0 at 15 per step (0x00429bc0)', () => {
    // Arrange
    const twoPoint = setCarBodyTwoPointMode(arithmetic, createScripted(1))

    // Act
    const released = clearCarBodyTwoPointMode(twoPoint)

    // Assert
    expect(released.rigidBody.flags & CarRigidBodyFlag.TWO_POINT).toBe(0)
    expect(released.rigidBody.twoPointTargetHeight).toBe(0)
    expect(released.rigidBody.twoPointHeightRate).toBe(15)
  })
})

describe('startCarBodyBoost, 0x004292e0', () => {
  it('sets flag 0x10000, a grip scale of 1.5 and a top speed of 176 times the top speed scale', () => {
    // Arrange
    const body = { ...createTestCarBodyWith({ flags: 0 }), topSpeedScale: 0.5 }

    // Act
    const boosted = startCarBodyBoost(arithmetic, body)

    // Assert
    expect(boosted.rigidBody.flags & 0x10000).toBe(0x10000)
    expect(boosted.rigidBody.gripScale).toBe(1.5)
    expect(boosted.rigidBody.topSpeed).toBe(88)
  })

  it('gives a scripted body the speed factor 1.7', () => {
    // Arrange
    const body = createScripted(1)

    // Act
    const boosted = startCarBodyBoost(arithmetic, body)

    // Assert
    expect(boosted.speedFactor).toBe(Math.fround(1.7))
  })

  it('does nothing to a body that an effect holds (flag 0x80000)', () => {
    // Arrange
    const body = createTestCarBodyWith({ flags: 0x80000 })

    // Act
    const boosted = startCarBodyBoost(arithmetic, body)

    // Assert
    expect(boosted).toBe(body)
  })
})
