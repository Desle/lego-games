import { CarRigidBodyFlag } from '../../../racer-physics/index.ts'
import { getFrameTransformedPoint, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { Racer } from '../racer.types.ts'
import type { VehicleSkids, VehicleSkidStep, VehicleWheelMarks } from './vehicle-skids.types.ts'

const FIRST_REAR_WHEEL = 2
const MARKING = 0x1
const ON_GROUND = 0x2
const COOLING = 0x4
const ALL_UPPER_BITS = 0xfe
const WHEEL_AIRBORNE_LIMIT = 0x96
const COOLDOWN_LIMIT = 0x3e8
const RACER_TURBO_FLAG = 0x40
const WHEELS_SPINNING_FLAG = 0x100
export const SKID_IMAGE_NAME = 'skid'
export const TURBO_SKID_IMAGE_NAME = 'trbskid'
const NO_WHEELS: readonly number[] = Object.freeze([0, 0, 0, 0])

// 0x0043d5a0 clears the flags and timers; the chassis gives the points and widths (0x0043d7a0), 0x0043a870 the name.
export const createVehicleSkids = (marks: VehicleWheelMarks): VehicleSkids =>
  Object.freeze({
    flags: NO_WHEELS,
    wheelMilliseconds: NO_WHEELS,
    cooldownMilliseconds: NO_WHEELS,
    wheelPoints: marks.points,
    widths: marks.widths,
    imageName: SKID_IMAGE_NAME,
    releaseCount: 0,
    step: null,
  })

export const getSkidsWithImageName = (skids: VehicleSkids, imageName: string): VehicleSkids =>
  Object.freeze({ ...skids, imageName })

// 0x0043dc00: every wheel asks for marks when the car spins, else only the rear wheels do (the front ones lose their
// marking and ground bits).
export const getSkidsStarted = (skids: VehicleSkids, bodyFlags: number): VehicleSkids =>
  Object.freeze({
    ...skids,
    flags: Object.freeze(
      skids.flags.map((flag, index) =>
        (bodyFlags & CarRigidBodyFlag.SPINNING) !== 0 || index >= FIRST_REAR_WHEEL
          ? MARKING
          : flag & ~(MARKING | ON_GROUND)
      )
    ),
  })

// 0x0043dcd0: the trails are let go and the flags of the wheels that stood on the ground turn into a cooldown.
export const getSkidsStopped = (skids: VehicleSkids): VehicleSkids =>
  Object.freeze({
    ...skids,
    flags: Object.freeze(
      skids.flags.map((flag) => ((flag & ON_GROUND) !== 0 ? (flag & ~ON_GROUND) | COOLING : 0))
    ),
    releaseCount: skids.releaseCount + 1,
  })

// 0x0043e102: a cooldown that has run for more than a second ends.
export const getSkidCooldownsStepped = (
  skids: VehicleSkids,
  elapsedMilliseconds: number
): VehicleSkids => {
  const isCooling = skids.flags.map((flag) => (flag & COOLING) !== 0)
  const cooldowns = skids.cooldownMilliseconds.map((milliseconds, index) =>
    isCooling[index] === true ? milliseconds + elapsedMilliseconds : milliseconds
  )
  const isOver = cooldowns.map(
    (milliseconds, index) => isCooling[index] === true && milliseconds > COOLDOWN_LIMIT
  )
  return Object.freeze({
    ...skids,
    flags: Object.freeze(
      skids.flags.map((flag, index) => (isOver[index] === true ? flag & ~COOLING : flag))
    ),
    cooldownMilliseconds: Object.freeze(
      cooldowns.map((milliseconds, index) => (isOver[index] === true ? 0 : milliseconds))
    ),
  })
}

const getSidedFlags = (
  arithmetic: FloatArithmetic,
  racer: Racer,
  flags: readonly number[]
): readonly number[] => {
  const { rigidBody } = racer.carBody
  const [first = 0, second = 0, third = 0, fourth = 0] = flags
  if ((rigidBody.flags & CarRigidBodyFlag.SPINNING) !== 0) {
    return [
      first | ALL_UPPER_BITS,
      second | ALL_UPPER_BITS,
      third | ALL_UPPER_BITS,
      fourth | ALL_UPPER_BITS,
    ]
  }
  if ((racer.flags & RACER_TURBO_FLAG) !== 0) {
    return [first & ~MARKING, second & ~MARKING, third | MARKING, fourth | MARKING]
  }
  const { add, multiply } = arithmetic
  const { velocityDirection: velocity } = rigidBody
  const row = rigidBody.displayFrame.rotation
  const dot = add(
    add(multiply(velocity.y, row[4]), multiply(velocity.z, row[5])),
    multiply(velocity.x, row[3])
  )
  return arithmetic.getIsBelowOrEqual(dot, 0)
    ? [first | MARKING, second & ~MARKING, third | MARKING, fourth & ~MARKING]
    : [first & ~MARKING, second | MARKING, third & ~MARKING, fourth | MARKING]
}

// 0x0043f1e0 without the trails: a wheel that asks for marks and stands on the ground is marking; one that has been off
// the ground for more than 150 ms is not. The flags then follow the car: spinning, in turbo, or the side the velocity
// leans to. The step carries what the trails need.
export const getSkidsStepped = (
  arithmetic: FloatArithmetic,
  racer: Racer,
  elapsedMilliseconds: number
): VehicleSkids => {
  const { vehicle } = racer
  const { skids } = vehicle
  const { wheels, displayFrame } = racer.carBody.rigidBody
  const timers = [...skids.wheelMilliseconds]
  const flags = skids.flags.map((flag, index) => {
    const isOnGround = wheels[index]?.isOnGround === true
    if ((flag & MARKING) === 0) return flag & ~ON_GROUND
    if ((flag & ON_GROUND) === 0 && isOnGround) return flag | ON_GROUND
    if (isOnGround) {
      timers[index] = 0
      return flag
    }
    const milliseconds = (timers[index] ?? 0) + elapsedMilliseconds
    timers[index] = milliseconds > WHEEL_AIRBORNE_LIMIT ? 0 : milliseconds
    return milliseconds > WHEEL_AIRBORNE_LIMIT ? flag & ~ON_GROUND : flag
  })
  const sided = getSidedFlags(arithmetic, racer, flags)
  const step: VehicleSkidStep = Object.freeze({
    index: (skids.step?.index ?? 0) + 1,
    elapsedMilliseconds,
    isSpinning: (vehicle.flags & WHEELS_SPINNING_FLAG) !== 0,
    wheels: Object.freeze(
      sided.map((flag, index) =>
        Object.freeze({
          position: getFrameTransformedPoint(
            arithmetic,
            displayFrame,
            skids.wheelPoints[index] ?? ZERO_VECTOR3
          ),
          isMarking: (flag & MARKING) !== 0,
        })
      )
    ),
  })
  return Object.freeze({
    ...skids,
    flags: Object.freeze(sided),
    wheelMilliseconds: Object.freeze(timers),
    step,
  })
}
