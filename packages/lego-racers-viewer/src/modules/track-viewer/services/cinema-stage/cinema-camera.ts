import {
  getCinemaActionMilliseconds,
  getCinemaFrame,
  getIsOnTimeline,
} from '@lego-games/lego-racers/cinema'
import type { Cinema, CinemaAction } from '@lego-games/lego-racers/cinema'
import type { WorldCamera } from '@lego-games/lego-racers/front-end'
import type { CameraVector } from './cinema-camera.types.ts'
import type { Scene } from '@lego-games/lego-racers/scene'
import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
  getBoneMatrices,
  getRestPose,
  getSkeletonPose,
} from '@lego-games/lego-racers/skeletal-animation'

const MATRIX_SIZE = 16

// A point or a direction through a row-vector frame: the rows of the frame are the images of the axes, the last row is the place.
const getTransformed = (
  vector: CameraVector,
  frame: readonly number[],
  isPoint: boolean
): CameraVector => [
  vector[0] * (frame[0] ?? 0) +
    vector[1] * (frame[4] ?? 0) +
    vector[2] * (frame[8] ?? 0) +
    (isPoint ? (frame[12] ?? 0) : 0),
  vector[0] * (frame[1] ?? 0) +
    vector[1] * (frame[5] ?? 0) +
    vector[2] * (frame[9] ?? 0) +
    (isPoint ? (frame[13] ?? 0) : 0),
  vector[0] * (frame[2] ?? 0) +
    vector[1] * (frame[6] ?? 0) +
    vector[2] * (frame[10] ?? 0) +
    (isPoint ? (frame[14] ?? 0) : 0),
]

// The frame an action puts its instance in: forward, up x forward, up, and the place.
const getActionFrame = (action: CinemaAction): readonly number[] => {
  const [forwardX, forwardY, forwardZ] = action.forward
  const [upX, upY, upZ] = action.up
  const side = [
    upY * forwardZ - upZ * forwardY,
    upZ * forwardX - upX * forwardZ,
    upX * forwardY - upY * forwardX,
  ]
  return [
    forwardX,
    forwardY,
    forwardZ,
    0,
    side[0] ?? 0,
    side[1] ?? 0,
    side[2] ?? 0,
    0,
    upX,
    upY,
    upZ,
    0,
    action.position[0],
    action.position[1],
    action.position[2],
    1,
  ]
}

// The camera a cinema is seen from: the cinema's object that is on the timeline names a world camera (`Camera01`); when the world
// has a skeleton instance of that name that an action animates (`CAMERA01.ADB`), the camera is carried by its last bone
// (measured: the bone's place is the eye the original draws from; a dummy with a pivot has the camera on its second bone), then by the action's frame. The animation runs from the
// start of the action.
export const getCinemaCamera = (
  scene: Scene,
  cinema: Cinema | null,
  milliseconds: number
): WorldCamera | null => {
  if (cinema === null) return scene.cameras[0] ?? null
  const frame = getCinemaFrame(cinema, milliseconds)
  const object =
    cinema.objects.find((candidate) => getIsOnTimeline(candidate, frame)) ?? cinema.objects.at(-1)
  const targetName = object?.target.toLowerCase()
  const camera =
    scene.cameras.find((candidate) => candidate.name.toLowerCase() === targetName) ??
    scene.cameras[0]
  if (camera === undefined) return null
  const action = cinema.actions.find(
    (candidate) =>
      candidate.instanceName.toLowerCase() === targetName && getIsOnTimeline(candidate, frame)
  )
  const instance = scene.instances.find((candidate) => candidate.name.toLowerCase() === targetName)
  const level = instance?.levels[0]
  const skeleton = scene.skeletons[level?.skeletonIndex ?? -1]?.skeleton
  const animation = scene.animations[level?.animationIndex ?? -1]?.animation
  if (action === undefined || skeleton === undefined || animation === undefined) return camera
  const matrices = getBoneMatrices(
    skeleton,
    getSkeletonPose(
      getRestPose(skeleton),
      animation,
      advanceSkeletonAnimation(
        createSkeletonAnimationState(animation, action.flag),
        animation,
        getCinemaActionMilliseconds(cinema, action, milliseconds)
      )
    )
  )
  const boneCount = matrices.length / MATRIX_SIZE
  const bone = Array.from(matrices.slice((boneCount - 1) * MATRIX_SIZE, boneCount * MATRIX_SIZE))
  const frameMatrix = getActionFrame(action)
  const place = (vector: CameraVector, isPoint: boolean): CameraVector =>
    getTransformed(getTransformed(vector, bone, isPoint), frameMatrix, isPoint)
  const [x, y, z] = place([camera.position.x, camera.position.y, camera.position.z], true)
  const [forwardX, forwardY, forwardZ] = place(
    [camera.forward.x, camera.forward.y, camera.forward.z],
    false
  )
  const [upX, upY, upZ] = place([camera.up.x, camera.up.y, camera.up.z], false)
  return {
    ...camera,
    position: { x, y, z },
    forward: { x: forwardX, y: forwardY, z: forwardZ },
    up: { x: upX, y: upY, z: upZ },
  }
}
