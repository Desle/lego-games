import { getNextInCone } from '../../../power-ups/index.ts'
import type { ConeQueryWindow } from '../../../power-ups/index.ts'
import {
  getDotProduct,
  getNormalizedVector3,
  getSineCosine,
  getSquaredLength,
  getStoredDifference,
  FLOAT32_MAXIMUM,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import { BallisticFlightState, TARGET_HEIGHT } from '../ballistic-flight/ballistic-flight.ts'
import type { BallisticFlight } from '../ballistic-flight/ballistic-flight.types.ts'
import type { RouteNode } from '../route-movement/route-movement.types.ts'
import type { LineProbe } from '../projectiles.types.ts'
import type { HomingAdvance, HomingFlight, HomingTarget } from './homing-flight.types.ts'

// 0x004af220.
const SECONDS_PER_MILLISECOND = Math.fround(0.001)
// 0x004b022c, 0x004b0230: within 60 units (3600 squared) the rocket homes at its launch speed, within 3 units
// (9 squared) it has arrived.
const HOMING_DISTANCE_SQUARED = 3600
const ARRIVAL_DISTANCE_SQUARED = 9
// 0x004b0238, 0x004b0234, 0x004b023c: the rocket keeps 6 units above the ground, probed from 2 above to 6 below,
// and sinks at most 6 units a second.
const GROUND_CLEARANCE = 6
const GROUND_PROBE_TOP = 2
const GROUND_PROBE_BOTTOM = 6
const MAXIMUM_SINK_PER_SECOND = 6
// 0x004b0240: the wobble amplitude grows by this per second.
const WOBBLE_GROWTH_PER_SECOND = 6
// 0x004b0170, 0x004b0268, 0x004b0238: the route node's ground point is probed from 5 above to 50 below, and lies 6
// above the hit.
const NODE_PROBE_TOP = 5
const NODE_PROBE_BOTTOM = 50
// 0x004b0244, 0x004afde0: a route node is dropped when more than 300 units (90000 squared) away, and kept while the
// rocket is at least 10 units in front of its plane.
const NODE_MAXIMUM_DISTANCE_SQUARED = 90000
const NODE_PLANE_CLEARANCE = 10
// 0x00423640: the target is chosen again after 1000 ms.
const RETARGET_MILLISECONDS = 1000
const ZERO: Vector3 = Object.freeze({ x: 0, y: 0, z: 0 })

// 0x00456680 (the part that follows the launch): the body starts at the frame position, heading along the model's
// first axis, with the route node of its shooter when that lies ahead.
export const createHomingFlight = (
  arithmetic: FloatArithmetic,
  flight: BallisticFlight,
  heading: Vector3,
  shooterNodeIndex: number | null,
  route: readonly RouteNode[]
): HomingFlight => {
  const node = shooterNodeIndex === null ? undefined : route[shooterNodeIndex]
  // 0x00423a09: a node the heading already passes through (dot above 0) is dropped.
  const isNodeDropped =
    node !== undefined &&
    !arithmetic.getIsBelowOrEqual(getDotProduct(arithmetic, node.normal, heading), 0)
  return Object.freeze({
    flight,
    position: flight.framePosition,
    wobbleAmplitude: 0,
    // 0x00456887, 0x00456889: +0xb8 = 4.0 and +0xc0 = 10.0.
    wobbleMaximumAmplitude: 4,
    wobbleAngle: 0,
    wobbleRate: 10,
    velocity: ZERO,
    heading,
    groundPoint: ZERO,
    isGroundPointKnown: false,
    routeNodeIndex: node === undefined || isNodeDropped ? null : shooterNodeIndex,
    retargetMilliseconds: 0,
  })
}

// 0x00423ea0.
export const getHomingVelocity = (homing: HomingFlight): Vector3 => homing.velocity

const getRouteNode = (route: readonly RouteNode[], index: number | null): RouteNode | undefined =>
  index === null ? undefined : route[index]

// 0x00423640 (thiscall: milliseconds, then the cone): the target is chosen again every second, or at once when it is
// struck, shielded or warping; then the route node it follows is advanced and its ground point found.
export const retargetHomingFlight = (
  arithmetic: FloatArithmetic,
  probe: LineProbe,
  homing: HomingFlight,
  stepMilliseconds: number,
  environment: {
    readonly targets: readonly HomingTarget[]
    readonly route: readonly RouteNode[]
    readonly window: ConeQueryWindow
  }
): HomingFlight => {
  const { add, subtract, getIsBelow, getIsBelowOrEqual } = arithmetic
  const { targets, route, window } = environment
  const elapsed = (homing.retargetMilliseconds + stepMilliseconds) >>> 0
  const current =
    homing.flight.targetRacer === null ? undefined : targets[homing.flight.targetRacer]
  const isRetargeting =
    homing.flight.targetRacer === null ||
    elapsed > RETARGET_MILLISECONDS ||
    current === undefined ||
    current.isStruckByLightning ||
    current.isShieldedOrWarping
  let targetRacer = homing.flight.targetRacer
  let retargetMilliseconds = elapsed
  if (isRetargeting) {
    retargetMilliseconds = 0
    const query = {
      origin: homing.position,
      direction: homing.heading,
      window,
      targets: targets.map((target) => ({ position: target.position })),
    }
    let candidate = getNextInCone(arithmetic, query, -1)
    while (candidate !== -1) {
      const racer = targets[candidate]
      if (
        candidate !== homing.flight.shooterRacer &&
        racer !== undefined &&
        !racer.isStruckByLightning &&
        !racer.isShieldedOrWarping
      ) {
        break
      }
      candidate = getNextInCone(arithmetic, query, candidate)
    }
    targetRacer = candidate === -1 ? null : candidate
  }
  let nodeIndex = homing.routeNodeIndex
  let groundPoint = homing.groundPoint
  let isGroundPointKnown = homing.isGroundPointKnown
  if (!isGroundPointKnown && nodeIndex !== null) {
    let node = getRouteNode(route, nodeIndex)
    const getRelative = (position: Vector3): Vector3 =>
      Object.freeze({
        x: subtract(position.x, homing.position.x),
        y: subtract(position.y, homing.position.y),
        z: subtract(position.z, homing.position.z),
      })
    // The do-while of 0x0042373a..0x004238c5.
    for (;;) {
      if (node === undefined) break
      const ahead = getDotProduct(arithmetic, homing.heading, getRelative(node.position))
      const plane = add(
        add(
          add(
            arithmetic.multiply(homing.position.z, node.normal.z),
            arithmetic.multiply(homing.position.y, node.normal.y)
          ),
          arithmetic.multiply(node.normal.x, homing.position.x)
        ),
        node.planeOffset
      )
      if (!getIsBelowOrEqual(ahead, 0) && !getIsBelow(plane, NODE_PLANE_CLEARANCE)) break
      const next = route[node.nextIndex]
      nodeIndex = next === undefined ? null : node.nextIndex
      if (next === undefined) break
      node = next
      const distanceSquared = getSquaredLength(arithmetic, getRelative(node.position))
      if (!getIsBelowOrEqual(distanceSquared, NODE_MAXIMUM_DISTANCE_SQUARED)) {
        nodeIndex = null
        break
      }
      if (getIsBelowOrEqual(getDotProduct(arithmetic, node.normal, homing.heading), 0)) continue
      nodeIndex = null
      break
    }
    const followed = getRouteNode(route, nodeIndex)
    if (followed !== undefined) {
      const hit = probe(
        Object.freeze({
          ...followed.position,
          z: arithmetic.storeFloat(add(followed.position.z, NODE_PROBE_TOP)),
        }),
        Object.freeze({
          ...followed.position,
          z: arithmetic.storeFloat(subtract(followed.position.z, NODE_PROBE_BOTTOM)),
        })
      )
      if (hit !== null) {
        isGroundPointKnown = true
        groundPoint = Object.freeze({
          ...hit.point,
          z: arithmetic.storeFloat(add(GROUND_CLEARANCE, hit.point.z)),
        })
      }
    }
  }
  return Object.freeze({
    ...homing,
    flight: Object.freeze({ ...homing.flight, targetRacer }),
    retargetMilliseconds,
    routeNodeIndex: nodeIndex,
    groundPoint,
    isGroundPointKnown,
  })
}

// 0x00423ed0: the position is pushed round the heading by a growing offset (the column of the rotation about the
// heading that takes z).
const getWobbledPosition = (
  arithmetic: FloatArithmetic,
  homing: HomingFlight,
  seconds: number,
  heading: Vector3,
  position: Vector3
): { readonly homing: HomingFlight; readonly position: Vector3 } => {
  const { add, subtract, multiply, storeFloat, getIsBelowOrEqual } = arithmetic
  const grown = storeFloat(add(multiply(WOBBLE_GROWTH_PER_SECOND, seconds), homing.wobbleAmplitude))
  const amplitude = getIsBelowOrEqual(grown, homing.wobbleMaximumAmplitude)
    ? grown
    : homing.wobbleMaximumAmplitude
  const wobbleAngle = storeFloat(add(multiply(homing.wobbleRate, seconds), homing.wobbleAngle))
  const { sine, cosine } = getSineCosine(arithmetic, wobbleAngle)
  const oneMinusCosine = storeFloat(subtract(1, cosine))
  const sineTimesX = multiply(sine, heading.x)
  const headingYTimesSine = multiply(heading.y, sine)
  const yComponent = storeFloat(multiply(multiply(heading.z, heading.y), oneMinusCosine))
  return {
    homing: Object.freeze({ ...homing, wobbleAmplitude: amplitude, wobbleAngle }),
    position: Object.freeze({
      x: storeFloat(
        add(
          multiply(
            subtract(multiply(multiply(heading.z, heading.x), oneMinusCosine), headingYTimesSine),
            amplitude
          ),
          position.x
        )
      ),
      y: storeFloat(add(multiply(add(yComponent, sineTimesX), amplitude), position.y)),
      z: storeFloat(
        add(
          multiply(
            add(multiply(multiply(heading.z, heading.z), oneMinusCosine), cosine),
            amplitude
          ),
          position.z
        )
      ),
    }),
  }
}

// The two ways the flight ends at its target (0x00423c19): close enough, or the step would pass it.
const getArrived = (
  homing: HomingFlight,
  elapsedMilliseconds: number,
  aimed: Vector3,
  guidance: { readonly heading: Vector3; readonly velocity: Vector3; readonly isGroundPointKnown: boolean }
): HomingAdvance =>
  Object.freeze({
    homing: Object.freeze({
      ...homing,
      heading: guidance.heading,
      velocity: guidance.velocity,
      isGroundPointKnown: guidance.isGroundPointKnown,
      flight: Object.freeze({
        ...homing.flight,
        elapsedMilliseconds,
        targetPosition: aimed,
        endPosition: aimed,
        framePosition: aimed,
        state: BallisticFlightState.ENDED,
      }),
    }),
    result: BallisticFlightState.ENDED,
  })

// The guidance of one step (0x00423a20 up to the wobble): the new heading, velocity and position.
type Guidance = {
  readonly heading: Vector3
  readonly velocity: Vector3
  readonly isGroundPointKnown: boolean
  readonly position: Vector3
  readonly isArrived: boolean
}

// Within 60 units of the target racer the rocket flies straight at it at its launch speed.
const getHomingGuidance = (
  arithmetic: FloatArithmetic,
  homing: HomingFlight,
  seconds: number,
  aimed: Vector3,
  toTarget: Vector3,
  distanceSquared: number
): Guidance => {
  const { add, subtract, multiply, getSquareRoot, storeFloat, getIsBelow, getIsBelowOrEqual } =
    arithmetic
  const { flight } = homing
  const heading = getNormalizedVector3(arithmetic, toTarget)
  const launchSpeed = getSquareRoot(
    getSquaredLength(
      arithmetic,
      Object.freeze({ x: flight.velocityX, y: flight.velocityY, z: flight.launchVelocityZ })
    )
  )
  const velocity = Object.freeze({
    x: storeFloat(multiply(launchSpeed, heading.x)),
    y: storeFloat(multiply(heading.y, launchSpeed)),
    z: storeFloat(multiply(heading.z, launchSpeed)),
  })
  const common = { heading, velocity, isGroundPointKnown: homing.isGroundPointKnown }
  if (getIsBelow(distanceSquared, ARRIVAL_DISTANCE_SQUARED)) {
    return { ...common, position: homing.position, isArrived: true }
  }
  const position = Object.freeze({
    x: storeFloat(add(multiply(seconds, velocity.x), homing.position.x)),
    y: storeFloat(add(homing.position.y, storeFloat(multiply(velocity.y, seconds)))),
    z: storeFloat(add(homing.position.z, storeFloat(multiply(velocity.z, seconds)))),
  })
  const remaining = getDotProduct(
    arithmetic,
    heading,
    Object.freeze({
      x: subtract(aimed.x, position.x),
      y: subtract(aimed.y, position.y),
      z: subtract(aimed.z, position.z),
    })
  )
  return { ...common, position, isArrived: getIsBelowOrEqual(remaining, 0) }
}

// Farther away it follows the heading at the flight's speed, hugging the ground 6 units below.
const getCruiseGuidance = (
  arithmetic: FloatArithmetic,
  probe: LineProbe,
  homing: HomingFlight,
  seconds: number,
  towardTarget: Vector3
): Guidance => {
  const { add, subtract, multiply, storeFloat, getIsBelowOrEqual } = arithmetic
  const { flight } = homing
  let heading = towardTarget
  let isGroundPointKnown = homing.isGroundPointKnown
  if (isGroundPointKnown) {
    const toGround = getStoredDifference(arithmetic, homing.groundPoint, homing.position)
    if (getIsBelowOrEqual(getDotProduct(arithmetic, heading, toGround), 0)) {
      isGroundPointKnown = false
    } else {
      heading = toGround
    }
  }
  heading = getNormalizedVector3(arithmetic, heading)
  const velocity = Object.freeze({
    x: storeFloat(multiply(flight.horizontalSpeed, heading.x)),
    y: storeFloat(multiply(heading.y, flight.horizontalSpeed)),
    z: storeFloat(multiply(heading.z, flight.horizontalSpeed)),
  })
  const stepped = Object.freeze({
    x: storeFloat(add(multiply(seconds, velocity.x), homing.position.x)),
    y: storeFloat(add(storeFloat(multiply(velocity.y, seconds)), homing.position.y)),
    z: storeFloat(add(storeFloat(multiply(velocity.z, seconds)), homing.position.z)),
  })
  const ground = probe(
    Object.freeze({ ...stepped, z: storeFloat(add(GROUND_PROBE_TOP, stepped.z)) }),
    Object.freeze({ ...stepped, z: storeFloat(subtract(stepped.z, GROUND_PROBE_BOTTOM)) })
  )
  if (ground === null) {
    return { heading, velocity, isGroundPointKnown, position: stepped, isArrived: false }
  }
  const minimumZ = storeFloat(add(GROUND_CLEARANCE, ground.point.z))
  const sunk = subtract(homing.position.z, multiply(MAXIMUM_SINK_PER_SECOND, seconds))
  const isSinking =
    !getIsBelowOrEqual(homing.position.z, minimumZ) && !getIsBelowOrEqual(sunk, minimumZ)
  return {
    heading,
    velocity,
    isGroundPointKnown,
    position: Object.freeze({ ...stepped, z: isSinking ? storeFloat(sunk) : minimumZ }),
    isArrived: false,
  }
}

// 0x00423a20 (thiscall: milliseconds): the rocket's flight. targetPosition is the frame position of the target
// racer (flight.targetRacer), or null.
export const advanceHomingFlight = (
  arithmetic: FloatArithmetic,
  probe: LineProbe,
  homing: HomingFlight,
  stepMilliseconds: number,
  targetPosition: Vector3 | null
): HomingAdvance => {
  const { add, multiply, storeFloat, getIsBelow } = arithmetic
  const { flight } = homing
  if (flight.state !== BallisticFlightState.FLYING) {
    return Object.freeze({ homing, result: flight.state })
  }
  const elapsedMilliseconds = (flight.elapsedMilliseconds + stepMilliseconds) >>> 0
  if (elapsedMilliseconds >= flight.maximumDurationMilliseconds) {
    return Object.freeze({
      homing: Object.freeze({
        ...homing,
        flight: Object.freeze({
          ...flight,
          elapsedMilliseconds,
          state: BallisticFlightState.ENDED,
          endPosition: flight.framePosition,
        }),
      }),
      result: BallisticFlightState.ENDED,
    })
  }
  const seconds = storeFloat(multiply(stepMilliseconds | 0, SECONDS_PER_MILLISECOND))
  const isTargeting = flight.targetRacer !== null && targetPosition !== null
  const aimed =
    isTargeting
      ? Object.freeze({
          x: targetPosition.x,
          y: targetPosition.y,
          z: storeFloat(add(TARGET_HEIGHT, targetPosition.z)),
        })
      : flight.targetPosition
  const toTarget = isTargeting ? getStoredDifference(arithmetic, aimed, homing.position) : homing.heading
  const rawDistanceSquared = isTargeting ? getSquaredLength(arithmetic, toTarget) : FLOAT32_MAXIMUM
  const guidance = getIsBelow(rawDistanceSquared, HOMING_DISTANCE_SQUARED)
    ? getHomingGuidance(arithmetic, homing, seconds, aimed, toTarget, storeFloat(rawDistanceSquared))
    : getCruiseGuidance(arithmetic, probe, homing, seconds, toTarget)
  if (guidance.isArrived) return getArrived(homing, elapsedMilliseconds, aimed, guidance)
  const wobbled = getWobbledPosition(
    arithmetic,
    homing,
    seconds,
    guidance.heading,
    guidance.position
  )
  const hit = probe(flight.framePosition, wobbled.position)
  const next: HomingFlight = Object.freeze({
    ...wobbled.homing,
    position: guidance.position,
    heading: guidance.heading,
    velocity: guidance.velocity,
    isGroundPointKnown: guidance.isGroundPointKnown,
    flight: Object.freeze({ ...flight, elapsedMilliseconds, targetPosition: aimed }),
  })
  if (hit !== null) {
    return Object.freeze({
      homing: Object.freeze({
        ...next,
        flight: Object.freeze({
          ...next.flight,
          state: BallisticFlightState.HIT_GROUND,
          hitNormal: hit.normal,
          endPosition: hit.point,
          framePosition: hit.point,
        }),
      }),
      result: BallisticFlightState.HIT_GROUND,
    })
  }
  return Object.freeze({
    homing: Object.freeze({
      ...next,
      flight: Object.freeze({ ...next.flight, framePosition: wobbled.position }),
    }),
    result: BallisticFlightState.FLYING,
  })
}
