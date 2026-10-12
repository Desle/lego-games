import type { CameraView } from '../../../race-camera/index.ts'
import type { RaceState } from '../../../race/index.ts'
import {
  findCameraIndex,
  findSkeletonInstanceIndex,
  getSkeletonInstanceCameraView,
} from '../../../world-animation/index.ts'

// World_Mirror 0x00416140 negates y of every instance's axes; the camera's vectors follow (hypothesis, fitted to the pixels).
const getMirroredAxes = (view: CameraView): CameraView =>
  Object.freeze({
    ...view,
    forward: Object.freeze({ ...view.forward, y: -view.forward.y }),
    up: Object.freeze({ ...view.up, y: -view.up.y }),
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
  return view === null || !raceState.isMirrored ? view : getMirroredAxes(view)
}
