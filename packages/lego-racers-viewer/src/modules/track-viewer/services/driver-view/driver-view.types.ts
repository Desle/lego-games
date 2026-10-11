import type { DriverPreview } from '@lego-games/lego-racers/front-end'

export type DriverView = {
  // Shows the driver of the part bytes in the scene (built again only when they changed).
  readonly show: (preview: DriverPreview, position: readonly [number, number, number]) => void
  readonly dispose: () => void
}
