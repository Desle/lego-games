import type { CameraView } from '../../../race-camera/index.ts'
import type { RaceState } from '../../../race/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import {
  findCameraIndex,
  findSkeletonInstanceIndex,
  getSkeletonInstanceCameraView,
} from '../../../world-animation/index.ts'

const getMirroredVector = (vector: Vector3): Vector3 =>
  Object.freeze({ x: vector.x, y: -vector.y, z: vector.z })

// A mirrored race's loaders negate y in the skeleton data, which turns the bone chain's position and both vectors over y.
const getMirroredView = (view: CameraView): CameraView =>
  Object.freeze({
    position: getMirroredVector(view.position),
    forward: getMirroredVector(view.forward),
    up: getMirroredVector(view.up),
  })

// Camera_Update 0x00428540 while the camera object holds the introduction camera's lock (+0x28, set by 0x00434340,
// released by Race_UpdateState1 0x004349a0): it only runs the lock, 0x004047b0, which puts the camera on the locked
// bone, and leaves the chase state as it was. Null without a lock.
export const getIntroductionCameraView = (raceState: RaceState): CameraView | null => {
  const { introductionCameraObject } = raceState
  if (introductionCameraObject === null) return null
  const world = raceState.trackLogic.worlds.track
  const camera = world.cameras[findCameraIndex(world, introductionCameraObject)]
  const instance =
    world.skeletonInstances[findSkeletonInstanceIndex(world, introductionCameraObject)]
  if (camera === undefined || instance === undefined) return null
  const view = getSkeletonInstanceCameraView(
    raceState.context.arithmetic,
    instance,
    camera.boneIndex
  )
  return view === null || !raceState.isMirrored ? view : getMirroredView(view)
}
