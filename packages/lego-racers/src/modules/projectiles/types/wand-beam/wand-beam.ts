import {
  getNormalizedVector3,
  getSquaredLength,
  getStoredDifference,
  getStoredSum,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { LineProbe } from '../projectiles.types.ts'
import type { WandBeam, WandBeamRequest, WandBounds } from './wand-beam.types.ts'

// 0x004b02fc: milliseconds to the fade fraction (0.002 per millisecond, so a 500 ms stage fades in or out).
const FADE_PER_MILLISECOND = Math.fround(0.002)
// 0x004b1578: the length of one beam segment when nothing is in the way.
const SEGMENT_LENGTH = 50
// 0x004af674: the beam reaches four segments.
const SEGMENT_COUNT = 4
// 0x004b1544: the beam starts 3 above the muzzle.
const MUZZLE_HEIGHT = 3
// 0x004b053c: an obstructed beam shares its length over the four segments.
const QUARTER = 0.25

// 0x0043fdc0 (thiscall on the racer's frame +0x3c: from, to, hit point): whether the segment passes through the
// racer's bounding sphere. The point it writes uses the direction's y twice, so its z is wrong; the wand ignores it.
export const getRaySphereHit = (
  arithmetic: FloatArithmetic,
  from: Vector3,
  to: Vector3,
  bounds: WandBounds
): Vector3 | null => {
  const { add, subtract, multiply, getSquareRoot, storeFloat, getIsBelow, getIsBelowOrEqual } =
    arithmetic
  const radiusSquared = storeFloat(multiply(bounds.radius, bounds.radius))
  const direction = getNormalizedVector3(arithmetic, getStoredDifference(arithmetic, to, from))
  const centerX = subtract(bounds.center.x, from.x)
  const centerY = subtract(bounds.center.y, from.y)
  const centerZ = subtract(bounds.center.z, from.z)
  const projection = storeFloat(
    add(
      add(multiply(centerZ, direction.z), multiply(centerY, direction.y)),
      multiply(centerX, direction.x)
    )
  )
  const storedCenterZ = storeFloat(centerZ)
  const discriminant = subtract(
    radiusSquared,
    subtract(
      add(
        add(multiply(centerY, centerY), multiply(storedCenterZ, storedCenterZ)),
        multiply(centerX, centerX)
      ),
      multiply(projection, projection)
    )
  )
  if (getIsBelowOrEqual(discriminant, 0)) return null
  const distanceAlong = subtract(projection, getSquareRoot(discriminant))
  const reach = getSquaredLength(
    arithmetic,
    Object.freeze({
      x: subtract(from.x, to.x),
      y: subtract(from.y, to.y),
      z: subtract(from.z, to.z),
    })
  )
  if (getIsBelow(reach, multiply(distanceAlong, distanceAlong))) return null
  const yOffset = storeFloat(multiply(direction.y, distanceAlong))
  return Object.freeze({
    x: storeFloat(add(multiply(direction.x, distanceAlong), from.x)),
    y: storeFloat(add(yOffset, from.y)),
    z: storeFloat(add(yOffset, from.z)),
  })
}

// 0x00455100: the beam's origin (3 above the muzzle), its four points and its segment length, from the wand's stage.
export const getWandBeam = (
  arithmetic: FloatArithmetic,
  probe: LineProbe,
  request: WandBeamRequest
): WandBeam => {
  const { add, subtract, multiply, getSquareRoot, storeFloat, getIsBelowOrEqual } = arithmetic
  const origin = Object.freeze({
    x: request.muzzlePosition.x,
    y: request.muzzlePosition.y,
    z: storeFloat(add(MUZZLE_HEIGHT, request.muzzlePosition.z)),
  })
  const fade = multiply(request.timerMilliseconds, FADE_PER_MILLISECOND)
  const stageLength = request.isStarting
    ? storeFloat(multiply(subtract(1, fade), SEGMENT_LENGTH))
    : request.isEnding
      ? storeFloat(multiply(fade, SEGMENT_LENGTH))
      : SEGMENT_LENGTH
  const reach = multiply(stageLength, SEGMENT_COUNT)
  const end = getStoredSum(
    arithmetic,
    origin,
    Object.freeze({
      x: storeFloat(multiply(request.muzzleDirection.x, reach)),
      y: storeFloat(multiply(request.muzzleDirection.y, reach)),
      z: storeFloat(multiply(request.muzzleDirection.z, reach)),
    })
  )
  const struck = request.struck
  let direction = request.muzzleDirection
  let length = stageLength
  if (struck !== null) {
    direction = getNormalizedVector3(
      arithmetic,
      getStoredDifference(arithmetic, struck.center, origin)
    )
    const distance = storeFloat(
      getSquareRoot(
        getSquaredLength(
          arithmetic,
          Object.freeze({
            x: subtract(origin.x, struck.center.x),
            y: subtract(origin.y, struck.center.y),
            z: subtract(origin.z, struck.center.z),
          })
        )
      )
    )
    const radius = storeFloat(struck.radius)
    length = storeFloat(
      multiply(getIsBelowOrEqual(distance, radius) ? distance : subtract(distance, radius), QUARTER)
    )
  } else {
    const hit = probe(origin, end)
    if (hit !== null) {
      length = storeFloat(
        multiply(
          getSquareRoot(
            getSquaredLength(
              arithmetic,
              Object.freeze({
                x: subtract(origin.x, hit.point.x),
                y: subtract(origin.y, hit.point.y),
                z: subtract(origin.z, hit.point.z),
              })
            )
          ),
          QUARTER
        )
      )
    }
  }
  const stepX = storeFloat(multiply(direction.x, length))
  const stepY = storeFloat(multiply(direction.y, length))
  const stepZ = multiply(length, direction.z)
  const points: Vector3[] = []
  let current = origin
  for (let index = 0; index < SEGMENT_COUNT; index += 1) {
    current = Object.freeze({
      x: storeFloat(add(stepX, current.x)),
      y: storeFloat(add(current.y, stepY)),
      z: storeFloat(add(stepZ, current.z)),
    })
    points.push(current)
  }
  return Object.freeze({
    origin,
    length,
    points: Object.freeze(points),
  })
}
