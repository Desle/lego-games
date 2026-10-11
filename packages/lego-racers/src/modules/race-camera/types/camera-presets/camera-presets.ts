import { CameraMode } from '../camera-mode/camera-mode.ts'
import type { CameraPreset } from '../race-camera.types.ts'

const createPreset = (
  mode: CameraPreset['mode'],
  pitchDegrees: number,
  heightDegrees: number,
  distance: number,
  positionBlend: number,
  rotationBlend: number
): CameraPreset =>
  Object.freeze({ mode, pitchDegrees, heightDegrees, distance, positionBlend, rotationBlend })

// The table at 0x004b0328, eight rows of 0x18 bytes (mode, then five float32). 0x004283f0 indexes it with the
// racer's camera number 0..3 (racer +0xdb8, cycled by binding 5 in 0x0043a390), or with 5..7 when its second
// argument (racer flag 0x400000) is set and the number is below 3; 0x004281b0 starts at row 0.
export const CAMERA_PRESETS: readonly CameraPreset[] = Object.freeze([
  createPreset(CameraMode.CHASE, 5, 35, 20, Math.fround(0.1), 0.25),
  createPreset(CameraMode.CHASE, 8, 25, 30, Math.fround(0.1), 0.25),
  createPreset(CameraMode.CHASE, 8, 45, 10, Math.fround(0.05), 0.25),
  createPreset(CameraMode.COCKPIT, 0, 0, 0, Math.fround(0.1), 0.25),
  createPreset(CameraMode.FINISH, 20, 15, 32, Math.fround(0.18), Math.fround(0.35)),
  createPreset(CameraMode.CHASE, 8, 20, 22, Math.fround(0.1), 0.25),
  createPreset(CameraMode.CHASE, 7, 15, 45, Math.fround(0.1), 0.25),
  createPreset(CameraMode.CHASE, 4, 30, 15, Math.fround(0.05), 0.25),
])

// The camera numbers the player cycles through: 0x0043a390 keeps `(number + 1) & 3`.
export const PLAYER_CAMERA_COUNT = 4

// The finish camera (preset row 4) that Race_UpdateState3 and 4 select when a player finishes.
export const FINISH_CAMERA_NUMBER = 4
