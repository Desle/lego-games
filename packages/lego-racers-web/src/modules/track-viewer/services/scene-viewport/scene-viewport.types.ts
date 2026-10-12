import type { Scene } from '@lego-games/lego-racers/scene'
import type { SceneBackground } from '../../types/track-viewer.types.ts'
import type { SceneObject } from '../scene-object/scene-object.types.ts'
import type { SkyObject } from '../sky-object/sky-object.types.ts'

export type SceneViewport = {
  readonly showScene: (scene: Scene | null, background: SceneBackground | null) => void
  // Moves the camera to the scene's world camera with this index, or frames the whole scene when absent.
  readonly showCamera: (cameraIndex: number | null) => void
  // Plays or pauses the animated instances and the sky.
  readonly setIsAnimationPlaying: (isAnimationPlaying: boolean) => void
  readonly dispose: () => void
}

// The three.js objects of the scene being shown: the track, and the background drawn before it.
export type ShownScene = {
  readonly scene: Scene
  readonly track: SceneObject
  readonly backdrop: SceneObject | null
  readonly sky: SkyObject | null
}
