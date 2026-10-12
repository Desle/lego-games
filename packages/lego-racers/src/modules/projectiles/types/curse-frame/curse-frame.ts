import { getRotationFromFrameAxes, getStoredCrossProduct } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { HazardMotion } from '../projectile-world/projectile-world.types.ts'
import type { CurseTrackFrame } from './curse-frame.types.ts'

// 0x004b1420: the floating figure's height above the ground point.
const CURSE_FLOAT_HEIGHT = 13

// 0x00452ae0 (state 2 to 3): the figures take the ground point; the floating one is raised along the normal, and all take
// the axes (first: normal x route normal, third: the normal). A landing that missed the ground leaves its plane unwritten
// in the original (**hypothesis:** nothing sensible is drawn), so it has no frame here.
export const getCurseTrackFrame = (
  arithmetic: FloatArithmetic,
  motion: HazardMotion
): CurseTrackFrame | null => {
  const { groundNormal, position, routeNormal } = motion
  if (groundNormal === null) return null
  const { add, multiply, storeFloat } = arithmetic
  return Object.freeze({
    floatingPosition: Object.freeze({
      x: storeFloat(add(multiply(groundNormal.x, CURSE_FLOAT_HEIGHT), position.x)),
      y: storeFloat(add(multiply(groundNormal.y, CURSE_FLOAT_HEIGHT), position.y)),
      z: storeFloat(add(multiply(groundNormal.z, CURSE_FLOAT_HEIGHT), position.z)),
    }),
    groundPosition: position,
    rotation: getRotationFromFrameAxes(arithmetic, {
      first: getStoredCrossProduct(arithmetic, groundNormal, routeNormal),
      third: groundNormal,
    }),
  })
}
