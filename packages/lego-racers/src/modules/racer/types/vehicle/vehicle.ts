import { drawRandomValue } from '../../../random-table/index.ts'
import {
  getFloatFromBits,
  getNormalizedVector3,
  getStoredDifference,
  IDENTITY_MATRIX3,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { getRestartedForceFeedback } from '../force-feedback/force-feedback.ts'
import {
  blendFigureAnimation,
  chainFigureAnimation,
  createFigure,
  getFigureAnimationId,
  playFigureAnimation,
  updateFigure,
} from '../figure/figure.ts'
import { playRacerVoice } from '../racer-ranking/racer-ranking.ts'
import { getRacerVolume } from '../racer-volume/racer-volume.ts'
import { updateVehicleEmitters } from '../vehicle-emitters/vehicle-emitters.ts'
import { getVehicleLean } from './vehicle-lean.ts'
import { getRacer, setRacer, setRandomPosition } from '../racer-state/racer-state.ts'
import type {
  Figure,
  FigureBounds,
  Racer,
  RacerBoundary,
  RacerSet,
  RacerSetContext,
  Vehicle,
} from '../racer.types.ts'

const STANDING_SPEED = getFloatFromBits(0x38d1b717) // 0x004b09c4, 0.0001
const WHEEL_SPIN_SCALE = getFloatFromBits(0x3fe66666) // 0x004b01a4, 1.8
const STOPPING_PREVIOUS_SPEED = getFloatFromBits(0x3d4ccccd) // 0x004b0544, 0.05
const STOPPING_SPEED = getFloatFromBits(0x3c23d70a) // 0x004af668, 0.01
const LOOK_MINIMUM_SQUARED_DISTANCE = 2
const LOOK_MAXIMUM_SQUARED_DISTANCE = getFloatFromBits(0x471c4000) // 0x004b0b24, 200²
const LOOK_AHEAD_COSINE = getFloatFromBits(0x3e4ccccd) // 0x004b02e0, 0.2
const LOOK_BEHIND_COSINE = getFloatFromBits(0xbe4ccccd) // 0x004b0b44, -0.2
const LOOK_FAR_BEHIND_COSINE = getFloatFromBits(0xbf19999a) // 0x004b0b40, -0.6
const HIT_FEEDBACK_STRENGTH = 500 // 0x004220c0
const LOOK_BASE_MILLISECONDS = 5000
const LOOK_RANGE_MILLISECONDS = 1000
const RESTING_ANIMATION = 9
const FORWARD_REACTION_FLAG = 0x1
const HIT_REACTION_FLAG = 0x2

// Driver animations (vehicle +0x48): the ids 0x0043ec10 switches between.
const DriverAnimation = Object.freeze({
  STOPPED: 0,
  BOOST: 1,
  HIT: 0xa,
  REVERSING: 2,
  AFTER_REVERSING: 3,
  RELEASING_REVERSE: 4,
  STEERING_NEGATIVE: 5,
  STEERING_POSITIVE: 6,
  LOOK_AHEAD_LEFT: 7,
  LOOK_BEHIND_LEFT: 8,
  LOOK_AHEAD_RIGHT: 0x10,
  LOOK_BEHIND_RIGHT: 0x11,
  LOSER: 0xb,
  LOSER_AFTER: 0xc,
  WINNER_FIRST: 0xd,
  WINNER_SECOND: 0xe,
  WINNER_AFTER: 0xf,
})

const hasId = (id: number, ids: readonly number[]): boolean => ids.includes(id)

// The flags 0x0043a780 leaves: 0x0043db60 sets 2 and the reset itself 4.
const INITIAL_VEHICLE_FLAGS = 6

// 0x0043d5a0 and 0x0043d7a0: nothing is watched, no emitter exists, the car model frame is the identity and the driver
// sits at the origin until the first update. `lookMilliseconds` is the draw 0x0043d7a0 makes (`% 2000`, +0x388).
export const createVehicle = (
  driverFigure: Figure = createFigure([], null),
  seatPoint: Vector3 = ZERO_VECTOR3,
  lookMilliseconds = 0,
  bodyBounds: FigureBounds | null = null
): Vehicle =>
  Object.freeze({
    driverFigure,
    bodyBounds,
    volume: null,
    secondFigure: null,
    reactionFlags: 0,
    lookMilliseconds,
    previousForwardSpeed: 0,
    watchedRacerIndex: -1,
    flags: INITIAL_VEHICLE_FLAGS,
    dustEmitter: null,
    tireSmokeEmitter: null,
    boostEmitter: null,
    wheelEmitters: Object.freeze([null, null, null, null]),
    wheelEmitterNames: Object.freeze(['', '', '', '']),
    previousGroundedWheelCount: 0,
    seatPoint,
    bodyRotation: IDENTITY_MATRIX3,
    forwardLean: 0,
    driverPosition: ZERO_VECTOR3,
  })

// 0x0043cbb0 (thiscall on the racer set: position, minimum and maximum squared distance): the nearest racer inside the
// ring, by the display figure's position; the squared distance is (z² + y²) + x², stored.
const findNearestRacerInRing = (
  arithmetic: FloatArithmetic,
  racerSet: RacerSet,
  origin: Vector3
): number => {
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  let found = -1
  let best = getFloatFromBits(0x7f7fffff)
  for (const [index, racer] of racerSet.racers.entries()) {
    const { position } = racer.carBody.rigidBody.displayFrame
    const x = subtract(position.x, origin.x)
    const y = subtract(position.y, origin.y)
    const z = subtract(position.z, origin.z)
    const squared = storeFloat(add(add(multiply(z, z), multiply(y, y)), multiply(x, x)))
    if (getIsBelow(squared, LOOK_MINIMUM_SQUARED_DISTANCE)) continue
    if (!getIsBelowOrEqual(squared, LOOK_MAXIMUM_SQUARED_DISTANCE)) continue
    if (!getIsBelow(squared, best)) continue
    best = squared
    found = index
  }
  return found
}

const getHasFinished = (context: RacerSetContext, racer: Racer): boolean =>
  racer.currentLap >>> 0 >= context.raceLapCount >>> 0

const setVehicle = (
  racerSet: RacerSet,
  racerIndex: number,
  change: (racer: Racer) => Racer
): RacerSet => setRacer(racerSet, racerIndex, change(getRacer(racerSet, racerIndex)))

const withDriverFigure = (racer: Racer, driverFigure: Figure): Racer =>
  Object.freeze({ ...racer, vehicle: Object.freeze({ ...racer.vehicle, driverFigure }) })

// 0x0043ec10 once the driver figure has been updated: after the race a finished racer celebrates or sulks; a hard
// stop turns to the stopped animation with a voice line; a start boost or a hit plays its animation; otherwise
// the driver watches a racer within 200 units (one draw for the time before the next look), reverses, steers or rests.
const chooseDriverAnimation = (
  context: RacerSetContext,
  racerSet: RacerSet,
  racerIndex: number,
  driverId: number,
  reactionFlags: number
): RacerSet => {
  const { arithmetic, tables } = context
  const { getIsBelow, getIsBelowOrEqual, multiply, add } = arithmetic
  const racer = getRacer(racerSet, racerIndex)
  const { vehicle } = racer
  const { forwardSpeed } = racer.carBody.rigidBody
  const play = (id: number, nextId: number | null, base: RacerSet = racerSet): RacerSet =>
    setVehicle(base, racerIndex, (current) =>
      withDriverFigure(
        current,
        nextId === null
          ? playFigureAnimation(current.vehicle.driverFigure, id)
          : chainFigureAnimation(current.vehicle.driverFigure, id, nextId)
      )
    )
  const shake = (base: RacerSet): RacerSet =>
    setVehicle(base, racerIndex, (current) =>
      Object.freeze({
        ...current,
        forceFeedback: getRestartedForceFeedback(current.forceFeedback, HIT_FEEDBACK_STRENGTH),
      })
    )
  if (getHasFinished(context, racer)) {
    if (racer.racePosition === 1) {
      if (hasId(driverId, [0xd, 0xf, 0xe])) return racerSet
      const draw = drawRandomValue(tables.randomTable, racerSet.randomPosition)
      const drawn = setRandomPosition(racerSet, draw.position)
      return (draw.value & 1) === 0
        ? play(DriverAnimation.WINNER_FIRST, null, drawn)
        : play(DriverAnimation.WINNER_SECOND, DriverAnimation.WINNER_AFTER, drawn)
    }
    if (hasId(driverId, [DriverAnimation.LOSER_AFTER, DriverAnimation.LOSER])) return racerSet
    return play(DriverAnimation.LOSER, DriverAnimation.LOSER_AFTER)
  }
  if (
    !getIsBelowOrEqual(vehicle.previousForwardSpeed, STOPPING_PREVIOUS_SPEED) &&
    getIsBelow(forwardSpeed, STOPPING_SPEED) &&
    driverId !== DriverAnimation.STOPPED
  ) {
    const voiced = playRacerVoice(context, racerSet, racerIndex)
    const stopped = play(DriverAnimation.STOPPED, RESTING_ANIMATION, voiced)
    return shake(
      setVehicle(stopped, racerIndex, (current) =>
        Object.freeze({ ...current, vehicle: { ...current.vehicle, previousForwardSpeed: 0 } })
      )
    )
  }
  const remembered = setVehicle(racerSet, racerIndex, (current) =>
    Object.freeze({
      ...current,
      vehicle: { ...current.vehicle, previousForwardSpeed: forwardSpeed },
    })
  )
  if ((reactionFlags & FORWARD_REACTION_FLAG) !== 0) {
    return play(DriverAnimation.BOOST, RESTING_ANIMATION, remembered)
  }
  if ((reactionFlags & HIT_REACTION_FLAG) !== 0) {
    return shake(play(DriverAnimation.HIT, RESTING_ANIMATION, remembered))
  }
  if (
    hasId(driverId, [
      DriverAnimation.STOPPED,
      DriverAnimation.BOOST,
      DriverAnimation.HIT,
      DriverAnimation.WINNER_FIRST,
      DriverAnimation.WINNER_AFTER,
      DriverAnimation.LOSER_AFTER,
    ])
  ) {
    return remembered
  }
  if (getIsBelow(racer.driver.throttle, 0) && getIsBelow(forwardSpeed, 0)) {
    if (hasId(driverId, [DriverAnimation.REVERSING, DriverAnimation.AFTER_REVERSING])) {
      return remembered
    }
    return play(DriverAnimation.REVERSING, DriverAnimation.AFTER_REVERSING, remembered)
  }
  if (driverId === DriverAnimation.AFTER_REVERSING) {
    return play(DriverAnimation.RELEASING_REVERSE, RESTING_ANIMATION, remembered)
  }
  if (
    hasId(driverId, [
      DriverAnimation.LOOK_AHEAD_LEFT,
      DriverAnimation.LOOK_AHEAD_RIGHT,
      DriverAnimation.LOOK_BEHIND_LEFT,
      DriverAnimation.LOOK_BEHIND_RIGHT,
    ])
  ) {
    return remembered
  }
  const getSteering = (base: RacerSet): RacerSet => {
    const { curvature } = getRacer(base, racerIndex).driver
    const blend = (id: number): RacerSet =>
      setVehicle(base, racerIndex, (current) =>
        withDriverFigure(current, blendFigureAnimation(current.vehicle.driverFigure, id))
      )
    if (getIsBelow(curvature, 0) && driverId !== DriverAnimation.STEERING_NEGATIVE) {
      return blend(DriverAnimation.STEERING_NEGATIVE)
    }
    if (!getIsBelowOrEqual(curvature, 0) && driverId !== DriverAnimation.STEERING_POSITIVE) {
      return blend(DriverAnimation.STEERING_POSITIVE)
    }
    if (arithmetic.getIsEqual(curvature, 0) && driverId !== RESTING_ANIMATION) {
      return blend(RESTING_ANIMATION)
    }
    return base
  }
  if (vehicle.lookMilliseconds !== 0) return getSteering(remembered)
  const { rotation, position } = racer.carBody.rigidBody.displayFrame
  const watchedIndex = findNearestRacerInRing(arithmetic, racerSet, position)
  const watching = setVehicle(remembered, racerIndex, (current) =>
    Object.freeze({
      ...current,
      vehicle: { ...current.vehicle, watchedRacerIndex: watchedIndex },
    })
  )
  if (watchedIndex === -1) return getSteering(watching)
  const target = getRacer(racerSet, watchedIndex).carBody.rigidBody.displayFrame.position
  const direction = getNormalizedVector3(
    arithmetic,
    getStoredDifference(arithmetic, target, position)
  )
  const getAlong = (row: number): number =>
    add(
      add(
        multiply(rotation[row * 3 + 2] ?? 0, direction.z),
        multiply(rotation[row * 3 + 1] ?? 0, direction.y)
      ),
      multiply(rotation[row * 3] ?? 0, direction.x)
    )
  const ahead = getAlong(0)
  const side = getAlong(1)
  const isLeft = getIsBelow(side, 0)
  const getChoice = (): number | null => {
    if (!getIsBelow(ahead, LOOK_AHEAD_COSINE)) {
      return null
    }
    if (!getIsBelowOrEqual(ahead, LOOK_BEHIND_COSINE)) {
      return isLeft ? DriverAnimation.LOOK_AHEAD_LEFT : DriverAnimation.LOOK_AHEAD_RIGHT
    }
    if (getIsBelowOrEqual(ahead, LOOK_FAR_BEHIND_COSINE)) return null
    return isLeft ? DriverAnimation.LOOK_BEHIND_LEFT : DriverAnimation.LOOK_BEHIND_RIGHT
  }
  const choice = getChoice()
  if (choice === null) return getSteering(watching)
  const draw = drawRandomValue(tables.randomTable, watching.randomPosition)
  const drawn = setRandomPosition(watching, draw.position)
  return play(
    choice,
    RESTING_ANIMATION,
    setVehicle(drawn, racerIndex, (current) =>
      Object.freeze({
        ...current,
        vehicle: {
          ...current.vehicle,
          lookMilliseconds: (draw.value % LOOK_RANGE_MILLISECONDS) + LOOK_BASE_MILLISECONDS,
        },
      })
    )
  )
}

// 0x0043ec10 (thiscall on the vehicle: milliseconds): the driver figure is updated, the reactions asked for are
// consumed, the look timer counts down, and the next driver animation is chosen.
export const updateVehicleDriver: RacerBoundary = (
  context,
  racerSet,
  racerIndex,
  stepMilliseconds
) => {
  const racer = getRacer(racerSet, racerIndex)
  const { vehicle } = racer
  const driverId = getFigureAnimationId(vehicle.driverFigure)
  const lookMilliseconds =
    stepMilliseconds >= vehicle.lookMilliseconds ? 0 : vehicle.lookMilliseconds - stepMilliseconds
  const prepared = setRacer(
    racerSet,
    racerIndex,
    Object.freeze({
      ...racer,
      vehicle: Object.freeze({
        ...vehicle,
        driverFigure: updateFigure(context.arithmetic, vehicle.driverFigure, stepMilliseconds),
        reactionFlags: 0,
        lookMilliseconds,
      }),
    })
  )
  return chooseDriverAnimation(context, prepared, racerIndex, driverId, vehicle.reactionFlags)
}

// 0x00437740 (thiscall: milliseconds) with Vehicle_Update 0x0043e070. The wheels' animation follows the forward
// speed (about 0 and forwards: animation 0, backwards: animation 1) at |speed| · 1.8, on the display figure and the
// second figure; the display figure is then updated and the car model frame leans (0x0043e740, `getVehicleLean`),
// the driver's animation is chosen (0x0043ec10) and the emitters draw.
export const updateVehicle: RacerBoundary = (context, racerSet, racerIndex, stepMilliseconds) => {
  const { arithmetic } = context
  const { multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const racer = getRacer(racerSet, racerIndex)
  const { forwardSpeed } = racer.carBody.rigidBody
  const isStanding =
    !getIsBelowOrEqual(forwardSpeed, -STANDING_SPEED) && getIsBelow(forwardSpeed, STANDING_SPEED)
  const isReversing = !isStanding && getIsBelow(forwardSpeed, 0)
  const speed = isStanding ? 0 : isReversing ? -forwardSpeed : forwardSpeed
  const chassis = racer.figure
  const isReverseNeeded =
    isReversing && chassis.animations.length > 1 && getFigureAnimationId(chassis) !== 1
  const isForwardNeeded = !isReversing && getFigureAnimationId(chassis) !== 0
  const played = isReverseNeeded
    ? playFigureAnimation(chassis, 1)
    : isForwardNeeded
      ? playFigureAnimation(chassis, 0)
      : chassis
  const rate = storeFloat(multiply(speed, WHEEL_SPIN_SCALE))
  const { vehicle } = racer
  const lean = getVehicleLean({
    arithmetic,
    displayFrame: racer.carBody.rigidBody.displayFrame,
    bodyRotation: vehicle.bodyRotation,
    forwardLean: vehicle.forwardLean,
    sideLean: racer.vehicleSlideAngle,
    stepMilliseconds,
    mass: racer.carBody.rigidBody.mass,
    seatPoint: vehicle.seatPoint,
  })
  const wheels = setRacer(
    racerSet,
    racerIndex,
    Object.freeze({
      ...racer,
      figure: updateFigure(
        arithmetic,
        Object.freeze({ ...played, currentRate: rate }),
        stepMilliseconds
      ),
      vehicleSlideAngle: lean.sideLean,
      vehicle: Object.freeze({
        ...vehicle,
        secondFigure:
          vehicle.secondFigure === null
            ? null
            : Object.freeze({ ...vehicle.secondFigure, currentRate: rate }),
        bodyRotation: lean.bodyRotation,
        forwardLean: lean.forwardLean,
        driverPosition: lean.driverPosition,
      }),
    })
  )
  const driven = updateVehicleDriver(context, wheels, racerIndex, stepMilliseconds)
  const drivenRacer = getRacer(driven, racerIndex)
  const measured = setRacer(
    driven,
    racerIndex,
    Object.freeze({
      ...drivenRacer,
      vehicle: Object.freeze({
        ...drivenRacer.vehicle,
        volume: getRacerVolume(arithmetic, drivenRacer),
      }),
    })
  )
  return updateVehicleEmitters(context, measured, racerIndex)
}
