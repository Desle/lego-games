import type { GrappleHook } from '../../../projectiles/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'

// What the rope is laid from: the owner's position when the hook updated and the hook.
export type TetherFeed = {
  readonly owner: Vector3
  readonly hook: GrappleHook
}
