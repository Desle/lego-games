import type { BspPlane } from '@lego-games/lego-racers/bsp-tree'
import type { CameraView } from '@lego-games/lego-racers/race-camera'
import type { EmitterPool } from '@lego-games/lego-racers/emitter'
import type { WorldAnimation } from '@lego-games/lego-racers/world-animation'
import type { SceneObject } from '../scene-object/scene-object.types.ts'
import type { ScreenFadeOverlay } from '../screen-fade-overlay/screen-fade-overlay.types.ts'
import type { ModelObject } from '../model-object/model-object.types.ts'
import type { PerspectiveCamera, Scene as ThreeScene } from 'three'
import type {
  EffectViews,
  GhostCar,
  RacerPose,
  ScreenFadeView,
  WarpView,
} from '@lego-games/lego-racers/race-presentation'

// The WebGL view of a race: the track, sky and backdrop, a car and a driver per racer, and the player's camera.
export type RaceViewport = {
  // Puts every racer at its pose and the camera where the chase camera says.
  readonly update: (
    poses: readonly RacerPose[],
    cameraView: CameraView,
    effects: EffectViews,
    warpView?: WarpView | null,
    ghostCars?: readonly GhostCar[],
    screenFades?: readonly ScreenFadeView[],
    fieldOfViewDegrees?: number
  ) => void
  // Shows the simulation's hazards and emitters: the track world's skeleton instances take the clip states the
  // simulation advanced, and the emitter pools' particles are drawn as points.
  readonly showHazards: (trackWorld: WorldAnimation, pools: readonly (EmitterPool | null)[]) => void
  // Advances the backdrop and the sky by whole milliseconds (the track's instances follow the simulation).
  readonly animate: (deltaMilliseconds: number) => void
  readonly render: () => void
  readonly dispose: () => void
}

// The size the race is drawn at; the HUD is laid out for the same size.
export type RaceStageSize = {
  readonly width: number
  readonly height: number
}

// A track event's colour shift as the simulation gives it (red, green, blue, alpha).
export type ColourShiftLike = {
  readonly shifts: readonly number[]
  readonly biases: readonly number[]
}

// A position as the simulation gives it.
export type Vector3Like = {
  readonly x: number
  readonly y: number
  readonly z: number
}

// The camera as the BSP draw needs it: its position and the six planes of its frustum, in world space.
export type FrustumView = {
  readonly eye: Vector3Like
  readonly planes: readonly BspPlane[]
}

// The three parts of a racer's car: the wheels (a skeleton instance in the display frame), the car model and the
// driver (a skeleton instance). A car built from bricks has no model or driver yet.
export type RacerRig = {
  readonly wheels: ModelObject
  readonly body: ModelObject | null
  readonly driver: ModelObject | null
  readonly objects: readonly SceneObject[]
}

// The scene graphs of a race and the camera, ready to be rendered or read (the render trace reads them).
export type RaceStage = Pick<RaceViewport, 'update' | 'showHazards' | 'animate' | 'dispose'> & {
  readonly backgroundScene: ThreeScene
  readonly trackScene: ThreeScene
  readonly screenFadeOverlay: ScreenFadeOverlay
  readonly camera: PerspectiveCamera
  readonly racerRigs: readonly RacerRig[]
}
