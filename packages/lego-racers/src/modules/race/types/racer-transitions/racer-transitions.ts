import type { PowerUpEvent } from '../../../power-ups/index.ts'
import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import {
  addCarBodyImpulse,
  addCarBodyVelocity,
  assignDriverRoute,
  clearCarBodyTwoPointMode,
  clearCarBodyVelocity,
  endCarBodyBoost,
  endCarBodyFlaggedState,
  endCarBodySpin,
  endCarBodyWarp,
  getDriven,
  getRacerWithoutTimedEffect,
  getRacerWithPartsMarked,
  getRacerWithTimedEffect,
  setCarBodyHeadingFromFrame,
  setCarBodyPush,
  setCarBodyTwoPointMode,
  setDriven,
  startCarBodyBoost,
  startCarBodyFlaggedState,
  startCarBodyFlip,
  startCarBodyWarp,
  startCarBodySpin,
  getRacerWithColourShiftOverride,
  WAND_COLOUR_SHIFT,
  WAND_COLOUR_SHIFT_MILLISECONDS,
  POWER_UP_EFFECT_FIGURE_DISTANCE,
} from '../../../racer/index.ts'
import { getThrowImpulse } from '../../../projectiles/index.ts'
import type { Racer } from '../../../racer/index.ts'
import { CarRigidBodyFlag } from '../../../racer-physics/index.ts'
import {
  FLOAT32_MAXIMUM,
  getFloatFromBits,
  getRotationFromFrameAxes,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'

export const COMPUTER_CONTROLLER = 2
export const PLAYER_CONTROLLER = 0
// Racer +0xd04 bits (see racer.md).
export const RACER_FINISHED_FLAG = 0x2
export const RACER_STARTING_FLAG = 0x400
export const RACER_PLACED_FLAG = 0x1000
const RACER_RESET_FLAGS_MASK = 0xffff8fff
const RACER_REVERSE_LAP_FLAG = 0x80000
// Driver +0x14 bit 0x80: the driver has no route (0x0043a0e0 sets it when 0x0043d070 finds none).
const DRIVER_NO_ROUTE_FLAG = 0x80
const LAP_GAP_COUNTDOWN_MILLISECONDS = 2000
const RACER_TUMBLING_FLAG = 0x8
const TUMBLING_TURBO_LEVEL = 2
const SPIN_RATE = getFloatFromBits(0x3be56042) // 0x004575db, 0x00457002: the spin of a slick or a rocket
const VEHICLE_HIT_REACTION = 2
const WARP_PENDING_FLAG = 0x200000
const WARP_DISABLED_FLAG = 0x10
const UP_AXIS: Vector3 = Object.freeze({ x: 0, y: 0, z: 1 })
const WAND_THROW_POWER = 1 // 0x00455440 throws a struck racer like a blast at full power

// 0x004374c0, the racer fields: flag 0x2 set and 0x1000..0x4000 cleared, no checkpoint, zone history 0, 2, 1, no lap.
// The route placement (0x0042a670, car body +0xb30 = 1) is done by the scripted car body code.
export const resetRacerForRace = (racer: Racer): Racer =>
  Object.freeze({
    ...racer,
    flags: ((racer.flags & RACER_RESET_FLAGS_MASK) | RACER_FINISHED_FLAG) >>> 0,
    checkpointIndex: -1,
    zoneCurrent: 0,
    currentLap: 0,
    wrongWayMilliseconds: 0,
    checkpointSide: 1,
    zonePrevious: 2,
    zoneBeforePrevious: 1,
    lapCrossings: -1,
    lap: -1,
  })

// 0x00439340, the racer fields: flag 0x2 cleared and the zone history restarted at 0, 2, 1.
export const releaseRacerAtStart = (racer: Racer): Racer =>
  Object.freeze({
    ...racer,
    flags: racer.flags & ~RACER_FINISHED_FLAG,
    zoneCurrent: 0,
    zonePrevious: 2,
    zoneBeforePrevious: 1,
  })

// 0x0043d070: the loaded route whose loop point (route +0x24, the second vector) is nearest to the racer, by the
// squared distance summed as (z² + y²) + x² (the minimum starts at FLT_MAX and is stored as a float32).
export const getNearestRoute = (
  arithmetic: FloatArithmetic,
  position: Vector3,
  routes: readonly (ComputerRacerRoute | null)[]
): ComputerRacerRoute | null => {
  const { add, subtract, multiply, storeFloat, getIsBelow } = arithmetic
  let nearest: ComputerRacerRoute | null = null
  let minimum = FLOAT32_MAXIMUM
  for (const route of routes) {
    if (route === null || route.samples.length === 0) continue
    const [x, y, z] = route.secondVector
    const differenceX = subtract(x, position.x)
    const differenceY = subtract(y, position.y)
    const differenceZ = subtract(z, position.z)
    const distance = add(
      add(multiply(differenceZ, differenceZ), multiply(differenceY, differenceY)),
      multiply(differenceX, differenceX)
    )
    if (!getIsBelow(distance, minimum)) continue
    minimum = storeFloat(distance)
    nearest = route
  }
  return nearest
}

// 0x0043a0e0: a finished player (or the demonstration's racer) is driven by the computer from then on. A racer
// without a route asks for the nearest loaded one (0x0043d070) and follows it (0x004202f0); with none it is marked
// as having no route (driver flag 0x80).
export const convertRacerToComputer = (
  arithmetic: FloatArithmetic,
  racer: Racer,
  routes: readonly (ComputerRacerRoute | null)[]
): Racer => {
  const converted = Object.freeze({ ...racer, controllerKind: COMPUTER_CONTROLLER })
  if (racer.driver.route !== null || racer.carBody.routeFollower !== null) return converted
  const route = getNearestRoute(arithmetic, racer.carBody.rigidBody.displayFrame.position, routes)
  if (route === null) {
    return Object.freeze({
      ...converted,
      driver: Object.freeze({
        ...converted.driver,
        flags: converted.driver.flags | DRIVER_NO_ROUTE_FLAG,
      }),
    })
  }
  return Object.freeze({
    ...converted,
    ...setDriven(converted, assignDriverRoute(arithmetic, getDriven(converted), route)),
  })
}

// The history shift every zone function ends with (0x00439b7c, 0x00439c19, 0x00439c4b).
const getRacerInZone = (racer: Racer, zone: number): Racer =>
  Object.freeze({
    ...racer,
    zoneBeforePrevious: racer.zonePrevious,
    zonePrevious: racer.zoneCurrent,
    zoneCurrent: zone,
  })

// 0x00439b70: zone 0 (only when the racer is not in it already).
export const enterZoneZero = (racer: Racer): Racer =>
  racer.zoneCurrent === 0 ? racer : getRacerInZone(racer, 0)

// 0x00439c40: zone 2.
export const enterZoneTwo = (racer: Racer): Racer =>
  racer.zoneCurrent === 2 ? racer : getRacerInZone(racer, 2)

// 0x00439ba0, the lap line (zone 1): coming from zone 0 after zones 2 and 1 counts a crossing, and a crossing
// beyond the current lap starts the next one. `lapGapMilliseconds` is what 0x0043cda0 returns for the new lap.
export const enterZoneOne = (
  racer: Racer,
  getLapGapMilliseconds: (racer: Racer) => number
): Racer => {
  if (racer.zoneCurrent === 1) return racer
  const isLineCrossed =
    racer.zoneCurrent === 0 && racer.zonePrevious === 2 && racer.zoneBeforePrevious === 1
  if (!isLineCrossed) return getRacerInZone(racer, 1)
  const lapCrossings = racer.lapCrossings + 1
  const counted = Object.freeze({ ...racer, lapCrossings })
  if (lapCrossings <= 0 || lapCrossings <= racer.currentLap) return getRacerInZone(counted, 1)
  const next = Object.freeze({ ...counted, currentLap: racer.currentLap + 1 })
  const gap = getLapGapMilliseconds(next)
  const isGapShown = gap !== 0 && next.currentLap < next.lapCount
  return getRacerInZone(
    isGapShown
      ? Object.freeze({
          ...next,
          unidentifiedCountdownD84Milliseconds: LAP_GAP_COUNTDOWN_MILLISECONDS,
        })
      : next,
    1
  )
}

// 0x00439fc0 after the side test: a checkpoint with progress 0 is the start line.
export const getRacerAfterCheckpointTouch = (
  racer: Racer,
  checkpointIndex: number,
  isStartLine: boolean,
  side: number
): Racer => {
  if (racer.checkpointIndex === checkpointIndex && racer.checkpointSide === side) return racer
  const withCheckpoint = (changed: Racer): Racer =>
    Object.freeze({ ...changed, checkpointIndex, checkpointSide: side })
  if (isStartLine && side === 0) {
    return Object.freeze({
      ...withCheckpoint(racer),
      checkpointSide: 0,
      flags: racer.flags | RACER_REVERSE_LAP_FLAG,
      zoneCurrent: 0,
      zonePrevious: 2,
      zoneBeforePrevious: 2,
    })
  }
  const isReversed = (racer.flags & RACER_REVERSE_LAP_FLAG) !== 0
  if (isStartLine) {
    return withCheckpoint(
      Object.freeze({
        ...racer,
        lap: isReversed ? racer.lap : racer.lap + 1,
        flags: racer.flags & ~RACER_REVERSE_LAP_FLAG,
      })
    )
  }
  if (!isReversed) return withCheckpoint(racer)
  return withCheckpoint(
    Object.freeze({ ...racer, lap: racer.lap - 1, flags: racer.flags & ~RACER_REVERSE_LAP_FLAG })
  )
}

// 0x0045cd70's flip: the rate pushed with the boost's milliseconds (0xbb23d70a).
const TURBO_FLIP_RATE = Math.fround(-0.0025)
const RACER_TURBO_FLAG = 0x40
const DRIVER_FULL_THROTTLE_FLAG = 0x1
const DRIVER_FULL_THROTTLE_TOUCHING_FLAG = 0x100

// 0x00439570: the racer tumbles (flag 0x8, once): the car body's spin ends (slot 0x2c) and it goes into two-point mode
// (slot 0x30).
export const getRacerTumbling = (arithmetic: FloatArithmetic, racer: Racer): Racer =>
  (racer.flags & RACER_TUMBLING_FLAG) !== 0
    ? racer
    : Object.freeze({
        ...racer,
        flags: (racer.flags | RACER_TUMBLING_FLAG) >>> 0,
        carBody: setCarBodyTwoPointMode(arithmetic, endCarBodySpin(arithmetic, racer.carBody)),
      })

// 0x004395a0: a tumbling racer (flag 0x8) stops tumbling and its car body leaves two-point mode (slot 13).
export const getRacerFromTumbling = (racer: Racer): Racer =>
  (racer.flags & RACER_TUMBLING_FLAG) === 0
    ? racer
    : Object.freeze({
        ...racer,
        flags: (racer.flags & ~RACER_TUMBLING_FLAG) >>> 0,
        carBody: clearCarBodyTwoPointMode(racer.carBody),
      })

// 0x0045cd70 → 0x00429cf0 on the car body, then 0x004396c0: racer flag 0x40, the driver at full throttle (driver
// flag 0x1 set, 0x100 cleared), the heading from the frame (0x00446fa0), the boost (0x004292e0) and racer +0xd68, the
// level; level 2 ends with the tumble (0x00439570). The vehicle's effects are not applied here.
export const getRacerAfterTurboStart = (
  arithmetic: FloatArithmetic,
  racer: Racer,
  boostMilliseconds: number,
  level: number
): Racer => {
  const flipped = startCarBodyFlip(arithmetic, racer.carBody, TURBO_FLIP_RATE, boostMilliseconds)
  const started: Racer = Object.freeze({
    ...racer,
    flags: (racer.flags | RACER_TURBO_FLAG) >>> 0,
    driver: Object.freeze({
      ...racer.driver,
      flags: (racer.driver.flags & ~DRIVER_FULL_THROTTLE_TOUCHING_FLAG) | DRIVER_FULL_THROTTLE_FLAG,
    }),
    carBody: startCarBodyBoost(arithmetic, setCarBodyHeadingFromFrame(arithmetic, flipped)),
    turboLevel: level,
  })
  return level === TUMBLING_TURBO_LEVEL ? getRacerTumbling(arithmetic, started) : started
}

// 0x00439730 (then 0x004395a0, which acts on racer flag 0x8): racer flag 0x40 and driver flags 0x101 cleared, and
// the boost ends (0x00429330).
export const getRacerAfterTurboEnd = (arithmetic: FloatArithmetic, racer: Racer): Racer =>
  getRacerFromTumbling(
    Object.freeze({
      ...racer,
      flags: (racer.flags & ~RACER_TURBO_FLAG) >>> 0,
      driver: Object.freeze({
        ...racer.driver,
        flags:
          racer.driver.flags & ~(DRIVER_FULL_THROTTLE_FLAG | DRIVER_FULL_THROTTLE_TOUCHING_FLAG),
      }),
      carBody: endCarBodyBoost(arithmetic, racer.carBody),
    })
  )

// 0x004397a0 (car body slot 14), the racer's velocity cleared, then slot 7 (0x00429a70) with the impulse: the racer is
// thrown (a blast 0x00421c00, the wand 0x00455440).
export const getRacerThrown = (
  arithmetic: FloatArithmetic,
  racer: Racer,
  impulse: Vector3
): Racer =>
  Object.freeze({
    ...racer,
    carBody: addCarBodyVelocity(
      arithmetic,
      clearCarBodyVelocity(startCarBodyFlaggedState(racer.carBody)),
      impulse
    ),
  })

// 0x004395d0 (the warp takes the car off the track): flag 0x10, the timed effect ends (0x00439b00), the car body's spin
// and tows end (slots 11, 17 and 19) and, for a human's free body, the hull stops testing the track (flag 0x1000,
// 0x00429a90's other branch). The vehicle's smoke and fade (0x0043dcd0, 0x0043dbb0) are `stopVehicleEffectsForWarp`; the parts' radii go with 0x00440160.
const getRacerWarpStarted = (arithmetic: FloatArithmetic, racer: Racer): Racer => {
  const ended = getRacerWithoutTimedEffect(racer)
  const spun = endCarBodySpin(arithmetic, ended.carBody)
  const untowed = setCarBodyPush(
    arithmetic,
    setCarBodyPush(arithmetic, spun, 'extraForceA', undefined),
    'extraForceB',
    undefined
  )
  const started = Object.freeze({
    ...ended,
    flags: ((ended.flags & ~WARP_PENDING_FLAG) | WARP_DISABLED_FLAG) >>> 0,
    carBody: untowed.isScripted
      ? startCarBodyWarp(untowed)
      : Object.freeze({
          ...untowed,
          rigidBody: Object.freeze({
            ...untowed.rigidBody,
            flags: untowed.rigidBody.flags | CarRigidBodyFlag.WITHOUT_TRACK_CONTACTS,
          }),
        }),
  })
  // 0x00440160(1.0), the last call of 0x0045dc90's first branch.
  return getRacerWithPartsMarked(arithmetic, started, 1)
}

// 0x00439660: the racer is back on the track.
const getRacerWarpEnded = (racer: Racer): Racer =>
  Object.freeze({
    ...racer,
    // 0x0043db60 sets the fade flag and the reset 4.
    vehicle: Object.freeze({ ...racer.vehicle, flags: racer.vehicle.flags | 6 }),
    flags: (racer.flags & ~WARP_DISABLED_FLAG) >>> 0,
    carBody: racer.carBody.isScripted
      ? endCarBodyWarp(racer.carBody)
      : Object.freeze({
          ...racer.carBody,
          rigidBody: Object.freeze({
            ...racer.carBody.rigidBody,
            flags: racer.carBody.rigidBody.flags & ~CarRigidBodyFlag.WITHOUT_TRACK_CONTACTS,
          }),
        }),
  })

// 0x0045d780 state 3: the warp carries the racer's display and physics frames along the route.
export const getRacerMoved = (racer: Racer, position: Vector3): Racer =>
  Object.freeze({
    ...racer,
    carBody: Object.freeze({
      ...racer.carBody,
      rigidBody: Object.freeze({
        ...racer.carBody.rigidBody,
        displayFrame: Object.freeze({ ...racer.carBody.rigidBody.displayFrame, position }),
        frame: Object.freeze({ ...racer.carBody.rigidBody.frame, position }),
      }),
    }),
  })

// 0x0045dc90 state 3 for a human's free body: both frames take the landing position and face along `forward` with z up
// (frame slot 0x40, 0x00410900), the velocity is cleared, the body is pushed along `forward` (slot 8) and its heading
// follows the frame (0x00446fa0). A computer's scripted body only comes back on the track.
export const getRacerLanded = (
  arithmetic: FloatArithmetic,
  racer: Racer,
  position: Vector3,
  forward: Vector3,
  speed: number
): Racer => {
  // A computer's scripted body is only put down where the ground is (0x0045e080); the rest is for a human.
  if (racer.controllerKind === COMPUTER_CONTROLLER) return getRacerMoved(racer, position)
  const rotation = getRotationFromFrameAxes(arithmetic, {
    first: forward,
    third: UP_AXIS,
  })
  const { rigidBody } = racer.carBody
  const placed = Object.freeze({
    ...racer.carBody,
    rigidBody: Object.freeze({
      ...rigidBody,
      displayFrame: Object.freeze({ position, rotation }),
      frame: Object.freeze({ position, rotation }),
      linearVelocity: ZERO_VECTOR3,
    }),
  })
  return Object.freeze({
    ...racer,
    carBody: setCarBodyHeadingFromFrame(
      arithmetic,
      addCarBodyImpulse(arithmetic, placed, forward, speed)
    ),
  })
}

const MAGNETIZED_FLAG = 0x100000
const DRIVER_MAGNETIZED_FLAG = 0x80
const CAR_BODY_FADING_FLAG = 0x40000

// 0x0043a130 (then 0x004395a0): flag 0x100000; a human's driver gets flag 0x80 (the tire smoke starts, see race-world); a
// scripted body's target speed factors go to 0 (the current one unless flag 0x40000 is set).
const getRacerMagnetized = (racer: Racer): Racer => {
  const flagged: Racer = Object.freeze({
    ...racer,
    flags: (racer.flags | MAGNETIZED_FLAG) >>> 0,
    driver:
      racer.controllerKind === COMPUTER_CONTROLLER
        ? racer.driver
        : Object.freeze({ ...racer.driver, flags: racer.driver.flags | DRIVER_MAGNETIZED_FLAG }),
  })
  return getRacerFromTumbling(getRacerWithScriptedSpeedFactors(flagged, 0))
}

// 0x0043a1a0 (then 0x004395a0): the undo of the above, the factors going back to 1.
const getRacerReleasedByMagnet = (racer: Racer): Racer => {
  const flagged: Racer = Object.freeze({
    ...racer,
    flags: (racer.flags & ~MAGNETIZED_FLAG) >>> 0,
    driver:
      racer.controllerKind === COMPUTER_CONTROLLER
        ? racer.driver
        : Object.freeze({ ...racer.driver, flags: racer.driver.flags & ~DRIVER_MAGNETIZED_FLAG }),
  })
  return getRacerFromTumbling(getRacerWithScriptedSpeedFactors(flagged, 1))
}

const getRacerWithScriptedSpeedFactors = (racer: Racer, factor: number): Racer =>
  !racer.carBody.isScripted
    ? racer
    : Object.freeze({
        ...racer,
        carBody: Object.freeze({
          ...racer.carBody,
          defaultTargetSpeedFactor: factor,
          targetSpeedFactor:
            (racer.carBody.rigidBody.flags & CAR_BODY_FADING_FLAG) === 0
              ? factor
              : racer.carBody.targetSpeedFactor,
        }),
      })

const getRacerWithFlags = (racer: Racer, flags: number): Racer =>
  Object.freeze({ ...racer, flags: flags >>> 0 })

// The racer-side effects power-ups names after their original calls: 0x00439770, 0x00439790, 0x0043a270 (+0xd74),
// 0x00439900 (+0xd7c, flag 0x800), 0x0045d560 (0x200000), 0x004395d0 (0x10), 0x00439660 and 0x0043a130 (0x100000).
// The turbo start and end (0x0045cd70, 0x00439730). The rest (magnet release, lightning, grapple) call racer code
// that is not ported; they only reach the
// caller as events.
export const getRacerAfterPowerUpEvent = (
  arithmetic: FloatArithmetic,
  racer: Racer,
  event: PowerUpEvent
): Racer => {
  switch (event.type) {
    case 'power_ups.racer_turbo_started':
      return getRacerAfterTurboStart(arithmetic, racer, event.boostMilliseconds, event.level)
    case 'power_ups.racer_turbo_ended':
      return getRacerAfterTurboEnd(arithmetic, racer)
    case 'power_ups.racer_shield_raised':
      return Object.freeze({
        ...getRacerWithFlags(racer, racer.flags | 0x1),
        shieldLevel: event.level,
        // Racer +0xd6c is both the shield level and what the shield does to a racer it hits (0x00438560).
        attackKind: event.level,
      })
    case 'power_ups.racer_shield_lowered':
      return getRacerWithFlags(racer, racer.flags & ~0x1)
    case 'power_ups.racer_shield_struck':
      return Object.freeze({ ...racer, unidentifiedCountdownD74Milliseconds: 500 })
    case 'power_ups.racer_cursed':
      return getRacerWithTimedEffect(
        arithmetic,
        racer,
        event.durationMilliseconds,
        POWER_UP_EFFECT_FIGURE_DISTANCE
      )
    case 'power_ups.racer_warp_pending':
      return getRacerWithFlags(racer, racer.flags | 0x200000)
    case 'power_ups.racer_curse_lifted':
      return getRacerWithoutTimedEffect(racer)
    case 'power_ups.racer_warp_started':
      return getRacerWarpStarted(arithmetic, racer)
    case 'power_ups.racer_warp_stolen': {
      // The reset runs in the racers' power-up pass, after the frame's vehicle update. A racer on the track has its
      // parts read (and so refreshed) again before the frame ends; one that is off it (flag 0x10) keeps them marked.
      if ((racer.flags & WARP_DISABLED_FLAG) !== 0) {
        return Object.freeze({
          ...racer,
          vehicle: Object.freeze({ ...racer.vehicle, pendingPartsMarkScale: 1 }),
        })
      }
      const marked = getRacerWithPartsMarked(arithmetic, racer, 1)
      return Object.freeze({
        ...marked,
        vehicle: Object.freeze({ ...marked.vehicle, boundsCaches: null }),
      })
    }
    case 'power_ups.racer_warp_reset':
      return getRacerWithPartsMarked(arithmetic, racer, 1)
    case 'power_ups.racer_warp_ended':
      return getRacerWarpEnded(racer)
    case 'power_ups.racer_magnetized':
      return getRacerMagnetized(racer)
    case 'power_ups.racer_released_by_magnet':
      return getRacerReleasedByMagnet(racer)
    case 'power_ups.racer_spun_out':
      return Object.freeze({
        ...racer,
        carBody: startCarBodySpin(
          arithmetic,
          racer.carBody,
          event.strength,
          SPIN_RATE,
          event.spinTime
        ),
      })
    case 'power_ups.racer_hit':
      // Racer +0x39c (vehicle +0x384) |= 2: the driver and the car play the hit reaction.
      return Object.freeze({
        ...racer,
        vehicle: Object.freeze({
          ...racer.vehicle,
          reactionFlags: racer.vehicle.reactionFlags | VEHICLE_HIT_REACTION,
        }),
      })
    case 'power_ups.racer_flipped':
      return Object.freeze({
        ...racer,
        carBody: startCarBodyFlip(arithmetic, racer.carBody, event.rate, event.milliseconds),
      })
    case 'power_ups.racer_struck_by_lightning':
      return getRacerWithColourShiftOverride(
        getRacerThrown(
          arithmetic,
          racer,
          getThrowImpulse(arithmetic, racer.carBody.rigidBody.heading, WAND_THROW_POWER)
        ),
        WAND_COLOUR_SHIFT,
        WAND_COLOUR_SHIFT_MILLISECONDS
      )
    case 'power_ups.racer_released_by_lightning':
      return Object.freeze({ ...racer, carBody: endCarBodyFlaggedState(racer.carBody) })
    default:
      return racer
  }
}
