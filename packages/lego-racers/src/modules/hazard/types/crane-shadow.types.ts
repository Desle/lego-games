import type { Vector3 } from '../../simulation-math/index.ts'

// What a crane's shadow (0x00490330) is placed from: the world point of the crane's fourth bone, the first row of the
// crane's frame, and the squared camera distance below which the shadow is projected and drawn.
export type CraneShadow = {
  readonly bone: Vector3
  readonly upHint: Vector3
  readonly maximumSquaredDistance: number
}
