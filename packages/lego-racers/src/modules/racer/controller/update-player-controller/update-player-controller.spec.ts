import { createTestContext, createTestRacerSet } from '../../types/racer-fixtures/racer-fixtures.ts'
import { getRacer } from '../../types/racer-state/racer-state.ts'
import type {
  PlayerControllerDependencies,
  RacerControls,
  RacerSet,
} from '../../types/racer.types.ts'
import {
  applyRacerControls,
  createPlayerController,
  updatePlayerController,
} from './update-player-controller.ts'

const NO_CONTROLS: RacerControls = {
  isSteerPositivePressed: false,
  isSteerNegativePressed: false,
  isAcceleratePressed: false,
  isBrakePressed: false,
  isUsePowerUpPressed: false,
  isChangeCameraPressed: false,
  isChangeHudModePressed: false,
  isPowerSlidePressed: false,
  isLookBehindPressed: false,
  steeringAxis: 0,
  throttleAxis: 0,
}

const keep = (_context: unknown, racerSet: RacerSet): RacerSet => racerSet

const createDependencies = (calls: string[]): PlayerControllerDependencies => ({
  usePowerUp: (_context, racerSet) => {
    calls.push('usePowerUp')
    return racerSet
  },
  changeCamera: keep,
  changeHudMode: keep,
  setLookBehind: (_context, racerSet, _racerIndex, isLookingBehind) => {
    calls.push(`lookBehind:${String(isLookingBehind)}`)
    return racerSet
  },
  triggerStartBoost: (_context, racerSet, _racerIndex, isStrongBoost) => {
    calls.push(`startBoost:${String(isStrongBoost)}`)
    return racerSet
  },
  startPowerSlideEffects: keep,
  endPowerSlideEffects: keep,
})

const createInput = (calls: string[], steering = 0) => ({
  context: createTestContext(),
  state: {
    controller: { ...createPlayerController(false), steering },
    racerSet: createTestRacerSet(1),
  },
  racerIndex: 0,
  dependencies: createDependencies(calls),
})

describe('updatePlayerController steering (0x00430120)', () => {
  it('moves digital steering at 1.25 per second and steers the driver', () => {
    // Arrange
    const input = createInput([])
    const controls = { ...NO_CONTROLS, isSteerPositivePressed: true }
    const pressed = { ...input, state: applyRacerControls(input, controls) }

    // Act
    const result = updatePlayerController(pressed, controls, 100)

    // Assert: 1.25 · float32(100 · 0.001); the driver gets 1 / (0.00025 + 0.02475 · 0.125).
    expect(result.controller.steering).toBe(0.125)
    expect(getRacer(result.racerSet, 0).driver.curvature).not.toBe(0)
  })

  it('counter-steers at 8.25 per second', () => {
    // Arrange
    const input = createInput([], -0.5)
    const controls = { ...NO_CONTROLS, isSteerPositivePressed: true }
    const pressed = { ...input, state: applyRacerControls(input, controls) }

    // Act
    const result = updatePlayerController(pressed, controls, 100)

    // Assert
    expect(result.controller.steering).toBe(Math.fround(Math.fround(8.25 * Math.fround(0.1)) - 0.5))
  })

  it('recentres without passing zero', () => {
    // Arrange
    const input = createInput([], 0.1)

    // Act
    const result = updatePlayerController(input, NO_CONTROLS, 100)

    // Assert
    expect(result.controller.steering).toBe(0)
  })

  it('follows the negated analog axis with ((1 - a) · 0.5 + 0.5) · 2.5, capped at a', () => {
    // Arrange
    const input = createInput([])
    const controls = { ...NO_CONTROLS, steeringAxis: -0.5 }

    // Act
    const once = updatePlayerController(input, controls, 100)
    const often = updatePlayerController({ ...input, state: once }, controls, 1000)

    // Assert
    expect(once.controller.steering).toBe(0.1875)
    expect(often.controller.steering).toBe(0.5)
  })
})

describe('updatePlayerController throttle (0x00430390)', () => {
  it.each([
    [true, false, 54],
    [false, true, -54],
    [true, true, 27],
  ])(
    'accelerate %s and brake %s give a driver throttle of %d',
    (isAccelerating, isBraking, force) => {
      // Arrange
      const input = createInput([])
      const controls = {
        ...NO_CONTROLS,
        isAcceleratePressed: isAccelerating,
        isBrakePressed: isBraking,
      }
      const pressed = { ...input, state: applyRacerControls(input, controls) }

      // Act
      const result = updatePlayerController(pressed, controls, 16)

      // Assert
      expect(getRacer(result.racerSet, 0).driver.throttle).toBe(force)
      expect(result.controller.stateFlags & 0x8).toBe(isAccelerating ? 0x8 : 0)
    }
  )
})

describe('applyRacerControls', () => {
  it('uses the power-up on press and looks behind while held', () => {
    // Arrange
    const calls: string[] = []
    const input = createInput(calls)
    const held = { ...NO_CONTROLS, isUsePowerUpPressed: true, isLookBehindPressed: true }

    // Act
    const pressed = applyRacerControls(input, held)
    const released = applyRacerControls({ ...input, state: pressed }, NO_CONTROLS)

    // Assert
    expect(calls).toEqual(['usePowerUp', 'lookBehind:true', 'lookBehind:false'])
    expect(pressed.controller.bindingFlags).toBe(0x110)
    expect(released.controller.bindingFlags).toBe(0)
  })

  it('opens the start boost window after 2 s of accelerate before the start (0x00430790)', () => {
    // Arrange
    const calls: string[] = []
    const input = createInput(calls)
    const waiting = {
      ...input,
      state: {
        ...input.state,
        controller: { ...input.state.controller, stateFlags: 0x1, accelerateMilliseconds: 2001 },
      },
    }

    // Act
    const opened = applyRacerControls(waiting, { ...NO_CONTROLS, isAcceleratePressed: true })

    // Assert
    expect(opened.controller).toMatchObject({
      startBoostMilliseconds: 100,
      accelerateMilliseconds: 0,
    })
  })

  it('boosts when accelerate is pressed inside the window after the start', () => {
    // Arrange
    const calls: string[] = []
    const input = createInput(calls)
    const racing = {
      ...input,
      state: {
        ...input.state,
        controller: { ...input.state.controller, startBoostMilliseconds: 80 },
      },
    }

    // Act
    const boosted = applyRacerControls(racing, { ...NO_CONTROLS, isAcceleratePressed: true })

    // Assert
    expect(calls).toEqual(['startBoost:true'])
    expect(boosted.controller.startBoostMilliseconds).toBe(0)
  })
})
