import type { Matrix3 } from '../../../simulation-math/index.ts'

// What 0x00452ff0 leaves of a barrel after a step: the spin angle (effect +0x178) and its model frame's rotation.
export type BarrelSpin = {
  readonly angle: number
  // The table cosine and sine the model frame's axes were made of (0x00452ff0 places the sparks with them too).
  readonly cosine: number
  readonly sine: number
  readonly rotation: Matrix3
}
