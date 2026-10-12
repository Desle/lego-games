import { drawRandomValue } from '../../../random-table/index.ts'
import type { RandomTable, RandomTablePosition } from '../../../random-table/index.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type {
  CameraFovEffect,
  CameraFovStep,
} from '../../types/camera-fov-effect/camera-fov-effect.types.ts'

// The camera's field of view at the start (the camera frame's +8, 65).
export const INITIAL_FOV = 65
// 0x0045d560 gives the camera this many degrees more than the effect's base while the warp starts (0x004b1a6c).
const WARP_STARTING_FOV_BOOST = 30
// 0x004b0314 and 0x004b0318: the swing keeps the view between these.
const UPPER_FOV = 80
const LOWER_FOV = 40
const SWING_MILLISECONDS = 500
const SWING_SCALE = 0.5 // 0x004af58c
const CYCLE_RATE = getFloatFromBits(0x3ca3d70a) // 0x004b031c, 0.02
const CYCLE_SCALE = getFloatFromBits(0x3dcccccd) // 0x004b0320, 0.1
const PI = getFloatFromBits(0x40490fdb) // 0x004b03f0
// Racer flags at +0xd04: 0x10 off the track, 0x800 a timed effect runs.
const RACER_OFF_TRACK_FLAG = 0x10
const RACER_TIMED_EFFECT_FLAG = 0x800

export const createCameraFovEffect = (): CameraFovEffect =>
  Object.freeze({
    baseFov: INITIAL_FOV,
    swingStartFov: INITIAL_FOV,
    swing: 0,
    timerMilliseconds: 0,
    fov: INITIAL_FOV,
  })

// 0x00427e80 (thiscall on the camera: the racer and the step in milliseconds). The timer counts down; when it is out
// and the racer is on the track the next swing is chosen: with a timed effect a random share of the distance to a
// limit (`value % trunc(fov - 40)` half-degrees up while the view is not swinging up and above 40, or at 80 and more,
// else `value % trunc(80 - fov)` down), without one back to the base; the view then follows the swing's cosine.
export const stepCameraFovEffect = (
  arithmetic: FloatArithmetic,
  table: RandomTable,
  position: RandomTablePosition,
  effect: CameraFovEffect,
  racerFlags: number,
  stepMilliseconds: number
): CameraFovStep => {
  const { add, subtract, multiply, storeFloat, getIsBelow } = arithmetic
  let timer =
    stepMilliseconds <= effect.timerMilliseconds ? effect.timerMilliseconds - stepMilliseconds : 0
  let { swing, swingStartFov } = effect
  let nextPosition = position
  if ((racerFlags & RACER_OFF_TRACK_FLAG) !== 0) {
    timer = 0
  } else if (timer === 0) {
    timer = SWING_MILLISECONDS
    swingStartFov = effect.fov
    if ((racerFlags & RACER_TIMED_EFFECT_FLAG) !== 0) {
      const isUp =
        (!getIsBelow(0, swing) && getIsBelow(LOWER_FOV, swingStartFov)) ||
        !getIsBelow(swingStartFov, UPPER_FOV)
      const draw = drawRandomValue(table, nextPosition)
      nextPosition = draw.position
      const range = Math.trunc(
        isUp ? subtract(swingStartFov, LOWER_FOV) : subtract(UPPER_FOV, swingStartFov)
      )
      const amount = storeFloat(multiply(draw.value % range, SWING_SCALE))
      swing = isUp ? amount : -amount
    } else if (effect.fov !== effect.baseFov) {
      swing = storeFloat(multiply(subtract(swingStartFov, effect.baseFov), SWING_SCALE))
    } else {
      swing = 0
      timer = 0
    }
  }
  if (timer === 0) {
    return Object.freeze({
      effect: Object.freeze({
        ...effect,
        swing,
        swingStartFov,
        timerMilliseconds: 0,
        fov: effect.baseFov,
      }),
      position: nextPosition,
    })
  }
  const cycle = multiply(
    multiply(multiply(SWING_MILLISECONDS - timer, CYCLE_RATE), CYCLE_SCALE),
    PI
  )
  const fov = storeFloat(
    add(subtract(swingStartFov, swing), multiply(arithmetic.getCosine(cycle), swing))
  )
  return Object.freeze({
    effect: Object.freeze({ ...effect, swing, swingStartFov, timerMilliseconds: timer, fov }),
    position: nextPosition,
  })
}

// The warp's writes to the camera (+0x134 and the frame's +8): 0x0045d560 raises the base the view eases to while the
// warp starts (the effect's base, the initial field of view, plus 30), 0x0045dc90 (the end of the start) and the end of
// every draw 0x0045d940 put the view and the base back to the effect's base.
export const getCameraFovEffectWithWarp = (
  effect: CameraFovEffect,
  isWarpStarting: boolean,
  isWarpCarrying: boolean
): CameraFovEffect => {
  if (isWarpStarting)
    return Object.freeze({ ...effect, baseFov: INITIAL_FOV + WARP_STARTING_FOV_BOOST })
  if (isWarpCarrying) return Object.freeze({ ...effect, baseFov: INITIAL_FOV, fov: INITIAL_FOV })
  return effect
}
