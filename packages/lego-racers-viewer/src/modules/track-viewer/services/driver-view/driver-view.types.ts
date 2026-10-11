import type { DriverPreview } from '@lego-games/lego-racers/front-end'

export type DriverView = {
  // Shows the driver of the part bytes in the scene at his place (built again only when the parts changed).
  readonly show: (preview: DriverPreview) => void
  // Advances the figure's animation by whole milliseconds.
  readonly animate: (deltaMilliseconds: number) => void
  readonly dispose: () => void
}
