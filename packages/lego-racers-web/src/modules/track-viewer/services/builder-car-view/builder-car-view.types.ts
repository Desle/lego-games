import type { BuilderPreview } from '@lego-games/lego-racers/front-end'

export type BuilderCarView = {
  // Shows the car of the design in the scene (built again only when the design changed).
  readonly show: (preview: BuilderPreview) => void
  readonly dispose: () => void
}
