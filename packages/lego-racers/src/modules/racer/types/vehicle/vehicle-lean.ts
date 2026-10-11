import {
  getFloatFromBits,
  getFrameTransformedPoint,
  getRotationFromFirstAndSecondAxes,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Frame, Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import type { VehicleLean, VehicleLeanRequest } from './vehicle-lean.types.ts'

const FORWARD_STIFFNESS = 30 // 0x004b0b28
const FORWARD_DAMPING = getFloatFromBits(0x3c23d70a) // 0x004b0b30, 0.01
const SIDE_STIFFNESS = 100 // 0x004b0b2c
const SIDE_DAMPING = getFloatFromBits(0x3cf5c28f) // 0x004b0b34, 0.03

const getRow = (rotation: Matrix3, row: number): Vector3 =>
  Object.freeze({
    x: rotation[row * 3] ?? 0,
    y: rotation[row * 3 + 1] ?? 0,
    z: rotation[row * 3 + 2] ?? 0,
  })

// The vector product `first × second` the way 0x0043e740 stores it: every component is stored.
const getStoredCross = (arithmetic: FloatArithmetic, first: Vector3, second: Vector3): Vector3 => {
  const { subtract, multiply, storeFloat } = arithmetic
  return Object.freeze({
    x: storeFloat(subtract(multiply(first.y, second.z), multiply(first.z, second.y))),
    y: storeFloat(subtract(multiply(first.z, second.x), multiply(first.x, second.z))),
    z: storeFloat(subtract(multiply(first.x, second.y), multiply(first.y, second.x))),
  })
}

// The length of `target − source` as 0x0043e740 sums it: (z² + y²) + x², unrounded until the square root.
const getDistance = (arithmetic: FloatArithmetic, source: Vector3, target: Vector3): number => {
  const { add, subtract, multiply, getSquareRoot } = arithmetic
  const x = subtract(source.x, target.x)
  const y = subtract(source.y, target.y)
  const z = subtract(source.z, target.z)
  return getSquareRoot(add(add(multiply(z, z), multiply(y, y)), multiply(x, x)))
}

// (z · up.z + y · up.y) + x · up.x < 0: the distance counts negative when the pull points against the up axis.
const getIsAgainstUp = (arithmetic: FloatArithmetic, pull: Vector3, up: Vector3): boolean => {
  const { add, multiply, getIsBelow } = arithmetic
  return getIsBelow(
    add(add(multiply(pull.z, up.z), multiply(pull.y, up.y)), multiply(pull.x, up.x)),
    0
  )
}

// One spring of 0x0043e740: the velocity `−stiffness · distance · step / mass + previous` (stored), then damped by
// `step · damping · velocity` while that moves it towards 0 from either side; otherwise it stops.
const getSpring = (
  arithmetic: FloatArithmetic,
  request: {
    readonly distance: number
    readonly stepFloat: number
    readonly mass: number
    readonly stiffness: number
    readonly damping: number
    readonly previous: number
  }
): number => {
  const { add, subtract, multiply, divide, storeFloat, getIsBelow } = arithmetic
  const velocity = storeFloat(
    add(
      divide(
        multiply(multiply(-request.stiffness, request.distance), request.stepFloat),
        request.mass
      ),
      request.previous
    )
  )
  const damped = storeFloat(multiply(multiply(request.stepFloat, request.damping), velocity))
  const isDamped =
    (getIsBelow(0, velocity) && getIsBelow(damped, velocity)) ||
    (getIsBelow(velocity, 0) && getIsBelow(velocity, damped))
  return isDamped ? storeFloat(subtract(velocity, damped)) : 0
}

// `base + spring · up`, each component stored (0x00404550 after the scaling stores).
const getLeanedAxis = (
  arithmetic: FloatArithmetic,
  base: Vector3,
  spring: number,
  up: Vector3
): Vector3 => {
  const { add, multiply, storeFloat } = arithmetic
  const scaled = {
    x: storeFloat(multiply(spring, up.x)),
    y: storeFloat(multiply(spring, up.y)),
    z: storeFloat(multiply(spring, up.z)),
  }
  return Object.freeze({
    x: storeFloat(add(base.x, scaled.x)),
    y: storeFloat(add(base.y, scaled.y)),
    z: storeFloat(add(base.z, scaled.z)),
  })
}

// Vehicle_Update 0x0043e070 calls 0x0043e740 after it has updated the display figure: the car model frame (vehicle
// +0x3c) leans like a body on two springs. With `up` the display frame's third row and `up'` the model frame's, the
// forward spring measures how far the display frame's first row lies from `side × up'` and the side spring how far its
// second row lies from `up' × forward`; the model frame is then rebuilt from the first row plus the forward spring along
// `up` and the second row plus the side spring along `up` (0x00410a00), at the display frame's position. The driver
// sits at the seat point carried by that frame.
export const getVehicleLean = (request: VehicleLeanRequest): VehicleLean => {
  const { arithmetic, displayFrame, bodyRotation, stepMilliseconds, mass } = request
  const stepFloat = arithmetic.storeFloat(stepMilliseconds)
  const forward = getRow(displayFrame.rotation, 0)
  const side = getRow(displayFrame.rotation, 1)
  const up = getRow(displayFrame.rotation, 2)
  const bodyUp = getRow(bodyRotation, 2)
  const forwardPull = getStoredCross(arithmetic, side, bodyUp)
  // The first distance goes through memory (FSTP, FLD [ESP+0x10]); the second stays on the FPU stack.
  const forwardDistance = arithmetic.storeFloat(getDistance(arithmetic, forward, forwardPull))
  const forwardSpring = getSpring(arithmetic, {
    distance: getIsAgainstUp(arithmetic, forwardPull, up) ? -forwardDistance : forwardDistance,
    stepFloat,
    mass,
    stiffness: FORWARD_STIFFNESS,
    damping: FORWARD_DAMPING,
    previous: request.forwardLean,
  })
  const sidePull = getStoredCross(arithmetic, bodyUp, forward)
  const sideDistance = getDistance(arithmetic, side, sidePull)
  const sideSpring = getSpring(arithmetic, {
    distance: getIsAgainstUp(arithmetic, sidePull, up) ? -sideDistance : sideDistance,
    stepFloat,
    mass,
    stiffness: SIDE_STIFFNESS,
    damping: SIDE_DAMPING,
    previous: request.sideLean,
  })
  const leanedForward =
    forwardSpring === 0 ? forward : getLeanedAxis(arithmetic, forwardPull, forwardSpring, up)
  const leanedSide = sideSpring === 0 ? side : getLeanedAxis(arithmetic, sidePull, sideSpring, up)
  const nextRotation = getRotationFromFirstAndSecondAxes(arithmetic, leanedForward, leanedSide)
  const modelFrame: Frame = Object.freeze({
    rotation: nextRotation,
    position: displayFrame.position,
  })
  return Object.freeze({
    bodyRotation: nextRotation,
    forwardLean: forwardSpring,
    sideLean: sideSpring,
    driverPosition: getFrameTransformedPoint(arithmetic, modelFrame, request.seatPoint),
  })
}
