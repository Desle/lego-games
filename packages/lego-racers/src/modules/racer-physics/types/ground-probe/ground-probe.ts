import {
  getCollisionMaterialName,
  getSegmentQueryResult,
  getTriangleSegmentResult,
} from '../../../collision/index.ts'
import type { CollisionObject, CollisionTriangle } from '../../../collision/index.ts'
import {
  FLOAT32_MAXIMUM,
  getDotProduct,
  getFloatFromBits,
  getFrameInverseRotatedVector,
  getFrameInverseTransformedPoint,
  getFrameRotatedVector,
  getFrameTransformedPoint,
  getNormalizedVector3,
  getRotationFromFirstAndSecondAxes,
  getRotationFromThirdAndFirstAxes,
  getSineCosine,
  getSquaredLength,
  getStoredDifference,
  getStoredScaledVector,
  getStoredSum,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { getRotationRow, getIsFlagSet } from '../car-forces/car-forces.ts'
import {
  CarRigidBodyFlag,
  getWithWheelAnchors,
  TRIANGLE_CACHE_CAPACITY,
} from '../car-rigid-body/car-rigid-body.ts'
import type {
  CachedTriangleSearch,
  CarRigidBody,
  CarWheel,
  DeepestWheel,
  GroundProbeProgress,
  TriangleCacheEntry,
  TriangleCacheInsertion,
} from '../racer-physics.types.ts'

// Constants by address.
const MAXIMUM_TILT_COSINE = getFloatFromBits(0x3f3504f3) // 0x004b0cec
const MAXIMUM_TILT_ANGLE = getFloatFromBits(0x3f490fdb) // 0x004b0ce8, π/4
const PROBE_DEPTH_PER_MILLISECOND = getFloatFromBits(0x3d23d70a) // 0x004b0cfc, 0.04
const AIRBORNE_SINK = getFloatFromBits(0x3c03126f) // 0x004b0d04, 0.008
const GROUND_DEPTH_TOLERANCE = getFloatFromBits(0x3ecccccd) // 0x004b0cf4, 0.4
const HARD_LANDING_SPEED = getFloatFromBits(0x3d4ccccd) // 0x004b0d2c, 0.05
const LANDING_BOUNCE = getFloatFromBits(0x3f933333) // 0x004b0d34, 1.15
// 0x00446356: a landing counts only after more than 400 ms in the air.
const LANDING_AIR_TIME = 400
// 0x00448430: the wheels paired with each wheel along row 0 (0x004b0d50) and row 1 (0x004b0d60).
const LENGTHWISE_WHEELS = Object.freeze([2, 3, 0, 1])
const CROSSWISE_WHEELS = Object.freeze([1, 0, 3, 2])

export const replaceWheel = (
  body: CarRigidBody,
  index: number,
  change: Partial<CarWheel>
): CarRigidBody =>
  Object.freeze({
    ...body,
    wheels: Object.freeze(
      body.wheels.map((wheel, wheelIndex) =>
        wheelIndex === index ? Object.freeze({ ...wheel, ...change }) : wheel
      )
    ),
  })

export const replaceAllWheels = (
  body: CarRigidBody,
  getChange: (wheel: CarWheel) => Partial<CarWheel>
): CarRigidBody =>
  Object.freeze({
    ...body,
    wheels: Object.freeze(
      body.wheels.map((wheel) => Object.freeze({ ...wheel, ...getChange(wheel) }))
    ),
  })

// 0x00445d10: when rotation row 2 leans more than 45° from the vertical, it is set back to 45°
// in the same direction and row 0 is made orthogonal to it (0x00410b00).
export const getWithTiltLimit = (arithmetic: FloatArithmetic, body: CarRigidBody): CarRigidBody => {
  const { multiply, storeFloat, getIsBelow } = arithmetic
  const up = getRotationRow(body, 2)
  if (!getIsBelow(up.z, MAXIMUM_TILT_COSINE)) return body
  const across = getNormalizedVector3(arithmetic, { x: up.y, y: -up.x, z: 0 })
  const { sine, cosine } = getSineCosine(arithmetic, MAXIMUM_TILT_ANGLE)
  const limited = {
    x: storeFloat(-multiply(sine, across.y)),
    y: storeFloat(multiply(sine, across.x)),
    z: cosine,
  }
  return Object.freeze({
    ...body,
    frame: Object.freeze({
      ...body.frame,
      rotation: getRotationFromThirdAndFirstAxes(arithmetic, limited, getRotationRow(body, 0)),
    }),
  })
}

// 0x00448a70 (thiscall: triangle, material): a free entry while there are fewer than eight,
// otherwise the first of the oldest.
export const insertTriangle = (
  cache: readonly TriangleCacheEntry[],
  triangle: CollisionTriangle,
  material: string | undefined
): TriangleCacheInsertion => {
  const entry: TriangleCacheEntry = Object.freeze({ triangle, age: 0, material })
  if (cache.length < TRIANGLE_CACHE_CAPACITY) {
    return { triangleCache: Object.freeze([...cache, entry]), index: cache.length }
  }
  const oldest = cache.reduce(
    (found, candidate, index) =>
      found.age < candidate.age ? { index, age: candidate.age } : found,
    { index: 0, age: 0 }
  )
  return {
    triangleCache: Object.freeze(
      cache.map((cached, index) => (index === oldest.index ? entry : cached))
    ),
    index: oldest.index,
  }
}

const getWithFreshEntry = (body: CarRigidBody, index: number): CarRigidBody =>
  Object.freeze({
    ...body,
    triangleCache: Object.freeze(
      body.triangleCache.map((entry, entryIndex) =>
        entryIndex === index ? Object.freeze({ ...entry, age: 0 }) : entry
      )
    ),
  })

// 0x00448ae0 (thiscall: wheel): tries the wheel's last triangle, then every other cached one,
// with 0x00448b80 (each try writes its crossing point to the wheel's +0x30).
export const findCachedTriangle = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  wheelIndex: number
): CachedTriangleSearch => {
  const wheel = body.wheels[wheelIndex]
  if (wheel === undefined) return { isFound: false, body }
  const order = [
    ...(wheel.cachedTriangleIndex >= 0 ? [wheel.cachedTriangleIndex] : []),
    ...body.triangleCache
      .map((_entry, index) => index)
      .filter((index) => index !== wheel.cachedTriangleIndex),
  ]
  let current = body
  for (const index of order) {
    const entry = body.triangleCache[index]
    if (entry === undefined) continue
    const result = getTriangleSegmentResult(
      arithmetic,
      entry.triangle,
      wheel.probeStart,
      wheel.probeEnd
    )
    if (result.crossingPoint !== undefined) {
      current = replaceWheel(current, wheelIndex, { contactPoint: result.crossingPoint })
    }
    if (result.isInside) {
      const found = replaceWheel(current, wheelIndex, {
        cachedTriangleIndex: index,
        material: entry.material,
      })
      return { isFound: true, body: getWithFreshEntry(found, index) }
    }
  }
  return { isFound: false, body: current }
}

// The squared distance of 0x00446045 / 0x004461d5: the differences stay on the FPU stack.
export const getUnstoredSquaredDistance = (
  arithmetic: FloatArithmetic,
  end: Vector3,
  point: Vector3
): number =>
  getSquaredLength(arithmetic, {
    x: arithmetic.subtract(end.x, point.x),
    y: arithmetic.subtract(end.y, point.y),
    z: arithmetic.subtract(end.z, point.z),
  })

export const getDeeper = (
  arithmetic: FloatArithmetic,
  deepest: DeepestWheel | undefined,
  wheelIndex: number,
  depthSquared: number
): DeepestWheel | undefined =>
  arithmetic.getIsBelowOrEqual(depthSquared, deepest?.depthSquared ?? -FLOAT32_MAXIMUM)
    ? deepest
    : { wheelIndex, depthSquared: arithmetic.storeFloat(depthSquared) }

// 0x00448d90 (thiscall: object, height, depth): every wheel's probe in the object's frame, from
// height above the anchor to depth below it along the world's vertical.
const getProbesInObject = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  object: CollisionObject,
  probeHeight: number,
  probeDepth: number
): CarRigidBody => {
  const { rotation } = object.frame
  const vertical = { x: rotation[2], y: rotation[5], z: rotation[8] }
  const down = getStoredScaledVector(arithmetic, vertical, probeDepth)
  const up = getStoredScaledVector(arithmetic, vertical, probeHeight)
  const anchor1 = getFrameInverseTransformedPoint(
    arithmetic,
    object.frame,
    body.wheels[1]?.anchor ?? ZERO_VECTOR3
  )
  const length = getStoredScaledVector(
    arithmetic,
    getFrameInverseRotatedVector(arithmetic, object.frame, getRotationRow(body, 0)),
    body.wheelbase
  )
  const width = getStoredScaledVector(
    arithmetic,
    getFrameInverseRotatedVector(arithmetic, object.frame, getRotationRow(body, 1)),
    body.trackWidth
  )
  const anchor0 = getStoredDifference(arithmetic, anchor1, width)
  const anchor3 = getStoredDifference(arithmetic, anchor1, length)
  const anchor2 = getStoredDifference(arithmetic, anchor0, length)
  const anchors = [anchor0, anchor1, anchor2, anchor3]
  return replaceAllWheelsByIndex(body, (_wheel, index) => {
    const anchor = anchors[index] ?? anchor1
    return {
      probeStart: getStoredSum(arithmetic, anchor, up),
      probeEnd: getStoredDifference(arithmetic, anchor, down),
    }
  })
}

const replaceAllWheelsByIndex = (
  body: CarRigidBody,
  getChange: (wheel: CarWheel, index: number) => Partial<CarWheel>
): CarRigidBody =>
  Object.freeze({
    ...body,
    wheels: Object.freeze(
      body.wheels.map((wheel, index) => Object.freeze({ ...wheel, ...getChange(wheel, index) }))
    ),
  })

// 0x00445f4f..0x004460b1: the probes against one moving object, in its frame.
const probeObject = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  object: CollisionObject,
  deepest: DeepestWheel | undefined
): GroundProbeProgress => {
  let current = body
  let deepestSoFar = deepest
  current.wheels.forEach((wheel, wheelIndex) => {
    if (wheel.isProbed) return
    const { intersection } = getSegmentQueryResult(
      arithmetic,
      object.volume,
      wheel.probeStart,
      wheel.probeEnd
    )
    if (intersection === undefined) return
    const depthSquared = getUnstoredSquaredDistance(arithmetic, wheel.probeEnd, intersection.point)
    current = replaceWheel(current, wheelIndex, {
      isProbed: true,
      material: getCollisionMaterialName(object, intersection.materialIndex),
      contactPoint: getFrameTransformedPoint(arithmetic, object.frame, intersection.point),
      groundForce: getFrameRotatedVector(arithmetic, object.frame, intersection.triangle.normal),
      depthSquared: arithmetic.storeFloat(depthSquared),
    })
    deepestSoFar = getDeeper(arithmetic, deepestSoFar, wheelIndex, depthSquared)
  })
  return { body: current, deepest: deepestSoFar }
}

// 0x004460bb..0x0044621d: the probes of the remaining wheels against the track (+0x140), in world
// space, from the probe height above the anchor to the probe depth below it. The triangle cache
// is tried first; a fresh hit goes into it.
const probeTrack = (
  arithmetic: FloatArithmetic,
  progress: GroundProbeProgress,
  track: CollisionObject,
  probeHeight: number,
  probeDepth: number
): GroundProbeProgress => {
  const { add, subtract, storeFloat } = arithmetic
  let current = progress.body
  let deepest = progress.deepest
  current.wheels.forEach((startWheel, wheelIndex) => {
    if (startWheel.isProbed) return
    const { anchor } = startWheel
    current = replaceWheel(current, wheelIndex, {
      probeStart: Object.freeze({
        x: anchor.x,
        y: anchor.y,
        z: storeFloat(add(probeHeight, anchor.z)),
      }),
      probeEnd: Object.freeze({
        x: anchor.x,
        y: anchor.y,
        z: storeFloat(subtract(anchor.z, probeDepth)),
      }),
    })
    const cached = findCachedTriangle(arithmetic, current, wheelIndex)
    current = cached.body
    if (!cached.isFound) {
      const wheel = current.wheels[wheelIndex] ?? startWheel
      const result = getSegmentQueryResult(
        arithmetic,
        track.volume,
        wheel.probeStart,
        wheel.probeEnd
      )
      if (result.lastCrossingPoint !== undefined) {
        current = replaceWheel(current, wheelIndex, { contactPoint: result.lastCrossingPoint })
      }
      if (result.intersection === undefined) return
      const material = getCollisionMaterialName(track, result.intersection.materialIndex)
      const insertion = insertTriangle(
        current.triangleCache,
        result.intersection.triangle,
        material
      )
      current = replaceWheel(
        Object.freeze({ ...current, triangleCache: insertion.triangleCache }),
        wheelIndex,
        { material, cachedTriangleIndex: insertion.index }
      )
    }
    const wheel = current.wheels[wheelIndex] ?? startWheel
    const entry = current.triangleCache[wheel.cachedTriangleIndex]
    const depthSquared = getUnstoredSquaredDistance(arithmetic, wheel.probeEnd, wheel.contactPoint)
    current = replaceWheel(current, wheelIndex, {
      groundForce: entry?.triangle.normal ?? ZERO_VECTOR3,
      depthSquared: storeFloat(depthSquared),
      isProbed: true,
    })
    deepest = getDeeper(arithmetic, deepest, wheelIndex, depthSquared)
  })
  return { body: current, deepest }
}

// The stored differences of 0x00448430 between two grounded wheels' contact points.
const getContactDifference = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  minuendIndex: number,
  subtrahendIndex: number
): Vector3 =>
  getStoredDifference(
    arithmetic,
    body.wheels[minuendIndex]?.contactPoint ?? ZERO_VECTOR3,
    body.wheels[subtrahendIndex]?.contactPoint ?? ZERO_VECTOR3
  )

// 0x00448430 (thiscall: deepest wheel): with two or more wheels down (and no roll or pitch timer),
// row 0 and row 1 follow the contact points of the wheel pairs; then the frame moves by the
// reference wheel's contact point - anchor + the settle offset, and the anchors are recomputed.
const settleOnGround = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  deepestIndex: number
): CarRigidBody => {
  const { add, subtract, storeFloat } = arithmetic
  const isAligning = body.groundedWheelCount > 1 && body.rollTimer === 0 && body.pitchTimer === 0
  const referenceIndex = isAligning && body.groundedWheelCount >= 4 ? 0 : deepestIndex
  const getIsWheelDown = (index: number): boolean => body.wheels[index]?.isOnGround ?? false
  const lengthwise = LENGTHWISE_WHEELS[referenceIndex] ?? 0
  const crosswise = CROSSWISE_WHEELS[referenceIndex] ?? 0
  const rotation = isAligning
    ? getRotationFromFirstAndSecondAxes(
        arithmetic,
        getIsWheelDown(lengthwise)
          ? getContactDifference(
              arithmetic,
              body,
              Math.min(lengthwise, referenceIndex),
              Math.max(lengthwise, referenceIndex)
            )
          : getRotationRow(body, 0),
        getIsWheelDown(crosswise)
          ? getContactDifference(
              arithmetic,
              body,
              Math.max(crosswise, referenceIndex),
              Math.min(crosswise, referenceIndex)
            )
          : getRotationRow(body, 1)
      )
    : body.frame.rotation
  const reference = body.wheels[referenceIndex]
  const contact = reference?.contactPoint ?? ZERO_VECTOR3
  const anchor = reference?.anchor ?? ZERO_VECTOR3
  const getOffset = (contactValue: number, anchorValue: number, settleValue: number): number =>
    storeFloat(add(subtract(contactValue, anchorValue), settleValue))
  const offset = {
    x: getOffset(contact.x, anchor.x, body.settleOffset.x),
    y: getOffset(contact.y, anchor.y, body.settleOffset.y),
    z: getOffset(contact.z, anchor.z, body.settleOffset.z),
  }
  return getWithWheelAnchors(
    arithmetic,
    Object.freeze({
      ...body,
      frame: Object.freeze({
        rotation,
        position: getStoredSum(arithmetic, body.frame.position, offset),
      }),
    })
  )
}

// 0x00446352..0x004463de: after more than 400 ms in the air, the velocity into the ground is
// removed; above 0.05 per millisecond it bounces 1.15 times and the wheels leave the ground again.
const getLanded = (arithmetic: FloatArithmetic, body: CarRigidBody): CarRigidBody | undefined => {
  const { subtract, storeFloat, getIsBelow } = arithmetic
  const into = getDotProduct(arithmetic, body.linearVelocity, body.groundNormal)
  if (!getIsBelow(into, 0)) return body
  if (getIsBelow(into, -HARD_LANDING_SPEED)) return undefined
  return Object.freeze({
    ...body,
    linearVelocity: Object.freeze({
      ...body.linearVelocity,
      z: storeFloat(subtract(body.linearVelocity.z, into)),
    }),
  })
}

const getBounced = (arithmetic: FloatArithmetic, body: CarRigidBody): CarRigidBody => {
  const into = getDotProduct(arithmetic, body.linearVelocity, body.groundNormal)
  const bounced = Object.freeze({
    ...body,
    groundedWheelCount: 0,
    linearVelocity: Object.freeze({
      ...body.linearVelocity,
      z: arithmetic.storeFloat(
        arithmetic.subtract(body.linearVelocity.z, arithmetic.multiply(LANDING_BOUNCE, into))
      ),
    }),
  })
  return replaceAllWheels(bounced, () => ({ isOnGround: false }))
}

// Gravity along the ground (0x004463e0, 0x00446dbc): the weight minus its part along the ground normal.
export const getBodyWithSlopeForce = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody
): CarRigidBody => {
  const { multiply, subtract, storeFloat } = arithmetic
  const { groundNormal, weight } = body
  const normalWeight = multiply(weight, groundNormal.z)
  return Object.freeze({
    ...body,
    slopeForce: Object.freeze({
      x: storeFloat(-multiply(groundNormal.x, normalWeight)),
      y: storeFloat(-multiply(groundNormal.y, normalWeight)),
      z: storeFloat(subtract(weight, multiply(groundNormal.z, normalWeight))),
    }),
  })
}

// Without a hit the body sinks 0.008 per pass when it had ground before (0x00446488, 0x00446b04).
export const getBodyAfterMissingGround = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  previousCount: number
): CarRigidBody =>
  previousCount === 0
    ? body
    : Object.freeze({
        ...body,
        linearVelocity: Object.freeze({
          ...body.linearVelocity,
          z: arithmetic.storeFloat(arithmetic.subtract(body.linearVelocity.z, AIRBORNE_SINK)),
        }),
      })

// 0x004463e0..0x00446488: gravity along the ground, and each grounded wheel's share of the weight.
const getGroundLoads = (arithmetic: FloatArithmetic, body: CarRigidBody): CarRigidBody => {
  const { multiply, divide, storeFloat } = arithmetic
  const share = storeFloat(multiply(body.weight, -divide(1, body.groundedWheelCount + 8)))
  const loaded = getBodyWithSlopeForce(arithmetic, body)
  const load = Object.freeze({ x: 0, y: 0, z: share })
  return replaceAllWheels(loaded, (wheel) => (wheel.isOnGround ? { groundForce: load } : {}))
}

// 0x00446229..0x00446352: the wheels within 0.4 of the deepest hit are on the ground; their
// normals average into the ground normal, the frame settles, and with three or more down the
// body counts as fully grounded on rotation row 2.
const getGrounded = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  deepest: DeepestWheel,
  isLanding: boolean
): CarRigidBody => {
  const { subtract, multiply, getSquareRoot, storeFloat, getIsBelow } = arithmetic
  const reach = subtract(getSquareRoot(deepest.depthSquared), GROUND_DEPTH_TOLERANCE)
  const clampedReach = getIsBelow(reach, 0) ? 0 : reach
  const threshold = storeFloat(multiply(clampedReach, clampedReach))
  let groundNormal: Vector3 = ZERO_VECTOR3
  let count = 0
  const wheels = body.wheels.map((wheel) => {
    if (getIsBelow(wheel.depthSquared, threshold)) {
      return Object.freeze({ ...wheel, groundForce: ZERO_VECTOR3, isOnGround: false })
    }
    groundNormal = getStoredSum(arithmetic, wheel.groundForce, groundNormal)
    count += 1
    return Object.freeze({ ...wheel, isOnGround: true })
  })
  const settled = settleOnGround(
    arithmetic,
    Object.freeze({
      ...body,
      wheels: Object.freeze(wheels),
      groundedWheelCount: count,
      groundNormal,
    }),
    deepest.wheelIndex
  )
  const aligned =
    settled.groundedWheelCount >= 3
      ? replaceAllWheels(
          Object.freeze({
            ...settled,
            groundNormal: getRotationRow(settled, 2),
            groundedWheelCount: 4,
          }),
          () => ({ isOnGround: true })
        )
      : Object.freeze({
          ...settled,
          groundNormal: getNormalizedVector3(arithmetic, settled.groundNormal),
        })
  if (!isLanding || aligned.airborneTime <= LANDING_AIR_TIME)
    return getGroundLoads(arithmetic, aligned)
  const landed = getLanded(arithmetic, aligned)
  return landed === undefined ? getBounced(arithmetic, aligned) : getGroundLoads(arithmetic, landed)
}

// The start of 0x00445dc0 and 0x004465c0: a body at rest (flag 0x100, no velocity) is left alone, any other loses the
// flag, and the triangle cache ages by one sub-step (0x00448a50).
export const getAwakeBody = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody
): CarRigidBody | undefined => {
  const { getIsEqual } = arithmetic
  const isAtRest =
    getIsFlagSet(body, CarRigidBodyFlag.AT_REST) &&
    [body.linearVelocity, body.angularVelocity].every(
      (vector) => getIsEqual(vector.x, 0) && getIsEqual(vector.y, 0) && getIsEqual(vector.z, 0)
    )
  if (isAtRest) return undefined
  return Object.freeze({
    ...body,
    flags: body.flags & ~CarRigidBodyFlag.AT_REST,
    triangleCache: Object.freeze(
      body.triangleCache.map((entry) => Object.freeze({ ...entry, age: entry.age + 1 }))
    ),
  })
}

// 0x00445dc0 (thiscall: step): finds the ground under the four wheels. A body at rest (flag 0x100,
// no velocity) is left alone. Probes reach from the model's bounding radius plus the drop since the
// pass started above each anchor to 0.04 × step below it (0 when airborne or flag 0x80).
export const probeGround = (
  arithmetic: FloatArithmetic,
  body: CarRigidBody,
  stepMilliseconds: number,
  collisionObjects: readonly CollisionObject[]
): CarRigidBody => {
  const { add, subtract, multiply, storeFloat, getIsBelow } = arithmetic
  const awake = getAwakeBody(arithmetic, body)
  if (awake === undefined) return body
  const previousCount = awake.groundedWheelCount
  const drop = -subtract(awake.frame.position.z, awake.stepStart.position.z)
  const storedDrop = getIsBelow(drop, 0) ? 0 : storeFloat(drop)
  const probeHeight = storeFloat(add(awake.displayBoundingRadius, storedDrop))
  const isLanding = previousCount === 0 || getIsFlagSet(awake, CarRigidBodyFlag.FLAGGED)
  const probeDepth = isLanding
    ? 0
    : storeFloat(multiply(stepMilliseconds, PROBE_DEPTH_PER_MILLISECOND))
  const cleared = replaceAllWheels(
    getWithWheelAnchors(arithmetic, Object.freeze({ ...awake, groundedWheelCount: 0 })),
    () => ({
      isOnGround: false,
      isProbed: false,
      groundForce: ZERO_VECTOR3,
      depthSquared: -FLOAT32_MAXIMUM,
    })
  )
  const afterObjects = collisionObjects
    .slice(1)
    .reduce<GroundProbeProgress>(
      (progress, object) =>
        probeObject(
          arithmetic,
          getProbesInObject(arithmetic, progress.body, object, probeHeight, probeDepth),
          object,
          progress.deepest
        ),
      { body: cleared, deepest: undefined }
    )
  const track = collisionObjects[0]
  const probed =
    track === undefined
      ? afterObjects
      : probeTrack(arithmetic, afterObjects, track, probeHeight, probeDepth)
  if (probed.deepest === undefined) {
    return getBodyAfterMissingGround(arithmetic, probed.body, previousCount)
  }
  return getGrounded(arithmetic, probed.body, probed.deepest, isLanding)
}
