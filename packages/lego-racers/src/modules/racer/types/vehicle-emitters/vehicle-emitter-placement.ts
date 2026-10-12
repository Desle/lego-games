import {
  setEmitterBasis,
  setEmitterPosition,
  setEmitterVelocityOffset,
} from '../../../emitter/index.ts'
import type { EmitterPool, EmitterReference } from '../../../emitter/index.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { Racer, RacerSet } from '../racer.types.ts'

// 0x004b0b08 (0.6): the emitters carry a share of the car's velocity; 0x004b009c (2): the boost smoke sits that high.
const VELOCITY_SHARE = getFloatFromBits(0x3f19999a)
const BOOST_SMOKE_HEIGHT = getFloatFromBits(0x40000000)
const HALF = getFloatFromBits(0x3f000000)
// The wheel anchors are the car body's +0x1a4, +0x214, +0x284 and +0x2f4.
const REAR_LEFT_WHEEL = 2
const REAR_RIGHT_WHEEL = 3
const MARKING = 0x1

export const getWheelAnchor = (racer: Racer, wheelIndex: number): Vector3 =>
  racer.carBody.rigidBody.wheels[wheelIndex]?.anchor ?? { x: 0, y: 0, z: 0 }

// 0x0043def0, 0x0043dc00: the dust and the tire smoke start at the rear right wheel.
export const getRearRightWheelAnchor = (racer: Racer): Vector3 =>
  getWheelAnchor(racer, REAR_RIGHT_WHEEL)

// 0x0043df90: the middle of the two rear wheels, 2 higher.
export const getBoostSmokePosition = (arithmetic: FloatArithmetic, racer: Racer): Vector3 => {
  const { add, multiply, storeFloat } = arithmetic
  const left = getWheelAnchor(racer, REAR_LEFT_WHEEL)
  const right = getWheelAnchor(racer, REAR_RIGHT_WHEEL)
  return Object.freeze({
    x: storeFloat(multiply(add(left.x, right.x), HALF)),
    y: storeFloat(multiply(add(left.y, right.y), HALF)),
    z: storeFloat(add(multiply(add(left.z, right.z), HALF), BOOST_SMOKE_HEIGHT)),
  })
}

// 0x0043e3c4: the dust moves to a rear wheel, the right one when the draw's second bit is set.
export const getDustPosition = (racer: Racer, isRightWheel: boolean): Vector3 =>
  getWheelAnchor(racer, isRightWheel ? REAR_RIGHT_WHEEL : REAR_LEFT_WHEEL)

// 0x0043e56b: of the wheels that ask for marks, the first when the draw's second bit is set, else the last after the first;
// the origin when none does.
export const getTireSmokePosition = (racer: Racer, isFirstWheel: boolean): Vector3 => {
  const marking = racer.vehicle.skids.flags.flatMap((flag, index) =>
    (flag & MARKING) !== 0 ? [index] : []
  )
  const chosen = isFirstWheel ? marking.at(0) : marking.length > 1 ? marking.at(-1) : undefined
  return chosen === undefined ? { x: 0, y: 0, z: 0 } : getWheelAnchor(racer, chosen)
}

// 0x0043e1a0: the car's velocity, scaled.
export const getEmitterVelocityOffset = (arithmetic: FloatArithmetic, racer: Racer): Vector3 => {
  const { multiply, storeFloat } = arithmetic
  const { linearVelocity } = racer.carBody.rigidBody
  return Object.freeze({
    x: storeFloat(multiply(VELOCITY_SHARE, linearVelocity.x)),
    y: storeFloat(multiply(VELOCITY_SHARE, linearVelocity.y)),
    z: storeFloat(multiply(VELOCITY_SHARE, linearVelocity.z)),
  })
}

const getPoolWithPlacement = (
  arithmetic: FloatArithmetic,
  pool: EmitterPool,
  handleIndex: number,
  racer: Racer,
  position: Vector3,
  velocityOffset: Vector3 | null
): EmitterPool => {
  const based = setEmitterBasis(pool, handleIndex, racer.carBody.rigidBody.displayFrame.rotation)
  const placed = setEmitterPosition(based, handleIndex, position)
  return velocityOffset === null
    ? placed
    : setEmitterVelocityOffset(arithmetic, placed, handleIndex, velocityOffset)
}

// The vehicle hands an emitter the display frame's rotation as its basis and a position (frame slot +0x44, 0x00489660),
// and while it runs also a velocity offset (0x00489690).
export const placeVehicleEmitter = (
  arithmetic: FloatArithmetic,
  racerSet: RacerSet,
  reference: EmitterReference | null,
  racer: Racer,
  position: Vector3,
  velocityOffset: Vector3 | null
): RacerSet => {
  if (reference === null) return racerSet
  const pool = reference.isCommonPool ? racerSet.emitters.common : racerSet.emitters.track
  if (pool === null) return racerSet
  const placed = getPoolWithPlacement(
    arithmetic,
    pool,
    reference.handleIndex,
    racer,
    position,
    velocityOffset
  )
  return Object.freeze({
    ...racerSet,
    emitters: Object.freeze(
      reference.isCommonPool
        ? { ...racerSet.emitters, common: placed }
        : { ...racerSet.emitters, track: placed }
    ),
  })
}
