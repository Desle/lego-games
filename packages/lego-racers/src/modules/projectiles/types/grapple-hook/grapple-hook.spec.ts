import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import {
  BallisticFlightState,
  createBallisticFlight,
} from '../ballistic-flight/ballistic-flight.ts'
import {
  advanceGrappleHook,
  createGrappleHook,
  getPointMovedToward,
  getRetractingHook,
  ROPE_START_HEIGHT,
} from './grapple-hook.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const f = Math.fround
const ORIGIN: Vector3 = { x: 0, y: 0, z: 0 }
const NO_HIT = (): null => null

describe('getPointMovedToward (0x00449a90)', () => {
  it('moves speed times seconds along the line', () => {
    // Arrange / Act
    const moved = getPointMovedToward(SINGLE, { x: 100, y: 0, z: 0 }, ORIGIN, 36, 250, f(0.1))

    // Assert
    expect(moved.position).toEqual({ x: 25, y: 0, z: 0 })
    expect(moved.isArrived).toBe(false)
  })

  it('is there without moving when within the arrival distance', () => {
    // Arrange / Act
    const moved = getPointMovedToward(SINGLE, { x: 5, y: 0, z: 0 }, ORIGIN, 36, 250, f(0.1))

    // Assert
    expect(moved).toEqual({ position: ORIGIN, isArrived: true })
  })

  it('is there when the step passes the target', () => {
    // Arrange / Act
    const moved = getPointMovedToward(SINGLE, { x: 10, y: 0, z: 0 }, ORIGIN, 36, 250, f(0.1))

    // Assert
    expect(moved.position.x).toBe(25)
    expect(moved.isArrived).toBe(true)
  })
})

describe('advanceGrappleHook', () => {
  const latched = Object.freeze({
    ...createGrappleHook({
      ...createBallisticFlight(),
      state: BallisticFlightState.TOUCHED_RACER,
      touchedRacer: 1,
      shooterRacer: 0,
    }),
  })

  it('flies to 2 units above the latched racer at 300 a second, then stays on it (0x00444820)', () => {
    // Arrange
    const racer = { x: 60, y: 0, z: 0 }

    // Act
    const first = advanceGrappleHook(SINGLE, NO_HIT, latched, ORIGIN, racer, 100)
    const second = advanceGrappleHook(SINGLE, NO_HIT, first.hook, ORIGIN, racer, 100)
    const third = advanceGrappleHook(SINGLE, NO_HIT, second.hook, ORIGIN, racer, 100)

    // Assert: 30 units per 100 ms; the third step passes the point 2 up and snaps to it.
    expect(first.hook.flight.framePosition.x).toBeCloseTo(30 * (60 / Math.hypot(60, 2)), 3)
    expect(third.hook.isHookArrived).toBe(true)
    expect(third.hook.flight.framePosition).toEqual({ x: 60, y: 0, z: 2 })
    expect(third.result).toBe(BallisticFlightState.TOUCHED_RACER)
  })

  it('breaks when the rope meets the track once the tension has reached 1 (0x00444938)', () => {
    // Arrange
    const racer = { x: 60, y: 0, z: 0 }
    const blocking = () => ({ point: { x: 1, y: 2, z: 3 }, normal: { x: 0, y: 0, z: 1 } })

    // Act
    const early = advanceGrappleHook(SINGLE, blocking, latched, ORIGIN, racer, 999)
    const late = advanceGrappleHook(SINGLE, blocking, early.hook, ORIGIN, racer, 1)

    // Assert
    expect(early.result).toBe(BallisticFlightState.TOUCHED_RACER)
    expect(early.hook.tension).toBeLessThan(1)
    expect(late.result).toBe(BallisticFlightState.HIT_GROUND)
    expect(late.hook.tension).toBe(1)
    expect(late.hook.flight.endPosition).toEqual({ x: 1, y: 2, z: 3 })
  })

  it('retracts to the owner at 250 a second and ends there (0x00444690)', () => {
    // Arrange
    const hook = getRetractingHook(createGrappleHook(createBallisticFlight()), {
      x: 0,
      y: 100,
      z: 0,
    })

    // Act
    const first = advanceGrappleHook(SINGLE, NO_HIT, hook, ORIGIN, null, 200)
    const second = advanceGrappleHook(SINGLE, NO_HIT, first.hook, ORIGIN, null, 300)

    // Assert: the hook flies to the point 3 above the owner (0x00453cd0), 50 units along the line in 200 ms.
    expect(first.hook.hookTarget.y).toBeCloseTo(
      100 - 50 * (100 / Math.hypot(100, ROPE_START_HEIGHT)),
      3
    )
    expect(first.hook.hookTarget.z).toBeCloseTo(
      50 * (ROPE_START_HEIGHT / Math.hypot(100, ROPE_START_HEIGHT)),
      3
    )
    expect(first.result).toBe(BallisticFlightState.FLYING)
    expect(second.result).toBe(BallisticFlightState.ENDED)
    expect(second.hook.isRetracting).toBe(false)
  })

  it('slackens the rope as the hook comes back, down to nothing (0x00444690)', () => {
    // Arrange
    const hook = Object.freeze({
      ...getRetractingHook(createGrappleHook(createBallisticFlight()), { x: 0, y: 1000, z: 0 }),
      tension: f(0.3),
    })

    // Act
    const first = advanceGrappleHook(SINGLE, NO_HIT, hook, ORIGIN, null, 100)
    const second = advanceGrappleHook(SINGLE, NO_HIT, first.hook, ORIGIN, null, 500)

    // Assert
    expect(first.hook.tension).toBeCloseTo(0.2, 5)
    expect(second.hook.tension).toBe(0)
  })

  it('keeps the owner position the rope was laid from (0x00444540)', () => {
    // Arrange / Act
    const advance = advanceGrappleHook(
      SINGLE,
      NO_HIT,
      createGrappleHook(createBallisticFlight()),
      { x: 1, y: 2, z: 3 },
      null,
      16
    )

    // Assert
    expect(advance.hook.ropeOwnerPosition).toEqual({ x: 1, y: 2, z: 3 })
  })
})
