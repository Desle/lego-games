import type { Matrix3, Vector3 } from '../../../simulation-math/index.ts'

// What an effect's smoke follows: the racer that used it (its display frame and its car body's velocity).
export type EffectEmitterOwner = {
  readonly position: Vector3
  readonly rotation: Matrix3
  readonly velocity: Vector3
}
