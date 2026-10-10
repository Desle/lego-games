import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { FlightRacer } from '../projectiles.types.ts'
import {
  advanceBallisticFlight,
  BallisticFlightState,
  createBallisticFlight,
  getFlightVelocity,
  launchFlightAtPoint,
  launchFlightAtRacer,
  launchFlightWithOffset,
  reflectBallisticFlight,
  touchBallisticFlight,
} from './ballistic-flight.ts'
import type { BallisticLaunchParameters } from './ballistic-flight.types.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const f = Math.fround
const GRAVITY = f(-32.176)
const ZERO: Vector3 = { x: 0, y: 0, z: 0 }
const PARAMETERS: BallisticLaunchParameters = {
  gravity: GRAVITY,
  speed: 180,
  targetOffset: ZERO,
  maximumDurationMilliseconds: 3000,
  heightOffset: 5,
}
const getRacer = (position: Vector3, velocity: Vector3 = ZERO): FlightRacer => ({
  position,
  velocity,
  heading: ZERO,
  headingSpeed: 0,
  sideAxis: ZERO,
})

describe('launchFlightWithOffset (0x00431220)', () => {
  it('flies from the model to the offset at the parameter speed', () => {
    // Arrange: 360 units along x at 180 per second is 2 seconds.
    const flight = createBallisticFlight()

    // Act
    const launched = launchFlightWithOffset(SINGLE, flight, PARAMETERS, { x: 360, y: 0, z: 0 })

    // Assert: 1 / 2 s = 0.5, vx = 0.5 * 360, vz = 0 - g * 360 / 360 (0x004312f8).
    expect(launched.state).toBe(BallisticFlightState.FLYING)
    expect(launched.durationMilliseconds).toBe(2000)
    expect(launched.velocityX).toBe(180)
    expect(launched.velocityY).toBe(0)
    expect(launched.launchVelocityZ).toBe(f(0 - f(f(GRAVITY * 360) / 360)))
    expect(launched.horizontalSpeed).toBe(180)
    expect(launched.shooterRacer).toBeNull()
  })
})

describe('launchFlightAtPoint (0x00431050)', () => {
  it('starts above the shooter and uses the shot speed when the shooter is standing still', () => {
    // Arrange
    const shooter = getRacer({ x: 10, y: 20, z: 3 })

    // Act
    const launched = launchFlightAtPoint(SINGLE, createBallisticFlight(), PARAMETERS, {
      shooter: 2,
      shooterRacer: shooter,
      point: { x: 10, y: 380, z: 8 },
      pointVelocity: ZERO,
      isFromShooter: true,
    })

    // Assert: the start is 5 above the shooter; 360 units at 180 per second is 2 seconds.
    expect(launched.startPosition).toEqual({ x: 10, y: 20, z: 8 })
    expect(launched.framePosition).toEqual({ x: 10, y: 20, z: 8 })
    expect(launched.durationMilliseconds).toBe(2000)
    expect(launched.velocityY).toBe(180)
    expect(launched.shooterRacer).toBe(2)
    expect(launched.targetRacer).toBeNull()
  })

  it('adds the shooter closing speed along the line, scaled by 1000 (0x00431111)', () => {
    // Arrange: heading along +y at 0.03 units per ms is 30 per second towards the target.
    const shooter: FlightRacer = {
      ...getRacer({ x: 0, y: 0, z: 0 }),
      heading: { x: 0, y: 1, z: 0 },
      headingSpeed: f(0.03),
    }

    // Act
    const launched = launchFlightAtPoint(SINGLE, createBallisticFlight(), PARAMETERS, {
      shooter: 0,
      shooterRacer: shooter,
      point: { x: 0, y: 420, z: 5 },
      pointVelocity: ZERO,
      isFromShooter: true,
    })

    // Assert: 420 / (30 + 180) = 2 seconds (the single-precision product 1 * 0.03 * 1000 is 30.000001).
    const closing = f(f(f(1) * f(0.03)) * 1000)
    expect(launched.durationMilliseconds).toBe(Math.trunc(f(f(420 / f(closing + 180)) * 1000)))
  })

  it('leads the point by its velocity over the flight time', () => {
    // Arrange: the point moves 10 per second along x and the flight takes 2 seconds.
    const shooter = getRacer({ x: 0, y: 0, z: 0 })

    // Act
    const launched = launchFlightAtPoint(SINGLE, createBallisticFlight(), PARAMETERS, {
      shooter: 0,
      shooterRacer: shooter,
      point: { x: 0, y: 360, z: 5 },
      pointVelocity: { x: 10, y: 0, z: 0 },
      isFromShooter: true,
    })

    // Assert
    expect(launched.targetPosition).toEqual({ x: 20, y: 360, z: 5 })
  })
})

describe('launchFlightAtRacer (0x00430d80)', () => {
  const shooter = getRacer({ x: 0, y: 0, z: 0 })

  it('aims 5 units above the target frame and leads it by velocity times milliseconds', () => {
    // Arrange: the target is 360 units ahead and moves 0.01 per ms along x.
    const target = getRacer({ x: 0, y: 360, z: 0 }, { x: f(0.01), y: 0, z: 0 })

    // Act
    const launched = launchFlightAtRacer(SINGLE, createBallisticFlight(), PARAMETERS, {
      shooter: 0,
      shooterRacer: shooter,
      target: 1,
      targetRacer: target,
      isFromShooter: true,
      isLeadLimited: false,
    })

    // Assert: 2 seconds, 2000 ms, so the lead is 0.01 * 2000 = 20 on x; z is 5 above the frame.
    expect(launched.durationMilliseconds).toBe(2000)
    expect(launched.targetPosition.x).toBe(f(f(0.01) * 2000))
    expect(launched.targetPosition.z).toBe(5)
    expect(launched.targetRacer).toBe(1)
    expect(launched.shooterRacer).toBe(0)
  })

  it('only leads when the led point lies on the negative side of the shooter axis (limited lead)', () => {
    // Arrange: the axis points along +x, so the led point (x = 20) is on the positive side and is refused.
    const axisShooter: FlightRacer = { ...shooter, sideAxis: { x: 1, y: 0, z: 0 } }
    const target = getRacer({ x: 0, y: 360, z: 0 }, { x: f(0.01), y: 0, z: 0 })

    // Act
    const launched = launchFlightAtRacer(SINGLE, createBallisticFlight(), PARAMETERS, {
      shooter: 0,
      shooterRacer: axisShooter,
      target: 1,
      targetRacer: target,
      isFromShooter: true,
      isLeadLimited: true,
    })

    // Assert
    expect(launched.targetPosition.x).toBe(0)
  })

  it('raises the speed floor to 0.001 when the closing speed would reach zero', () => {
    // Arrange: a shooter moving straight away fast enough to cancel the shot speed.
    const awayShooter: FlightRacer = {
      ...shooter,
      heading: { x: 0, y: -1, z: 0 },
      headingSpeed: 0,
    }
    const target = getRacer({ x: 0, y: 360, z: 0 })

    // Act
    const launched = launchFlightAtRacer(
      SINGLE,
      createBallisticFlight(),
      { ...PARAMETERS, speed: 0 },
      {
        shooter: 0,
        shooterRacer: awayShooter,
        target: 1,
        targetRacer: target,
        isFromShooter: true,
        isLeadLimited: false,
      }
    )

    // Assert: 360 / 0.001 seconds, truncated to milliseconds.
    expect(launched.durationMilliseconds).toBe(Math.trunc(f(f(360 / f(0.001)) * 1000)))
  })
})

describe('advanceBallisticFlight (0x00431550)', () => {
  const launched = launchFlightWithOffset(SINGLE, createBallisticFlight(), PARAMETERS, {
    x: 360,
    y: 0,
    z: 0,
  })
  const missProbe = (): null => null

  it('moves along the arc with gravity on z and keeps flying', () => {
    // Arrange / Act
    const advance = advanceBallisticFlight(SINGLE, missProbe, launched, 1000)

    // Assert: after 1 s, x = 180 and z = vz + g / 2.
    expect(advance.result).toBe(BallisticFlightState.FLYING)
    expect(advance.flight.elapsedMilliseconds).toBe(1000)
    expect(advance.flight.framePosition.x).toBe(180)
    expect(advance.flight.framePosition.z).toBe(
      f(f(f(1 * 1) * 0.5 * GRAVITY) + f(launched.launchVelocityZ * 1))
    )
  })

  it('stops at the probe hit and records the normal (state 3)', () => {
    // Arrange
    const hitProbe = () => ({ point: { x: 1, y: 2, z: 3 }, normal: { x: 0, y: 0, z: 1 } })

    // Act
    const advance = advanceBallisticFlight(SINGLE, hitProbe, launched, 500)

    // Assert
    expect(advance.result).toBe(BallisticFlightState.HIT_GROUND)
    expect(advance.flight.endPosition).toEqual({ x: 1, y: 2, z: 3 })
    expect(advance.flight.framePosition).toEqual({ x: 1, y: 2, z: 3 })
    expect(advance.flight.hitNormal).toEqual({ x: 0, y: 0, z: 1 })
  })

  it('ends at the maximum duration where the model is (state 4)', () => {
    // Arrange
    const moved = advanceBallisticFlight(SINGLE, missProbe, launched, 1000).flight

    // Act
    const advance = advanceBallisticFlight(SINGLE, missProbe, moved, 2000)

    // Assert
    expect(advance.result).toBe(BallisticFlightState.ENDED)
    expect(advance.flight.endPosition).toEqual(moved.framePosition)
  })

  it('returns the state of a flight that is not flying', () => {
    // Arrange
    const idle = createBallisticFlight()

    // Act
    const advance = advanceBallisticFlight(SINGLE, missProbe, idle, 40)

    // Assert
    expect(advance.result).toBe(BallisticFlightState.IDLE)
    expect(advance.flight).toBe(idle)
  })
})

describe('touchBallisticFlight (0x00431660)', () => {
  const flying = launchFlightAtPoint(SINGLE, createBallisticFlight(), PARAMETERS, {
    shooter: 1,
    shooterRacer: getRacer({ x: 0, y: 0, z: 0 }),
    point: { x: 0, y: 360, z: 5 },
    pointVelocity: ZERO,
    isFromShooter: true,
  })

  it('is taken by a racer other than the shooter', () => {
    // Arrange / Act
    const touched = touchBallisticFlight(flying, 3, { x: 4, y: 5, z: 6 })

    // Assert
    expect(touched.state).toBe(BallisticFlightState.TOUCHED_RACER)
    expect(touched.touchedRacer).toBe(3)
    expect(touched.endPosition).toEqual({ x: 4, y: 5, z: 6 })
  })

  it('ignores the shooter and flights that are not flying', () => {
    // Arrange
    const touched = touchBallisticFlight(flying, 3, ZERO)

    // Act
    const results = [
      touchBallisticFlight(flying, 1, ZERO),
      touchBallisticFlight(touched, 4, ZERO).touchedRacer,
    ]

    // Assert
    expect(results).toEqual([flying, 3])
  })
})

describe('reflectBallisticFlight (0x00431310)', () => {
  it('turns towards the old shooter, 5 above, with the old horizontal speed', () => {
    // Arrange
    const flying = launchFlightAtPoint(SINGLE, createBallisticFlight(), PARAMETERS, {
      shooter: 1,
      shooterRacer: getRacer({ x: 0, y: 0, z: 0 }),
      point: { x: 0, y: 360, z: 5 },
      pointVelocity: ZERO,
      isFromShooter: true,
    })
    const moved = advanceBallisticFlight(SINGLE, () => null, flying, 1000).flight

    // Act
    const reflected = reflectBallisticFlight(SINGLE, moved, 3, getRacer({ x: 0, y: 0, z: 0 }))

    // Assert: it starts where the model is and aims at the old shooter 5 above.
    expect(reflected.state).toBe(BallisticFlightState.FLYING)
    expect(reflected.elapsedMilliseconds).toBe(0)
    expect(reflected.shooterRacer).toBe(3)
    expect(reflected.targetRacer).toBe(1)
    expect(reflected.startPosition).toEqual(moved.framePosition)
    expect(reflected.targetPosition).toEqual({ x: 0, y: 0, z: 5 })
    expect(reflected.horizontalSpeed).toBe(f(f(180)))
  })

  it('aims back at the start when there was no shooter', () => {
    // Arrange
    const flight = launchFlightWithOffset(SINGLE, createBallisticFlight(), PARAMETERS, {
      x: 360,
      y: 0,
      z: 0,
    })

    // Act
    const reflected = reflectBallisticFlight(SINGLE, flight, 2, null)

    // Assert
    expect(reflected.targetPosition).toEqual(flight.startPosition)
    expect(reflected.targetRacer).toBeNull()
  })
})

describe('getFlightVelocity (0x004316a0)', () => {
  it('adds gravity times the seconds flown to the launch z velocity', () => {
    // Arrange
    const flight = {
      ...launchFlightWithOffset(SINGLE, createBallisticFlight(), PARAMETERS, {
        x: 360,
        y: 0,
        z: 0,
      }),
      elapsedMilliseconds: 500,
    }

    // Act
    const velocity = getFlightVelocity(SINGLE, flight)

    // Assert
    expect(velocity.x).toBe(180)
    expect(velocity.z).toBe(f(f(f(500 * f(0.001)) * GRAVITY) + flight.launchVelocityZ))
  })
})
