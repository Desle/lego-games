import type { GroundQuery } from '../../../power-ups/index.ts'
import {
  getNormalizedVector3,
  getSquaredLength,
  getStoredDifference,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { ProjectileEvent } from '../projectile-event/projectile-event.types.ts'
import type { FlightRacer } from '../projectiles.types.ts'
import type { MagnetMotion } from '../projectile-world/projectile-world.types.ts'
import type { HazardLanding, MagnetPull, MagnetPullRacer } from './magnet-pull.types.ts'

// 0x004b162c: 0x00456360 probes this far below the racer, and 0x004b1628: lifts the ground point by this much.
const PLACEMENT_PROBE_DEPTH = 50
const PLACEMENT_LIFT = 1
// 0x004b15f0: the magnet hangs this high above its ground point.
const MAGNET_HEIGHT = 30
// 0x004b15ec: a racer within 9 units (81 squared) of the ground point is captured.
const CAPTURE_DISTANCE_SQUARED = 81
// 0x004b15e8: the captured racer counts as arrived within 10 units (100 squared).
const ARRIVAL_DISTANCE_SQUARED = 100
// 0x004b0400: a racer slower than this has stopped.
const STOPPED_SPEED = Math.fround(0.002)
// 0x004b15f4 and 0x004b15f8: the force scale of the pull.
const PULL_SCALE = 1
const CAPTURED_TIMER_CAP_MILLISECONDS = 1000
// 0x004560ef: the owner's boost when the magnet lands: 0x00429cf0(0.0015, 150).
const LANDING_BOOST_FACTOR = Math.fround(0.0015)
const LANDING_BOOST_MILLISECONDS = 150

// 0x00456360: a vertical probe 50 down from the position, and the point it hits 1 up; the position itself on a miss. The
// normal is that of the triangle it hit (null on a miss: the original leaves its plane unwritten).
export const getHazardLanding = (
  arithmetic: FloatArithmetic,
  position: Vector3,
  getGroundPoint: GroundQuery
): HazardLanding => {
  const { add, subtract, storeFloat } = arithmetic
  const hitNormals: Vector3[] = []
  const hit = getGroundPoint(
    position,
    Object.freeze({
      x: subtract(position.x, 0),
      y: subtract(position.y, 0),
      z: storeFloat(subtract(position.z, PLACEMENT_PROBE_DEPTH)),
    }),
    (hitNormal) => hitNormals.push(hitNormal)
  )
  return Object.freeze({
    normal: hitNormals[0] ?? null,
    position:
      hit === null
        ? position
        : Object.freeze({
            x: storeFloat(add(0, hit.x)),
            y: storeFloat(add(0, hit.y)),
            z: storeFloat(add(PLACEMENT_LIFT, hit.z)),
          }),
  })
}

export const getHazardPlacement = (
  arithmetic: FloatArithmetic,
  position: Vector3,
  getGroundPoint: GroundQuery
): Vector3 => getHazardLanding(arithmetic, position, getGroundPoint).position

// 0x004560b0 (the magnet's first update): placed on the ground under its owner, 30 up; the owner is boosted.
export const createMagnetMotion = (
  arithmetic: FloatArithmetic,
  ownerPosition: Vector3,
  getGroundPoint: GroundQuery
): MagnetMotion => {
  const ground = getHazardPlacement(arithmetic, ownerPosition, getGroundPoint)
  return Object.freeze({
    kind: 'magnet',
    position: Object.freeze({
      ...ground,
      z: arithmetic.storeFloat(arithmetic.add(MAGNET_HEIGHT, ground.z)),
    }),
    candidateRacer: null,
    isRacerStopped: false,
    isRacerArrived: false,
  })
}

export const getMagnetLandingBoost = (owner: number): ProjectileEvent =>
  Object.freeze({
    type: 'projectiles.racer_boosted',
    racer: owner,
    factor: LANDING_BOOST_FACTOR,
    milliseconds: LANDING_BOOST_MILLISECONDS,
  })

// The magnet's ground point, 30 below its frame (0x00455fb0 and 0x00455b40 both subtract 30 from z and store it).
const getGroundTarget = (arithmetic: FloatArithmetic, magnet: MagnetMotion): Vector3 =>
  Object.freeze({
    x: magnet.position.x,
    y: magnet.position.y,
    z: arithmetic.storeFloat(arithmetic.subtract(magnet.position.z, MAGNET_HEIGHT)),
  })

// 0x00455fb0: a racer within 9 units of the ground point is captured; sums z, y, x squared in that order.
export const getIsWithinMagnetCaptureRange = (
  arithmetic: FloatArithmetic,
  magnet: MagnetMotion,
  racerPosition: Vector3
): boolean => {
  const target = getGroundTarget(arithmetic, magnet)
  const { subtract, getIsBelowOrEqual } = arithmetic
  return getIsBelowOrEqual(
    getSquaredLength(
      arithmetic,
      Object.freeze({
        x: subtract(target.x, racerPosition.x),
        y: subtract(target.y, racerPosition.y),
        z: subtract(target.z, racerPosition.z),
      })
    ),
    CAPTURE_DISTANCE_SQUARED
  )
}

const getPullEvent = (
  arithmetic: FloatArithmetic,
  magnet: MagnetMotion,
  racerIndex: number,
  racer: FlightRacer,
  stepMilliseconds: number
): ProjectileEvent =>
  Object.freeze({
    type: 'projectiles.racer_pulled',
    racer: racerIndex,
    direction: getNormalizedVector3(
      arithmetic,
      getStoredDifference(arithmetic, getGroundTarget(arithmetic, magnet), racer.position)
    ),
    strength: arithmetic.storeFloat(arithmetic.multiply(stepMilliseconds, PULL_SCALE)),
  })

// 0x00455b40 after the countdown: the captured racer is slowed and towed to the ground point; a racer that only
// touched the magnet is pulled once.
export const getMagnetPull = (
  arithmetic: FloatArithmetic,
  magnet: MagnetMotion,
  capturedRacer: number | null,
  timerMilliseconds: number,
  racers: readonly MagnetPullRacer[],
  stepMilliseconds: number
): MagnetPull => {
  const { subtract, getIsBelowOrEqual } = arithmetic
  const captured = capturedRacer === null ? undefined : racers[capturedRacer]
  if (capturedRacer === null || captured === undefined) {
    const candidate = magnet.candidateRacer === null ? undefined : racers[magnet.candidateRacer]
    if (magnet.candidateRacer === null || candidate === undefined) {
      return Object.freeze({
        motion: magnet,
        timerMilliseconds,
        events: Object.freeze([]),
        turboEndedRacer: null,
      })
    }
    return Object.freeze({
      motion: Object.freeze({ ...magnet, candidateRacer: null }),
      timerMilliseconds,
      events: Object.freeze([
        getPullEvent(arithmetic, magnet, magnet.candidateRacer, candidate.flight, stepMilliseconds),
      ]),
      turboEndedRacer: null,
    })
  }
  const events: ProjectileEvent[] = []
  const isSlow = getIsBelowOrEqual(captured.flight.headingSpeed, STOPPED_SPEED)
  let timer = timerMilliseconds
  if (isSlow) {
    if (!captured.isTumbling && timer > CAPTURED_TIMER_CAP_MILLISECONDS) {
      timer = CAPTURED_TIMER_CAP_MILLISECONDS
    }
    if (!captured.isTumbling) {
      events.push({ type: 'projectiles.racer_tumbling_started', racer: capturedRacer })
    }
  }
  const isRacerStopped = magnet.isRacerStopped || isSlow
  let isRacerArrived = magnet.isRacerArrived
  if (!captured.flight.isVehiclePresent && isRacerStopped && !isRacerArrived) {
    events.push(getPullEvent(arithmetic, magnet, capturedRacer, captured.flight, stepMilliseconds))
    const target = getGroundTarget(arithmetic, magnet)
    if (
      getIsBelowOrEqual(captured.flight.headingSpeed, STOPPED_SPEED) &&
      getIsBelowOrEqual(
        getSquaredLength(
          arithmetic,
          Object.freeze({
            x: subtract(captured.flight.position.x, target.x),
            y: subtract(captured.flight.position.y, target.y),
            z: subtract(captured.flight.position.z, target.z),
          })
        ),
        ARRIVAL_DISTANCE_SQUARED
      )
    ) {
      isRacerArrived = true
    }
  }
  return Object.freeze({
    motion: Object.freeze({ ...magnet, isRacerStopped, isRacerArrived }),
    timerMilliseconds: timer,
    events: Object.freeze(events),
    turboEndedRacer: captured.isInTurbo ? capturedRacer : null,
  })
}
