import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { Matrix3, Quaternion, Vector3 } from '../../simulation-math/index.ts'
import type { CameraMode as CameraModeValues } from './camera-mode/camera-mode.ts'

export type CameraMode = EnumValues<typeof CameraModeValues>

// One row of the preset table at 0x004b0328 (stride 0x18) as 0x004283f0 reads it.
export type CameraPreset = {
  // +0x00: the mode byte 0x004283d0 stores into camera +0x02.
  readonly mode: CameraMode
  // +0x04: pitch of the view direction in degrees (0x00427bb0).
  readonly pitchDegrees: number
  // +0x08: height angle in degrees (0x00427be0).
  readonly heightDegrees: number
  // +0x0c: follow distance (camera +0x118).
  readonly distance: number
  // +0x10, +0x14: how much of the way the position and the orientation move per 4 ms (0x00427b70, 0x00427b90).
  readonly positionBlend: number
  readonly rotationBlend: number
}

// Camera +0x124..+0x130: what the finish camera (mode 3) eases away from, old preset minus new preset.
export type CameraFinishOffsets = {
  readonly heightSine: number
  readonly pitchSine: number
  readonly pitchCosine: number
  readonly distance: number
}

// The camera object (stride 0x150, race +0x2ad4; constructor 0x004281b0), with the offset of each field.
export type CameraState = {
  // +0x00 bit 0: the next update snaps to the target instead of easing; +0x01 bit 0: the previous update's copy.
  readonly isSnapRequested: boolean
  readonly isPreviousSnapRequested: boolean
  // +0x02.
  readonly mode: CameraMode
  // +0x04: held look-behind binding (0x0043a3f0 and 0x0043a400).
  readonly isLookingBehind: boolean
  // +0x05: the second argument of 0x004283f0 (racer flag 0x400000).
  readonly isOffsetRaised: boolean
  // +0x08..+0x2b: the target basis, rows right, down and forward; +0x2c: the eye the target gives.
  readonly targetBasis: Matrix3
  readonly targetPosition: Vector3
  // +0x38: the target basis as a quaternion.
  readonly targetQuaternion: Quaternion
  // +0x48..+0x6b: the eased basis; +0x6c: the eased eye; +0x78: the eased quaternion.
  readonly basis: Matrix3
  readonly position: Vector3
  readonly quaternion: Quaternion
  // +0x88..+0xab, +0xac, +0xb8: the previous frame's basis, eye and quaternion (copied at the start of an update).
  readonly previousBasis: Matrix3
  readonly previousPosition: Vector3
  readonly previousQuaternion: Quaternion
  // +0xc8: milliseconds spent in the mode (the finish camera eases for 2,000); +0xcc: the step as a float.
  readonly modeMilliseconds: number
  readonly stepMilliseconds: number
  // +0xd4: the camera follows a racer.
  readonly isAttached: boolean
  // +0xd8: the eased heading; +0xe4: the eased point the camera looks at (the racer's position, eased).
  readonly heading: Vector3
  readonly lookAtPoint: Vector3
  // +0xf4: the steering angle the heading is rotated by.
  readonly steeringAngle: number
  // +0xf8, +0xfc: ease rates of the eye and of the orientation (set by the preset).
  readonly positionRate: number
  readonly rotationRate: number
  // +0x100, +0x104, +0x108: ease rates of the look-at point, of the steering angle and of the heading.
  readonly lookAtRate: number
  readonly steeringRate: number
  readonly headingRate: number
  // +0x10c: sine of the height angle; +0x110, +0x114: sine and cosine of the pitch; +0x118: the follow distance.
  readonly heightSine: number
  readonly pitchSine: number
  readonly pitchCosine: number
  readonly distance: number
  // +0x11c: the racer's driver flag 0x1 (full throttle) last update; +0x120: the distance factor easing back to 1.
  readonly isFullThrottle: boolean
  readonly distanceFactor: number
  // +0x124..+0x130.
  readonly finishOffsets: CameraFinishOffsets
}

// What the camera reads from its racer each update (racer +0x5c frame, car body +0x6c0, +0x618, +0x64c, the
// driver's flags at racer +0xc84 and the turbo level at +0xd68).
export type CameraRacerView = {
  readonly position: Vector3
  // The display frame's rotation: row 0 forward, row 2 up.
  readonly rotation: Matrix3
  // Car body +0x64c.
  readonly turnRadius: number
  // Car body +0x618.
  readonly forwardSpeed: number
  // Car body +0x6c0 bit 0x2.
  readonly isBodyFlagTwoSet: boolean
  // Driver +0x14 bit 0x1.
  readonly isFullThrottle: boolean
  // Racer +0xd68, the turbo level.
  readonly turboLevel: number
}

// What 0x00427d30 hands the camera object: its position and the two arguments of its orientation slot (+0x24),
// forward then up as the engine passes them (its camera frames take a negated up, see the world's cameras).
export type CameraView = {
  readonly position: Vector3
  readonly forward: Vector3
  readonly up: Vector3
}

export type CameraUpdate = {
  readonly camera: CameraState
  readonly view: CameraView
}

// What the camera node stores of an orientation (GolDP.dll 0x10002a30) and hands back (0x100029d0): forward normalized and up
// made orthogonal to it and normalized.
export type CameraNodeOrientation = {
  readonly forward: Vector3
  readonly up: Vector3
}
