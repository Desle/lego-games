import type { Vector3 } from '../../../simulation-math/index.ts'

export type DrivingPose = {
  readonly position: Vector3
  readonly forward: Vector3
}
