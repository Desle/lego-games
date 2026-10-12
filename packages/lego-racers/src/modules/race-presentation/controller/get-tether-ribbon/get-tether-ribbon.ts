import { getRibbonSkin, TETHER_RIBBON_SHAPE } from '../../../ribbon/index.ts'
import type { RibbonRequest, RibbonSegment, RibbonView } from '../../../ribbon/index.ts'
import { BallisticFlightState, ROPE_START_HEIGHT } from '../../../projectiles/index.ts'
import type { GrappleHook } from '../../../projectiles/index.ts'
import type { TetherFeed } from './get-tether-ribbon.types.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'

// 0x004b02e0: the rope's points lie at fifths of the way, and the clock that places them on the arc runs in fifths.
const FIFTH = Math.fround(0.2)
// 0x004af220: milliseconds to seconds.
const SECONDS_PER_MILLISECOND = Math.fround(0.001)
// 0x004af58c: half.
const HALF = 0.5
// 0x004b0ca4: the retracting and latched rope bulges by the tension times this.
const RETRACTING_BULGE_PER_TENSION = 10
// 0x004b14e8: the largest sideways bulge of the rope (4); 0x00444490 scales it by the share of the flight left.
const MAXIMUM_BULGE = 4
// The four points between the owner and the hook (0x00444540, 0x00444690, 0x00444820 loop four times).
const INNER_POINT_COUNT = 4
// The tether is drawn in this material (0x00453cd0 looks up "tether").
export const TETHER_MATERIAL_NAME = 'tether'

const getRopeStart = (arithmetic: FloatArithmetic, owner: Vector3): Vector3 =>
  Object.freeze({
    x: owner.x,
    y: owner.y,
    z: arithmetic.storeFloat(arithmetic.add(owner.z, ROPE_START_HEIGHT)),
  })

const getStoredDifference = (arithmetic: FloatArithmetic, to: Vector3, from: Vector3): Vector3 =>
  Object.freeze({
    x: arithmetic.storeFloat(arithmetic.subtract(to.x, from.x)),
    y: arithmetic.storeFloat(arithmetic.subtract(to.y, from.y)),
    z: arithmetic.storeFloat(arithmetic.subtract(to.z, from.z)),
  })

// A fifth of the way from the owner to the hook, each component stored (0x00444690, 0x00444820).
const getFifthOf = (arithmetic: FloatArithmetic, difference: Vector3): Vector3 =>
  Object.freeze({
    x: arithmetic.storeFloat(arithmetic.multiply(difference.x, FIFTH)),
    y: arithmetic.storeFloat(arithmetic.multiply(difference.y, FIFTH)),
    z: arithmetic.storeFloat(arithmetic.multiply(difference.z, FIFTH)),
  })

// The height of the hook's arc after `seconds` of its flight (the same polynomial as 0x00431550).
const getArcHeight = (arithmetic: FloatArithmetic, hook: GrappleHook, seconds: number): number => {
  const { add, multiply } = arithmetic
  const { flight } = hook
  return arithmetic.storeFloat(
    add(
      add(
        multiply(multiply(multiply(seconds, seconds), HALF), flight.gravity),
        multiply(flight.launchVelocityZ, seconds)
      ),
      flight.startPosition.z
    )
  )
}

const getSegments = (
  points: readonly Vector3[],
  end: Vector3,
  bulge: number
): readonly RibbonSegment[] =>
  [...points, end].map((point, index) =>
    Object.freeze({
      end: point,
      bulge: index % 2 === 0 ? bulge : -bulge,
      jitter: null,
    })
  )

// 0x00444540: the rope of a hook in flight. The owner and the hook are joined by a line in x and y; the height of the
// points follows the hook's own arc, taken at fifths of the time it has flown.
const getFlyingRequest = (arithmetic: FloatArithmetic, feed: TetherFeed): RibbonRequest => {
  const { add, subtract, multiply, divide, storeFloat } = arithmetic
  const { hook } = feed
  const { flight } = hook
  const start = getRopeStart(arithmetic, feed.owner)
  const hookPosition = flight.framePosition
  const difference = getStoredDifference(arithmetic, hookPosition, start)
  const step = Object.freeze({
    x: storeFloat(multiply(difference.x, FIFTH)),
    y: storeFloat(multiply(difference.y, FIFTH)),
  })
  const elapsed = flight.elapsedMilliseconds
  const bulge = storeFloat(
    multiply(subtract(1, divide(elapsed, flight.durationMilliseconds)), MAXIMUM_BULGE)
  )
  const increment = storeFloat(multiply(multiply(elapsed, FIFTH), SECONDS_PER_MILLISECOND))
  const points: Vector3[] = []
  let seconds = 0
  let x: number = start.x
  let y: number = start.y
  for (let index = 0; index < INNER_POINT_COUNT; index++) {
    seconds = storeFloat(add(seconds, increment))
    x = storeFloat(add(x, step.x))
    y = storeFloat(add(y, step.y))
    points.push(Object.freeze({ x, y, z: getArcHeight(arithmetic, hook, seconds) }))
  }
  return Object.freeze({
    begin: start,
    direction: difference,
    initialJitter: null,
    segments: getSegments(points, hookPosition, bulge),
  })
}

// 0x00444690: the rope of a retracting hook, a straight line from the owner to the hook that bulges by its tension.
const getRetractingRequest = (arithmetic: FloatArithmetic, feed: TetherFeed): RibbonRequest => {
  const { add, multiply, storeFloat } = arithmetic
  const start = getRopeStart(arithmetic, feed.owner)
  const target = feed.hook.hookTarget
  const difference = getStoredDifference(arithmetic, target, start)
  const step = getFifthOf(arithmetic, difference)
  const bulge = storeFloat(multiply(feed.hook.tension, RETRACTING_BULGE_PER_TENSION))
  const points: Vector3[] = []
  let point: Vector3 = start
  for (let index = 0; index < INNER_POINT_COUNT; index++) {
    point = Object.freeze({
      x: storeFloat(add(step.x, point.x)),
      y: storeFloat(add(step.y, point.y)),
      z: storeFloat(add(step.z, point.z)),
    })
    points.push(point)
  }
  return Object.freeze({
    begin: start,
    direction: difference,
    initialJitter: null,
    segments: getSegments(points, target, bulge),
  })
}

// 0x00444820: the rope of a latched hook, straight in x and y, its height blending from the hook's arc to the straight
// line as the tension grows to 1.
const getLatchedRequest = (arithmetic: FloatArithmetic, feed: TetherFeed): RibbonRequest => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const { hook } = feed
  const start = getRopeStart(arithmetic, feed.owner)
  const hookPosition = hook.flight.framePosition
  const difference = getStoredDifference(arithmetic, hookPosition, start)
  const step = getFifthOf(arithmetic, difference)
  const increment = storeFloat(
    multiply(multiply(hook.flight.durationMilliseconds, FIFTH), SECONDS_PER_MILLISECOND)
  )
  const slack = storeFloat(subtract(1, hook.tension))
  const points: Vector3[] = []
  let seconds = 0
  let x: number = start.x
  let y: number = start.y
  let lineHeight: number = start.z
  for (let index = 0; index < INNER_POINT_COUNT; index++) {
    seconds = storeFloat(add(seconds, increment))
    x = storeFloat(add(x, step.x))
    y = storeFloat(add(y, step.y))
    lineHeight = storeFloat(add(lineHeight, step.z))
    const z = storeFloat(
      add(
        multiply(getArcHeight(arithmetic, hook, seconds), slack),
        multiply(hook.tension, lineHeight)
      )
    )
    points.push(Object.freeze({ x, y, z }))
  }
  return Object.freeze({
    begin: start,
    direction: difference,
    initialJitter: null,
    segments: getSegments(points, hookPosition, 0),
  })
}

// 0x00444490: the rope of a hook, rebuilt in whichever way the hook moved this frame (retracting, latched on a racer,
// flying); a hook that hit the track or ran out of time builds none.
export const getTetherRibbon = (
  arithmetic: FloatArithmetic,
  owner: Vector3,
  hook: GrappleHook
): RibbonView | null => {
  const feed: TetherFeed = { owner, hook }
  let request: RibbonRequest
  if (hook.isRetracting) {
    request = getRetractingRequest(arithmetic, feed)
  } else if (hook.flight.state === BallisticFlightState.TOUCHED_RACER) {
    request = getLatchedRequest(arithmetic, feed)
  } else if (hook.flight.state === BallisticFlightState.FLYING) {
    request = getFlyingRequest(arithmetic, feed)
  } else {
    return null
  }
  return Object.freeze({
    materialName: TETHER_MATERIAL_NAME,
    skin: getRibbonSkin(arithmetic, TETHER_RIBBON_SHAPE, request),
    isFacingCamera: false,
  })
}
