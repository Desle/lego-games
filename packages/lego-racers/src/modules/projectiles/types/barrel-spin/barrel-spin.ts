import {
  getFloatFromBits,
  getRotationFromFrameAxes,
  getTruncatedInteger,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { BarrelSpin } from './barrel-spin.types.ts'

// float32 -0.7279 at 0x004b1474: where the barrel's sparks sit against the frame position
const SPARKS_X_FACTOR = getFloatFromBits(0xbf3a495e)
// float32 0.1555 at 0x004b1470
const SPARKS_Y_FACTOR = getFloatFromBits(0x3e1f7fd0)
// float32 5.178 at 0x004b146c
const SPARKS_Z_FACTOR = getFloatFromBits(0x40a5b676)
// float32 0.7279 at 0x004b1478: the launch's x offset
const LAUNCH_SPARKS_X_OFFSET = getFloatFromBits(0x3f3a495e)

// 0x004b1444: the spin grows by this per millisecond.
const SPIN_PER_MILLISECOND = getFloatFromBits(0x3c449ba6)
// 0x004b0b48 and 0x004b02f4: 1024 / 2pi, the angle as a table index, forwards and backwards.
const TABLE_INDEX_PER_RADIAN = getFloatFromBits(0x4322f983)
const TABLE_INDEX_PER_RADIAN_BACKWARDS = getFloatFromBits(0xc322f983)
const TABLE_MASK = 0x3ff
const TABLE_QUARTER_TURN = 0x100

export const NO_BARREL_SPIN: BarrelSpin = Object.freeze({
  angle: 0,
  cosine: 0,
  sine: 0,
  rotation: IDENTITY_MATRIX3,
})

// 0x00452ff0 after the flight: the spin grows with the step, and the model turns about y: its first axis is
// (-sine, 0, cosine) and its third (cosine, 0, sine), the sine and cosine read from the table at 0x004bf7ec.
export const getBarrelSpun = (
  arithmetic: FloatArithmetic,
  getTableCosine: (index: number) => number,
  spin: BarrelSpin,
  milliseconds: number
): BarrelSpin => {
  const { add, multiply, storeFloat } = arithmetic
  const angle = storeFloat(add(multiply(milliseconds, SPIN_PER_MILLISECOND), spin.angle))
  const backwardsIndex = getTruncatedInteger(multiply(angle, TABLE_INDEX_PER_RADIAN_BACKWARDS))
  const cosine = getTableCosine((-TABLE_QUARTER_TURN - backwardsIndex) & TABLE_MASK)
  const forwardsIndex = getTruncatedInteger(multiply(angle, TABLE_INDEX_PER_RADIAN))
  const sine = getTableCosine(forwardsIndex & TABLE_MASK)
  return Object.freeze({
    angle,
    cosine,
    sine,
    rotation: getRotationFromFrameAxes(arithmetic, {
      first: { x: -sine, y: 0, z: cosine },
      third: { x: cosine, y: 0, z: sine },
    }),
  })
}

// 0x00452ff0: the sparks follow the frame position read before the flight advanced, moved along the model's third axis
// (cosine, 0, sine) by the three factors.
export const getBarrelSparksPosition = (
  arithmetic: FloatArithmetic,
  framePosition: Vector3,
  spin: BarrelSpin
): Vector3 => {
  const { add, multiply, storeFloat } = arithmetic
  return Object.freeze({
    x: storeFloat(add(multiply(spin.cosine, SPARKS_X_FACTOR), framePosition.x)),
    y: storeFloat(add(multiply(0, SPARKS_Y_FACTOR), framePosition.y)),
    z: storeFloat(add(multiply(spin.sine, SPARKS_Z_FACTOR), framePosition.z)),
  })
}

// 0x00453240: the sparks start at the frame position the barrel had before it launched, moved by the factors'
// magnitudes (x down, y and z up).
export const getBarrelLaunchSparksPosition = (
  arithmetic: FloatArithmetic,
  framePosition: Vector3
): Vector3 => {
  const { add, subtract, storeFloat } = arithmetic
  return Object.freeze({
    x: storeFloat(subtract(framePosition.x, LAUNCH_SPARKS_X_OFFSET)),
    y: storeFloat(add(framePosition.y, SPARKS_Y_FACTOR)),
    z: storeFloat(add(framePosition.z, SPARKS_Z_FACTOR)),
  })
}
