import { createCarRigidBody, setHullPoint, setWheelGeometry } from '../../../racer-physics/index.ts'
import type { RigidBodyFrame } from '../../../racer-physics/index.ts'
import type { CarBodyDefinition } from '../../../racer/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'

// 0x004371c0 attaches a box of 8 × 5 × 6.2 (0x41000000, 0x40a00000, 0x40c66666). The wheel anchor, track width,
// wheelbase, hull and mass come from chassis data that no module parses yet, so these are the numbers the
// rigid body specs use: a stand-in that lets a car fall onto the road and settle, not the game's values.
const BOX_DIMENSIONS: Vector3 = Object.freeze({ x: 8, y: 5, z: 6.2 })
const WHEEL_ANCHOR: Vector3 = Object.freeze({ x: 3, y: 2, z: -1 })
const TRACK_WIDTH = 4
const WHEELBASE = 6
const MASS = 1
const BOUNDING_RADIUS = 5
const HULL_CORNERS: readonly Vector3[] = Object.freeze([
  Object.freeze({ x: 3, y: -2, z: 0 }),
  Object.freeze({ x: 3, y: 2, z: 0 }),
  Object.freeze({ x: -3, y: -2, z: 0 }),
  Object.freeze({ x: -3, y: 2, z: 0 }),
])
const STEERING_SCALE = 1
const THROTTLE_SCALE = 1

export const getPlaceholderCarBodyDefinition = (
  arithmetic: FloatArithmetic,
  displayFrame: RigidBodyFrame
): CarBodyDefinition => {
  const body = setWheelGeometry(
    arithmetic,
    createCarRigidBody(arithmetic, {
      displayFrame,
      displayBoundingRadius: BOUNDING_RADIUS,
      mass: MASS,
      dimensions: BOX_DIMENSIONS,
    }),
    WHEEL_ANCHOR,
    TRACK_WIDTH,
    WHEELBASE
  )
  return Object.freeze({
    rigidBody: HULL_CORNERS.reduce(
      (car, corner, index) => setHullPoint(arithmetic, car, index, corner),
      body
    ),
    steeringScale: STEERING_SCALE,
    throttleScale: THROTTLE_SCALE,
  })
}
