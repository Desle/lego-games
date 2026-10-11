import { EffectState, PowerUpEffectKind } from '../../../power-ups/index.ts'
import {
  getCameraRacerView,
  getCameraView,
  requestCameraSnap,
  updateCamera,
} from '../../../race-camera/index.ts'
import type { CameraState } from '../../../race-camera/index.ts'
import type { RaceState } from '../../../race/index.ts'
import {
  getFrameTransformedPoint,
  getRotationFromFrameAxes,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { getFigureAnimationState } from '../get-figure-animation-state/get-figure-animation-state.ts'
import type { RacerPose, WarpView } from '../../types/race-presentation.types.ts'

// 0x0045d940: the warp draws the tunnel and the car with the car's figure at the origin, facing -y with z up.
const FIGURE_FIRST_AXIS: Vector3 = Object.freeze({ x: 0, y: -1, z: 0 })
const FIGURE_THIRD_AXIS: Vector3 = Object.freeze({ x: 0, y: 0, z: 1 })
// 0x0045dc90 gives the warp 1500 ms in state 3; the tunnel's clock is the time spent in it (0x5dc - timer).
const WARP_TRAVEL_MILLISECONDS = 1500
// The camera follows the car as after a snap; one millisecond is a step the follow modes never read as a pause.
const SNAP_STEP_MILLISECONDS = 1

// What the player's warp draws (0x0045d940, vtable 0x004b1a94, run by the draw of the power-up system for the camera of
// the warping racer): the tunnel world of TURBO3.WDB (`dbricks` and `dtube`) animated for the time spent in the warp,
// and the car at the world's origin; the track is not drawn. Null while the racer is not carried (state 3).
export const getWarpView = (
  raceState: RaceState,
  camera: CameraState,
  racerIndex: number,
  turboLevel: number
): WarpView | null => {
  const { effects, activeEffectIds } = raceState.powerUpStep.world.effects
  const effect = activeEffectIds
    .map((effectId) => effects[effectId])
    .find(
      (candidate) =>
        candidate?.kind === PowerUpEffectKind.WARP &&
        candidate.state === EffectState.ACTIVE &&
        candidate.ownerRacer === racerIndex
    )
  const racer = raceState.racerSet.racers[racerIndex]
  if (effect === undefined || racer === undefined) return null
  const { arithmetic } = raceState.context
  const rotation = getRotationFromFrameAxes(arithmetic, {
    first: FIGURE_FIRST_AXIS,
    third: FIGURE_THIRD_AXIS,
  })
  // 0x0043e620: the car model takes the figure's frame and the driver sits at the seat carried by it.
  const driverPosition = getFrameTransformedPoint(
    arithmetic,
    { rotation, position: ZERO_VECTOR3 },
    racer.vehicle.seatPoint
  )
  const pose: RacerPose = Object.freeze({
    racerIndex,
    position: ZERO_VECTOR3,
    rotation,
    isPlayer: true,
    bodyRotation: rotation,
    driverPosition,
    wheelAnimation: getFigureAnimationState(racer.figure),
    driverAnimation: getFigureAnimationState(racer.vehicle.driverFigure),
    colourShift: racer.colourShift,
  })
  const racerView = Object.freeze({
    ...getCameraRacerView(racer, turboLevel),
    position: ZERO_VECTOR3,
    rotation,
  })
  return Object.freeze({
    tunnelMilliseconds: WARP_TRAVEL_MILLISECONDS - effect.timerMilliseconds,
    pose,
    cameraView: getCameraView(
      updateCamera(requestCameraSnap(camera), racerView, SNAP_STEP_MILLISECONDS).camera
    ),
  })
}
