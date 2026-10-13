import type { Matrix3, Vector3 } from '../../../simulation-math/index.ts'

// Where a curse's three figures stand once it has landed (0x00452ae0): the floating `curse` 13 above the ground point
// along the triangle's normal, the two rings on the ground point itself, all with one rotation.
export type CurseTrackFrame = {
  readonly floatingPosition: Vector3
  readonly groundPosition: Vector3
  readonly rotation: Matrix3
}
