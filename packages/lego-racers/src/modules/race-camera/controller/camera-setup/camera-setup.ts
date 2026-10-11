import { getFloatFromBits, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import type { Quaternion } from '../../../simulation-math/index.ts'
import { CAMERA_PRESETS } from '../../types/camera-presets/camera-presets.ts'
import { CameraMode } from '../../types/camera-mode/camera-mode.ts'
import type { CameraRacerView, CameraState } from '../../types/race-camera.types.ts'
import { arithmetic, IDENTITY_BASIS } from '../camera-math/camera-math.ts'

const ZERO_QUATERNION: Quaternion = Object.freeze({ x: 0, y: 0, z: 0, w: 0 })
// 0x004b03ec: degrees to radians, 0x004b03e8: the divisor of the ease rates.
const RADIANS_PER_DEGREE = getFloatFromBits(0x3c8efa35)
const EASE_RATE_DIVISOR = 250
// The preset's blend 0.1 of a 4 ms step becomes the rate `(1 - blend) / (blend * 250)` (0x00427b70, 0x00427b90).
const getEaseRate = (blend: number): number =>
  arithmetic.storeFloat(
    arithmetic.divide(arithmetic.subtract(1, blend), arithmetic.multiply(blend, EASE_RATE_DIVISOR))
  )

const ZERO_FINISH_OFFSETS = Object.freeze({
  heightSine: 0,
  pitchSine: 0,
  pitchCosine: 0,
  distance: 0,
})

// 0x004283f0(camera, number, offsetFlag): selects a preset row. The mode byte goes through 0x004283d0, which
// restarts the mode's clock (+0xc8) when the mode changes; the finish camera keeps the difference between the old
// and the new row to ease away from; look-behind is released.
export const setCameraPreset = (
  camera: CameraState,
  cameraNumber: number,
  isOffsetRaised: boolean
): CameraState => {
  const rowNumber = isOffsetRaised && cameraNumber < 3 ? cameraNumber + 5 : cameraNumber
  const preset = CAMERA_PRESETS[rowNumber]
  if (preset === undefined) throw new RangeError(`No camera preset ${String(rowNumber)}`)
  const modeMilliseconds = camera.mode === preset.mode ? camera.modeMilliseconds : 0
  const pitchAngle = arithmetic.multiply(preset.pitchDegrees, RADIANS_PER_DEGREE)
  const heightAngle = arithmetic.multiply(preset.heightDegrees, RADIANS_PER_DEGREE)
  const pitchSine = arithmetic.storeFloat(arithmetic.getSine(arithmetic.storeFloat(pitchAngle)))
  const pitchCosine = arithmetic.storeFloat(arithmetic.getCosine(arithmetic.storeFloat(pitchAngle)))
  const heightSine = arithmetic.storeFloat(arithmetic.getSine(heightAngle))
  const oldValues = {
    heightSine: camera.heightSine,
    pitchSine: camera.pitchSine,
    pitchCosine: camera.pitchCosine,
    distance: camera.distance,
  }
  return Object.freeze({
    ...camera,
    mode: preset.mode,
    modeMilliseconds,
    isOffsetRaised,
    pitchSine,
    pitchCosine,
    heightSine,
    distance: preset.distance,
    positionRate: getEaseRate(preset.positionBlend),
    rotationRate: getEaseRate(preset.rotationBlend),
    finishOffsets:
      preset.mode === CameraMode.FINISH
        ? Object.freeze({
            heightSine: arithmetic.storeFloat(
              arithmetic.subtract(oldValues.heightSine, heightSine)
            ),
            pitchSine: arithmetic.storeFloat(arithmetic.subtract(oldValues.pitchSine, pitchSine)),
            pitchCosine: arithmetic.storeFloat(
              arithmetic.subtract(oldValues.pitchCosine, pitchCosine)
            ),
            distance: arithmetic.storeFloat(
              arithmetic.subtract(oldValues.distance, preset.distance)
            ),
          })
        : camera.finishOffsets,
    isLookingBehind: false,
  })
}

// 0x004281b0: no racer, the next update snaps, preset row 0, the three ease rates the constructor stores
// (0x3db851ec, 0x3b91a2b4, 0x3c888889).
export const createCamera = (): CameraState =>
  setCameraPreset(
    Object.freeze({
      isSnapRequested: true,
      isPreviousSnapRequested: false,
      mode: CameraMode.CHASE,
      isLookingBehind: false,
      isOffsetRaised: false,
      targetBasis: IDENTITY_BASIS,
      targetPosition: ZERO_VECTOR3,
      targetQuaternion: ZERO_QUATERNION,
      basis: IDENTITY_BASIS,
      position: ZERO_VECTOR3,
      quaternion: ZERO_QUATERNION,
      previousBasis: IDENTITY_BASIS,
      previousPosition: ZERO_VECTOR3,
      previousQuaternion: ZERO_QUATERNION,
      modeMilliseconds: 0,
      stepMilliseconds: 0,
      isAttached: false,
      heading: ZERO_VECTOR3,
      lookAtPoint: ZERO_VECTOR3,
      steeringAngle: 0,
      positionRate: 0,
      rotationRate: 0,
      lookAtRate: getFloatFromBits(0x3db851ec),
      steeringRate: getFloatFromBits(0x3b91a2b4),
      headingRate: getFloatFromBits(0x3c888889),
      heightSine: 0,
      pitchSine: 0,
      pitchCosine: 0,
      distance: 0,
      isFullThrottle: false,
      distanceFactor: 0,
      finishOffsets: ZERO_FINISH_OFFSETS,
    }),
    0,
    false
  )

// 0x00428230: attaching to a racer copies its position and heading, remembers whether it is at full throttle
// (driver flag 0x1) and starts the distance factor at 1.0. Attaching the same racer again does nothing.
export const attachCamera = (camera: CameraState, racer: CameraRacerView): CameraState =>
  camera.isAttached
    ? camera
    : Object.freeze({
        ...camera,
        isAttached: true,
        lookAtPoint: racer.position,
        isFullThrottle: racer.isFullThrottle,
        distanceFactor: 1,
        heading: Object.freeze({
          x: racer.rotation[0],
          y: racer.rotation[1],
          z: racer.rotation[2],
        }),
      })

// 0x0043a3f0 and 0x0043a400: binding 8 sets and clears camera +0x04.
export const setCameraLookingBehind = (
  camera: CameraState,
  isLookingBehind: boolean
): CameraState => Object.freeze({ ...camera, isLookingBehind })

// Asks the next update to snap (the byte at camera +0x00 that 0x0043a300, 0x0043a360 and 0x0043a390 set to 1).
export const requestCameraSnap = (camera: CameraState): CameraState =>
  Object.freeze({ ...camera, isSnapRequested: true })
