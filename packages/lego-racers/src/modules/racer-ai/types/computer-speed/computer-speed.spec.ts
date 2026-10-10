import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import {
  CAR_BODY_HELD_FLAG,
  CAR_BODY_PUSHED_FLAG,
  CAR_BODY_RAMPED_TARGET_FLAG,
  CAR_BODY_SLOWED_FLAG,
  getPushedSpeedState,
  getRampedTargetSpeedFactor,
  getReleasedSpeedState,
  getRestoredSpeedState,
  getReturnedLateralOffset,
  stepComputerBounce,
  stepComputerSpeedFactor,
} from './computer-speed.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const STATE = Object.freeze({
  flags: 0,
  speedFactor: 1,
  targetSpeedFactor: 1.05,
  defaultTargetSpeedFactor: 1,
})

describe('stepComputerSpeedFactor', () => {
  it('accelerates at 0.00048828125 per ms toward a higher target', () => {
    // Arrange
    const input = { state: STATE, contactState: 4, stepMilliseconds: 32 }

    // Act
    const state = stepComputerSpeedFactor(SINGLE, input)

    // Assert
    expect(state.speedFactor).toBe(1.015625)
  })

  it('stops at the target instead of overshooting', () => {
    // Arrange
    const input = {
      state: { ...STATE, targetSpeedFactor: 1.01 },
      contactState: 4,
      stepMilliseconds: 40,
    }

    // Act
    const state = stepComputerSpeedFactor(SINGLE, input)

    // Assert
    expect(state.speedFactor).toBe(1.01)
  })

  it('decelerates at 0.002 per ms, and at 0.000732421875 when pushed', () => {
    // Arrange
    const slower = { ...STATE, targetSpeedFactor: 0 }
    const pushed = { ...slower, flags: CAR_BODY_PUSHED_FLAG }

    // Act
    const normal = stepComputerSpeedFactor(SINGLE, {
      state: slower,
      contactState: 4,
      stepMilliseconds: 10,
    })
    const pushedState = stepComputerSpeedFactor(SINGLE, {
      state: pushed,
      contactState: 4,
      stepMilliseconds: 10,
    })

    // Assert
    expect(normal.speedFactor).toBe(Math.fround(1 - Math.fround(Math.fround(0.002) * 10)))
    expect(pushedState.speedFactor).toBe(Math.fround(1 - 0.00732421875))
  })

  it('holds the speed when a hold bit is set and the car touches the route', () => {
    // Arrange
    const input = {
      state: { ...STATE, flags: CAR_BODY_HELD_FLAG },
      contactState: 2,
      stepMilliseconds: 40,
    }

    // Act
    const state = stepComputerSpeedFactor(SINGLE, input)

    // Assert
    expect(state.speedFactor).toBe(1)
  })
})

describe('getRampedTargetSpeedFactor', () => {
  it('ramps the target from 2.75 to 1.7 over the last 2,000 of the ramp time', () => {
    // Arrange
    const state = { ...STATE, flags: CAR_BODY_RAMPED_TARGET_FLAG }

    // Act
    const halfway = getRampedTargetSpeedFactor(SINGLE, state, 1000)
    const finished = getRampedTargetSpeedFactor(SINGLE, state, 2000)

    // Assert
    expect(halfway.targetSpeedFactor).toBe(
      Math.fround(Math.fround(Math.fround(2.75 - Math.fround(1.7)) * 0.5) + Math.fround(1.7))
    )
    expect(finished.targetSpeedFactor).toBe(1.05)
  })
})

describe('getReturnedLateralOffset', () => {
  it('returns toward 0 at 0.001953125 per ms without crossing it', () => {
    // Arrange
    const offsets = [1, -1, 0.01]

    // Act
    const returned = offsets.map((offset) => getReturnedLateralOffset(SINGLE, offset, 128))

    // Assert
    expect(returned).toEqual([0.75, -0.75, 0])
  })
})

describe('stepComputerBounce', () => {
  it('falls at 100 per second² and lands at height 0, clearing flag 0x80', () => {
    // Arrange
    const bounce = { flags: 0x81, height: 0.1, verticalSpeed: 0 }

    // Act
    const falling = stepComputerBounce(SINGLE, { ...bounce, height: 10 }, 100)
    const landed = stepComputerBounce(SINGLE, bounce, 100)

    // Assert
    expect(falling.verticalSpeed).toBe(Math.fround(-100 * Math.fround(0.1)))
    expect(landed).toEqual({ flags: 0x01, height: 0, verticalSpeed: 0 })
  })
})

describe('push and restore', () => {
  it('moves the target by the forward push / 300 and clamps it to 2.75', () => {
    // Arrange
    const forward = { x: 1, y: 0, z: 0 }

    // Act
    const pushed = getPushedSpeedState(SINGLE, STATE, forward, { x: 150, y: 0, z: 0 })
    const clamped = getPushedSpeedState(SINGLE, STATE, forward, { x: 3000, y: 0, z: 0 })
    const backward = getPushedSpeedState(SINGLE, STATE, forward, { x: -3000, y: 0, z: 0 })

    // Assert
    expect(pushed.targetSpeedFactor).toBe(1.5)
    expect(pushed.flags & CAR_BODY_PUSHED_FLAG).toBe(CAR_BODY_PUSHED_FLAG)
    expect(clamped.targetSpeedFactor).toBe(2.75)
    expect(backward.targetSpeedFactor).toBe(-0.5)
  })

  it('restores the default target, or 0.3 when slowed', () => {
    // Arrange
    const pushed = { ...STATE, flags: CAR_BODY_PUSHED_FLAG, defaultTargetSpeedFactor: -2 }

    // Act
    const restored = getRestoredSpeedState(SINGLE, pushed)
    const slowed = getRestoredSpeedState(SINGLE, { ...pushed, flags: CAR_BODY_SLOWED_FLAG })

    // Assert
    expect(restored).toEqual({
      ...STATE,
      flags: 0,
      defaultTargetSpeedFactor: 1,
      targetSpeedFactor: 1,
    })
    expect(slowed.targetSpeedFactor).toBe(Math.fround(0.3))
  })

  it('resets the target to 1.0 when released without slowing bits', () => {
    // Arrange
    const held = { ...STATE, flags: CAR_BODY_HELD_FLAG }

    // Act
    const released = getReleasedSpeedState(held, true)

    // Assert
    expect(released).toEqual({ ...STATE, flags: 0, targetSpeedFactor: 1 })
  })
})
