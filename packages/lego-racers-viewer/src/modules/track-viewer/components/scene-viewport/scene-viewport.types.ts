import type { Scene } from '@lego-games/lego-racers/scene'
import type { SceneBackground } from '../../types/track-viewer.types.ts'

export type SceneViewportProps = {
  readonly scene: Scene | null
  readonly background: SceneBackground | null
  readonly selectedCameraIndex: number | null
  readonly isAnimationPlaying: boolean
}
