import type { Scene } from '@lego-games/lego-racers/scene'

export type SceneViewport = {
  readonly showScene: (scene: Scene | null) => void
  // Moves the camera to the scene's world camera with this index, or frames the whole scene when absent.
  readonly showCamera: (cameraIndex: number | null) => void
  readonly dispose: () => void
}
