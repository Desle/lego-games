export {
  CAMERA_PRESETS,
  FINISH_CAMERA_NUMBER,
  PLAYER_CAMERA_COUNT,
} from './types/camera-presets/camera-presets.ts'
export {
  attachCamera,
  createCamera,
  placeCameraAtIntroductionPoint,
  placeCameraAtView,
  requestCameraSnap,
  setCameraLookingBehind,
  setCameraPreset,
} from './controller/camera-setup/camera-setup.ts'
export { getCameraView, updateCamera } from './controller/camera-update/camera-update.ts'
export { getCameraRacerView } from './controller/get-camera-racer-view/get-camera-racer-view.ts'
export { CameraMode } from './types/camera-mode/camera-mode.ts'
export type {
  CameraFinishOffsets,
  CameraNodeOrientation,
  CameraMode as CameraModeValue,
  CameraPreset,
  CameraRacerView,
  CameraState,
  CameraUpdate,
  CameraView,
} from './types/race-camera.types.ts'
