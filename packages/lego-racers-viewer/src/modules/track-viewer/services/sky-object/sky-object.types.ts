import type { SkyPlacement, SkyPoint } from '@lego-games/lego-racers/sky'
import type { Mesh } from 'three'

export type SkyObject = {
  readonly mesh: Mesh
  // Advances the sky by whole milliseconds and recolours the dome.
  readonly animate: (deltaMilliseconds: number) => void
  // Puts the dome for this camera position and returns where the background world goes.
  readonly place: (cameraPosition: SkyPoint) => SkyPlacement
  readonly dispose: () => void
}
