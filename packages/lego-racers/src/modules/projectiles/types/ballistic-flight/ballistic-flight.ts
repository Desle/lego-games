import { createEnum } from '../../../../shared/types/enum.types.ts'
import { getDotProduct, getTruncatedInteger, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { FlightRacer, LineProbe } from '../projectiles.types.ts'
import type {
  BallisticFlight,
  BallisticFlightAdvance,
  BallisticLaunchParameters,
  LineToPoint,
  PointLaunchRequest,
  RacerLaunchRequest,
} from './ballistic-flight.types.ts'

// Flight +0x04. The original's numbers are kept in the comments.
export const BallisticFlightState = createEnum({
  // 0: not launched.
  IDLE: 'idle',
  // 1: in the air.
  FLYING: 'flying',
  // 2: a racer other than the shooter touched it (0x00431660).
  TOUCHED_RACER: 'touched_racer',
  // 3: the line probe hit the track.
  HIT_GROUND: 'hit_ground',
  // 4: it flew for its maximum duration.
  ENDED: 'ended',
})

// 0x004af220: milliseconds to seconds.
const SECONDS_PER_MILLISECOND = Math.fround(0.001)
// 0x004af670.
const MILLISECONDS_PER_SECOND = 1000
// 0x004af58c.
const HALF = 0.5
// 0x004b076c: a racer target is aimed at 5 units above its frame position.
export const TARGET_HEIGHT = 5
// 0x004b0774: the smallest closing speed 0x00430d80 divides by.
const MINIMUM_CLOSING_SPEED = Math.fround(0.001)

export const createBallisticFlight = (): BallisticFlight =>
  Object.freeze({
    state: BallisticFlightState.IDLE,
    framePosition: ZERO_VECTOR3,
    startPosition: ZERO_VECTOR3,
    targetPosition: ZERO_VECTOR3,
    endPosition: ZERO_VECTOR3,
    velocityX: 0,
    velocityY: 0,
    launchVelocityZ: 0,
    gravity: 0,
    // 0x00430cf0 stores 5.0 (0x40a00000) here.
    heightOffset: 5,
    horizontalSpeed: 0,
    elapsedMilliseconds: 0,
    durationMilliseconds: 0,
    maximumDurationMilliseconds: 0,
    hitNormal: ZERO_VECTOR3,
    shooterRacer: null,
    targetRacer: null,
    touchedRacer: null,
  })

// 0x00430d40: the part of the launch every routine shares.
const getInitializedFlight = (
  flight: BallisticFlight,
  parameters: BallisticLaunchParameters
): BallisticFlight =>
  Object.freeze({
    ...flight,
    gravity: parameters.gravity,
    maximumDurationMilliseconds: parameters.maximumDurationMilliseconds,
    heightOffset: parameters.heightOffset,
    elapsedMilliseconds: 0,
    state: BallisticFlightState.FLYING,
    touchedRacer: null,
  })

const getVector = (x: number, y: number, z: number): Vector3 => Object.freeze({ x, y, z })

// 0x00430dc2 and the matching lines of 0x00431050: a shooter's start is its frame position raised by +0x48.
const getShooterStart = (
  arithmetic: FloatArithmetic,
  flight: BallisticFlight,
  shooter: FlightRacer
): Vector3 =>
  getVector(
    shooter.position.x,
    shooter.position.y,
    arithmetic.storeFloat(arithmetic.add(flight.heightOffset, shooter.position.z))
  )

// 0x00431450 (thiscall, stack argument: the arc's duration in seconds): the launch velocity from start to target.
export const getFlightWithVelocity = (
  arithmetic: FloatArithmetic,
  flight: BallisticFlight,
  seconds: number
): BallisticFlight => {
  const { add, subtract, multiply, divide, getSquareRoot, storeFloat } = arithmetic
  const inverseSeconds = divide(1, seconds)
  const differenceX = subtract(flight.targetPosition.x, flight.startPosition.x)
  const differenceY = storeFloat(subtract(flight.targetPosition.y, flight.startPosition.y))
  const differenceZ = storeFloat(subtract(flight.targetPosition.z, flight.startPosition.z))
  const horizontalDistance = getSquareRoot(
    add(multiply(differenceY, differenceY), multiply(differenceX, differenceX))
  )
  const storedDistance = storeFloat(horizontalDistance)
  const horizontalSpeed = storeFloat(multiply(horizontalDistance, inverseSeconds))
  const climb = multiply(divide(differenceZ, storedDistance), horizontalSpeed)
  const drop = divide(
    multiply(flight.gravity, storedDistance),
    add(horizontalSpeed, horizontalSpeed)
  )
  return Object.freeze({
    ...flight,
    horizontalSpeed,
    velocityX: storeFloat(multiply(differenceX, inverseSeconds)),
    velocityY: storeFloat(multiply(differenceY, inverseSeconds)),
    launchVelocityZ: storeFloat(arithmetic.subtract(climb, drop)),
  })
}

// The head the two launches at a target share (0x00430dd0..0x00430eaf, 0x004310cb..0x0043115e): the horizontal
// distance from the start to the target (1 when it is 0) and how far the shooter's heading points along that line.
const getLineToPoint = (
  arithmetic: FloatArithmetic,
  start: Vector3,
  point: Vector3,
  shooterRacer: FlightRacer
): LineToPoint => {
  const { add, subtract, multiply, divide, getSquareRoot, storeFloat, getIsEqual } = arithmetic
  const differenceX = storeFloat(subtract(point.x, start.x))
  const rawDifferenceY = subtract(point.y, start.y)
  const differenceY = storeFloat(rawDifferenceY)
  const rawDistance = getSquareRoot(
    add(multiply(rawDifferenceY, differenceY), multiply(differenceX, differenceX))
  )
  const isDegenerate = getIsEqual(rawDistance, 0)
  const inverseDistance = isDegenerate ? 1 : divide(1, rawDistance)
  const directionX = storeFloat(multiply(inverseDistance, differenceX))
  const directionY = multiply(inverseDistance, differenceY)
  const { heading } = shooterRacer
  return {
    distance: isDegenerate ? 1 : rawDistance,
    alignment: add(
      add(multiply(heading.y, directionY), multiply(heading.z, 0)),
      multiply(heading.x, directionX)
    ),
  }
}

// 0x00430d80 (thiscall; arguments: parameters, shooter, target, isFromShooter, isLeadLimited): a flight at a racer.
// The target is aimed at 5 units above its frame, led by its velocity over the flight time, and the closing speed of
// the shooter along the line is added to the shot's speed. With isLeadLimited the led point is only used when it lies
// on the negative side of the shooter's +0x550 axis.
export const launchFlightAtRacer = (
  arithmetic: FloatArithmetic,
  flight: BallisticFlight,
  parameters: BallisticLaunchParameters,
  request: RacerLaunchRequest
): BallisticFlight => {
  const { add, subtract, multiply, divide, storeFloat } = arithmetic
  const { shooterRacer, targetRacer } = request
  const initialized = getInitializedFlight(flight, parameters)
  const start = request.isFromShooter
    ? getShooterStart(arithmetic, initialized, shooterRacer)
    : initialized.framePosition
  const aimedAt = getVector(
    targetRacer.position.x,
    targetRacer.position.y,
    storeFloat(add(TARGET_HEIGHT, targetRacer.position.z))
  )
  const { distance, alignment } = getLineToPoint(arithmetic, start, aimedAt, shooterRacer)
  const magnitude = arithmetic.getIsBelow(alignment, 0) ? -alignment : alignment
  const closingSpeed = add(
    multiply(multiply(magnitude, shooterRacer.headingSpeed), MILLISECONDS_PER_SECOND),
    parameters.speed
  )
  const effectiveSpeed = arithmetic.getIsBelowOrEqual(closingSpeed, MINIMUM_CLOSING_SPEED)
    ? MINIMUM_CLOSING_SPEED
    : closingSpeed
  const seconds = storeFloat(divide(distance, effectiveSpeed))
  const milliseconds = multiply(seconds, MILLISECONDS_PER_SECOND)
  const storedMilliseconds = storeFloat(milliseconds)
  const leadX = multiply(targetRacer.velocity.x, storedMilliseconds)
  const leadY = storeFloat(multiply(targetRacer.velocity.y, storedMilliseconds))
  const leadZ = storeFloat(multiply(targetRacer.velocity.z, storedMilliseconds))
  const ledPoint = getVector(
    storeFloat(add(aimedAt.x, leadX)),
    storeFloat(add(aimedAt.y, leadY)),
    storeFloat(add(aimedAt.z, leadZ))
  )
  const ledAlignment = getDotProduct(
    arithmetic,
    shooterRacer.sideAxis,
    getVector(
      subtract(ledPoint.x, start.x),
      subtract(ledPoint.y, start.y),
      subtract(ledPoint.z, start.z)
    )
  )
  const led = request.isLeadLimited && !arithmetic.getIsBelow(ledAlignment, 0) ? aimedAt : ledPoint
  const target = getVector(
    storeFloat(add(led.x, parameters.targetOffset.x)),
    storeFloat(add(led.y, parameters.targetOffset.y)),
    storeFloat(add(led.z, parameters.targetOffset.z))
  )
  return getFlightWithVelocity(
    arithmetic,
    Object.freeze({
      ...initialized,
      framePosition: start,
      startPosition: start,
      targetPosition: target,
      shooterRacer: request.shooter,
      targetRacer: request.target,
      durationMilliseconds: getTruncatedInteger(milliseconds),
    }),
    seconds
  )
}

// 0x00431050 (thiscall; arguments: parameters, shooter, point, pointVelocity, isFromShooter): a flight at a point,
// led by a velocity in units per second over the flight time.
export const launchFlightAtPoint = (
  arithmetic: FloatArithmetic,
  flight: BallisticFlight,
  parameters: BallisticLaunchParameters,
  request: PointLaunchRequest
): BallisticFlight => {
  const { add, multiply, divide, storeFloat } = arithmetic
  const { shooterRacer, point } = request
  const initialized = getInitializedFlight(flight, parameters)
  const start = request.isFromShooter
    ? getShooterStart(arithmetic, initialized, shooterRacer)
    : initialized.framePosition
  const { distance, alignment } = getLineToPoint(arithmetic, start, point, shooterRacer)
  const effectiveSpeed = arithmetic.getIsBelowOrEqual(alignment, 0)
    ? parameters.speed
    : add(
        multiply(multiply(alignment, shooterRacer.headingSpeed), MILLISECONDS_PER_SECOND),
        parameters.speed
      )
  const seconds = storeFloat(divide(distance, effectiveSpeed))
  const leadX = multiply(seconds, request.pointVelocity.x)
  const leadY = storeFloat(multiply(request.pointVelocity.y, seconds))
  const leadZ = storeFloat(multiply(request.pointVelocity.z, seconds))
  const target = getVector(
    storeFloat(add(storeFloat(add(leadX, point.x)), parameters.targetOffset.x)),
    storeFloat(add(storeFloat(add(leadY, point.y)), parameters.targetOffset.y)),
    storeFloat(add(storeFloat(add(leadZ, point.z)), parameters.targetOffset.z))
  )
  return getFlightWithVelocity(
    arithmetic,
    Object.freeze({
      ...initialized,
      framePosition: start,
      startPosition: start,
      targetPosition: target,
      shooterRacer: request.shooter,
      targetRacer: null,
      durationMilliseconds: getTruncatedInteger(multiply(seconds, MILLISECONDS_PER_SECOND)),
    }),
    seconds
  )
}

// 0x00431220 (thiscall; arguments: parameters, offset): a flight from the model's own position to
// parameters.targetOffset + offset, with no shooter. Its speed is parameters.speed exactly (the horizontal distance
// over the speed gives the time).
export const launchFlightWithOffset = (
  arithmetic: FloatArithmetic,
  flight: BallisticFlight,
  parameters: BallisticLaunchParameters,
  offset: Vector3
): BallisticFlight => {
  const { add, subtract, multiply, divide, getSquareRoot, storeFloat } = arithmetic
  const initialized = getInitializedFlight(flight, parameters)
  const target = getVector(
    storeFloat(add(parameters.targetOffset.x, offset.x)),
    storeFloat(add(parameters.targetOffset.y, offset.y)),
    storeFloat(add(parameters.targetOffset.z, offset.z))
  )
  const start = initialized.framePosition
  const differenceX = subtract(target.x, start.x)
  const differenceY = storeFloat(subtract(target.y, start.y))
  const differenceZ = storeFloat(subtract(target.z, start.z))
  const storedDistance = storeFloat(
    getSquareRoot(add(multiply(differenceY, differenceY), multiply(differenceX, differenceX)))
  )
  const seconds = divide(storedDistance, parameters.speed)
  const inverseSeconds = storeFloat(divide(1, seconds))
  const climb = multiply(divide(differenceZ, storedDistance), parameters.speed)
  const drop = divide(
    multiply(parameters.gravity, storedDistance),
    add(parameters.speed, parameters.speed)
  )
  return Object.freeze({
    ...initialized,
    startPosition: start,
    targetPosition: target,
    shooterRacer: null,
    targetRacer: null,
    horizontalSpeed: parameters.speed,
    durationMilliseconds: getTruncatedInteger(multiply(seconds, MILLISECONDS_PER_SECOND)),
    velocityX: storeFloat(multiply(inverseSeconds, differenceX)),
    velocityY: storeFloat(multiply(inverseSeconds, differenceY)),
    launchVelocityZ: storeFloat(subtract(climb, drop)),
  })
}

// 0x004316a0: the velocity in units per second after the milliseconds flown.
export const getFlightVelocity = (arithmetic: FloatArithmetic, flight: BallisticFlight): Vector3 =>
  getVector(
    flight.velocityX,
    flight.velocityY,
    arithmetic.storeFloat(
      arithmetic.add(
        arithmetic.multiply(
          arithmetic.multiply(flight.elapsedMilliseconds, SECONDS_PER_MILLISECOND),
          flight.gravity
        ),
        flight.launchVelocityZ
      )
    )
  )

// 0x00431550 (thiscall: step milliseconds). The arc is sampled at the new elapsed time and the line probe runs from
// the model's last position to it.
export const advanceBallisticFlight = (
  arithmetic: FloatArithmetic,
  probe: LineProbe,
  flight: BallisticFlight,
  stepMilliseconds: number
): BallisticFlightAdvance => {
  const { add, multiply, storeFloat } = arithmetic
  if (flight.state !== BallisticFlightState.FLYING) {
    return Object.freeze({ flight, result: flight.state })
  }
  const elapsedMilliseconds = (flight.elapsedMilliseconds + stepMilliseconds) >>> 0
  if (elapsedMilliseconds >= flight.maximumDurationMilliseconds) {
    return Object.freeze({
      flight: Object.freeze({
        ...flight,
        elapsedMilliseconds,
        state: BallisticFlightState.ENDED,
        endPosition: flight.framePosition,
      }),
      result: BallisticFlightState.ENDED,
    })
  }
  const seconds = multiply(elapsedMilliseconds | 0, SECONDS_PER_MILLISECOND)
  const climb = storeFloat(multiply(flight.launchVelocityZ, seconds))
  const offsetY = storeFloat(multiply(flight.velocityY, seconds))
  const fall = multiply(multiply(multiply(seconds, seconds), HALF), flight.gravity)
  const position = getVector(
    storeFloat(add(multiply(seconds, flight.velocityX), flight.startPosition.x)),
    storeFloat(add(offsetY, flight.startPosition.y)),
    storeFloat(add(fall, add(climb, flight.startPosition.z)))
  )
  const hit = probe(flight.framePosition, position)
  if (hit !== null) {
    return Object.freeze({
      flight: Object.freeze({
        ...flight,
        elapsedMilliseconds,
        state: BallisticFlightState.HIT_GROUND,
        endPosition: hit.point,
        hitNormal: hit.normal,
        framePosition: hit.point,
      }),
      result: BallisticFlightState.HIT_GROUND,
    })
  }
  return Object.freeze({
    flight: Object.freeze({ ...flight, elapsedMilliseconds, framePosition: position }),
    result: BallisticFlightState.FLYING,
  })
}

// 0x00431660 (vtable slot 0, the collision registry's touch callback): a racer other than the shooter takes the
// projectile in flight; its end position is the racer's frame position.
export const touchBallisticFlight = (
  flight: BallisticFlight,
  racer: number,
  racerPosition: Vector3
): BallisticFlight =>
  racer === flight.shooterRacer || flight.state !== BallisticFlightState.FLYING
    ? flight
    : Object.freeze({
        ...flight,
        state: BallisticFlightState.TOUCHED_RACER,
        touchedRacer: racer,
        endPosition: racerPosition,
      })

// 0x00431310 (thiscall: the racer that becomes the shooter): the flight turns round towards its old shooter,
// starting again from where it is, with the arc's old horizontal speed.
export const reflectBallisticFlight = (
  arithmetic: FloatArithmetic,
  flight: BallisticFlight,
  newShooter: number,
  oldShooter: FlightRacer | null
): BallisticFlight => {
  const { add, subtract, multiply, divide, getSquareRoot, storeFloat, getIsEqual } = arithmetic
  const velocity = oldShooter === null ? ZERO_VECTOR3 : oldShooter.velocity
  const aimedAt =
    oldShooter === null
      ? flight.startPosition
      : getVector(
          oldShooter.position.x,
          oldShooter.position.y,
          storeFloat(add(TARGET_HEIGHT, oldShooter.position.z))
        )
  const start = flight.framePosition
  const differenceX = subtract(aimedAt.x, start.x)
  const differenceY = subtract(aimedAt.y, start.y)
  const rawDistance = getSquareRoot(
    add(multiply(differenceY, differenceY), multiply(differenceX, differenceX))
  )
  const distance = getIsEqual(rawDistance, 0) ? 1 : rawDistance
  const seconds = storeFloat(divide(distance, flight.horizontalSpeed))
  const milliseconds = multiply(seconds, MILLISECONDS_PER_SECOND)
  const leadX = storeFloat(multiply(milliseconds, velocity.x))
  const leadY = storeFloat(multiply(velocity.y, milliseconds))
  const leadZ = multiply(milliseconds, velocity.z)
  return getFlightWithVelocity(
    arithmetic,
    Object.freeze({
      ...flight,
      state: BallisticFlightState.FLYING,
      elapsedMilliseconds: 0,
      touchedRacer: null,
      targetRacer: flight.shooterRacer,
      shooterRacer: newShooter,
      startPosition: start,
      targetPosition: getVector(
        storeFloat(add(leadX, aimedAt.x)),
        storeFloat(add(leadY, aimedAt.y)),
        storeFloat(add(leadZ, aimedAt.z))
      ),
      durationMilliseconds: getTruncatedInteger(milliseconds),
    }),
    seconds
  )
}
