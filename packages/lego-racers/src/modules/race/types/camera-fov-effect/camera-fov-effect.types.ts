import type { RandomTablePosition } from '../../../random-table/index.ts'

// The field-of-view effect of a local player's camera (Camera_Update 0x00428540 calls 0x00427e80 every update). While the
// racer's timed effect runs (flag 0x800) the view swings by a random amount every 500 ms.
export type CameraFovEffect = {
  // Camera +0x134: the field of view the camera comes back to.
  readonly baseFov: number
  // Camera +0x138: the field of view when the current swing began.
  readonly swingStartFov: number
  // Camera +0x13c: the amount the current swing moves it.
  readonly swing: number
  // Camera +0x140: milliseconds left of the swing.
  readonly timerMilliseconds: number
  // The camera frame's +8: the field of view the camera shows.
  readonly fov: number
}

export type CameraFovStep = {
  readonly effect: CameraFovEffect
  readonly position: RandomTablePosition
}
