import { getNormalizedVector3 } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { RacerConeQuery } from '../racer-ai.types.ts'

const FLOAT32_MAXIMUM = 3.4028234663852886e38 // 0x7f7fffff

// 0x0043ca60 (thiscall on the racer set): the nearest racer, the asking racer included, whose squared
// distance lies in [minimum, maximum] and whose normalized offset has a dot product with the direction
// of at least the minimum cosine. Returns the racer index, or null.
export const findNearestRacerInCone = (
  arithmetic: FloatArithmetic,
  query: RacerConeQuery
): number | null => {
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const { origin, direction } = query
  const found = query.racerPositions.reduce(
    (best, racerPosition, index) => {
      // FST stores y and z but the squares use the unrounded differences still on the stack.
      const offsetX = subtract(racerPosition.x, origin.x)
      const offsetY = subtract(racerPosition.y, origin.y)
      const offsetZ = subtract(racerPosition.z, origin.z)
      const distanceSquared = storeFloat(
        add(add(multiply(offsetZ, offsetZ), multiply(offsetY, offsetY)), multiply(offsetX, offsetX))
      )
      if (getIsBelow(distanceSquared, query.minimumDistanceSquared)) return best
      if (!getIsBelowOrEqual(distanceSquared, query.maximumDistanceSquared)) return best
      const normal = getNormalizedVector3(arithmetic, {
        x: storeFloat(offsetX),
        y: storeFloat(offsetY),
        z: storeFloat(offsetZ),
      })
      const cosine = add(
        add(multiply(direction.z, normal.z), multiply(direction.y, normal.y)),
        multiply(normal.x, direction.x)
      )
      if (getIsBelow(cosine, query.minimumCosine)) return best
      if (!getIsBelow(distanceSquared, best.distanceSquared)) return best
      return { distanceSquared, index }
    },
    { distanceSquared: FLOAT32_MAXIMUM, index: -1 }
  )
  return found.index < 0 ? null : found.index
}
