import { getCollisionMaterialName, getSegmentQueryResult } from '../../../collision/index.ts'
import type { CollisionObject } from '../../../collision/index.ts'
import {
  FLOAT32_MAXIMUM,
  getDotProduct,
  getFloatFromBits,
  getFrameInverseTransformedPoint,
  getFrameRotatedVector,
  getFrameTransformedPoint,
  getSquaredLength,
  getStoredScaledVector,
  getTruncatedInteger,
  getUnstoredDifference,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import {
  endDrift,
  getIsFlagSet,
  getRotationRow,
  setYawRate,
  YAW_RATE_DURATION,
} from '../car-forces/car-forces.ts'
import {
  CarRigidBodyFlag,
  getRestoredStepStart,
  getWithWorldCentreOfMass,
} from '../car-rigid-body/car-rigid-body.ts'
import { getWithVelocitySplit } from '../heading/heading.ts'
import type {
  CarRigidBody,
  CarRigidBodyHooks,
  ContactAdvance,
  HullContactSearch,
} from '../racer-physics.types.ts'

const WALL_TURN_RATE = getFloatFromBits(0x3b83126f) // 0x004b0d14, 0.004
const WALL_BOUNCE = getFloatFromBits(0x3e99999a) // 0x004b0d08, 0.3
const WALL_BOUNCE_VERTICAL = getFloatFromBits(0x3e19999a) // 0x004b0d0c, 0.15
const WALL_PUSH = getFloatFromBits(0x3b83126f) // 0x004b0404, 0.004
const MAXIMUM_RISE_SPEED = getFloatFromBits(0x3e99999a) // 0x004b0d84, 0.3
// 0x00447cb6: a contact closer than 5 ms is answered at once.
const CONTACT_MARGIN_MILLISECONDS = 5

// The track's squared distance (0x00447bf7): (y² + x²) + z², unlike the moving objects' (z² + y²) + x².
const getTrackSquaredDistance = (arithmetic: FloatArithmetic, difference: Vector3): number => {
  const { add, multiply } = arithmetic
  return add(
    add(multiply(difference.y, difference.y), multiply(difference.x, difference.x)),
    multiply(difference.z, difference.z)
  )
}

// One hull point against one collision object (0x0044794c..0x00447aca, 0x00447b39..0x00447c6c).
const testHullPoint = (
  arithmetic: FloatArithmetic,
  search: HullContactSearch,
  hooks: CarRigidBodyHooks,
  object: CollisionObject,
  objectIndex: number,
  pointIndex: number
): HullContactSearch => {
  const { body } = search
  if (body.hullContacts[pointIndex] === true) return search
  const isTrack = objectIndex === 0
  const startWorld = body.stepStart.worldHullPoints[pointIndex] ?? body.frame.position
  const endWorld = body.worldHullPoints[pointIndex] ?? body.frame.position
  const start = isTrack
    ? startWorld
    : getFrameInverseTransformedPoint(arithmetic, object.frame, startWorld)
  const end = isTrack
    ? endWorld
    : getFrameInverseTransformedPoint(arithmetic, object.frame, endWorld)
  const { intersection } = getSegmentQueryResult(arithmetic, object.volume, start, end)
  if (intersection === undefined) return search
  const normal = intersection.triangle.normal
  const penetration = getDotProduct(
    arithmetic,
    getUnstoredDifference(arithmetic, intersection.point, end),
    normal
  )
  const isInFront = isTrack
    ? !arithmetic.getIsBelow(penetration, 0)
    : !arithmetic.getIsBelowOrEqual(penetration, 0)
  if (!isInFront) return search
  const decision = hooks.decideHullContact(body, {
    point: intersection.point,
    material: getCollisionMaterialName(object, intersection.materialIndex),
    collisionObjectIndex: objectIndex,
    triangle: intersection.triangle,
  })
  if (!decision.isAccepted) return { ...search, body: decision.body }
  const away = getUnstoredDifference(arithmetic, end, intersection.point)
  const distanceSquared = isTrack
    ? getTrackSquaredDistance(arithmetic, away)
    : getSquaredLength(arithmetic, away)
  if (arithmetic.getIsBelowOrEqual(distanceSquared, search.closestSquared)) {
    return { ...search, body: decision.body }
  }
  const accepted = decision.body
  return {
    body: Object.freeze({
      ...accepted,
      contactNormal: isTrack ? normal : getFrameRotatedVector(arithmetic, object.frame, normal),
      hullContacts: Object.freeze(
        accepted.hullContacts.map((isTouching, index) => isTouching || index === pointIndex)
      ),
      contactCount: accepted.contactCount + 1,
    }),
    closestSquared: arithmetic.storeFloat(distanceSquared),
    fraction: intersection.fraction,
  }
}

const testObject = (
  arithmetic: FloatArithmetic,
  search: HullContactSearch,
  hooks: CarRigidBodyHooks,
  object: CollisionObject,
  objectIndex: number
): HullContactSearch =>
  [0, 1, 2, 3].reduce(
    (current, pointIndex) =>
      testHullPoint(arithmetic, current, hooks, object, objectIndex, pointIndex),
    search
  )

// RigidBody_AdvanceToContact, 0x004478b0 (thiscall: step, test the track): moves the four hull
// points to the new frame and runs each from where it was at the start of the pass, against the
// moving objects and (unless flag 0x1000) the track. The contact whose end point lies deepest
// behind its triangle wins. On a contact the body goes back to the start of the pass and the
// result is the time to the contact, truncated, minus 5 ms (0 when that is less than 5). A scripted car body
// (0x00429d40) passes false for the track.
export const advanceToContact = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  stepMilliseconds: number,
  collisionObjects: readonly CollisionObject[],
  hooks: CarRigidBodyHooks,
  isTrackTested: boolean = !getIsFlagSet(body, CarRigidBodyFlag.WITHOUT_TRACK_CONTACTS)
): ContactAdvance => {
  const moved: CarRigidBody = Object.freeze({
    ...body,
    contactCount: 0,
    worldHullPoints: Object.freeze(
      body.localHullPoints.map((point) => getFrameTransformedPoint(arithmetic, body.frame, point))
    ),
    hullContacts: Object.freeze(body.localHullPoints.map(() => false)),
  })
  const afterObjects = collisionObjects
    .slice(1)
    .reduce<HullContactSearch>(
      (search, object, index) => testObject(arithmetic, search, hooks, object, index + 1),
      { body: moved, closestSquared: -FLOAT32_MAXIMUM, fraction: 0 }
    )
  const track = collisionObjects[0]
  const searched =
    isTrackTested && track !== undefined
      ? testObject(arithmetic, afterObjects, hooks, track, 0)
      : afterObjects
  if (searched.body.contactCount === 0) return { body: searched.body, remainingMilliseconds: 0 }
  const untilContact = getTruncatedInteger(arithmetic.multiply(stepMilliseconds, searched.fraction))
  const restored = getWithVelocitySplit(
    arithmetic,
    getWithWorldCentreOfMass(arithmetic, getRestoredStepStart(searched.body))
  )
  return {
    body: restored,
    remainingMilliseconds:
      untilContact >>> 0 >= CONTACT_MARGIN_MILLISECONDS
        ? untilContact - CONTACT_MARGIN_MILLISECONDS
        : 0,
  }
}

// 0x00447cf0: the response to a hull contact. The velocity into the surface is removed, a wall
// met head-on (row 0 against the normal, flag 0x2 clear) turns the car away from it, the car
// bounces back 0.3 of the way (0.15 vertically), is pushed 0.004 off the surface and may not rise
// faster than 0.3 per millisecond.
export const respondToContact = (arithmetic: FloatArithmetic, body: CarRigidBody): CarRigidBody => {
  const { add, subtract, multiply, storeFloat, getIsBelow } = arithmetic
  const start = getIsFlagSet(body, CarRigidBodyFlag.DRIFTING) ? endDrift(body) : body
  const normal = start.contactNormal
  const unroundedInto = getDotProduct(arithmetic, start.linearVelocity, normal)
  const into = storeFloat(unroundedInto)
  const velocity = start.linearVelocity
  const slid = getIsBelow(unroundedInto, 0)
    ? Object.freeze({
        x: storeFloat(subtract(velocity.x, multiply(into, normal.x))),
        y: storeFloat(subtract(velocity.y, storeFloat(multiply(normal.y, into)))),
        z: storeFloat(subtract(velocity.z, storeFloat(multiply(normal.z, into)))),
      })
    : velocity
  const isHeadOn =
    !getIsFlagSet(start, CarRigidBodyFlag.SPINNING) &&
    getIsBelow(getDotProduct(arithmetic, getRotationRow(start, 0), normal), 0)
  const turned = isHeadOn ? getWallTurn(arithmetic, start, normal) : start
  const bounce = multiply(WALL_BOUNCE, into)
  const bounced = getIsBelow(into, 0)
    ? Object.freeze({
        x: storeFloat(subtract(slid.x, multiply(normal.x, bounce))),
        y: storeFloat(subtract(slid.y, multiply(normal.y, bounce))),
        z: storeFloat(subtract(slid.z, multiply(multiply(WALL_BOUNCE_VERTICAL, into), normal.z))),
      })
    : slid
  const push = getStoredScaledVector(arithmetic, normal, WALL_PUSH)
  const risen = storeFloat(add(push.z, bounced.z))
  return Object.freeze({
    ...turned,
    linearVelocity: Object.freeze({
      x: storeFloat(add(multiply(normal.x, WALL_PUSH), bounced.x)),
      y: storeFloat(add(push.y, bounced.y)),
      z: getIsBelow(risen, MAXIMUM_RISE_SPEED) ? risen : MAXIMUM_RISE_SPEED,
    }),
  })
}

// 0x00447dcb..0x00447e64: the turn away from a wall, faster the more squarely row 1 faces it.
const getWallTurn = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  normal: Vector3
): CarRigidBody => {
  const { add, subtract, multiply, storeFloat, getIsBelow } = arithmetic
  const side = getDotProduct(arithmetic, getRotationRow(body, 1), normal)
  const rate = getIsBelow(side, 0)
    ? storeFloat(multiply(add(multiply(add(side, 1), 0.5), 0.5), -WALL_TURN_RATE))
    : storeFloat(multiply(add(multiply(subtract(1, side), 0.5), 0.5), WALL_TURN_RATE))
  const turned = setYawRate(arithmetic, body, rate, YAW_RATE_DURATION)
  return Object.freeze({ ...turned, flags: turned.flags | CarRigidBodyFlag.WALL_TURN })
}
