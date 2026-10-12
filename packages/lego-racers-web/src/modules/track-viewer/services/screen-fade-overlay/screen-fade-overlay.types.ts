import type { ScreenFadeView } from '@lego-games/lego-racers/race-presentation'
import type { OrthographicCamera, Scene } from 'three'

export type ScreenFadeOverlay = {
  readonly scene: Scene
  readonly camera: OrthographicCamera
  readonly update: (fades: readonly ScreenFadeView[]) => void
  readonly dispose: () => void
}
