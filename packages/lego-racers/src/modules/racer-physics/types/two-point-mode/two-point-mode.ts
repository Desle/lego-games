import { getSegmentQueryResult, getCollisionMaterialName } from '../../../collision/index.ts'
import type { CollisionObject } from '../../../collision/index.ts'
import {
  FLOAT32_MAXIMUM,
  getDotProduct,
  getFloatFromBits,
  getFrameInverseTransformedPoint,
  getFrameRotatedVector,
  getFrameTransformedPoint,
  getNormalizedVector3,
  getRotationFromFrameAxes,
  getStoredDifference,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { getIsFlagSet, getRotationRow, setPitchRate } from '../car-forces/car-forces.ts'
import { CarRigidBodyFlag, getWithWheelAnchors } from '../car-rigid-body/car-rigid-body.ts'
import {
  findCachedTriangle,
  getAwakeBody,
  getDeeper,
  getUnstoredSquaredDistance,
  insertTriangle,
  replaceWheel,
} from '../ground-probe/ground-probe.ts'
import type {
  CarRigidBody,
  GroundProbeProgress,
  SegmentQuery,
  TwoPointLanding,
} from '../racer-physics.types.ts'

// Constants by address.
const HALF = getFloatFromBits(0x3f000000) // 0x004af58c
const ONE = getFloatFromBits(0x3f800000) // 0x004af388
const TURN_RADIUS_FOR_FULL_TILT = getFloatFromBits(0x45800000) // 0x004b0cd4, 4096
const FULL_TILT = getFloatFromBits(0x3f490fdb) // 0x004b0d3c, π/4
const PROBE_DEPTH_PER_MILLISECOND = getFloatFromBits(0x3c23d70a) // 0x004b0d00, 0.01
const AIRBORNE_SINK = getFloatFromBits(0x3c03126f) // 0x004b0d04, 0.008
const GROUND_DEPTH_TOLERANCE = getFloatFromBits(0x3ecccccd) // 0x004b0cf4, 0.4
const HARD_LANDING_SPEED = getFloatFromBits(0x3d4ccccd) // 0x004b0d2c, 0.05
const LANDING_BOUNCE = getFloatFromBits(0x3fa66666) // 0x004b0d30, 1.3
const POINT_COUNT = 2
const TWO_POINT_PITCH_RATE = getFloatFromBits(0xbb449ba6) // -0.003, pushed by 0x00448660 and 0x00429b40
const TWO_POINT_PITCH_MILLISECONDS = 150 // 0x96
const THOUSANDTH = getFloatFromBits(0x3a83126f) // 0x004af220
const TILT_RATE = getFloatFromBits(0x3ba3d70a) // 0x004b0d28, 0.005 per millisecond

// 0x004464a0 (thiscall: step): the two-point height and tilt move toward their targets, by rate · step · 0.001 and
// by step · 0.005, and stop there.
export const getBodyWithTwoPointOffsets = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  stepMilliseconds: number
): CarRigidBody => {
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const heightChange = multiply(multiply(body.twoPointHeightRate, stepMilliseconds), THOUSANDTH)
  let height = body.twoPointHeight
  if (getIsBelow(height, body.twoPointTargetHeight)) {
    height = storeFloat(add(heightChange, height))
    if (!getIsBelowOrEqual(height, body.twoPointTargetHeight)) height = body.twoPointTargetHeight
  } else if (!getIsBelowOrEqual(height, body.twoPointTargetHeight)) {
    height = storeFloat(subtract(height, heightChange))
    if (getIsBelow(height, body.twoPointTargetHeight)) height = body.twoPointTargetHeight
  }
  const tiltChange = multiply(stepMilliseconds, TILT_RATE)
  let tilt = body.twoPointTilt
  if (getIsBelow(tilt, body.twoPointTargetTilt)) {
    tilt = storeFloat(add(tiltChange, tilt))
    if (!getIsBelowOrEqual(tilt, body.twoPointTargetTilt)) tilt = body.twoPointTargetTilt
  } else if (!getIsBelowOrEqual(tilt, body.twoPointTargetTilt)) {
    tilt = storeFloat(subtract(tilt, tiltChange))
    if (getIsBelow(tilt, body.twoPointTargetTilt)) tilt = body.twoPointTargetTilt
  }
  return Object.freeze({ ...body, twoPointHeight: height, twoPointTilt: tilt })
}

// 0x00448840 (fastcall): the tilt the two-point body leans to is a quarter turn halved, less the share of 4096 that
// the turn radius is, toward the side the car turns to; a straight car has none.
export const getBodyWithTwoPointTargetTilt = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody
): CarRigidBody => {
  const { divide, subtract, multiply, storeFloat, getIsBelow } = arithmetic
  const radius = body.turnRadius
  const getShortfall = (share: number): number =>
    multiply(subtract(ONE, getIsBelow(ONE, share) ? ONE : share), FULL_TILT)
  if (getIsBelow(0, radius)) {
    return Object.freeze({
      ...body,
      twoPointTargetTilt: storeFloat(-getShortfall(divide(radius, TURN_RADIUS_FOR_FULL_TILT))),
    })
  }
  if (getIsBelow(radius, 0)) {
    return Object.freeze({
      ...body,
      twoPointTargetTilt: storeFloat(getShortfall(-divide(radius, TURN_RADIUS_FOR_FULL_TILT))),
    })
  }
  return Object.freeze({ ...body, twoPointTargetTilt: 0 })
}

// 0x00448660 (fastcall; car body slot 12 for a free body): the body goes into two-point mode. It starts a nose-down
// pitch of -0.003 per millisecond for 150 ms, the two-point height and tilts return to 0, and the points are set.
export const getBodyInTwoPointMode = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody
): CarRigidBody => {
  const pitched = setPitchRate(
    arithmetic,
    Object.freeze({ ...body, flags: body.flags | CarRigidBodyFlag.TWO_POINT }),
    TWO_POINT_PITCH_RATE,
    TWO_POINT_PITCH_MILLISECONDS
  )
  return getBodyWithTwoPointPositions(
    arithmetic,
    getWithWheelAnchors(
      arithmetic,
      Object.freeze({
        ...pitched,
        twoPointHeight: 0,
        twoPointTilt: 0,
        twoPointTargetTilt: 0,
      })
    )
  )
}

// 0x00448730 (fastcall; car body slot 13 for a free body): leaves two-point mode.
export const getBodyOutOfTwoPointMode = (body: CarRigidBody): CarRigidBody =>
  Object.freeze({
    ...body,
    flags: body.flags & ~CarRigidBodyFlag.TWO_POINT,
    twoPointHeight: 0,
    twoPointTilt: 0,
    twoPointTargetTilt: 0,
  })

// The midpoints of the wheel pairs (0x00448660, 0x004465c0): wheels 0 and 1, then wheels 2 and 3.
export const getBodyWithTwoPointPositions = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody
): CarRigidBody => {
  const { add, multiply, storeFloat } = arithmetic
  const getMidpoint = (first: Vector3, second: Vector3): Vector3 =>
    Object.freeze({
      x: storeFloat(multiply(add(first.x, second.x), HALF)),
      y: storeFloat(multiply(add(first.y, second.y), HALF)),
      z: storeFloat(multiply(add(first.z, second.z), HALF)),
    })
  const anchors = body.wheels.map((wheel) => wheel.anchor)
  return Object.freeze({
    ...body,
    twoPointPositions: Object.freeze([
      getMidpoint(anchors[0] ?? ZERO_VECTOR3, anchors[1] ?? ZERO_VECTOR3),
      getMidpoint(anchors[2] ?? ZERO_VECTOR3, anchors[3] ?? ZERO_VECTOR3),
    ]),
  })
}

const getPoint = (body: CarRigidBody, index: number): Vector3 =>
  body.twoPointPositions[index] ?? ZERO_VECTOR3

// The probes of 0x004465c0 (0x004466b7..0x004467ea): from the bounding radius and the drop above each point to the
// probe depth and the two-point height below it. Flags, loads and depths are cleared like 0x00445dc0 does.
const getBodyWithTwoPointProbes = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  stepMilliseconds: number
): CarRigidBody => {
  const { add, subtract, multiply, storeFloat, getIsBelow } = arithmetic
  const drop = -subtract(body.frame.position.z, body.stepStart.position.z)
  const storedDrop = getIsBelow(drop, 0) ? 0 : storeFloat(drop)
  const height = add(body.displayBoundingRadius, storedDrop)
  const depth =
    body.groundedWheelCount === 0 ? 0 : multiply(PROBE_DEPTH_PER_MILLISECOND, stepMilliseconds)
  const reach = add(depth, body.twoPointHeight)
  return Object.freeze({
    ...body,
    groundedWheelCount: 0,
    wheels: Object.freeze(
      body.wheels.map((wheel, index) => {
        if (index >= POINT_COUNT) return wheel
        const point = getPoint(body, index)
        return Object.freeze({
          ...wheel,
          probeStart: Object.freeze({
            x: point.x,
            y: point.y,
            z: storeFloat(add(height, point.z)),
          }),
          probeEnd: Object.freeze({
            x: point.x,
            y: point.y,
            z: storeFloat(subtract(point.z, reach)),
          }),
          isOnGround: false,
          isProbed: false,
          groundForce: ZERO_VECTOR3,
          depthSquared: -FLOAT32_MAXIMUM,
        })
      })
    ),
  })
}

// 0x004466b7's objects loop: the probes of the points that found nothing yet against each moving object, in its frame.
const probeObjects = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  objects: readonly CollisionObject[],
  query: SegmentQuery
): GroundProbeProgress =>
  objects.reduce<GroundProbeProgress>(
    (progress, object) =>
      progress.body.wheels
        .slice(0, POINT_COUNT)
        .reduce<GroundProbeProgress>((current, wheel, pointIndex) => {
          if (wheel.isProbed) return current
          const start = getFrameInverseTransformedPoint(arithmetic, object.frame, wheel.probeStart)
          const end = getFrameInverseTransformedPoint(arithmetic, object.frame, wheel.probeEnd)
          const { intersection } = query(arithmetic, object.volume, start, end)
          if (intersection === undefined) return current
          const material = getCollisionMaterialName(object, intersection.materialIndex)
          const depthSquared = getUnstoredSquaredDistance(arithmetic, end, intersection.point)
          const touched = replaceWheel(current.body, pointIndex, {
            isProbed: true,
            contactPoint: getFrameTransformedPoint(arithmetic, object.frame, intersection.point),
            groundForce: getFrameRotatedVector(
              arithmetic,
              object.frame,
              intersection.triangle.normal
            ),
            depthSquared: arithmetic.storeFloat(depthSquared),
          })
          return {
            body: replaceWheel(
              replaceWheel(touched, pointIndex * 2, { material }),
              pointIndex * 2 + 1,
              {
                material,
              }
            ),
            deepest: getDeeper(arithmetic, current.deepest, pointIndex, depthSquared),
          }
        }, progress),
    { body, deepest: undefined }
  )

// 0x004469b8's track loop: the cached triangles first, then the track's volume; a hit joins the cache.
const probeTrack = (
  arithmetic: FloatArithmetic,
  progress: GroundProbeProgress,
  track: CollisionObject | undefined,
  query: SegmentQuery
): GroundProbeProgress =>
  progress.body.wheels
    .slice(0, POINT_COUNT)
    .reduce<GroundProbeProgress>((current, wheel, pointIndex) => {
      if (wheel.isProbed) return current
      const cached = findCachedTriangle(arithmetic, current.body, pointIndex)
      let body = cached.body
      if (!cached.isFound) {
        if (track === undefined) return { ...current, body }
        const searched = body.wheels[pointIndex] ?? wheel
        const result = query(arithmetic, track.volume, searched.probeStart, searched.probeEnd)
        if (result.lastCrossingPoint !== undefined) {
          body = replaceWheel(body, pointIndex, { contactPoint: result.lastCrossingPoint })
        }
        if (result.intersection === undefined) return { ...current, body }
        const material = getCollisionMaterialName(track, result.intersection.materialIndex)
        const insertion = insertTriangle(body.triangleCache, result.intersection.triangle, material)
        body = replaceWheel(
          replaceWheel(
            replaceWheel(
              Object.freeze({ ...body, triangleCache: insertion.triangleCache }),
              pointIndex,
              {
                cachedTriangleIndex: insertion.index,
              }
            ),
            pointIndex * 2,
            { material }
          ),
          pointIndex * 2 + 1,
          { material }
        )
      }
      const hit = body.wheels[pointIndex] ?? wheel
      const entry = body.triangleCache[hit.cachedTriangleIndex]
      const depthSquared = getUnstoredSquaredDistance(arithmetic, hit.probeEnd, hit.contactPoint)
      return {
        body: replaceWheel(body, pointIndex, {
          groundForce: entry?.triangle.normal ?? ZERO_VECTOR3,
          depthSquared: arithmetic.storeFloat(depthSquared),
          isProbed: true,
        }),
        deepest: getDeeper(arithmetic, current.deepest, pointIndex, depthSquared),
      }
    }, progress)

// 0x00446b13..0x00446c52: the points within 0.4 of the deepest hit are on the ground; their normals add up. With both
// down, the frame's first axis follows the line between the contact points and the normal is its new up.
const getBodyWithGroundNormal = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  deepestDepthSquared: number
): CarRigidBody => {
  const { subtract, multiply, getSquareRoot, storeFloat, getIsBelow } = arithmetic
  const reach = subtract(getSquareRoot(deepestDepthSquared), GROUND_DEPTH_TOLERANCE)
  const clampedReach = getIsBelow(reach, 0) ? 0 : reach
  const threshold = storeFloat(multiply(clampedReach, clampedReach))
  let sum: Vector3 = ZERO_VECTOR3
  let count = 0
  const wheels = body.wheels.map((wheel, index) => {
    if (index >= POINT_COUNT) return wheel
    if (getIsBelow(wheel.depthSquared, threshold)) {
      return Object.freeze({ ...wheel, groundForce: ZERO_VECTOR3, isOnGround: false })
    }
    sum = Object.freeze({
      x: storeFloat(arithmetic.add(sum.x, wheel.groundForce.x)),
      y: storeFloat(arithmetic.add(sum.y, wheel.groundForce.y)),
      z: storeFloat(arithmetic.add(sum.z, wheel.groundForce.z)),
    })
    count += 1
    return Object.freeze({ ...wheel, isOnGround: true })
  })
  const counted: CarRigidBody = Object.freeze({
    ...body,
    wheels: Object.freeze(wheels),
    groundedWheelCount: count,
    groundNormal: sum,
  })
  if (count < POINT_COUNT) {
    return Object.freeze({
      ...counted,
      groundNormal: getNormalizedVector3(arithmetic, counted.groundNormal),
    })
  }
  const first = getStoredDifference(
    arithmetic,
    counted.wheels[0]?.contactPoint ?? ZERO_VECTOR3,
    counted.wheels[1]?.contactPoint ?? ZERO_VECTOR3
  )
  const rotation = getRotationFromFrameAxes(arithmetic, {
    first,
    third: getRotationRow(counted, 2),
  })
  const turned: CarRigidBody = Object.freeze({
    ...counted,
    frame: Object.freeze({ ...counted.frame, rotation }),
  })
  return Object.freeze({ ...turned, groundNormal: getRotationRow(turned, 2) })
}

// 0x00446c52..0x00446d34: the frame and both points move by the deepest contact's offset from its point, plus the
// two-point height in z.
const getBodyAtDeepestContact = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  deepestIndex: number
): CarRigidBody => {
  const { add, subtract, storeFloat } = arithmetic
  const contact = body.wheels[deepestIndex]?.contactPoint ?? ZERO_VECTOR3
  const point = getPoint(body, deepestIndex)
  const offset: Vector3 = Object.freeze({
    x: storeFloat(subtract(contact.x, point.x)),
    y: storeFloat(subtract(contact.y, point.y)),
    z: storeFloat(add(subtract(contact.z, point.z), body.twoPointHeight)),
  })
  const getMoved = (value: Vector3): Vector3 =>
    Object.freeze({
      x: storeFloat(add(offset.x, value.x)),
      y: storeFloat(add(offset.y, value.y)),
      z: storeFloat(add(offset.z, value.z)),
    })
  const { position } = body.frame
  return Object.freeze({
    ...body,
    frame: Object.freeze({
      ...body.frame,
      position: Object.freeze({
        x: storeFloat(add(position.x, offset.x)),
        y: storeFloat(add(position.y, offset.y)),
        z: storeFloat(add(position.z, offset.z)),
      }),
    }),
    twoPointPositions: Object.freeze(body.twoPointPositions.map(getMoved)),
  })
}

// 0x00446d34..0x00446dbc: landing after a pass that began with no point on the ground. The velocity into the ground is
// removed; above 0.05 per millisecond the car bounces 1.3 times, no point stays on the ground and the pass ends there.
const getLanding = (arithmetic: FloatArithmetic, body: CarRigidBody): TwoPointLanding => {
  const { subtract, multiply, storeFloat, getIsBelow } = arithmetic
  const { linearVelocity: velocity, groundNormal } = body
  const into = getDotProduct(arithmetic, velocity, groundNormal)
  if (!getIsBelow(into, 0)) return { body, isBounced: false }
  const isBounced = getIsBelow(into, -HARD_LANDING_SPEED)
  const removed = isBounced ? multiply(LANDING_BOUNCE, into) : into
  const landed = Object.freeze({
    ...body,
    linearVelocity: Object.freeze({ ...velocity, z: storeFloat(subtract(velocity.z, removed)) }),
  })
  if (!isBounced) return { body: landed, isBounced }
  return {
    body: Object.freeze({
      ...landed,
      groundedWheelCount: 0,
      wheels: Object.freeze(
        landed.wheels.map((wheel, index) =>
          index < POINT_COUNT ? Object.freeze({ ...wheel, isOnGround: false }) : wheel
        )
      ),
    }),
    isBounced,
  }
}

// 0x00446dbc..0x00446e53: gravity along the ground, and half the weight pushing down at each point on the ground.
const getBodyWithGroundLoads = (arithmetic: FloatArithmetic, body: CarRigidBody): CarRigidBody => {
  const { multiply, subtract, storeFloat } = arithmetic
  const { groundNormal, weight } = body
  const normalWeight = multiply(weight, groundNormal.z)
  const load = Object.freeze({ x: 0, y: 0, z: storeFloat(-multiply(weight, HALF)) })
  const loaded = Object.freeze({
    ...body,
    slopeForce: Object.freeze({
      x: storeFloat(-multiply(groundNormal.x, normalWeight)),
      y: storeFloat(-multiply(groundNormal.y, normalWeight)),
      z: storeFloat(subtract(weight, multiply(groundNormal.z, normalWeight))),
    }),
  })
  return Object.freeze({
    ...loaded,
    wheels: Object.freeze(
      loaded.wheels.map((wheel, index) =>
        index < POINT_COUNT && wheel.isOnGround
          ? Object.freeze({ ...wheel, groundForce: load })
          : wheel
      )
    ),
  })
}

// 0x004465c0 (thiscall: step), the two-point mode's ground probe in place of 0x00445dc0: the midpoints of the front
// and rear wheel pairs are probed instead of the four wheels. The frame then moves to the deepest contact; after a
// stretch in the air a landing removes the velocity into the ground.
export const probeTwoPoints = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  stepMilliseconds: number,
  collisionObjects: readonly CollisionObject[],
  query: SegmentQuery = getSegmentQueryResult
): CarRigidBody => {
  const { subtract, storeFloat } = arithmetic
  const awake = getAwakeBody(arithmetic, body)
  if (awake === undefined) return body
  const previousCount = awake.groundedWheelCount
  const positioned = getBodyWithTwoPointPositions(
    arithmetic,
    getWithWheelAnchors(arithmetic, awake)
  )
  const cleared = getBodyWithTwoPointProbes(arithmetic, positioned, stepMilliseconds)
  const afterObjects = probeObjects(arithmetic, cleared, collisionObjects.slice(1), query)
  const probed = probeTrack(arithmetic, afterObjects, collisionObjects[0], query)
  if (probed.deepest === undefined) {
    if (previousCount === 0) return probed.body
    const { linearVelocity } = probed.body
    return Object.freeze({
      ...probed.body,
      linearVelocity: Object.freeze({
        ...linearVelocity,
        z: storeFloat(subtract(linearVelocity.z, AIRBORNE_SINK)),
      }),
    })
  }
  const grounded = getBodyWithGroundNormal(arithmetic, probed.body, probed.deepest.depthSquared)
  const moved = getBodyAtDeepestContact(arithmetic, grounded, probed.deepest.wheelIndex)
  if (previousCount !== 0) return getBodyWithGroundLoads(arithmetic, moved)
  const landing = getLanding(arithmetic, moved)
  return landing.isBounced ? landing.body : getBodyWithGroundLoads(arithmetic, landing.body)
}

export const getIsTwoPointBody = (body: CarRigidBody): boolean =>
  getIsFlagSet(body, CarRigidBodyFlag.TWO_POINT)
