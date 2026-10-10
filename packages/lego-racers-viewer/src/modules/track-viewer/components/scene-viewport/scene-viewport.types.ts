import type { Scene } from '@lego-games/lego-racers/scene'

export type SceneViewportProps = {
  readonly scene: Scene | null
  readonly selectedCameraIndex: number | null
}
