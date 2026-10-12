import {
  getFloatFromBits,
  getRotationFromFrameAxes,
  getTruncatedInteger,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type { BarrelSpin } from './barrel-spin.types.ts'

// 0x004b1444: the spin grows by this per millisecond.
const SPIN_PER_MILLISECOND = getFloatFromBits(0x3c449ba6)
// 0x004b0b48 and 0x004b02f4: 1024 / 2pi, the angle as a table index, forwards and backwards.
const TABLE_INDEX_PER_RADIAN = getFloatFromBits(0x4322f983)
const TABLE_INDEX_PER_RADIAN_BACKWARDS = getFloatFromBits(0xc322f983)
const TABLE_MASK = 0x3ff
const TABLE_QUARTER_TURN = 0x100

export const NO_BARREL_SPIN: BarrelSpin = Object.freeze({ angle: 0, rotation: IDENTITY_MATRIX3 })

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
    rotation: getRotationFromFrameAxes(arithmetic, {
      first: { x: -sine, y: 0, z: cosine },
      third: { x: cosine, y: 0, z: sine },
    }),
  })
}
