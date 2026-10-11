import type { CameraView } from '@lego-games/lego-racers/race-camera'
import type { Group } from 'three'
import type { SceneObject } from '../scene-object/scene-object.types.ts'
import type { RacerPose } from '@lego-games/lego-racers/race-presentation'

// The WebGL view of a race: the track, sky and backdrop, a car and a driver per racer, and the player's camera.
export type RaceViewport = {
  // Puts every racer at its pose and the camera where the chase camera says.
  readonly update: (poses: readonly RacerPose[], cameraView: CameraView) => void
  // Advances the animated instances and the sky by whole milliseconds.
  readonly animate: (deltaMilliseconds: number) => void
  readonly render: () => void
  readonly dispose: () => void
}

// The size the race is drawn at; the HUD is laid out for the same size.
export type RaceStageSize = {
  readonly width: number
  readonly height: number
}

// A model drawn as three.js objects, scaled and offset inside its racer's rig.
export type ModelObject = {
  readonly group: Group
  readonly object: SceneObject
}
