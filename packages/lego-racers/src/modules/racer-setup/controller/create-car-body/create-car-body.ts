import {
  createCarRigidBody,
  setHullPoint,
  setLocalCentreOfMass,
  setWheelGeometry,
} from '../../../racer-physics/index.ts'
import { getFloatFromBits, getTruncatedInteger } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import {
  getRatingScale,
  getSteeringScale,
  MAXIMUM_RATING,
  setTopSpeedRating,
} from '../../types/car-scales/car-scales.ts'
import type { CarBodyOptions, CarBodySetup, CarDescription } from '../../types/racer-setup.types.ts'

// 0x004371c0 passes 8, 5 and 6.2 to the attach (0x41000000, 0x40a00000, 0x40c66666).
const BOX_DIMENSIONS: Vector3 = Object.freeze({
  x: getFloatFromBits(0x41000000),
  y: getFloatFromBits(0x40a00000),
  z: getFloatFromBits(0x40c66666),
})
// float32 0.5 at 0x004af58c halves the hull extents; 3.5 at 0x004b09a8 is every hull point's height.
const HULL_HALF = getFloatFromBits(0x3f000000)
const HULL_HEIGHT = getFloatFromBits(0x40600000)
// float32 0.05 at 0x004b0544: a built car's weight becomes this many rating points.
const WEIGHT_RATING_SCALE = getFloatFromBits(0x3d4ccccd)
// Car rigid body +0x6c0 bit set when racer flag 0x4000000 is (race mode flag 0x1).
export const CAR_RIGID_BODY_RACE_MODE_FLAG = 0x100000

// A built car's weight raises the steering and top speed ratings and lowers the throttle rating by
// ftol(weight · 0.05) points (0x00437283..0x004372c6), capped at 100 and floored at 0.
const getRatingBonus = (arithmetic: FloatArithmetic, weight: number): number =>
  getTruncatedInteger(arithmetic.multiply(weight, WEIGHT_RATING_SCALE)) >>> 0

const getRaisedRating = (rating: number, bonus: number): number =>
  Math.min(rating + bonus, MAXIMUM_RATING)

const getLoweredRating = (rating: number, bonus: number): number =>
  bonus > rating ? 0 : rating - bonus

// RacerAttachCarBody 0x004371c0 for a description: the attach with the box, the three scales, the centre of mass,
// the wheel geometry from the chassis's wheel points and the four hull points from the hull extents.
export const createCarBodySetup = (
  arithmetic: FloatArithmetic,
  car: CarDescription,
  options: CarBodyOptions
): CarBodySetup => {
  const { multiply, subtract, storeFloat } = arithmetic
  const [, wheelAnchor, thirdPoint, fourthPoint] = car.wheelPoints
  if (wheelAnchor === undefined || thirdPoint === undefined || fourthPoint === undefined) {
    throw new RangeError('A car has four wheel points')
  }
  const trackWidth = storeFloat(subtract(fourthPoint.y, thirdPoint.y))
  const wheelbase = storeFloat(subtract(wheelAnchor.x, fourthPoint.x))
  const bonus = getRatingBonus(arithmetic, car.weight)
  const body = createCarRigidBody(arithmetic, {
    displayFrame: options.displayFrame,
    displayBoundingRadius: options.displayBoundingRadius,
    mass: car.mass,
    dimensions: BOX_DIMENSIONS,
  })
  const flagged = Object.freeze({
    ...body,
    flags: options.isRaceModeFlagged ? body.flags | CAR_RIGID_BODY_RACE_MODE_FLAG : body.flags,
  })
  const topSpeed = setTopSpeedRating(arithmetic, flagged, getRaisedRating(car.topSpeedRating, bonus))
  const withCentre = setLocalCentreOfMass(arithmetic, topSpeed.rigidBody, car.centreOfMass)
  const withWheels = setWheelGeometry(arithmetic, withCentre, wheelAnchor, trackWidth, wheelbase)
  const halfExtentY = storeFloat(multiply(car.hullExtents[0], HULL_HALF))
  const halfExtentX = storeFloat(multiply(car.hullExtents[1], HULL_HALF))
  const hullPoints: readonly Vector3[] = [
    { x: halfExtentX, y: -halfExtentY, z: HULL_HEIGHT },
    { x: halfExtentX, y: halfExtentY, z: HULL_HEIGHT },
    { x: -halfExtentX, y: -halfExtentY, z: HULL_HEIGHT },
    { x: -halfExtentX, y: halfExtentY, z: HULL_HEIGHT },
  ]
  return Object.freeze({
    rigidBody: hullPoints.reduce(
      (current, point, index) => setHullPoint(arithmetic, current, index, Object.freeze(point)),
      withWheels
    ),
    steeringScale: getSteeringScale(arithmetic, getRaisedRating(car.steeringRating, bonus)),
    throttleScale: getRatingScale(arithmetic, getLoweredRating(car.throttleRating, bonus)),
    topSpeedScale: topSpeed.scale,
  })
}
