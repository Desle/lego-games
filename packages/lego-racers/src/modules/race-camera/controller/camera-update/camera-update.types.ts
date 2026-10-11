import type { Vector3 } from '../../../simulation-math/index.ts'
import type { CameraState } from '../../types/race-camera.types.ts'

// The heading a chase update works out and the camera with its steering angle updated.
export type ChaseHeading = {
  readonly camera: CameraState
  readonly x: number
  readonly y: number
  readonly z: number
}

export type DistanceEasing = {
  readonly camera: CameraState
  readonly distance: number
}

// The direction the eye looks along (pitch down), the follow distance and the height sine the eye is raised by.
export type ChaseLook = {
  readonly distance: number
  readonly heightSine: number
  readonly look: Vector3
}
