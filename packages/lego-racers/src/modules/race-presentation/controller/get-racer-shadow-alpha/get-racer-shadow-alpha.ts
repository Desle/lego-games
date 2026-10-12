import {
  createFloatArithmetic,
  getFloatFromBits,
  getTruncatedInteger,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { RacerShadow } from '../../types/race-presentation.types.ts'

const { add, subtract, multiply, divide, storeFloat, getIsBelow, getIsBelowOrEqual } =
  createFloatArithmetic(RACE_FPU_PRECISION)

// 0x004b0b38 and 0x004b0b3c: the squared distances (50 and 100) where the shadow starts to fade and where it ends.
const FADE_START = getFloatFromBits(0x451c4000)
const FADE_END = getFloatFromBits(0x461c4000)
// 0x004b0b4c: the alpha the fade takes away over its whole length; 0xbf is the full alpha.
const FADE_ALPHA = getFloatFromBits(0x433f0000)
const FULL_ALPHA = 0xbf

// 0x0043fc20: the alpha the shadow is drawn with for a camera at `eye`, or null for no draw: full up to 50 units from the
// shadow, fading to nothing at 100.
export const getRacerShadowAlpha = (shadow: RacerShadow, eye: Vector3): number | null => {
  const { position } = shadow.placement
  const x = subtract(eye.x, position.x)
  const y = subtract(eye.y, position.y)
  const z = subtract(eye.z, position.z)
  const squaredDistance = storeFloat(add(add(multiply(z, z), multiply(y, y)), multiply(x, x)))
  if (getIsBelowOrEqual(squaredDistance, FADE_START)) return FULL_ALPHA
  if (!getIsBelow(squaredDistance, FADE_END)) return null
  const fraction = divide(subtract(squaredDistance, FADE_START), subtract(FADE_END, FADE_START))
  const alpha = FULL_ALPHA - getTruncatedInteger(multiply(fraction, FADE_ALPHA))
  return alpha === 0 ? null : alpha
}
